import test from 'node:test';
import assert from 'node:assert/strict';
import { loadComponent, renderStep } from './harness.mjs';

const FILE = 'SampleCircuit Guide.dc.html';
const ALLOWED_SOURCES = new Set([
  'cc0',
  'mit_licensed',
  'musicradar_free',
  'giantsteps',
  'original_synthesis',
  'field_recording',
  'public_domain',
]);

function db(value) {
  return value > 0 ? 20 * Math.log10(value) : -Infinity;
}

test('Sample & Circuit course has eight complete weeks and exposes both labs', () => {
  const { inst } = loadComponent(FILE);
  const intros = inst.STEPS.filter(step => step.kind === 'weekintro');
  assert.deepEqual(intros.map(step => step.weekTag), [
    'Week 1', 'Week 2', 'Week 3', 'Week 4',
    'Week 5', 'Week 6', 'Week 7', 'Week 8',
  ]);
  assert.equal(inst.STEPS.filter(step => step.kind === 'content').length, 40);
  assert.ok(inst.STEPS.some(step => step.widget === 'sliceBank'));
  assert.ok(inst.STEPS.some(step => step.widget === 'patternGrid'));
  assert.equal(inst.STEPS[0].id, 'overview');
  assert.equal(inst.STEPS.at(-1).id, 'complete');
});

test('Slice Bank contains 15 original generated cards with explicit provenance', () => {
  const { inst, html } = loadComponent(FILE);
  assert.equal(inst.SLICE_CARDS.length, 15);
  assert.equal(new Set(inst.SLICE_CARDS.map(card => card.id)).size, 15);
  for (const card of inst.SLICE_CARDS) {
    assert.match(card.id, /^SL-\d{3}$/);
    assert.ok(ALLOWED_SOURCES.has(card.sourceType), card.id + ': invalid sourceType');
    assert.equal(card.sourceType, 'original_synthesis');
    assert.match(card.provenance, /generated locally/i);
    assert.equal(card.license, 'Repository original');
    assert.ok([44100, 48000].includes(card.sampleRate));
    assert.ok([16, 24].includes(card.bitDepth));
    assert.ok(card.waveform.length >= 64);
  }
  assert.doesNotMatch(html, /Funky Drummer|Amen Break|MusicRadar/i,
    'the browser pack must not imply that an external recording is bundled');
});

test('No Empty Slices: every region is ordered, bounded and at least 5 ms', () => {
  const { inst } = loadComponent(FILE);
  for (const card of inst.SLICE_CARDS) {
    assert.ok(card.slices.length > 0, card.id + ': no slices');
    card.slices.forEach((slice, index) => {
      assert.equal(slice.index, index, card.id + ': non-sequential slice index');
      assert.ok(slice.start >= 0, card.id + ': negative slice start');
      assert.ok(slice.end <= card.duration + 0.000001, card.id + ': slice exceeds buffer');
      assert.ok(slice.end - slice.start >= 0.005, card.id + ': slice shorter than 5 ms');
      if (index) assert.equal(slice.start, card.slices[index - 1].end,
        card.id + ': adjacent slices must share a boundary');
    });
  }
});

test('Tempo Provenance: confirmed tempos are plausible and one-shots do not invent BPM', () => {
  const { inst } = loadComponent(FILE);
  for (const card of inst.SLICE_CARDS) {
    if (card.bpmConfirmed === true) {
      assert.equal(typeof card.originalBpm, 'number', card.id);
      assert.ok(card.originalBpm > 20 && card.originalBpm < 300, card.id);
    }
    if (card.originalBpm === null) {
      assert.ok(card.bpmConfirmed === false || card.bpmConfirmed === null, card.id);
    }
    if (card.autoSliced) {
      assert.equal(card.algorithm, 'transient_detection', card.id);
      assert.ok(card.sensitivity >= 0 && card.sensitivity <= 100, card.id);
    }
  }
});

test('Resampling Integrity: offline rendering retains buffer shape and RMS within 3 dB', async () => {
  const { inst, offlineRenders } = loadComponent(FILE, { offline: true });
  const card = inst.SLICE_CARDS.find(entry => entry.id === 'SL-005');
  inst.state.selectedCardId = card.id;
  const sampler = inst.ensureSampler();
  const source = sampler.createGenerated(card);
  const result = await inst.resampleSelected();
  assert.equal(result.length, source.length);
  assert.equal(result.sampleRate, source.sampleRate);
  assert.equal(result.numberOfChannels, source.numberOfChannels);
  assert.deepEqual(offlineRenders, [{ channels:source.numberOfChannels, length:source.length, sampleRate:source.sampleRate }]);
  const loss = db(sampler.rms(result)) - db(sampler.rms(source));
  assert.ok(loss >= -3, 'RMS dropped by ' + loss.toFixed(2) + ' dB');
});

