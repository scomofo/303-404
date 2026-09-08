(() => {
  const P = globalThis.DCStudioProject;
  function copyProject(source) {
    const project = P.validateProject(source); project.id = P.newId(); project.updatedAt = 0;
    return project;
  }
  function buildSet(source) {
    const project = copyProject(source), groove = project.scenes[1];
    project.name = `${project.name.slice(0, 65)} · Drop set`;
    project.scenes = ['Intro', 'Groove', 'Breakdown', 'Return'].map((name, i) => ({ ...P.copy(groove), id: P.SCENES[i], name }));
    const [intro, , breakdown, drop] = project.scenes;
    const bassAudible = !groove.mix.muteBass && groove.bass.notes.some(Boolean) && groove.mix.bass > 0;
    const drumsAudible = !groove.mix.muteDrums && groove.mix.drums > 0 && P.VOICES.some(v => v !== 'ac' && groove.drums.rows[v].length);
    if (drumsAudible) intro.mix.muteBass = true;
    intro.mix.drums *= .75; intro.mix.cutoff = Math.min(intro.mix.cutoff, 600);
    if (bassAudible) { breakdown.mix.muteDrums = true; breakdown.mix.cutoff = Math.min(breakdown.mix.cutoff, 450); }
    else {
      const lane = ['ch', 'oh', 'sd', 'bd', ...P.VOICES.filter(v => v !== 'ac')].find(v => groove.drums.rows[v].length);
      for (const key of P.VOICES) if (key !== lane) breakdown.drums.rows[key] = [];
      if (lane) breakdown.drums.rows[lane] = breakdown.drums.rows[lane].filter((_, i) => i % 2 === 0);
      breakdown.drums.source.edited = true; breakdown.mix.drums *= .65;
    }
    drop.mix.cutoff = Math.max(drop.mix.cutoff, 2200);
    project.arrangement = [{ scene: 'A', bars: 4 }, { scene: 'B', bars: 8 }, { scene: 'C', bars: 4 }, { scene: 'D', bars: 8 }];
    return P.validateProject(project);
  }
  function starter(banks) {
    const project = P.createProject(banks); project.name = 'First drop';
    return buildSet(project);
  }
  function fingerprint(project) {
    const clean = P.validateProject(project); clean.id = 'drop-lab'; clean.updatedAt = 0;
    return JSON.stringify(clean);
  }
  globalThis.DCDropProject = { copyProject, buildSet, starter, fingerprint };
})();
