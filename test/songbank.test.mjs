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
      // A rest is null. Anything else must parse: noteToFreq falls back to a default
      // rather than throwing, so a typo would otherwise sail through as a wrong pitch.
      if (n === null) continue;
      assert.equal(typeof n, 'string', `${c.id}: note entry ${JSON.stringify(n)} is neither a name nor a rest`);
      assert.match(n, /^[A-G]#?-?\d+$/, `${c.id}: note "${n}" is not a parsable name`);
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
      // A card may state only the knobs its source gave; the rest fall back to the
      // engine default rather than being guessed. Whatever is present must be 0..1.
      const present = Object.keys(c.filter);
      assert.ok(present.length > 0, `${c.id}: empty filter object`);
      for (const k of present) {
        assert.ok(['cutoff', 'resonance', 'decay', 'accent'].includes(k), `${c.id}: unknown filter knob "${k}"`);
        const v = c.filter[k];
        assert.ok(typeof v === 'number' && v >= 0 && v <= 1, `${c.id}: filter.${k} = ${v}, want 0..1`);
      }
    }
    if (c.overdrive !== undefined) {
      assert.ok(typeof c.overdrive === 'number' && c.overdrive >= 0 && c.overdrive <= 1,
        `${c.id}: overdrive = ${c.overdrive}, want 0..1`);
    }
    if (c.homeOctave !== undefined) {
      assert.ok(Number.isInteger(c.homeOctave), `${c.id}: homeOctave = ${c.homeOctave}`);
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

// ── pattern chart ────────────────────────────────────────────────────────────
// Each card renders back into the chart layout its transcription came from, so the
// chart has to agree with the data the engine actually plays.

test('every card renders a chart with one column per step', () => {
  const { inst } = loadComponent(FILE);
  for (const c of inst.SONG_CARDS) {
    inst.loadSongCard(c);
    const chart = inst.buildSongChart();
    assert.ok(chart, `${c.id}: no chart built`);
    assert.equal(chart.steps.length, c.notes.length, `${c.id}: column count`);
    assert.equal(chart.title, c.title);
  }
});

test('the chart shows pitch class on the note row and octave as a D/U mark', () => {
  const { inst } = loadComponent(FILE);
  for (const c of inst.SONG_CARDS) {
    inst.loadSongCard(c);
    const chart = inst.buildSongChart();
    const home = parseInt(chart.homeOctaveLabel.replace('Octave ', ''), 10);
    chart.steps.forEach((s, i) => {
      const { pitch, octave, rest } = inst.splitNote(c.notes[i]);
      if (rest) {
        // A rest is a dash with no octave mark and no accent or slide of its own.
        assert.equal(s.pitch, '—', `${c.id} step ${i + 1}: rest should show a dash`);
        assert.equal(s.shift, '', `${c.id} step ${i + 1}: rest carries an octave mark`);
        assert.equal(s.marks, '', `${c.id} step ${i + 1}: rest carries accent/slide marks`);
        return;
      }
      assert.equal(s.pitch, pitch, `${c.id} step ${i + 1}: pitch class`);
      assert.doesNotMatch(s.pitch, /\d/, `${c.id} step ${i + 1}: octave leaked onto the note row`);
      // Two octaves out is two presses of the octave button, so the mark carries its
      // size — "U2", not a bare "U" that loses the difference.
      const away = Math.abs(octave - home);
      const want = away === 0 ? '' : (octave < home ? 'D' : 'U') + (away > 1 ? String(away) : '');
      assert.equal(s.shift, want, `${c.id} step ${i + 1}: octave mark for ${c.notes[i]} against home ${home}`);
    });
  }
});

test('the home octave is derived from the pattern unless the card pins one', () => {
  const { inst } = loadComponent(FILE);
  for (const c of inst.SONG_CARDS) {
    inst.loadSongCard(c);
    const chart = inst.buildSongChart();
    const home = parseInt(chart.homeOctaveLabel.replace('Octave ', ''), 10);
    const octaves = c.notes.map(n => inst.splitNote(n).octave);
    const at = o => octaves.filter(x => x === o).length;

    if (c.homeOctave !== undefined) {
      // A source that marks every step Up/Down measures against the device's base
      // octave, so the card's own value wins over anything derived.
      assert.equal(home, c.homeOctave, `${c.id}: pinned home octave ignored`);
      continue;
    }
    for (const o of new Set(octaves)) {
      assert.ok(at(home) >= at(o), `${c.id}: home octave ${home} is not the most common`);
    }
    // ...which means a chart never marks more steps shifted than it leaves at home.
    const shifted = chart.steps.filter(s => s.shift).length;
    assert.equal(shifted, c.notes.length - at(home), `${c.id}: mark count does not match notes away from home`);
  }
});

test('a pinned home octave can mark every step shifted', () => {
  const { inst } = loadComponent(FILE);
  const pinned = inst.SONG_CARDS.filter(c => c.homeOctave !== undefined);
  assert.ok(pinned.length > 0, 'expected at least one card to pin its home octave');
  for (const c of pinned) {
    inst.loadSongCard(c);
    const chart = inst.buildSongChart();
    chart.steps.forEach((s, i) => {
      const { octave: oct, rest } = inst.splitNote(c.notes[i]);
      if (rest) { assert.equal(s.shift, '', `${c.id} step ${i + 1}: rest carries an octave mark`); return; }
      const away = Math.abs(oct - c.homeOctave);
      assert.equal(s.shift, away === 0 ? '' : (oct < c.homeOctave ? 'D' : 'U') + (away > 1 ? String(away) : ''),
        `${c.id} step ${i + 1}: mark for ${c.notes[i]} against pinned home ${c.homeOctave}`);
    });
  }
});

test('accent and slide marks match the pattern the engine plays', () => {
  const { inst } = loadComponent(FILE);
  for (const c of inst.SONG_CARDS) {
    inst.loadSongCard(c);
    for (const s of inst.buildSongChart().steps) {
      assert.equal(s.marks.includes('A'), c.accent.includes(s.num - 1), `${c.id} step ${s.num}: accent`);
      assert.equal(s.marks.includes('S'), c.slide.includes(s.num - 1), `${c.id} step ${s.num}: slide`);
    }
  }
});

test('a knob the source never stated shows no pointer', () => {
  const { inst } = loadComponent(FILE);
  for (const c of inst.SONG_CARDS) {
    inst.loadSongCard(c);
    for (const d of inst.buildSongChart().dials) {
      const known = d.valueLabel !== '—';
      // An unknown position must not draw a dial pointer, or the chart would imply a
      // setting nobody recorded.
      assert.equal(/rotate\(/.test(d.pointerStyle), known, `${c.id}: ${d.label} pointer vs "${d.valueLabel}"`);
      // A dial reads as known only when this card supplies that exact value — a partial
      // filter must not make its unstated neighbours look set.
      const source = d.label === 'Overdrive'
        ? c.overdrive
        : (c.filter || {})[d.label.toLowerCase().replace(' ', '')];
      assert.equal(known, source !== undefined && source !== null,
        `${c.id}: ${d.label} shows ${d.valueLabel} but the card supplies ${source}`);
    }
    // Env Mod is never modelled by this engine, so it is blank on every card.
    const envMod = inst.buildSongChart().dials.find(d => d.label === 'Env Mod');
    assert.equal(envMod.valueLabel, '—', `${c.id}: Env Mod should always be blank`);
  }
});

test('unknown header fields are dashed rather than filled in', () => {
  const { inst } = loadComponent(FILE);
  for (const c of inst.SONG_CARDS) {
    inst.loadSongCard(c);
    const chart = inst.buildSongChart();
    assert.equal(chart.artist, c.artist || '—', `${c.id}: artist`);
    assert.equal(chart.group, c.group || '—', `${c.id}: pattern group`);
    assert.equal(chart.bank, c.bank || '—', `${c.id}: bank`);
    assert.equal(chart.pattern, c.pattern === undefined ? '—' : String(c.pattern), `${c.id}: pattern number`);
  }
});

// The filter config became per-knob so a card can state only what its source gave.
// These pin the audio values down, because "sounds the same" is the whole requirement.
test('a card with no filter keeps the historical default voicing', async () => {
  const { inst, audioCtx, dispose } = loadComponent(FILE);
  const plain = inst.SONG_CARDS.find(c => !c.filter && !c.overdrive);
  assert.ok(plain, 'expected a card with no filter settings');
  inst.loadSongCard(plain);
  inst.playSongBank();
  await new Promise(r => setTimeout(r, 150));
  dispose();

  const biquad = audioCtx.__created.find(n => n.kind === 'biquad').node;
  assert.equal(biquad.Q.value, 8, 'default resonance changed');
  const cutoffs = biquad.frequency.calls.filter(c => c.op === 'set').map(c => c.v);
  assert.ok(cutoffs.length > 0, 'no cutoff was scheduled');
  for (const v of cutoffs) {
    assert.ok(v === 900 || v === 1800, `default cutoff should be 900 (1800 accented), got ${v}`);
  }
});

test('a card that states one knob keeps the default for the rest', async () => {
  const { inst, audioCtx, dispose } = loadComponent(FILE);
  const partial = inst.SONG_CARDS.find(c => c.filter && c.filter.resonance === undefined);
  assert.ok(partial, 'expected a card with a partial filter');
  inst.loadSongCard(partial);
  inst.playSongBank();
  await new Promise(r => setTimeout(r, 150));
  dispose();

  const biquad = audioCtx.__created.find(n => n.kind === 'biquad').node;
  assert.equal(biquad.Q.value, 8, 'an unstated resonance should fall back to the default');
});

test('a card gets a waveshaper only when it calls for overdrive', async () => {
  const { inst, audioCtx, dispose } = loadComponent(FILE);
  const clean = inst.SONG_CARDS.find(c => !c.overdrive);
  inst.loadSongCard(clean);
  inst.playSongBank();
  await new Promise(r => setTimeout(r, 60));
  inst.stopSongBank();
  assert.equal(audioCtx.__created.filter(n => n.kind === 'waveShaper').length, 0,
    `${clean.id} has no overdrive but was given a waveshaper`);

  const driven = inst.SONG_CARDS.find(c => c.overdrive);
  assert.ok(driven, 'expected a card that calls for overdrive');
  inst.loadSongCard(driven);
  inst.playSongBank();
  await new Promise(r => setTimeout(r, 60));
  dispose();
  const shapers = audioCtx.__created.filter(n => n.kind === 'waveShaper');
  assert.equal(shapers.length, 1, `${driven.id} should get exactly one waveshaper`);
  assert.ok(shapers[0].node.curve, 'the waveshaper was left without a curve');
});

test('a rest keeps its slot but sounds nothing', async () => {
  const { inst, audioCtx, dispose } = loadComponent(FILE);
  const withRests = inst.SONG_CARDS.filter(c => c.notes.includes(null));
  assert.ok(withRests.length > 0, 'expected at least one card with rests');

  for (const c of withRests) {
    inst.loadSongCard(c);
    const chart = inst.buildSongChart();
    // The bar keeps its full length: a rest is a step, not a missing one.
    assert.equal(chart.steps.length, c.notes.length, `${c.id}: rests changed the pattern length`);
    assert.equal(inst.state.sbNotes.length, c.notes.length, `${c.id}: rests dropped from playback`);
  }

  // ...and playing one neither throws nor schedules a pitch for the silent steps.
  const card = withRests[0];
  inst.loadSongCard(card);
  inst.playSongBank();
  await new Promise(r => setTimeout(r, 250));
  dispose();
  const osc = audioCtx.__created.find(n => n.kind === 'oscillator').node;
  const pitched = osc.frequency.calls.filter(x => x.op !== 'cancel').length;
  assert.ok(pitched > 0, 'no pitches were scheduled at all');
});

test('a slide out of a rest is dropped rather than gliding from silence', () => {
  const { inst } = loadComponent(FILE);
  for (const c of inst.SONG_CARDS) {
    c.slide.forEach(i => {
      if (c.notes[i] === null) {
        assert.fail(`${c.id}: step ${i + 1} is a rest but is marked as sliding`);
      }
    });
  }
});

test('every card that pins a home octave states it as an integer near its notes', () => {
  const { inst } = loadComponent(FILE);
  for (const c of inst.SONG_CARDS.filter(c => c.homeOctave !== undefined)) {
    const octaves = c.notes.filter(n => n !== null).map(n => inst.splitNote(n).octave);
    const lo = Math.min(...octaves), hi = Math.max(...octaves);
    // A pinned home two octaves clear of every note would mean the source and the data
    // disagree about what the base octave is.
    assert.ok(c.homeOctave >= lo - 1 && c.homeOctave <= hi + 1,
      `${c.id}: pinned home ${c.homeOctave} is nowhere near its notes (${lo}..${hi})`);
  }
});
