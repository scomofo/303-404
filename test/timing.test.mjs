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
const MPK = 'MPK Mini MK4 Guide.dc.html';

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Wait until `fn()` holds, polling.
 *
 * Timing tests must not assert on how much a fixed wall-clock window produces: a
 * loaded CI runner schedules fewer steps in the same 700ms than a quiet laptop, which
 * is a property of the runner rather than of the code. Waiting for the data instead
 * just costs a few more polls when the machine is busy.
 */
async function until(fn, label, timeout = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (fn()) return;
    await sleep(20);
  }
  throw new Error(`timed out after ${timeout}ms waiting for ${label}`);
}

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

test('RD-6 schedules every hit on an exact 16th-note grid', async t => {
  const { inst, audioCtx, dispose } = loadComponent(BEHRINGER);
  t.after(dispose);
  inst.playRd6('rd6');
  await until(() => onsets(audioCtx).length >= 6, 'six RD-6 onsets');
  inst.stopRd6();

  const times = onsets(audioCtx);
  assert.ok(gridErrorMs(times, 0.125) < 1e-6, `off the 125ms grid by ${gridErrorMs(times, 0.125)}ms`);
});

test('RD-6 schedules ahead of the clock rather than at it', async t => {
  // The defining difference from the old behaviour: a note is booked before its moment
  // arrives. Firing at ctx.currentTime would make every `when` equal its `at`, which is
  // what left the groove at the mercy of timer jitter.
  const { inst, audioCtx, dispose } = loadComponent(BEHRINGER);
  t.after(dispose);
  // A hit on every step, so a short run still books plenty of notes.
  const dense = Array.from({ length: 16 }, (_, i) => i);
  inst.state = { ...inst.state, rd6: { bd: dense, sd: [], ch: [], oh: [], ac: [] } };
  inst.playRd6('rd6');
  await until(() => audioCtx.__starts.length >= 4, 'four booked notes');
  inst.stopRd6();

  const booked = audioCtx.__starts;
  const ahead = booked.filter(s => s.when > s.at + 1e-9);
  assert.ok(ahead.length > 0, 'every note was scheduled at the clock, not ahead of it');
});

test('stopping silences hits that were queued but had not sounded', async t => {
  const { inst, audioCtx, dispose } = loadComponent(BEHRINGER);
  t.after(dispose);
  inst.playRd6('rd6');
  // Waiting for a queued-ahead note also keeps the assertion below non-vacuous:
  // if nothing were ever queued, "nothing leaked" would pass for the wrong reason.
  await until(() => audioCtx.__starts.some(x => x.when > audioCtx.currentTime),
    'a note queued ahead of the clock');
  const at = audioCtx.currentTime;
  inst.stopRd6();
  // Anything still booked for the future must have been silenced, or a lookahead's
  // worth of extra drum hits would play on after the user pressed Stop. A source
  // survives only if its stop lands after its start.
  const leaked = audioCtx.__starts.filter(s => s.when > at && s.stopAt > s.when);
  assert.deepEqual(leaked.map(s => +s.when.toFixed(4)), [],
    'notes queued past the stop were left to sound');
});

