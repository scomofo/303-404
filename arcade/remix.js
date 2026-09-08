/* Creative variations stay separate from the Arcade's exact-match scoring. */
(() => {
  const P = globalThis.DCStudioProject, G = globalThis.DCBeatArcade;
  const PHRASES = [
    { notes: ['C2', null, 'C2', 'D#2', null, null, 'G2', null, 'C2', null, 'A#1', null, 'G1', 'C2', null, null], accent: [0, 8], slide: [2, 12] },
    { notes: ['C2', null, null, 'G1', 'A#1', null, 'C2', null, null, null, 'D#2', 'F2', null, 'G2', null, 'G1'], accent: [0, 6, 13], slide: [3, 10] },
    { notes: ['C2', 'D#2', null, null, 'F2', null, 'G2', 'A#2', 'G2', null, null, 'F2', 'D#2', null, 'C2', null], accent: [0, 6, 14], slide: [0, 6, 11] },
  ];
  class Session {
    constructor(banks, challenge, rows) {
      this.project = G.createProject(banks, challenge, rows);
      this.project.name = `${challenge.title} · Remix`;
      this.project.scenes[0].name = 'Original';
      this.project.scenes[1] = { ...P.copy(this.project.scenes[0]), id: 'B', name: 'Your remix' };
      this.project.arrangement = [{ scene: 'A', bars: 4 }, { scene: 'B', bars: 4 }];
      this.history = []; this.future = [];
    }
    get scene() { return this.project.scenes[1]; }
    change(edit) {
      const before = P.copy(this.scene), next = P.copy(this.project);
      edit(next.scenes[1]);
      const validated = P.validateProject(next);
      if (JSON.stringify(before) === JSON.stringify(validated.scenes[1])) return false;
      this.history.push(before); if (this.history.length > 40) this.history.shift();
      this.future = []; this.project = validated; return true;
    }
    toggle(voice, step) {
      if (!G.VOICES.some(v => v.key === voice) || !Number.isInteger(step) || step < 0 || step > 15) throw new Error('Choose a drum pad from steps 1–16.');
      return this.change(scene => {
        const row = scene.drums.rows[voice], at = row.indexOf(step);
        if (at < 0) row.push(step); else row.splice(at, 1);
        scene.drums.source.edited = true;
      });
    }
    vary(kind) {
      return this.change(scene => {
        if (kind === 'fill') {
          scene.drums.rows.sd = [...new Set([...scene.drums.rows.sd, 12, 14, 15])];
          scene.drums.rows.ch = [...new Set([...scene.drums.rows.ch, 13, 14, 15])];
        } else if (kind === 'sparse') {
          scene.drums.rows.ch = scene.drums.rows.ch.filter((_, i) => i % 2 === 0);
        } else if (kind === 'acid') {
          const last = /^arcade-remix-acid-([0-2])$/.exec(scene.bass.source.id);
          const index = last ? (Number(last[1]) + 1) % PHRASES.length : 0;
          scene.bass = { ...P.copy(PHRASES[index]), waveform: 'sawtooth',
            source: { id: `arcade-remix-acid-${index}`, title: `Acid answer ${index + 1}`, type: 'original_practice',
              detail: 'An original C-minor bass phrase written for Beat Arcade Remix Mode.', review: false, edited: false } };
          scene.mix.muteBass = false; scene.mix.bass = .48; scene.mix.cutoff = 1200; scene.mix.resonance = 5;
        } else throw new Error('Unknown remix idea.');
        if (kind !== 'acid') scene.drums.source.edited = true;
      });
    }
    reset() {
      return this.change(scene => Object.assign(scene, P.copy(this.project.scenes[0]), { id: 'B', name: 'Your remix' }));
    }
    undo() {
      if (!this.history.length) return false;
      this.future.push(P.copy(this.scene)); this.project.scenes[1] = this.history.pop(); return true;
    }
    redo() {
      if (!this.future.length) return false;
      this.history.push(P.copy(this.scene)); this.project.scenes[1] = this.future.pop(); return true;
    }
  }
  function forPlayback(project, { solo = 'all', bpm = project.bpm } = {}) {
    const result = P.validateProject(project); result.bpm = bpm;
    for (const scene of result.scenes) {
      if (solo !== 'all') {
        for (const voice of P.VOICES) if (voice !== solo) scene.drums.rows[voice] = [];
        if (solo !== 'bass') scene.mix.muteBass = true;
      }
    }
    return P.validateProject(result);
  }
  function forStudio(project) {
    const result = P.validateProject(project); result.id = P.newId(); result.updatedAt = 0;
    result.scenes[2] = { ...P.copy(result.scenes[0]), id: 'C', name: 'Original copy' };
    result.scenes[3] = { ...P.copy(result.scenes[1]), id: 'D', name: 'Remix copy' };
    return P.validateProject(result);
  }
  function fingerprint(project) {
    const clean = P.validateProject(project); clean.id = 'remix'; clean.updatedAt = 0;
    return JSON.stringify(clean);
  }
  globalThis.DCArcadeRemix = { Session, forPlayback, forStudio, fingerprint };
})();
