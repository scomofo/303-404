/* Original rhythm puzzles. Stars measure exact step patterns, never timing. */
(() => {
  const P = globalThis.DCStudioProject;
  const VOICES = [
    { key: 'bd', name: 'Kick', cue: 'The low thump' },
    { key: 'sd', name: 'Snare', cue: 'The sharp crack' },
    { key: 'ch', name: 'Hi-hat', cue: 'The short tick' },
  ];
  const CHALLENGES = [
    { id: 'first-floor', title: 'Four on the floor', level: 'Warm-up', bpm: 108,
      tip: 'Find the four steady kicks first. The snare answers on beats 2 and 4.',
      rows: { bd: [0, 4, 8, 12], sd: [4, 12], ch: [2, 6, 10, 14] } },
    { id: 'night-drive', title: 'Night drive', level: 'Warm-up', bpm: 112,
      tip: 'The hats tick twice per beat. Listen for the space between the kicks.',
      rows: { bd: [0, 8], sd: [4, 12], ch: [0, 2, 4, 6, 8, 10, 12, 14] } },
    { id: 'side-street', title: 'Side street', level: 'Find the detail', bpm: 100,
      tip: 'One kick arrives just before beat 3. Solo the kick to find it.',
      rows: { bd: [0, 6, 8], sd: [4, 12], ch: [0, 2, 4, 6, 8, 10, 12, 14] } },
    { id: 'half-time', title: 'Half-time orbit', level: 'Find the detail', bpm: 124,
      tip: 'The snare lands only once. Count all four beats before the loop returns.',
      rows: { bd: [0, 3, 10], sd: [8], ch: [0, 2, 4, 6, 8, 10, 12, 14, 15] } },
    { id: 'broken-signal', title: 'Broken signal', level: 'Deep listening', bpm: 116,
      tip: 'A late kick and an extra snare give this loop its uneven bounce.',
      rows: { bd: [0, 7, 10], sd: [4, 11, 12], ch: [0, 2, 6, 8, 10, 14] } },
    { id: 'last-train', title: 'Last train home', level: 'Deep listening', bpm: 120,
      tip: 'Listen to each instrument on its own. The last two hat ticks lead into the next loop.',
      rows: { bd: [0, 5, 8, 14], sd: [4, 12, 15], ch: [0, 2, 3, 6, 8, 10, 14, 15] } },
  ];
  const PREFIX = '303-404/arcade/v1/';
  const EARNED = JSON.stringify({ version: 1, earned: true });
  const emptyRows = () => Object.fromEntries(VOICES.map(v => [v.key, []]));
  function copyRows(rows) {
    return Object.fromEntries(VOICES.map(({ key }) => {
      if (!Array.isArray(rows?.[key]) || rows[key].some(i => !Number.isInteger(i) || i < 0 || i > 15)) throw new Error('Use steps 1–16 for each instrument.');
      return [key, [...new Set(rows[key])].sort((a, b) => a - b)];
    }));
  }
  function check(rows, challenge) {
    const clean = copyRows(rows);
    const lanes = VOICES.map(({ key, name }) => {
      const missing = challenge.rows[key].filter(i => !clean[key].includes(i));
      const extra = clean[key].filter(i => !challenge.rows[key].includes(i));
      return { key, name, missing, extra, matched: !missing.length && !extra.length };
    });
    return { stars: lanes.filter(lane => lane.matched).length, lanes };
  }
  function createProject(banks, challenge, rows, { solo = 'all', bpm = challenge.bpm } = {}) {
    const clean = copyRows(rows), project = P.createProject(banks);
    project.name = `${challenge.title} · My beat`; project.bpm = bpm;
    for (const scene of project.scenes) {
      scene.drums = { steps: 16, pair: {},
        rows: Object.fromEntries(P.VOICES.map(key => [key, [...((solo === 'all' || solo === key) ? clean[key] || [] : [])]])),
        source: { id: `arcade-${challenge.id}`, title: challenge.title, type: 'original_practice',
          detail: 'An original Beat Arcade exercise. These are the player’s selected steps.', review: false, edited: true } };
      scene.bass.notes = Array(16).fill(null); scene.bass.accent = []; scene.bass.slide = [];
      scene.bass.source.edited = true;
      scene.mix.muteBass = true; scene.mix.muteDrums = false;
    }
    project.arrangement = [{ scene: 'B', bars: 4 }];
    return P.validateProject(project);
  }
  // Immutable award keys keep an older tab from replacing a better result.
  // No reading, opening, hinting or playback awards stars.
  function readBest(storage, id) {
    let best = 0, damaged = false;
    for (let stars = 1; stars <= 3; stars++) {
      const raw = storage.getItem(`${PREFIX}${id}/${stars}`);
      if (raw === EARNED) best = stars;
      else if (raw !== null) damaged = true;
    }
    return { best, damaged };
  }
  function saveBest(storage, id, stars) {
    if (!CHALLENGES.some(c => c.id === id) || !Number.isInteger(stars) || stars < 0 || stars > 3) throw new Error('Invalid challenge result.');
    const current = readBest(storage, id);
    if (!stars || stars <= current.best) return current;
    const key = `${PREFIX}${id}/${stars}`, raw = storage.getItem(key);
    if (raw !== null && raw !== EARNED) throw new Error('An unreadable score was left untouched.');
    storage.setItem(key, EARNED);
    return readBest(storage, id);
  }
  globalThis.DCBeatArcade = { VOICES, CHALLENGES, PREFIX, emptyRows, copyRows, check, createProject, readBest, saveBest };
})();
