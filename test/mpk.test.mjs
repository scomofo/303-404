// The MPK Mini MK4 guide's musical logic: scale snapping, chord stacking, the
// arpeggiator, knob assignment, the arrangement's layers and the style presets.
//
// The claims these guard are ones the guide makes in its own copy — "no key can
// produce a wrong note", "always another note of the same chord", "reassigning a
// knob never silently mutes the instrument". A guide that says so and does
// otherwise is worse than one that says nothing.

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadComponent, renderStep } from './harness.mjs';

const MPK = 'MPK Mini MK4 Guide.dc.html';

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, label, timeout = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (fn()) return;
    await sleep(20);
  }
  throw new Error(`timed out after ${timeout}ms waiting for ${label}`);
}

const pitchClass = m => ((m % 12) + 12) % 12;

/** Every (root, scale) pair the guide offers. */
function everyScale(inst) {
  const out = [];
  for (const scale of inst.SCALES) {
    for (let root = 0; root < 12; root++) out.push({ scaleId: scale.id, scaleRoot: root, scale });
  }
  return out;
}

test('pad banks: four banks of eight, every pad unique and playable', () => {
  const { inst } = loadComponent(MPK);
  const voices = new Set(['kick', 'snare', 'noise', 'tone', 'clap']);
  assert.equal(inst.PAD_BANKS.length, 4, 'the course promises 4 banks of 8');
  const seen = new Set();
  for (const bank of inst.PAD_BANKS) {
    assert.equal(bank.pads.length, 8, `bank ${bank.id} does not hold 8 pads`);
    for (const pad of bank.pads) {
      assert.ok(pad.label, `pad ${pad.id} has no label`);
      assert.ok(voices.has(pad.voice), `pad ${pad.id} names an unknown voice "${pad.voice}"`);
      assert.ok(!seen.has(pad.id), `duplicate pad id ${pad.id} — the beat grid is keyed by it`);
      seen.add(pad.id);
      // padById is what the drum scheduler uses to reach a pad in another bank.
      assert.equal(inst.padById(pad.id), pad, `padById cannot find ${pad.id}`);
    }
  }
  assert.equal(seen.size, 32);
});

test('Scale Mode: no key can produce a note outside the scale', () => {
  const { inst } = loadComponent(MPK);
  for (const { scaleId, scaleRoot, scale } of everyScale(inst)) {
    inst.state = { ...inst.state, scaleId, scaleRoot, scaleOn: true };
    const allowed = new Set(scale.steps.map(s => (s + scaleRoot) % 12));
    for (let key = 0; key < 25; key++) {
      for (const octave of [-2, 0, 2]) {
        const pressed = 36 + octave * 12 + key;
        const played = inst.snapToScale(pressed);
        assert.ok(allowed.has(pitchClass(played)),
          `${scaleId} on ${scaleRoot}: key ${pressed} produced ${played}, which is not in the scale`);
      }
    }
  }
});

test('Scale Mode snaps to the NEAREST scale tone, not merely to some scale tone', () => {
  const { inst } = loadComponent(MPK);
  for (const { scaleId, scaleRoot } of everyScale(inst)) {
    inst.state = { ...inst.state, scaleId, scaleRoot, scaleOn: true };
    for (let pressed = 36; pressed < 61; pressed++) {
      const played = inst.snapToScale(pressed);
      const moved = Math.abs(played - pressed);
      for (let d = 1; d < moved; d++) {
        assert.ok(!inst.inScale(pressed - d) && !inst.inScale(pressed + d),
          `${scaleId} on ${scaleRoot}: ${pressed} snapped ${moved} semitones when ${d} would have done`);
      }
    }
  }
});

test('Scale Mode off leaves every key exactly where it was', () => {
  const { inst } = loadComponent(MPK);
  inst.state = { ...inst.state, scaleOn: false, scaleId: 'pent', scaleRoot: 3 };
  const before = inst.state.lastNoteLabel;
  inst.ensureAudio();
  inst.pressKey(1);                       // C#, not in an E-flat pentatonic
  assert.notEqual(inst.state.lastNoteLabel, before);
  assert.doesNotMatch(inst.state.lastNoteLabel, /snapped/,
    'a key was snapped even though Scale Mode is off');
});

