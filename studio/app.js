(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const LS_KEY = '303-404/groove-studio/v1';
  const P = globalThis.DCStudioProject, A = globalThis.DCStudioAudio, banks = globalThis.DCStudioBanks;
  let storage = null, storageProblem = '';
  try { storage = window.localStorage; } catch { storageProblem = 'Browser storage is unavailable. You can still play, but projects will not survive a reload.'; }
  const store = storage ? new P.ProjectStore(storage) : null;
  let project = null, transport = null, ctx = null, selectedSceneId = null, sceneMode = true, view = 'studio';
  const engine = () => transport?.engine;
  const selectedScene = () => project.scenes.find(s => s.id === selectedSceneId) || project.scenes[0];

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function status(message) { const el = $('#studio-status'); if (el.textContent !== message) el.textContent = message; }
  function positionText() {
    const el = $('#position');
    if (!transport?.running) { el.textContent = 'Stopped'; return; }
    const scene = engine()?.currentScene;
    const bar = scene ? engine().sceneBar(scene.id) + 1 : 1;
    const tick = engine()?.tick ?? 0;
    el.textContent = `${scene ? scene.name : '—'} · Bar ${bar} · Step ${tick % 16 + 1}`;
  }
  function markSaved() { $('#save-state').textContent = store ? 'Saved in this browser' : storageProblem || 'Not saved — storage unavailable'; }
  function markDirty() { $('#save-state').textContent = store ? 'Unsaved changes' : storageProblem || 'Not saved — storage unavailable'; }
  function save() {
    if (!store) return;
    try { store.save(project); markSaved(); } catch { status('Could not save. Your music is still here — free some browser storage and try again.'); }
  }
  function loadAll() {
    if (!store) return [];
    try { return store.list(); } catch { return []; }
  }

  function ensureAudio() {
    return A.ensureAudioContext({
      get: () => ctx,
      set: next => { ctx = next; },
      onPaused: () => { status('Audio paused. Press Play to resume.'); paintTransport(); },
      unavailableMessage: 'Audio is unavailable in this browser. Try a current browser. You can still edit patterns and save projects.',
      pausedMessage: 'Audio is paused. Press Play to try again.',
    });
  }

  function setView(next) {
    view = next;
    document.body.dataset.view = view;
    for (const btn of $$('.view-switch button')) btn.setAttribute('aria-pressed', String(btn.dataset.view === view));
    $('#scene-panel').hidden = view !== 'studio';
    $('#arrange-panel').hidden = view !== 'arrange';
    $('#view-heading').textContent = view === 'studio' ? 'Scenes' : 'Arrangement';
    renderEditor(); renderArrange(); positionText();
  }

  function focusSceneTab(id) {
    const tab = $(`.scene-tab[data-scene-id="${CSS.escape(id)}"]`);
    if (tab) tab.focus();
  }
  function selectScene(id) {
    if (!project.scenes.some(s => s.id === id)) return;
    if (transport?.running && sceneMode) transport.queueScene(id);
    selectedSceneId = id;
    renderEditor();
    focusSceneTab(id);
  }

  function renderSceneTabs() {
    const wrap = $('#scene-tabs');
    wrap.replaceChildren(...project.scenes.map(s => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'scene-tab';
      btn.dataset.sceneId = s.id;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', String(s.id === selectedSceneId));
      btn.setAttribute('aria-label', `${s.name} scene`);
      btn.innerHTML = `<strong>${escapeHtml(s.name)}</strong><span>${s.bars} bar${s.bars === 1 ? '' : 's'} · ${s.tempo} BPM</span>`;
      btn.addEventListener('click', () => selectScene(s.id));
      return btn;
    }));
  }

  function paintTransport() {
    const playing = !!transport?.running;
    $('#play-scene').setAttribute('aria-pressed', String(playing && sceneMode));
    $('#play-scene').textContent = playing && sceneMode ? '■ Stop' : '▶ Play scene';
    $('#play-arr').setAttribute('aria-pressed', String(playing && !sceneMode));
    $('#play-arr').textContent = playing && !sceneMode ? '■ Stop' : '▶ Play arrangement';
    $('#record').setAttribute('aria-pressed', String(!!engine()?.recording));
    $('#record').classList.toggle('recording', !!engine()?.recording);
    $('#tempo').value = String(selectedScene().tempo);
    $('#tempo-out').textContent = `${selectedScene().tempo} BPM`;
    positionText();
  }

  function paintStepGrid() {
    const scene = selectedScene();
    $('#step-grid').replaceChildren(...scene.drums.lanes.map(lane => {
      const row = document.createElement('div');
      row.className = 'step-lane';
      row.dataset.lane = lane.key;
      row.innerHTML = `<span class="lane-name">${escapeHtml(lane.name)}</span><div class="lane-steps"></div>`;
      const steps = row.querySelector('.lane-steps');
      for (let i = 0; i < 16; i++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'step';
        btn.dataset.step = String(i);
        btn.dataset.on = String(lane.steps.includes(i));
        btn.setAttribute('aria-pressed', String(lane.steps.includes(i)));
        btn.setAttribute('aria-label', `${lane.name}, step ${i + 1}, beat ${Math.floor(i / 4) + 1}`);
        btn.addEventListener('click', () => {
          const idx = lane.steps.indexOf(i);
          if (idx === -1) lane.steps.push(i); else lane.steps.splice(idx, 1);
          lane.steps.sort((a, b) => a - b);
          updateLivePattern(scene);
          paintStepGrid(); markDirty();
        });
        steps.append(btn);
      }
      return row;
    }));
  }

  function paintBassLane() {
    const scene = selectedScene();
    const lane = $('#bass-lane');
    lane.replaceChildren(...scene.bass.notes.map((note, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bass-step';
      btn.dataset.on = String(!!note);
      btn.setAttribute('aria-pressed', String(!!note));
      btn.setAttribute('aria-label', note ? `Bass step ${i + 1}: ${note}` : `Bass step ${i + 1}: empty`);
      btn.textContent = note || '·';
      btn.addEventListener('click', () => {
        const phrase = banks.randomBassPhrase(project.seed + i);
        scene.bass.notes[i] = scene.bass.notes[i] ? '' : phrase.notes[i % phrase.notes.length];
        updateLivePattern(scene);
        paintBassLane(); markDirty();
      });
      return btn;
    }));
  }

  function paintMixer() {
    const scene = selectedScene();
    for (const lane of scene.drums.lanes) {
      const input = $(`#mix-${lane.key}`);
      if (input) input.value = String(lane.level);
    }
    const bassLevel = $('#mix-bass');
    if (bassLevel) bassLevel.value = String(scene.bass.level);
  }

  function renderEditor() {
    renderSceneTabs();
    paintStepGrid();
    paintBassLane();
    paintMixer();
    paintTransport();
  }

  function renderArrange() {
    const list = $('#scene-list');
    list.replaceChildren(...project.scenes.map(s => {
      const item = document.createElement('li');
      item.className = 'arrange-item';
      item.innerHTML = `
        <div class="arrange-row">
          <button type="button" class="arrange-name" data-scene-id="${escapeHtml(s.id)}">${escapeHtml(s.name)}</button>
          <span class="arrange-meta">${s.bars} bar${s.bars === 1 ? '' : 's'} · ${s.tempo} BPM</span>
          <span class="arrange-order" aria-label="Scene order">${project.scenes.indexOf(s) + 1} / ${project.scenes.length}</span>
        </div>
        <div class="arrange-controls">
          <label>Bars <input type="number" min="1" max="16" value="${s.bars}" data-bars="${escapeHtml(s.id)}"></label>
          <label>Tempo <input type="number" min="60" max="180" value="${s.tempo}" data-tempo="${escapeHtml(s.id)}"></label>
        </div>`;
      return item;
    }));
    for (const input of $$('#scene-list input[data-bars]')) {
      input.addEventListener('change', () => {
        const scene = project.scenes.find(s => s.id === input.dataset.bars);
        scene.bars = Math.max(1, Math.min(16, Number(input.value) || 1));
        input.value = String(scene.bars);
        updateLivePattern(scene);
        renderSceneTabs(); renderArrange(); markDirty();
      });
    }
    for (const input of $$('#scene-list input[data-tempo]')) {
      input.addEventListener('change', () => {
        const scene = project.scenes.find(s => s.id === input.dataset.tempo);
        scene.tempo = Math.max(60, Math.min(180, Number(input.value) || scene.tempo));
        input.value = String(scene.tempo);
        updateLivePattern(scene);
        renderSceneTabs(); renderArrange(); paintTransport(); markDirty();
      });
    }
    for (const btn of $$('#scene-list .arrange-name')) {
      btn.addEventListener('click', () => { selectScene(btn.dataset.sceneId); setView('studio'); });
    }
  }

  function updateLivePattern(scene) {
    if (engine()) engine().applyScene(project, scene.id);
  }

  async function play(mode) {
    sceneMode = mode === 'scene';
    if (transport?.running) {
      transport.stop();
      status('Stopped.');
      paintTransport();
      return;
    }
    try {
      await ensureAudio();
      transport = new A.Transport(ctx, () => project, {
        sceneMode: () => sceneMode,
        onScene: id => { selectedSceneId = id; renderEditor(); },
        onVisual: () => positionText(),
        onStop: () => { paintTransport(); positionText(); },
        onError: err => status(err.message),
      });
      transport.start(mode);
      status(sceneMode ? 'Playing the selected scene on a loop.' : 'Playing the full arrangement in scene order.');
      paintTransport();
    } catch (err) {
      status(err.message || 'Audio could not start. Press Play to try again.');
    }
  }
  function stopPlayback(message = 'Stopped.') {
    transport?.stop();
    status(message);
    paintTransport();
  }

  function buildMixer() {
    const wrap = $('#mixer');
    const lanes = [...banks.voices.map(v => ({ key: v.key, name: v.name, level: 0.8 })), { key: 'bass', name: 'Bass', level: 0.7 }];
    wrap.replaceChildren(...lanes.map(lane => {
      const label = document.createElement('label');
      label.className = 'mix-channel';
      label.innerHTML = `<span>${escapeHtml(lane.name)}</span><input id="mix-${lane.key}" type="range" min="0" max="100" value="${Math.round(lane.level * 100)}" aria-label="${escapeHtml(lane.name)} level">`;
      label.querySelector('input').addEventListener('input', event => {
        const scene = selectedScene();
        if (lane.key === 'bass') scene.bass.level = Number(event.target.value) / 100;
        else scene.drums.lanes.find(l => l.key === lane.key).level = Number(event.target.value) / 100;
        updateLivePattern(scene);
        markDirty();
      });
      return label;
    }));
  }

  function initProjectFromQuery() {
    const params = new URLSearchParams(location.search);
    const projectId = params.get('project');
    if (projectId && store) {
      try {
        const saved = store.load(projectId);
        if (saved) { project = saved; status('Loaded your saved project. Press Play to hear it.'); }
      } catch {
        status('That saved project could not be opened, so a fresh one was started.');
      }
    }
    if (!project) {
      const rows = banks.patternRows('starter', 0);
      project = P.createProject('My first groove', banks, rows);
      const seedScene = project.scenes[0];
      seedScene.bass.notes = banks.randomBassPhrase(7).notes.map((n, i) => (i % 4 === 0 ? n : ''));
      status('A starter groove is loaded. Press Play, then tap pads to make it yours.');
    }
    selectedSceneId = project.scenes[0].id;
    renderEditor(); renderArrange(); buildMixer(); markSaved();
    document.title = `${project.name} · Groove Studio · 303–404`;
    $('#project-name').value = project.name;
    renderProjectList();
  }

  function renderProjectList() {
    const list = $('#project-list');
    const items = loadAll();
    list.replaceChildren(...items.map(item => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'project-item';
      btn.setAttribute('aria-pressed', String(item.id === project.id));
      btn.innerHTML = `<strong>${escapeHtml(item.name)}</strong><span>${new Date(item.updatedAt).toLocaleString()}</span>`;
      btn.addEventListener('click', () => {
        if (item.id === project.id) return;
        stopPlayback('Switched project.');
        try {
          const next = store.load(item.id);
          if (!next) throw new Error('missing');
          project = next;
          selectedSceneId = project.scenes[0].id;
          renderEditor(); renderArrange(); markSaved();
          document.title = `${project.name} · Groove Studio · 303–404`;
          $('#project-name').value = project.name;
          status(`Opened “${project.name}”.`);
        } catch {
          status('That project could not be opened. It may have been saved by a different version.');
        }
        renderProjectList();
      });
      li.append(btn);
      return li;
    }));
    if (!items.length) {
      const li = document.createElement('li');
      li.className = 'project-empty';
      li.textContent = store ? 'No saved projects yet — your keeps from Beat Arcade land here.' : storageProblem;
      list.append(li);
    }
  }

  function bindGlobal() {
    $('#project-name').addEventListener('change', event => {
      project.name = event.target.value.trim() || 'Untitled groove';
      event.target.value = project.name;
      document.title = `${project.name} · Groove Studio · 303–404`;
      markDirty(); save(); renderProjectList();
    });
    $('#save-project').addEventListener('click', () => { save(); status('Saved. This project is stored in this browser.'); });
    $('#new-project').addEventListener('click', () => {
      stopPlayback('New project ready.');
      project = P.createProject('Untitled groove', banks, banks.patternRows('starter', 0));
      selectedSceneId = project.scenes[0].id;
      renderEditor(); renderArrange(); markSaved();
      document.title = `${project.name} · Groove Studio · 303–404`;
      $('#project-name').value = project.name;
      save(); renderProjectList();
      status('Started a new project. Press Play to hear the starter groove.');
    });
    $('#tempo').addEventListener('input', event => {
      const scene = selectedScene();
      scene.tempo = Number(event.target.value);
      $('#tempo-out').textContent = `${scene.tempo} BPM`;
      updateLivePattern(scene);
      markDirty();
    });
    $('#play-scene').addEventListener('click', () => play('scene'));
    $('#play-arr').addEventListener('click', () => play('arrange'));
    $('#record').addEventListener('click', async () => {
      if (!transport?.running) { status('Press Play first — recording captures what is playing.'); return; }
      try {
        await ensureAudio();
        if (!engine()?.recording) {
          const take = await engine().record(4);
          status(`Recording… ${take.sceneName} will export when the take finishes.`);
        } else {
          engine().stopRecording();
        }
        paintTransport();
      } catch (err) {
        status(err.message || 'Recording could not start.');
      }
    });
    $('#stop').addEventListener('click', () => stopPlayback());
    for (const btn of $$('.view-switch button')) {
      btn.addEventListener('click', () => setView(btn.dataset.view));
    }
    // Keyboard: Space toggles playback (anywhere except on a button, where it
    // keeps its native meaning), and 1–4 jump to scenes. While playing, a
    // scene switch queues on the next bar boundary so the groove never drops.
    document.addEventListener('keydown', event => {
      if (event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target || {}, tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return;
      if (event.key === ' ') {
        if (tag === 'BUTTON') return;
        event.preventDefault();
        if (transport?.running) stopPlayback('Stopped.');
        else play('scene');
        return;
      }
      if (/^[1-4]$/.test(event.key)) {
        const next = project.scenes[Number(event.key) - 1];
        if (next) { event.preventDefault(); selectScene(next.id); }
      }
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) transport?.stop(); });
    window.addEventListener('pagehide', () => transport?.stop());
  }

  bindGlobal();
  initProjectFromQuery();
  setView('studio');
})();
