import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { GUIDES, loadComponent, readGuide } from './harness.mjs';
import { catalogSource } from '../scripts/build-course-catalog.mjs';

const scope = {};
runInNewContext(readGuide('course-catalog.js'), scope);
runInNewContext(readGuide('practice-home.js'), scope);
const courses = scope.DCCourseCatalog;
const { summarizeProgress, readProgress, latestSession } = scope.DCPracticeHome;
const course = courses.find(course => course.id === 'behringer');
const save = (state, savedAt = 100, version = 1) => JSON.stringify({ version, savedAt, state });

function storageForTest(t) {
  const original = globalThis.localStorage;
  const storage = new Map();
  globalThis.localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key),
  };
  t.after(() => {
    if (original === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = original;
  });
  return storage;
}

test('home catalog is generated from the current lesson titles and checklists', () => {
  assert.equal(readGuide('course-catalog.js'), catalogSource(), 'Run npm run catalog after changing the curriculum');
  assert.equal(courses.length, GUIDES.length);
  assert.equal(new Set(courses.map(course => course.storageKey)).size, GUIDES.length);
});

test('all six courses are discoverable without the app runtime, with a route home', () => {
  const home = readGuide('index.dc.html');
  const cards = [...home.matchAll(/<article\b[^>]*data-course="([^"]+)"[^>]*>([\s\S]*?)<\/article>/g)];
  assert.equal(cards.length, GUIDES.length);
  assert.equal(new Set(cards.map(card => card[1])).size, GUIDES.length);
  for (const course of courses) {
    const card = cards.find(card => card[1] === course.id);
    assert.ok(card, `${course.file}: missing from home`);
    const href = card[2].match(/class="home-action course-link" href="([^"]+)"/)[1];
    assert.equal(decodeURIComponent(href), `./${course.file}`);
    assert.match(readGuide(course.file), /href="\.\/index\.dc\.html"[^>]*>All courses<\/a>/);
    const { inst, dispose } = loadComponent(course.file);
    try {
      const weeks = inst.STEPS.filter(step => step.kind === 'weekintro').length;
      assert.match(card[2], course.id === 'ddj-flx4'
        ? /8 weeks \+ optional scratch week/ : new RegExp(`${weeks} weeks`));
    } finally { dispose(); }
  }
  assert.doesNotMatch(home, /<x-dc|src="\.\/support\.js"|unsafe-eval|unsafe-inline/);
  assert.match(readGuide('index.html'), /http-equiv="refresh" content="0;url=\.\/index\.dc\.html"/);
  // Check local navigation and assets on both entrypoints, including fragment targets.
  for (const file of ['index.html', 'index.dc.html']) {
    const html = readGuide(file);
    for (const [, url] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
      if (url.startsWith('#')) assert.ok(html.includes(`id="${url.slice(1)}"`), url);
      else assert.ok(existsSync(new URL(`../${decodeURIComponent(url)}`, import.meta.url)), `${file}: missing ${url}`);
    }
  }
});

test('a last-page visit does not count as completed practice', () => {
  const summary = summarizeProgress(course, save({ step: course.steps.length - 1, checks: {} }));
  assert.equal(summary.started, true);
  assert.equal(summary.checked, 0);
  assert.equal(summary.percent, 0);
  const checks = Object.fromEntries(course.steps.filter(step => step.items).map(step => [step.id, Array(step.items).fill(true)]));
  const completed = summarizeProgress(course, save({ step: 0, checks }));
  assert.equal(completed.percent, 100);
  assert.equal(completed.checked, completed.total);
});

test('progress counts only existing checklist items explicitly checked true', () => {
  const summary = summarizeProgress(course, save({ step: 2, checks: {
    'w1-1': [true, 'true', true, true], 'w1-2': [1, false, true],
    'old-removed-lesson': [true, true], 'w2-1': 'bad',
  } }));
  assert.equal(summary.checked, 2);
  assert.equal(summary.total, course.steps.reduce((sum, step) => sum + step.items, 0));
  assert.equal(summary.lesson.id, 'w1-1');
});

test('corrupt and incompatible progress never breaks the home', () => {
  for (const raw of [null, '', '{', 'null', '[]', '42', '{}', save(null), save([]), save(false), save({ step: 4 }, 1, 999)]) {
    assert.equal(summarizeProgress(course, raw), null, String(raw));
  }
  for (const checks of [null, [], false, 'broken', { 'w1-1': null }]) {
    assert.equal(summarizeProgress(course, save({ step: 2, checks })).checked, 0);
  }
  for (const [step, expected] of [[1.9, 1], [-5, 0], [9999, course.steps.length - 1], ['8', 0], [null, 0]]) {
    assert.equal(summarizeProgress(course, save({ step })).step, expected);
  }
  assert.equal(summarizeProgress(course, '{"version":1,"state":{"step":1e999}}').step, 0);
});

test('continue chooses the latest active course and ignores a reset or unopened overview', () => {
  const sessions = [
    summarizeProgress(courses[0], save({ step: 4 }, 100)),
    summarizeProgress(courses[1], save({ step: 8 }, 200)),
    summarizeProgress(courses[2], save({ step: 0, checks: {} }, 300)),
  ];
  assert.equal(latestSession(sessions).course.id, courses[1].id);
  assert.equal(latestSession([]), null);
  const reset = summarizeProgress(courses[1], save({ step: 0, checks: {} }, 400));
  assert.equal(latestSession([sessions[0], reset]).course.id, courses[0].id);
});

