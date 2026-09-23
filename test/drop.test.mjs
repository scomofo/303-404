import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { readGuide } from './harness.mjs';
import { Element, dom } from './dom-fixture.mjs';

const plain = x => JSON.parse(JSON.stringify(x));
const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
function model() {
  const scope = {};
  for (const file of ['studio/banks.js', 'studio/project.js', 'drop/project.js']) runInNewContext(readGuide(file), scope);
  return { scope, P: scope.DCStudioProject, D: scope.DCDropProject, banks: scope.DCStudioBanks };
}
function memory() {
  const data = new Map();
  return { data, get length() { return data.size; }, key: i => [...data.keys()][i] ?? null,
    getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key) };
}
class RunningContext { constructor() { this.state = 'running'; this.currentTime = 0; } }
function app({ storage = memory(), search = '', AudioContext = RunningContext, failRecorder = false } = {}) {
  const { scope, P, D, banks } = model(), document = dom(readGuide('drop-lab.html'));
  const transports = [], recorders = [], timers = new Map(), revoked = [], urls = [];
  let timerId = 0, navigated = null;
  const window = { localStorage: storage, AudioContext, location: { search, href: `https://example.test/drop-lab.html${search}`, assign: url => { navigated = url; } },
    history: { replaceState: (_, __, url) => { window.location.search = url.search; } },
    listeners: new Map(), addEventListener: Element.prototype.addEventListener, fire: Element.prototype.fire };
  class Transport {
    constructor(ctx, getProject, events) { this.ctx = ctx; this.getProject = getProject; this.events = events; this.engine = { output: {} }; transports.push(this); }
    start(mode, id) { P.validateProject(this.getProject()); this.sceneId = id; this.running = true; }
    queueScene(id) { this.pending = id; }
    stop() { this.pending = null; if (this.running) { this.running = false; this.events.onStop(); } }
    visual(id, tick = 0) { this.events.onVisual({ sceneId: id, tick, bar: Math.floor(tick / 16) }); }
  }
  class TakeRecorder {
    constructor(ctx, output) {
      if (failRecorder) throw new Error('Recording unavailable');
      this.ctx = ctx; this.output = output; this.result = new Promise((resolve, reject) => { this.resolve = resolve; this.reject = reject; }); recorders.push(this);
    }
    start() { this.started = true; return this.result; }
    stop() { this.stopped = true; return this.result; }
    finish() { this.resolve({ blob: new Blob(['recorded live sound'], { type: 'audio/webm' }), extension: 'webm' }); }
  }
  class TestURL extends URL {
    static createObjectURL(blob) { const url = `blob:take-${urls.length}`; urls.push({ url, blob }); return url; }
    static revokeObjectURL(url) { revoked.push(url); }
  }
  // The page under test opens audio through the real shared bootstrap from
  // studio/audio.js, loaded into this same sandbox; the stub namespace keeps
  // the fake Transport/TakeRecorder but uses the real ensureAudioContext.
  // Like a browser, the sandbox exposes the constructor on the global object
  // as well as on window.
  runInNewContext(readGuide('studio/audio.js'), scope);
  Object.assign(scope.DCStudioAudio, { Transport, TakeRecorder });
  Object.assign(scope, { window, document, URL: TestURL, URLSearchParams, AudioContext,
    setTimeout: (fn, delay) => { timers.set(++timerId, { fn, delay }); return timerId; }, clearTimeout: id => timers.delete(id) });
  runInNewContext(readGuide('drop/app.js'), scope);
  const $ = id => document.getElementById(id), pad = id => $('scene-pads').children[P.SCENES.indexOf(id)];
  const runTimer = delay => { const item = [...timers].find(([, t]) => t.delay === delay); assert.ok(item, `Timer ${delay}`); timers.delete(item[0]); item[1].fn(); };
  return { P, D, banks, $, pad, document, window, storage, transports, recorders, timers, runTimer, urls, revoked, get navigated() { return navigated; } };
}

test('Drop sets derive four independent scenes while retaining source patterns, cycles and provenance', () => {
  const { P, D, banks } = model(), source = P.createProject(banks);
  source.scenes[1].drums.steps = 32; source.scenes[1].drums.rows.ch.push(30);
  source.scenes[1].bass.notes = Array(10).fill('C2'); source.scenes[1].bass.accent = [0]; source.scenes[1].bass.slide = [1];
  const before = JSON.stringify(source), set = D.buildSet(source);
  assert.notEqual(set.id, source.id); assert.equal(set.updatedAt, 0);
  assert.deepEqual(plain(set.scenes.map(s => s.name)), ['Intro', 'Groove', 'Breakdown', 'Return']);
  for (const scene of set.scenes) {
    assert.equal(scene.drums.steps, 32); assert.equal(scene.bass.notes.length, 10);
    assert.deepEqual(plain(scene.drums.source), plain(source.scenes[1].drums.source));
    assert.deepEqual(plain(scene.bass.source), plain(source.scenes[1].bass.source));
  }
  assert.equal(set.scenes[0].mix.muteBass, true); assert.equal(set.scenes[2].mix.muteDrums, true);
  assert.deepEqual(plain(set.scenes[1].mix), plain(source.scenes[1].mix));
  set.scenes[3].drums.rows.bd.push(31); assert.equal(set.scenes[1].drums.rows.bd.includes(31), false);
  assert.equal(JSON.stringify(source), before);
  const copy = D.copyProject(source); assert.notEqual(copy.id, source.id); assert.deepEqual(plain(copy.scenes), plain(source.scenes));
});