test('shuffle lengthens the wait into off-beat 16ths, not out of them', async t => {
  // Swing means odd (off-beat) steps land late. The multiplier was once inverted,
  // which produced the opposite feel while the UI and README described this one.
  const { inst, audioCtx, dispose } = loadComponent(BEHRINGER);
  t.after(dispose);
  // The stock pattern hits only even steps, where a long step and its short partner
  // always sum to two straight ones — so per-step swing is invisible on it. Put a hit
  // on all 16 steps to see each gap individually.
  const dense = Array.from({ length: 16 }, (_, i) => i);
  inst.state = { ...inst.state, rd6Shuffle: 0.25, rd6: { bd: dense, sd: [], ch: [], oh: [], ac: [] } };
  inst.playRd6('rd6');
  await until(() => onsets(audioCtx).length >= 5, 'five shuffled onsets');
  inst.stopRd6();

  const times = onsets(audioCtx);
  const gaps = times.slice(1).map((x, i) => x - times[i]);
  assert.ok(gaps.some(g => g > 0.1251), `no stretched step in ${gaps.map(g => (g * 1000).toFixed(1))}`);
  assert.ok(gaps.some(g => g < 0.1249), `no shortened step in ${gaps.map(g => (g * 1000).toFixed(1))}`);

  // The first gap leaves step 0 — an even step — so it must be the stretched one,
  // delaying the off-beat that follows. The inverse of this is the bug once shipped.
  assert.ok(gaps[0] > 0.125, `first gap ${(gaps[0] * 1000).toFixed(2)}ms should be stretched, not shortened`);
});

test('shuffle keeps the bar the same length as straight time', async t => {
  const { inst, audioCtx, dispose } = loadComponent(BEHRINGER);
  t.after(dispose);
  const dense = Array.from({ length: 16 }, (_, i) => i);
  inst.state = { ...inst.state, rd6Shuffle: 0.25, rd6: { bd: dense, sd: [], ch: [], oh: [], ac: [] } };
  inst.playRd6('rd6');
  await until(() => onsets(audioCtx).length >= 5, 'five shuffled onsets');
  inst.stopRd6();
  const times = onsets(audioCtx);
  // A long step and its following short step must still sum to two straight steps,
  // otherwise swing would drag the tempo.
  const gaps = times.slice(1).map((x, i) => x - times[i]);
  for (let i = 0; i + 1 < gaps.length; i++) {
    const pair = gaps[i] + gaps[i + 1];
    if (pair < 0.3) assert.ok(Math.abs(pair - 0.25) < 1e-9, `pair sums to ${pair}s, want 0.25s`);
  }
});

