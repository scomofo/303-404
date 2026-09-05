/* A portable project contains musical data only. Audio nodes and takes stay out. */
(() => {
  const VERSION = 1;
  const PREFIX = '303-404/studio/project/';
  const SCENES = ['A', 'B', 'C', 'D'];
  const VOICES = ['ac', 'bd', 'sd', 'lt', 'mt', 'ht', 'rs', 'cp', 'cb', 'cy', 'oh', 'ch'];
  const copy = value => JSON.parse(JSON.stringify(value));
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const number = (value, min, max, label, integer = false) => {
    if (!Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) throw new Error(`Invalid ${label}.`);
    return value;
  };
  const text = (value, max, label) => {
    if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`Invalid ${label}.`);
    return value.trim();
  };
  function noteMidi(note) {
    if (note === null) return null;
    const match = typeof note === 'string' && /^([A-G])(#?)([0-8])$/.exec(note);
    if (!match) throw new Error('Notes must use names such as C2 or F#3, or a rest.');
    return (Number(match[3]) + 1) * 12 + { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[match[1]] + (match[2] ? 1 : 0);
  }
  function indices(values, length, label) {
    if (!Array.isArray(values) || values.length > length) throw new Error(`Invalid ${label}.`);
    const unique = new Set();
    for (const value of values) unique.add(number(value, 0, length - 1, label, true));
    return [...unique].sort((a, b) => a - b);
  }
  function sourceInfo(value) {
    if (!record(value)) throw new Error('Missing pattern attribution.');
    return {
      id: text(value.id, 160, 'source ID'), title: text(value.title, 200, 'source title'),
      type: text(value.type, 40, 'source type'),
      detail: typeof value.detail === 'string' ? value.detail.slice(0, 1500) : '',
      review: value.review === true, edited: value.edited === true,
    };
  }
  function validateProject(value) {
    if (!record(value) || value.version !== VERSION) throw new Error('This is not a supported Groove Studio project.');
    const id = text(value.id, 100, 'project ID');
    if (!/^[a-zA-Z0-9-]+$/.test(id)) throw new Error('Invalid project ID.');
    if (!Array.isArray(value.scenes) || value.scenes.length !== 4) throw new Error('Projects need four scenes.');
    const scenes = SCENES.map((id, index) => {
      const s = value.scenes[index];
      if (!record(s) || s.id !== id || !record(s.drums) || !record(s.bass) || !record(s.mix)) throw new Error('Invalid scene.');
      if (![16, 32].includes(s.drums.steps) || !record(s.drums.rows)) throw new Error('Drum patterns need 16 or 32 steps.');
      const rows = Object.fromEntries(VOICES.map(voice => [voice, indices(s.drums.rows[voice] || [], s.drums.steps, 'drum hits')]));
      if (!Array.isArray(s.bass.notes) || s.bass.notes.length < 2 || s.bass.notes.length > 32) throw new Error('Bass patterns need 2–32 steps.');
      const notes = s.bass.notes.map(note => { noteMidi(note); return note; });
      if (!['sawtooth', 'square'].includes(s.bass.waveform)) throw new Error('Invalid bass waveform.');
      const mix = {};
      for (const key of ['drums', 'bass']) mix[key] = number(s.mix[key], 0, 1, `${key} level`);
      for (const key of ['muteDrums', 'muteBass']) {
        if (typeof s.mix[key] !== 'boolean') throw new Error('Invalid mute state.');
        mix[key] = s.mix[key];
      }
      mix.cutoff = number(s.mix.cutoff, 100, 6000, 'cutoff');
      mix.resonance = number(s.mix.resonance, 0.5, 12, 'resonance');
      const pair = {};
      if (s.drums.pair?.rs === 'CL') pair.rs = 'CL';
      if (s.drums.pair?.cp === 'MA') pair.cp = 'MA';
      return { id, name: text(s.name, 40, 'scene name'),
        drums: { steps: s.drums.steps, rows, pair, source: sourceInfo(s.drums.source) },
        bass: { notes, accent: indices(s.bass.accent, notes.length, 'accents'), slide: indices(s.bass.slide, notes.length, 'slides'), waveform: s.bass.waveform, source: sourceInfo(s.bass.source) }, mix };
    });
    if (!Array.isArray(value.arrangement) || value.arrangement.length < 1 || value.arrangement.length > 8) throw new Error('Use 1–8 arrangement sections.');
    const arrangement = value.arrangement.map(part => {
      if (!record(part) || !SCENES.includes(part.scene)) throw new Error('Invalid arrangement scene.');
      return { scene: part.scene, bars: number(part.bars, 1, 16, 'section bars', true) };
    });
    if (arrangement.reduce((sum, part) => sum + part.bars, 0) > 32) throw new Error('Keep arrangements within 32 bars.');
    return { version: VERSION, id, name: text(value.name, 80, 'project name'),
      bpm: number(value.bpm, 40, 240, 'tempo'), master: number(value.master, 0, 1, 'master level'),
      scenes, arrangement, updatedAt: Number.isFinite(value.updatedAt) ? Math.max(0, value.updatedAt) : 0 };
  }
  function attribution(card) {
    return { id: card.id, title: card.title, type: card.sourceType,
      detail: [card.artist, card.source, card.tag].filter(Boolean).join(' · '),
      review: card.needsAccentSlideReview === true, edited: false };
  }
  function drumsFromCard(card) {
    return { steps: card.steps, rows: Object.fromEntries(VOICES.map(v => [v, [...(card.rows[v] || [])]])),
      pair: copy(card.pair || {}), source: attribution(card) };
  }
  function bassFromCard(card) {
    return { notes: [...card.notes], accent: [...card.accent], slide: [...card.slide], waveform: card.waveform || 'sawtooth', source: attribution(card) };
  }
  function newId() {
    return globalThis.crypto?.randomUUID?.() || `project-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
  function createProject(banks, selections = {}) {
    const drum = banks.drums.find(card => card.id === selections.drums) || banks.drums.find(card => card.id === 'four-on-the-floor');
    const bass = banks.bass.find(card => card.id === selections.bass) || banks.bass.find(card => card.id === 'practice-1');
    const names = ['Intro', 'Groove', 'Breakdown', 'Return'];
    return validateProject({ version: VERSION, id: newId(), name: 'My first groove', bpm: 128, master: 0.7, updatedAt: 0,
      scenes: SCENES.map((id, i) => ({ id, name: names[i], drums: drumsFromCard(drum), bass: bassFromCard(bass),
        mix: { drums: 0.75, bass: 0.65, muteDrums: i === 2, muteBass: i === 0, cutoff: [650, 1200, 700, 2200][i], resonance: 5 } })),
      arrangement: SCENES.map(scene => ({ scene, bars: 8 })) });
  }
  function totalBars(project) { return project.arrangement.reduce((sum, part) => sum + part.bars, 0); }
  function duration(project) { return totalBars(project) * 240 / project.bpm; }
  // Every lane shares a sixteenth-note clock. A 10-step bass pattern keeps its
  // own cycle against the 16/32-step drums; a section change resets both lanes.
  function arrangementEvents(project) {
    const events = [];
    let step = 0;
    project.arrangement.forEach((part, section) => {
      for (let tick = 0; tick < part.bars * 16; tick++, step++) {
        events.push({ sceneId: part.scene, section, tick, step, time: step * 15 / project.bpm,
          bar: Math.floor(step / 16), first: tick === 0 });
      }
    });
    return events;
  }
  class ProjectStore {
    constructor(storage) { this.storage = storage; this.seen = new Map(); }
    list() {
      const projects = [], damaged = [];
      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i);
        if (!key?.startsWith(PREFIX)) continue;
        const raw = this.storage.getItem(key);
        try {
          const project = validateProject(JSON.parse(raw));
          if (key !== PREFIX + project.id) throw new Error('Project ID mismatch');
          projects.push(project); this.seen.set(project.id, raw);
        } catch { damaged.push(key); }
      }
      return { projects: projects.sort((a, b) => b.updatedAt - a.updatedAt), damaged };
    }
    save(project) {
      const validated = validateProject(project);
      const previous = this.storage.getItem(PREFIX + project.id);
      if (previous !== (this.seen.get(project.id) ?? null)) throw new Error('This project changed in another tab. Save a copy to keep both versions.');
      validated.updatedAt = Date.now();
      const raw = JSON.stringify(validated);
      this.storage.setItem(PREFIX + project.id, raw);
      this.seen.set(project.id, raw);
      project.updatedAt = validated.updatedAt;
      return validated;
    }
    remove(id) {
      if (this.storage.getItem(PREFIX + id) !== this.seen.get(id)) throw new Error('This project changed in another tab. Reload before deleting it.');
      this.storage.removeItem(PREFIX + id); this.seen.delete(id);
    }
  }
  globalThis.DCStudioProject = { VERSION, PREFIX, SCENES, VOICES, copy, noteMidi, validateProject,
    drumsFromCard, bassFromCard, newId, createProject, totalBars, duration, arrangementEvents, ProjectStore };
})();
