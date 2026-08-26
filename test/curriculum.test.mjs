// The DDJ-FLX4 guide's six-week practice plan: the study curriculum that sits after
// the seven hands-on weeks. These guard the data (every week is complete, every
// cross-link resolves) and the two rules that are easy to break silently — that
// progress ticks stay namespaced, and that no link claims to know a video's ID.

import test from 'node:test';
import assert from 'node:assert/strict';
import { loadComponent, readGuide, renderStep } from './harness.mjs';

const GUIDE = 'DDJ-FLX4 Guide.dc.html';
const SEARCH_PREFIX = 'https://www.youtube.com/results?search_query=';

function stepIndexById(inst, id) {
  const i = inst.STEPS.findIndex(s => s.id === id);
  assert.ok(i >= 0, `no step with id "${id}"`);
  return i;
}

test('every practice week is complete', () => {
  const { inst } = loadComponent(GUIDE);
  const weeks = inst.practiceWeeks();
  assert.equal(weeks.length, 6, 'the plan is six weeks');
  assert.deepEqual(weeks.map(w => w.practiceWeek), [1, 2, 3, 4, 5, 6], 'weeks are numbered 1–6 in order');

  for (const w of weeks) {
    assert.ok(w.goal, `${w.id}: no goal`);
    assert.ok(w.milestone, `${w.id}: no milestone — a week with nothing to reach is not a week`);
    assert.ok(w.items && w.items.length, `${w.id}: no practice tasks`);
    assert.ok(w.watch && w.watch.length, `${w.id}: nothing to watch`);
    assert.ok(w.lessons && w.lessons.length, `${w.id}: no link back into the hands-on course`);
    for (const v of w.watch) assert.ok(v.title && v.creator, `${w.id}: a watch entry is missing its title or creator`);
  }
});

// The labels on these buttons are read off the target step, so a lesson id that no
// longer exists silently drops the button rather than rendering a dead one — which is
// exactly the kind of quiet loss a test has to catch.
test('every cross-link into the hands-on course resolves', () => {
  const { inst } = loadComponent(GUIDE);
  for (const w of inst.practiceWeeks()) {
    const links = renderStep(inst, stepIndexById(inst, w.id)).lessonLinks;
    assert.equal(links.length, w.lessons.length, `${w.id}: a lesson id points at no step`);
    w.lessons.forEach((id, i) => {
      const target = inst.STEPS[stepIndexById(inst, id)];
      assert.equal(links[i].label, `${target.weekTag} · ${target.title}`, `${w.id}: stale label for ${id}`);
    });
  }
});

// The source plan lists video and channel names, not URLs. Anything that looks like a
// specific video would be a guess, and a wrong guess is worse than a search box.
test('no link claims to know a video ID', () => {
  const { inst } = loadComponent(GUIDE);
  const urls = [];
  for (const w of inst.practiceWeeks()) {
    for (const v of renderStep(inst, stepIndexById(inst, w.id)).watchList) urls.push([v.title, v.url]);
  }
  for (const c of renderStep(inst, stepIndexById(inst, 'pp-creators')).creatorList) urls.push([c.name, c.url]);
  assert.ok(urls.length > 0, 'no links built at all');

  for (const [label, url] of urls) {
    assert.ok(url.startsWith(SEARCH_PREFIX), `${label}: not a YouTube search link — ${url}`);
    const query = decodeURIComponent(url.slice(SEARCH_PREFIX.length).replace(/\+/g, ' '));
    assert.ok(query.includes(label) || label.includes(query.split(' ')[0]),
      `${label}: search query does not mention it — ${query}`);
  }

  const html = readGuide(GUIDE);
  assert.doesNotMatch(html, /youtu\.be|youtube\.com\/watch|youtube\.com\/@/,
    'a hardcoded link points at a specific video or channel the source plan never gave');
});

