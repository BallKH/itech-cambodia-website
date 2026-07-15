// iTech Cambodia — AI Robot Mascot — state store
// Holds the robot's runtime data (mode, mute pref, click streak, cursor,
// current section, emotion). Publishes changes through the shared events.js
// bus so animation.js/interaction.js/speech.js/emotion.js stay decoupled.

import { CONFIG } from "./config.js";
import { on, emit } from "./events.js";

const MODES = Object.freeze({
  BOOT: "boot",
  GREETING: "greeting",
  IDLE: "idle",
  WORKING: "working",
  DRAGGING: "dragging",
  CELEBRATING: "celebrating",
  RESTING: "resting",
  SLEEPING: "sleeping",
  REACTING: "reacting", // short one-off gesture (click/hover reactions)
});

class RobotState {
  constructor() {
    this.mode = MODES.BOOT;
    this.currentSection = null;
    this.muted = this._readMutePref();
    this.clickCount = 0;
    this.lastClickAt = 0;
    this.superhero = false;
    this.cursor = { x: 0, y: 0, active: false };
    this.reduced = false;
    this.asleep = false;
    this.emotion = "waiting";
    this.lastActivityAt = performance.now();
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
    emit("mode", { mode, prev, ...detail });
  }

  setSection(id) {
    if (id === this.currentSection) return;
    this.currentSection = id;
    emit("section", { id });
  }

  setMuted(muted) {
    this.muted = muted;
    try {
      localStorage.setItem(CONFIG.sound.storageKey, muted ? "1" : "0");
    } catch {
      /* private-mode storage may throw — non-fatal */
    }
    emit("mute", { muted });
  }

  setCursor(x, y, active) {
    this.cursor.x = x;
    this.cursor.y = y;
    this.cursor.active = active;
  }

  setEmotion(name) {
    if (name === this.emotion) return;
    const prev = this.emotion;
    this.emotion = name;
    emit("emotion", { name, prev });
  }

  markActivity() {
    this.lastActivityAt = performance.now();
    if (this.asleep) {
      this.asleep = false;
      emit("wake", {});
    }
  }

  markAsleep() {
    if (this.asleep) return;
    this.asleep = true;
    emit("sleep", {});
  }

  registerClick() {
    const now = performance.now();
    if (now - this.lastClickAt > CONFIG.timing.tenClickWindowMs) this.clickCount = 0;
    this.clickCount += 1;
    this.lastClickAt = now;
    emit("click-count", { count: this.clickCount });
    return this.clickCount;
  }

  triggerSuperhero() {
    this.superhero = true;
    emit("superhero", { active: true });
  }

  on(type, handler) {
    return on(type, handler);
  }
}

export const state = new RobotState();
export { MODES };
