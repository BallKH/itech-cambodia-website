// iTech Cambodia — AI Robot Mascot — sound effects (Web Audio, synthesized)
// No audio files are shipped — every sound is a tiny oscillator envelope.
// Browsers block audio before a user gesture, so the AudioContext is created
// lazily and resumed on the first pointerdown/keydown/touchstart, per:
//   first interaction -> unlock AudioContext -> future calls play immediately.

import { CONFIG } from "./config.js";
import { state } from "./state.js";
import { emit } from "./events.js";

let audioCtx = null;
let unlocked = false;

function ensureContext() {
  if (audioCtx) return audioCtx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  audioCtx = new AC();
  return audioCtx;
}

function unlock() {
  const ac = ensureContext();
  if (!ac) return;
  const finish = () => {
    unlocked = true;
    emit("audio:unlocked", {});
  };
  if (ac.state === "suspended") {
    ac.resume().then(finish).catch(() => {});
  } else {
    finish();
  }
}

function armUnlockOnGesture() {
  const handler = () => {
    unlock();
    window.removeEventListener("pointerdown", handler);
    window.removeEventListener("keydown", handler);
    window.removeEventListener("touchstart", handler);
  };
  window.addEventListener("pointerdown", handler, { once: true, passive: true });
  window.addEventListener("keydown", handler, { once: true });
  window.addEventListener("touchstart", handler, { once: true, passive: true });
}
armUnlockOnGesture();

/** Single tone with a short exponential envelope. */
function tone(freqStart, freqEnd, duration, type = "sine", delay = 0, gainMul = 1) {
  if (state.muted || !unlocked) return;
  const ac = ensureContext();
  if (!ac || ac.state === "suspended") return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(freqStart, 1), t0);
  osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t0 + duration);
  const peak = CONFIG.sound.masterGain * gainMul;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0001), t0 + duration * 0.25);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

/** Named, reusable sound presets — kept small, cute, never harsh. */
export const audio = {
  isUnlocked: () => unlocked,

  beep: () => tone(880, 880, 0.09, "square", 0, 0.7),
  boop: () => tone(280, 220, 0.12, "sine"),
  hello: () => {
    tone(520, 780, 0.16, "sine");
    tone(780, 980, 0.14, "sine", 0.15);
  },
  yay: () => {
    tone(700, 900, 0.09, "triangle");
    tone(900, 1200, 0.1, "triangle", 0.09);
    tone(1200, 1500, 0.12, "triangle", 0.18);
  },
  thinking: () => tone(340, 300, 0.35, "sine", 0, 0.6),
  typing: () => tone(1400 + Math.random() * 300, 1200, 0.035, "square", 0, 0.35),
  happy: () => {
    tone(660, 880, 0.1, "triangle");
    tone(880, 1100, 0.12, "triangle", 0.1);
  },
  wave: () => {
    tone(600, 750, 0.12, "sine");
    tone(750, 700, 0.1, "sine", 0.11);
  },
  laugh: () => {
    for (let i = 0; i < 3; i++) tone(520 + i * 40, 480 + i * 40, 0.08, "triangle", i * 0.08, 0.55);
  },
  success: () => {
    tone(523, 523, 0.1, "triangle");
    tone(659, 659, 0.1, "triangle", 0.1);
    tone(784, 784, 0.16, "triangle", 0.2);
  },
};
