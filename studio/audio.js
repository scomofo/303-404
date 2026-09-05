/* Shared synthesis and event scheduling for live playback and offline WAVs. */
(() => {
  const P = globalThis.DCStudioProject;
  const TAIL = 1.1;
  const FLOOR = 0.0001;
  class Engine {
    constructor(ctx, master = 0.7) {
      this.ctx = ctx; this.sources = new Set(); this.hats = []; this.previous = null; this.closed = false;
      this.drums = ctx.createGain(); this.bass = ctx.createGain(); this.master = ctx.createGain();
      this.master.gain.value = master * 0.55;
      this.drums.connect(this.master); this.bass.connect(this.master);
      // A soft output stage bounds combined voices before they reach speakers or a take.
      this.output = ctx.createWaveShaper();
      const curve = new Float32Array(4096);
      for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh((i / (curve.length - 1) * 2 - 1) * 1.2) * 0.95;
      this.output.curve = curve; this.output.oversample = '2x';
      this.master.connect(this.output); this.output.connect(ctx.destination);
      this.noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * TAIL), ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      let seed = 303404;
      for (let i = 0; i < data.length; i++) { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; data[i] = (seed >>> 0) / 2147483648 - 1; }
      this.filter = ctx.createBiquadFilter(); this.filter.type = 'lowpass';
      this.envelope = ctx.createGain(); this.envelope.gain.value = FLOOR;
      this.filter.connect(this.envelope); this.envelope.connect(this.bass);
      this.oscillators = ['sawtooth', 'square'].map(type => {
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.type = type; gain.gain.value = 0; osc.connect(gain); gain.connect(this.filter); osc.start();
        return { osc, gain, type };
      });
    }
    setMaster(value, at = this.ctx.currentTime) {
      this.master.gain.cancelScheduledValues(at);
      this.master.gain.setValueAtTime(this.master.gain.value, at);
      this.master.gain.linearRampToValueAtTime(value * 0.55, at + 0.015);
    }
    burst(at, { noise = false, frequency = 180, drop, type = 'sine', filter, duration = 0.12, level = 0.3 } = {}) {
      const ctx = this.ctx, source = noise ? ctx.createBufferSource() : ctx.createOscillator(), amp = ctx.createGain();
      const nodes = [amp];
      if (noise) source.buffer = this.noise;
      else {
        source.type = type; source.frequency.setValueAtTime(frequency, at);
        if (drop) source.frequency.exponentialRampToValueAtTime(drop, at + Math.min(0.09, duration / 2));
      }
      let tail = source;
      if (filter) {
        const node = ctx.createBiquadFilter(); node.type = filter.type; node.frequency.value = filter.frequency; node.Q.value = filter.Q || 1;
        tail.connect(node); tail = node; nodes.push(node);
      }
      tail.connect(amp); amp.connect(this.drums);
      amp.gain.setValueAtTime(FLOOR, at);
      amp.gain.linearRampToValueAtTime(Math.max(FLOOR, level), at + 0.002);
      amp.gain.exponentialRampToValueAtTime(FLOOR, at + duration);
      this.sources.add(source);
      source.onended = () => { this.sources.delete(source); source.disconnect(); nodes.forEach(node => node.disconnect()); };
      source.start(at); source.stop(at + duration + 0.006);
      return { source, amp, at, duration, level };
    }
    drum(voice, at, volume) {
      const tone = options => this.burst(at, { ...options, level: options.level * volume });
      const noise = (frequency, duration, level, type = 'highpass', Q = 1) => tone({ noise: true, filter: { type, frequency, Q }, duration, level });
      switch (voice) {
        case 'bd': return tone({ frequency: 120, drop: 46, duration: 0.5, level: 0.9 });
        case 'sd': tone({ frequency: 190, duration: 0.12, level: 0.24 }); return noise(1900, 0.14, 0.45, 'bandpass', 1.4);
        case 'lt': return tone({ frequency: 110, drop: 72, duration: 0.35, level: 0.6 });
        case 'mt': return tone({ frequency: 165, drop: 108, duration: 0.3, level: 0.55 });
        case 'ht': return tone({ frequency: 240, drop: 155, duration: 0.28, level: 0.5 });
        case 'rs': return noise(1700, 0.035, 0.5, 'bandpass', 6);
        case 'cl': return tone({ frequency: 2500, duration: 0.06, level: 0.3 });
        case 'ma': return noise(8000, 0.03, 0.28);
        case 'cp':
          for (const [offset, duration, level] of [[0, .02, .4], [.009, .02, .4], [.018, .02, .4], [.026, .12, .3]]) {
            this.burst(at + offset, { noise: true, filter: { type: 'bandpass', frequency: 1150, Q: 1.2 }, duration, level: level * volume });
          }
          return;
        case 'cb':
          tone({ frequency: 540, type: 'square', duration: 0.32, level: .16, filter: { type: 'bandpass', frequency: 2640 } });
          return tone({ frequency: 800, type: 'square', duration: 0.32, level: .16, filter: { type: 'bandpass', frequency: 2640 } });
        case 'cy': return noise(7000, 1, .22);
        case 'oh': {
          this.hats = this.hats.filter(hat => hat.at + hat.duration > at);
          const hat = noise(6000, .28, .28); this.hats.push(hat); return hat;
        }
        case 'ch':
          // Preserve both source hits, while the closed hat chokes an open tail.
          this.hats = this.hats.filter(hat => hat.at + hat.duration > at);
          for (const hat of this.hats) {
            if (hat.at > at) continue;
            const level = Math.max(FLOOR, hat.level * Math.pow(FLOOR / Math.max(FLOOR, hat.level), Math.max(0, at - hat.at) / hat.duration));
            hat.amp.gain.cancelScheduledValues(at); hat.amp.gain.setValueAtTime(level, at);
            hat.amp.gain.linearRampToValueAtTime(FLOOR, at + .004); hat.source.stop(at + .006);
          }
          // Remove choked hats so a later closed hit cannot extend their stop time.
          this.hats = this.hats.filter(hat => hat.at > at);
          return noise(7500, .045, .3);
      }
    }
    scheduleStep(scene, event, at, bpm) {
      if (this.closed) return;
      const stepSeconds = 15 / bpm, d = event.tick % scene.drums.steps, b = event.tick % scene.bass.notes.length;
      const mix = scene.mix;
      this.drums.gain.setValueAtTime(mix.muteDrums ? 0 : mix.drums, at);
      this.bass.gain.setValueAtTime(mix.muteBass ? 0 : mix.bass, at);
      const volume = scene.drums.rows.ac.includes(d) ? 1 : .72;
      for (const voice of P.VOICES) {
        if (voice === 'ac' || !scene.drums.rows[voice].includes(d)) continue;
        const key = scene.drums.pair[voice]?.toLowerCase() || voice;
        this.drum(key, at, volume);
      }
      const note = scene.bass.notes[b], midi = P.noteMidi(note), gain = this.envelope.gain;
      gain.cancelScheduledValues(at);
      if (midi === null) {
        gain.setValueAtTime(FLOOR, at); this.previous = null; return;
      }
      const frequency = 440 * Math.pow(2, (midi - 69) / 12);
      const slide = !event.first && this.previous?.scene === scene.id && this.previous?.slide;
      for (const { osc, gain: wave, type } of this.oscillators) {
        osc.frequency.cancelScheduledValues(at);
        osc.frequency.setValueAtTime(slide ? this.previous.frequency : frequency, at);
        if (slide) osc.frequency.exponentialRampToValueAtTime(frequency, at + Math.min(.04, stepSeconds * .3));
        wave.gain.setValueAtTime(scene.bass.waveform === type ? 1 : 0, at);
      }
      const accented = scene.bass.accent.includes(b), peak = accented ? .28 : .18;
      const cutoff = Math.min(12000, mix.cutoff * (accented ? 1.6 : 1));
      this.filter.Q.setValueAtTime(mix.resonance, at);
      this.filter.frequency.cancelScheduledValues(at); this.filter.frequency.setValueAtTime(cutoff, at);
      this.filter.frequency.exponentialRampToValueAtTime(Math.max(70, mix.cutoff * .4), at + stepSeconds * .8);
      gain.setValueAtTime(slide ? this.previous.peak : FLOOR, at);
      gain.linearRampToValueAtTime(peak, at + .006);
      const outgoing = scene.bass.slide.includes(b) && scene.bass.notes[(b + 1) % scene.bass.notes.length] !== null;
      if (outgoing) gain.setValueAtTime(peak, at + stepSeconds * .96);
      else gain.exponentialRampToValueAtTime(FLOOR, at + stepSeconds * .8);
      this.previous = { scene: scene.id, frequency, peak, slide: outgoing };
    }
    finishAt(at) {
      this.envelope.gain.setValueAtTime(this.previous?.slide ? this.previous.peak : FLOOR, at);
      this.envelope.gain.linearRampToValueAtTime(FLOOR, at + .01);
    }
    stop() {
      if (this.closed) return;
      this.closed = true;
      const now = this.ctx.currentTime;
      for (const source of this.sources) { try { source.stop(now); } catch {} }
      this.sources.clear();
      for (const { osc, gain } of this.oscillators) { try { osc.stop(now); } catch {} osc.disconnect(); gain.disconnect(); }
      for (const node of [this.filter, this.envelope, this.drums, this.bass, this.master, this.output]) node.disconnect();
      this.hats = [];
    }
  }

  class Transport {
    constructor(ctx, getProject, { onVisual = () => {}, onStop = () => {}, onError = () => {}, timer = setTimeout, cancel = clearTimeout } = {}) {
      this.ctx = ctx; this.getProject = getProject; this.onVisual = onVisual; this.onStop = onStop; this.onError = onError;
      this.timer = timer; this.cancel = cancel; this.running = false; this.handle = null; this.pending = null;
    }
    start(mode = 'scene', sceneId = 'B') {
      this.stop();
      const project = P.validateProject(this.getProject());
      this.engine = new Engine(this.ctx, project.master);
      this.mode = mode; this.sceneId = sceneId; this.pending = null; this.tick = 0; this.step = 0;
      this.startTime = this.ctx.currentTime + .06; this.nextTime = this.startTime; this.queue = [];
      this.events = mode === 'arrangement' ? P.arrangementEvents(project) : null;
      this.endAt = mode === 'arrangement' ? this.startTime + P.duration(project) + TAIL : Infinity;
      this.running = true; this.pump();
      return this.engine;
    }
    queueScene(id) { if (P.SCENES.includes(id) && this.mode === 'scene') this.pending = id; }
    pump() {
      if (!this.running) return;
      const now = this.ctx.currentTime;
      if (now >= this.endAt) { this.stop('Arrangement finished.'); return; }
      if (now > this.nextTime + .25 && (!this.events || this.step < this.events.length)) {
        this.stop('Playback stopped after a timing interruption. Press Play to restart.'); return;
      }
      try {
        const project = this.getProject();
        while (this.nextTime < now + .1 && (!this.events || this.step < this.events.length)) {
          let first = this.step === 0;
          if (!this.events && this.pending && this.tick % 16 === 0) { this.sceneId = this.pending; this.pending = null; this.tick = 0; first = true; }
          const event = this.events?.[this.step] || { sceneId: this.sceneId, tick: this.tick, step: this.step, bar: Math.floor(this.step / 16), first };
          const scene = project.scenes.find(scene => scene.id === event.sceneId);
          this.engine.scheduleStep(scene, event, this.nextTime, project.bpm);
          this.queue.push({ ...event, at: this.nextTime });
          this.step++; this.tick++; this.nextTime = this.startTime + this.step * 15 / project.bpm;
          if (this.events && this.step === this.events.length) this.engine.finishAt(this.nextTime);
        }
        let visual;
        while (this.queue.length && this.queue[0].at <= now) visual = this.queue.shift();
        if (visual) this.onVisual(visual);
        this.handle = this.timer(() => this.pump(), 25);
      } catch (error) { this.stop(); this.onError(error); }
    }
    stop(message = '') {
      if (this.handle !== null) this.cancel(this.handle);
      this.handle = null;
      const running = this.running;
      this.running = false; this.queue = []; this.pending = null;
      this.engine?.stop();
      if (running) this.onStop(message);
    }
  }

  function encodeWav(audio) {
    const channels = 2, frames = audio.length, sampleRate = audio.sampleRate;
    const buffer = new ArrayBuffer(44 + frames * channels * 2), view = new DataView(buffer);
    const write = (offset, value) => { for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i)); };
    write(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true); write(8, 'WAVE'); write(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, channels, true);
    view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 4, true); view.setUint16(32, 4, true); view.setUint16(34, 16, true);
    write(36, 'data'); view.setUint32(40, frames * 4, true);
    const left = audio.getChannelData(0), right = audio.getChannelData(Math.min(1, audio.numberOfChannels - 1));
    let peak = 0;
    for (let i = 0; i < frames; i++) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
    if (!Number.isFinite(peak)) throw new Error('Audio render contained invalid samples.');
    const scale = peak > .98 ? .98 / peak : 1;
    const sample = value => Math.round(value * scale * (value < 0 ? 32768 : 32767));
    for (let i = 0, offset = 44; i < frames; i++, offset += 4) {
      view.setInt16(offset, sample(left[i]), true);
      view.setInt16(offset + 2, sample(right[i]), true);
    }
    return { buffer, sampleRate, bitDepth: 16, channels, duration: frames / sampleRate, peak: peak * scale };
  }
  async function renderArrangement(project, OfflineContext = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext) {
    if (!OfflineContext) throw new Error('This browser cannot render a WAV. You can still play and save the project.');
    const snapshot = P.validateProject(project), musicDuration = P.duration(snapshot), rate = 44100;
    const ctx = new OfflineContext(2, Math.ceil((musicDuration + TAIL) * rate), rate);
    const engine = new Engine(ctx, snapshot.master);
    try {
      for (const event of P.arrangementEvents(snapshot)) engine.scheduleStep(snapshot.scenes.find(scene => scene.id === event.sceneId), event, event.time, snapshot.bpm);
      engine.finishAt(musicDuration);
      const result = encodeWav(await ctx.startRendering());
      return { ...result, musicDuration };
    } finally { engine.stop(); }
  }

  class TakeRecorder {
    constructor(ctx, output, Recorder = globalThis.MediaRecorder) {
      if (!Recorder || !ctx.createMediaStreamDestination) throw new Error('Live recording is unavailable in this browser. Use Export arrangement WAV instead.');
      this.destination = ctx.createMediaStreamDestination(); this.output = output; output.connect(this.destination);
      const preferred = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find(type => Recorder.isTypeSupported?.(type));
      try { this.recorder = new Recorder(this.destination.stream, preferred ? { mimeType: preferred } : undefined); }
      catch (error) { this.disconnect(); throw error; }
      this.chunks = []; this.done = false;
      this.result = new Promise((resolve, reject) => { this.resolve = resolve; this.reject = reject; });
      this.recorder.ondataavailable = event => { if (event.data.size) this.chunks.push(event.data); };
      this.recorder.onerror = event => { this.done = true; this.disconnect(); this.reject(event.error || new Error('Recording failed.')); };
      this.recorder.onstop = () => {
        if (this.done) return;
        this.done = true; this.disconnect();
        const mimeType = this.recorder.mimeType || this.chunks[0]?.type || 'audio/webm';
        const blob = new Blob(this.chunks, { type: mimeType });
        if (!blob.size) { this.reject(new Error('The take is empty. Play a scene before recording.')); return; }
        this.resolve({ blob, extension: mimeType.includes('mp4') ? 'm4a' : mimeType.includes('ogg') ? 'ogg' : 'webm' });
        this.chunks = [];
      };
    }
    start() { try { this.recorder.start(1000); } catch (error) { this.done = true; this.disconnect(); this.reject(error); } return this.result; }
    stop() { if (this.recorder.state !== 'inactive') this.recorder.stop(); return this.result; }
    disconnect() { try { this.output.disconnect(this.destination); } catch {} this.destination?.stream.getTracks().forEach(track => track.stop()); }
  }
  globalThis.DCStudioAudio = { TAIL, Engine, Transport, encodeWav, renderArrangement, TakeRecorder };
})();