test('Chord Mode stacks only scale tones, in every scale and on every degree', () => {
  const { inst } = loadComponent(MPK);
  for (const { scaleId, scaleRoot, scale } of everyScale(inst)) {
    inst.state = { ...inst.state, scaleId, scaleRoot };
    const allowed = new Set(scale.steps.map(s => (s + scaleRoot) % 12));
    for (let degree = 0; degree < scale.steps.length; degree++) {
      const chord = inst.chordMidis(degree);
      assert.equal(chord.length, 3, `${scaleId} degree ${degree} is not a triad`);
      assert.deepEqual(chord.slice().sort((a, b) => a - b), chord,
        `${scaleId} degree ${degree} is not voiced upwards`);
      for (const note of chord) {
        assert.ok(allowed.has(pitchClass(note)),
          `${scaleId} degree ${degree} contains ${note}, outside the scale`);
      }
    }
  }
});

test('Chord Mode voices the chord from the key you pressed', () => {
  const { inst } = loadComponent(MPK);
  inst.state = { ...inst.state, scaleId: 'minor', scaleRoot: 0, scaleOn: true, chordOn: true };
  const low = inst.chordMidis(0, 36);
  const high = inst.chordMidis(0, 48);
  assert.equal(high[0] - low[0], 12, 'chord did not follow the hand up an octave');
  assert.deepEqual(high.map(pitchClass), low.map(pitchClass), 'the chord changed notes, not octave');
});

test('Roman numerals are read off the intervals, not assumed from the degree', () => {
  const { inst } = loadComponent(MPK);
  inst.state = { ...inst.state, scaleId: 'major', scaleRoot: 0 };
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(d => inst.degreeLabel(d)),
    ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']);
  inst.state = { ...inst.state, scaleId: 'minor' };
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6].map(d => inst.degreeLabel(d)),
    ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII']);
  // A five-note scale stacks into shapes the triad numerals cannot name; those
  // are marked rather than mislabelled as majors and minors.
  inst.state = { ...inst.state, scaleId: 'pent' };
  assert.ok(inst.degreeLabel(0).endsWith('*'), 'a non-tertian stack was labelled as a plain triad');
});

test('arpeggiator modes are the orderings they claim to be', () => {
  const { inst } = loadComponent(MPK);
  const chord = inst.chordMidis(0);
  const up = inst.arpSequence(chord, 'up', 2);
  assert.equal(up.length, 6, 'two octaves of a triad is six notes');
  assert.deepEqual(up, up.slice().sort((a, b) => a - b), 'Up is not ascending');

  const down = inst.arpSequence(chord, 'down', 2);
  assert.deepEqual(down, up.slice().reverse(), 'Down is not the reverse of Up');

  const updown = inst.arpSequence(chord, 'updown', 2);
  assert.equal(updown.length, up.length * 2 - 2, 'Up-Down should not repeat its endpoints');
  assert.deepEqual(updown.slice(0, up.length), up);
  assert.notEqual(updown[updown.length - 1], updown[0], 'Up-Down turned back onto its own first note');

  const random = inst.arpSequence(chord, 'random', 2);
  assert.deepEqual(random.slice().sort((a, b) => a - b), up,
    'Random dropped or invented notes rather than reordering them');
});

test('an arp Pattern gates steps without changing the note order', () => {
  const { inst } = loadComponent(MPK);
  const chord = inst.chordMidis(0);
  const straight = inst.arpSequence(chord, 'up', 2);
  for (const pattern of inst.ARP_PATTERNS) {
    inst.state = { ...inst.state, arpPatternId: pattern.id };
    assert.equal(pattern.gate.length, 8, `${pattern.id} is not an 8-step mask`);
    assert.ok(pattern.gate.some(g => g), `${pattern.id} rests every step`);
    assert.deepEqual(inst.arpSequence(chord, 'up', 2), straight,
      `${pattern.id} altered the sequence instead of only silencing steps`);
  }
});

