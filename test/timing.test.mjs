// The engines schedule audio ahead of time against the AudioContext clock rather than
// firing each note from a timer callback. These tests assert the property that buys:
// scheduled start times land on an exact grid, no matter how the timer itself behaves.
//
// The stub clock advances with real time, so the scheduler runs for real — only the
// audio nodes are fake. If someone reverts an engine to `ctx.currentTime` per note,
// the grid assertions fail immediately.

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadComponent, renderStep } from './harness.mjs';

const BEHRINGER = 'Behringer Setup Guide.dc.html';
const DDJ = 'DDJ-FLX4 Guide.dc.html';
const RUN_MS = 700;

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Distinct scheduled onsets, ascending. */
function onsets(ctx) {
  return [...new Set(ctx.__starts.map(s => +s.when.toFixed(9)))].sort((a, b) => a - b);
}

/** Largest deviation, in ms, of any onset from a grid of `step` seconds. */
function gridErrorMs(times, step) {
  if (times.length < 2) return 0;
  const t0 = times[0];
  return Math.max(...times.map(t => {
    const n = (t - t0) / step;
    return Math.abs(n - Math.round(n)) * step * 1000;
  }));
}

test('RD-6 schedules every hit on an exact 16th-note grid', async () => {
  const { inst, audioCtx } = loadComponent(BEHRINGER);
  inst.playRd6('rd6');
  await sleep(RUN_MS);
  inst.stopRd6();

  const t = onsets(audioCtx);
  assert.ok(t.length >= 4, `expected several onsets, got ${t.length}`);
  assert.ok(gridErrorMs(t, 0.125) < 1e-6, `off the 125ms grid by ${gridErrorMs(t, 0.125)}ms`);
});

test('RD-6 schedules ahead of the clock rather than at it', async () => {
  // The defining difference from the old behaviour: a note is booked before its moment
  // arrives. Firing at ctx.currentTime would make every `when` equal its `at`, which is
  // what left the groove at the mercy of timer jitter.
  const { inst, audioCtx } = loadComponent(BEHRINGER);
  // A hit on every step, so a short run still books plenty of notes.
  const dense = Array.from({ length: 16 }, (_, i) => i);
  inst.state = { ...inst.state, rd6: { bd: dense, sd: [], ch: [], oh: [], ac: [] } };
  inst.playRd6('rd6');
  await sleep(400);
  inst.stopRd6();

  const booked = audioCtx.__starts;
  assert.ok(booked.length >= 3, `expected several notes, got ${booked.length}`);
  const ahead = booked.filter(s => s.when > s.at + 1e-9);
  assert.ok(ahead.length > 0, 'every note was scheduled at the clock, not ahead of it');
});

test('stopping silences hits that were queued but had not sounded', async () => {
  const { inst, audioCtx } = loadComponent(BEHRINGER);
  inst.playRd6('rd6');
  await sleep(200);
  const at = audioCtx.currentTime;
  inst.stopRd6();
  // Anything still booked for the future must have been silenced, or a lookahead's
  // worth of extra drum hits would play on after the user pressed Stop. A source
  // survives only if its stop lands after its start.
  const leaked = audioCtx.__starts.filter(s => s.when > at && s.stopAt > s.when);
  assert.deepEqual(leaked.map(s => +s.when.toFixed(4)), [],
    'notes queued past the stop were left to sound');
});

test('shuffle lengthens the wait into off-beat 16ths, not out of them', async () => {
  // Swing means odd (off-beat) steps land late. The multiplier was once inverted,
  // which produced the opposite feel while the UI and README described this one.
  const { inst, audioCtx } = loadComponent(BEHRINGER);
  // The stock pattern hits only even steps, where a long step and its short partner
  // always sum to two straight ones — so per-step swing is invisible on it. Put a hit
  // on all 16 steps to see each gap individually.
  const dense = Array.from({ length: 16 }, (_, i) => i);
  inst.state = { ...inst.state, rd6Shuffle: 0.25, rd6: { bd: dense, sd: [], ch: [], oh: [], ac: [] } };
  inst.playRd6('rd6');
  await sleep(RUN_MS);
  inst.stopRd6();

  const t = onsets(audioCtx);
  const gaps = t.slice(1).map((x, i) => x - t[i]);
  assert.ok(gaps.length >= 3, `expected several gaps, got ${gaps.length}`);
  assert.ok(gaps.some(g => g > 0.1251), `no stretched step in ${gaps.map(g => (g * 1000).toFixed(1))}`);
  assert.ok(gaps.some(g => g < 0.1249), `no shortened step in ${gaps.map(g => (g * 1000).toFixed(1))}`);

  // The first gap leaves step 0 — an even step — so it must be the stretched one,
  // delaying the off-beat that follows. The inverse of this is the bug once shipped.
  assert.ok(gaps[0] > 0.125, `first gap ${(gaps[0] * 1000).toFixed(2)}ms should be stretched, not shortened`);
});

