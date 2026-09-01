// Loads a .dc.html guide and instantiates its Component class outside a browser.
//
// Each guide keeps its logic in a `<script type="text/x-dc">` block that the dc-runtime
// evaluates against a `DCLogic` base class. We do the same thing here with a stub base
// and stub Web Audio, so the logic can be exercised by `node --test` with no browser,
// no build step and no dependencies — matching the apps themselves, which have none.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export const GUIDES = [
  { name: 'Behringer', file: 'Behringer Setup Guide.dc.html' },
  { name: 'DDJ-FLX4', file: 'DDJ-FLX4 Guide.dc.html' },
  { name: 'Hybrid Live Set', file: 'Hybrid Live Set.dc.html' },
  { name: 'MPK Mini MK4', file: 'MPK Mini MK4 Guide.dc.html' },
  { name: 'Sample & Circuit', file: 'SampleCircuit Guide.dc.html' },
];

export function readGuide(file) {
  return readFileSync(join(ROOT, file), 'utf8');
}

function extractLogic(html, file) {
  const m = html.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error(`${file}: no <script type="text/x-dc"> block`);
  return m[1];
}

// ── stub Web Audio ───────────────────────────────────────────────────────────
// Records every scheduled start time so tests can assert on the timing grid the
// engines produce, which is the whole point of scheduling against the audio clock.

// Records what was scheduled on it, so tests can assert the actual cutoff, envelope
// and pitch values an engine computes rather than only that it ran.
function param(value = 0) {
  return {
    value,
    calls: [],
    cancellations: [],
    setValueAtTime(v, t) { this.calls.push({ op: 'set', v, t }); return this; },
    exponentialRampToValueAtTime(v, t) { this.calls.push({ op: 'expo', v, t }); return this; },
    linearRampToValueAtTime(v, t) { this.calls.push({ op: 'linear', v, t }); return this; },
    // Real AudioParams remove every queued automation event at or after the cutoff.
    // Modelling that rule catches envelope endpoints erased by a later scheduled step;
    // the former no-op stub made those failures look correct.
    cancelScheduledValues(t) {
      this.cancellations.push(t);
      this.calls = this.calls.filter(call => call.t < t);
      return this;
    },
  };
}

function node(ctx, extra = {}) {
  return {
    connect(dest) { return dest; },
    disconnect() {},
    ...extra,
  };
}

export function makeAudioContext() {
  const t0 = performance.now();
  const starts = [];          // every `when` passed to a source's start()
  const ctx = {
    sampleRate: 48000,
    state: 'running',
    resume() { this.state = 'running'; },
    close() { this.state = 'closed'; },
    get currentTime() { return (performance.now() - t0) / 1000; },
    get __starts() { return starts; },
  };
  ctx.destination = node(ctx);

  const source = extra => node(ctx, {
    // `at` is the clock reading when start() was called; `when` is the time it was
    // scheduled for. Scheduling ahead of the clock means when > at.
    //
    // `stopAt` follows Web Audio's rule that a source stopped at or before its start
    // time never sounds. Every voice here calls stop(when + duration) as it is built,
    // so only a stop moved back to or before `when` actually silences one.
    start(when, offset = 0, duration) { starts.push({ when: when ?? ctx.currentTime, at: ctx.currentTime, offset, duration, stopAt: Infinity, node: this }); },
    stop(when) {
      const e = starts.find(s => s.node === this);
      if (e) e.stopAt = Math.min(e.stopAt, when ?? ctx.currentTime);
    },
    ...extra,
  });

  // Track what each engine actually builds, so a test can tell whether e.g. a
  // waveshaper was inserted at all.
  const created = [];
  ctx.__created = created;
  const make = (kind, n) => { created.push({ kind, node: n }); return n; };

  ctx.createOscillator = () => make('oscillator', source({ type: 'sine', frequency: param(440), detune: param() }));
  ctx.createBufferSource = () => make('bufferSource', source({ buffer: null, playbackRate: param(1) }));
  ctx.createGain = () => make('gain', node(ctx, { gain: param(1) }));
  ctx.createBiquadFilter = () => make('biquad', node(ctx, { type: 'lowpass', frequency: param(350), Q: param(1), gain: param(0) }));
  ctx.createWaveShaper = () => make('waveShaper', node(ctx, { curve: null, oversample: 'none' }));
  ctx.createDelay = () => make('delay', node(ctx, { delayTime: param(0) }));
  ctx.createBuffer = (ch, len, rate = ctx.sampleRate) => {
    const channels = Array.from({ length: ch }, () => new Float32Array(len));
    return {
      numberOfChannels: ch,
      length: len,
      sampleRate: rate,
      duration: len / rate,
      getChannelData(index) { return channels[index]; },
      copyToChannel(sourceData, index, offset = 0) { channels[index].set(sourceData, offset); },
    };
  };
  ctx.decodeAudioData = async () => ctx.createBuffer(2, ctx.sampleRate, ctx.sampleRate);
  return ctx;
}

