import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { readGuide } from './harness.mjs';

// Mission credit comes from transport events, musical comparisons and an
// explicit successful keep. These tests make no claim about rendered audio.
function fixture(hats = [2, 6, 10, 14]) {
  const scope = {};
  for (const file of ['studio/banks.js', 'studio/project.js', 'arcade/game.js', 'arcade/remix.js', 'arcade/mission.js']) {
    runInNewContext(readGuide(file), scope);
  }
  const rows = { bd: [0, 4, 8, 12], sd: [4, 12], ch: [...hats] };
  const remix = new scope.DCArcadeRemix.Session(scope.DCStudioBanks, scope.DCBeatArcade.CHALLENGES[0], rows);
  const mission = new scope.DCArcadeMission.Session(remix.project);
  return { rows, remix, mission, view: () => mission.view(remix.project) };
}

function ticks(f, sceneId, from = 0, to = 15, solo = 'all') {
  for (let tick = from; tick <= to; tick++) {
    f.mission.observe(f.remix.project, { sceneId, tick, step: tick, bar: Math.floor(tick / 16), first: tick === 0 }, { solo });
  }
}

function toggle(f, step = 1, voice = 'ch') {
  assert.equal(f.remix.toggle(voice, step), true);
  f.mission.changed(f.remix.project);
}

function readyForReflection(f) {
  f.mission.start(f.remix.project);
  ticks(f, 'A');
  toggle(f);
  ticks(f, 'B');
  assert.equal(f.view().remixHeard, true);
}

test('a manual hat change earns a mission only after listening, reflection and successful keep', () => {
  const f = fixture(), original = JSON.stringify(f.remix.project.scenes[0]), draft = JSON.stringify(f.rows);
  const id = f.remix.project.id;
  assert.equal(f.view().active, false);
  f.mission.start(f.remix.project);
  assert.equal(f.view().step, 1);
  ticks(f, 'A');
  assert.equal(f.view().originalHeard, true);
  assert.equal(f.view().step, 2);
  toggle(f);
  assert.equal(f.view().changed, true);
  assert.equal(f.view().step, 3);
  ticks(f, 'B');
  assert.equal(f.view().step, 4);
  f.mission.reflect('space');
  assert.equal(f.view().step, 5);
  assert.equal(f.view().canKeep, true);
  assert.equal(f.view().complete, false, 'being eligible is not evidence of a successful save');
  const editedMusic = JSON.stringify(f.remix.project);
  f.mission.kept(f.remix.project);
  assert.equal(f.view().complete, true);
  assert.equal(f.view().step, 6);
  assert.equal(f.view().canKeep, false);
  assert.equal(JSON.stringify(f.remix.project), editedMusic);
  assert.equal(f.remix.project.id, id);
  assert.equal(JSON.stringify(f.remix.project.scenes[0]), original);
  assert.equal(JSON.stringify(f.rows), draft);
});

test('empty, single-hit and dense hats provide an actionable start and allow a manual edit', () => {
  const hints = [];
  for (const hats of [[], [2], Array.from({ length: 16 }, (_, i) => i)]) {
    const f = fixture(hats);
    f.mission.start(f.remix.project);
    ticks(f, 'A');
    const hint = f.view().hint;
    assert.equal(typeof hint, 'string');
    assert.ok(hint.trim().length > 0);
    hints.push(hint);
    toggle(f, 2);
    assert.equal(f.view().changed, true);
    ticks(f, 'B');
    f.mission.reflect('exploring');
    assert.equal(f.view().canKeep, true, `a starting row of ${hats.length} hats must not trap the learner`);
  }
  assert.notEqual(hints[0], hints[2], 'empty and dense rows require different useful editing guidance');
});

