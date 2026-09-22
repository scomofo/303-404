/* Optional listening practice. Musical edits are checked; musical taste is not. */
(() => {
  const REFLECTIONS = new Set(['space', 'movement', 'exploring']);
  const ordered = value => {
    if (Array.isArray(value)) return value.map(ordered);
    if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])]));
    return value;
  };
  const signature = value => JSON.stringify(ordered(value));
  const steps = row => [...new Set(row || [])].sort((a, b) => a - b);
  function music(scene) {
    return {
      drums: { steps: scene.drums.steps, pair: scene.drums.pair,
        rows: Object.fromEntries(Object.entries(scene.drums.rows).map(([voice, row]) => [voice, steps(row)])) },
      bass: { notes: scene.bass.notes, accent: steps(scene.bass.accent), slide: steps(scene.bass.slide), waveform: scene.bass.waveform },
      mix: scene.mix,
    };
  }
  function fingerprint(project) {
    return signature({ bpm: project.bpm, master: project.master, scenes: project.scenes.map(music), arrangement: project.arrangement });
  }
  function comparison(project) {
    const original = music(project.scenes.find(scene => scene.id === 'A'));
    const remix = music(project.scenes.find(scene => scene.id === 'B'));
    const hatsChanged = signature(original.drums.rows.ch) !== signature(remix.drums.rows.ch);
    const hats = original.drums.rows.ch;
    original.drums.rows.ch = []; remix.drums.rows.ch = [];
    const otherChanges = signature(original) !== signature(remix);
    const hintAction = hats.length >= 2 ? 'remove' : 'add';
    const hintStep = hintAction === 'remove' ? hats[hats.length - 1] : [2, 6, 10, 14].find(step => !hats.includes(step));
    const beat = Math.floor(hintStep / 4) + 1;
    const count = hintStep % 4 === 0 ? `beat ${beat}` : `the “${['', 'e', 'and', 'a'][hintStep % 4]}” of beat ${beat}`;
    return {
      changed: hatsChanged && !otherChanges,
      hintStep, hintAction,
      hint: `Try switching ${hintAction === 'remove' ? 'off' : 'on'} hi-hat step ${hintStep + 1} (${count}). Keep the other sounds unchanged.`,
      notice: otherChanges ? 'Another sound changed too. Use “Reset to your original”, then change a hi-hat for this comparison, or choose Free remix.' : '',
    };
  }
  class Session {
    constructor(project) {
      this.active = false; this.originalHeard = false; this.remixHeard = false;
      this.reflection = null; this.complete = false; this.partial = null;
      this.fingerprint = fingerprint(project);
    }
    start(project) {
      this.active = true; this.originalHeard = false; this.remixHeard = false;
      this.reflection = null; this.complete = false; this.partial = null;
      this.fingerprint = fingerprint(project);
      return this.view(project);
    }
    exit() { this.active = false; this.stop(); }
    changed(project) {
      const next = fingerprint(project);
      if (next === this.fingerprint) return false;
      this.fingerprint = next; this.remixHeard = false; this.reflection = null; this.complete = false;
      this.stop(); return true;
    }
    observe(project, event, { solo = 'all' } = {}) {
      this.changed(project);
      if (!this.active || solo !== 'all' || !event || !['A', 'B'].includes(event.sceneId) || !Number.isInteger(event.tick) || event.tick < 0) {
        this.stop(); return;
      }
      const side = event.sceneId;
      if (side === 'B' && (!this.originalHeard || !comparison(project).changed)) { this.stop(); return; }
      const tick = event.tick, step = Number.isInteger(event.step) ? event.step : null;
      if (tick % 16 === 0) {
        this.partial = { side, tick, step, heard: 1 };
        return;
      }
      const previous = this.partial;
      if (!previous || previous.side !== side || tick !== previous.tick + 1 || (step !== null && previous.step !== null && step !== previous.step + 1)) {
        this.stop(); return;
      }
      this.partial = { side, tick, step, heard: previous.heard + 1 };
      if (this.partial.heard === 16) {
        if (side === 'A') this.originalHeard = true;
        else this.remixHeard = true;
        this.stop();
      }
    }
    stop() { this.partial = null; }
    reflect(value) {
      if (!this.active || !this.originalHeard || !this.remixHeard || !REFLECTIONS.has(value)) return false;
      if (this.reflection !== value) this.complete = false;
      this.reflection = value; return true;
    }
    kept(project) {
      if (!this.view(project).canKeep) return false;
      this.complete = true; return true;
    }
    view(project) {
      this.changed(project);
      const detail = comparison(project);
      const ready = this.active && this.originalHeard && detail.changed && this.remixHeard && REFLECTIONS.has(this.reflection);
      const complete = ready && this.complete;
      const step = complete ? 6 : !this.originalHeard ? 1 : !detail.changed ? 2 : !this.remixHeard ? 3 : !this.reflection ? 4 : 5;
      return { active: this.active, originalHeard: this.originalHeard, changed: detail.changed, remixHeard: this.remixHeard,
        reflection: this.reflection, complete, canKeep: ready && !complete, step, hint: detail.hint, notice: detail.notice,
        hintStep: detail.hintStep, hintAction: detail.hintAction };
    }
  }
  globalThis.DCArcadeMission = { Session };
})();
