// Cross-cutting regression guards for prior review findings:
// stale handoff counts, missing CSP/SRI, cymbal noise-buffer sizing,
// shared-runtime rebuild markers, and license/attribution files.

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { GUIDES, loadComponent, readGuide } from './harness.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

test('handoff module counts track the built courses', () => {
  const doc = readGuide('docs/HANDOFF_MODULES_1_4.md');
  const { inst: beh, dispose: db } = loadComponent('Behringer Setup Guide.dc.html');
  const { inst: hyb, dispose: dh } = loadComponent('Hybrid Live Set.dc.html');
  try {
    assert.match(doc, new RegExp(`${beh.STEPS.length} steps`),
      'HANDOFF Behringer step count drifted');
    assert.match(doc, new RegExp(`${beh.SONG_CARDS.length} Song Bank cards`),
      'HANDOFF Song Bank count drifted');
    assert.match(doc, new RegExp(`${hyb.STEPS.length} total steps`),
      'HANDOFF Hybrid step count drifted');
    const intros = hyb.STEPS.filter(s => s.kind === 'weekintro').length;
    assert.match(doc, new RegExp(`${intros} week-intro steps`),
      'HANDOFF Hybrid week-intro count drifted');
  } finally {
    db();
    dh();
  }
});

test('every guide declares the documented CSP baseline', () => {
  for (const guide of GUIDES) {
    const html = readGuide(guide.file);
    assert.match(html, /http-equiv="Content-Security-Policy"/,
      `${guide.name}: missing CSP meta`);
    assert.match(html, /https:\/\/unpkg\.com/,
      `${guide.name}: CSP does not allowlist unpkg`);
    assert.match(html, /'unsafe-eval'/,
      `${guide.name}: CSP must document required unsafe-eval for new Function runtime`);
    // The design system pulls its faces from Google Fonts via @import; a CSP
    // that omits either host silently drops every typeface to the system stack.
    assert.match(html, /style-src[^;]*https:\/\/fonts\.googleapis\.com/,
      `${guide.name}: CSP style-src must allow fonts.googleapis.com or the @import is blocked`);
    assert.match(html, /font-src[^;]*https:\/\/fonts\.gstatic\.com/,
      `${guide.name}: CSP font-src must allow fonts.gstatic.com`);
  }
});

