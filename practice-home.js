/* Progressive enhancement: the six course links work before this script runs. */
(() => {
  const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

  function summarizeProgress(course, raw) {
    let saved;
    try { saved = JSON.parse(raw); } catch { return null; }
    if (!isRecord(saved) || saved.version !== course.version || !isRecord(saved.state)) return null;
    const state = saved.state;
    const step = Number.isFinite(state.step)
      ? Math.max(0, Math.min(course.steps.length - 1, Math.floor(state.step))) : 0;
    const checks = isRecord(state.checks) ? state.checks : {};
    let checked = 0, total = 0;
    for (const lesson of course.steps) {
      total += lesson.items;
      const values = Object.hasOwn(checks, lesson.id) && Array.isArray(checks[lesson.id]) ? checks[lesson.id] : [];
      for (let i = 0; i < lesson.items; i++) if (values[i] === true) checked++;
    }
    return {
      course, step, lesson: course.steps[step], checked, total,
      // Position is navigation, not evidence that a learner completed a drill.
      percent: total ? Math.round(checked / total * 100) : 0,
      started: step > 0 || checked > 0,
      savedAt: Number.isFinite(saved.savedAt) && saved.savedAt > 0 ? saved.savedAt : 0,
    };
  }

  function readProgress(courses, storage) {
    const sessions = [];
    let unavailable = false;
    for (const course of courses) {
      try {
        const summary = summarizeProgress(course, storage.getItem(course.storageKey));
        if (summary) sessions.push(summary);
      } catch { unavailable = true; }
    }
    return { sessions, unavailable };
  }

  function latestSession(sessions) {
    return sessions.filter(session => session.started)
      .reduce((latest, session) => !latest || session.savedAt > latest.savedAt ? session : latest, null);
  }

  function mount(doc, win, courses) {
    const elements = new Map(Array.from(doc.querySelectorAll('[data-course]'), card => [card.dataset.course, card]));
    const refresh = () => {
      let result;
      try { result = readProgress(courses, win.localStorage); }
      catch { result = { sessions: [], unavailable: true }; }
      for (const course of courses) {
        const card = elements.get(course.id);
        if (!card) continue;
        const progress = result.sessions.find(session => session.course.id === course.id);
        const started = !!progress?.started;
        card.querySelector('.course-status').textContent = started
          ? `${progress.checked} of ${progress.total} checklist items checked`
          : result.unavailable ? 'Open course to practise' : 'Ready for your first session';
        const meter = card.querySelector('progress');
        meter.hidden = !started;
        meter.value = progress?.percent || 0;
        const position = card.querySelector('.course-position');
        position.hidden = !started;
        position.textContent = started ? `Last opened: ${progress.lesson.week} · Step ${progress.step + 1} of ${course.steps.length}` : '';
        card.querySelector('.course-action').textContent = started ? 'Continue course' : 'Start course';
      }
      const latest = latestSession(result.sessions);
      doc.getElementById('continue-practice').hidden = !latest;
      if (latest) {
        const card = elements.get(latest.course.id);
        doc.getElementById('continue-title').textContent = card.querySelector('h3').textContent;
        doc.getElementById('continue-lesson').textContent = `${latest.lesson.week} · ${latest.lesson.title}`;
        doc.getElementById('continue-progress').textContent = `Step ${latest.step + 1} of ${latest.course.steps.length} · ${latest.checked} of ${latest.total} checklist items checked`;
        // The guide hydrates its saved state; no URL parameter overwrites its lesson.
        doc.getElementById('continue-link').href = card.querySelector('.course-link').href;
      }
      doc.getElementById('storage-status').textContent = result.unavailable
        ? 'Saved progress is unavailable in this browser. You can still open every course.'
        : 'Progress stays in this browser. No account required.';
    };
    refresh();
    // Back/Forward cache and another open course tab must not leave stale cards.
    win.addEventListener('pageshow', refresh);
    win.addEventListener('focus', refresh);
    win.addEventListener('storage', event => {
      if (event.key === null || courses.some(course => course.storageKey === event.key)) refresh();
    });
  }

  // Also usable by the dependency-free Node tests, without a DOM or audio runtime.
  globalThis.DCPracticeHome = { summarizeProgress, readProgress, latestSession };
  if (typeof document !== 'undefined' && globalThis.DCCourseCatalog) {
    mount(document, window, globalThis.DCCourseCatalog);
  }
})();
