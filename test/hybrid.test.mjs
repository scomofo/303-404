import test from 'node:test';
import assert from 'node:assert/strict';
import { loadComponent, renderStep } from './harness.mjs';

const FILE = 'Hybrid Live Set.dc.html';

test('hybrid course has five complete weeks plus overview and completion', () => {
  const { inst } = loadComponent(FILE);
  const intros = inst.STEPS.filter(s => s.kind === 'weekintro');
  assert.equal(intros.length, 5);
  assert.deepEqual(intros.map(s => s.weekTag), ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5']);
  assert.equal(inst.STEPS[0].id, 'overview');
  assert.equal(inst.STEPS.at(-1).id, 'complete');
});

test('performance map exposes both hardware and controller roles for every section', () => {
  const { inst } = loadComponent(FILE);
  const idx = inst.STEPS.findIndex(s => s.widget === 'perfmap');
  assert.ok(idx >= 0, 'no performance-map step');
  const view = renderStep(inst, idx);
  assert.equal(view.currentStep.showPerfmap, true);
  assert.equal(view.currentStep.perfSections.length, 5);
  for (const section of view.currentStep.perfSections) {
    assert.ok(section.label && section.time, 'section missing label/time');
    assert.ok(section.hardware, `${section.label}: missing TD-3/RD-6 role`);
    assert.ok(section.controller, `${section.label}: missing DDJ-FLX4 role`);
  }
});

test('hybrid checklists toggle independently and Start Over clears them', () => {
  const { inst } = loadComponent(FILE);
  const a = inst.STEPS.findIndex(s => s.id === 'w1-1');
  const b = inst.STEPS.findIndex(s => s.id === 'w5-1');
  renderStep(inst, a).currentStep.items[0].toggle();
  renderStep(inst, b).currentStep.items[1].toggle();
  assert.equal(inst.state.checks['w1-1'][0], true);
  assert.equal(inst.state.checks['w5-1'][1], true);
  inst.restart();
  assert.deepEqual(inst.state.checks, {});
  assert.equal(inst.state.step, 0);
});

test('hybrid course map groups every week and completion state', () => {
  const { inst } = loadComponent(FILE);
  const labels = renderStep(inst, 0).navGroups.map(g => g.label);
  assert.deepEqual(labels, ['Overview', 'Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Complete']);
});
