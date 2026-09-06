import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { readGuide } from './harness.mjs';

const scope = {};
runInNewContext(readGuide('practice-sessions.js'), scope);
const P = scope.DCPracticeSessions;
const first = P.sessions[0], second = P.sessions[1];
const plain = value => JSON.parse(JSON.stringify(value));
const memory = () => {
  const data = new Map();
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
};
const ready = session => ({ ...P.emptyRecord(session), checks: session.checks.map(() => true), reflection: 'ready' });

test('seven original sessions lead from an audible pulse to a kept export', () => {
  assert.equal(P.sessions.length, 7);
  assert.equal(new Set(P.sessions.map(session => session.id)).size, 7);
  for (const session of P.sessions) {
    assert.ok(session.minutes >= 10 && session.minutes <= 15);
    assert.equal(session.steps.length, 3);
    assert.equal(session.checks.length, 3);
    for (const value of [session.title, session.outcome, session.listen, session.stretch, ...session.steps, ...session.checks]) assert.ok(value.trim().length > 10);
  }
  assert.match(P.sessions.at(-1).steps.join(' '), /downloaded audio/);
  assert.equal(P.getSession('unknown'), null);
});

test('a session requires listening goals and reflection; opening or drafting earns no activity', () => {
  const storage = memory(), store = new P.PracticeStore(storage);
  const before = store.readAll();
  assert.equal(storage.data.size, 0, 'reading is non-destructive');
  assert.equal(P.recommended(before.records).id, first.id);
  assert.throws(() => P.complete(first, P.emptyRecord(first)), /Check each/);
  assert.throws(() => P.complete(first, { ...ready(first), reflection: '' }), /Check each/);
  store.save(first, ready(first));
  assert.deepEqual(plain(P.summarize(store.readAll().records)), { completed: 0, practiceDays: 0 });
  const now = new Date(2026, 8, 5, 12);
  store.save(first, P.complete(first, ready(first), now));
  const after = store.readAll();
  assert.deepEqual(plain(P.summarize(after.records, now)), { completed: 1, practiceDays: 1 });
  assert.equal(P.recommended(after.records).id, second.id);
});

test('a later checklist, note, reflection or save-for-later draft is recommended before untouched sessions', () => {
  const later = P.sessions[3], now = new Date(2026, 8, 5, 12);
  assert.equal(P.hasDraft(P.emptyRecord(later)), false);
  assert.equal(P.hasDraft(undefined), false);
  for (const changes of [{ checks: [true, false, false] }, { note: 'Try fewer hats.' }, { reflection: 'revisit' }, {}]) {
    const storage = memory(), store = new P.PracticeStore(storage);
    const draft = { ...P.emptyRecord(later), ...changes };
    if (Object.keys(changes).length) assert.equal(P.recommended({ [later.id]: draft }).id, later.id, 'legacy drafts also resume without a timestamp');
    store.readAll();
    store.save(later, draft, now);
    const { records } = new P.PracticeStore(storage).readAll();
    assert.equal(P.hasDraft(records[later.id]), true);
    assert.equal(P.recommended(records).id, later.id);
    assert.deepEqual(plain(P.summarize(records, now)), { completed: 0, practiceDays: 0 });
  }
});

test('the most recently saved unfinished draft wins, and completing it returns to the remaining draft', () => {
  const storage = memory(), store = new P.PracticeStore(storage), later = P.sessions[4];
  store.readAll();
  const earlier = new Date(2026, 8, 5, 10), recent = new Date(2026, 8, 5, 11), latest = new Date(2026, 8, 5, 12);
  store.save(second, { ...P.emptyRecord(second), note: 'Leave space.' }, earlier);
  store.save(later, { ...P.emptyRecord(later), reflection: 'revisit' }, recent);
  assert.equal(P.recommended(store.readAll().records).id, later.id);
  store.save(second, { ...P.emptyRecord(second), note: 'Come back to the bass.' }, latest);
  assert.equal(P.recommended(store.readAll().records).id, second.id);
  store.save(second, P.complete(second, ready(second), latest), latest);
  assert.equal(P.recommended(store.readAll().records).id, later.id);
  store.save(later, P.complete(later, ready(later), latest), latest);
  assert.equal(P.recommended(store.readAll().records).id, first.id);
});

test('legacy v1 drafts without timestamps remain readable and resume without rewriting existing data', () => {
  const storage = memory(), later = P.sessions[2];
  const legacy = { version: 1, checks: [false, false, false], reflection: '', note: 'Keep the answer sparse.', completedAt: 0, days: [] };
  const raw = JSON.stringify(legacy);
  storage.data.set(P.PREFIX + later.id, raw);
  const store = new P.PracticeStore(storage), { records, errors } = store.readAll();
  assert.equal(errors.length, 0);
  assert.equal(records[later.id].updatedAt, 0);
  assert.deepEqual(plain(records[later.id]), { ...legacy, updatedAt: 0 });
  assert.equal(P.recommended(records).id, later.id);
  assert.equal(storage.getItem(P.PREFIX + later.id), raw);
  const now = new Date(2026, 8, 5, 12);
  const updated = store.save(later, records[later.id], now);
  assert.deepEqual(plain(updated), { ...legacy, updatedAt: now.getTime() });
  assert.equal(JSON.parse(storage.getItem(P.PREFIX + later.id)).version, 1);
});

