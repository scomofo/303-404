/* Guided four-scene performance practice. It tracks transport events, not musical quality. */
(() => {
  const SCENES = ['A', 'B', 'C', 'D'];
  const BAR_TICKS = 16;
  class Session {
    constructor() { this.active = false; this.completed = 0; this.partial = null; }
    start() { this.active = true; this.completed = 0; this.partial = null; }
    exit() { this.active = false; this.completed = 0; this.stop(); }
    stop() { const hadPartial = !!this.partial; this.partial = null; return hadPartial; }
    observe(event) {
      if (!this.active || this.completed >= SCENES.length) { this.stop(); return false; }
      const target = SCENES[this.completed];
      if (!event || event.sceneId !== target || !Number.isInteger(event.tick) || event.tick < 0) {
        this.stop(); return false;
      }
      const tick = event.tick;
      if (tick % BAR_TICKS === 0) { this.partial = { tick, heard: 1 }; return false; }
      const previous = this.partial;
      if (!previous || tick !== previous.tick + 1) { this.stop(); return false; }
      const heard = previous.heard + 1;
      if (heard !== BAR_TICKS) { this.partial = { tick, heard }; return false; }
      this.completed++; this.partial = null; return true;
    }
    view(project) {
      const complete = this.active && this.completed === SCENES.length;
      const sceneId = this.completed < SCENES.length ? SCENES[this.completed] : null;
      const scene = sceneId ? project?.scenes?.find(item => item.id === sceneId) : null;
      return {
        active: this.active, complete, completed: this.completed, total: SCENES.length,
        sceneId, sceneName: scene?.name || (sceneId ? 'Scene ' + (this.completed + 1) : ''),
      };
    }
  }
  globalThis.DCDropMission = { Session, SCENES };
})();
