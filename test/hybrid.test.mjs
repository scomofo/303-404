import test from 'node:test';
import assert from 'node:assert/strict';
import { loadComponent, renderStep } from './harness.mjs';

const FILE = 'Hybrid Live Set.dc.html';

test('hybrid course has six complete weeks plus overview and completion', () => {
  const { inst } = loadComponent(FILE);
  const intros = inst.STEPS.filter(s => s.kind === 'weekintro');
  assert.equal(intros.length, 6);
  assert.deepEqual(intros.map(s => s.weekTag), ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6']);
  assert.equal(inst.STEPS[0].id, 'overview');
  assert.equal(inst.STEPS.at(-1).id, 'complete');
});

test('performance map exposes selectable RD-6, TD-3 and FLX4 roles for every section', () => {
  const { inst } = loadComponent(FILE);
  const idx = inst.STEPS.findIndex(s => s.widget === 'perfmap');
  const view = renderStep(inst, idx);
  assert.equal(view.currentStep.showPerfmap, true);
  assert.equal(view.currentStep.showLayerMutes, true);
  assert.equal(view.perfSections.length, 5);
  assert.equal(view.selectedSection.title, 'Intro');
  for (const section of view.perfSections) {
    assert.ok(section.title && section.time && section.desc);
    assert.ok(section.rd6 && section.td3 && section.flx4);
    assert.match(section.pressed, /^(true|false)$/);
  }
  view.perfSections[3].select();
  const selected = renderStep(inst, idx);
  assert.equal(selected.selectedSection.title, 'Drop');
  assert.equal(selected.perfSections[3].pressed, 'true');
});

test('performance timeline is dual-pane, horizontally scrollable and keyboard operable', () => {
  const { inst, html } = loadComponent(FILE);
  const idx = inst.STEPS.findIndex(s => s.widget === 'perfmap');
  let view = renderStep(inst, idx);
  for (const section of view.perfSections) {
    assert.match(section.hardware, /RD-6:.*TD-3:/);
    assert.ok(section.flx4);
    assert.match(section.ariaLabel, /Hardware:.*Controller:/);
  }
  assert.match(html, /data-performance-timeline="true"[^>]*tabIndex="0"[^>]*onkeydown=/,
    'timeline is not keyboard-focusable');
  assert.match(html, /data-performance-timeline="true"[^>]*style="[^"]*overflow-x:auto/,
    'timeline does not scroll horizontally');

  const key = value => ({
    key:value,
    prevented:false,
    preventDefault() { this.prevented = true; },
  });
  const right = key('ArrowRight');
  view.perfmapKeydown(right);
  assert.equal(right.prevented, true);
  assert.equal(inst.state.perfmapSel, 1);

  view = renderStep(inst, idx);
  const end = key('End');
  view.perfmapKeydown(end);
  assert.equal(inst.state.perfmapSel, inst.PERF_SECTIONS.length - 1);
  const bounded = key('ArrowRight');
  renderStep(inst, idx).perfmapKeydown(bounded);
  assert.equal(inst.state.perfmapSel, inst.PERF_SECTIONS.length - 1);
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
  assert.deepEqual(labels, ['Overview', 'Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6', 'Complete']);
});


test('layer mutes toggle independently, appear in phrase practice, and reset', () => {
  const { inst } = loadComponent(FILE);
  const mapIdx = inst.STEPS.findIndex(s => s.widget === 'perfmap');
  let view = renderStep(inst, mapIdx);
  assert.deepEqual(view.layerMutes.map(x => x.pressed), ['false','false','false']);
  view.layerMutes[0].toggle();
  view = renderStep(inst, mapIdx);
  assert.equal(view.layerMutes[0].label, 'RD-6 Muted');
  assert.equal(view.layerMutes[0].pressed, 'true');
  assert.equal(view.layerMutes[1].pressed, 'false');
  view.layerMutes[2].toggle();
  assert.equal(inst.state.muteRd6, true);
  assert.equal(inst.state.muteTd3, false);
  assert.equal(inst.state.muteFlx4, true);

  const phraseIdx = inst.STEPS.findIndex(s => s.id === 'w2-2');
  assert.equal(renderStep(inst, phraseIdx).currentStep.showLayerMutes, true);

  inst.restart();
  assert.equal(inst.state.muteRd6, false);
  assert.equal(inst.state.muteTd3, false);
  assert.equal(inst.state.muteFlx4, false);
  assert.equal(inst.state.perfmapSel, 0);
});
