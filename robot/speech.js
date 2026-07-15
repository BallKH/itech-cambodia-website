// iTech Cambodia — AI Robot Mascot — speech bubble, sound, confetti
// Builds its own DOM (bubble + mute toggle), synthesizes short robotic tones
// via Web Audio (no audio assets to ship), and reacts to section-change
// events from state.js to stay contextually aware of what the visitor sees.

import { CONFIG, prefersReducedMotion } from "./config.js";
import { state } from "./state.js";

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
  muteBtn.setAttribute("aria-label", state.muted ? "Unmute robot sounds" : "Mute robot sounds");
  muteBtn.innerHTML = muteIcon(state.muted);
  container.appendChild(muteBtn);

  muteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const next = !state.muted;
    state.setMuted(next);
    muteBtn.innerHTML = muteIcon(next);
    muteBtn.setAttribute("aria-label", next ? "Unmute robot sounds" : "Mute robot sounds");
  });

  function muteIcon(muted) {
    return muted
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9v6h4l5 5V4L7 9H3Z"/><path d="m16 9 5 6M21 9l-5 6"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9v6h4l5 5V4L7 9H3Z"/><path d="M16 8.5a4 4 0 0 1 0 7M18.5 6a7.5 7.5 0 0 1 0 12"/></svg>';
  }

  let hideTimer = null;
  function say(text, ms = CONFIG.timing.speechAutoHideMs) {
    bubble.textContent = text;
    bubble.classList.add("show");
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hide, ms);
  }
  function hide() {
    bubble.classList.remove("show");
  }

  // ---------- section awareness ----------
  let lastSpokenAt = 0;
  state.on("section", (e) => {
    const msg = CONFIG.sectionMessages[e.detail.id];
    if (!msg) return;
    const now = performance.now();
    if (now - lastSpokenAt < 4000) return;
    lastSpokenAt = now;
    say(msg);
  });

  // ---------- synthesized sound ----------
  let audioCtx = null;
  const ensureAudio = () => {
    if (audioCtx) return audioCtx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
    return audioCtx;
  };
  const armAudioOnGesture = () => {
    const resume = () => {
      const ac = ensureAudio();
      if (ac && ac.state === "suspended") ac.resume();
      window.removeEventListener("pointerdown", resume);
      window.removeEventListener("keydown", resume);
    };
    window.addEventListener("pointerdown", resume, { once: true });
    window.addEventListener("keydown", resume, { once: true });
  };
  armAudioOnGesture();

  function tone(freqStart, freqEnd, duration, type = "sine", delay = 0) {
    if (state.muted) return;
    const ac = ensureAudio();
    if (!ac || ac.state === "suspended") return;
    const t0 = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t0 + duration);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(CONFIG.sound.masterGain, t0 + duration * 0.25);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  const sound = {
    hello: () => (tone(520, 780, 0.16, "sine"), tone(780, 980, 0.14, "sine", 0.15)),
    beep: () => tone(880, 880, 0.09, "square"),
    boop: () => tone(280, 220, 0.12, "sine"),
    happy: () => (tone(660, 880, 0.1, "triangle"), tone(880, 1100, 0.12, "triangle", 0.1)),
    thinking: () => tone(340, 300, 0.35, "sine"),
  };

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

  return { say, hide, sound, confetti };
}
