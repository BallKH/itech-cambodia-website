// iTech Cambodia — AI Robot Mascot — state store
// Tiny pub/sub state machine. Keeps robot.js/animation.js/interaction.js/speech.js
// decoupled: nobody reaches into another module's internals, everyone reads/writes
// through here and reacts to "change" events.

import { CONFIG } from "./config.js";

const MODES = Object.freeze({
  BOOT: "boot",
  GREETING: "greeting",
  IDLE: "idle",
  WORKING: "working",
  DRAGGING: "dragging",
  CELEBRATING: "celebrating",
  RESTING: "resting",
  REACTING: "reacting", // short one-off gesture (click/hover reactions)
});

class RobotState extends EventTarget {
  constructor() {
    super();
    this.mode = MODES.BOOT;
    this.currentSection = null;
    this.muted = this._readMutePref();
    this.clickCount = 0;
    this.lastClickAt = 0;
    this.superhero = false;
    this.cursor = { x: 0, y: 0, active: false };
    this.reduced = false;
  }

  _readMutePref() {
    try {
      const v = localStorage.getItem(CONFIG.sound.storageKey);
      return v === null ? !CONFIG.sound.enabledByDefault : v === "1";
    } catch {
      return !CONFIG.sound.enabledByDefault;
    }
  }

  setMode(mode, detail = {}) {
    const prev = this.mode;
    this.mode = mode;
    this.dispatchEvent(new CustomEvent("mode", { detail: { mode, prev, ...detail } }));
  }

  setSection(id) {
    if (id === this.currentSection) return;
    this.currentSection = id;
    this.dispatchEvent(new CustomEvent("section", { detail: { id } }));
  }

  setMuted(muted) {
    this.muted = muted;
    try {
      localStorage.setItem(CONFIG.sound.storageKey, muted ? "1" : "0");
    } catch {
      /* private-mode storage may throw — non-fatal */
    }
    this.dispatchEvent(new CustomEvent("mute", { detail: { muted } }));
  }

  setCursor(x, y, active) {
    this.cursor.x = x;
    this.cursor.y = y;
    this.cursor.active = active;
  }

  registerClick() {
    const now = performance.now();
    if (now - this.lastClickAt > CONFIG.timing.tenClickWindowMs) this.clickCount = 0;
    this.clickCount += 1;
    this.lastClickAt = now;
    this.dispatchEvent(new CustomEvent("click-count", { detail: { count: this.clickCount } }));
    return this.clickCount;
  }

  triggerSuperhero() {
    this.superhero = true;
    this.dispatchEvent(new CustomEvent("superhero", { detail: { active: true } }));
  }

  on(type, handler) {
    this.addEventListener(type, handler);
    return () => this.removeEventListener(type, handler);
  }
}

export const state = new RobotState();
export { MODES };