test('a drums-only beat keeps a nonempty breakdown and a bass-only beat keeps an audible intro', () => {
  const { P, D, banks } = model(), source = P.createProject(banks);
  source.scenes[1].bass.notes = Array(16).fill(null); source.scenes[1].bass.accent = []; source.scenes[1].bass.slide = [];
  for (const key of P.VOICES) source.scenes[1].drums.rows[key] = key === 'bd' ? [0, 8] : [];
  const drums = D.buildSet(source);
  assert.deepEqual(plain(drums.scenes[2].drums.rows.bd), [0]); assert.equal(drums.scenes[2].mix.muteDrums, false);
  source.scenes[1].bass.notes[0] = 'C2'; source.scenes[1].mix.muteDrums = true; source.scenes[1].mix.muteBass = false;
  assert.equal(D.buildSet(source).scenes[0].mix.muteBass, false);
});

test('scene pads follow sounding events, the final queued request wins, and controls change the sounding scene', async () => {
  const a = app(); assert.equal(a.storage.length, 0);
  await a.pad('A').fire('click'); const t = a.transports[0];
  assert.equal(a.pad('A').getAttribute('aria-pressed'), 'false'); t.visual('A');
  assert.equal(a.pad('A').getAttribute('aria-pressed'), 'true');
  const sourceB = JSON.stringify(t.getProject().scenes[1]);
  await a.pad('B').fire('click'); await a.pad('D').fire('click'); assert.equal(t.pending, 'D');
  assert.equal(a.pad('D').dataset.queued, true); assert.equal(a.pad('A').dataset.playing, true);
  a.$('filter').value = '340'; await a.$('filter').fire('input'); await a.$('mute-drums').fire('click');
  assert.equal(t.getProject().scenes[0].mix.cutoff, 340); assert.equal(t.getProject().scenes[0].mix.muteDrums, true);
  assert.equal(JSON.stringify(t.getProject().scenes[1]), sourceB);
  t.visual('D'); assert.equal(a.pad('D').dataset.playing, true); assert.match(a.$('mix-heading').textContent, /D/);
  await a.$('stop').fire('click'); assert.equal(t.running, false); assert.equal(t.pending, null);
  assert.equal(a.pad('D').dataset.queued, false);
});

test('recording captures the live output, stops at 60 seconds, and stays busy until its take settles', async () => {
  const a = app(); await a.$('record').fire('click');
  const t = a.transports[0], take = a.recorders[0]; assert.equal(take.output, t.engine.output);
  assert.equal(a.$('record').getAttribute('aria-pressed'), 'true');
  assert.equal(a.$('tempo').disabled, true); assert.equal(a.$('load-project').disabled, true);
  await a.pad('D').fire('click'); assert.equal(a.transports.length, 1); assert.equal(a.recorders.length, 1);
  a.runTimer(60000); assert.equal(take.stopped, true); assert.equal(a.$('record').disabled, true);
  assert.equal(a.timers.size, 0); take.finish(); await flush();
  assert.equal(a.$('record').disabled, false); assert.equal(a.$('take-result').hidden, false);
  assert.equal(await a.urls[0].blob.text(), 'recorded live sound'); assert.match(a.$('download-take').download, /\.webm$/);
  assert.equal(a.$('take-preview').src, a.$('download-take').href);
  await a.$('take-preview').fire('play'); assert.equal(t.running, false);
  await a.pad('B').fire('click'); assert.equal(a.$('take-preview').paused, true);
  let warned = false; await a.window.fire('beforeunload', { preventDefault: () => { warned = true; } }); assert.equal(warned, true);
  await a.$('download-take').fire('click'); warned = false;
  await a.window.fire('beforeunload', { preventDefault: () => { warned = true; } }); assert.equal(warned, false);
});

test('recording failures preserve previous takes, restore controls, and replace URLs only after success', async () => {
  const a = app(); await a.$('record').fire('click'); await a.$('record').fire('click'); a.recorders[0].finish(); await flush();
  const first = a.$('take-preview').src;
  await a.$('record').fire('click'); a.recorders[1].reject(new Error('Codec failed')); await flush();
  assert.equal(a.$('take-preview').src, first); assert.equal(a.revoked.length, 0); assert.equal(a.timers.size, 0);
  assert.equal(a.$('record').disabled, false); assert.match(a.$('error').textContent, /Codec failed/);
  await a.$('record').fire('click'); await a.$('record').fire('click'); a.recorders[2].finish(); await flush();
  assert.deepEqual(a.revoked, [first]); assert.notEqual(a.$('take-preview').src, first);
  const unavailable = app({ failRecorder: true }); await unavailable.$('record').fire('click');
  assert.equal(unavailable.$('record').disabled, false); assert.match(unavailable.$('record-status').textContent, /unavailable/);
});

