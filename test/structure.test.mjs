// Structural guarantees that hold for both guides.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { GUIDES, loadComponent, readGuide, renderStep, stepIndices } from './harness.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

for (const guide of GUIDES) {
  test(`${guide.name}: every step renders`, () => {
    const { inst } = loadComponent(guide.file);
    assert.ok(inst.STEPS.length > 0, 'no steps built');
    for (const i of stepIndices(inst)) {
      // A step whose widget has no builder wired up throws here rather than in a
      // user's browser — this is the check the ad-hoc harness used to do by hand.
      const vals = renderStep(inst, i);
      assert.ok(vals.currentStep || vals.isOverview || vals.isComplete || vals.isWeekIntro,
        `step ${i} (${inst.STEPS[i].id}) produced no renderable view-model`);
    }
  });

  test(`${guide.name}: step ids and nav labels are unique and non-empty`, () => {
    const { inst } = loadComponent(guide.file);
    const ids = inst.STEPS.map(s => s.id);
    assert.equal(new Set(ids).size, ids.length, 'duplicate step id');
    for (const s of inst.STEPS) {
      assert.ok(s.id && s.weekTag, `step ${s.id} missing id or weekTag`);
      assert.ok(s.title || s.navLabel, `step ${s.id} has no title or navLabel`);
    }
  });

  test(`${guide.name}: progress never exceeds its bounds`, () => {
    const { inst } = loadComponent(guide.file);
    for (const i of stepIndices(inst)) {
      const v = renderStep(inst, i);
      assert.ok(v.progressPct >= 0 && v.progressPct <= 100, `step ${i}: progress ${v.progressPct}`);
      assert.equal(v.stepNumber, i + 1);
      assert.equal(v.totalSteps, inst.STEPS.length);
    }
  });

  test(`${guide.name}: course map reaches every step exactly once`, () => {
    const { inst } = loadComponent(guide.file);
    const listed = renderStep(inst, 0).navGroups.flatMap(g => g.items);
    assert.equal(listed.length, inst.STEPS.length, 'course map does not list every step');
  });

  test(`${guide.name}: course map owns focus until it closes`, t => {
    const { inst, html } = loadComponent(guide.file);
    const previousQuery = document.querySelector;
    const previousActive = document.activeElement;
    t.after(() => {
      document.querySelector = previousQuery;
      document.activeElement = previousActive;
    });

    const focusable = name => ({
      name,
      isConnected: true,
      focus() { document.activeElement = this; },
    });
    const trigger = focusable('trigger');
    const first = focusable('first');
    const last = focusable('last');
    const dialog = {
      ...focusable('dialog'),
      querySelectorAll() { return [first, last]; },
    };
    document.querySelector = selector => selector === '[data-course-map-dialog="true"]' ? dialog : null;
    document.activeElement = trigger;

    const view = renderStep(inst, 0);
    view.openDialog();
    assert.equal(inst.state.dialogOpen, true, 'opening did not set modal state');
    assert.equal(document.activeElement, first, 'focus did not move into the dialog');

    const key = (name, shiftKey = false) => ({
      key: name,
      shiftKey,
      currentTarget: dialog,
      prevented: false,
      preventDefault() { this.prevented = true; },
    });

    last.focus();
    const forward = key('Tab');
    view.dialogKeydown(forward);
    assert.equal(forward.prevented, true, 'Tab escaped past the final control');
    assert.equal(document.activeElement, first, 'Tab did not wrap to the first control');

    first.focus();
    const backward = key('Tab', true);
    view.dialogKeydown(backward);
    assert.equal(backward.prevented, true, 'Shift+Tab escaped before the first control');
    assert.equal(document.activeElement, last, 'Shift+Tab did not wrap to the final control');

    const escape = key('Escape');
    view.dialogKeydown(escape);
    assert.equal(escape.prevented, true, 'Escape was not handled');
    assert.equal(inst.state.dialogOpen, false, 'Escape did not close the dialog');
    assert.equal(document.activeElement, trigger, 'focus did not return to the Course map button');

    assert.match(html, /data-course-map-dialog="true"[^>]*tabIndex="-1"[^>]*onkeydown=/,
      'dialog is not focusable or has no keyboard handler');
  });

  // Regression guard for the bug where restart() reset only {step, checks, dialogOpen},
  // so pattern edits and cable states survived "Start Over" while the README said
  // otherwise. Both guides now build state from a single initialState().
  test(`${guide.name}: restart() restores every field of the initial state`, () => {
    const { inst } = loadComponent(guide.file);
    assert.equal(typeof inst.initialState, 'function', 'no initialState() to compare against');
    const pristine = inst.initialState();

    // Dirty every scalar and collection we can reach, then restart.
    inst.state = { ...inst.state, step: inst.STEPS.length - 1, checks: { x: [true] }, dialogOpen: true };
    for (const [k, v] of Object.entries(pristine)) {
      if (typeof v === 'number') inst.state[k] = v + 7;
      else if (typeof v === 'boolean') inst.state[k] = !v;
      else if (Array.isArray(v)) inst.state[k] = [...v, 99];
    }
    inst.restart();

    for (const key of Object.keys(pristine)) {
      assert.deepEqual(inst.state[key], pristine[key],
        `restart() left "${key}" dirty — add it to initialState() rather than to restart()`);
    }
  });

  // The page identity and language were both missing until they were added; keep them.
  test(`${guide.name}: page declares a title and a language`, () => {
    const html = readGuide(guide.file);
    assert.match(html, /<html lang="[a-z-]+">/, 'missing lang attribute on <html>');
    const title = html.match(/<title>([^<]+)<\/title>/);
    assert.ok(title && title[1].trim(), 'missing or empty <title>');
  });

  // Colour, spacing and type must come from the design system's tokens.
  test(`${guide.name}: no hardcoded hex colours`, () => {
    const html = readGuide(guide.file);
    const hex = html.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
    assert.deepEqual(hex, [], `use var(--color-*) tokens instead of ${hex.slice(0, 5).join(', ')}`);
  });
}