test('Mutate never leaves the held chord, even driven to the edge of the range', t => {
  const { inst } = loadComponent(MPK);
  // C sharp minor deliberately: its chord excludes C, and C is the pitch class
  // at both ends of the playable range. A chord containing C would let a
  // range-clamping bug pass by coincidence.
  inst.state = { ...inst.state, scaleId: 'minor', scaleRoot: 1 };
  const chord = inst.chordMidis(0);
  const allowed = new Set(chord.map(pitchClass));
  assert.ok(!allowed.has(0), 'this test needs a chord that excludes the range boundary note');

  let seq = inst.arpSequence(chord, 'up', 2);
  const start = seq.slice();
  for (let i = 0; i < 200; i++) {
    seq = inst.mutateSequence(seq);
    assert.equal(seq.length, start.length, 'mutation changed the sequence length');
    for (const note of seq) {
      assert.ok(allowed.has(pitchClass(note)), `mutation produced ${note}, outside the chord`);
      assert.ok(note >= 24 && note <= 96, `mutation drifted to ${note}, outside playable range`);
    }
  }
  assert.notDeepEqual(seq, start, '200 mutations changed nothing at all');

  // Then drive one step relentlessly upward. At the top of the range the octave
  // jump has to be abandoned, not clamped: a clamp would land on a note that is
  // not in the chord, which is exactly what "always another note of the same
  // chord" promises cannot happen.
  const realRandom = Math.random;
  t.after(() => { Math.random = realRandom; });
  const queue = [];
  Math.random = () => (queue.length ? queue.shift() : 0);

  let driven = inst.arpSequence(chord, 'up', 2);
  for (let i = 0; i < 20; i++) {
    queue.push(0, 0.1, 0.1, 0);   // step 0, shift up an octave, take the shift branch
    driven = inst.mutateSequence(driven);
    for (const note of driven) {
      assert.ok(allowed.has(pitchClass(note)), `driving upward produced ${note}, outside the chord`);
      assert.ok(note >= 24 && note <= 96, `driving upward escaped the playable range at ${note}`);
    }
  }
  assert.ok(driven.some(n => n > start[0] + 24), 'the driven step never actually climbed');
});

test('Freeze pins the running order across a chord change, and releasing rebuilds it', () => {
  const { inst } = loadComponent(MPK);
  inst.state = { ...inst.state, arpDegree: 0, arpMode: 'up', arpOctaves: 2, arpFreeze: false };
  const first = inst.currentArpSequence();

  inst.state = { ...inst.state, arpFreeze: true, arpDegree: 3 };
  assert.deepEqual(inst.currentArpSequence(), first, 'Freeze did not hold the order');

  inst.state = { ...inst.state, arpFreeze: false };
  const rebuilt = inst.currentArpSequence();
  assert.notDeepEqual(rebuilt, first, 'releasing Freeze did not pick up the new chord');
  assert.deepEqual(rebuilt, inst.arpSequence(inst.chordMidis(3), 'up', 2));
});

test('switching to a shorter scale normalizes the held arp degree, not just the progression', () => {
  const { inst } = loadComponent(MPK);
  inst.setState({ scaleId: 'major', arpDegree: 6, progression: [0, 6, 3, 4] });

  inst.setScale('pent');   // 7-note major -> 5-note pentatonic
  const degrees = inst.SCALES.find(s => s.id === 'pent').steps.length;
  assert.ok(inst.state.arpDegree < degrees,
    `arpDegree ${inst.state.arpDegree} survived the switch to a ${degrees}-note scale`);
  assert.ok(inst.state.progression.every(d => d < degrees),
    'progression was left with a degree outside the new scale');

  // The held-chord button state (Component.arpChordOptions) is built straight
  // off arpDegree, so an out-of-range value would show no button selected even
  // though chordMidis (which wraps) keeps sounding a chord.
  const rendered = renderStep(inst, inst.STEPS.findIndex(s => (s.widgets || []).includes('arp')));
  assert.ok(rendered.arpChordOptions.some(o => o.pressed === 'true'),
    'no held-chord button reads as selected after the scale shrank');
});