test('Stop, page hiding and leaving cancel a recording waiting for audio without a late start', async () => {
  for (const action of ['stop', 'hidden', 'leave']) {
    const contexts = [];
    class Suspended { constructor() { this.state = 'suspended'; contexts.push(this); } resume() { return new Promise(resolve => { this.release = () => { this.state = 'running'; resolve(); }; }); } }
    const a = app({ AudioContext: Suspended }), start = a.$('record').fire('click');
    if (action === 'stop') await a.$('stop').fire('click');
    if (action === 'hidden') { a.document.hidden = true; await a.document.fire('visibilitychange'); }
    if (action === 'leave') await a.window.fire('pagehide', { persisted: false });
    contexts[0].release(); await start; await flush();
    assert.equal(a.transports.length, 0); assert.equal(a.recorders.length, 0); assert.equal(a.timers.size, 0);
    assert.equal(a.$('record').disabled, false);
  }
});

test('hidden tabs finish an active take and unloaded pages do not create late object URLs', async () => {
  const a = app(); await a.$('record').fire('click'); a.document.hidden = true; await a.document.fire('visibilitychange');
  assert.equal(a.recorders[0].stopped, true); assert.equal(a.transports[0].running, false); assert.equal(a.timers.size, 0);
  a.recorders[0].finish(); await flush(); assert.equal(a.$('take-result').hidden, false);
  a.document.hidden = false; a.$('take-preview').paused = false; await a.$('take-preview').fire('play');
  assert.equal(a.$('take-preview').paused, false);
  a.document.hidden = true; await a.document.fire('visibilitychange'); assert.equal(a.$('take-preview').paused, true);
  const b = app(); await b.$('record').fire('click'); await b.window.fire('pagehide', { persisted: false });
  b.recorders[0].finish(); await flush(); assert.equal(b.urls.length, 0);
});

test('saved-project imports preserve originals and failed set saves stay available for retry', async () => {
  const { P, banks } = model(), storage = memory(), original = P.createProject(banks);
  original.name = 'My custom scenes'; original.scenes[0].name = 'Opening'; original.scenes[1].bass.notes = Array(10).fill('G2');
  original.scenes[1].bass.accent = []; original.scenes[1].bass.slide = [];
  new P.ProjectStore(storage).save(original); const raw = storage.getItem(P.PREFIX + original.id);
  const a = app({ storage, search: `?project=${original.id}` });
  assert.equal(a.pad('A').children[1].textContent, 'Opening'); assert.equal(a.window.location.search, '');
  await a.pad('B').fire('click'); a.transports[0].visual('B');
  a.$('filter').value = '2500'; await a.$('filter').fire('input');
  const write = storage.setItem; storage.setItem = () => { throw new Error('Quota'); };
  await a.$('save-set').fire('click'); assert.match(a.$('save-status').textContent, /Could not save/);
  await a.$('open-studio').fire('click'); assert.equal(a.navigated, null);
  storage.setItem = write; await a.$('save-set').fire('click');
  const saved = new P.ProjectStore(storage).list().projects.find(p => p.id !== original.id);
  assert.ok(saved); assert.equal(saved.scenes[1].mix.cutoff, 2500); assert.equal(saved.scenes[1].bass.notes.length, 10);
  assert.equal(storage.getItem(P.PREFIX + original.id), raw);
  const count = storage.length; await a.$('open-studio').fire('click'); assert.equal(storage.length, count); assert.match(a.navigated, new RegExp(saved.id));
  const built = app({ storage, search: `?project=${original.id}&build=1` });
  assert.equal(built.pad('A').children[1].textContent, 'Intro'); assert.match(built.$('set-source').textContent, /scene B/);
  const missing = app({ storage, search: '?project=missing' }); assert.match(missing.$('error').textContent, /not found/);
});

test('tempo changes stop the clock and keyboard launches leave editable controls alone', async () => {
  const a = app(); await a.pad('A').fire('click'); const t = a.transports[0];
  a.$('tempo').value = '140'; await a.$('tempo').fire('change'); assert.equal(t.running, false); assert.equal(t.getProject().bpm, 140);
  await a.document.fire('keydown', { key: '4', target: a.$('tempo') }); assert.equal(a.transports.length, 1);
  await a.document.fire('keydown', { key: '4', target: a.$('stage') }); assert.equal(a.transports.length, 2); assert.equal(a.transports[1].sceneId, 'D');
});

test('Drop Lab static assets and links exist with no inline script or new runtime dependency', () => {
  const html = readGuide('drop-lab.html');
  for (const [, url] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (url.startsWith('#')) assert.ok(html.includes(`id="${url.slice(1)}"`));
    else assert.ok(existsSync(new URL(`../${decodeURIComponent(url.split('#')[0])}`, import.meta.url)), url);
  }
  assert.doesNotMatch(html, /unsafe-eval|unsafe-inline|support\.js/);
  assert.match(readGuide('index.html'), /href="\.\/drop-lab\.html"/);
});
