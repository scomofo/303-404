(() => {
  const G = globalThis.DCBeatArcade, P = globalThis.DCStudioProject;
  const A = globalThis.DCStudioAudio, banks = globalThis.DCStudioBanks;
  const $ = id => document.getElementById(id);
  const make = (tag, text, props = {}) => Object.assign(document.createElement(tag), { textContent: text, ...props });
  const drafts = new Map(G.CHALLENGES.map(c => [c.id, G.emptyRows()]));
  const results = new Map(), bests = new Map(), pads = new Map(), roundButtons = new Map();
  const unsavedScores = new Set();
  let index = 0, hint = false, storage = null, storageProblem = '';
  let ctx = null, resumePromise = null, transport = null, preview = null, previewTimer = null;
  let audioToken = 0, playing = null, playbackProject = null, opening = false;
  const challenge = () => G.CHALLENGES[index];
  const rows = () => drafts.get(challenge().id);
  const tempo = () => Math.round(challenge().bpm * Number($('speed').value));
  const starsText = count => '★'.repeat(count) + '☆'.repeat(3 - count);
  function audioError(message) { $('audio-error').textContent = message; $('audio-error').hidden = !message; }
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
    const result = results.get(challenge().id);
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
    const result = results.get(challenge().id);
    $('result').dataset.complete = result?.stars === 3;
    $('next-beat').hidden = result?.stars !== 3;
    $('next-beat').textContent = index === G.CHALLENGES.length - 1 ? 'Back to the first beat →' : 'Next beat →';
    $('result-title').textContent = result ? (result.stars === 3 ? 'Locked in. That’s your groove!' : `${result.stars} of 3 instruments matched`) : (edited ? 'Your beat changed. Give it another listen.' : 'Three instruments. Three stars to find.');
    $('result-detail').textContent = result ? (result.stars === 3 ? 'All three patterns match. Try the next beat, or take this one into Studio and put your own spin on it.' : 'Solo an instrument, listen again, and adjust its pads. Dashed pads mark missing or extra hits.') : 'One star for each instrument that matches exactly. No timer, no lost stars. Hints are always welcome.';
    $('lane-results').replaceChildren(...(result?.lanes || []).map(lane => make('li', lane.matched ? `${lane.name}: matched ★` : `${lane.name}: ${lane.missing.length} missing ${lane.missing.length === 1 ? 'hit' : 'hits'}, ${lane.extra.length} extra ${lane.extra.length === 1 ? 'hit' : 'hits'}.`)));
  }
  function paintPosition(event) {
    for (const lane of pads.values()) lane.forEach((pad, step) => { pad.dataset.current = !!event && step === event.tick % 16; });
    $('beat-position').textContent = event ? `${tempo()} BPM · Beat ${Math.floor(event.tick % 16 / 4) + 1} · Step ${event.tick % 16 + 1}` : `${tempo()} BPM · Ready`;
  }
  function stopped(message = '') {
    playing = null; paintPosition(null);
    $('listen-target').setAttribute('aria-pressed', 'false'); $('listen-yours').setAttribute('aria-pressed', 'false');
    $('stop-audio').disabled = true;
    if (message) $('audio-status').textContent = message;
  }
  function stop(message = '') {
    audioToken++; transport?.stop(); clearTimeout(previewTimer); previewTimer = null;
    preview?.stop(); preview = null; stopped(message);
  }
  async function ensureAudio() {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) throw new Error('Audio is unavailable in this browser. Try a current browser, or use “Show the pattern” to play visually.');
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
    stop(); const request = audioToken; audioError('');
    $('stop-audio').disabled = false; $('audio-status').textContent = 'Opening audio…';
    try {
      await ensureAudio(); if (request !== audioToken || document.hidden) return;
      playbackProject = G.createProject(banks, challenge(), mode === 'target' ? challenge().rows : rows(), { solo: $('solo').value, bpm: tempo() });
      transport = new A.Transport(ctx, () => playbackProject, { onVisual: paintPosition, onStop: stopped, onError: err => audioError(err.message) });
      transport.start('scene', 'B');
      if (!transport.running) { stopped('Playback could not start. Press a listen button to retry.'); return; }
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
    const hadResult = results.delete(challenge().id); $('handoff-status').textContent = '';
    if (playing === 'yours') {
      // Only musical data is updated; the transport keeps its audio clock.
      for (const scene of playbackProject.scenes) for (const { key } of G.VOICES) scene.drums.rows[key] = ($('solo').value === 'all' || $('solo').value === key) ? [...rows()[key]] : [];
    }
    // The pads announce their own toggle state. Invalidate a checked result
    // once, without repeating the live-region instructions on every edit.
    if (hadResult) renderResult(true);
    renderPads();
  }
  function selectRound(next) {
    stop(); index = next; hint = false;
    $('challenge-title').textContent = challenge().title;
    $('challenge-meta').textContent = `${String(index + 1).padStart(2, '0')} / 06 · ${challenge().level}`;
    $('audio-status').textContent = 'Start with “Hear the reference”. Listen as many times as you like.';
    $('handoff-status').textContent = ''; audioError('');
    $('solo').value = 'all'; paintPosition(null); renderPads(); renderResult(); refreshScores();
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
      pad.append(make('span', '·'), make('small', String(step + 1)));
      pad.children[0].setAttribute('aria-hidden', 'true');
      pad.addEventListener('focus', () => { for (const other of pads.get(voice.key)) other.tabIndex = other === pad ? 0 : -1; });
      pad.addEventListener('click', () => {
        const row = rows()[voice.key], at = row.indexOf(step);
        if (at === -1) row.push(step); else row.splice(at, 1);
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
  for (const id of ['solo', 'speed']) $(id).addEventListener('change', () => stop('Listening settings changed. Press a listen button to continue.'));
  $('show-pattern').addEventListener('click', () => { hint = !hint; renderPads(); });
  $('clear-beat').addEventListener('click', () => { stop('Your beat is clear.'); drafts.set(challenge().id, G.emptyRows()); edited(); });
  $('check-beat').addEventListener('click', () => {
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
  $('open-studio').addEventListener('click', () => {
    if (opening) return;
    opening = true; stop(); $('handoff-status').textContent = '';
    try {
      if (!storage) throw new Error('Storage unavailable');
      const project = G.createProject(banks, challenge(), rows());
      const saved = new P.ProjectStore(storage).save(project);
      window.location.assign(`./groove-studio.html?project=${encodeURIComponent(saved.id)}`);
    } catch {
      $('handoff-status').textContent = 'Could not save a new Studio project. Your beat is still here. Free some browser storage and try again.';
      opening = false;
    }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop('Playback paused while this tab was hidden.'); });
  window.addEventListener('pagehide', () => stop());
  window.addEventListener('storage', event => { if (event.key === null || event.key?.startsWith(G.PREFIX)) refreshScores(); });
  window.addEventListener('pageshow', () => { opening = false; refreshScores(); });
  selectRound(0);
})();