test('shuffle keeps the bar the same length as straight time', async () => {
  const { inst, audioCtx } = loadComponent(BEHRINGER);
  inst.state = { ...inst.state, rd6Shuffle: 0.25 };
  inst.playRd6('rd6');
  await sleep(RUN_MS);
  inst.stopRd6();
  const t = onsets(audioCtx);
  // A long step and its following short step must still sum to two straight steps,
  // otherwise swing would drag the tempo.
  const gaps = t.slice(1).map((x, i) => x - t[i]);
  for (let i = 0; i + 1 < gaps.length; i++) {
    const pair = gaps[i] + gaps[i + 1];
    if (pair < 0.3) assert.ok(Math.abs(pair - 0.25) < 1e-9, `pair sums to ${pair}s, want 0.25s`);
  }
});

test('TD-3 and Song Bank run their own clocks without leaking timers', async () => {
  const { inst } = loadComponent(BEHRINGER);
  inst.playTd3();
  assert.ok(inst.sequences.td3, 'TD-3 sequence not registered');
  inst.stopTd3();
  assert.equal(inst.sequences.td3, undefined, 'TD-3 sequence not torn down');

  inst.loadSongCard(inst.SONG_CARDS[0]);
  inst.playSongBank();
  assert.ok(inst.sequences.sb, 'Song Bank sequence not registered');
  inst.stopSongBank();
  assert.equal(inst.sequences.sb, undefined, 'Song Bank sequence not torn down');
});

test('the lookahead widens when the tab is hidden', () => {
  // A ~120ms horizon keeps edits responsive but cannot survive a background tab,
  // where timers are clamped to about a second.
  const { inst, setHidden } = loadComponent(BEHRINGER);
  setHidden(false);
  const near = inst.lookahead();
  setHidden(true);
  const far = inst.lookahead();
  setHidden(false);

  assert.ok(far > 1, `hidden lookahead ${far}s will not outlast ~1s timer clamping`);
  assert.ok(near < 0.5, `visible lookahead ${near}s is too laggy for live edits`);
});

test('DDJ decks schedule on their own tempo grids', async () => {
  const { inst, audioCtx } = loadComponent(DDJ);
  const step = inst.STEPS.findIndex(s => s.widget === 'sync');
  renderStep(inst, step);
  inst.startEngine();
  await sleep(RUN_MS);
  inst.stopEngine();

  const t = onsets(audioCtx);
  assert.ok(t.length >= 4, `expected several onsets, got ${t.length}`);

  // Deck B starts detuned on purpose, so onsets belong to one of two grids.
  const stepA = 60 / inst.DECK_A_BPM / 4;
  const stepB = 60 / (inst.DECK_A_BPM * (1 + inst.initialState().deckB.tempoPct / 100)) / 4;
  const t0 = t[0];
  for (const x of t) {
    const onA = Math.abs((x - t0) / stepA - Math.round((x - t0) / stepA)) < 0.02;
    const onB = Math.abs((x - t0) / stepB - Math.round((x - t0) / stepB)) < 0.05;
    assert.ok(onA || onB, `onset ${x} sits on neither deck's grid`);
  }
});

test('a phase jump moves the column without disturbing the tempo grid', async () => {
  const { inst, audioCtx } = loadComponent(DDJ);
  renderStep(inst, inst.STEPS.findIndex(s => s.widget === 'sync'));
  inst.startEngine();
  inst.syncDecks();                       // both decks onto one tempo
  await sleep(250);

  const before = inst.state.colB;
  inst.nudge('deckB', 1);
  assert.equal(inst.state.colB, (before + 1) % 16, 'nudge did not advance the column');

  await sleep(300);
  inst.stopEngine();

  // Timing must be untouched by the jump: a nudge shifts phase, not tempo.
  const step = 60 / inst.DECK_A_BPM / 4;
  const live = onsets(audioCtx).filter((_, i, a) => i > a.length / 3);
  assert.ok(gridErrorMs(live, step) < 1, `nudge knocked onsets off the grid by ${gridErrorMs(live, step)}ms`);
});
