(() => {
  const P = globalThis.DCStudioProject, A = globalThis.DCStudioAudio, D = globalThis.DCDropProject;
  const banks = globalThis.DCStudioBanks, $ = id => document.getElementById(id);
  const make = (tag, text, props = {}) => Object.assign(document.createElement(tag), { textContent: text, ...props });
  let project = D.starter(banks), defaults = P.copy(project), storage = null, projects = new Map();
  const savedCopies = new Map(), pads = new Map();
  let selected = 'A', audible = null, requested = null, ctx = null, resumePromise = null, transport = null, audioEpoch = 0;
  let recordEpoch = 0, phase = 'idle', recorder = null, limitTimer = null, elapsedTimer = null, recordStarted = 0;
  let takeUrl = null, takeDownloaded = true, opening = false, disposed = false;
  const activeScene = () => project.scenes.find(s => s.id === (audible || selected));
  const status = message => { $('launch-status').textContent = message; };
  const error = message => { $('error').textContent = message; $('error').hidden = !message; };
  function renderPads() {
    for (const scene of project.scenes) {
      const pad = pads.get(scene.id), queued = requested === scene.id && audible !== scene.id;
      pad.children[1].textContent = scene.name;
      pad.children[2].textContent = audible === scene.id ? 'Playing' : queued ? 'Queued · next bar' : `${P.SCENES.indexOf(scene.id) + 1} · Launch`;
      pad.dataset.playing = audible === scene.id; pad.dataset.queued = queued;
      pad.setAttribute('aria-pressed', String(audible === scene.id));
      pad.setAttribute('aria-label', `${scene.id}: ${scene.name}${audible === scene.id ? ', playing' : queued ? ', queued for the next bar' : ''}`);
    }
  }
  function renderMix() {
    const scene = activeScene(); $('mix-heading').textContent = `Controls for ${scene.id} · ${scene.name}`;
    for (const part of ['drums', 'bass']) {
      const muted = scene.mix[part === 'drums' ? 'muteDrums' : 'muteBass'];
      $(`mute-${part}`).setAttribute('aria-pressed', String(muted)); $(`mute-${part}`).textContent = `${muted ? 'Unmute' : 'Mute'} ${part}`;
    }
    $('filter').value = scene.mix.cutoff; $('filter-value').textContent = `${scene.mix.cutoff} Hz`;
    $('mix-note').textContent = scene.bass.notes.some(Boolean) ? 'Controls affect the scene you hear. A queued scene keeps its own settings.' : 'This scene has no bass notes. The bass filter and bass mute will be silent; add bass in Studio or Remix Mode.';
  }
  function renderRecord() {
    $('record').textContent = ({ idle: 'Record a take', preparing: 'Opening recorder…', recording: 'Finish take', finishing: 'Finishing take…' })[phase];
    $('record').disabled = phase === 'preparing' || phase === 'finishing';
    $('record').setAttribute('aria-pressed', String(phase === 'recording'));
    for (const id of ['tempo', 'project-list', 'load-project', 'starter', 'open-studio']) $(id).disabled = phase !== 'idle';
    if (!projects.size) $('load-project').disabled = true;
  }
  function visual(event) {
    if (audible !== event.sceneId) {
      audible = event.sceneId; selected = audible; renderPads(); renderMix();
      const scene = activeScene(); status(`Playing ${scene.name}.${requested && requested !== audible ? ' Your next scene is queued.' : ''}`);
    }
    $('position').textContent = `Bar ${event.bar + 1} · Beat ${Math.floor(event.tick % 16 / 4) + 1}`;
  }
  function stopped(message = '') {
    audible = null; requested = null; $('stop').disabled = true; $('position').textContent = 'Stopped';
    renderPads(); renderMix(); finishTake();
    if (message) status(message);
  }
  function stopAll(message = '') {
    audioEpoch++; recordEpoch++;
    if (phase === 'preparing') { phase = 'idle'; $('record-status').textContent = 'Recording cancelled before it started.'; renderRecord(); }
    transport?.stop(); stopped(message);
  }
  async function audioReady() {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) throw new Error('Audio is unavailable in this browser. Try a current browser to perform this set.');
    if (!ctx || ctx.state === 'closed') {
      ctx = new Context(); ctx.addEventListener?.('statechange', () => { if (ctx.state !== 'running') stopAll('Audio paused. Press a scene pad to resume.'); });
    }
    if (ctx.state !== 'running') {
      if (!resumePromise) resumePromise = ctx.resume().finally(() => { resumePromise = null; });
      await resumePromise;
    }
    if (ctx.state !== 'running') throw new Error('Audio is paused. Tap a scene pad to try again.');
  }
  async function launch(id) {
    if (!P.SCENES.includes(id)) return false;
    $('take-preview').pause(); error('');
    if (transport?.running) { requested = id; transport.queueScene(id); renderPads(); status(`${project.scenes.find(s => s.id === id).name} queued for the next bar.`); return true; }
    const request = ++audioEpoch; selected = id; requested = id; renderPads(); renderMix();
    $('stop').disabled = false; status('Opening audio…');
    try {
      await audioReady(); if (request !== audioEpoch || document.hidden) return false;
      transport = new A.Transport(ctx, () => project, { onVisual: visual, onStop: stopped, onError: err => error(err.message) });
      transport.start('scene', id);
      if (!transport.running) { stopped('Playback could not start. Try a scene pad again.'); return false; }
      status(`Starting ${activeScene().name}…`); return true;
    } catch (err) { if (request === audioEpoch) { stopped(); error(err.message); } return false; }
  }
  function clearRecordTimers() { clearTimeout(limitTimer); clearTimeout(elapsedTimer); limitTimer = null; elapsedTimer = null; }
  function recordClock() {
    if (phase !== 'recording') return;
    const seconds = Math.min(60, Math.max(0, Math.floor(ctx.currentTime - recordStarted)));
    $('record-time').textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} / 1:00`;
    elapsedTimer = setTimeout(recordClock, 250);
  }
  function finishTake() {
    if (!recorder || phase !== 'recording') return;
    clearRecordTimers(); phase = 'finishing'; renderRecord();
    try { recorder.stop(); } catch (err) { error(err.message); }
  }
  async function record() {
    if (phase === 'recording') { finishTake(); return; }
    if (phase !== 'idle') return;
    phase = 'preparing'; const request = ++recordEpoch; renderRecord(); error('');
    try {
      if (!transport?.running && !(await launch(selected))) return;
      if (request !== recordEpoch || document.hidden || !transport?.running) return;
      $('take-preview').pause();
      const take = new A.TakeRecorder(ctx, transport.engine.output), name = project.name;
      recorder = take; phase = 'recording'; recordStarted = ctx.currentTime; renderRecord();
      $('record-status').textContent = 'Recording your performance. Finish whenever you like; the take stops at 60 seconds.';
      take.start().then(({ blob, extension }) => {
        if (disposed) return;
        const nextUrl = URL.createObjectURL(blob); $('take-preview').pause();
        if (takeUrl) URL.revokeObjectURL(takeUrl);
        takeUrl = nextUrl; takeDownloaded = false; $('take-preview').src = takeUrl;
        $('download-take').href = takeUrl;
        $('download-take').download = `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'drop-lab'}-take.${extension}`;
        $('download-take').textContent = `Download ${extension.toUpperCase()} take`;
        $('take-result').hidden = false;
        $('record-status').textContent = 'Take ready. Play it back, then download it to keep it. A successful new recording replaces this take.';
      }).catch(err => { error(`Could not record this take: ${err.message}`); $('record-status').textContent = 'Recording failed. Any previous take is still available. Try again or use Studio’s WAV export.'; }).finally(() => {
        clearRecordTimers(); if (recorder === take) recorder = null;
        phase = 'idle'; renderRecord();
      });
      limitTimer = setTimeout(() => { $('record-time').textContent = '1:00 / 1:00'; finishTake(); }, 60000);
      recordClock();
    } catch (err) { error(err.message); $('record-status').textContent = 'Recording is unavailable. You can still perform, or export a WAV from Studio.'; }
    finally { if (phase === 'preparing' && request === recordEpoch) { phase = 'idle'; renderRecord(); } }
  }
  function refreshProjects() {
    try {
      if (!storage) throw new Error('Storage unavailable');
      const list = new P.ProjectStore(storage).list(); projects = new Map(list.projects.map(p => [p.id, p]));
      const previous = $('project-list').value;
      $('project-list').replaceChildren(...list.projects.map(p => make('option', p.name, { value: p.id })));
      if (projects.has(previous)) $('project-list').value = previous;
      if (list.damaged.length) $('save-status').textContent = 'Some saved projects could not be read and were left untouched. Valid projects remain available.';
    } catch { $('save-status').textContent = 'Browser storage is unavailable. You can still perform and download an audio take.'; }
    renderRecord();
  }
  function useProject(source, build = false) {
    stopAll(); project = build ? D.buildSet(source) : D.copyProject(source); defaults = P.copy(project); selected = 'A';
    $('set-name').textContent = project.name; $('tempo').value = project.bpm;
    $('set-source').textContent = build ? `Four performance scenes built from scene B of “${source.name}”.` : `Performing a copy of “${source.name}”.`;
    $('save-status').textContent = 'Keep scene settings to save a new project. Live moves are captured in your audio take.';
    status('Tap a scene to start. While playing, scene changes land on the next bar.'); renderPads(); renderMix();
  }
  function saveCopy() {
    if (!storage) throw new Error('Storage unavailable');
    const fingerprint = D.fingerprint(project), savedId = savedCopies.get(fingerprint);
    if (savedId) {
      const raw = storage.getItem(P.PREFIX + savedId);
      try { const saved = P.validateProject(JSON.parse(raw)); if (saved.id === savedId && D.fingerprint(saved) === fingerprint) return savedId; } catch {}
    }
    const saved = new P.ProjectStore(storage).save(D.copyProject(project)); savedCopies.set(fingerprint, saved.id);
    refreshProjects(); return saved.id;
  }
  for (const [i, id] of P.SCENES.entries()) {
    const button = make('button', '', { type: 'button', className: 'scene-pad' }); button.dataset.scene = id;
    button.setAttribute('aria-keyshortcuts', String(i + 1)); button.append(make('strong', id), make('span', ''), make('small', ''));
    button.addEventListener('click', () => launch(id)); pads.set(id, button); $('scene-pads').append(button);
  }
  $('play').addEventListener('click', () => launch(selected)); $('stop').addEventListener('click', () => stopAll('Stopped.'));
  $('record').addEventListener('click', record);
  for (const [part, key] of [['drums', 'muteDrums'], ['bass', 'muteBass']]) $(`mute-${part}`).addEventListener('click', () => { activeScene().mix[key] = !activeScene().mix[key]; renderMix(); $('save-status').textContent = 'Scene settings changed. Keep them to save a new Studio project.'; });
  $('filter').addEventListener('input', event => {
    const value = Number(event.target.value); if (!Number.isFinite(value) || value < 100 || value > 6000) return;
    activeScene().mix.cutoff = value; $('filter-value').textContent = `${value} Hz`;
    $('save-status').textContent = 'Scene settings changed. Keep them to save a new Studio project.';
  });
  $('reset-controls').addEventListener('click', () => { const scene = activeScene(); scene.mix = P.copy(defaults.scenes.find(s => s.id === scene.id).mix); renderMix(); $('save-status').textContent = 'Scene settings reset. Keep them to save a Studio project.'; });
  $('tempo').addEventListener('change', event => {
    if (phase !== 'idle') return;
    const value = Number(event.target.value); stopAll('Tempo changed. Tap a scene to play.');
    if (!Number.isInteger(value) || value < 40 || value > 240) { $('tempo').value = project.bpm; error('Use a whole-number tempo from 40 to 240 BPM.'); return; }
    project.bpm = value; $('save-status').textContent = 'Tempo changed. Keep scene settings to save a new Studio project.';
  });
  $('take-preview').addEventListener('play', () => stopAll('Listening to your recorded take.'));
  $('download-take').addEventListener('click', () => { takeDownloaded = true; });
  $('load-project').addEventListener('click', () => { if (phase !== 'idle') return; refreshProjects(); const source = projects.get($('project-list').value); if (source) useProject(source); });
  $('starter').addEventListener('click', () => { if (phase === 'idle') useProject(D.starter(banks)); });
  $('save-set').addEventListener('click', () => {
    try { saveCopy(); $('save-status').textContent = 'Scene settings saved as a Studio project. Download your take separately to keep the live performance.'; }
    catch { $('save-status').textContent = 'Could not save scene settings. Your set is still here; free some browser storage and try again.'; }
  });
  $('open-studio').addEventListener('click', () => {
    if (opening || phase !== 'idle') return;
    try { const id = saveCopy(); opening = true; stopAll(); window.location.assign(`./groove-studio.html?project=${encodeURIComponent(id)}`); }
    catch { error('Could not save this set for Studio. Your set and any take are still here. Try keeping the scene settings again.'); }
    finally { opening = false; }
  });
  const prompts = [
    ['Leave some space', 'Play the intro, let the groove settle, then make room with the breakdown. Bring the full groove back when it feels right.'],
    ['Open it up', 'When a scene has bass, start with a low filter setting and raise it slowly. Listen for the moment it feels ready to return.'],
    ['Make the return count', 'Mute the drums for a few beats, then bring them back. Record two attempts and listen for the return you like best.'],
  ];
  let prompt = 0;
  $('next-prompt').addEventListener('click', () => { prompt = (prompt + 1) % prompts.length; $('prompt-title').textContent = prompts[prompt][0]; $('prompt-text').textContent = prompts[prompt][1]; });
  document.addEventListener('keydown', event => {
    if (event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.target?.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA', 'AUDIO'].includes(event.target?.tagName)) return;
    if (/^[1-4]$/.test(event.key)) { event.preventDefault(); launch(P.SCENES[Number(event.key) - 1]); }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { stopAll('Playback paused while this tab was hidden.'); $('take-preview').pause(); } });
  window.addEventListener('beforeunload', event => { if ((takeUrl && !takeDownloaded) || phase !== 'idle') { event.preventDefault(); event.returnValue = ''; } });
  window.addEventListener('pagehide', event => { stopAll(); $('take-preview').pause(); if (!event.persisted) { disposed = true; if (takeUrl) URL.revokeObjectURL(takeUrl); } });
  window.addEventListener('pageshow', () => { opening = false; refreshProjects(); });
  window.addEventListener('storage', event => { if (event.key === null || event.key?.startsWith(P.PREFIX)) refreshProjects(); });
  try { storage = window.localStorage; } catch {}
  refreshProjects();
  const params = new URLSearchParams(window.location.search), requestedProject = params.get('project');
  const source = projects.get(requestedProject);
  if (source) useProject(source, params.get('build') === '1');
  else { useProject(project); if (requestedProject) error('That saved project was not found in this browser. The starter is ready to play.'); }
  if (!storage) $('save-status').textContent = 'Browser storage is unavailable. You can still perform and download an audio take.';
  try { const url = new URL(window.location.href); url.searchParams.delete('project'); url.searchParams.delete('build'); window.history.replaceState(null, '', url); } catch {}
})();
