import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { readGuide } from './harness.mjs';

const plain = value => JSON.parse(JSON.stringify(value));
function model() {
  const scope = {};
  for (const file of ['studio/banks.js', 'studio/project.js', 'arcade/game.js', 'arcade/remix.js']) runInNewContext(readGuide(file), scope);
  return { scope, G: scope.DCBeatArcade, P: scope.DCStudioProject, R: scope.DCArcadeRemix, banks: scope.DCStudioBanks };
}
function memory() {
  const data = new Map();
  return { data, get length() { return data.size; }, key: i => [...data.keys()][i] ?? null,
    getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key) };
}

test('six original challenges award stars for exact lanes, including missing and extra hits', () => {
  const { G } = model();
  assert.equal(G.CHALLENGES.length, 6); assert.equal(new Set(G.CHALLENGES.map(c => c.id)).size, 6);
  assert.equal(new Set(G.CHALLENGES.map(c => JSON.stringify(c.rows))).size, 6);
  for (const c of G.CHALLENGES) {
    assert.equal(G.check(G.emptyRows(), c).stars, 0);
    assert.equal(G.check(c.rows, c).stars, 3);
    assert.equal(c.bpm >= 80 && c.bpm <= 140, true);
    for (const { key } of G.VOICES) {
      assert.ok(c.rows[key].length > 0);
      assert.equal(new Set(c.rows[key]).size, c.rows[key].length);
      assert.ok(c.rows[key].every(i => Number.isInteger(i) && i >= 0 && i < 16));
      const missing = G.copyRows(c.rows); missing[key].pop();
      assert.equal(G.check(missing, c).stars, 2);
      const extra = G.copyRows(c.rows); extra[key].push(Array.from({ length: 16 }, (_, i) => i).find(i => !extra[key].includes(i)));
      assert.equal(G.check(extra, c).stars, 2);
      const reordered = G.copyRows(c.rows); reordered[key].reverse();
      assert.equal(G.check(reordered, c).stars, 3);
    }
  }
  for (const bad of [null, { bd: [16], sd: [], ch: [] }, { bd: [-1], sd: [], ch: [] }, { bd: [0.5], sd: [], ch: [] }]) assert.throws(() => G.copyRows(bad));
});

test('playback, solos and Studio handoff preserve actual user edits without seeding unrelated music', () => {
  const { G, P, banks } = model(), c = G.CHALLENGES[2], original = JSON.stringify(c);
  const rows = G.copyRows(c.rows); rows.bd.push(15);
  const project = G.createProject(banks, c, rows);
  assert.equal(project.bpm, c.bpm);
  assert.deepEqual(plain(project.arrangement), [{ scene: 'B', bars: 4 }]);
  for (const scene of project.scenes) {
    assert.equal(scene.mix.muteDrums, false); assert.equal(scene.mix.muteBass, true);
    assert.ok(scene.bass.notes.every(n => n === null));
    for (const key of P.VOICES) assert.deepEqual(plain(scene.drums.rows[key]), plain(rows[key] || []));
    assert.equal(scene.drums.source.type, 'original_practice');
  }
  project.scenes[0].drums.rows.bd.push(13);
  assert.equal(project.scenes[1].drums.rows.bd.includes(13), false);
  assert.equal(rows.bd.includes(13), false);
  for (const { key } of G.VOICES) {
    const solo = G.createProject(banks, c, c.rows, { solo: key, bpm: 75 });
    assert.equal(solo.bpm, 75);
    for (const v of P.VOICES) assert.deepEqual(plain(solo.scenes[1].drums.rows[v]), plain(v === key ? c.rows[v] : []));
  }
  assert.equal(JSON.stringify(c), original);
});

