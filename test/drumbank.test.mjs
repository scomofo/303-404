// The Drum Bank charts patterns found in other people's work, so its data and the
// provenance printed beside it are claims about the world. These tests guard those
// claims as much as they guard the code: a card that quietly grows an accent row, a
// tempo that stops being labelled an estimate, or a sheet that disagrees with what
// the engine plays are all failures here.

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadComponent, readGuide, renderStep } from './harness.mjs';

const FILE = 'Behringer Setup Guide.dc.html';
const SOURCE_TYPES = ['record', 'literature', 'practice'];

function bank() {
  const loaded = loadComponent(FILE);
  return { ...loaded, cards: loaded.inst.DRUM_CARDS };
}

/** The ● cells a built sheet shows, as { voiceKey: [step, …] }. */
function sheetHits(inst, chart, card) {
  const n = chart.steps;
  const rows = {};
  // cells = [blank, …step numbers, then one label + n cells per voice]
  let i = n + 1;
  for (const v of inst.DRUM_VOICES) {
    i++;                                   // the row's label cell
    const hits = [];
    for (let s = 0; s < n; s++, i++) if (chart.cells[i].text === '●') hits.push(s);
    if (hits.length) rows[v.key] = hits;
  }
  assert.equal(i, chart.cells.length, `${card.id}: sheet has cells the reader did not account for`);
  return rows;
}

test('every card is charted on the 808 row set, at a length the sheet is printed in', () => {
  const { inst, cards } = bank();
  const keys = new Set(inst.DRUM_VOICES.map(v => v.key));
  for (const c of cards) {
    // 808 pattern sheets come in 16- and 32-step versions; anything else has no sheet.
    assert.ok([16, 32].includes(c.steps), `${c.id}: ${c.steps} steps`);
    let sounds = 0;
    for (const [row, hits] of Object.entries(c.rows)) {
      assert.ok(keys.has(row), `${c.id}: row "${row}" is not an 808 voice`);
      assert.ok(Array.isArray(hits) && hits.length, `${c.id}: empty ${row} row should be omitted`);
      for (const i of hits) {
        assert.ok(Number.isInteger(i) && i >= 0 && i < c.steps,
          `${c.id}: ${row} step ${i} outside 0..${c.steps - 1}`);
      }
      assert.deepEqual(hits, [...new Set(hits)].sort((a, b) => a - b),
        `${c.id}: ${row} row is not a sorted set of steps`);
      if (row !== 'ac') sounds += hits.length;
    }
    assert.ok(sounds > 0, `${c.id}: nothing but accents — this card would be silent`);
  }
});

