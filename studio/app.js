(() => {
  const P = globalThis.DCStudioProject, A = globalThis.DCStudioAudio, banks = globalThis.DCStudioBanks;
  const $ = id => document.getElementById(id);
  const make = (tag, text, props = {}) => Object.assign(document.createElement(tag), { textContent: text, ...props });
  const option = (value, label) => make('option', label, { value });
  const filename = name => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'groove';
  let store = null, projects = new Map(), project, selectedScene = 'B', voice = 'bd', selectedNote = 0;
  let dirty = false, saveTimer = null, history = [], future = [], undoGroup = null, lastBackup = '';
  let ctx = null, transport = null, starting = false, audioRequest = 0, lastEvent = null;
  let recorder = null, recordLimit = null, takeUrl = null, exporting = false, preparingTake = false;

  function status(message) { $('status').textContent = message; }
  function error(message) { $('error').textContent = message; $('error').hidden = !message; }
  function scene() { return project.scenes.find(scene => scene.id === selectedScene); }
  function download(blob, name) {
    const url = URL.createObjectURL(blob), link = make('a', '', { href: url, download: name });
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function save() {
    clearTimeout(saveTimer); saveTimer = null;
    if (!dirty) return true;
    try {
      if (!store) throw new Error('Storage unavailable');
      store.save(project); projects.set(project.id, P.copy(project)); dirty = false;
      $('save-state').textContent = 'Saved in this browser';
      renderLibrary(); return true;
    } catch (err) {
      $('save-state').textContent = 'Not saved in this browser';
      error(err.message.includes('another tab') ? err.message : 'Could not save in this browser. Download a project backup to keep your changes.');
      return false;
    }
  }
  function changed() {
    dirty = true; $('save-state').textContent = 'Unsaved changes';
    clearTimeout(saveTimer); saveTimer = setTimeout(save, 300);
    $('undo').disabled = !history.length; $('redo').disabled = !future.length;
  }
  function mutate(fn, { group = null, view = 'editor', stop = false } = {}) {
    const before = P.copy(project);
    try {
      if (stop) stopPlayback();
      fn(project); project = P.validateProject(project);
      if (group === null || undoGroup !== group) { history.push(before); if (history.length > 40) history.shift(); }
      undoGroup = group; future = []; changed();
      if (view === 'mix') renderMix();
      else { renderEditor(); renderArrangement(); }
    } catch (err) { project = before; error(err.message); renderEditor(); renderArrangement(); }
  }
  function canLeaveProject() {
    if (!dirty || save() || lastBackup === JSON.stringify(project)) return true;
    error('Keep this project first: download a project backup, or save a copy if another tab changed it.');
    return false;
  }
  function useProject(next) {
    stopPlayback(); clearTimeout(saveTimer); saveTimer = null;
    project = P.validateProject(next); dirty = false; history = []; future = []; undoGroup = null; lastBackup = '';
    selectedScene = 'B'; selectedNote = 0; lastEvent = null;
    $('save-state').textContent = project.updatedAt ? 'Loaded from this browser' : 'Ready to save';
    error(''); renderAll();
  }
  function renderLibrary() {
    const select = $('project-list'), previous = select.value;
    const items = [...projects.values()].sort((a, b) => b.updatedAt - a.updatedAt);
    select.replaceChildren(...items.map(item => option(item.id, item.name)));
    if (items.some(item => item.id === previous)) select.value = previous;
    else if (items.some(item => item.id === project.id)) select.value = project.id;
    $('open-project').disabled = !items.length; $('delete-project').disabled = !items.length;
  }
  function sourceLabel(source) {
    return `${source.edited ? 'Edited from' : 'Source'}: ${source.title} · ${source.type}${source.detail ? ' · ' + source.detail : ''}${source.review ? ' · Accent/slide transcription still needs source review.' : ''}`;
  }
  function renderSceneTabs() {
    const tabs = project.scenes.map(s => {
      const button = make('button', '', { type: 'button', className: 'scene-tab' });
      button.dataset.scene = s.id; button.setAttribute('aria-pressed', String(selectedScene === s.id));
      button.setAttribute('aria-label', `Edit scene ${s.id}: ${s.name}`);
      button.append(make('strong', s.id), make('span', s.name));
      button.addEventListener('click', () => {
        selectedScene = s.id; selectedNote = 0; undoGroup = null;
        if (transport?.running && transport.mode === 'scene') { transport.queueScene(s.id); status(`Scene ${s.id} queued. It will launch on a bar boundary.`); }
        renderEditor();
        $('scene-tabs').querySelector(`[data-scene="${s.id}"]`).focus();
      });
      return button;
    });
    $('scene-tabs').replaceChildren(...tabs);
  }
  function renderMix() {
    const s = scene();
    $('drums-level').value = s.mix.drums; $('drums-value').textContent = `${Math.round(s.mix.drums * 100)}%`;
    $('bass-level').value = s.mix.bass; $('bass-value').textContent = `${Math.round(s.mix.bass * 100)}%`;
    $('cutoff').value = s.mix.cutoff; $('cutoff-value').textContent = `${s.mix.cutoff} Hz`;
    $('resonance').value = s.mix.resonance; $('resonance-value').textContent = s.mix.resonance.toFixed(1);
    $('waveform').value = s.bass.waveform;
    for (const [part, key] of [['drums', 'muteDrums'], ['bass', 'muteBass']]) {
      $(`mute-${part}`).setAttribute('aria-pressed', String(s.mix[key]));
      $(`mute-${part}`).textContent = s.mix[key] ? `Unmute ${part}` : `Mute ${part}`;
    }
    $('master').value = project.master; $('master-value').textContent = `${Math.round(project.master * 100)}%`;
  }
  function renderEditor() {
    const focused = document.activeElement;
    const focusGrid = focused?.parentElement?.id, focusIndex = focused?.dataset?.index;
    const s = scene(); selectedNote = Math.min(selectedNote, s.bass.notes.length - 1);
    $('project-name').value = project.name; $('tempo').value = project.bpm; $('scene-name').value = s.name;
    $('drum-length').value = s.drums.steps; $('bass-length').value = s.bass.notes.length;
    $('drum-bank').value = s.drums.source.id; $('bass-bank').value = s.bass.source.id;
    $('drum-source').textContent = sourceLabel(s.drums.source); $('bass-source').textContent = sourceLabel(s.bass.source);
    $('drum-voice').replaceChildren(...banks.voices.map(v => option(v.key,
      `${s.drums.pair[v.key] || v.label} · ${s.drums.pair[v.key] ? v.altName : v.name} (${s.drums.rows[v.key].length})`)));
    $('drum-voice').value = voice;
    $('drum-grid').replaceChildren(...Array.from({ length: s.drums.steps }, (_, i) => {
      const on = s.drums.rows[voice].includes(i), button = make('button', String(i + 1), { type: 'button', className: 'step' });
      button.dataset.index = i; button.dataset.on = on;
      button.setAttribute('aria-label', `${voice.toUpperCase()} step ${i + 1}`); button.setAttribute('aria-pressed', String(on));
      button.addEventListener('click', () => mutate(() => {
        const row = scene().drums.rows[voice], index = row.indexOf(i);
        if (index < 0) row.push(i); else row.splice(index, 1);
        scene().drums.source.edited = true;
      }));
      return button;
    }));
    $('bass-grid').replaceChildren(...s.bass.notes.map((note, i) => {
      const accent = s.bass.accent.includes(i), slide = s.bass.slide.includes(i);
      const button = make('button', '', { type: 'button', className: 'step bass-step' });
      button.dataset.index = i; button.setAttribute('aria-pressed', String(selectedNote === i));
      button.setAttribute('aria-label', `Bass step ${i + 1}: ${note || 'rest'}${accent ? ', accent' : ''}${slide ? ', slide' : ''}`);
      button.append(make('small', String(i + 1)), make('span', note || '—'), make('small', `${accent ? 'AC' : ''}${accent && slide ? ' ' : ''}${slide ? 'SL' : ''}` || '·'));
      button.addEventListener('click', () => { selectedNote = i; renderEditor(); $('bass-grid').children[i].focus(); });
      return button;
    }));
    const note = s.bass.notes[selectedNote];
    $('note-legend').textContent = `Edit bass step ${selectedNote + 1}`;
    $('note-pitch').value = note === null ? 'rest' : note.slice(0, -1);
    if (note !== null) $('note-octave').value = note.slice(-1);
    $('note-octave').disabled = note === null;
    $('note-accent').checked = s.bass.accent.includes(selectedNote); $('note-slide').checked = s.bass.slide.includes(selectedNote);
    $('note-accent').disabled = note === null; $('note-slide').disabled = note === null;
    renderMix(); renderSceneTabs(); renderPlayhead(lastEvent);
    $('undo').disabled = !history.length; $('redo').disabled = !future.length;
    if (['drum-grid', 'bass-grid'].includes(focusGrid) && focusIndex !== undefined) $(focusGrid).children[Number(focusIndex)]?.focus();
  }
  function renderArrangement() {
    $('arrangement-length').textContent = `${P.totalBars(project)} bars · ${P.duration(project).toFixed(1)} seconds`;
    const active = document.activeElement, selectedPart = active?.dataset?.part, selectedField = active?.dataset?.field;
    $('arrangement').replaceChildren(...project.arrangement.map((part, i) => {
      const li = make('li', '', { className: 'arrangement-part' }); li.dataset.section = i;
      const sceneLabel = make('label', `Section ${i + 1}`), select = make('select', '');
      select.dataset.part = i; select.dataset.field = 'scene'; select.setAttribute('aria-label', `Section ${i + 1} scene`);
      select.append(...project.scenes.map(s => option(s.id, `${s.id} · ${s.name}`))); select.value = part.scene;
      select.addEventListener('change', () => mutate(p => { p.arrangement[i].scene = select.value; }, { stop: true })); sceneLabel.append(select);
      const barsLabel = make('label', 'Bars'), bars = make('input', '', { type: 'number', min: '1', max: '16', step: '1', value: part.bars });
      bars.dataset.part = i; bars.dataset.field = 'bars'; bars.setAttribute('aria-label', `Section ${i + 1} bars`);
      bars.addEventListener('change', () => mutate(p => { p.arrangement[i].bars = Number(bars.value); }, { stop: true })); barsLabel.append(bars);
      const actions = make('div', '', { className: 'part-actions' });
      for (const [label, delta] of [['Move earlier', -1], ['Move later', 1]]) {
        const button = make('button', delta < 0 ? '←' : '→', { type: 'button', disabled: i + delta < 0 || i + delta >= project.arrangement.length });
        button.setAttribute('aria-label', `${label}: section ${i + 1}`);
        button.addEventListener('click', () => mutate(p => { [p.arrangement[i], p.arrangement[i + delta]] = [p.arrangement[i + delta], p.arrangement[i]]; }, { stop: true })); actions.append(button);
      }
      const remove = make('button', 'Remove', { type: 'button', disabled: project.arrangement.length === 1 });
      remove.setAttribute('aria-label', `Remove section ${i + 1}`); remove.addEventListener('click', () => mutate(p => { p.arrangement.splice(i, 1); }, { stop: true })); actions.append(remove);
      li.append(sceneLabel, barsLabel, actions); return li;
    }));
    $('add-section').disabled = project.arrangement.length >= 8 || P.totalBars(project) >= 32;
    if (selectedPart !== undefined) $('arrangement').querySelector(`[data-part="${selectedPart}"][data-field="${selectedField}"]`)?.focus();
    renderPlayhead(lastEvent);
  }
  function renderPlayhead(event) {
    const running = transport?.running && event;
    for (const tab of $('scene-tabs').children) tab.dataset.playing = !!running && tab.dataset.scene === event.sceneId;
    for (const part of $('arrangement').children) part.dataset.playing = !!running && transport.mode === 'arrangement' && Number(part.dataset.section) === event.section;
    const editingPlaying = running && event.sceneId === selectedScene;
    for (const button of $('drum-grid').children) button.dataset.current = !!editingPlaying && Number(button.dataset.index) === event.tick % scene().drums.steps;
    for (const button of $('bass-grid').children) button.dataset.current = !!editingPlaying && Number(button.dataset.index) === event.tick % scene().bass.notes.length;
    if (running) $('position').textContent = `${event.sceneId} · Bar ${event.bar + 1} · Step ${event.tick % 16 + 1}`;
  }
  function renderAll() { renderEditor(); renderArrangement(); renderLibrary(); }
  function stopped(message = '') {
    $('stop').disabled = true; $('position').textContent = 'Stopped'; lastEvent = null; renderPlayhead(null);
    $('play-scene').setAttribute('aria-pressed', 'false'); $('play-arrangement').setAttribute('aria-pressed', 'false');
    if (recorder) stopRecording();
    if (message) status(message);
  }
  function stopPlayback(message = '') {
    audioRequest++;
    if (transport?.running) transport.stop(message); else stopped(message);
  }
  async function play(mode = 'scene') {
    if (starting) return false;
    stopPlayback();
    const request = ++audioRequest; starting = true; error('');
    $('play-scene').disabled = true; $('play-arrangement').disabled = true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) throw new Error('Web Audio is unavailable in this browser. You can still edit and download a project.');
      if (!ctx || ctx.state === 'closed') ctx = new AudioContext();
      if (ctx.state !== 'running') await ctx.resume();
      if (request !== audioRequest) return false;
      if (ctx.state !== 'running') throw new Error('Audio could not start. Check browser audio permissions and try Play again.');
      transport = new A.Transport(ctx, () => project, {
        onVisual: event => { lastEvent = event; renderPlayhead(event); },
        onStop: stopped, onError: err => error(err.message),
      });
      transport.start(mode, selectedScene);
      if (!transport.running) return false;
      $('stop').disabled = false; $(`play-${mode}`).setAttribute('aria-pressed', 'true');
      status(mode === 'arrangement' ? 'Playing the arrangement. Mix edits affect the scene you are editing.' : `Looping scene ${selectedScene}. Select another scene to queue it.`);
      return true;
    } catch (err) { transport?.stop(); error(err.message); return false; }
    finally { starting = false; $('play-scene').disabled = false; $('play-arrangement').disabled = false; }
  }
  function stopRecording() {
    if (!recorder) return;
    clearTimeout(recordLimit); recordLimit = null;
    $('record').disabled = true; $('record').textContent = 'Finishing take…'; recorder.stop();
  }
  async function recordTake() {
    if (preparingTake) return;
    if (recorder) { stopRecording(); return; }
    preparingTake = true;
    try {
      if (!transport?.running && !(await play('scene'))) return;
      $('take-preview').pause();
      const take = new A.TakeRecorder(ctx, transport.engine.output), name = project.name;
      recorder = take; error(''); $('record').textContent = 'Stop recording'; $('record').setAttribute('aria-pressed', 'true');
      status('Recording the live studio output. Scene changes, mutes and sound edits are captured.');
      take.start().then(({ blob, extension }) => {
        if (takeUrl) URL.revokeObjectURL(takeUrl);
        takeUrl = URL.createObjectURL(blob); $('take-preview').src = takeUrl;
        $('download-take').href = takeUrl; $('download-take').download = `${filename(name)}-take.${extension}`;
        $('download-take').textContent = `Download ${extension.toUpperCase()} take`;
        $('take-result').hidden = false; status('Take ready. Listen back and download it to keep it.');
      }).catch(err => error(err.message)).finally(() => {
        clearTimeout(recordLimit); recordLimit = null;
        if (recorder === take) recorder = null;
        $('record').textContent = 'Record take'; $('record').disabled = false; $('record').setAttribute('aria-pressed', 'false');
      });
      recordLimit = setTimeout(() => { stopRecording(); status('The three-minute recording limit was reached. Finishing your take.'); }, 180000);
    } catch (err) { error(err.message); }
    finally { preparingTake = false; }
  }

  try {
    store = new P.ProjectStore(window.localStorage);
    const saved = store.list(); projects = new Map(saved.projects.map(p => [p.id, p]));
    project = saved.projects[0];
    if (saved.damaged.length) error('Some saved projects could not be read. Valid projects are still available; unreadable entries were left untouched.');
  } catch { store = null; error('Browser storage is unavailable. Download project backups to keep your work.'); }
  const params = new URLSearchParams(window.location.search);
  const selections = { bass: params.get('bass'), drums: params.get('drums') };
  const fromBank = banks.bass.some(c => c.id === selections.bass) || banks.drums.some(c => c.id === selections.drums);
  if (!project || fromBank) project = P.createProject(banks, selections);
  if (fromBank) {
    status('A new project is ready with your bank pattern. Your previous projects are preserved.');
    try { const url = new URL(window.location.href); url.searchParams.delete('bass'); url.searchParams.delete('drums'); window.history.replaceState(null, '', url); } catch {}
  }
  $('drum-bank').append(...banks.drums.map(card => option(card.id, card.title)));
  $('bass-bank').append(...banks.bass.map(card => option(card.id, card.title)));
  renderAll();
  if (project.updatedAt) $('save-state').textContent = 'Loaded from this browser';
  if (fromBank) { dirty = true; save(); }

  $('project-name').addEventListener('change', event => mutate(p => { p.name = event.target.value; }));
  $('scene-name').addEventListener('change', event => mutate(() => { scene().name = event.target.value; }));
  $('tempo').addEventListener('change', event => mutate(p => { p.bpm = Number(event.target.value); }, { stop: true }));
  $('master').addEventListener('input', event => mutate(p => { p.master = Number(event.target.value); transport?.engine?.setMaster(p.master); }, { group: 'master', view: 'mix' }));
  for (const [id, key] of [['drums-level', 'drums'], ['bass-level', 'bass'], ['cutoff', 'cutoff'], ['resonance', 'resonance']]) {
    $(id).addEventListener('input', event => mutate(() => { scene().mix[key] = Number(event.target.value); }, { group: `${selectedScene}-${id}`, view: 'mix' }));
    $(id).addEventListener('blur', () => { undoGroup = null; });
  }
  $('master').addEventListener('blur', () => { undoGroup = null; });
  $('waveform').addEventListener('change', event => mutate(() => { scene().bass.waveform = event.target.value; scene().bass.source.edited = true; }));
  for (const [id, key] of [['mute-drums', 'muteDrums'], ['mute-bass', 'muteBass']]) $(id).addEventListener('click', () => mutate(() => { scene().mix[key] = !scene().mix[key]; }, { view: 'mix' }));
  $('drum-voice').addEventListener('change', event => { voice = event.target.value; renderEditor(); });
  $('clear-drum').addEventListener('click', () => mutate(() => { scene().drums.rows[voice] = []; scene().drums.source.edited = true; }));
  $('load-drums').addEventListener('click', () => {
    const card = banks.drums.find(card => card.id === $('drum-bank').value);
    if (card) mutate(() => { scene().drums = P.drumsFromCard(card); });
  });
  $('load-bass').addEventListener('click', () => {
    const card = banks.bass.find(card => card.id === $('bass-bank').value);
    if (card) mutate(() => { scene().bass = P.bassFromCard(card); if (card.filter?.cutoff !== undefined) scene().mix.cutoff = Math.round(200 + card.filter.cutoff * 2600); });
  });
  $('drum-length').addEventListener('change', event => mutate(() => {
    const drums = scene().drums; drums.steps = Number(event.target.value);
    for (const key of P.VOICES) drums.rows[key] = drums.rows[key].filter(i => i < drums.steps);
    drums.source.edited = true;
  }));
  $('bass-length').addEventListener('change', event => mutate(() => {
    const length = Number(event.target.value);
    if (!Number.isInteger(length) || length < 2 || length > 32) throw new Error('Bass patterns need 2–32 steps.');
    const bass = scene().bass;
    bass.notes = Array.from({ length }, (_, i) => bass.notes[i] ?? null);
    bass.accent = bass.accent.filter(i => i < length); bass.slide = bass.slide.filter(i => i < length); bass.source.edited = true;
  }));
  for (const id of ['note-pitch', 'note-octave', 'note-accent', 'note-slide']) $(id).addEventListener('change', () => mutate(() => {
    const bass = scene().bass, pitch = $('note-pitch').value;
    bass.notes[selectedNote] = pitch === 'rest' ? null : pitch + $('note-octave').value;
    for (const key of ['accent', 'slide']) {
      bass[key] = bass[key].filter(i => i !== selectedNote);
      if (pitch !== 'rest' && $(`note-${key}`).checked) bass[key].push(selectedNote);
    }
    bass.source.edited = true;
  }));
  $('copy-scene').addEventListener('click', () => {
    const id = $('copy-target').value;
    if (id === selectedScene) { status('Choose a different scene to copy into.'); return; }
    mutate(p => { const index = p.scenes.findIndex(s => s.id === id), name = p.scenes[index].name; p.scenes[index] = { ...P.copy(scene()), id, name }; });
    status(`Copied scene ${selectedScene} into ${id}. Undo restores the previous version.`);
  });
  $('add-section').addEventListener('click', () => mutate(p => { p.arrangement.push({ scene: selectedScene, bars: 1 }); }, { stop: true }));
  $('undo').addEventListener('click', () => {
    if (!history.length) return; stopPlayback(); future.push(P.copy(project)); project = history.pop(); undoGroup = null; changed(); renderAll();
  });
  $('redo').addEventListener('click', () => {
    if (!future.length) return; stopPlayback(); history.push(P.copy(project)); project = future.pop(); undoGroup = null; changed(); renderAll();
  });
  $('save-project').addEventListener('click', () => { if (!project.updatedAt) dirty = true; if (save()) { error(''); status('Project saved in this browser.'); } });
  $('copy-project').addEventListener('click', () => {
    const next = P.copy(project); next.id = P.newId(); next.name = `${next.name.slice(0, 73)} (copy)`; next.updatedAt = 0;
    useProject(next); dirty = true; save();
  });
  $('new-project').addEventListener('click', () => { if (canLeaveProject()) useProject(P.createProject(banks)); });
  $('open-project').addEventListener('click', () => { const next = projects.get($('project-list').value); if (next && canLeaveProject()) useProject(P.copy(next)); });
  $('delete-project').addEventListener('click', () => {
    const id = $('project-list').value, saved = projects.get(id);
    if (!saved || !window.confirm(`Delete “${saved.name}” from this browser? Download a project backup first if you want to keep it.`)) return;
    try { store.remove(id); projects.delete(id); if (project.id === id) useProject(P.createProject(banks)); else renderLibrary(); status('Project deleted from this browser.'); }
    catch (err) { error(err.message || 'The project could not be deleted.'); }
  });
  $('export-project').addEventListener('click', () => {
    try { const data = P.validateProject(project); download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `${filename(data.name)}.groove.json`); lastBackup = JSON.stringify(project); status('Project backup downloaded. It contains patterns and arrangement settings; live takes are separate.'); }
    catch (err) { error(err.message); }
  });
  $('import-project').addEventListener('change', async event => {
    const file = event.target.files[0]; event.target.value = ''; if (!file) return;
    try {
      if (file.size > 512 * 1024) throw new Error('Project files must be smaller than 512 KB.');
      const next = P.validateProject(JSON.parse(await file.text()));
      if (!canLeaveProject()) return;
      next.id = P.newId(); next.updatedAt = 0; useProject(next); dirty = true; save(); status('Project imported as a new copy.');
    } catch (err) { error(`Could not import project: ${err.message}`); }
  });
  $('play-scene').addEventListener('click', () => play('scene'));
  $('play-arrangement').addEventListener('click', () => play('arrangement'));
  $('stop').addEventListener('click', () => stopPlayback('Stopped.'));
  $('record').addEventListener('click', recordTake);
  $('export-wav').addEventListener('click', async () => {
    if (exporting) return;
    exporting = true; $('export-wav').disabled = true; stopPlayback();
    const snapshot = P.copy(project); error(''); status('Rendering your arrangement…');
    try { const result = await A.renderArrangement(snapshot); download(new Blob([result.buffer], { type: 'audio/wav' }), `${filename(snapshot.name)}-arrangement.wav`); status(`Exported ${result.musicDuration.toFixed(1)} seconds of music plus release tails as a stereo WAV.`); }
    catch (err) { error(err.message); }
    finally { exporting = false; $('export-wav').disabled = false; }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { stopPlayback('Playback stopped while this tab was hidden.'); if (dirty) save(); } });
  window.addEventListener('pagehide', event => { stopPlayback(); if (dirty) save(); if (!event.persisted && takeUrl) URL.revokeObjectURL(takeUrl); });
  window.addEventListener('beforeunload', event => {
    if (dirty && !save() && lastBackup !== JSON.stringify(project)) { event.preventDefault(); event.returnValue = ''; }
  });
})();
