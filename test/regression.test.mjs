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