// Four guides once carried verbatim copies of the DCCourseLogic navigation,
// dialog, checklist and persistence methods, and the copies drifted (dropping
// the stopEngines/onRestart hooks). Only the two hooks may be redefined.
test('no guide re-declares a DCCourseLogic base method', () => {
  const shared = readFileSync(join(ROOT, 'support.js'), 'utf8')
    .match(/\/\* __DC_COURSE_SHARED_START__ \*\/([\s\S]*?)\/\* __DC_COURSE_SHARED_END__ \*\//)[1];
  const baseMethods = [...shared.matchAll(/^      ([a-zA-Z]+)\([^)]*\) \{/gm)].map(m => m[1])
    .filter(name => !['stopEngines', 'onRestart', 'componentWillUnmount', 'toggleCable', 'buildCables'].includes(name));
  assert.ok(baseMethods.includes('goToStep') && baseMethods.includes('enablePersistence'));
  for (const guide of GUIDES) {
    const html = readGuide(guide.file);
    for (const name of baseMethods) {
      assert.ok(!new RegExp(`^  ${name}\\(`, 'm').test(html),
        `${guide.name}: re-declares DCCourseLogic.${name}; use the base or the stopEngines/onRestart hooks`);
    }
  }
});

test('a browser without Web Audio gets a visible notice, not a TypeError', () => {
  const cases = [
    ['Behringer Setup Guide.dc.html', inst => inst.playRd6()],
    ['DDJ-FLX4 Guide.dc.html', inst => inst.startEngine()],
    ['MPK Mini MK4 Guide.dc.html', inst => inst.playBeat()],
    ['SampleCircuit Guide.dc.html', inst => inst.startTransport()],
  ];
  const { store, restore } = stubStorage();
  try {
    for (const [file, play] of cases) {
      const { inst, dispose } = loadComponent(file);
      try {
        inst.audioCtx = null;
        globalThis.window = {};
        assert.doesNotThrow(() => play(inst), `${file}: play must not throw without Web Audio`);
        assert.equal(inst.ensureAudio(), null);
        assert.match(inst.state.audioError || '', /Web Audio/, `${file}: audioError not reported`);
        assert.equal(inst.renderVals().hasAudioError, true, `${file}: notice not exposed to the template`);
        inst.saveProgress();
        assert.ok(!('audioError' in JSON.parse(store.get(inst.persistenceKey)).state), `${file}: audioError leaked into storage`);
      } finally {
        dispose();
      }
    }
  } finally {
    restore();
  }
});

test('unmount flushes progress and detaches the persistence listeners', () => {
  const { store, restore } = stubStorage();
  const prevWindow = globalThis.window, prevDoc = globalThis.document;
  try {
    const { inst, dispose } = loadComponent('Hybrid Live Set.dc.html');
    try {
      const removed = [];
      globalThis.window = { ...globalThis.window, removeEventListener: (type) => removed.push(type) };
      globalThis.document = { ...globalThis.document, removeEventListener: (type) => removed.push(type) };
      inst.__persistHideHook = () => {};
      inst.__persistVisHook = () => {};
      inst.state = { ...inst.state, step: 4 };
      inst.componentWillUnmount();
      assert.deepEqual(removed.sort(), ['pagehide', 'visibilitychange']);
      assert.equal(inst.__persistHideHook, null);
      assert.equal(inst.__persistVisHook, null);
      assert.equal(JSON.parse(store.get(inst.persistenceKey)).state.step, 4, 'unmount must flush the pending save');
    } finally {
      dispose();
    }
  } finally {
    globalThis.window = prevWindow;
    globalThis.document = prevDoc;
    restore();
  }
});

test('support.js pins SRI for unpkg React/Babel', () => {
  const js = readFileSync(join(ROOT, 'support.js'), 'utf8');
  for (const name of ['REACT_SRI', 'REACT_DOM_SRI', 'BABEL_SRI']) {
    assert.match(js, new RegExp(`${name} = "sha384-`),
      `support.js: ${name} SRI missing`);
  }
  assert.match(js, /s\.integrity = babel\.integrity/,
    'support.js: babel integrity not applied');
  assert.match(js, /loadScript\(react\.src, react\.integrity\)/,
    'support.js: react integrity not applied');
});

test('shared course-logic markers survive in support.js', () => {
  const js = readFileSync(join(ROOT, 'support.js'), 'utf8');
  assert.match(js, /__DC_COURSE_SHARED_START__/,
    'support.js: shared START marker missing — rebuild dropped hand-maintained block');
  assert.match(js, /__DC_COURSE_SHARED_END__/,
    'support.js: shared END marker missing');
  assert.match(js, /makeCourseLogicBase/,
    'support.js: course base missing');
});

test('RD-6 noise buffer covers the longest noise voice', () => {
  // Longest voice today is CY at duration 1s (+0.02 stop tail in playNoise).
  // ensureAudio allocates 1.1s. If either side changes, this fails loudly
  // instead of truncating the cymbal tail (the PR #14 regression).
  const html = readGuide('Behringer Setup Guide.dc.html');
  const bufMatch = html.match(/sampleRate \* ([\d.]+)/);
  assert.ok(bufMatch, 'noise buffer allocation not found');
  const bufferSeconds = Number(bufMatch[1]);
  const durations = [...html.matchAll(/playNoise\(t[^)]*duration:\s*([\d.]+)/g)]
    .map(m => Number(m[1]));
  assert.ok(durations.length > 0, 'no playNoise durations found');
  const longest = Math.max(...durations);
  assert.ok(bufferSeconds >= longest + 0.02,
    `noise buffer ${bufferSeconds}s does not cover longest voice ${longest}s + 0.02 tail`);

  // And the engine's allocator agrees the buffer outlasts the tail.
  // (harness pre-seeds a 128-sample stub buffer, so clear it first to
  // exercise the real ensureAudio() path, which builds via window.AudioContext.)
  const { inst, audioCtx, dispose } = loadComponent('Behringer Setup Guide.dc.html');
  try {
    inst.audioCtx = null;
    inst.noiseBuffer = null;
    inst.ensureAudio();
    const dur = inst.noiseBuffer.duration ?? (inst.noiseBuffer.length / audioCtx.sampleRate);
    assert.ok(dur >= longest + 0.02,
      `built noise buffer ${dur}s shorter than longest voice tail`);
  } finally {
    dispose();
  }
});

test('license and attribution files exist', () => {
  assert.ok(existsSync(join(ROOT, 'LICENSE')), 'LICENSE missing');
  assert.ok(existsSync(join(ROOT, 'THIRD-PARTY-NOTICES.md')),
    'THIRD-PARTY-NOTICES.md missing');
  const lic = readFileSync(join(ROOT, 'LICENSE'), 'utf8');
  assert.match(lic, /MIT License/, 'LICENSE is not MIT');
  const notices = readFileSync(join(ROOT, 'THIRD-PARTY-NOTICES.md'), 'utf8');
  assert.match(notices, /tr808r/, 'notices omit tr808r');
  assert.match(notices, /GiantSteps/, 'notices omit GiantSteps');
});

const PERSIST_KEYS = {
  'Behringer Setup Guide.dc.html': '303-404/behringer/v1',
  'DDJ-FLX4 Guide.dc.html': '303-404/ddj-flx4/v1',
  'Hybrid Live Set.dc.html': '303-404/hybrid/v1',
  'MPK Mini MK4 Guide.dc.html': '303-404/mpk-mini-mk4/v1',
  'SampleCircuit Guide.dc.html': '303-404/sample-circuit/v1',
  'TR-06 Guide.dc.html': '303-404/tr06/v1',
};

function stubStorage() {
  const store = new Map();
  const prev = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: k => { store.delete(k); },
  };
  return { store, restore: () => {
    if (prev === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = prev;
  } };
}

test('every guide exposes a namespaced persistence key', () => {
  for (const guide of GUIDES) {
    const { inst, dispose } = loadComponent(guide.file);
    try {
      assert.equal(inst.persistenceKey, PERSIST_KEYS[guide.file],
        `${guide.name}: persistenceKey should be ${PERSIST_KEYS[guide.file]}`);
      assert.equal(inst.persistenceVersion, 1, `${guide.name}: version should start at 1`);
      assert.ok(typeof inst.saveProgress === 'function', `${guide.name}: missing saveProgress`);
      assert.ok(typeof inst.loadProgress === 'function', `${guide.name}: missing loadProgress`);
      assert.ok(typeof inst.enablePersistence === 'function', `${guide.name}: missing enablePersistence`);
    } finally {
      dispose();
    }
  }
});

test('persistence round-trips learner state and drops transients', () => {
  const { store, restore } = stubStorage();
  try {
    const { inst, dispose } = loadComponent('Hybrid Live Set.dc.html');
    try {
      inst.state = { ...inst.state, step: 7, checks: { 'w2-1': [true] }, muteRd6: true, perfmapSel: 3,
        dialogOpen: true /* transient: must not persist */ };
      inst.saveProgress();
      const saved = JSON.parse(store.get(inst.persistenceKey));
      assert.equal(saved.version, 1);
      assert.equal(saved.state.step, 7);
      assert.equal(saved.state.muteRd6, true);
      assert.ok(!('dialogOpen' in saved.state), 'dialogOpen leaked into storage');

      const second = loadComponent('Hybrid Live Set.dc.html');
      try {
        assert.equal(second.inst.state.step, 7, 'step did not hydrate');
        assert.deepEqual(second.inst.state.checks, { 'w2-1': [true] });
        assert.equal(second.inst.state.muteRd6, true);
        assert.equal(second.inst.state.dialogOpen, false, 'dialogOpen must hydrate false');
      } finally {
        second.dispose();
      }
    } finally {
      dispose();
    }
  } finally {
    restore();
  }
});

test('transient playback and recorder state never reaches storage', () => {
  const cases = [
    ['Behringer Setup Guide.dc.html', { rd6Playing: true, rd6PlayKind: 'chain', rd6PatIdx: 1, rd6Col: 3 }, ['rd6Playing', 'rd6PlayKind', 'rd6PatIdx', 'rd6Col']],
    ['MPK Mini MK4 Guide.dc.html', { padSel: 'p1', lastNoteLabel: 'Played C4' }, ['padSel', 'lastNoteLabel']],
    ['DDJ-FLX4 Guide.dc.html', { recording: true, recordedSeconds: 4, recordingReady: true }, ['recording', 'recordedSeconds', 'recordingReady']],
  ];
  for (const [file, patch, keys] of cases) {
    const { store, restore } = stubStorage();
    try {
      const { inst, dispose } = loadComponent(file);
      try {
        inst.state = { ...inst.state, ...patch };
        inst.saveProgress();
        const saved = JSON.parse(store.get(inst.persistenceKey));
        for (const k of keys) assert.ok(!(k in saved.state), `${file}: ${k} leaked into storage`);
      } finally {
        dispose();
      }
    } finally {
      restore();
    }
  }
});

test('DDJ recorder is discarded by a step change and released by Start Over', () => {
  const { inst, dispose } = loadComponent('DDJ-FLX4 Guide.dc.html');
  try {
    inst.toggleRecording();
    assert.equal(inst.state.recording, true);
    inst.goNext();
    assert.equal(inst.state.recording, false, 'step change must stop an in-progress recording');
    assert.equal(inst.state.recordingReady, false);
    inst.toggleRecording();
    inst.toggleRecording();
    assert.ok(inst.lastRecording, 'a completed drill is kept');
    inst.restart();
    assert.equal(inst.lastRecording, null, 'Start Over must release the recorded buffer');
    assert.equal(inst.state.recording, false);
  } finally {
    dispose();
  }
});

test('SampleCircuit slice edits to bundled cards survive a reload', () => {
  const { store, restore } = stubStorage();
  try {
    const { inst, dispose } = loadComponent('SampleCircuit Guide.dc.html');
    let edited;
    try {
      inst.state = { ...inst.state, selectedCardId: 'SL-001', sensitivity: 70 };
      inst.autoSliceSelected();
      edited = inst.selectedCard().slices.map(sl => [sl.start, sl.end]);
      assert.ok(edited.length >= 2);
      inst.saveProgress();
      assert.ok(JSON.parse(store.get(inst.persistenceKey)).state.sliceEdits['SL-001'], 'slice edits not stored');
    } finally {
      dispose();
    }
    const second = loadComponent('SampleCircuit Guide.dc.html');
    try {
      const card = second.inst.SLICE_CARDS.find(c => c.id === 'SL-001');
      assert.deepEqual(card.slices.map(sl => [sl.start, sl.end]), edited, 'slices did not hydrate');
      assert.equal(card.autoSliced, true);
    } finally {
      second.dispose();
    }
  } finally {
    restore();
  }
});

test('persistence ignores version mismatch and clamps step', () => {
  const { store, restore } = stubStorage();
  try {
    store.set('303-404/hybrid/v1', JSON.stringify({ version: 999, state: { step: 3 } }));
    const bad = loadComponent('Hybrid Live Set.dc.html');
    try {
      assert.equal(bad.inst.state.step, 0, 'version mismatch should not hydrate');
    } finally {
      bad.dispose();
    }
    store.set('303-404/hybrid/v1', JSON.stringify({ version: 1, state: { step: 9999 } }));
    const clamped = loadComponent('Hybrid Live Set.dc.html');
    try {
      assert.ok(clamped.inst.state.step <= clamped.inst.STEPS.length - 1, 'step not clamped');
    } finally {
      clamped.dispose();
    }
  } finally {
    restore();
  }
});

test('persistence never stores audio nodes or timers', () => {
  const { store, restore } = stubStorage();
  try {
    const { inst, dispose } = loadComponent('Behringer Setup Guide.dc.html');
    try {
      inst.state = { ...inst.state, step: 4, rd6Playing: true, rd6Col: 9, sbPlaying: true };
      inst.saveProgress();
      const saved = JSON.parse(store.get(inst.persistenceKey));
      for (const k of ['rd6Playing', 'rd6Col', 'sbPlaying', 'sbCol', 'dbPlaying', 'dbCol']) {
        assert.ok(!(k in saved.state), `${k} leaked into storage`);
      }
      assert.equal(saved.state.step, 4);
      assert.ok(JSON.stringify(saved.state).length < 20000, 'snapshot unexpectedly large');
    } finally {
      dispose();
    }
  } finally {
    restore();
  }
});

test('static smoke: externals are https, timeline and uploads documented', () => {
  for (const guide of GUIDES) {
    const html = readGuide(guide.file);
    assert.doesNotMatch(html, /http:\/\/unpkg\.com/, `${guide.name}: insecure CDN URL`);
    assert.doesNotMatch(html, /src="http:\/\//, `${guide.name}: insecure script src`);
  }
  const hybrid = readGuide('Hybrid Live Set.dc.html');
  assert.match(hybrid, /data-performance-timeline="true"/, 'hybrid timeline marker missing');
  assert.match(hybrid, /tabIndex="0"/, 'hybrid timeline not focusable');
  assert.match(hybrid, /role="region"/, 'hybrid timeline missing region role');
  assert.match(hybrid, /overflow-x:auto/, 'hybrid timeline missing horizontal scroll');
  const readme = readGuide('README.md');
  assert.match(readme, /uploads\//, 'README does not document uploads/');
  assert.match(readme, /Persistence contract/, 'README missing persistence contract');
});
