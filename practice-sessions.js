/* Original, browser-first practice curriculum. No hardware or audio imports needed. */
(() => {
  const sessions = [
    {
      id: 'pocket', title: 'Find the pocket', minutes: 10, skill: 'Rhythm & listening',
      outcome: 'A drum groove with a clear pulse and one deliberate change.',
      steps: [
        'Open scene B (Groove in the starter), then press Play scene. Count “1, 2, 3, 4” through four repeats before editing.',
        'Mute bass. Choose CH in Edit voice and toggle two different steps once each. Listen for four repeats. Press Undo twice, then Play scene to hear the original; press Redo twice, then Play scene to hear your variation again.',
        'Keep the variation, or press Undo twice to restore the original hats. Unmute bass, press Play scene and save your project with a name you will recognise.',
      ],
      checks: ['I can count the pulse through four repeats.', 'I compared the original hats with my variation.', 'I chose a version and saved my project.'],
      listen: 'Does the groove still feel steady when the hats change? More hits do not automatically make it stronger.',
      stretch: 'Remove two hits instead of adding them. Can the extra space make the pulse clearer?',
    },
    {
      id: 'bass-space', title: 'Give the bass room', minutes: 10, skill: 'Bass & rhythm',
      outcome: 'A bass phrase with a recognisable rhythm and purposeful silence.',
      steps: [
        'Keep working in scene B. Loop the scene and listen to how the bass rhythm sits against the kick.',
        'Select a sounding bass step and set Note to Rest. Repeat with one more sounding step. Press Undo twice, then Play scene to hear the original; press Redo twice, then Play scene to hear the phrase with two rests.',
        'Keep the two rests, or press Undo twice to restore the original phrase. Select a sounding note, compare Accent off and on, pressing Play scene if playback has stopped. Listen for four repeats with Accent on and save the project.',
      ],
      checks: ['I compared the bass phrase with and without two notes.', 'I can hear the accented note in the phrase.', 'I kept and saved the version with the clearest rhythm.'],
      listen: 'Can you hum the bass rhythm after playback stops? Listen for a phrase, not just a stream of notes.',
      stretch: 'Try Slide to next note on a note followed by another sounding note. Compare its joined movement with the unconnected pair.',
    },
    {
      id: 'variation', title: 'Make an answer', minutes: 15, skill: 'Variation & contrast',
      outcome: 'Two related scenes that sound like a statement and an answer.',
      steps: [
        'Stop playback and Save a copy if scene D already contains something you want to keep. Select B, choose D in Copy this scene to, and press Copy scene.',
        'Select D and change only two drum hits and one bass note. Give D a name that describes the answer.',
        'Select B and press Play scene, then select D while it loops. The switch lands on a bar boundary. Compare both directions and save.',
      ],
      checks: ['I made a second scene while keeping the first intact.', 'I can hear the shared idea and the changed answer.', 'I switched between the scenes and saved both.'],
      listen: 'Is the answer recognisable as the same groove? Small changes can make a stronger response than replacing everything.',
      stretch: 'Select D and toggle one of the drum hits you changed back to its original state. Press Play scene and decide whether the simpler answer works better.',
    },
    {
      id: 'breakdown', title: 'Create some space', minutes: 10, skill: 'Arrangement & subtraction',
      outcome: 'A breakdown that makes the full groove feel bigger when it returns.',
      steps: [
        'Select scene C (Breakdown in the starter). If using your own project, keep a copy before replacing any scene.',
        'Loop C with drums muted and bass audible. Lower Cutoff gradually until the scene feels quieter in tone; keep the master level comfortable.',
        'While looping C, select B to bring back the full groove on a bar boundary. Compare the contrast and save your scene settings.',
      ],
      checks: ['I created a scene with fewer audible layers.', 'I compared the breakdown with the full groove.', 'I saved a contrast I can clearly hear.'],
      listen: 'Does the return feel more energetic without simply turning up Master?',
      stretch: 'Try a drums-only breakdown instead. Choose the version that sets up the stronger return.',
    },
    {
      id: 'shape', title: 'Shape a short set', minutes: 15, skill: 'Phrasing & form',
      outcome: 'A complete intro, groove, breakdown and return.',
      steps: [
        'Stop playback. In Arrangement, set four sections to A, B, C and D, with 4, 8, 4 and 8 bars respectively. Remove or add sections as needed.',
        'Press Play arrangement. Listen all the way through without editing and count each change of section.',
        'Decide whether one section lasts too long. Adjust its bar count if needed, stay within 32 total bars, and save the project.',
      ],
      checks: ['My arrangement has an intro, groove, breakdown and return.', 'I listened to a complete pass without editing.', 'I chose section lengths deliberately and saved them.'],
      listen: 'Does each new section arrive when you expect it? Can you describe why each section is there?',
      stretch: 'Try a shorter breakdown. Compare the amount of anticipation before the return.',
    },
    {
      id: 'perform', title: 'Rehearse the return', minutes: 15, skill: 'Live performance',
      outcome: 'A repeatable scene performance with one controlled sound change.',
      steps: [
        'Save a copy for rehearsal. Press Play scene and practise moving B → C → D, counting eight bars before each launch.',
        'During C, move Cutoff slowly. Select D for the return, then release the controls and listen to the groove settle.',
        'Repeat the same sequence twice. If you lose count, keep the current scene looping, find beat one and try the launch again. Save your preferred scene settings.',
      ],
      checks: ['I rehearsed the same scene sequence twice.', 'I made one intentional cutoff change.', 'I can recover my count and launch the return again.'],
      listen: 'Did the sound change support the transition? Aim for an action you can repeat instead of constant knob movement.',
      stretch: 'Use Record take in Live take, if available, to capture the gestures. Press Stop recording, listen back and download the take before leaving the page.',
    },
    {
      id: 'finish', title: 'Keep a finished take', minutes: 15, skill: 'Finishing & reflection',
      outcome: 'A saved project, a portable backup and an audio export you have heard.',
      steps: [
        'Play your arrangement from beginning to end. Pick one small improvement, make it, and save the project.',
        'Use Export arrangement WAV, then open the downloaded audio and listen through it. This renders scene settings; use a downloaded live take to keep performance gestures.',
        'Open Projects & backups and choose Download project backup as well as keeping your audio. Write one thing that works and one thing to try on your next groove.',
      ],
      checks: ['I listened to a complete final arrangement.', 'I exported audio and listened to the downloaded result.', 'I kept a project backup and identified my next improvement.'],
      listen: 'Does the export tell the same musical story as your arrangement? Check the opening, transitions and ending.',
      stretch: 'Make a new project with a different drum pattern, then repeat the path using the same listening goals.',
    },
  ];
  const PREFIX = '303-404/practice-sessions/v1/';
  const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const getSession = id => sessions.find(session => session.id === id) || null;
  const emptyRecord = session => ({ version: 1, checks: session.checks.map(() => false), reflection: '', note: '', completedAt: 0, updatedAt: 0, days: [] });
  const hasDraft = record => !!record && (
    Array.isArray(record.checks) && record.checks.some(checked => checked === true) ||
    typeof record.note === 'string' && record.note.trim().length > 0 ||
    typeof record.reflection === 'string' && record.reflection.length > 0 ||
    Number.isFinite(record.updatedAt) && record.updatedAt > 0
  );
  function localDay(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  function validDay(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [y, m, d] = value.split('-').map(Number);
    return localDay(new Date(y, m - 1, d)) === value;
  }
  function normalizeRecord(session, value) {
    if (!isRecord(value) || value.version !== 1) throw new Error('This session save could not be read. Its existing data has been kept.');
    return {
      version: 1,
      checks: session.checks.map((_, i) => Array.isArray(value.checks) && value.checks[i] === true),
      reflection: ['ready', 'revisit'].includes(value.reflection) ? value.reflection : '',
      note: typeof value.note === 'string' ? value.note.slice(0, 500) : '',
      completedAt: Number.isFinite(value.completedAt) && value.completedAt > 0 ? value.completedAt : 0,
      updatedAt: Number.isFinite(value.updatedAt) && value.updatedAt > 0 ? value.updatedAt : 0,
      days: Array.isArray(value.days) ? [...new Set(value.days.filter(validDay))].sort().slice(-180) : [],
    };
  }
  function complete(session, record, now = new Date()) {
    const next = normalizeRecord(session, record);
    if (!next.checks.every(Boolean) || !next.reflection) throw new Error('Check each listening goal and choose how it felt before saving the session.');
    next.completedAt = now.getTime();
    next.days = [...new Set([...next.days, localDay(now)])].sort().slice(-180);
    return next;
  }
  function summarize(records, now = new Date()) {
    const lastWeek = new Set();
    for (let i = 0; i < 7; i++) {
      const day = new Date(now); day.setDate(day.getDate() - i); lastWeek.add(localDay(day));
    }
    const days = new Set();
    let completed = 0;
    for (const session of sessions) {
      const record = records[session.id];
      if (record?.completedAt) completed++;
      for (const day of record?.days || []) if (lastWeek.has(day)) days.add(day);
    }
    return { completed, practiceDays: days.size };
  }
  function recommended(records) {
    const drafts = sessions.filter(session => !records[session.id]?.completedAt && hasDraft(records[session.id]));
    const latest = drafts.reduce((chosen, session) => !chosen ||
      (records[session.id].updatedAt || 0) > (records[chosen.id].updatedAt || 0) ? session : chosen, null);
    return latest || sessions.find(session => !records[session.id]?.completedAt) ||
      sessions.find(session => records[session.id]?.reflection === 'revisit') || sessions[sessions.length - 1];
  }
  class PracticeStore {
    constructor(storage) { this.storage = storage; this.seen = new Map(); this.blocked = new Set(); }
    read(session) {
      try {
        const raw = this.storage.getItem(PREFIX + session.id);
        const record = raw === null ? emptyRecord(session) : normalizeRecord(session, JSON.parse(raw));
        this.seen.set(session.id, raw); this.blocked.delete(session.id);
        return record;
      } catch (error) { this.blocked.add(session.id); throw error; }
    }
    readAll() {
      const records = {}, errors = [];
      for (const session of sessions) {
        try { records[session.id] = this.read(session); }
        catch { records[session.id] = emptyRecord(session); errors.push(session.id); }
      }
      return { records, errors };
    }
    save(session, record, now = new Date()) {
      if (this.blocked.has(session.id)) throw new Error('This session save is unavailable. Existing data has been kept; other sessions can still be opened.');
      const previous = this.storage.getItem(PREFIX + session.id);
      if (!this.seen.has(session.id) || previous !== this.seen.get(session.id)) throw new Error('This session changed in another tab. Copy your note, then reload this page before saving again.');
      const next = { ...normalizeRecord(session, record), updatedAt: now.getTime() }, raw = JSON.stringify(next);
      this.storage.setItem(PREFIX + session.id, raw);
      this.seen.set(session.id, raw);
      return next;
    }
  }
  globalThis.DCPracticeSessions = { sessions, PREFIX, getSession, emptyRecord, hasDraft, localDay, normalizeRecord, complete, summarize, recommended, PracticeStore };
})();
