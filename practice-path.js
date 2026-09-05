/* The same session brief follows the learner from Home into Groove Studio. */
(() => {
  const P = globalThis.DCPracticeSessions;
  if (!P || typeof document === 'undefined') return;
  const $ = id => document.getElementById(id);
  const make = (tag, text, props = {}) => Object.assign(document.createElement(tag), { textContent: text, ...props });
  let store;
  try { store = new P.PracticeStore(window.localStorage); }
  catch { store = new P.PracticeStore({ getItem() { throw new Error('Storage unavailable'); } }); }
  const sessionHref = session => `./groove-studio.html?mission=${encodeURIComponent(session.id)}`;

  function mountHome() {
    const panel = document.querySelector('[data-practice-home]');
    if (!panel) return;
    let selected = null;
    // Returning from a launched session should offer the next unfinished one,
    // including when the browser restores this page from its Back/Forward cache.
    $('practice-session-link').addEventListener('click', () => { selected = null; });
    const buttons = new Map();
    const list = $('practice-path-list');
    for (const [i, session] of P.sessions.entries()) {
      const item = make('li', '');
      const button = make('button', '', { type: 'button', className: 'path-step' });
      const state = make('span', 'Not yet completed', { className: 'path-step-state' });
      button.append(make('span', String(i + 1).padStart(2, '0'), { className: 'path-number', ariaHidden: 'true' }), make('span', session.title), state);
      button.addEventListener('click', () => { selected = session.id; refresh(); $('practice-session-title').focus(); });
      item.append(button); list.append(item); buttons.set(session.id, { button, state });
    }
    function refresh() {
      const { records, errors } = store.readAll();
      const summary = P.summarize(records);
      const session = P.getSession(selected) || P.recommended(records);
      $('path-count').textContent = `${summary.completed} of ${P.sessions.length} sessions completed`;
      $('path-progress').value = summary.completed;
      $('practice-days').textContent = `${summary.practiceDays} practice ${summary.practiceDays === 1 ? 'day' : 'days'} in the last 7 days`;
      $('path-storage').hidden = !errors.length;
      $('path-storage').textContent = errors.length ? 'Some session saves are unavailable. You can still open every session and course.' : '';
      for (const candidate of P.sessions) {
        const { button, state } = buttons.get(candidate.id), record = records[candidate.id];
        button.setAttribute('aria-pressed', String(candidate.id === session.id));
        button.dataset.complete = !!record.completedAt;
        state.textContent = record.completedAt ? record.reflection === 'revisit' ? 'Completed · Revisit' : 'Completed' : record.checks.some(Boolean) ? 'In progress' : 'Not yet completed';
      }
      $('practice-session-title').textContent = session.title;
      $('practice-session-meta').textContent = `Session ${P.sessions.indexOf(session) + 1} · About ${session.minutes} min · ${session.skill}`;
      $('practice-session-outcome').textContent = session.outcome;
      $('practice-session-listen').textContent = session.listen;
      const record = records[session.id];
      $('practice-session-note').hidden = !record.note;
      $('practice-session-note').textContent = record.note ? `Your note: ${record.note}` : '';
      $('practice-session-link').href = sessionHref(session);
      $('practice-session-link').textContent = record.completedAt ? 'Practise this again' : record.checks.some(Boolean) ? 'Continue session' : 'Start this session';
      $('path-complete').hidden = summary.completed !== P.sessions.length;
    }
    refresh();
    window.addEventListener('pageshow', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', event => { if (event.key === null || event.key.startsWith(P.PREFIX)) refresh(); });
  }

  function mountStudio() {
    const panel = document.querySelector('[data-practice-studio]');
    if (!panel) return;
    const params = new URLSearchParams(window.location.search);
    const initial = P.getSession(params.get('mission'));
    if (!initial) return; // Free play and unknown links leave the studio usable.
    const drafts = new Map();
    let current;
    function open(session, focus = false) {
      current = session;
      let record, readError = false;
      try { record = drafts.get(session.id) || store.read(session); }
      catch { record = P.emptyRecord(session); readError = true; }
      panel.hidden = false;
      panel.open = true;
      $('guided-session-heading').textContent = `Session ${P.sessions.indexOf(session) + 1} · ${session.title}`;
      const body = $('guided-session-body');
      const brief = make('div', '', { className: 'session-brief' });
      brief.append(make('p', `About ${session.minutes} min · ${session.skill}`, { className: 'session-meta' }), make('h2', session.outcome));
      const steps = make('ol', '', { className: 'session-instructions' });
      session.steps.forEach(step => steps.append(make('li', step)));
      brief.append(steps, make('p', `Listen for: ${session.listen}`, { className: 'session-listen' }));
      const stretch = make('details', '', { className: 'session-stretch' });
      stretch.append(make('summary', 'Want another challenge?'), make('p', session.stretch)); brief.append(stretch);

      const form = make('form', '', { className: 'session-reflection' });
      const goals = make('fieldset', ''); goals.append(make('legend', 'After listening, check your goals'));
      const feedback = make('p', '', { className: 'session-feedback', role: 'status' });
      const failure = make('p', '', { className: 'session-error', role: 'alert', hidden: !readError });
      if (readError) failure.textContent = 'Saved session data is unavailable. You can follow the brief; existing data has been kept.';
      const submit = make('button', 'Save completed session', { type: 'submit', className: 'session-primary' });
      const next = make('button', '', { type: 'button', className: 'session-next', hidden: true });
      const hint = make('p', 'Check all three goals and choose how it felt to complete a session.', { className: 'session-meta', id: 'session-completion-hint' });
      submit.setAttribute('aria-describedby', hint.id);
      function update() {
        submit.disabled = !record.checks.every(Boolean) || !record.reflection;
        submit.textContent = record.completedAt ? 'Save another practice' : 'Save completed session';
        const index = P.sessions.indexOf(session), following = P.sessions[index + 1];
        next.hidden = !record.completedAt || !following;
        if (following) next.textContent = `Next: ${following.title}`;
      }
      function saveDraft() {
        drafts.set(session.id, record);
        try {
          record = store.save(session, record); failure.hidden = true;
          if (feedback.textContent !== 'Checklist and reflection saved.') feedback.textContent = 'Checklist and reflection saved.';
        } catch (error) {
          feedback.textContent = 'Changes are not saved.';
          failure.hidden = false;
          failure.textContent = /another tab|existing|Existing/.test(error.message) ? error.message : 'Could not save your session in this browser. Keep your note elsewhere and try saving again.';
        }
        update();
      }
      session.checks.forEach((text, i) => {
        const label = make('label', '', { className: 'session-check' });
        const input = make('input', '', { type: 'checkbox', checked: record.checks[i] });
        input.addEventListener('change', () => { record = { ...record, checks: record.checks.map((checked, index) => index === i ? input.checked : checked) }; saveDraft(); });
        label.append(input, make('span', text)); goals.append(label);
      });
      const feeling = make('label', 'How did it feel?');
      const select = make('select', '');
      for (const [value, label] of [['', 'Choose after practising'], ['ready', 'Ready to build on this'], ['revisit', 'Worth another pass']]) select.append(make('option', label, { value }));
      select.value = record.reflection;
      select.addEventListener('change', () => { record = { ...record, reflection: select.value }; saveDraft(); });
      feeling.append(select);
      const noteLabel = make('label', 'What worked? What will you try next? (optional)');
      const note = make('textarea', '', { maxLength: 500, rows: 3, value: record.note, placeholder: 'The quieter hats helped. Next time, leave more room before the return.' });
      note.addEventListener('input', () => { record = { ...record, note: note.value }; saveDraft(); });
      noteLabel.append(note);
      form.addEventListener('submit', event => {
        event.preventDefault();
        try {
          const completed = P.complete(session, record);
          record = store.save(session, completed); drafts.set(session.id, record);
          failure.hidden = true;
          feedback.textContent = session.id === 'finish' ? 'Session complete. Keep your finished groove and bring one idea into your next project.' : 'Session complete. Your listening goals and reflection are saved.';
          update();
        } catch (error) {
          failure.hidden = false;
          failure.textContent = /another tab|before saving|existing|Existing/.test(error.message) ? error.message : 'Session completion was not saved. Keep your note elsewhere and try again.';
        }
      });
      next.addEventListener('click', () => {
        const following = P.sessions[P.sessions.indexOf(session) + 1];
        if (!following) return;
        const url = new URL(window.location.href); url.searchParams.set('mission', following.id);
        window.history.replaceState(null, '', url);
        open(following, true); // Keep the project, live take and transport on this page.
      });
      form.append(goals, feeling, noteLabel, hint, submit, feedback, failure, next,
        make('p', 'These are your own listening checks. Save your music with the studio controls; session progress does not contain audio.', { className: 'session-meta' }));
      body.replaceChildren(brief, form);
      update();
      if (record.completedAt) feedback.textContent = 'Completed before. Practise again or move to the next session.';
      if (focus) $('guided-session-heading').focus();
    }
    open(initial);
    window.addEventListener('storage', event => {
      if (event.key === null || event.key === P.PREFIX + current.id) {
        const failure = panel.querySelector('.session-error');
        failure.hidden = false;
        failure.textContent = 'This session changed in another tab. Copy your note, then reload before saving again.';
      }
    });
  }
  mountHome();
  mountStudio();
})();