test('loading a style normalizes arpDegree against that style\'s own scale', () => {
  const { inst } = loadComponent(MPK);
  inst.ensureAudio();
  inst.setState({ arpDegree: 6 });
  // None of the shipped presets use a scale shorter than 7 notes, so fabricate
  // one rather than waiting for a future preset to reintroduce this bug.
  const style = { ...inst.STYLES[0], scale: 'pent', progression: [0, 1, 2, 3] };
  inst.loadStyle(style);
  const degrees = inst.SCALES.find(s => s.id === 'pent').steps.length;
  assert.ok(inst.state.arpDegree < degrees,
    `loadStyle left arpDegree ${inst.state.arpDegree} outside its own ${degrees}-note scale`);
});

test('a knob drives the live graph, and an unassigned target falls back to its default', () => {
  const { inst } = loadComponent(MPK);
  inst.ensureAudio();
  assert.equal(inst.state.knobTargets[0], 'cutoff', 'knob 1 is expected to start on Filter Cutoff');

  const before = inst.synthIn.frequency.value;
  inst.stepKnob(0, 0.25);
  assert.ok(inst.synthIn.frequency.value > before,
    'turning the cutoff knob up did not open the filter');

  const q = inst.synthIn.Q.value;
  const resIdx = inst.state.knobTargets.indexOf('resonance');
  inst.stepKnob(resIdx, 0.25);
  assert.ok(inst.synthIn.Q.value > q, 'the resonance knob did not reach the filter');

  // Reassigning the only knob pointing at cutoff must not drop it to zero — a
  // silent instrument is the failure mode this fallback exists to prevent.
  inst.cycleKnobTarget(0);
  assert.ok(!inst.state.knobTargets.includes('cutoff'), 'test needs cutoff left unassigned');
  const def = inst.KNOB_TARGETS.find(t => t.id === 'cutoff').def;
  assert.equal(inst.knobValue('cutoff'), def);
  assert.ok(Math.abs(inst.synthIn.frequency.value - 200 * Math.pow(60, def)) < 1e-6,
    'an unassigned cutoff did not fall back to its default');
});

test('two knobs on the same target: the one turned most recently wins, and neither goes dead', () => {
  const { inst } = loadComponent(MPK);
  inst.ensureAudio();
  // Force knobs 1 and 2 onto the same target — legal, the same as MIDI-Learning
  // two CCs onto one plugin control.
  inst.setState({ knobTargets: ['cutoff', 'cutoff', ...inst.state.knobTargets.slice(2)] });

  inst.stepKnob(1, 0.25);
  assert.equal(inst.knobValue('cutoff'), inst.state.knobs[1],
    'turning knob 2 did not take control of the shared target');
  assert.ok(Math.abs(inst.synthIn.frequency.value - 200 * Math.pow(60, inst.state.knobs[1])) < 1e-6,
    'knob 2 turned but never reached the audio graph — the dead-knob bug');

  inst.stepKnob(0, 0.25);
  assert.equal(inst.knobValue('cutoff'), inst.state.knobs[0],
    'turning knob 1 afterward did not take control back');
  assert.ok(Math.abs(inst.synthIn.frequency.value - 200 * Math.pow(60, inst.state.knobs[0])) < 1e-6,
    'knob 1 turned but never reached the audio graph');
});

