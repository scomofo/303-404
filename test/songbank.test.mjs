// The Song Bank ships transcriptions of real pattern charts, so its data carries
// claims about the world. These tests guard the claims as much as the code.

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadComponent, renderStep } from './harness.mjs';

const FILE = 'Behringer Setup Guide.dc.html';

function cards() {
  const { inst } = loadComponent(FILE);
  return { inst, cards: inst.SONG_CARDS };
}

test('every card resolves every note to a real frequency', () => {
  const { inst, cards: list } = cards();
  for (const c of list) {
    assert.ok(Array.isArray(c.notes) && c.notes.length > 0, `${c.id}: no notes`);
    for (const n of c.notes) {
      const f = inst.noteToFreq(n);
      assert.ok(Number.isFinite(f) && f > 0, `${c.id}: note "${n}" resolved to ${f}`);
    }
  }
});

test('accent and slide indices stay inside the pattern', () => {
  const { cards: list } = cards();
  for (const c of list) {
    for (const i of c.accent) {
      assert.ok(i >= 0 && i < c.notes.length, `${c.id}: accent step ${i} outside 0..${c.notes.length - 1}`);
    }
    for (const i of c.slide) {
      assert.ok(i >= 0 && i < c.notes.length, `${c.id}: slide step ${i} outside 0..${c.notes.length - 1}`);
    }
  }
});

test('card ids are unique and every card has a title and tag', () => {
  const { cards: list } = cards();
  const ids = list.map(c => c.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate card id');
  for (const c of list) assert.ok(c.title && c.tag, `${c.id}: missing title or tag`);
});

test('optional fields use only supported values', () => {
  const { cards: list } = cards();
  for (const c of list) {
    if (c.waveform !== undefined) {
      assert.ok(['sawtooth', 'square'].includes(c.waveform), `${c.id}: waveform "${c.waveform}"`);
    }
    if (c.filter !== undefined) {
      for (const k of ['cutoff', 'resonance', 'decay', 'accent']) {
        const v = c.filter[k];
        assert.ok(typeof v === 'number' && v >= 0 && v <= 1, `${c.id}: filter.${k} = ${v}, want 0..1`);
      }
    }
  }
});

test('tempos are plausible and drive a sane step length', () => {
  const { cards: list } = cards();
  for (const c of list) {
    assert.ok(c.bpm >= 60 && c.bpm <= 200, `${c.id}: bpm ${c.bpm} outside 60..200`);
    const stepMs = Math.round(60000 / c.bpm / 4);   // what loadSongCard computes
    assert.ok(stepMs > 0, `${c.id}: step length ${stepMs}ms`);
  }
});

// A guessed tempo must say so on the card. This was shipped once with the code
// comments and README claiming guesses were flagged while the UI showed a bare
// number, so the label is asserted rather than assumed.
test('a tempo that is not confirmed is visibly marked as an estimate', () => {
  const { inst } = loadComponent(FILE);
  const step = inst.STEPS.findIndex(s => s.widget === 'songbank');
  const rendered = renderStep(inst, step).songCards;
  assert.equal(rendered.length, inst.SONG_CARDS.length);

  rendered.forEach((r, i) => {
    const c = inst.SONG_CARDS[i];
    if (c.bpmDisplay) {
      assert.equal(r.bpmLabel, c.bpmDisplay, `${c.id}: bpmDisplay should win`);
    } else if (c.bpmConfirmed) {
      assert.equal(r.bpmLabel, `${c.bpm} BPM`);
      assert.doesNotMatch(r.bpmLabel, /estimated/, `${c.id}: confirmed tempo marked as an estimate`);
    } else {
      assert.match(r.bpmLabel, /estimated/, `${c.id}: unconfirmed tempo shown as a bare number`);
    }
  });
});

test('loading a card populates the playable pattern', () => {
  const { inst } = loadComponent(FILE);
  for (const c of inst.SONG_CARDS) {
    inst.loadSongCard(c);
    assert.deepEqual(inst.state.sbNotes, c.notes, `${c.id}: notes not loaded`);
    assert.equal(inst.state.sbSelected, c.id);
    assert.equal(inst.state.sbTempo, Math.round(60000 / c.bpm / 4), `${c.id}: tempo not applied`);
    assert.equal(inst.state.sbWaveform, c.waveform || 'sawtooth');

    // and the loaded pattern renders a cell per step
    const step = inst.STEPS.findIndex(s => s.widget === 'songbank');
    assert.equal(renderStep(inst, step).sbCells.length, c.notes.length, `${c.id}: cell count`);
  }
});

test('shorter patterns loop at their own length rather than padding to 16', () => {
  const { cards: list } = cards();
  const short = list.filter(c => c.notes.length !== 16);
  assert.ok(short.length > 0, 'expected at least one non-16-step card');
  for (const c of short) {
    assert.match(c.tag, /\d+-step pattern/, `${c.id} is ${c.notes.length} steps but its tag does not say so`);
  }
});