// ── stub runtime base class ──────────────────────────────────────────────────
// The real DCLogic defers setState to its React host. Here it merges straight into
// `state`, supporting both the object and updater-function forms React accepts.

class StubLogic {
  constructor(props) {
    this.props = props || {};
    this.state = {};
  }
  setState(update, cb) {
    const patch = typeof update === 'function' ? update(this.state) : update;
    this.state = { ...this.state, ...patch };
    if (cb) cb();
  }
  forceUpdate() {}
  componentDidMount() {}
  componentDidUpdate() {}
  componentWillUnmount() {}
  renderVals() { return {}; }
}

// The four guides share one navigation/dialog/checklist/scheduler base class,
// which lives in support.js between extraction markers so the browser runtime
// and this harness run the same code. Pull it out and build it over StubLogic.
const sharedMatch = readFileSync(join(ROOT, 'support.js'), 'utf8')
  .match(/\/\* __DC_COURSE_SHARED_START__ \*\/([\s\S]*?)\/\* __DC_COURSE_SHARED_END__ \*\//);
if (!sharedMatch) throw new Error('support.js: __DC_COURSE_SHARED markers missing');
const makeCourseLogicBase = new Function('DCLogic',
  `${sharedMatch[1]}\n;return makeCourseLogicBase;`)(StubLogic);

/**
 * Instantiate a guide's Component. Returns the instance, plus the stub audio
 * context so tests can inspect what was scheduled.
 */
export function loadComponent(file, { hidden = false } = {}) {
  const html = readGuide(file);
  const src = extractLogic(html, file);
  const audioCtx = makeAudioContext();

  // The logic reads `document.hidden` every time it schedules, not just at
  // construction, so these globals stay installed rather than being restored
  // immediately. Use the returned setHidden() to change visibility mid-test.
  globalThis.document = globalThis.document || {};
  globalThis.document.hidden = hidden;
  globalThis.window = { AudioContext: function () { return audioCtx; } };

  // Same shape as the runtime's own evaluation of this block.
  const factory = new Function('DCLogic', 'StreamableLogic', 'React', 'DCCourseLogic',
    src + '\n;return typeof Component !== "undefined" ? Component : undefined;');
  const Component = factory(StubLogic, StubLogic, {}, makeCourseLogicBase(StubLogic));
  if (!Component) throw new Error(`${file}: script block defined no Component`);
  const inst = new Component({});
  // ensureAudio() constructs via `new window.AudioContext()`; hand it ours directly
  // so tests can read what got scheduled.
  inst.audioCtx = audioCtx;
  inst.noiseBuffer = audioCtx.createBuffer(1, 128);

  const setHidden = v => { globalThis.document.hidden = v; };

  // Stop anything still scheduling. Without this, a failing assertion leaves the
  // sequencer's setTimeout chain rescheduling forever and the process never exits —
  // a hung CI job instead of a clean red. Register it with `t.after(dispose)`.
  const dispose = () => {
    for (const key of Object.keys(inst.sequences || {})) inst.stopSequence(key);
  };

  return { inst, audioCtx, html, Component, setHidden, dispose };
}

/** Every step index of a loaded component. */
export function stepIndices(inst) {
  return inst.STEPS.map((_, i) => i);
}

/** Render one step's view-model, as the template would. */
export function renderStep(inst, i) {
  inst.state = { ...inst.state, step: i };
  return inst.renderVals();
}