test('reassigning a knob is not turning it — it must not steal control on arrival', () => {
  const { inst } = loadComponent(MPK);
  inst.ensureAudio();
  // Give knob 2 (resonance) a HIGHER moved count than knob 1 (cutoff) before
  // either ever touches cutoff, so only the reset-on-reassign behaviour below
  // can decide who controls cutoff once knob 2 arrives there.
  inst.stepKnob(0, 0.1);   // knob 1 (cutoff):    knobMoved = [1, 0, ...]
  inst.stepKnob(1, 0.1);   // knob 2 (resonance): knobMoved = [1, 2, ...]

  // Cycle knob 2 all the way around KNOB_TARGETS to land back on cutoff
  // without ever calling stepKnob — a pure reassignment.
  const targetCount = inst.KNOB_TARGETS.length;
  const startIdx = inst.KNOB_TARGETS.findIndex(t => t.id === 'resonance');
  const cutoffIdx = inst.KNOB_TARGETS.findIndex(t => t.id === 'cutoff');
  for (let i = 0; i < ((cutoffIdx - startIdx + targetCount) % targetCount || targetCount); i++) {
    inst.cycleKnobTarget(1);
  }
  assert.equal(inst.state.knobTargets[1], 'cutoff', 'test needs knob 2 back on cutoff');

  assert.equal(inst.knobValue('cutoff'), inst.state.knobs[0],
    'reassigning knob 2 onto cutoff stole control from knob 1, which was actually turned there');
});

test('the beat grid stores velocities, and re-clicking at the same velocity erases', () => {
  const { inst } = loadComponent(MPK);
  inst.setState({ velocity: 48 });
  inst.toggleBeatCell('a-tom', 3);
  assert.equal(inst.state.beat['a-tom'][3], 48, 'the cell did not record the soft velocity');

  inst.setState({ velocity: 127 });
  inst.toggleBeatCell('a-tom', 3);
  assert.equal(inst.state.beat['a-tom'][3], 127, 'a louder click should rewrite, not erase');

  inst.toggleBeatCell('a-tom', 3);
  assert.equal(inst.state.beat['a-tom'][3], 0, 'the same velocity twice should erase');
});

test("the starting beat already varies its velocities — Week 2's milestone", () => {
  const { inst } = loadComponent(MPK);
  const beat = inst.initialState().beat;
  const hits = Object.values(beat).flat().filter(v => v > 0);
  assert.ok(hits.length > 8, 'the starting beat is too sparse to practise on');
  assert.ok(new Set(hits).size > 1,
    'every hit in the starting beat is the same velocity, which is the habit Week 2 exists to break');
  assert.ok(hits.every(v => v > 0 && v <= 127), 'a velocity outside 1-127 was written');
});

test('style presets only reference things that exist', () => {
  const { inst } = loadComponent(MPK);
  const scaleIds = new Set(inst.SCALES.map(s => s.id));
  const modeIds = new Set(inst.ARP_MODES.map(m => m.id));
  const patternIds = new Set(inst.ARP_PATTERNS.map(p => p.id));
  const rates = new Set(inst.ARP_RATES.map(r => r.value));
  const octaveCounts = new Set(inst.ARP_OCTAVES.map(o => o.value));
  const swings = new Set(inst.SWING_AMOUNTS.map(s => s.value));

  for (const style of inst.STYLES) {
    assert.ok(scaleIds.has(style.scale), `${style.id}: unknown scale ${style.scale}`);
    assert.ok(modeIds.has(style.arpMode), `${style.id}: unknown arp mode`);
    assert.ok(patternIds.has(style.arpPattern), `${style.id}: unknown arp pattern`);
    assert.ok(rates.has(style.arpRate), `${style.id}: an arp rate the segmented control cannot show`);
    assert.ok(octaveCounts.has(style.arpOctaves), `${style.id}: an octave range the control cannot show`);
    assert.ok(swings.has(style.swing), `${style.id}: a swing amount the control cannot show`);
    // The tempo stepper clamps to 60-180, so a preset outside it could never be
    // restored by hand after you nudged it.
    assert.ok(style.tempo >= 60 && style.tempo <= 180, `${style.id}: tempo ${style.tempo} is outside the stepper`);
    assert.ok(style.root >= 0 && style.root < 12, `${style.id}: root out of range`);
    assert.ok(inst.PAD_BANKS[style.bank], `${style.id}: bank ${style.bank} does not exist`);

    const degrees = inst.SCALES.find(s => s.id === style.scale).steps.length;
    for (const d of style.progression) {
      assert.ok(d >= 0 && d < degrees, `${style.id}: degree ${d} is outside a ${degrees}-note scale`);
    }
    for (const padId of Object.keys(style.beat)) {
      const pad = inst.padById(padId);
      assert.ok(pad, `${style.id}: writes to unknown pad ${padId}`);
      for (const [stepIdx, vel] of style.beat[padId]) {
        assert.ok(stepIdx >= 0 && stepIdx < 16, `${style.id}: step ${stepIdx} is off the bar`);
        assert.ok(vel > 0 && vel <= 127, `${style.id}: velocity ${vel} out of range`);
      }
    }
  }
});

