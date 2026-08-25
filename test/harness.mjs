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
];

export function readGuide(file) {
  return readFileSync(join(ROOT, file), 'utf8');
}

function extractLogic(html, file) {
  const m = html.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error(`${file}: no <script type="text/x-dc"> block`);
  return m[1];
}

function param(value = 0) {
  return {
    value,
    calls: [],
    cancellations: [],
    setValueAtTime(v, t) { this.calls.push({ op: 'set', v, t }); return this; },
    exponentialRampToValueAtTime(v, t) { this.calls.push({ op: 'expo', v, t }); return this; },
    linearRampToValueAtTime(v, t) { this.calls.push({ op: 'linear', v, t }); return this; },
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
  const starts = [];
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
    start(when) { starts.push({ when: when ?? ctx.currentTime, at: ctx.currentTime, stopAt: Infinity, node: this }); },
    stop(when) {
      const e = starts.find(s => s.node === this);
      if (e) e.stopAt = Math.min(e.stopAt, when ?? ctx.currentTime);
    },
    ...extra,
  });

  const created = [];
  ctx.__created = created;
  const make = (kind, n) => { created.push({ kind, node: n }); return n; };

  ctx.createOscillator = () => make('oscillator', source({ type: 'sine', frequency: param(440), detune: param() }));
  ctx.createBufferSource = () => make('bufferSource', source({ buffer: null }));
  ctx.createGain = () => make('gain', node(ctx, { gain: param(1) }));
  ctx.createBiquadFilter = () => make('biquad', node(ctx, { type: 'lowpass', frequency: param(350), Q: param(1), gain: param(0) }));
  ctx.createWaveShaper = () => make('waveShaper', node(ctx, { curve: null, oversample: 'none' }));
  ctx.createDelay = () => make('delay', node(ctx, { delayTime: param(0) }));
  ctx.createBuffer = (ch, len) => ({ getChannelData: () => new Float32Array(len) });
  return ctx;
}

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

export function loadComponent(file, { hidden = false } = {}) {
  const html = readGuide(file);
  const src = extractLogic(html, file);
  const audioCtx = makeAudioContext();

  globalThis.document = globalThis.document || {};
  globalThis.document.hidden = hidden;
  globalThis.window = { AudioContext: function () { return audioCtx; } };

  const factory = new Function('DCLogic', 'StreamableLogic', 'React',
    src + '\n;return typeof Component !== "undefined" ? Component : undefined;');
  const Component = factory(StubLogic, StubLogic, {});
  if (!Component) throw new Error(`${file}: script block defined no Component`);
  const inst = new Component({});
  inst.audioCtx = audioCtx;
  inst.noiseBuffer = audioCtx.createBuffer(1, 128);

  const setHidden = v => { globalThis.document.hidden = v; };

  const dispose = () => {
    for (const key of Object.keys(inst.sequences || {})) inst.stopSequence(key);
  };

  return { inst, audioCtx, html, Component, setHidden, dispose };
}

export function stepIndices(inst) {
  return inst.STEPS.map((_, i) => i);
}

export function renderStep(inst, i) {
  inst.state = { ...inst.state, step: i };
  return inst.renderVals();
}
