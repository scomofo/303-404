import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { GUIDES, loadComponent, readGuide } from './harness.mjs';
import { studioBankSource } from '../scripts/build-studio-banks.mjs';

const scope = { Blob, setTimeout, clearTimeout };
for (const file of ['banks', 'project', 'audio']) runInNewContext(readGuide(`studio/${file}.js`), scope);
const P = scope.DCStudioProject, A = scope.DCStudioAudio, banks = scope.DCStudioBanks;
const plain = value => JSON.parse(JSON.stringify(value));
const fresh = () => P.createProject(banks);
const near = (actual, expected, tolerance = 1e-9) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} ≈ ${expected}`);

function storage() {
  const data = new Map();
  return { data, get length() { return data.size; }, key: i => [...data.keys()][i] ?? null,
    getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key) };
}

// Audio graph assertions inspect the scheduled values and connections. They do
// not claim to measure browser DSP or codec fidelity; listening is a separate check.
function audioContext(sampleRate = 8000) {
  const ctx = { currentTime: 0, sampleRate, nodes: [], sources: [] };
  function param(value) {
    return { value, calls: [], events: [],
      setValueAtTime(value, time) { this.calls.push(['set', value, time]); this.events.push(['set', value, time]); },
      linearRampToValueAtTime(value, time) { this.calls.push(['linear', value, time]); this.events.push(['linear', value, time]); },
      exponentialRampToValueAtTime(value, time) { assert.ok(value > 0); this.calls.push(['exponential', value, time]); this.events.push(['exponential', value, time]); },
      cancelScheduledValues(time) { this.calls.push(['cancel', time]); this.events = this.events.filter(event => event[2] < time); },
    };
  }
  function node(kind, fields = {}) {
    const n = { kind, connections: new Set(), ...fields,
      connect(target) { this.connections.add(target); return target; },
      disconnect(target) { if (target) this.connections.delete(target); else this.connections.clear(); },
    };
    ctx.nodes.push(n); return n;
  }
  function source(kind, fields = {}) {
    const n = node(kind, { ...fields, starts: [], stops: [],
      start(time = 0) { this.starts.push(time); }, stop(time = 0) { this.stops.push(time); } });
    ctx.sources.push(n); return n;
  }
  ctx.destination = node('destination');
  ctx.createGain = () => node('gain', { gain: param(1) });
  ctx.createWaveShaper = () => node('shaper');
  ctx.createBiquadFilter = () => node('filter', { frequency: param(350), Q: param(1) });
  ctx.createOscillator = () => source('oscillator', { frequency: param(440), type: 'sine' });
  ctx.createBufferSource = () => source('buffer');
  ctx.createBuffer = (channels, length, rate) => {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { numberOfChannels: channels, length, sampleRate: rate, getChannelData: i => data[i] };
  };
  ctx.createMediaStreamDestination = () => {
    const track = { stopped: false, stop() { this.stopped = true; } };
    return node('media', { stream: { getTracks: () => [track] } });
  };
  return ctx;
}

function transportFixture(project = fresh()) {
  const ctx = audioContext(), timers = new Map(), visuals = [], messages = [], errors = [];
  let timerId = 0;
  const transport = new A.Transport(ctx, () => project, {
    timer: fn => { timers.set(++timerId, fn); return timerId; }, cancel: id => timers.delete(id),
    onVisual: event => visuals.push(event), onStop: message => messages.push(message), onError: error => errors.push(error),
  });
  const advance = time => { ctx.currentTime = time; const work = [...timers.values()]; timers.clear(); for (const fn of work) fn(); };
  return { ctx, transport, timers, visuals, messages, errors, advance };
}

test('studio banks match the courses and retain every note, slot, attribution and review flag', () => {
  assert.equal(readGuide('studio/banks.js'), studioBankSource(), 'Run npm run studio:banks after editing the banks');
  assert.equal(banks.bass.length, 31); assert.equal(banks.drums.length, 11);
  assert.ok(banks.bass.some(c => c.notes.length === 10));
  assert.ok(banks.bass.some(c => c.notes.length === 8));
  assert.ok(banks.drums.some(c => c.steps === 32));
  assert.equal(banks.bass.filter(c => c.needsAccentSlideReview).length, 6);
  for (const card of banks.bass) {
    const scene = P.createProject(banks, { bass: card.id }).scenes[1];
    assert.deepEqual(plain(scene.bass.notes), plain(card.notes));
    assert.deepEqual(plain(scene.bass.accent), plain(card.accent));
    assert.deepEqual(plain(scene.bass.slide), plain(card.slide));
    assert.equal(scene.bass.source.type, card.sourceType);
    assert.equal(scene.bass.source.review, card.needsAccentSlideReview === true);
    if (card.source) assert.ok(scene.bass.source.detail.includes(card.source));
  }
  for (const card of banks.drums) {
    const scene = P.createProject(banks, { drums: card.id }).scenes[1];
    assert.equal(scene.drums.steps, card.steps);
    for (const voice of P.VOICES) assert.deepEqual(plain(scene.drums.rows[voice]), plain(card.rows[voice] || []));
    assert.deepEqual(plain(scene.drums.pair), plain(card.pair || {}));
    assert.equal(scene.drums.source.type, card.sourceType);
    if (card.source) assert.ok(scene.drums.source.detail.includes(card.source));
  }
});

test('home, all courses and each bank card link into the studio with the intended pattern', () => {
  assert.match(readGuide('index.dc.html'), /href="\.\/groove-studio\.html"/);
  for (const { file } of GUIDES) assert.match(readGuide(file), /href="\.\/groove-studio\.html"[^>]*>Groove Studio<\/a>/);
  const { inst, dispose } = loadComponent('Behringer Setup Guide.dc.html');
  try {
    for (const [widget, key, cards, query] of [['songbank', 'songCards', banks.bass, 'bass'], ['drumbank', 'drumCards', banks.drums, 'drums']]) {
      inst.goToStep(inst.STEPS.findIndex(step => step.widget === widget));
      const view = inst.renderVals()[key]; assert.equal(view.length, cards.length);
      view.forEach((card, i) => {
        const url = new URL(card.studioHref, 'https://example.test/');
        assert.equal(url.pathname, '/groove-studio.html'); assert.equal(url.searchParams.get(query), cards[i].id);
        assert.ok(card.studioName.includes(cards[i].title));
      });
    }
  } finally { dispose(); }
  const html = readGuide('groove-studio.html');
  for (const [, url] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (url.startsWith('#')) assert.ok(html.includes(`id="${url.slice(1)}"`));
    else assert.ok(existsSync(new URL(`../${decodeURIComponent(url)}`, import.meta.url)), url);
  }
  assert.doesNotMatch(html, /unsafe-eval|unsafe-inline|support\.js/);
});

test('scene edits and imported copies cannot mutate the source bank or another scene', () => {
  const project = fresh(), original = JSON.stringify(banks), other = JSON.stringify(project.scenes[1]);
  project.scenes[0].drums.rows.bd.push(1); project.scenes[0].bass.notes[0] = 'A1';
  project.scenes[0].bass.source.title = 'Edited'; project.scenes[0].mix.cutoff = 2500;
  assert.equal(JSON.stringify(banks), original); assert.equal(JSON.stringify(project.scenes[1]), other);
  const imported = P.validateProject(JSON.parse(JSON.stringify(project)));
  imported.scenes[0].bass.notes[1] = 'B2'; imported.id = P.newId();
  assert.notEqual(imported.id, project.id); assert.notEqual(imported.scenes[0].bass.notes[1], project.scenes[0].bass.notes[1]);
  assert.deepEqual(plain(P.createProject(banks, { bass: 'missing', drums: 'missing' }).scenes), plain(fresh().scenes));
});

test('portable projects reject invalid musical data, oversized arrangements and foreign versions', () => {
  const mutations = [p => { p.version = 2; }, p => { p.id = '../../save'; }, p => { p.scenes.pop(); },
    p => { p.scenes[1].id = 'A'; }, p => { p.bpm = NaN; }, p => { p.bpm = 300; }, p => { p.master = -1; },
    p => { p.scenes[1].bass.notes = ['C2']; }, p => { p.scenes[1].bass.notes[0] = ['C2']; },
    p => { p.scenes[1].bass.notes[0] = 'C9'; }, p => { p.scenes[1].bass.accent = [100]; },
    p => { p.scenes[1].bass.waveform = 'custom'; }, p => { p.scenes[1].drums.steps = 64; },
    p => { p.scenes[1].drums.rows.bd = [0.5]; }, p => { p.scenes[1].mix.cutoff = Infinity; },
    p => { p.scenes[1].mix.muteBass = 'false'; }, p => { p.arrangement = []; },
    p => { p.arrangement[0].bars = 1.5; }, p => { p.arrangement[0].bars = 9; },
    p => { p.arrangement[0].scene = 'Z'; }, p => { p.name = ''; }];
  for (const change of mutations) { const project = fresh(); change(project); assert.throws(() => P.validateProject(project)); }
  for (const value of [null, [], 7, {}, false]) assert.throws(() => P.validateProject(value));
  const project = fresh(); project.scenes[1].drums.rows.bd = [3, 0, 3];
  project.context = { private: true }; project.scenes[1].audioUrl = 'blob:gone';
  const clean = P.validateProject(project);
  assert.deepEqual(plain(clean.scenes[1].drums.rows.bd), [0, 3]);
  assert.equal('context' in clean, false); assert.equal('audioUrl' in clean.scenes[1], false);
  for (const [note, midi] of [['C0', 12], ['A4', 69], ['F#3', 54], [null, null]]) assert.equal(P.noteMidi(note), midi);
});

test('saved projects round-trip without probe writes, isolating damaged entries and quota failures', () => {
  const local = storage(), store = new P.ProjectStore(local), first = fresh(), second = fresh();
  first.name = 'First'; second.name = 'Second'; store.save(first); store.save(second);
  local.setItem(P.PREFIX + 'damaged', '{'); local.setItem('303-404/behringer/v1', 'course progress');
  const firstRaw = local.getItem(P.PREFIX + first.id);
  second.scenes[2].mix.cutoff = 4000; store.save(second);
  assert.equal(local.getItem(P.PREFIX + first.id), firstRaw);
  local.setItem = () => { throw new Error('Quota exceeded'); };
  const reader = new P.ProjectStore(local), result = reader.list();
  assert.equal(result.projects.length, 2); assert.equal(result.damaged.length, 1);
  assert.equal(result.projects.find(p => p.id === second.id).scenes[2].mix.cutoff, 4000);
  assert.throws(() => reader.save(second), /Quota/);
  assert.equal(local.getItem(P.PREFIX + 'damaged'), '{');
  assert.equal(local.getItem('303-404/behringer/v1'), 'course progress');
});

test('a stale tab cannot overwrite edits, delete a changed project or resurrect a deleted project', () => {
  const local = storage(), a = new P.ProjectStore(local), b = new P.ProjectStore(local), project = fresh();
  a.save(project); const stale = b.list().projects[0];
  project.name = 'Changed elsewhere'; a.save(project);
  stale.name = 'Stale'; assert.throws(() => b.save(stale), /another tab/);
  assert.throws(() => b.remove(stale.id), /another tab/);
  assert.equal(JSON.parse(local.getItem(P.PREFIX + project.id)).name, project.name);
  const copy = P.copy(stale); copy.id = P.newId(); b.save(copy);
  assert.equal(b.list().projects.length, 2);
  a.remove(project.id); assert.throws(() => b.save(stale), /another tab/);
  assert.equal(local.getItem(P.PREFIX + project.id), null);
});

test('arrangements share an exact clock and reset independent pattern cycles at section boundaries', () => {
  const project = fresh(); near(P.duration(project), 60);
  project.bpm = 137; project.arrangement = [{ scene: 'B', bars: 3 }, { scene: 'D', bars: 2 }];
  project.scenes[1].bass.notes = Array(10).fill('A2');
  const events = P.arrangementEvents(project); assert.equal(events.length, 80);
  events.forEach((event, i) => { near(event.time, i * 15 / 137); assert.equal(event.step, i); });
  assert.equal(events[16].tick % project.scenes[1].bass.notes.length, 6);
  assert.equal(events[16].tick % project.scenes[1].drums.steps, 0);
  assert.equal(events[47].sceneId, 'B'); assert.equal(events[48].sceneId, 'D');
  assert.equal(events[48].tick, 0); assert.equal(events[48].first, true); assert.equal(events[49].first, false);
  near(events.at(-1).time + 15 / project.bpm, P.duration(project));
});

test('bass slides join adjacent notes, accents lift envelopes, and rests or new sections break a slide', () => {
  const ctx = audioContext(), engine = new A.Engine(ctx), scene = fresh().scenes[1], step = 15 / 120;
  scene.bass.notes = ['C2', 'G2', null, 'A2']; scene.bass.slide = [0, 1, 3]; scene.bass.accent = [1];
  const schedule = (tick, first = false) => engine.scheduleStep(scene, { tick, first }, tick * step, 120);
  schedule(0, true); schedule(1);
  const frequency = engine.oscillators[0].osc.frequency;
  const glides = frequency.calls.filter(call => call[0] === 'exponential');
  assert.equal(glides.length, 1); near(glides[0][1], 440 * 2 ** ((P.noteMidi('G2') - 69) / 12));
  assert.ok(engine.envelope.gain.calls.some(call => call[0] === 'linear' && call[1] === .28));
  assert.equal(engine.previous.slide, false, 'a slide into a rest must not hold');
  const beforeRest = frequency.calls.length; schedule(2);
  assert.equal(frequency.calls.length, beforeRest); assert.equal(engine.previous, null);
  schedule(3); schedule(4, true);
  assert.equal(frequency.calls.filter(call => call[0] === 'exponential').length, 1, 'no glide into a new section');
  assert.equal(engine.oscillators[0].gain.gain.events.at(-1)[1], 1);
  scene.bass.waveform = 'square'; schedule(5);
  assert.equal(engine.oscillators[1].gain.gain.events.at(-1)[1], 1);
  assert.equal(engine.oscillators[0].gain.gain.events.at(-1)[1], 0);
  engine.stop();
});

test('drum switch pairs, accents, mutes and bass notes are scheduled on the same step', () => {
  const ctx = audioContext(), engine = new A.Engine(ctx), scene = fresh().scenes[1];
  for (const v of P.VOICES) scene.drums.rows[v] = [];
  scene.drums.rows.rs = [0, 1]; scene.drums.rows.cp = [0]; scene.drums.rows.ac = [0];
  scene.drums.pair = { rs: 'CL', cp: 'MA' }; scene.mix.muteDrums = true;
  scene.bass.notes = ['C2', 'D2']; scene.bass.accent = []; scene.bass.slide = [];
  const calls = []; engine.drum = (...args) => calls.push(args);
  engine.scheduleStep(scene, { tick: 0, first: true }, 3, 120);
  assert.deepEqual(calls, [['cl', 3, 1], ['ma', 3, 1]]);
  assert.deepEqual(engine.drums.gain.events.at(-1), ['set', 0, 3]);
  assert.ok(engine.oscillators[0].osc.frequency.events.some(event => event[2] === 3));
  scene.mix.muteDrums = false; scene.mix.muteBass = true;
  engine.scheduleStep(scene, { tick: 1 }, 3.125, 120);
  assert.deepEqual(calls.at(-1), ['cl', 3.125, .72]);
  assert.deepEqual(engine.bass.gain.events.at(-1), ['set', 0, 3.125]);
  engine.stop();
});

test('closed hats choke open tails once, and open-only patterns do not retain expired hats', () => {
  const ctx = audioContext(), engine = new A.Engine(ctx);
  const hat = engine.drum('oh', 1, 1); engine.drum('ch', 1.1, 1);
  near(hat.source.stops.at(-1), 1.106); assert.equal(engine.hats.length, 0);
  const stopped = [...hat.source.stops]; engine.drum('ch', 1.2, 1); assert.deepEqual(hat.source.stops, stopped);
  for (let i = 0; i < 100; i++) engine.drum('oh', 2 + i * .5, 1);
  assert.equal(engine.hats.length, 1);
  engine.stop();
});

test('stop silences all scheduled sources and is safe to call again', () => {
  const ctx = audioContext(), engine = new A.Engine(ctx);
  engine.drum('bd', 2, 1); engine.drum('cp', 4, 1); ctx.currentTime = .4;
  engine.stop();
  for (const source of ctx.sources) near(source.stops.at(-1), .4);
  assert.equal(engine.output.connections.size, 0); assert.equal(engine.sources.size, 0);
  const count = ctx.sources.length; engine.scheduleStep(fresh().scenes[1], { tick: 0 }, 4, 120); engine.stop();
  assert.equal(ctx.sources.length, count);
});

test('the transport launches scenes at bar boundaries and uses audio time for the playhead', () => {
  const project = fresh(); project.bpm = 120;
  const f = transportFixture(project); f.transport.start('scene', 'B');
  assert.equal(f.visuals.length, 0, 'lookahead must not light the grid early');
  f.transport.queueScene('D');
  for (let i = 1; i <= 92; i++) f.advance(i * .025);
  assert.equal(f.errors.length, 0);
  const firstD = f.visuals.find(event => event.sceneId === 'D');
  assert.ok(firstD); assert.equal(firstD.step, 16); assert.equal(firstD.tick, 0); assert.equal(firstD.first, true);
  near(firstD.at, .06 + 16 * .125);
  f.visuals.forEach(event => near(event.at, .06 + event.step * .125));
  f.transport.stop(); assert.equal(f.timers.size, 0);
  const count = f.visuals.length; f.advance(20); assert.equal(f.visuals.length, count);
});

test('arrangement playback follows every section and stops after release tails', () => {
  const project = fresh(); project.bpm = 240; project.arrangement = [{ scene: 'A', bars: 1 }, { scene: 'C', bars: 1 }];
  const f = transportFixture(project); f.transport.start('arrangement');
  for (let i = 1; i <= 130; i++) f.advance(i * .025);
  assert.equal(f.errors.length, 0); assert.equal(f.visuals.length, 32);
  assert.equal(f.visuals[15].sceneId, 'A'); assert.equal(f.visuals[16].sceneId, 'C'); assert.equal(f.visuals[16].tick, 0);
  assert.equal(f.transport.running, false); assert.equal(f.timers.size, 0);
  assert.equal(f.messages.at(-1), 'Arrangement finished.');
});

test('a stalled scheduler stops instead of emitting a burst of late notes', () => {
  const f = transportFixture(); f.transport.start('scene'); const before = f.ctx.sources.length;
  f.advance(2); assert.equal(f.transport.running, false); assert.equal(f.ctx.sources.length, before);
  assert.match(f.messages.at(-1), /timing interruption/); assert.equal(f.timers.size, 0);
});

test('WAV encoding preserves stereo PCM, sample rate, silence and bounded peaks', () => {
  const ctx = audioContext(), buffer = ctx.createBuffer(2, 4, 44100);
  buffer.getChannelData(0).set([0, .5, -.5, 0]); buffer.getChannelData(1).set([.25, -.25, 0, 0]);
  const result = A.encodeWav(buffer), view = new DataView(result.buffer);
  assert.equal(String.fromCharCode(...new Uint8Array(result.buffer, 0, 4)), 'RIFF');
  assert.equal(view.getUint16(22, true), 2); assert.equal(view.getUint32(24, true), 44100);
  assert.equal(view.getUint32(28, true), 176400); assert.equal(view.getUint16(34, true), 16);
  assert.equal(view.getUint32(40, true), 16); assert.equal(result.buffer.byteLength, 60);
  assert.deepEqual(Array.from({ length: 8 }, (_, i) => view.getInt16(44 + i * 2, true)), [0, 8192, 16384, -8192, -16384, 0, 0, 0]);
  buffer.getChannelData(0)[0] = 2; const scaled = A.encodeWav(buffer); near(scaled.peak, .98);
  assert.equal(new DataView(scaled.buffer).getInt16(44, true), Math.round(.98 * 32767));
  buffer.getChannelData(0).fill(0); buffer.getChannelData(1).fill(0);
  assert.equal(A.encodeWav(buffer).peak, 0);
  buffer.getChannelData(0)[0] = NaN; assert.throws(() => A.encodeWav(buffer), /invalid samples/);
});

test('WAV export schedules the same synthesis events as playback and encodes the rendered buffer', async () => {
  const project = fresh(); project.bpm = 240; project.arrangement = [{ scene: 'B', bars: 1 }, { scene: 'D', bars: 1 }];
  let offline;
  function OfflineContext(channels, length, rate) {
    offline = audioContext(rate); offline.channels = channels; offline.frames = length;
    offline.startRendering = async () => {
      const result = offline.createBuffer(channels, length, rate);
      result.getChannelData(0)[0] = .25; result.getChannelData(1)[0] = -.5;
      return result;
    };
    return offline;
  }
  const wav = await A.renderArrangement(project, OfflineContext);
  assert.equal(offline.frames, Math.ceil((P.duration(project) + A.TAIL) * 44100));
  near(wav.musicDuration, 2); assert.equal(wav.channels, 2); assert.equal(wav.bitDepth, 16);
  assert.equal(new DataView(wav.buffer).getInt16(44, true), 8192);
  assert.equal(new DataView(wav.buffer).getInt16(46, true), -16384);
  const f = transportFixture(project); f.transport.start('arrangement');
  for (let i = 1; i <= 130; i++) f.advance(i * .025);
  assert.equal(f.errors.length, 0); assert.equal(f.ctx.sources.length, offline.sources.length);
  f.ctx.sources.forEach((source, i) => {
    assert.equal(source.kind, offline.sources[i].kind);
    // The two continuous bass oscillators start immediately; musical events are offset by the transport lead-in.
    if (i >= 2) near(source.starts[0] - .06, offline.sources[i].starts[0]);
    if (source.frequency) {
      const live = source.frequency.events, rendered = offline.sources[i].frequency.events;
      assert.equal(live.length, rendered.length);
      live.forEach((event, index) => { assert.equal(event[0], rendered[index][0]); near(event[1], rendered[index][1]); near(event[2] - .06, rendered[index][2]); });
    }
  });
  await assert.rejects(A.renderArrangement(project, null), /cannot render a WAV/);
  function BrokenOffline(...args) { const context = OfflineContext(...args); context.startRendering = async () => { throw new Error('Render failed'); }; return context; }
  await assert.rejects(A.renderArrangement(project, BrokenOffline), /Render failed/);
  assert.equal(offline.nodes.find(n => n.kind === 'shaper').connections.size, 0);
});

function recorderClass(type = 'audio/webm;codecs=opus') {
  return class Recorder {
    static instances = [];
    static isTypeSupported(candidate) { return candidate === type; }
    constructor(stream, options) { this.stream = stream; this.mimeType = options?.mimeType || type; this.state = 'inactive'; this.constructor.instances.push(this); }
    start(timeslice) { this.timeslice = timeslice; this.state = 'recording'; }
    stop() { this.state = 'inactive'; this.ondataavailable({ data: new Blob(['actual-output-bytes'], { type: this.mimeType }) }); this.onstop(); }
  };
}

test('takes record the engine output stream, keep the browser format and release capture resources', async () => {
  for (const [type, extension] of [['audio/webm;codecs=opus', 'webm'], ['audio/ogg;codecs=opus', 'ogg'], ['audio/mp4', 'm4a']]) {
    const ctx = audioContext(), engine = new A.Engine(ctx), Recorder = recorderClass(type);
    const take = new A.TakeRecorder(ctx, engine.output, Recorder), record = Recorder.instances[0];
    assert.equal(record.stream, take.destination.stream); assert.ok(engine.output.connections.has(take.destination));
    assert.ok(engine.output.connections.has(ctx.destination), 'recording must preserve speaker output');
    const promise = take.start(); take.stop(); const result = await promise;
    assert.equal(await result.blob.text(), 'actual-output-bytes'); assert.equal(result.extension, extension); assert.equal(result.blob.type, type);
    assert.equal(engine.output.connections.has(take.destination), false); assert.equal(take.destination.stream.getTracks()[0].stopped, true);
    assert.ok(engine.output.connections.has(ctx.destination)); engine.stop();
  }
});

test('recording failure and unsupported APIs surface errors without leaving a connected capture', async () => {
  const ctx = audioContext(), engine = new A.Engine(ctx);
  assert.throws(() => new A.TakeRecorder(ctx, engine.output, null), /unavailable/);
  class BrokenRecorder extends recorderClass() { start() { throw new Error('Start failed'); } }
  const broken = new A.TakeRecorder(ctx, engine.output, BrokenRecorder);
  await assert.rejects(broken.start(), /Start failed/); assert.equal(engine.output.connections.has(broken.destination), false);
  assert.equal(broken.destination.stream.getTracks()[0].stopped, true);
  const take = new A.TakeRecorder(ctx, engine.output, recorderClass()); const result = take.start();
  take.recorder.onerror({ error: new Error('Device failed') });
  await assert.rejects(result, /Device failed/); assert.equal(engine.output.connections.has(take.destination), false);
  class EmptyRecorder extends recorderClass() { stop() { this.state = 'inactive'; this.onstop(); } }
  const empty = new A.TakeRecorder(ctx, engine.output, EmptyRecorder); const emptyResult = empty.start(); empty.stop();
  await assert.rejects(emptyResult, /empty/); engine.stop();
});