test('loading a style rewrites every control it claims to', () => {
  const { inst } = loadComponent(MPK);
  const trap = inst.STYLES.find(s => s.id === 'trap');
  inst.ensureAudio();
  inst.loadStyle(trap);
  assert.equal(inst.state.tempo, trap.tempo);
  assert.equal(inst.state.swing, trap.swing);
  assert.equal(inst.state.padBank, trap.bank);
  assert.equal(inst.state.scaleId, trap.scale);
  assert.equal(inst.state.scaleRoot, trap.root);
  assert.deepEqual(inst.state.progression, trap.progression);
  assert.equal(inst.state.arpMode, trap.arpMode);
  assert.equal(inst.state.arpPatternId, trap.arpPattern);
  assert.deepEqual(Object.keys(inst.state.beat), Object.keys(trap.beat),
    'the old grid survived a style load');
  // The grid it loads must be playable by the drum scheduler, not just stored.
  for (const padId of Object.keys(inst.state.beat)) {
    assert.equal(inst.state.beat[padId].length, 16);
    assert.ok(inst.padById(padId));
  }
});

test('the arrangement covers every bar exactly once', () => {
  const { inst } = loadComponent(MPK);
  const known = new Set(['drums', 'chords', 'arp']);
  const total = inst.songTotalBars();
  assert.ok(total > 0);

  const counted = new Array(inst.SONG_SECTIONS.length).fill(0);
  for (let bar = 0; bar < total; bar++) counted[inst.sectionIndexForBar(bar)]++;
  assert.deepEqual(counted, inst.SONG_SECTIONS.map(s => s.bars),
    'a bar landed in the wrong section, or in none');

  for (const section of inst.SONG_SECTIONS) {
    assert.ok(section.layers.length > 0, `${section.id} plays nothing at all`);
    for (const layer of section.layers) {
      assert.ok(known.has(layer), `${section.id} names an unknown layer "${layer}"`);
    }
  }
  // The whole point of the section map is that the parts do not all play at once.
  const shapes = new Set(inst.SONG_SECTIONS.map(s => s.layers.join('+')));
  assert.ok(shapes.size > 1, 'every section plays the same layers — that is a loop, not an arrangement');
});

test('the arrangement plays only the layers its current section names', async t => {
  const { inst, dispose } = loadComponent(MPK);
  t.after(dispose);
  const calls = { chords: 0, arp: 0, drums: 0 };
  inst.scheduleChord = () => { calls.chords++; return []; };
  inst.scheduleSongArp = () => { calls.arp++; return []; };
  inst.scheduleDrums = () => { calls.drums++; return []; };

  assert.deepEqual(inst.sectionForBar(0).layers, ['drums'], 'this test assumes a drums-only intro');
  inst.playSong();
  await until(() => calls.drums >= 3, 'the intro to schedule some drum steps');
  assert.equal(calls.chords, 0, 'a chord was scheduled during the drums-only intro');
  assert.equal(calls.arp, 0, 'the arp was scheduled during the drums-only intro');

  // Jump the scheduler into the full section and the other two layers must appear.
  inst.songBarRef = inst.SONG_SECTIONS[0].bars + inst.SONG_SECTIONS[1].bars;
  await until(() => calls.arp > 0, 'the main section to schedule the arp');
  inst.stopAll();
  assert.ok(calls.arp > 0);
});