test('stopping the transport cancels samples already scheduled ahead of the clock', () => {
  const { inst, audioCtx } = loadComponent(FILE);
  inst.state.pattern[0][0] = true;
  inst.startTransport();
  assert.equal(audioCtx.__starts.length, 1);
  inst.stopTransport();
  assert.ok(audioCtx.__starts.every(source => source.stopAt <= source.when));
});

test('imported samples identify their user-provided provenance', async () => {
  const { inst } = loadComponent(FILE);
  await inst.importSample({ target:{ files:[{ name:'my-loop.wav', arrayBuffer:async () => new ArrayBuffer() }] } });
  const card = inst.selectedCard();
  assert.equal(card.sourceType, 'user_import');
  assert.equal(card.license, 'User-provided; rights not verified');
  assert.equal(card.originalBpm, null);
  assert.equal(card.bpmConfirmed, false);
});

test('Export Sample Rate: generated WAV is stereo PCM at an allowed rate and depth', () => {
  const { inst } = loadComponent(FILE);
  const card = inst.SLICE_CARDS.find(entry => entry.id === 'SL-013');
  inst.state.selectedCardId = card.id;
  const exported = inst.exportSelectedWav();
  const view = new DataView(exported.buffer);
  const text = (offset, length) => Array.from({ length }, (_, i) =>
    String.fromCharCode(view.getUint8(offset + i))).join('');
  assert.equal(text(0, 4), 'RIFF');
  assert.equal(text(8, 4), 'WAVE');
  assert.equal(view.getUint16(20, true), 1, 'must be PCM');
  assert.equal(view.getUint16(22, true), 2, 'must be stereo');
  assert.ok([44100, 48000].includes(view.getUint32(24, true)));
  assert.ok([16, 24].includes(view.getUint16(34, true)));
});

test('Pattern Chain Continuity: boundaries have no gap over 5 ms or click over -6 dB', () => {
  const { inst } = loadComponent(FILE);
  const timeline = inst.patternChainTimeline(['Pattern 1', 'Pattern 2'], 120, 1);
  assert.equal(timeline[1].start - timeline[0].end, 0);
  assert.ok(timeline[1].start - timeline[0].end <= 0.005);

  const sampler = inst.ensureSampler();
  const a = sampler.createGenerated(inst.SLICE_CARDS[0]);
  const b = sampler.cloneBuffer(a);
  const metrics = sampler.transitionMetrics(a, b, timeline[1].start - timeline[0].end);
  assert.ok(metrics.gapSeconds <= 0.005);
  assert.ok(metrics.clickDb <= -6, 'boundary click was ' + metrics.clickDb + ' dB');
});

test('Slice Mapping: pad number maps directly to the matching buffer offset', () => {
  const { inst, audioCtx } = loadComponent(FILE);
  const card = inst.SLICE_CARDS.find(entry => entry.id === 'SL-001');
  inst.state.selectedCardId = card.id;
  const trigger = inst.playSlice(1, 1.25);
  assert.equal(trigger.pad, 2);
  assert.equal(trigger.offset, card.slices[1].start);
  const scheduled = audioCtx.__starts.at(-1);
  assert.equal(scheduled.when, 1.25);
  assert.equal(scheduled.offset, card.slices[1].start);
  assert.equal(scheduled.duration, card.slices[1].end - card.slices[1].start);

  const bankStep = inst.STEPS.findIndex(step => step.widget === 'sliceBank');
  const view = renderStep(inst, bankStep);
  assert.match(view.slicePads[0].ariaLabel, /^Play pad 1:/);
});

test('auto-slice records its algorithm and respects the 5 ms minimum', () => {
  const { inst } = loadComponent(FILE);
  inst.state.selectedCardId = 'SL-006';
  inst.setSensitivity(85);
  inst.autoSliceSelected();
  const card = inst.selectedCard();
  assert.equal(card.algorithm, 'transient_detection');
  assert.equal(card.sensitivity, 85);
  assert.ok(card.slices.length >= 2);
  assert.ok(card.slices.every(slice => slice.end - slice.start >= 0.005));
});

test('auto-slice refuses files too short for two valid slices', () => {
  const { inst } = loadComponent(FILE);
  const card = inst.selectedCard();
  card.duration = 0.009;
  inst.autoSliceSelected();
  assert.match(inst.state.status, /at least 10 ms/);
});