// Tasks, videos and the milestone all live in one checks map. Namespacing them is the
// only thing stopping a ticked video from striking through a practice task.
test('task, watchlist and milestone ticks stay separate', () => {
  const { inst } = loadComponent(GUIDE);
  const i = stepIndexById(inst, 'pp-w1');
  const step = inst.STEPS[i];

  renderStep(inst, i).currentStep.items[0].toggle();
  renderStep(inst, i).watchList[1].toggle();
  renderStep(inst, i).milestone.toggle();

  const view = renderStep(inst, i);
  assert.equal(view.currentStep.items[0].checked, true, 'task tick lost');
  assert.equal(view.currentStep.items[1].checked, false, 'a tick leaked between tasks');
  assert.equal(view.watchList[1].checked, true, 'watch tick lost');
  assert.equal(view.watchList[0].checked, false, 'the milestone or a task tick leaked into the watchlist');
  assert.equal(view.milestone.checked, true, 'milestone tick lost');

  // All three must live in `checks`, which initialState() owns — otherwise Start Over
  // would leave a half-finished plan looking complete.
  assert.ok(inst.state.checks[step.id], 'tasks are not stored in checks');
  assert.ok(inst.state.checks[`${step.id}:watch`], 'watchlist is not stored in checks');
  assert.ok(inst.state.checks[`${step.id}:milestone`], 'milestone is not stored in checks');
  inst.restart();
  assert.equal(renderStep(inst, i).milestone.checked, false, 'Start Over left a milestone ticked');
});

test('the plan map tracks every week and its milestones', () => {
  const { inst } = loadComponent(GUIDE);
  const i = stepIndexById(inst, 'pp-how');
  const weeks = inst.practiceWeeks();

  let view = renderStep(inst, i);
  assert.equal(view.planMap.length, weeks.length, 'plan map does not list every practice week');
  assert.equal(view.planProgress, `0 of ${weeks.length} milestones reached`);
  for (const row of view.planMap) {
    assert.ok(row.milestone, 'plan map row shows no milestone');
    assert.equal(row.status, 'Not yet');
  }

  // Reaching one week's milestone must move the tally and only that row.
  const w3 = stepIndexById(inst, 'pp-w3');
  renderStep(inst, w3).milestone.toggle();
  view = renderStep(inst, i);
  assert.equal(view.planProgress, `1 of ${weeks.length} milestones reached`);
  assert.deepEqual(view.planMap.map(r => r.status), ['Not yet', 'Not yet', 'Reached', 'Not yet', 'Not yet', 'Not yet']);

  // The map's jump buttons are the only way into a week from here.
  view.planMap[0].go();
  assert.equal(inst.STEPS[inst.state.step].id, 'pp-w1', 'plan map jump went to the wrong step');
});

test('every creator the plan names is listed with a blurb and a link', () => {
  const { inst } = loadComponent(GUIDE);
  const listed = renderStep(inst, stepIndexById(inst, 'pp-creators')).creatorList;
  for (const name of ['DJ Blakey', 'DJ Carlo', 'Digital DJ Tips', 'Off The Rack Jack', 'Club Ready DJ School', 'DJ Shortkut']) {
    const c = listed.find(x => x.name.includes(name));
    assert.ok(c, `creators step omits ${name}`);
    assert.ok(c.blurb && c.role, `${name}: no blurb or role`);
    assert.ok(c.url.startsWith(SEARCH_PREFIX), `${name}: no search link`);
  }
  // Blakey is the spine of the plan; the rest fill gaps he doesn't cover.
  assert.equal(listed[0].name, 'DJ Blakey', 'the core creator should lead the list');
});

test('README documents the practice plan', () => {
  const { inst } = loadComponent(GUIDE);
  const readme = readGuide('README.md');
  assert.match(readme, /Practice Plan/, 'README never mentions the Practice Plan');
  assert.match(readme, new RegExp(`${inst.practiceWeeks().length}-week`),
    'README week count drifted from the steps');
  assert.match(readme, /search/i, 'README does not explain why video links are searches');
});
