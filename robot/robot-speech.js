// iTech Cambodia — AI Robot Mascot — speech bubble + text-to-speech
// Builds its own DOM (bubble + mute toggle). Every spoken line shows in the
// bubble immediately; the voice (SpeechSynthesis) only starts once audio has
// been unlocked by a user gesture (see robot-audio.js) — mirrors the same
// "no autoplay" rule for the voice as for sound effects.

import { CONFIG } from "./config.js";
import { state } from "./robot-state.js";
import { on } from "./robot-events.js";
import { audio } from "./robot-audio.js";

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

export function createSpeech(container) {
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
    if (ms > 0) hideTimer = setTimeout(hide, ms);
    speakAloud(text);
  }
  function hide() {
    bubble.classList.remove("show");
  }

  // ---------- section awareness ----------
  let lastSpokenAt = 0;
  on("section", (e) => {
    const msg = CONFIG.sectionMessages[e.detail.id];
    if (!msg) return;
    const now = performance.now();
    if (now - lastSpokenAt < 4000) return;
    lastSpokenAt = now;
    say(msg);
  });

  return { say, hide };
}
