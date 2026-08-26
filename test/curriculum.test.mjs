import test from 'node:test';
import assert from 'node:assert/strict';
import { loadComponent, readGuide, renderStep } from './harness.mjs';

const GUIDE = 'DDJ-FLX4 Guide.dc.html';
const SEARCH_PREFIX = 'https://www.youtube.com/results?search_query=';

test('DJ-404 is one eight-week intensive with five applied days per week', () => {
  const { inst } = loadComponent(GUIDE);
  const intros = inst.STEPS.filter(step => step.kind === 'weekintro');
  assert.deepEqual(intros.map(step => step.weekTag), [
    'Week 1', 'Week 2', 'Week 3', 'Week 4',
    'Week 5', 'Week 6', 'Week 7', 'Week 8',
  ]);
  for (let week = 1; week <= 8; week++) {
    const days = inst.STEPS.filter(step => step.kind === 'content' && step.weekTag === 'Week ' + week);
    assert.equal(days.length, 5, 'Week ' + week + ' does not have five days');
    assert.deepEqual(days.map(step => step.title.slice(0, 5)), ['Day 1','Day 2','Day 3','Day 4','Day 5']);
    assert.ok(days[4].milestone, 'Week ' + week + ' has no recorded milestone');
  }
  assert.equal(inst.STEPS.filter(step => step.practiceWeek).length, 0,
    'the old six-week Practice Plan should not duplicate the intensive');
  assert.equal(inst.STEPS.length, 50);
});

test('every weekly milestone is independently tracked and Start Over clears it', () => {
  const { inst } = loadComponent(GUIDE);
  const day5s = inst.STEPS.filter(step => step.kind === 'content' && step.milestone);
  assert.equal(day5s.length, 8);
  day5s.forEach((step, index) => {
    const i = inst.STEPS.indexOf(step);
    renderStep(inst, i).milestone.toggle();
    assert.equal(inst.state.checks[step.id + ':milestone'][0], true, step.id);
    if (index) assert.equal(inst.state.checks[day5s[index - 1].id + ':milestone'][0], true);
  });
  inst.restart();
  assert.deepEqual(inst.state.checks, {});
});

test('video resources remain searches rather than guessed upload IDs', () => {
  const { inst } = loadComponent(GUIDE);
  let count = 0;
  for (let i = 0; i < inst.STEPS.length; i++) {
    const view = renderStep(inst, i);
    for (const resource of view.watchList) {
      count++;
      assert.ok(resource.url.startsWith(SEARCH_PREFIX), resource.url);
    }
  }
  assert.ok(count >= 4, 'too few targeted learning resources survived the merge');
  const html = readGuide(GUIDE);
  assert.doesNotMatch(html, /youtu\.be|youtube\.com\/watch|youtube\.com\/@/);
});

test('the intensive reuses every major existing practice widget', () => {
  const { inst } = loadComponent(GUIDE);
  const widgets = new Set(inst.STEPS.map(step => step.widget).filter(Boolean));
  for (const widget of [
    'cables', 'jogSpin', 'tempo', 'mixerEQ', 'mixerFader', 'sync',
    'hotCues', 'loop', 'beatFx', 'perfmap',
  ]) assert.ok(widgets.has(widget), 'missing existing widget ' + widget);
  for (const widget of ['transitionBank', 'camelot', 'recording']) {
    assert.ok(widgets.has(widget), 'missing new widget ' + widget);
  }
});

test('README documents the eight-week DJ-404 course without the old 7+6 claim', () => {
  const readme = readGuide('README.md');
  assert.match(readme, /DJ-404|eight-week/i);
  assert.doesNotMatch(readme, /seven weeks of hands-on lessons.*6-week Practice Plan/i);
});
