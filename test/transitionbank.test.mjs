import test from 'node:test';
import assert from 'node:assert/strict';
import { loadComponent, renderStep } from './harness.mjs';

const FILE = 'DDJ-FLX4 Guide.dc.html';

test('Transition Bank ships 12 complete, attributed and filterable cards', () => {
  const { inst } = loadComponent(FILE);
  assert.equal(inst.TRANSITION_CARDS.length, 12);
  assert.equal(new Set(inst.TRANSITION_CARDS.map(card => card.id)).size, 12);
  for (const card of inst.TRANSITION_CARDS) {
    assert.match(card.id, /^TB-\d{3}$/);
    assert.ok(card.title && card.type && card.difficulty);
    assert.ok(card.sourceAttribution);
    assert.equal(card.steps.length, 4);
    assert.ok(card.videoSearch);
    if (card.bpmRange) {
      assert.equal(card.bpmRange.length, 2);
      assert.ok(card.bpmRange[0] >= 20 && card.bpmRange[1] <= 300);
      assert.ok(card.bpmRange[0] < card.bpmRange[1]);
    }
  }

  const index = inst.STEPS.findIndex(step => step.widget === 'transitionBank');
  let view = renderStep(inst, index);
  assert.equal(view.transitionCards.length, 12);
  view.transitionDifficultyFilters.find(filter => filter.label === 'Advanced').select();
  view = renderStep(inst, index);
  assert.ok(view.transitionCards.length > 0);
  assert.ok(view.transitionCards.every(card => card.difficulty === 'Advanced'));
  assert.ok(view.selectedTransition.steps.length === 4);
  assert.match(view.selectedTransition.videoUrl, /^https:\/\/www\.youtube\.com\/results\?search_query=/);
});

test('Phase Lock: synced deck BPM produces less than 5 ms drift over 60 seconds', () => {
  const { inst } = loadComponent(FILE);
  inst.state.colA = 7;
  inst.state.colB = 3;
  inst.state.deckB.tempoPct = 0.08;
  inst.syncDecks();
  const bpmB = inst.DECK_A_BPM * (1 + inst.state.deckB.tempoPct / 100);
  assert.equal(inst.state.colB, inst.state.colA);
  assert.ok(inst.phaseDriftMs(inst.DECK_A_BPM, bpmB, 60) < 5);
});

test('EQ Cut Depth: kill settings attenuate every simulated band by at least 60 dB', t => {
  const { inst, dispose } = loadComponent(FILE);
  t.after(dispose);
  assert.equal(inst.eqGainDb(-1, 15), -60);
  inst.startEngine();
  inst.setDeckParam('deckA', 'low', -1);
  inst.setDeckParam('deckA', 'mid', -1);
  inst.setDeckParam('deckA', 'high', -1);
  // The stub base merges state synchronously, matching the node values applied here.
  assert.ok(inst.chainA.low.gain.value <= -60);
  assert.ok(inst.chainA.mid.gain.value <= -60);
  assert.ok(inst.chainA.high.gain.value <= -60);
});

test('FX Tail Length: echo feedback decays to -60 dB within four beats', () => {
  const { inst } = loadComponent(FILE);
  assert.ok(inst.echoTailDb(0.15, 4) <= -60);
});

test('Recording Export: WAV is 44.1 kHz/16-bit, exact length and no hotter than -0.5 dB', () => {
  const { inst } = loadComponent(FILE);
  const recording = inst.buildPracticeWav(2);
  const view = new DataView(recording.buffer);
  const text = (offset, length) => Array.from({ length }, (_, i) =>
    String.fromCharCode(view.getUint8(offset + i))).join('');
  assert.equal(text(0, 4), 'RIFF');
  assert.equal(text(8, 4), 'WAVE');
  assert.equal(view.getUint32(24, true), 44100);
  assert.equal(view.getUint16(34, true), 16);
  assert.equal(view.getUint16(22, true), 2);
  assert.ok(Math.abs(recording.duration - 2) < 1 / 44100);
  assert.ok(recording.peakDb <= -0.5 + 1e-9, recording.peakDb + ' dB');
});

test('Hot Cue Jump: cue search snaps to a sample-accurate zero crossing', () => {
  const { inst } = loadComponent(FILE);
  const samples = new Float32Array([0.8, 0.5, 0.2, 0.01, -0.01, -0.3, -0.6]);
  const cue = inst.snapToZeroCrossing(samples, 2, 3);
  assert.ok(cue.index === 3 || cue.index === 4);
  assert.ok(cue.amplitude <= 0.01 + 1e-7);
});

test('Camelot Wheel: mismatches warn but do not block playback', t => {
  const { inst, dispose } = loadComponent(FILE);
  t.after(dispose);
  const mismatch = inst.camelotCompatibility('5A', '3A');
  assert.equal(mismatch.compatible, false);
  assert.match(mismatch.relation, /mismatch/i);
  inst.state.camelotA = '5A';
  inst.state.camelotB = '3A';
  const index = inst.STEPS.findIndex(step => step.widget === 'camelot');
  const view = renderStep(inst, index);
  assert.equal(view.camelotStatus.icon, '⚠');
  inst.startEngine();
  assert.equal(inst.state.enginePlaying, true, 'harmonic warning blocked playback');
});

test('beatgrid track schema keeps phase offsets in milliseconds', () => {
  const { inst } = loadComponent(FILE);
  assert.equal(inst.DJ_TRACKS.length, 2);
  for (const track of inst.DJ_TRACKS) {
    assert.ok(track.id && track.title && track.bpm && track.key);
    assert.ok(track.beatGridOffsets.length >= 64);
    const beatMs = 60000 / track.bpm;
    for (let i = 1; i < track.beatGridOffsets.length; i++) {
      assert.ok(Math.abs((track.beatGridOffsets[i] - track.beatGridOffsets[i - 1]) - beatMs) < 1e-9);
    }
  }
});