test('TD-3 and Song Bank run their own clocks without leaking timers', async t => {
  const { inst, dispose } = loadComponent(BEHRINGER);
  t.after(dispose);
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

function assertEnvelopeSurvivesNextStep(param, label, decayTime) {
  const sets = param.calls.filter(call => call.op === 'set');
  assert.ok(sets.length >= 2, `${label}: fewer than two cutoff steps were scheduled`);
  const ramp = param.calls.find(call =>
    call.op === 'expo' && call.t > sets[0].t && call.t < sets[1].t
  );
  assert.ok(ramp, `${label}: scheduling step 2 cancelled step 1's filter decay`);

  // If a requested decay runs past the next note, the endpoint is clipped just
  // before that boundary but retains the original exponential curve's value.
  const elapsed = ramp.t - sets[0].t;
  const expected = sets[0].v * Math.pow(300 / sets[0].v, Math.min(1, elapsed / decayTime));
  assert.ok(Math.abs(ramp.v - expected) < 1e-6,
    `${label}: clipped ramp ${ramp.v} changed the requested decay slope (want ${expected})`);
}

test('TD-3 keeps each filter decay when the next step is scheduled', async t => {
  const { inst, audioCtx, dispose } = loadComponent(BEHRINGER);
  t.after(dispose);
  inst.playTd3();
  const filter = audioCtx.__created.find(node => node.kind === 'biquad').node;
  await until(() => filter.frequency.calls.filter(call => call.op === 'set').length >= 2,
    'two TD-3 filter steps');
  inst.stopTd3();
  assertEnvelopeSurvivesNextStep(filter.frequency, 'TD-3', 0.18);
});

test('Song Bank keeps long filter decays when later steps are queued', async t => {
  const { inst, audioCtx, dispose } = loadComponent(BEHRINGER);
  t.after(dispose);
  const card = inst.SONG_CARDS.find(item => item.id === 'tame-impala-breathe-deeper');
  assert.ok(card, 'Breathe Deeper card missing');
  inst.loadSongCard(card);
  inst.playSongBank();
  const filter = audioCtx.__created.find(node => node.kind === 'biquad').node;
  await until(() => filter.frequency.calls.filter(call => call.op === 'set').length >= 2,
    'two Song Bank filter steps');
  inst.stopSongBank();
  const decayTime = 0.08 + card.filter.decay * 0.35;
  assertEnvelopeSurvivesNextStep(filter.frequency, 'Song Bank', decayTime);
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

test('DDJ decks schedule on their own tempo grids', async t => {
  const { inst, audioCtx, dispose } = loadComponent(DDJ);
  t.after(dispose);
  const step = inst.STEPS.findIndex(s => s.widget === 'sync');
  renderStep(inst, step);
  inst.startEngine();
  await until(() => onsets(audioCtx).length >= 6, 'six deck onsets');
  inst.stopEngine();

  const times = onsets(audioCtx);

  // Deck B starts detuned on purpose, so onsets belong to one of two grids.
  const stepA = 60 / inst.DECK_A_BPM / 4;
  const stepB = 60 / (inst.DECK_A_BPM * (1 + inst.initialState().deckB.tempoPct / 100)) / 4;
  const t0 = times[0];
  for (const x of times) {
    const onA = Math.abs((x - t0) / stepA - Math.round((x - t0) / stepA)) < 0.02;
    const onB = Math.abs((x - t0) / stepB - Math.round((x - t0) / stepB)) < 0.05;
    assert.ok(onA || onB, `onset ${x} sits on neither deck's grid`);
  }
});

test('a phase jump moves the column without disturbing the tempo grid', async t => {
  const { inst, audioCtx, dispose } = loadComponent(DDJ);
  t.after(dispose);
  renderStep(inst, inst.STEPS.findIndex(s => s.widget === 'sync'));
  inst.startEngine();
  inst.syncDecks();                       // both decks onto one tempo
  await until(() => onsets(audioCtx).length >= 3, 'the decks to get going');

  const before = inst.state.colB;
  inst.nudge('deckB', 1);
  assert.equal(inst.state.colB, (before + 1) % 16, 'nudge did not advance the column');

  const had = onsets(audioCtx).length;
  await until(() => onsets(audioCtx).length >= had + 4, 'four onsets after the jump');
  inst.stopEngine();

  // Timing must be untouched by the jump: a nudge shifts phase, not tempo.
  const step = 60 / inst.DECK_A_BPM / 4;
  const live = onsets(audioCtx).filter((_, i, a) => i > a.length / 3);
  assert.ok(gridErrorMs(live, step) < 1, `nudge knocked onsets off the grid by ${gridErrorMs(live, step)}ms`);
});

/** A 16-step row with a hit on every step, so each gap is visible on its own. */
function denseBeat(padId) {
  return { [padId]: new Array(16).fill(100) };
}

test('MPK beat grid schedules every hit on the tempo\'s 16th grid', async t => {
  const { inst, audioCtx, dispose } = loadComponent(MPK);
  t.after(dispose);
  inst.state = { ...inst.state, tempo: 120, swing: 0, beat: denseBeat('a-hat') };
  inst.playBeat();
  await until(() => onsets(audioCtx).length >= 6, 'six MPK drum onsets');
  inst.stopAll();

  const step = 60 / 120 / 4;
  assert.ok(gridErrorMs(onsets(audioCtx), step) < 1e-6,
    `off the ${step * 1000}ms grid by ${gridErrorMs(onsets(audioCtx), step)}ms`);
});

test('MPK swing delays off-beat 16ths and keeps the bar the same length', async t => {
  const { inst, audioCtx, dispose } = loadComponent(MPK);
  t.after(dispose);
  inst.state = { ...inst.state, tempo: 120, swing: 0.25, beat: denseBeat('a-hat') };
  inst.playBeat();
  await until(() => onsets(audioCtx).length >= 5, 'five swung onsets');
  inst.stopAll();

  const straight = 60 / 120 / 4;
  const gaps = onsets(audioCtx).slice(1).map((x, i) => x - onsets(audioCtx)[i]);
  // The first gap leaves step 0 — an even step — so it must be the stretched
  // one, delaying the off-beat that follows. The inverse is the classic bug.
  assert.ok(gaps[0] > straight, `first gap ${(gaps[0] * 1000).toFixed(2)}ms should be stretched`);
  assert.ok(gaps.some(g => g < straight), 'no shortened step: swing was not applied');
  for (let i = 0; i + 1 < gaps.length; i++) {
    const pair = gaps[i] + gaps[i + 1];
    assert.ok(Math.abs(pair - straight * 2) < 1e-9,
      `a swung pair sums to ${pair}s rather than ${straight * 2}s — swing is dragging the tempo`);
  }
});

test('MPK Note Repeat rolls at its own subdivision, ignoring swing', async t => {
  const { inst, audioCtx, dispose } = loadComponent(MPK);
  t.after(dispose);
  // Heavy swing is deliberately on: a repeat is a fixed subdivision and must
  // not inherit the groove's shuffle, or rolls would come out lopsided.
  inst.state = { ...inst.state, tempo: 120, swing: 0.3, noteRepeat: true, repeatRate: 1 };
  inst.ensureAudio();
  inst.hitPad(inst.padById('a-kick'));

  const times = onsets(audioCtx);
  assert.equal(times.length, 8, 'a roll should be eight hits');
  const gap = 60 / 120 / 4;
  assert.ok(gridErrorMs(times, gap) < 1e-9, `the roll is not evenly spaced by ${gap * 1000}ms`);

  // And the rate control actually changes the rate.
  audioCtx.__starts.length = 0;
  inst.setState({ repeatRate: 2 });
  inst.hitPad(inst.padById('a-kick'));
  const wide = onsets(audioCtx);
  assert.ok(Math.abs((wide[1] - wide[0]) - gap * 2) < 1e-9, '1/8 repeats did not double the spacing');
});

test('MPK stopping silences both a running pattern and a Note Repeat roll', async t => {
  const { inst, audioCtx, dispose } = loadComponent(MPK);
  t.after(dispose);
  inst.state = { ...inst.state, tempo: 100, swing: 0, noteRepeat: true, repeatRate: 2, beat: denseBeat('a-hat') };
  inst.playBeat();
  inst.hitPad(inst.padById('a-kick'));
  // Waiting for a queued-ahead note keeps the assertion below non-vacuous.
  await until(() => audioCtx.__starts.some(x => x.when > audioCtx.currentTime),
    'a hit queued ahead of the clock');

  const at = audioCtx.currentTime;
  inst.stopAll();
  const leaked = audioCtx.__starts.filter(s => s.when > at && s.stopAt > s.when);
  assert.deepEqual(leaked.map(s => +s.when.toFixed(4)), [],
    'hits queued past the stop were left to sound');
  assert.equal(Object.keys(inst.sequences).length, 0, 'a sequence timer survived the stop');
});

test('MPK arrangement keeps drums, chords and arp on one grid', async t => {
  const { inst, audioCtx, dispose } = loadComponent(MPK);
  t.after(dispose);
  inst.state = { ...inst.state, tempo: 120, swing: 0, beat: denseBeat('a-hat') };
  // Start inside the section that runs all three layers at once.
  inst.playSong();
  inst.songBarRef = inst.SONG_SECTIONS[0].bars + inst.SONG_SECTIONS[1].bars;
  await until(() => onsets(audioCtx).length >= 8, 'eight arrangement onsets');
  inst.stopAll();

  const step = 60 / 120 / 4;
  const times = onsets(audioCtx);
  assert.ok(gridErrorMs(times, step) < 1e-6,
    `a layer landed off the 16th grid by ${gridErrorMs(times, step)}ms`);
});