test('premature listening, reflection and keep cannot skip the learning sequence', () => {
  const f = fixture();
  f.mission.start(f.remix.project);
  f.mission.reflect('space');
  f.mission.kept(f.remix.project);
  ticks(f, 'B');
  assert.equal(f.view().originalHeard, false);
  assert.equal(f.view().remixHeard, false);
  assert.equal(Boolean(f.view().reflection), false);
  assert.equal(f.view().complete, false);
  assert.equal(f.view().canKeep, false);
  ticks(f, 'A');
  ticks(f, 'B');
  f.mission.reflect('space');
  f.mission.kept(f.remix.project);
  assert.equal(f.view().changed, false);
  assert.equal(f.view().remixHeard, false, 'the unchanged remix is not an A/B comparison');
  assert.equal(f.view().canKeep, false);
  toggle(f);
  f.mission.reflect('space');
  f.mission.kept(f.remix.project);
  assert.equal(Boolean(f.view().reflection), false);
  assert.equal(f.view().complete, false);
  ticks(f, 'B');
  f.mission.reflect('not-a-reflection');
  f.mission.kept(f.remix.project);
  assert.equal(Boolean(f.view().reflection), false);
  assert.equal(f.view().complete, false);
});

test('a partial bar, the currently audible A while B is queued, and solos earn no remix listening credit', () => {
  const f = fixture();
  f.mission.start(f.remix.project);
  ticks(f, 'A', 0, 7);
  assert.equal(f.view().originalHeard, false);
  ticks(f, 'A', 8, 15);
  assert.equal(f.view().originalHeard, true);
  toggle(f);
  ticks(f, 'A'); // Queueing B does not change which scene the transport reports as audible.
  assert.equal(f.view().remixHeard, false);
  for (const solo of ['bd', 'sd', 'ch', 'bass']) {
    ticks(f, 'B', 0, 15, solo);
    assert.equal(f.view().remixHeard, false, `${solo} solo is not the full groove`);
  }
  ticks(f, 'B', 0, 14);
  assert.equal(f.view().remixHeard, false);
  ticks(f, 'B', 15, 15);
  assert.equal(f.view().remixHeard, true);
});

test('stops, scene switches and missing ticks prevent separate fragments earning a full bar', () => {
  for (const interrupt of ['stop', 'scene', 'solo', 'missing']) {
    const f = fixture();
    f.mission.start(f.remix.project);
    ticks(f, 'A', 0, 7);
    if (interrupt === 'stop') f.mission.stop();
    if (interrupt === 'scene') ticks(f, 'B', 0, 7);
    if (interrupt === 'solo') ticks(f, 'A', 8, 8, 'ch');
    ticks(f, 'A', interrupt === 'missing' ? 9 : 8, 15);
    assert.equal(f.view().originalHeard, false, `${interrupt} must interrupt listening credit`);
    ticks(f, 'A', 16, 31);
    assert.equal(f.view().originalHeard, true, 'a complete later bar can recover');
  }
});

test('an edit invalidates heard remix, reflection and completion until that version is heard again', () => {
  const f = fixture();
  readyForReflection(f);
  f.mission.reflect('movement');
  f.mission.kept(f.remix.project);
  toggle(f, 3);
  assert.equal(f.view().originalHeard, true);
  assert.equal(f.view().changed, true);
  assert.equal(f.view().remixHeard, false);
  assert.equal(Boolean(f.view().reflection), false);
  assert.equal(f.view().complete, false);
  assert.equal(f.view().canKeep, false);
  ticks(f, 'B');
  f.mission.reflect('movement');
  assert.equal(f.view().canKeep, true);
});

test('undo and redo require listening again instead of reviving stale reflection or completion', () => {
  const f = fixture();
  readyForReflection(f);
  f.mission.reflect('exploring');
  f.mission.kept(f.remix.project);
  assert.equal(f.remix.undo(), true);
  f.mission.changed(f.remix.project);
  assert.equal(f.view().changed, false);
  assert.equal(f.view().remixHeard, false);
  assert.equal(Boolean(f.view().reflection), false);
  assert.equal(f.view().complete, false);
  assert.equal(f.remix.redo(), true);
  f.mission.changed(f.remix.project);
  assert.equal(f.view().changed, true);
  assert.equal(f.view().remixHeard, false);
  assert.equal(Boolean(f.view().reflection), false);
  assert.equal(f.view().complete, false);
});