test('reading home progress never writes and tolerates inaccessible storage or one damaged course', () => {
  const data = new Map([[courses[0].storageKey, '{'], [courses[1].storageKey, save({ step: 7 })]]);
  const result = readProgress(courses, { getItem: key => data.get(key) ?? null });
  assert.equal(result.unavailable, false);
  assert.equal(result.sessions.length, 1);
  assert.equal(result.sessions[0].course.id, courses[1].id);
  const blocked = readProgress(courses, { getItem() { throw new Error('Storage blocked'); } });
  assert.equal(blocked.unavailable, true);
  assert.equal(blocked.sessions.length, 0);
});

test('every guide saves a session the home can summarize and the guide can resume', t => {
  const storage = storageForTest(t);
  for (const course of courses) {
    const first = loadComponent(course.file);
    const step = first.inst.STEPS.findIndex(step => step.items?.length);
    const id = first.inst.STEPS[step].id;
    try {
      first.inst.goToStep(step);
      first.inst.toggleCheck(id, 0);
      first.inst.saveProgress();
      const summary = summarizeProgress(course, storage.get(course.storageKey));
      assert.equal(summary.step, step, course.id);
      assert.equal(summary.lesson.title, first.inst.STEPS[step].title, course.id);
      assert.equal(summary.checked, 1, course.id);
    } finally { first.inst.disablePersistence(); first.dispose(); }
    const second = loadComponent(course.file);
    try {
      assert.equal(second.inst.state.step, step, course.id);
      assert.equal(second.inst.state.checks[id][0], true, course.id);
      assert.doesNotThrow(() => second.inst.renderVals(), course.id);
    } finally { second.inst.disablePersistence(); second.dispose(); }
  }
});

test('all six guides recover malformed checklist state and fractional lesson positions', t => {
  const storage = storageForTest(t);
  for (const course of courses) {
    for (const checks of [null, [], false, { 'w1-1': 7 }]) {
      storage.set(course.storageKey, save({ step: 2.5, checks }));
      const { inst, dispose } = loadComponent(course.file);
      try {
        assert.equal(inst.state.step, 2, course.id);
        assert.deepEqual(inst.state.checks, {}, course.id);
        assert.doesNotThrow(() => inst.renderVals(), course.id);
        const lesson = inst.STEPS.find(step => step.items?.length);
        inst.toggleCheck(lesson.id, 0);
        assert.equal(inst.state.checks[lesson.id][0], true, course.id);
      } finally { inst.disablePersistence(); dispose(); }
    }
  }
});

test('hydration drops removed checklist rows, overflow entries and inherited state keys', t => {
  const storage = storageForTest(t);
  storage.set(course.storageKey, '{"version":1,"state":{"step":2,"checks":{"w1-1":[true,"true",true],"removed":[true]},"__proto__":{"unexpected":true},"constructor":"bad","unexpected":true}}');
  const { inst, dispose } = loadComponent(course.file);
  try {
    assert.deepEqual(inst.state.checks, { 'w1-1': [true, false] });
    assert.equal(inst.state.unexpected, undefined);
    assert.equal(Object.hasOwn(inst.state, 'constructor'), false);
    assert.equal(Object.hasOwn(inst.state, '__proto__'), false);
    inst.setState({ unexpectedSerializableValue: { label: 'not learner state' } });
    inst.saveProgress();
    assert.equal('unexpectedSerializableValue' in JSON.parse(storage.get(course.storageKey)).state, false);
  } finally { inst.disablePersistence(); dispose(); }
});

test('a full storage quota does not prevent reading an existing saved session', t => {
  const storage = storageForTest(t);
  storage.set(course.storageKey, save({ step: 4, checks: { 'w1-1': [true] } }));
  globalThis.localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
  const { inst, dispose } = loadComponent(course.file);
  try {
    assert.equal(inst.state.step, 4);
    assert.equal(inst.state.checks['w1-1'][0], true);
    assert.doesNotThrow(() => inst.saveProgress());
  } finally { inst.disablePersistence(); dispose(); }
});

test('dismissing the restored-session notice preserves the saved work', t => {
  const storage = storageForTest(t);
  storage.set(course.storageKey, save({ step: 4, checks: { 'w1-1': [true] } }));
  const { inst, dispose } = loadComponent(course.file);
  try {
    const before = storage.get(course.storageKey);
    inst.clearResumeNotice();
    assert.equal(inst.state.resumeAvailable, false);
    assert.equal(storage.get(course.storageKey), before);
    assert.equal(inst.state.step, 4);
    assert.match(readGuide(course.file), />Dismiss<\/button>/);
    for (const { file } of GUIDES) {
      const notices = [...readGuide(file).matchAll(/<button[^>]*onclick="{{ clearResumeNotice }}"[^>]*>([^<]+)<\/button>/g)];
      for (const notice of notices) assert.equal(notice[1], 'Dismiss', `${file}: a notice dismissal must not promise to clear saved work`);
    }
  } finally { inst.disablePersistence(); dispose(); }
});
