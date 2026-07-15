// iTech Cambodia — AI Robot Mascot — sound effects
// Plays the real MP3s at assets/sounds/*.mp3. Per spec: never autoplay —
// audio only starts playing after the first user gesture (pointerdown/
// keydown/touchstart) anywhere on the page, matching browsers' own
// autoplay-blocking rules. Missing files fail silently (caught promise
// rejection) so the site never errors before the sound assets are added.

import { CONFIG } from "./config.js";
import { state } from "./robot-state.js";
import { emit } from "./robot-events.js";

let unlocked = false;
const cache = new Map();

function armUnlockOnGesture() {
  const unlock = () => {
    unlocked = true;
    emit("audio:unlocked", {});
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("keydown", unlock);
    window.removeEventListener("touchstart", unlock);
  };
  window.addEventListener("pointerdown", unlock, { once: true, passive: true });
  window.addEventListener("keydown", unlock, { once: true });
  window.addEventListener("touchstart", unlock, { once: true, passive: true });
}
armUnlockOnGesture();

function play(key) {
  if (state.muted || !unlocked) return;
  const fileName = CONFIG.sounds[key];
  if (!fileName) return;
  let el = cache.get(key);
  if (!el) {
    el = new Audio(CONFIG.sounds.basePath + fileName);
    el.volume = CONFIG.sounds.volume;
    cache.set(key, el);
  }
  try {
    el.currentTime = 0;
  } catch {
    /* not seekable yet — fine, play() below still works */
  }
  el.play().catch(() => {
    /* file missing (404) or blocked — non-fatal, site keeps working */
  });
}

export const audio = {
  isUnlocked: () => unlocked,
  hello: () => play("hello"),
  wave: () => play("wave"),
  happy: () => play("happy"),
  thinking: () => play("thinking"),
  click: () => play("click"),
};
