(() => {
  const G = globalThis.DCBeatArcade, P = globalThis.DCStudioProject;
  const A = globalThis.DCStudioAudio, banks = globalThis.DCStudioBanks;
  const R = globalThis.DCArcadeRemix;
  const M = globalThis.DCArcadeMission;
  const $ = id => document.getElementById(id);
  const make = (tag, text, props = {}) => Object.assign(document.createElement(tag), { textContent: text, ...props });
  const drafts = new Map(G.CHALLENGES.map(c => [c.id, G.emptyRows()]));
  const results = new Map(), bests = new Map(), pads = new Map(), roundButtons = new Map();
  const unsavedScores = new Set();
  const remixes = new Map();
  let remixing = false, requestedSide = null, audibleSide = null;
  let index = 0, hint = false, storage = null, storageProblem = '';
  let ctx = null, resumePromise = null, transport = null, preview = null, previewTimer = null;
  let audioToken = 0, playing = null, playbackProject = null, opening = false;
  const challenge = () => G.CHALLENGES[index];
  const remix = () => remixes.get(challenge().id);
  const mission = () => remix()?.mission;
  const rows = () => remixing ? remix().session.scene.drums.rows : drafts.get(challenge().id);
  const tempo = () => Math.round(challenge().bpm * Number($('speed').value));
  const starsText = count => '★'.repeat(count) + '☆'.repeat(3 - count);
  function audioError(message) { $('audio-error').textContent = message; $('audio-error').hidden = !message; }
  function renderMode() {
    $('arcade').dataset.remix = remixing;
    $('remix-entry').hidden = !remixing;
    $('start-remix').hidden = remixing; $('back-to-challenge').hidden = !remixing;
    $('start-remix').disabled = !remix() && !G.VOICES.some(v => drafts.get(challenge().id)[v.key].length);
    $('start-remix').textContent = remix() ? 'Continue your remix ↗' : 'Remix this beat ↗';
    $('remix-entry-note').textContent = remixing ? 'The pads edit your remix. Your original is kept for comparison.' : remix() ? 'Your remix is waiting, with its original starting beat.' : 'Switch on a few pads to start your own remix.';
    $('remix-tools').hidden = !remixing;
    for (const id of ['challenge-actions', 'challenge-tip', 'result', 'round-stars']) $(id).hidden = remixing;
    $('next-beat').hidden = remixing || results.get(challenge().id)?.stars !== 3;
    $('listen-target').textContent = remixing ? '▶ A · Your original' : '▶ Hear the reference';
    $('listen-yours').textContent = remixing ? '▶ B · Your remix' : '▶ Hear your beat';
    $('open-studio').textContent = remixing ? 'Open remix in Studio ↗' : 'Make this yours in Studio ↗';
    $('challenge-title').textContent = challenge().title + (remixing ? ' · Remix' : '');
    $('challenge-meta').textContent = remixing ? 'Remix Mode · Try it your way' : `${String(index + 1).padStart(2, '0')} / 06 · ${challenge().level}`;
    $('console-intro').textContent = remixing ? 'Give your beat a twist. Try an idea, edit the pads, then compare A and B. While playing, version changes land on the next bar.' : 'Listen to the reference, then switch on the steps you hear. Each row is one instrument; every four steps make a beat.';
    const solo = $('solo').value;
    const choices = [['all', 'All instruments'], ...G.VOICES.map(v => [v.key, `${v.name} only`]), ...(remixing ? [['bass', 'Bass only']] : [])];
    $('solo').replaceChildren(...choices.map(([value, label]) => make('option', label, { value })));
    $('solo').value = choices.some(([key]) => key === solo) ? solo : 'all';
    if (remixing) renderRemixControls();
    renderMission();
  }
  function renderMission() {
    const view = remixing ? mission().view(remix().session.project) : null;
    const active = !!view?.active;
    $('mission-entry').hidden = !remixing || active;
    $('remix-mission').hidden = !active;
    for (const lane of $('pattern-grid').children) lane.dataset.mission = active && view.step === 2 && lane.dataset.voice === 'ch';
    for (const pad of pads.get('ch') || []) pad.dataset.suggestion = active && view.step === 2 && Number(pad.dataset.step) === view.hintStep;
    if (!active) return;
    const titles = ['Hear your original', 'Change the hats', 'Hear the difference', 'Name what you notice', 'Keep your version'];
    const instructions = [
      'Let A play for a full bar. Listen to how the hats sit around the kick and snare.',
      `${view.hint} Keep the kick, snare and bass as they were so you can hear what one change does.`,
      'Let B play for a full bar with all instruments. Does it feel more open, busier, or simply different? You can replay A as often as you like.',
      'Choose what you noticed. This is your listening decision; every answer is welcome.',
      'Save both versions together. You can keep exploring in Studio or perform your remix in Drop Lab.',
    ];
    const text = (id, value) => { if ($(id).textContent !== value) $(id).textContent = value; };
    text('mission-step', view.complete ? 'Mission complete · Your remix is kept' : `Step ${view.step} of 5 · ${titles[view.step - 1]}`);
    text('mission-instruction', view.complete ? 'You changed a musical detail, compared it, and kept a version. Take your idea into a performance, or return to free remixing.' : instructions[view.step - 1]);
    const done = [view.originalHeard, view.changed, view.remixHeard, !!view.reflection, view.complete];
    [...$('mission-progress').children].forEach((item, i) => {
      item.dataset.done = done[i];
      item.setAttribute('aria-current', !view.complete && view.step === i + 1 ? 'step' : 'false');
      item.setAttribute('aria-label', `${titles[i]}: ${done[i] ? 'done' : 'not yet'}`);
    });
    const notice = remix().missionError || view.notice || (view.step === 2 ? 'The outlined pad is one idea. Any hi-hat change works; use Undo whenever you like.' : '');
    text('mission-notice', notice); $('mission-notice').hidden = !notice;
    $('mission-reflection-label').hidden = view.step < 4;
    $('mission-reflection').disabled = view.complete;
    if ($('mission-reflection').value !== (view.reflection || '')) $('mission-reflection').value = view.reflection || '';
    text('mission-action', view.complete ? 'Perform this in Drop Lab ↗' : ['Hear original A', 'Go to hi-hats', 'Hear remix B', 'Choose what you noticed', 'Keep mission version'][view.step - 1]);
    $('mission-action').disabled = false;
  }
  function missionEdited() {
    if (!remixing || !mission().view(remix().session.project).active) return;
    // End lookahead audio before crediting a listen to newly edited music.
    stop('Your remix changed. Press a listen button to hear this version.');
    remix().missionError = '';
    mission().changed(remix().session.project);
    renderMission();
  }
  function renderRemixControls() {
    const session = remix().session, bass = session.scene.bass;
    $('remix-undo').disabled = !session.history.length; $('remix-redo').disabled = !session.future.length;
    $('remix-acid').children[0].textContent = bass.notes.some(Boolean) ? 'Try another bassline' : 'Add acid bass';
    $('remix-bass').textContent = bass.notes.some(Boolean) ? `${bass.source.title}: ${bass.notes.map(note => note || '—').join(' · ')}` : 'Bass is silent. Add an acid phrase to hear it with your drums.';
  }
  function updateRemixPlayback() {
    if (transport?.running && playing === 'remix') playbackProject = R.forPlayback(remix().session.project, { solo: $('solo').value, bpm: tempo() });
  }
  function markRemixUnsaved() {
    const message = 'Keep this version to save these changes in Studio.';
    if ($('remix-save-status').textContent !== message) $('remix-save-status').textContent = message;
  }
  function remixChanged(message) {
    missionEdited();
    updateRemixPlayback(); renderPads(); renderRemixControls();
    $('remix-feedback').textContent = message;
    markRemixUnsaved();
    $('handoff-status').textContent = '';
  }
  function setRemixMode(enabled) {
    if (enabled && !remix()) {
      if (!G.VOICES.some(v => drafts.get(challenge().id)[v.key].length)) return;
      const session = new R.Session(banks, challenge(), drafts.get(challenge().id));
      remixes.set(challenge().id, { session, mission: new M.Session(session.project), missionError: '', saved: new Map() });
    }
    stop(); remixing = enabled; hint = false; audioError('');
    $('handoff-status').textContent = '';
    $('audio-status').textContent = remixing ? 'Compare your original and remix. Try a twist below, or edit the pads.' : 'Your beat challenge is just as you left it.';
    $('remix-feedback').textContent = 'Try one idea, then compare the two versions.';
    $('remix-save-status').textContent = 'Keep a version to save it as a new Studio project.';
    renderMode(); renderPads(); renderResult(); $('challenge-title').focus();
  }
  function saveRemix() {
    if (!storage) throw new Error('Storage unavailable');
    const state = remix(), project = R.forStudio(state.session.project), fingerprint = R.fingerprint(project);
    const savedId = state.saved.get(fingerprint);
    if (savedId) {
      const raw = storage.getItem(P.PREFIX + savedId);
      // If a saved version was edited or removed in Studio, keep a fresh copy.
      // A damaged project is left untouched as well.
      try { const saved = P.validateProject(JSON.parse(raw)); if (saved.id === savedId && R.fingerprint(saved) === fingerprint) return savedId; } catch {}
    }
    const saved = new P.ProjectStore(storage).save(project);
    state.saved.set(fingerprint, saved.id); return saved.id;
  }
  function refreshScores() {
    let total = 0, damaged = false;
    for (const c of G.CHALLENGES) {
      if (storage) {
        try { const saved = G.readBest(storage, c.id); bests.set(c.id, Math.max(bests.get(c.id) || 0, saved.best)); damaged ||= saved.damaged; }
        catch { storageProblem = 'Scores could not be read. You can still play.'; }
      }
      const best = bests.get(c.id) || 0; total += best;
      const button = roundButtons.get(c.id);
      button.setAttribute('aria-pressed', String(c.id === challenge().id));
      button.setAttribute('aria-label', `${c.title}. Best: ${best} of 3 stars.`);
      button.children[1].textContent = `${starsText(best)} · ${c.level}`;
    }
    $('total-stars').textContent = `${total} / 18`;
    const best = bests.get(challenge().id) || 0;
    $('round-stars').textContent = starsText(best); $('round-stars').setAttribute('aria-label', `Best: ${best} of 3 stars`);
    $('score-storage').textContent = unsavedScores.size ? 'Some stars are kept for this visit only. Return to those beats and use “Check my beat” to retry saving.' : storageProblem || (damaged ? 'Some scores could not be read and were left untouched. You can still play.' : 'Best stars save in this browser.');
  }
  function renderPads() {
    $('open-drop').disabled = !G.VOICES.some(v => rows()[v.key].length) && !(remixing && remix().session.scene.bass.notes.some(Boolean));
    const result = remixing ? null : results.get(challenge().id);
    for (const { key, name } of G.VOICES) {
      const lane = result?.lanes.find(l => l.key === key);
      pads.get(key).forEach((pad, step) => {
        const on = rows()[key].includes(step), target = challenge().rows[key].includes(step);
        const wrong = !!lane && (lane.missing.includes(step) || lane.extra.includes(step));
        pad.dataset.on = on; pad.dataset.hint = hint && target; pad.dataset.wrong = wrong;
        pad.setAttribute('aria-pressed', String(on));
        pad.setAttribute('aria-label', `${name}, step ${step + 1}, beat ${Math.floor(step / 4) + 1}${hint && target ? ', reference hit' : ''}${wrong ? (on ? ', extra hit' : ', missing hit') : ''}`);
        pad.children[0].textContent = hint && target ? '◆' : on ? '●' : '·';
      });
    }
    $('show-pattern').setAttribute('aria-pressed', String(hint));
    $('show-pattern').textContent = hint ? 'Hide the pattern' : 'Show the pattern';
    $('challenge-tip').textContent = (hint ? 'Diamonds mark reference hits. Filled pads are your beat. ' : '') + challenge().tip;
  }
  function renderResult(edited = false) {
    if (remixing) return;
    const result = results.get(challenge().id);
    $('result').dataset.complete = result?.stars === 3;
    $('next-beat').hidden = result?.stars !== 3;
    $('next-beat').textContent = index === G.CHALLENGES.length - 1 ? 'Back to the first beat →' : 'Next beat →';
    $('result-title').textContent = result ? (result.stars === 3 ? 'Locked in. That’s your groove!' : `${result.stars} of 3 instruments matched`) : (edited ? 'Your beat changed. Give it another listen.' : 'Three instruments. Three stars to find.');
    $('result-detail').textContent = result ? (result.stars === 3 ? 'All three patterns match. Choose “Remix this beat” to put your own spin on it, or try the next challenge.' : 'Solo an instrument, listen again, and adjust its pads. Dashed pads mark missing or extra hits.') : 'One star for each instrument that matches exactly. No timer, no lost stars. Hints are always welcome.';
    $('lane-results').replaceChildren(...(result?.lanes || []).map(lane => make('li', lane.matched ? `${lane.name}: matched ★` : `${lane.name}: ${lane.missing.length} missing ${lane.missing.length === 1 ? 'hit' : 'hits'}, ${lane.extra.length} extra ${lane.extra.length === 1 ? 'hit' : 'hits'}.`)));
  }
  function paintPosition(event) {
    if (remixing && event && mission().view(remix().session.project).active) {
      mission().observe(remix().session.project, event, { solo: $('solo').value });
      renderMission();
    }
    if (remixing && event && audibleSide !== event.sceneId) { audibleSide = event.sceneId; renderComparison(); }
    for (const lane of pads.values()) lane.forEach((pad, step) => { pad.dataset.current = !!event && step === event.tick % 16; });
    $('beat-position').textContent = event ? `${tempo()} BPM · Beat ${Math.floor(event.tick % 16 / 4) + 1} · Step ${event.tick % 16 + 1}` : `${tempo()} BPM · Ready`;
  }
  function renderComparison() {
    for (const [id, side] of [['listen-target', 'A'], ['listen-yours', 'B']]) {
      $(id).setAttribute('aria-pressed', String(audibleSide === side));
      $(id).dataset.queued = requestedSide === side && audibleSide !== side;
    }
    if (!requestedSide) return;
    const label = side => side === 'A' ? 'your original' : 'your remix';
    $('audio-status').textContent = audibleSide ? `Playing ${label(audibleSide)}.${requestedSide !== audibleSide ? ` ${requestedSide === 'A' ? 'Original' : 'Remix'} queued for the next bar.` : ''}` : `Starting ${label(requestedSide)}…`;
  }
  function stopped(message = '') {
    mission()?.stop();
    playing = null; requestedSide = null; audibleSide = null; paintPosition(null);
    $('listen-target').setAttribute('aria-pressed', 'false'); $('listen-yours').setAttribute('aria-pressed', 'false');
    $('listen-target').dataset.queued = false; $('listen-yours').dataset.queued = false;
    $('stop-audio').disabled = true;
    if (message) $('audio-status').textContent = message;
  }
  function stop(message = '') {
    audioToken++; transport?.stop(); clearTimeout(previewTimer); previewTimer = null;
    preview?.stop(); preview = null; stopped(message);
  }
  async function ensureAudio() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) throw new Error('Audio is unavailable in this browser. Try a current browser. You can still edit pads and save your music.');
    if (!ctx || ctx.state === 'closed') {
      ctx = new AudioContext();
      ctx.addEventListener?.('statechange', () => { if (ctx.state !== 'running') stop('Audio paused. Press a listen button to resume.'); });
    }
    if (ctx.state !== 'running') {
      if (!resumePromise) resumePromise = ctx.resume().finally(() => { resumePromise = null; });
      await resumePromise;
    }
    if (ctx.state !== 'running') throw new Error('Audio is paused. Press a listen button to try again.');
    return ctx;
  }
  async function play(mode) {
    const side = mode === 'target' ? 'A' : 'B';
    if (remixing && transport?.running && playing === 'remix') {
      requestedSide = side; transport.queueScene(side); renderComparison(); return;
    }
    stop(); const request = audioToken; audioError('');
    $('stop-audio').disabled = false; $('audio-status').textContent = 'Opening audio…';
    try {
      await ensureAudio(); if (request !== audioToken || document.hidden) return;
      playbackProject = remixing ? R.forPlayback(remix().session.project, { solo: $('solo').value, bpm: tempo() }) : G.createProject(banks, challenge(), mode === 'target' ? challenge().rows : rows(), { solo: $('solo').value, bpm: tempo() });
      transport = new A.Transport(ctx, () => playbackProject, { onVisual: paintPosition, onStop: stopped, onError: err => audioError(err.message) });
      transport.start('scene', remixing ? side : 'B');
      if (!transport.running) { stopped('Playback could not start. Press a listen button to retry.'); return; }
      if (remixing) { playing = 'remix'; requestedSide = side; renderComparison(); return; }
      playing = mode;
      $(`listen-${mode === 'target' ? 'target' : 'yours'}`).setAttribute('aria-pressed', 'true');
      $('audio-status').textContent = mode === 'target' ? 'Reference playing. Listen for where each instrument lands.' : 'Your beat is playing. Pad changes join the loop as you edit.';
    } catch (err) { if (request === audioToken) { stop(); audioError(err.message || 'Audio could not start. Press a listen button to retry.'); } }
  }
  async function audition(key) {
    if (playing) return;
    const request = audioToken;
    try {
      await ensureAudio(); if (request !== audioToken || playing || document.hidden) return;
      if (!preview || preview.closed) preview = new A.Engine(ctx, 0.7);
      preview.drum(key, ctx.currentTime + .01, .75);
      clearTimeout(previewTimer); previewTimer = setTimeout(() => { preview?.stop(); preview = null; }, 1300);
    } catch (err) { if (request === audioToken) audioError(err.message); }
  }
  function edited() {
    if (remixing) { missionEdited(); updateRemixPlayback(); renderPads(); renderRemixControls(); markRemixUnsaved(); $('handoff-status').textContent = ''; return; }
    const hadResult = results.delete(challenge().id); $('handoff-status').textContent = '';
    if (playing === 'yours') {
      // Only musical data is updated; the transport keeps its audio clock.
      for (const scene of playbackProject.scenes) for (const { key } of G.VOICES) scene.drums.rows[key] = ($('solo').value === 'all' || $('solo').value === key) ? [...rows()[key]] : [];
    }
    // The pads announce their own toggle state. Invalidate a checked result
    // once, without repeating the live-region instructions on every edit.
    if (hadResult) renderResult(true);
    renderPads();
    $('start-remix').disabled = !remix() && !G.VOICES.some(v => rows()[v.key].length);
  }
  function selectRound(next) {
    stop(); remixing = false; index = next; hint = false;
    $('challenge-title').textContent = challenge().title;
    $('challenge-meta').textContent = `${String(index + 1).padStart(2, '0')} / 06 · ${challenge().level}`;
    $('audio-status').textContent = 'Start with “Hear the reference”. Listen as many times as you like.';
    $('handoff-status').textContent = ''; audioError('');
    $('solo').value = 'all'; renderMode(); paintPosition(null); renderPads(); renderResult(); refreshScores();
  }
  for (const [i, c] of G.CHALLENGES.entries()) {
    const item = make('li', ''), button = make('button', '', { type: 'button', className: 'arcade-round' });
    button.append(make('strong', `${String(i + 1).padStart(2, '0')}  ${c.title}`), make('span', '☆☆☆'));
    button.addEventListener('click', () => { selectRound(i); $('challenge-title').focus(); });
    item.append(button); $('challenge-list').append(item); roundButtons.set(c.id, button);
  }
  for (const [laneIndex, voice] of G.VOICES.entries()) {
    const lane = make('div', '', { className: 'drum-lane' }); lane.dataset.voice = voice.key;
    const heading = make('div', '', { className: 'lane-heading' }); heading.append(make('strong', voice.name), make('span', voice.cue));
    const grid = make('div', '', { className: 'lane-pads' }); grid.setAttribute('role', 'group'); grid.setAttribute('aria-label', `${voice.name} pattern`);
    const buttons = Array.from({ length: 16 }, (_, step) => {
      const pad = make('button', '', { type: 'button', className: 'beat-pad', tabIndex: step === 0 ? 0 : -1 });
      pad.dataset.step = step;
      pad.append(make('span', '·'), make('small', String(step + 1)));
      pad.children[0].setAttribute('aria-hidden', 'true');
      pad.addEventListener('focus', () => { for (const other of pads.get(voice.key)) other.tabIndex = other === pad ? 0 : -1; });
      pad.addEventListener('click', () => {
        const row = rows()[voice.key], at = row.indexOf(step);
        if (remixing) remix().session.toggle(voice.key, step);
        else if (at === -1) row.push(step); else row.splice(at, 1);
        edited(); if (at === -1) audition(voice.key);
      });
      pad.addEventListener('keydown', event => {
        let column = step, row = laneIndex;
        if (event.key === 'ArrowRight') column = (step + 1) % 16;
        else if (event.key === 'ArrowLeft') column = (step + 15) % 16;
        else if (event.key === 'ArrowDown') row = (laneIndex + 1) % 3;
        else if (event.key === 'ArrowUp') row = (laneIndex + 2) % 3;
        else if (event.key === 'Home') column = 0;
        else if (event.key === 'End') column = 15;
        else return;
        event.preventDefault(); pads.get(G.VOICES[row].key)[column].focus();
      });
      return pad;
    });
    pads.set(voice.key, buttons); grid.append(...buttons); lane.append(heading, grid); $('pattern-grid').append(lane);
  }
  try { storage = window.localStorage; } catch { storageProblem = 'Browser storage is unavailable. You can still play, but scores will not survive a reload.'; }
  $('listen-target').addEventListener('click', () => play('target'));
  $('listen-yours').addEventListener('click', () => play('yours'));
  $('stop-audio').addEventListener('click', () => stop('Stopped.'));
  for (const id of ['solo', 'speed']) $(id).addEventListener('change', () => {
    stop('Listening settings changed. Press a listen button to continue.');
    if (id === 'speed' && remixing && mission().view(remix().session.project).active) {
      // Compare the same tempo on both sides of this listening experiment.
      mission().start(remix().session.project); remix().missionError = ''; renderMission();
    }
  });
  $('show-pattern').addEventListener('click', () => { hint = !hint; renderPads(); });
  $('clear-beat').addEventListener('click', () => { stop('Your beat is clear.'); drafts.set(challenge().id, G.emptyRows()); edited(); });
  $('check-beat').addEventListener('click', () => {
    if (remixing) return;
    const result = G.check(rows(), challenge()); results.set(challenge().id, result);
    const best = Math.max(bests.get(challenge().id) || 0, result.stars);
    bests.set(challenge().id, best);
    try {
      if (!storage) throw new Error('Storage unavailable');
      G.saveBest(storage, challenge().id, best); unsavedScores.delete(challenge().id); storageProblem = '';
    } catch { if (best) unsavedScores.add(challenge().id); storageProblem = 'This result could not be saved. Keep playing; use “Check my beat” to retry saving.'; }
    refreshScores(); renderResult(); renderPads();
  });
  $('next-beat').addEventListener('click', () => { selectRound((index + 1) % G.CHALLENGES.length); $('challenge-title').focus(); });
  $('start-remix').addEventListener('click', () => setRemixMode(true));
  $('back-to-challenge').addEventListener('click', () => setRemixMode(false));
  $('start-mission').addEventListener('click', () => {
    if (!remixing) return;
    stop(); remix().missionError = ''; mission().start(remix().session.project); renderMission(); $('mission-action').focus();
  });
  $('exit-mission').addEventListener('click', () => {
    if (!remixing) return;
    mission().exit(); renderMission(); $('start-mission').focus();
  });
  $('mission-reflection').addEventListener('change', () => {
    if (!remixing) return;
    mission().reflect($('mission-reflection').value); renderMission();
  });
  $('mission-action').addEventListener('click', async () => {
    if (!remixing) return;
    const view = mission().view(remix().session.project);
    if (!view.active) return;
    if (view.complete) { openWorkspace('drop-lab'); return; }
    if (view.step === 1 || view.step === 3) {
      if ($('solo').value !== 'all') { stop(); $('solo').value = 'all'; }
      await play(view.step === 1 ? 'target' : 'yours');
    } else if (view.step === 2) pads.get('ch')[view.hintStep].focus();
    else if (view.step === 4) $('mission-reflection').focus();
    else if (view.canKeep) keepRemix();
  });
  for (const [kind, message, unchanged] of [
    ['fill', 'A snare and hat fill now leads into the next loop.', 'That fill is already in place. Try moving a pad, or compare A and B.'],
    ['sparse', 'The hats have more space. Your kick and snare stay in place.', 'The hats are already sparse. Add a few hat pads to try a different feel.'],
    ['acid', 'A new bass phrase is ready. Compare it with your original, or tap again for another phrase.', 'The bass is ready.'],
  ]) $(`remix-${kind}`).addEventListener('click', () => {
    if (!remixing) return;
    if (remix().session.vary(kind)) remixChanged(message); else $('remix-feedback').textContent = unchanged;
  });
  for (const [kind, message] of [['undo', 'Last remix change undone.'], ['redo', 'Remix change restored.'], ['reset', 'Back to your original beat. Undo brings the remix back.']]) $(`remix-${kind}`).addEventListener('click', () => {
    if (remixing && remix().session[kind]()) remixChanged(message);
  });
  function keepRemix() {
    if (!remixing) return;
    try {
      saveRemix(); $('remix-save-status').textContent = 'This version is saved in your Studio projects. Keep experimenting, or open it in Studio.';
      remix().missionError = ''; mission().kept(remix().session.project); renderMission();
    } catch {
      const message = 'Could not save this version. Your remix is still here. Free some browser storage, then try keeping it again.';
      $('remix-save-status').textContent = message;
      if (mission().view(remix().session.project).active) { remix().missionError = message; renderMission(); }
    }
  }
  $('keep-remix').addEventListener('click', keepRemix);
  function openWorkspace(destination) {
    if (opening) return;
    opening = true; stop(); $('handoff-status').textContent = '';
    try {
      if (!storage) throw new Error('Storage unavailable');
      const savedId = remixing ? saveRemix() : new P.ProjectStore(storage).save(G.createProject(banks, challenge(), rows())).id;
      window.location.assign(`./${destination}.html?project=${encodeURIComponent(savedId)}${destination === 'drop-lab' ? '&build=1' : ''}`);
    } catch {
      $('handoff-status').textContent = 'Could not save a new Studio project. Your beat is still here. Free some browser storage and try again.';
      opening = false;
    }
  }
  $('open-studio').addEventListener('click', () => openWorkspace('groove-studio'));
  $('open-drop').addEventListener('click', () => { if (!$('open-drop').disabled) openWorkspace('drop-lab'); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop('Playback paused while this tab was hidden.'); });
  window.addEventListener('pagehide', () => stop());
  window.addEventListener('storage', event => { if (event.key === null || event.key?.startsWith(G.PREFIX)) refreshScores(); });
  window.addEventListener('pageshow', () => { opening = false; refreshScores(); });
  selectRound(0);
})();