test('reset returns to the original comparison without changing or discarding the original', () => {
  const f = fixture(), original = JSON.stringify(f.remix.project.scenes[0]);
  readyForReflection(f);
  f.mission.reflect('space');
  f.remix.reset();
  f.mission.changed(f.remix.project);
  assert.equal(f.view().active, true);
  assert.equal(f.view().originalHeard, true);
  assert.equal(f.view().changed, false);
  assert.equal(f.view().remixHeard, false);
  assert.equal(Boolean(f.view().reflection), false);
  assert.equal(f.view().complete, false);
  assert.equal(f.view().step, 2);
  assert.equal(JSON.stringify(f.remix.project.scenes[0]), original);
});

test('kick, bass and mix changes do not qualify as the isolated hat experiment', () => {
  const changes = [
    f => f.remix.toggle('bd', 1),
    f => f.remix.vary('acid'),
    f => f.remix.change(scene => { scene.mix.drums = 0.2; }),
  ];
  for (const edit of changes) {
    const f = fixture();
    f.mission.start(f.remix.project);
    ticks(f, 'A');
    edit(f);
    f.mission.changed(f.remix.project);
    assert.equal(f.view().changed, false);
    toggle(f); // Hats alone differ too, but the unrelated edit still confounds A/B.
    assert.equal(f.view().changed, false);
    ticks(f, 'B');
    f.mission.reflect('space');
    f.mission.kept(f.remix.project);
    assert.equal(f.view().canKeep, false);
    assert.equal(f.view().complete, false);
  }
});

test('musically identical set ordering and metadata updates preserve comparison credit', () => {
  const f = fixture();
  readyForReflection(f);
  f.mission.reflect('space');
  f.mission.kept(f.remix.project);
  const project = f.remix.project;
  project.name = 'My named experiment';
  project.updatedAt = Date.now();
  project.scenes[1].name = 'A quieter answer';
  project.scenes[1].drums.source.detail = 'A personal source note';
  project.scenes[1].drums.source.edited = !project.scenes[1].drums.source.edited;
  for (const scene of project.scenes) {
    for (const row of Object.values(scene.drums.rows)) row.reverse();
    scene.bass.accent.reverse(); scene.bass.slide.reverse();
  }
  f.mission.changed(project);
  assert.equal(f.view().originalHeard, true);
  assert.equal(f.view().changed, true);
  assert.equal(f.view().remixHeard, true);
  assert.equal(f.view().reflection, 'space');
  assert.equal(f.view().complete, true);
});

test('every offered reflection can complete the experiment without a prescribed musical answer', () => {
  for (const reflection of ['space', 'movement', 'exploring']) {
    const f = fixture();
    readyForReflection(f);
    f.mission.reflect(reflection);
    assert.equal(f.view().reflection, reflection);
    assert.equal(f.view().canKeep, true);
    f.mission.kept(f.remix.project);
    assert.equal(f.view().complete, true);
  }
});

test('inactive guidance and leaving or restarting it preserve the learner original and remix draft', () => {
  const f = fixture();
  f.remix.toggle('ch', 1);
  const music = JSON.stringify(f.remix.project), draft = JSON.stringify(f.rows);
  f.mission.changed(f.remix.project);
  ticks(f, 'A'); ticks(f, 'B');
  f.mission.reflect('space'); f.mission.kept(f.remix.project);
  assert.equal(f.view().active, false);
  assert.equal(f.view().complete, false);
  assert.equal(JSON.stringify(f.remix.project), music);
  f.mission.start(f.remix.project);
  f.mission.exit();
  assert.equal(f.view().active, false);
  assert.equal(JSON.stringify(f.remix.project), music);
  f.mission.start(f.remix.project);
  assert.equal(f.view().active, true);
  assert.equal(f.view().originalHeard, false);
  assert.equal(f.view().remixHeard, false);
  assert.equal(Boolean(f.view().reflection), false);
  assert.equal(f.view().complete, false);
  assert.equal(JSON.stringify(f.remix.project), music);
  assert.equal(JSON.stringify(f.rows), draft);
});