test('every widget a step names actually renders something', () => {
  const { inst } = loadComponent(MPK);
  // A step naming a widget the renderer does not know would silently show
  // nothing; so would a typo in a show* flag. Both used to be invisible.
  const OUTPUT = {
    cables: (v, flags) => flags.showCables && v.cablesList.length > 0,
    lessons: (v, flags) => flags.showLessons && v.lessons.length > 0,
    layout: (v, flags) => flags.showLayout && v.layoutParts.length > 0,
    tempo: (v, flags) => flags.showTempo && !!v.tempoCtl && v.swingOptions.length > 0,
    pads: (v, flags) => flags.showPads && v.padRows.length > 0,
    beat: (v, flags) => flags.showBeat && v.beatRows.length > 0,
    scale: (v, flags) => flags.showScale && v.scaleOptions.length > 0,
    keys: (v, flags) => flags.showKeys && v.whiteKeys.length > 0 && v.blackKeys.length > 0,
    chord: (v, flags) => flags.showChord && v.progSlots.length > 0,
    arp: (v, flags) => flags.showArp && v.arpChordOptions.length > 0 && v.arpControls.length > 0,
    knobs: (v, flags) => flags.showKnobs && v.knobRows.length > 0,
    song: (v, flags) => flags.showSong && v.songSections.length > 0,
    styles: (v, flags) => flags.showStyles && v.styleCards.length > 0,
  };

  let widgetsSeen = 0;
  inst.STEPS.forEach((step, i) => {
    const vals = renderStep(inst, i);
    for (const widget of step.widgets || []) {
      assert.ok(OUTPUT[widget], `step ${step.id} names widget "${widget}", which nothing renders`);
      assert.ok(OUTPUT[widget](vals, vals.currentStep), `step ${step.id}: widget "${widget}" rendered empty`);
      widgetsSeen++;
    }
    // A widget the step did not ask for must stay off, or every step would
    // carry every control.
    for (const widget of Object.keys(OUTPUT)) {
      if ((step.widgets || []).includes(widget)) continue;
      const flag = `show${widget[0].toUpperCase()}${widget.slice(1)}`;
      assert.ok(!(vals.currentStep || {})[flag], `step ${step.id} shows "${widget}" without asking for it`);
    }
  });
  assert.ok(widgetsSeen >= 12, `only ${widgetsSeen} widget placements found`);
  // Every widget the renderer supports should be used somewhere in the course.
  const used = new Set(inst.STEPS.flatMap(s => s.widgets || []));
  for (const widget of Object.keys(OUTPUT)) {
    assert.ok(used.has(widget), `nothing in the course uses the "${widget}" widget`);
  }
});

test('every lesson names a source and a week the course actually has', () => {
  const { inst } = loadComponent(MPK);
  const weeks = new Set(inst.STEPS.map(s => s.weekTag));
  assert.ok(inst.LESSONS.length > 0);
  const ids = new Set();
  for (const lesson of inst.LESSONS) {
    for (const field of ['title', 'source', 'kind', 'covers', 'week']) {
      assert.ok(lesson[field], `lesson ${lesson.id} has no ${field}`);
    }
    assert.ok(weeks.has(lesson.week), `lesson ${lesson.id} points at "${lesson.week}", which is not a week of this course`);
    assert.ok(!ids.has(lesson.id), `duplicate lesson id ${lesson.id}`);
    ids.add(lesson.id);
    // Titles rather than links is a deliberate choice the guide explains; a
    // bare URL here would be a broken promise as much as a broken link.
    assert.doesNotMatch(lesson.title, /https?:/, `lesson ${lesson.id} carries a URL in its title`);
  }
});