test('star awards cannot decrease, combine partial lanes across attempts, or overwrite damaged data', () => {
  const { G } = model(), storage = memory(), id = G.CHALLENGES[0].id;
  storage.setItem('303-404/behringer/v1', 'existing course');
  assert.equal(G.saveBest(storage, id, 0).best, 0); assert.equal(storage.length, 1);
  assert.equal(G.saveBest(storage, id, 1).best, 1);
  assert.equal(G.saveBest(storage, id, 1).best, 1);
  assert.equal(G.saveBest(storage, id, 3).best, 3);
  assert.equal(G.saveBest(storage, id, 2).best, 3);
  assert.equal(storage.getItem('303-404/behringer/v1'), 'existing course');
  assert.throws(() => G.saveBest(storage, id, 4)); assert.throws(() => G.saveBest(storage, '__proto__', 3));
  const damagedId = G.CHALLENGES[1].id, key = `${G.PREFIX}${damagedId}/3`;
  storage.setItem(key, '{"version":99,"earned":true}');
  assert.deepEqual(plain(G.readBest(storage, damagedId)), { best: 0, damaged: true });
  assert.throws(() => G.saveBest(storage, damagedId, 3));
  assert.equal(storage.getItem(key), '{"version":99,"earned":true}');
  storage.setItem = () => { throw new Error('Quota exceeded'); };
  assert.throws(() => G.saveBest(storage, G.CHALLENGES[2].id, 3));
  assert.equal(G.readBest(storage, G.CHALLENGES[2].id).best, 0);
});