test('every interactive control has an accessible name', () => {
  // Buttons whose only content is a template binding must supply aria-label, and
  // toggles must expose aria-pressed. The RD-6 grid in particular is 80 buttons with
  // no text at all, so without this it reads as 80 nameless buttons.
  for (const guide of GUIDES) {
    const html = readGuide(guide.file);
    const buttons = html.match(/<button[^>]*>(?:\s*)<\/button>/g) || [];
    for (const b of buttons) {
      assert.match(b, /aria-label=/, `${guide.name}: empty button without aria-label: ${b.slice(0, 90)}`);
    }
  }
});

test('Behringer: RD-6 grid cells and TD-3 chips carry names and pressed state', () => {
  const { inst } = loadComponent('Behringer Setup Guide.dc.html');
  const rd6Step = inst.STEPS.findIndex(s => s.widget === 'rd6');
  const rows = renderStep(inst, rd6Step).rd6Rows;
  assert.ok(rows.length > 0, 'no RD-6 rows built');
  for (const row of rows) {
    for (const cell of row.cells) {
      assert.ok(cell.label && /step \d+/.test(cell.label), `cell label missing: ${cell.label}`);
      assert.ok(cell.pressed === 'true' || cell.pressed === 'false', 'cell missing aria-pressed value');
    }
  }

  const timeStep = inst.STEPS.findIndex(s => s.widget === 'td3time');
  for (const c of renderStep(inst, timeStep).td3TimeCells) {
    assert.match(c.accentLabel, /Accent on step \d+/);
    assert.match(c.slideLabel, /Slide on step \d+/);
  }
});

// `npm test` names its files explicitly rather than globbing, because Node only
// expands --test glob patterns from v21 and cmd.exe does not glob at all. The cost
// of being explicit is that a new test file could silently never run — so check.
test('every test file is wired into `npm test`', () => {
  const script = JSON.parse(readFileSync(join(HERE, '..', 'package.json'), 'utf8')).scripts.test;
  for (const f of readdirSync(HERE).filter(f => f.endsWith('.test.mjs'))) {
    assert.ok(script.includes(f), `test/${f} exists but \`npm test\` never runs it — add it to the script`);
  }
});

// The counts the README states as plain facts — the Behringer step total and the
// hybrid week table — have each drifted from the built course before, past every
// existing consistency test. Pin them the way the bank card counts are pinned.
test('README step and week counts track the built courses', () => {
  const readme = readGuide('README.md');

  const { inst: beh } = loadComponent('Behringer Setup Guide.dc.html');
  const claimed = readme.match(/covers \*\*(\d+) steps\*\*/);
  assert.ok(claimed, 'README no longer states the Behringer step count');
  assert.equal(Number(claimed[1]), beh.STEPS.length,
    'README Behringer step count drifted from the built steps');

  const { inst: hyb } = loadComponent('Hybrid Live Set.dc.html');
  const weeks = new Set(hyb.STEPS.map(s => s.weekTag).filter(t => /^Week /.test(t))).size;
  const section = readme.split('## Hybrid Live Set Guide')[1].split('\n## ')[0];
  const rows = (section.match(/^\| \d+ \|/gm) || []).length;
  assert.equal(rows, weeks, 'README hybrid week table does not list every built week');
});
