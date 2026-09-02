import test from 'node:test';
import assert from 'node:assert/strict';
import { loadComponent, readGuide, renderStep } from './harness.mjs';

const FILE = 'TR-06 Guide.dc.html';
const SEARCH_PREFIX = 'https://www.youtube.com/results?search_query=';

test('TR-06 course has five weeks plus overview and completion', () => {
  const { inst } = loadComponent(FILE);
  const intros = inst.STEPS.filter(s => s.kind === 'weekintro');
  assert.equal(intros.length, 5);
  assert.deepEqual(intros.map(s => s.weekTag), ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5']);
  assert.equal(inst.STEPS[0].id, 'overview');
  assert.equal(inst.STEPS.at(-1).id, 'complete');
  assert.equal(inst.STEPS.filter(s => s.kind === 'content').length, 15);
});

test('each TR-06 week ends with an independently tracked milestone', () => {
  const { inst } = loadComponent(FILE);
  const milestones = inst.STEPS.filter(s => s.milestone);
  assert.equal(milestones.length, 5);
  milestones.forEach((step, index) => {
    const i = inst.STEPS.indexOf(step);
    renderStep(inst, i).milestone.toggle();
    assert.equal(inst.state.checks[step.id + ':milestone'][0], true, step.id);
    if (index) assert.equal(inst.state.checks[milestones[index - 1].id + ':milestone'][0], true);
  });
  inst.restart();
  assert.deepEqual(inst.state.checks, {});
});

test('TR-06 video resources are YouTube searches, never watch IDs', () => {
  const { inst } = loadComponent(FILE);
  let count = 0;
  for (let i = 0; i < inst.STEPS.length; i++) {
    const view = renderStep(inst, i);
    for (const resource of view.watchList) {
      count++;
      assert.ok(resource.url.startsWith(SEARCH_PREFIX), resource.url);
    }
  }
  assert.ok(count >= 5, 'each week that names a tutorial should expose a search');
  const html = readGuide(FILE);
  assert.doesNotMatch(html, /youtu\.be|youtube\.com\/watch|youtube\.com\/@/);
});

test('Week 1 paper grid is 8 voices by 16 named, pressable steps', () => {
  const { inst } = loadComponent(FILE);
  const idx = inst.STEPS.findIndex(s => s.showGrid);
  assert.ok(idx >= 0, 'no showGrid step');
  const view = renderStep(inst, idx);
  assert.equal(view.currentStep.showGrid, true);
  assert.equal(view.gridVoices.length, 8);
  assert.equal(view.gridRows.length, 8);
  assert.deepEqual(view.gridRows.map(r => r.name), ['AC', 'BD', 'SD', 'LT', 'HT', 'CY', 'OH', 'CH']);
  for (const row of view.gridRows) {
    assert.equal(row.cells.length, 16);
    for (const cell of row.cells) {
      assert.match(cell.label, /step \d+/);
      assert.match(cell.pressed, /^(true|false)$/);
    }
  }
});

test('default grid is the Week 1 four-on-the-floor drill', () => {
  const { inst } = loadComponent(FILE);
  const idx = inst.STEPS.findIndex(s => s.showGrid);
  const on = (row, steps) => {
    const cells = renderStep(inst, idx).gridRows.find(r => r.name === row).cells;
    assert.deepEqual(
      cells.map((c, i) => c.pressed === 'true' ? i : null).filter(i => i !== null),
      steps,
      row,
    );
  };
  on('BD', [0, 4, 8, 12]);
  on('SD', [4, 12]);
  on('CH', [0, 2, 4, 6, 8, 10, 12, 14]);
  on('AC', [0, 4]);
  on('OH', []);
});

test('clearing and reloading the grid does not leak across Start Over', () => {
  const { inst } = loadComponent(FILE);
  const idx = inst.STEPS.findIndex(s => s.showGrid);
  let view = renderStep(inst, idx);
  view.clearGrid();
  view = renderStep(inst, idx);
  assert.ok(view.gridRows.every(row => row.cells.every(c => c.pressed === 'false')));
  view.loadDefaultGrid();
  view = renderStep(inst, idx);
  assert.equal(view.gridRows.find(r => r.name === 'BD').cells[0].pressed, 'true');
  view.gridRows.find(r => r.name === 'LT').cells[3].toggle();
  inst.restart();
  view = renderStep(inst, idx);
  assert.equal(view.gridRows.find(r => r.name === 'LT').cells[3].pressed, 'false');
  assert.equal(view.gridRows.find(r => r.name === 'BD').cells[0].pressed, 'true');
});

test('copy names Inst, Mix In, Menu + Step Loop, and the TD-3 handshake', () => {
  const html = readGuide(FILE);
  assert.match(html, /Menu \+ Step Loop/);
  assert.match(html, /InSt/);
  assert.match(html, /Mix In/);
  assert.match(html, /TD-3/);
  assert.match(html, /Accent/);
  assert.doesNotMatch(html, /youtube\.com\/watch/);
});

test('README TR-06 week table lists every built week', () => {
  const readme = readGuide('README.md');
  const { inst } = loadComponent(FILE);
  const weeks = new Set(inst.STEPS.map(s => s.weekTag).filter(t => /^Week /.test(t))).size;
  const section = readme.split('## TR-06 Guide')[1];
  assert.ok(section, 'README is missing a TR-06 Guide section');
  const rows = (section.split('\n## ')[0].match(/^\| \d+ \|/gm) || []).length;
  assert.equal(rows, weeks, 'README TR-06 week table does not list every built week');
});