// This DOM double exercises application events against the real HTML shells.
// It does not measure layout, device latency, browser DSP, or sound quality.
class Element {
  constructor(tag, doc) {
    this.tagName = tag.toUpperCase(); this.doc = doc; this.children = []; this.dataset = {}; this.attributes = {};
    this.listeners = new Map(); this.textContent = ''; this.hidden = false; this.disabled = false; this._value = undefined;
  }
  get value() { return this._value ?? (this.tagName === 'SELECT' ? this.children[0]?.value || '' : this.textContent); }
  set value(value) { this._value = String(value); }
  append(...children) { for (const child of children) { child.parentElement = this; this.children.push(child); } }
  replaceChildren(...children) { this.children = []; this.append(...children); }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (['id', 'type', 'href', 'value'].includes(name)) this[name] = value;
    if (name === 'class') this.className = value;
    if (['hidden', 'disabled'].includes(name)) this[name] = true;
    if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = String(value);
  }
  getAttribute(name) { return this.attributes[name] ?? null; }
  matches(selector) {
    if (selector[0] === '#') return this.id === selector.slice(1);
    if (selector[0] === '.') return (this.className || '').split(' ').includes(selector.slice(1));
    const attr = /^\[([\w-]+)(?:="([^"]+)")?\]$/.exec(selector);
    if (attr) {
      const value = attr[1].startsWith('data-') ? this.dataset[attr[1].slice(5)] : this.attributes[attr[1]];
      return value !== undefined && (attr[2] === undefined || String(value) === attr[2]);
    }
    return this.tagName.toLowerCase() === selector;
  }
  querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  addEventListener(type, fn) { this.listeners.set(type, [...(this.listeners.get(type) || []), fn]); }
  async fire(type, extra = {}) { for (const fn of this.listeners.get(type) || []) await fn({ target: this, preventDefault() {}, ...extra }); }
  focus() { this.doc.activeElement = this; this.fire('focus'); }
}
function dom(html) {
  const document = { hidden: false, listeners: new Map(), addEventListener: Element.prototype.addEventListener, fire: Element.prototype.fire };
  const root = new Element('document', document), stack = [root];
  document.createElement = tag => new Element(tag, document);
  document.getElementById = id => root.querySelector('#' + id);
  for (const [, closing, tag, attributes] of html.matchAll(/<(\/?)([a-z][\w-]*)([^>]*)>/gi)) {
    if (closing) { if (stack.at(-1).tagName.toLowerCase() === tag.toLowerCase()) stack.pop(); continue; }
    const node = document.createElement(tag);
    for (const [, name, value] of attributes.matchAll(/([\w-]+)(?:="([^"]*)")?/g)) node.setAttribute(name, value ?? '');
    stack.at(-1).append(node);
    if (!['meta', 'link', 'input', 'br', 'img', 'hr'].includes(tag.toLowerCase())) stack.push(node);
  }
  return document;
}
function app({ storage = memory(), file = 'beat-arcade.html', search = '', AudioContext } = {}) {
  const { scope, G, P, banks } = model(), document = dom(readGuide(file));
  const timers = new Map(), transports = [], previews = [];
  let timerId = 0, navigated = null;
  const window = { localStorage: storage, AudioContext, location: { search, href: `https://example.test/${file}${search}`, assign: url => { navigated = url; } },
    history: { replaceState: (_, __, url) => { window.location.search = url.search; window.location.href = url.href; } },
    listeners: new Map(), addEventListener: Element.prototype.addEventListener, fire: Element.prototype.fire };
  class Transport {
    constructor(ctx, getProject, events) { this.getProject = getProject; this.events = events; transports.push(this); }
    start(mode, sceneId) { this.project = P.validateProject(this.getProject()); this.sceneId = sceneId; this.running = true; }
    queueScene(id) { this.pending = id; }
    stop() { this.pending = null; if (this.running) { this.running = false; this.events.onStop(); } }
  }
  class Engine {
    constructor() { this.closed = false; this.hits = []; previews.push(this); }
    drum(...args) { this.hits.push(args); }
    stop() { this.closed = true; }
  }
  Object.assign(scope, { window, document, URL, URLSearchParams, DCStudioAudio: { Transport, Engine },
    setTimeout: fn => { timers.set(++timerId, fn); return timerId; }, clearTimeout: id => timers.delete(id) });
  runInNewContext(readGuide(file === 'beat-arcade.html' ? 'arcade/app.js' : 'studio/app.js'), scope);
  const $ = id => document.getElementById(id);
  const pad = (lane, step) => $('pattern-grid').children[lane].children[1].children[step];
  return { G, P, banks, $, pad, window, document, storage, timers, transports, previews, get navigated() { return navigated; } };
}
async function solve(a, challenge = a.G.CHALLENGES[0]) {
  for (const [lane, voice] of a.G.VOICES.entries()) for (const step of challenge.rows[voice.key]) await a.pad(lane, step).fire('click');
  await a.$('check-beat').fire('click');
}

test('Arcade UI preserves round drafts, has keyboard controls, and only fresh checks award stars', async () => {
  const a = app();
  assert.equal(a.storage.length, 0);
  await a.$('show-pattern').fire('click'); assert.equal(a.storage.length, 0);
  await solve(a);
  assert.equal(a.$('total-stars').textContent, '3 / 18'); assert.equal(a.$('next-beat').hidden, false);
  await a.pad(0, 15).fire('click'); assert.equal(a.$('next-beat').hidden, true);
  assert.equal(a.$('lane-results').children.length, 0);
  await a.$('check-beat').fire('click'); assert.equal(a.$('total-stars').textContent, '3 / 18');
  await a.$('challenge-list').children[1].children[0].fire('click');
  assert.equal(a.pad(0, 15).getAttribute('aria-pressed'), 'false');
  await a.$('challenge-list').children[0].children[0].fire('click');
  assert.equal(a.pad(0, 15).getAttribute('aria-pressed'), 'true');
  assert.equal(a.$('show-pattern').getAttribute('aria-pressed'), 'false');
  await a.pad(0, 15).fire('keydown', { key: 'ArrowRight' }); assert.equal(a.document.activeElement, a.pad(0, 0));
  await a.pad(0, 0).fire('keydown', { key: 'ArrowDown' }); assert.equal(a.document.activeElement, a.pad(1, 0));
  assert.equal(a.pad(1, 0).tabIndex, 0);
  const restored = app({ storage: a.storage }); assert.equal(restored.$('total-stars').textContent, '3 / 18');
});

test('Arcade handoff saves a separate project; Studio opens the requested ID instead of the newest one', async () => {
  const storage = memory(), a = app({ storage }), existing = a.P.createProject(a.banks);
  new a.P.ProjectStore(storage).save(existing);
  const before = storage.getItem(a.P.PREFIX + existing.id);
  await a.pad(0, 15).fire('click'); await a.pad(1, 3).fire('click');
  a.$('solo').value = 'ch'; a.$('speed').value = '.75';
  await a.$('open-studio').fire('click');
  assert.ok(a.navigated);
  const search = new URL(a.navigated, 'https://example.test/').search;
  const id = new URLSearchParams(search).get('project');
  assert.notEqual(id, existing.id); assert.equal(storage.getItem(a.P.PREFIX + existing.id), before);
  const saved = JSON.parse(storage.getItem(a.P.PREFIX + id));
  assert.deepEqual(saved.scenes[1].drums.rows.bd, [15]); assert.deepEqual(saved.scenes[1].drums.rows.sd, [3]);
  assert.equal(saved.bpm, a.G.CHALLENGES[0].bpm);
  const newer = { ...existing, updatedAt: saved.updatedAt + 1000 };
  storage.setItem(a.P.PREFIX + newer.id, JSON.stringify(newer));
  const studio = app({ storage, file: 'groove-studio.html', search });
  assert.equal(studio.$('project-name').value, saved.name);
  assert.equal(studio.$('drum-grid').children[15].getAttribute('aria-pressed'), 'true');
  assert.equal(studio.window.location.search, '');
  const missing = app({ storage, file: 'groove-studio.html', search: '?project=missing' });
  assert.equal(missing.$('project-name').value, newer.name); assert.match(missing.$('error').textContent, /could not be found/);
});

test('failed score and project saves keep the current beat open and allow retry', async () => {
  const a = app(), write = a.storage.setItem;
  a.storage.setItem = () => { throw new Error('Quota exceeded'); };
  await solve(a);
  assert.equal(a.$('total-stars').textContent, '3 / 18'); assert.match(a.$('score-storage').textContent, /kept for this visit only/);
  assert.equal(app({ storage: a.storage }).$('total-stars').textContent, '0 / 18');
  await a.$('open-studio').fire('click'); assert.equal(a.navigated, null);
  assert.match(a.$('handoff-status').textContent, /Your beat is still here/);
  assert.equal(a.pad(0, 0).getAttribute('aria-pressed'), 'true');
  a.storage.setItem = write; await a.$('check-beat').fire('click');
  assert.equal(a.$('total-stars').textContent, '3 / 18');
  await a.$('open-studio').fire('click'); assert.ok(a.navigated);
});

test('audio startup cancellation, comparison, solo, edits and page hiding share safe lifecycle boundaries', async () => {
  const contexts = [];
  class AudioContext {
    constructor() { this.state = 'suspended'; this.currentTime = 0; contexts.push(this); }
    resume() { return new Promise(resolve => { this.release = () => { this.state = 'running'; resolve(); }; }); }
  }
  const a = app({ AudioContext });
  const starting = a.$('listen-target').fire('click'); await a.$('stop-audio').fire('click');
  contexts[0].release(); await starting;
  assert.equal(a.transports.length, 0);
  await a.$('listen-target').fire('click');
  assert.equal(a.transports.length, 1); assert.equal(a.transports[0].running, true);
  await a.pad(0, 15).fire('click');
  assert.equal(a.transports[0].getProject().scenes[1].drums.rows.bd.includes(15), false);
  await a.$('listen-yours').fire('click');
  assert.equal(a.transports[0].running, false);
  assert.deepEqual(plain(a.transports[1].getProject().scenes[1].drums.rows.bd), [15]);
  await a.pad(0, 7).fire('click');
  assert.deepEqual(plain(a.transports[1].getProject().scenes[1].drums.rows.bd), [15, 7]);
  a.$('solo').value = 'ch'; await a.$('solo').fire('change');
  assert.equal(a.transports[1].running, false);
  await a.$('listen-target').fire('click');
  assert.deepEqual(plain(a.transports[2].getProject().scenes[1].drums.rows.bd), []);
  a.document.hidden = true; await a.document.fire('visibilitychange');
  assert.equal(a.transports[2].running, false);
  assert.equal(a.$('stop-audio').disabled, true);
  assert.equal(a.$('listen-target').getAttribute('aria-pressed'), 'false');
});

test('Arcade assets and home routes exist without adding runtime dependencies or inline scripts', () => {
  const html = readGuide('beat-arcade.html');
  for (const [, url] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (url.startsWith('#')) assert.ok(html.includes(`id="${url.slice(1)}"`));
    else assert.ok(existsSync(new URL(`../${decodeURIComponent(url.split('#')[0])}`, import.meta.url)), url);
  }
  assert.doesNotMatch(html, /unsafe-eval|unsafe-inline|support\.js/);
  for (const file of ['index.html', 'groove-studio.html']) assert.match(readGuide(file), /href="\.\/beat-arcade\.html"/);
});

test('remix variations preserve the player original, skip no-ops, and undo full musical settings', () => {
  const { G, P, R, banks } = model();
  for (const c of G.CHALLENGES) {
    const draft = G.copyRows(c.rows); draft.bd.push(15);
    const session = new R.Session(banks, c, draft), before = JSON.stringify(draft), original = JSON.stringify(session.project.scenes[0]);
    const baseline = P.copy(session.scene);
    assert.equal(session.vary('fill'), true);
    for (const voice of ['bd', 'sd', 'ch']) assert.deepEqual(plain(session.scene.drums.rows[voice].filter(i => i < 12)), plain(baseline.drums.rows[voice].filter(i => i < 12)));
    assert.equal(session.vary('fill'), false); assert.equal(session.history.length, 1);
    const fill = P.copy(session.scene);
    assert.equal(session.vary('sparse'), true);
    assert.deepEqual(plain(session.scene.drums.rows.bd), plain(fill.drums.rows.bd));
    assert.deepEqual(plain(session.scene.drums.rows.sd), plain(fill.drums.rows.sd));
    assert.ok(session.scene.drums.rows.ch.length > 0);
    const sparse = P.copy(session.scene);
    session.vary('acid'); assert.equal(session.scene.mix.muteBass, false);
    session.undo(); assert.deepEqual(plain(session.scene), plain(sparse));
    session.redo(); assert.equal(session.scene.mix.muteBass, false);
    const acid = P.copy(session.scene);
    session.reset(); assert.deepEqual(plain(session.scene), plain(baseline));
    session.undo(); assert.deepEqual(plain(session.scene), plain(acid));
    session.toggle('bd', 13); assert.equal(session.future.length, 0);
    assert.equal(JSON.stringify(session.project.scenes[0]), original);
    assert.equal(JSON.stringify(draft), before);
  }
  const session = new R.Session(banks, G.CHALLENGES[0], { bd: [0], sd: [], ch: [2, 6, 10, 14] });
  while (session.vary('sparse')) {}
  assert.deepEqual(plain(session.scene.drums.rows.ch), [2]);
  assert.deepEqual(plain(session.scene.drums.rows.sd), []);
  assert.throws(() => session.toggle('bass', 0)); assert.throws(() => session.toggle('bd', 16));
});

test('three original acid phrases retain valid accents and slides, and audition settings never leak into saved music', () => {
  const { G, P, R, banks } = model(), c = G.CHALLENGES[0];
  const session = new R.Session(banks, c, c.rows), phrases = [];
  for (let i = 0; i < 3; i++) {
    session.vary('acid'); const bass = session.scene.bass;
    phrases.push(JSON.stringify(bass.notes));
    assert.equal(bass.source.type, 'original_practice'); assert.match(bass.source.detail, /written for Beat Arcade/);
    assert.ok(bass.notes.some(n => n === null));
    assert.ok(bass.notes.filter(Boolean).every(n => [0, 3, 5, 7, 10].includes(P.noteMidi(n) % 12)));
    assert.ok(bass.accent.every(i => bass.notes[i] !== null));
    assert.ok(bass.slide.every(i => bass.notes[i] !== null && bass.notes[(i + 1) % 16] !== null));
  }
  assert.equal(new Set(phrases).size, 3);
  session.vary('acid'); assert.equal(JSON.stringify(session.scene.bass.notes), phrases[0]);
  const musical = JSON.stringify(session.project);
  for (const solo of ['bd', 'sd', 'ch', 'bass']) {
    const audition = R.forPlayback(session.project, { solo, bpm: 81 });
    assert.equal(audition.bpm, 81);
    assert.equal(audition.scenes[0].mix.muteBass, true);
    assert.equal(audition.scenes[1].mix.muteBass, solo !== 'bass');
    for (const v of P.VOICES) if (v !== solo) assert.equal(audition.scenes[1].drums.rows[v].length, 0);
  }
  assert.equal(JSON.stringify(session.project), musical);
  const exported = R.forStudio(session.project);
  assert.notEqual(exported.id, session.project.id); assert.equal(exported.bpm, c.bpm);
  assert.deepEqual(plain(exported.arrangement), [{ scene: 'A', bars: 4 }, { scene: 'B', bars: 4 }]);
  assert.deepEqual(plain(exported.scenes[1].bass), plain(session.scene.bass));
  assert.deepEqual(plain(exported.scenes[3].bass), plain(session.scene.bass));
  exported.scenes[3].bass.notes[0] = null; assert.equal(session.scene.bass.notes[0], 'C2');
});

test('Remix UI keeps challenge scores and drafts intact through edits, undo, mode and round switches', async () => {
  const a = app();
  await a.$('start-remix').fire('click'); assert.equal(a.$('remix-tools').hidden, true);
  await solve(a); const scores = JSON.stringify([...a.storage.data]);
  await a.$('start-remix').fire('click');
  assert.equal(a.$('remix-tools').hidden, false); assert.equal(a.$('result').hidden, true);
  assert.equal(a.$('next-beat').hidden, true);
  await a.$('remix-fill').fire('click'); assert.equal(a.pad(1, 15).getAttribute('aria-pressed'), 'true');
  await a.$('remix-acid').fire('click'); assert.match(a.$('remix-bass').textContent, /Acid answer 1/);
  await a.$('remix-undo').fire('click'); assert.match(a.$('remix-bass').textContent, /Bass is silent/);
  await a.$('remix-redo').fire('click'); assert.match(a.$('remix-bass').textContent, /Acid answer 1/);
  await a.$('check-beat').fire('click'); assert.equal(JSON.stringify([...a.storage.data]), scores);
  await a.$('back-to-challenge').fire('click');
  assert.equal(a.pad(1, 15).getAttribute('aria-pressed'), 'false'); assert.equal(a.$('next-beat').hidden, false);
  assert.equal(a.$('total-stars').textContent, '3 / 18'); assert.equal(a.$('result').hidden, false);
  await a.$('challenge-list').children[1].children[0].fire('click');
  await a.$('challenge-list').children[0].children[0].fire('click');
  assert.match(a.$('start-remix').textContent, /Continue/);
  await a.$('start-remix').fire('click');
  assert.equal(a.pad(1, 15).getAttribute('aria-pressed'), 'true'); assert.match(a.$('remix-bass').textContent, /Acid answer 1/);
  await a.$('remix-reset').fire('click'); assert.equal(a.pad(1, 15).getAttribute('aria-pressed'), 'false');
  await a.$('remix-undo').fire('click'); assert.equal(a.pad(1, 15).getAttribute('aria-pressed'), 'true');
  assert.equal(JSON.stringify([...a.storage.data]), scores);
});

test('remix comparison queues A/B on one transport and follows audible events while editing B', async () => {
  class AudioContext { constructor() { this.state = 'running'; this.currentTime = 0; } }
  const a = app({ AudioContext });
  await a.pad(0, 0).fire('click'); await a.$('start-remix').fire('click');
  await a.$('listen-target').fire('click');
  const t = a.transports[0]; assert.equal(t.sceneId, 'A');
  assert.equal(a.$('listen-target').getAttribute('aria-pressed'), 'false');
  t.events.onVisual({ sceneId: 'A', tick: 0 });
  assert.equal(a.$('listen-target').getAttribute('aria-pressed'), 'true');
  const original = JSON.stringify(t.getProject().scenes[0]);
  await a.$('remix-fill').fire('click'); await a.$('remix-acid').fire('click');
  assert.equal(JSON.stringify(t.getProject().scenes[0]), original);
  assert.equal(t.getProject().scenes[1].mix.muteBass, false);
  await a.$('listen-yours').fire('click'); assert.equal(t.pending, 'B');
  assert.equal(a.$('listen-target').getAttribute('aria-pressed'), 'true'); assert.equal(a.$('listen-yours').dataset.queued, true);
  await a.$('listen-target').fire('click'); assert.equal(t.pending, 'A');
  await a.$('listen-yours').fire('click'); assert.equal(t.pending, 'B');
  assert.equal(a.transports.length, 1);
  t.events.onVisual({ sceneId: 'B', tick: 0 });
  assert.equal(a.$('listen-yours').getAttribute('aria-pressed'), 'true'); assert.equal(a.$('listen-yours').dataset.queued, false);
  await a.$('listen-target').fire('click');
  await a.$('back-to-challenge').fire('click'); assert.equal(t.running, false); assert.equal(t.pending, null);
  assert.equal(a.$('listen-yours').getAttribute('aria-pressed'), 'false');
});

test('leaving Remix while audio is resuming cancels both a new loop and its pending comparison', async () => {
  const contexts = [];
  class AudioContext {
    constructor() { this.state = 'suspended'; this.currentTime = 0; contexts.push(this); }
    resume() { return new Promise(resolve => { this.release = () => { this.state = 'running'; resolve(); }; }); }
  }
  const a = app({ AudioContext });
  await a.pad(0, 0).fire('click'); await a.$('start-remix').fire('click');
  const start = a.$('listen-target').fire('click');
  const switchSide = a.$('listen-yours').fire('click');
  await a.$('challenge-list').children[1].children[0].fire('click');
  contexts[0].release(); await Promise.all([start, switchSide]);
  assert.equal(a.transports.length, 0); assert.equal(a.$('remix-tools').hidden, true);
  assert.equal(a.$('stop-audio').disabled, true);
});

test('keeping remix versions is retryable, preserves existing projects, and hands full A/B music to Studio', async () => {
  const a = app(); await solve(a); await a.$('start-remix').fire('click');
  await a.$('remix-fill').fire('click'); await a.$('remix-acid').fire('click');
  const original = a.P.createProject(a.banks); new a.P.ProjectStore(a.storage).save(original);
  const untouched = a.storage.getItem(a.P.PREFIX + original.id), write = a.storage.setItem;
  a.$('solo').value = 'bass'; a.$('speed').value = '.75';
  a.storage.setItem = () => { throw new Error('Quota'); };
  await a.$('keep-remix').fire('click'); assert.match(a.$('remix-save-status').textContent, /Could not save/);
  await a.$('open-studio').fire('click'); assert.equal(a.navigated, null);
  assert.match(a.$('remix-bass').textContent, /Acid answer 1/);
  a.storage.setItem = write;
  await a.$('keep-remix').fire('click'); assert.equal(a.navigated, null);
  assert.match(a.$('remix-save-status').textContent, /saved in your Studio/);
  const kept = new a.P.ProjectStore(a.storage).list().projects.find(p => p.id !== original.id);
  assert.ok(kept); assert.equal(kept.bpm, 108); assert.equal(kept.scenes[1].mix.muteBass, false);
  assert.equal(kept.scenes[0].mix.muteBass, true);
  assert.deepEqual(plain(kept.scenes[0].drums.rows.sd), [4, 12]);
  assert.deepEqual(plain(kept.scenes[1].drums.rows.sd), [4, 12, 14, 15]);
  const count = a.storage.length;
  await a.$('keep-remix').fire('click'); assert.equal(a.storage.length, count);
  await a.$('open-studio').fire('click'); assert.match(a.navigated, new RegExp(kept.id));
  assert.equal(a.storage.length, count); assert.equal(a.storage.getItem(a.P.PREFIX + original.id), untouched);
  const studio = app({ storage: a.storage, file: 'groove-studio.html', search: new URL(a.navigated, 'https://example.test/').search });
  assert.equal(studio.$('project-name').value, kept.name);
  assert.equal(studio.$('mute-bass').getAttribute('aria-pressed'), 'false');
});

test('a changed, mismatched or deleted saved remix produces a fresh copy without overwriting the existing entry', async () => {
  for (const change of ['edited', 'mismatched', 'deleted']) {
    const a = app(); await a.pad(0, 0).fire('click'); await a.$('start-remix').fire('click'); await a.$('keep-remix').fire('click');
    const project = new a.P.ProjectStore(a.storage).list().projects[0], key = a.P.PREFIX + project.id;
    if (change === 'edited') { project.scenes[1].drums.rows.bd = [4]; a.storage.setItem(key, JSON.stringify(project)); }
    if (change === 'mismatched') { project.id = 'different-id'; a.storage.setItem(key, JSON.stringify(project)); }
    if (change === 'deleted') a.storage.removeItem(key);
    const raw = a.storage.getItem(key);
    await a.$('keep-remix').fire('click');
    const valid = new a.P.ProjectStore(a.storage).list().projects.filter(p => a.P.PREFIX + p.id !== key);
    assert.equal(valid.length, 1); assert.deepEqual(plain(valid[0].scenes[1].drums.rows.bd), [0]);
    assert.equal(a.storage.getItem(key), raw);
  }
});
