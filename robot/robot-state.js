// iTech Cambodia — AI Robot Mascot — state store
// Holds the mascot's runtime data (mute pref, click streak, cursor, current
// section) and publishes changes through robot-events.js so every other
// module stays decoupled.

import { CONFIG } from "./config.js";
import { on, emit } from "./robot-events.js";

class RobotState {
  constructor() {
    this.currentSection = null;
    this.muted = this._readMutePref();
    this.clickCount = 0;
    this.lastClickAt = 0;
    this.cursor = { x: 0, y: 0, active: false };
  }

  _readMutePref() {
    try {
      const v = localStorage.getItem(CONFIG.sounds.storageKey);
      return v === null ? !CONFIG.sounds.enabledByDefault : v === "1";
    } catch {
      return !CONFIG.sounds.enabledByDefault;
    }
  }

  setSection(id) {
    if (id === this.currentSection) return;
    this.currentSection = id;
    emit("section", { id });
  }

  setMuted(muted) {
    this.muted = muted;
    try {
      localStorage.setItem(CONFIG.sounds.storageKey, muted ? "1" : "0");
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

  registerClick() {
    const now = performance.now();
    if (now - this.lastClickAt > 5000) this.clickCount = 0;
    this.clickCount += 1;
    this.lastClickAt = now;
    return this.clickCount;
  }

  on(type, handler) {
    return on(type, handler);
  }
}

export const state = new RobotState();
