// iTech Cambodia — AI Robot Mascot — speech bubble + text-to-speech
// Builds its own DOM (bubble + mute toggle). Every spoken line shows in the
// bubble immediately; the voice (SpeechSynthesis) only starts once audio has
// been unlocked by a user gesture (see audio.js) — browsers block it before
// that regardless, so this mirrors the same "no autoplay" rule for voice.

import { CONFIG, prefersReducedMotion } from "./config.js";
import { state } from "./state.js";
import { on } from "./events.js";
import { audio } from "./audio.js";

let ttsVoice = null;
function pickVoice() {
  if (!window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  for (const hint of CONFIG.tts.voiceNameHints) {
    const match = voices.find((v) => v.name === hint);
    if (match) return match;
  }
  return voices.find((v) => v.lang === CONFIG.tts.lang) || voices.find((v) => v.lang?.startsWith("en")) || voices[0];
}
if (window.speechSynthesis) {
  ttsVoice = pickVoice();
  window.speechSynthesis.onvoiceschanged = () => {
    ttsVoice = pickVoice();
  };
}

export function createSpeech(ctx) {
  const { container } = ctx;

  const bubble = document.createElement("div");
  bubble.className = "itech-robot-bubble";
  bubble.setAttribute("role", "status");
  bubble.setAttribute("aria-live", "polite");
  container.appendChild(bubble);

  const muteBtn = document.createElement("button");
  muteBtn.type = "button";
  muteBtn.className = "itech-robot-mute";
  muteBtn.setAttribute("aria-label", state.muted ? "Unmute robot voice" : "Mute robot voice");
  muteBtn.innerHTML = muteIcon(state.muted);
  container.appendChild(muteBtn);

  muteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const next = !state.muted;
    state.setMuted(next);
    muteBtn.innerHTML = muteIcon(next);
    muteBtn.setAttribute("aria-label", next ? "Unmute robot voice" : "Mute robot voice");
    if (next && window.speechSynthesis) window.speechSynthesis.cancel();
  });

  function muteIcon(muted) {
    return muted
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9v6h4l5 5V4L7 9H3Z"/><path d="m16 9 5 6M21 9l-5 6"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9v6h4l5 5V4L7 9H3Z"/><path d="M16 8.5a4 4 0 0 1 0 7M18.5 6a7.5 7.5 0 0 1 0 12"/></svg>';
  }

  let hideTimer = null;

  /** Cancels any in-progress utterance before starting the new one. */
  function speakAloud(text) {
    if (!CONFIG.tts.enabled || state.muted || !audio.isUnlocked() || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text.replace(/[\u{1F300}-\u{1FAFF}☀-➿]/gu, ""));
    utter.lang = CONFIG.tts.lang;
    utter.rate = CONFIG.tts.rate;
    utter.pitch = CONFIG.tts.pitch;
    utter.volume = CONFIG.tts.volume;
    if (ttsVoice) utter.voice = ttsVoice;
    window.speechSynthesis.speak(utter);
  }

  function say(text, ms = CONFIG.timing.speechAutoHideMs) {
    bubble.textContent = text;
    bubble.classList.add("show");
    clearTimeout(hideTimer);
    if (ms > 0 && ms < 999999) hideTimer = setTimeout(hide, ms);
    speakAloud(text);
  }
  function hide() {
    bubble.classList.remove("show");
  }

  // ---------- section awareness ----------
  let lastSpokenAt = 0;
  on("section", (e) => {
    const msg = CONFIG.sectionMessages[e.detail.id];
    if (!msg || state.asleep) return;
    const now = performance.now();
    if (now - lastSpokenAt < 4000) return;
    lastSpokenAt = now;
    say(msg);
  });

  // ---------- confetti (double-click celebration) ----------
  function confetti() {
    if (prefersReducedMotion()) return;
    const canvas = document.createElement("canvas");
    canvas.className = "itech-robot-confetti";
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);
    const c2d = canvas.getContext("2d");
    const rect = ctx.container.getBoundingClientRect();
    const originX = rect.left + rect.width / 2;
    const originY = rect.top + rect.height / 2;
    const colors = ["#3ec6ff", "#f36a1f", "#ffffff", "#8fe3ff", "#0e1f3d"];
    const pieces = Array.from({ length: 42 }, () => ({
      x: originX,
      y: originY,
      vx: (Math.random() - 0.5) * 9,
      vy: -Math.random() * 8 - 3,
      size: 4 + Math.random() * 4,
      color: colors[(Math.random() * colors.length) | 0],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
    }));
    let frame = 0;
    const maxFrames = 90;
    function step() {
      frame += 1;
      c2d.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of pieces) {
        p.vy += 0.22;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        c2d.save();
        c2d.translate(p.x, p.y);
        c2d.rotate(p.rot);
        c2d.fillStyle = p.color;
        c2d.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        c2d.restore();
      }
      if (frame < maxFrames) requestAnimationFrame(step);
      else canvas.remove();
    }
    requestAnimationFrame(step);
  }

  return { say, hide, confetti };
}