test('a failed draft write preserves its previous timestamp and allows a successful retry', () => {
  const storage = memory(), store = new P.PracticeStore(storage);
  store.readAll();
  const before = new Date(2026, 8, 5, 10), after = new Date(2026, 8, 5, 12);
  const draft = store.save(second, { ...P.emptyRecord(second), note: 'Original idea.' }, before);
  const raw = storage.getItem(P.PREFIX + second.id), write = storage.setItem;
  const changed = { ...draft, note: 'New idea.' };
  storage.setItem = () => { throw new Error('Quota exceeded'); };
  assert.throws(() => store.save(second, changed, after), /Quota/);
  assert.equal(changed.updatedAt, before.getTime(), 'failed writes do not stamp the caller’s draft');
  assert.equal(storage.getItem(P.PREFIX + second.id), raw);
  storage.setItem = write;
  const saved = store.save(second, changed, after);
  assert.equal(saved.updatedAt, after.getTime());
  assert.equal(store.read(second).note, 'New idea.');
});

test('repeat practice and several sessions on one date count as one practice day', () => {
  const now = new Date(2026, 8, 5, 18), earlier = new Date(2026, 8, 5, 9);
  const once = P.complete(first, ready(first), earlier);
  const twice = P.complete(first, once, now);
  assert.deepEqual(plain(twice.days), ['2026-09-05']);
  assert.deepEqual(plain(P.summarize({ [first.id]: twice, [second.id]: P.complete(second, ready(second), now) }, now)), { completed: 2, practiceDays: 1 });
});

test('activity uses seven local calendar dates across month boundaries and excludes future dates', () => {
  const now = new Date(2026, 2, 2, 0, 5);
  const record = { ...ready(first), completedAt: now.getTime(), days: ['2026-02-23', '2026-02-24', '2026-03-01', '2026-03-02', '2026-03-03'] };
  assert.equal(P.summarize({ [first.id]: record }, now).practiceDays, 3);
  assert.equal(P.localDay(new Date(2026, 11, 31, 23, 59)), '2026-12-31');
});

test('existing course and studio saves remain byte-for-byte unchanged; session notes round-trip', () => {
  const storage = memory();
  storage.data.set('303-404/behringer/v1', '{"version":1,"state":{"step":12}}');
  storage.data.set('303-404/studio/project/example', 'existing project');
  const original = [...storage.data];
  const store = new P.PracticeStore(storage); store.readAll();
  const record = P.complete(first, { ...ready(first), note: '<img src=x onerror=alert(1)> Try fewer hats.', reflection: 'revisit' });
  store.save(first, record);
  const restored = new P.PracticeStore(storage).read(first);
  assert.equal(restored.note, record.note);
  assert.equal(restored.reflection, 'revisit');
  assert.ok(restored.checks.every(Boolean));
  for (const [key, raw] of original) assert.equal(storage.getItem(key), raw);
});

test('corrupt and newer session saves are isolated and never silently overwritten', () => {
  for (const raw of ['{', 'null', '[]', '42', '{"version":99}']) {
    const storage = memory(); storage.data.set(P.PREFIX + first.id, raw);
    const store = new P.PracticeStore(storage), { records, errors } = store.readAll();
    assert.deepEqual(plain(errors), [first.id]);
    assert.equal(records[first.id].completedAt, 0);
    assert.throws(() => store.save(first, ready(first)), /unavailable/);
    assert.equal(storage.getItem(P.PREFIX + first.id), raw);
    store.save(second, P.complete(second, ready(second)));
    assert.ok(store.read(second).completedAt);
  }
});

test('malformed fields cannot inflate checklist goals or retain unbounded notes and history', () => {
  const normalized = P.normalizeRecord(first, { version: 1, checks: [true, 'true', 1, true], note: 'x'.repeat(600), reflection: 'perfect', completedAt: Infinity, updatedAt: Infinity, days: ['2026-02-30', null, '2026-02-28', '2026-02-28', 'not a date'] });
  assert.deepEqual(plain(normalized.checks), [true, false, false]);
  assert.equal(normalized.note.length, 500);
  assert.equal(normalized.reflection, '');
  assert.equal(normalized.completedAt, 0);
  assert.equal(normalized.updatedAt, 0);
  assert.deepEqual(plain(normalized.days), ['2026-02-28']);
});

test('quota failure earns no completion and permits a later retry', () => {
  const storage = memory(), store = new P.PracticeStore(storage); store.readAll();
  const write = storage.setItem;
  storage.setItem = () => { throw new Error('Quota exceeded'); };
  const completion = P.complete(first, ready(first));
  assert.throws(() => store.save(first, completion), /Quota/);
  assert.equal(storage.getItem(P.PREFIX + first.id), null);
  storage.setItem = write;
  store.save(first, completion);
  assert.ok(store.read(first).completedAt);
});

test('stale same-session edits are rejected while separate sessions save independently', () => {
  const storage = memory(), a = new P.PracticeStore(storage), b = new P.PracticeStore(storage);
  a.readAll(); b.readAll();
  a.save(first, { ...ready(first), note: 'Keep the hats sparse.' });
  assert.throws(() => b.save(first, { ...ready(first), note: 'A stale edit.' }), /another tab/);
  b.save(second, ready(second));
  assert.equal(a.read(first).note, 'Keep the hats sparse.');
  assert.ok(a.read(second).checks.every(Boolean));
});

test('all sessions remain available and a completed path recommends a skill marked for revisiting', () => {
  const records = Object.fromEntries(P.sessions.map(session => [session.id, P.complete(session, ready(session))]));
  records[second.id].reflection = 'revisit';
  assert.equal(P.recommended(records).id, second.id);
  records[second.id].reflection = 'ready';
  assert.equal(P.recommended(records).id, 'finish');
  const skippedAhead = { finish: records.finish };
  assert.equal(P.summarize(skippedAhead).completed, 1);
  assert.equal(P.recommended(skippedAhead).id, first.id);
});