test('card ids are unique and every card names what it came from', () => {
  const { cards } = bank();
  const ids = cards.map(c => c.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate card id');
  for (const c of cards) {
    assert.ok(c.title, `${c.id}: no title`);
    assert.ok(c.tag, `${c.id}: no tag`);
    assert.ok(c.source, `${c.id}: no source — every card must say where its steps came from`);
    assert.ok(c.voicing, `${c.id}: no voicing note — say whether the source was written for this machine`);
    assert.ok(SOURCE_TYPES.includes(c.sourceType), `${c.id}: sourceType ${JSON.stringify(c.sourceType)}`);
    assert.ok(c.bpm > 30 && c.bpm < 220, `${c.id}: implausible tempo ${c.bpm}`);
  }
});

// The whole point of the bank is that it does not fill in what a source left out.
// These are the fields that would be easiest to quietly invent.
test('nothing a source never recorded is filled in', () => {
  const { cards } = bank();
  for (const c of cards) {
    if (c.sourceType === 'practice') continue;
    assert.equal(c.rows.ac, undefined,
      `${c.id}: none of the outside sources record an accent row, so AC must stay empty`);
    for (const field of ['patternNo', 'variation', 'preScale']) {
      assert.equal(c[field], undefined,
        `${c.id}: no source here says where on the machine its pattern was written — leave ${field} unset`);
    }
  }
  // Only the tempos a source actually states are shown as facts.
  const stated = cards.filter(c => c.bpmConfirmed).map(c => c.id);
  assert.deepEqual(stated.sort(),
    ['beat-it-intro', 'confusion', 'four-on-the-floor', 'sexual-healing'],
    'a tempo became a stated fact (or stopped being one) without its source changing');
});

test('an unstated field prints blank on the sheet, and an unstated tempo prints as estimated', () => {
  const { inst, cards } = bank();
  for (const c of cards) {
    const chart = inst.getDrumChart(c);
    for (const f of chart.fields) {
      const expected = { PATTERN: c.patternNo, VARIATION: c.variation, 'PRE-SCALE': c.preScale }[f.label];
      assert.equal(f.value, expected || '—', `${c.id}: ${f.label} box`);
    }
    assert.match(chart.bpmLabel, c.bpmConfirmed ? /^\d+ BPM$/ : /^~\d+ BPM \(estimated\)$/,
      `${c.id}: tempo label "${chart.bpmLabel}"`);
    assert.ok(chart.efxLines.some(l => l.includes(c.source)), `${c.id}: sheet does not print its source`);
  }
});

test('each sheet shows exactly what its card hands the engine', () => {
  const { inst, cards } = bank();
  for (const c of cards) {
    const chart = inst.getDrumChart(c);
    assert.deepEqual(sheetHits(inst, chart, c), c.rows, `${c.id}: sheet and engine data disagree`);
  }
});

// RS/CL and CP/MA are one switch each on the panel, so a card names the side it means
// and both the printed row and the voice that sounds have to follow it.
test('a switch-pair row prints and sounds the side the card names', () => {
  const { inst } = bank();
  const techno = inst.DRUM_CARDS.find(c => c.id === 'minimal-techno');
  assert.equal(techno.pair.cp, 'MA', 'fixture changed: this card is the one that uses the pair');

  const labels = inst.getDrumChart(techno).cells.filter(c => ['CP', 'MA'].includes(c.text));
  assert.deepEqual(labels.map(l => l.text), ['MA'], 'the sheet still prints the row as CP');

  assert.equal(inst.drumVoiceKey('cp', techno.pair), 'ma');
  assert.equal(inst.drumVoiceKey('cp', null), 'cp', 'a card with no pair should get the default voice');
  assert.equal(inst.drumVoiceKey('rs', { cp: 'MA' }), 'rs', 'one pair switch must not move the other');
  assert.equal(inst.drumVoiceKey('rs', { rs: 'CL' }), 'cl');
});

test('every voice the bank can print makes a sound, and accent adds none', () => {
  const { inst, audioCtx } = bank();
  const t = audioCtx.currentTime + 0.1;
  for (const v of inst.DRUM_VOICES) {
    if (v.key === 'ac') continue;
    for (const key of [v.key, v.alt ? v.alt.toLowerCase() : null].filter(Boolean)) {
      assert.ok(inst.playDrumVoice(key, t, 1).length > 0, `voice ${key} scheduled nothing`);
    }
  }
  // AC is a level, not an instrument: on its own it must be silent.
  assert.deepEqual(inst.playDrumStepFor({ ac: [0] }, 0, t, null), []);
});

test('an accented step is played louder than the same step unaccented', () => {
  const { inst, audioCtx } = bank();
  const gainsFor = rows => {
    const before = audioCtx.__created.length;
    inst.playDrumStepFor(rows, 0, audioCtx.currentTime + 0.1, null);
    return audioCtx.__created.slice(before).filter(n => n.kind === 'gain')
      .map(n => n.node.gain.calls[0].v);
  };
  const plain = gainsFor({ bd: [0] });
  const accented = gainsFor({ bd: [0], ac: [0] });
  assert.equal(plain.length, accented.length, 'accent changed how many voices sound');
  assert.ok(accented[0] > plain[0], `accent did not raise the level (${plain[0]} -> ${accented[0]})`);
});

test('loading a card hands the engine that card, its length and its own tempo', () => {
  const { inst } = bank();
  const levee = inst.DRUM_CARDS.find(c => c.id === 'when-the-levee-breaks');
  const techno = inst.DRUM_CARDS.find(c => c.id === 'minimal-techno');

  inst.loadDrumCard(levee);
  assert.equal(inst.state.dbSelected, levee.id);
  assert.deepEqual(inst.state.dbRows, levee.rows);
  assert.equal(inst.state.dbSteps, levee.steps);
  assert.equal(inst.state.dbBpm, levee.bpm);
  assert.equal(inst.state.dbPair, null);

  inst.loadDrumCard(techno);
  assert.deepEqual(inst.state.dbPair, techno.pair, 'the pair switch did not travel with the card');

  // A 71 BPM break and a 128 BPM techno pattern must not run at the same step rate.
  assert.ok(inst.drumStepSec(71) > inst.drumStepSec(128));
  assert.ok(Math.abs(inst.drumStepSec(120) - 0.125) < 1e-9, '120 BPM should be the 125ms grid the RD-6 uses');
});

// Leaving the step used to leave the RD-6 and TD-3 engines running; the drum bank has
// to be wired into the same teardown rather than becoming a fourth thing that isn't.
test('the drum bank stops when you navigate away', () => {
  const { inst } = bank();
  const step = inst.STEPS.findIndex(s => s.widget === 'drumbank');
  inst.loadDrumCard(inst.DRUM_CARDS[0]);
  inst.playDrumBank();
  assert.equal(inst.state.dbPlaying, true, 'nothing was playing to begin with');
  inst.goToStep(0);
  assert.equal(inst.state.dbPlaying, false, 'the bank kept playing after leaving its step');
  assert.equal(inst.state.dbCol, -1);
  assert.deepEqual(Object.keys(inst.sequences), [], 'a sequencer timer survived the navigation');
  assert.ok(step > 0, 'no drum bank step to leave');
});

test('the drum bank step renders a sheet per card and a live view only once loaded', () => {
  const { inst } = bank();
  const step = inst.STEPS.findIndex(s => s.widget === 'drumbank');
  let view = renderStep(inst, step);
  assert.equal(view.drumCards.length, inst.DRUM_CARDS.length);
  assert.equal(view.dbHasCard, false, 'the live view appears before anything is loaded');
  assert.deepEqual(view.dbRowsView, []);

  view.drumCards[1].load();
  view = renderStep(inst, step);
  assert.equal(view.dbHasCard, true);
  const card = inst.DRUM_CARDS[1];
  const voiced = Object.keys(card.rows).length;
  assert.equal(view.dbRowsView.length, voiced, 'the live view shows rows the card never plays');
  for (const row of view.dbRowsView) assert.equal(row.cells.length, card.steps);
  assert.match(view.dbGridStyle, /min-width:\d+px/,
    'without a floor the live rows overflow their column instead of scrolling');
});

test('documentation matches the bank and keeps its provenance honest', () => {
  const { inst, html } = bank();
  const readme = readGuide('README.md');
  assert.match(readme, new RegExp(`${inst.DRUM_CARDS.length} pattern sheets ship by default`),
    'README card count drifted from DRUM_CARDS');
  for (const field of ['DRUM_CARDS', 'sourceType', 'bpmConfirmed', 'pair', 'voicing']) {
    assert.ok(readme.includes(field), `README omits ${field}`);
  }
  // Both places the bank's sources are named have to keep naming them.
  for (const source of ['tr808r', 'GiantSteps']) {
    assert.ok(readme.includes(source), `README omits the ${source} source`);
    assert.ok(inst.DRUM_CARDS.some(c => c.source.includes(source)), `no card cites ${source}`);
  }
  assert.match(html, /does not imply that a pattern was printed on a Roland sheet/,
    'in-app copy presents the shared sheet layout as source provenance');
});
