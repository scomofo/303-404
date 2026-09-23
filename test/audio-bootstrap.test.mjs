// Unit tests for DCStudioAudio.ensureAudioContext, the shared AudioContext
// bootstrap used by the studio, arcade, and drop pages. The module is loaded
// fresh per test in a vm sandbox so the internal resume-promise coalescing
// cannot leak between cases. These tests assert bootstrap behavior only; they
// do not claim to measure browser audio policy or DSP.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { readGuide } from './harness.mjs';

function fakeContext({ state = 'suspended', resumeTo = 'running' } = {}) {
  const listeners = {};
  return {
    state,
    resumed: 0,
    constructed: true,
    addEventListener(type, fn) { (listeners[type] ??= []).push(fn); },
    fire(type) { for (const fn of listeners[type] ?? []) fn(); },
    async resume() { this.resumed++; this.state = resumeTo; },
  };
}

// Loads studio/audio.js with the given AudioContext constructor (or none).
// The module reads the constructor from globalThis at call time.
function loadAudio(Ctor) {
  const scope = {};
  runInNewContext(readGuide('studio/audio.js'), scope);
  if (Ctor) scope.AudioContext = Ctor;
  return scope.DCStudioAudio;
}

function bridge() {
  let ctx = null;
  const calls = { set: 0 };
  return {
    get: () => ctx,
    set: next => { ctx = next; calls.set++; },
    calls,
  };
}

const messages = {
  unavailableMessage: 'custom unavailable',
  pausedMessage: 'custom paused',
};

test('throws the caller\'s unavailable message when no constructor exists', async () => {
  const A = loadAudio(null);
  const b = bridge();
  await assert.rejects(A.ensureAudioContext({ ...b, ...messages }), /custom unavailable/);
  assert.equal(b.calls.set, 0);
});

test('creates, stores, and returns a context, resuming it once', async () => {
  const created = [];
  const A = loadAudio(function () { const c = fakeContext(); created.push(c); return c; });
  const b = bridge();
  const ctx = await A.ensureAudioContext({ ...b, ...messages });
  assert.equal(created.length, 1);
  assert.equal(ctx, created[0]);
  assert.equal(b.calls.set, 1);
  assert.equal(ctx.resumed, 1);
  assert.equal(ctx.state, 'running');
});

test('reuses a running context without constructing or resuming', async () => {
  let constructed = 0;
  const A = loadAudio(function () { constructed++; return fakeContext({ state: 'running' }); });
  const existing = fakeContext({ state: 'running' });
  const b = bridge(); b.set(existing); b.calls.set = 0;
  const ctx = await A.ensureAudioContext({ ...b, ...messages });
  assert.equal(ctx, existing);
  assert.equal(constructed, 0);
  assert.equal(existing.resumed, 0);
  assert.equal(b.calls.set, 0);
});

test('recreates a closed context and wires onPaused to the new one', async () => {
  const created = [];
  const A = loadAudio(function () { const c = fakeContext(); created.push(c); return c; });
  const b = bridge();
  const closed = fakeContext({ state: 'closed' });
  b.set(closed);
  let paused = 0;
  const ctx = await A.ensureAudioContext({ ...b, ...messages, onPaused: () => { paused++; } });
  assert.equal(created.length, 1);
  assert.notEqual(ctx, closed);
  assert.equal(b.calls.set, 2);
  // The pause listener belongs to the new context: firing on it calls onPaused
  // exactly when the new context is not running.
  ctx.state = 'suspended'; ctx.fire('statechange');
  assert.equal(paused, 1);
  ctx.state = 'running'; ctx.fire('statechange');
  assert.equal(paused, 1);
  // The discarded context's events no longer reach onPaused.
  closed.fire('statechange');
  assert.equal(paused, 1);
});

test('coalesces concurrent resumes into one resume() call', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const created = [];
  const A = loadAudio(function () {
    const c = fakeContext();
    created.push(c);
    c.resume = async () => { c.resumed++; await gate; c.state = 'running'; };
    return c;
  });
  const b = bridge();
  const first = A.ensureAudioContext({ ...b, ...messages });
  const second = A.ensureAudioContext({ ...b, ...messages });
  // The second call finds the context the first call already stored and joins
  // its in-flight resume instead of constructing or resuming again.
  await new Promise(resolve => setImmediate(resolve));
  release();
  const [one, two] = await Promise.all([first, second]);
  assert.equal(one, two);
  assert.equal(one.resumed, 1);
});

test('throws the caller\'s paused message when resume does not start audio', async () => {
  const A = loadAudio(function () { return fakeContext({ resumeTo: 'suspended' }); });
  const b = bridge();
  await assert.rejects(A.ensureAudioContext({ ...b, ...messages }), /custom paused/);
});

test('falls back to default messages when none are provided', async () => {
  const A = loadAudio(null);
  await assert.rejects(A.ensureAudioContext(bridge()), /unavailable/);
  const B = loadAudio(function () { return fakeContext({ resumeTo: 'suspended' }); });
  await assert.rejects(B.ensureAudioContext(bridge()), /could not start/);
});
