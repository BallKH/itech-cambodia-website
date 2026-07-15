// iTech Cambodia — AI Robot Mascot — entry point & orchestrator
// Renders the official mascot (assets/robot.png) as a fixed, floating,
// interactive DOM element and wires robot-animation.js / robot-audio.js /
// robot-speech.js / robot-state.js together. Exposes a small public API +
// plugin system so a future LLM integration can hook in without touching
// this file.
//
// SWITCHING TO A REAL 3D MODEL LATER: set CONFIG.model.type = "glb" in
// config.js. createRenderer() below is the one place that reads that value;
// a future GLB renderer just needs to build the same `parts` shape that
// buildPngRenderer() returns (floater/tilter wrappers, eyelidL/R, eyeGlowL/R,
// mouthGlow, hologram, zones) so robot-animation.js and the interaction
// wiring in this file keep working completely unchanged.

import { CONFIG } from "./config.js";
import { state } from "./robot-state.js";
import { on } from "./robot-events.js";
import { audio } from "./robot-audio.js";
import { createAnimator } from "./robot-animation.js";
import { createSpeech } from "./robot-speech.js";

function injectStylesheet() {
  const href = new URL("./css/robot.css", import.meta.url).href;
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

function zoneStyle(z) {
  return `top:${z.top}%;left:${z.left}%;width:${z.width}%;height:${z.height}%;`;
}

/**
 * Builds the PNG-based renderer: a plain DOM/CSS mascot. Returns the same
 * `parts` shape any future renderer (e.g. a GLB one) must also return.
 */
function buildPngRenderer(container) {
  const floater = document.createElement("div");
  floater.className = "itech-robot-floater";
  container.appendChild(floater);

  const tilter = document.createElement("div");
  tilter.className = "itech-robot-tilter";
  floater.appendChild(tilter);

  const img = document.createElement("img");
  img.className = "itech-robot-img";
  img.src = `${CONFIG.model.pngUrl}?v=${CONFIG.model.pngVersion}`;
  img.alt = "iTech Cambodia AI mascot";
  img.draggable = false;
  tilter.appendChild(img);

  const eyelidL = document.createElement("div");
  eyelidL.className = "itech-robot-eyelid";
  Object.assign(eyelidL.style, eyeStyle(CONFIG.eyeOverlay.left));
  tilter.appendChild(eyelidL);

  const eyelidR = document.createElement("div");
  eyelidR.className = "itech-robot-eyelid";
  Object.assign(eyelidR.style, eyeStyle(CONFIG.eyeOverlay.right));
  tilter.appendChild(eyelidR);

  const eyeGlowL = document.createElement("div");
  eyeGlowL.className = "itech-robot-eyeglow";
  Object.assign(eyeGlowL.style, eyeGlowStyle(CONFIG.eyeOverlay.left));
  tilter.appendChild(eyeGlowL);

  const eyeGlowR = document.createElement("div");
  eyeGlowR.className = "itech-robot-eyeglow";
  Object.assign(eyeGlowR.style, eyeGlowStyle(CONFIG.eyeOverlay.right));
  tilter.appendChild(eyeGlowR);

  const mouthGlow = document.createElement("div");
  mouthGlow.className = "itech-robot-mouthglow";
  const m = CONFIG.mouthOverlay;
  Object.assign(mouthGlow.style, { top: `${m.top}%`, left: `${m.left}%`, width: `${m.width}%`, height: `${m.height}%` });
  tilter.appendChild(mouthGlow);

  const zones = {};
  for (const [part, z] of Object.entries(CONFIG.hitZones)) {
    const el = document.createElement("div");
    el.className = "itech-robot-zone";
    el.dataset.part = part;
    el.style.cssText = zoneStyle(z);
    tilter.appendChild(el);
    zones[part] = el;
  }

  const hologram = document.createElement("div");
  hologram.className = "itech-robot-hologram";
  const t = CONFIG.hitZones.tablet;
  hologram.style.left = `${t.left + t.width / 2}%`;
  hologram.style.top = `${t.top}%`;
  tilter.appendChild(hologram);

  return { floater, tilter, eyelidL, eyelidR, eyeGlowL, eyeGlowR, mouthGlow, hologram, zones };
}

function eyeStyle(e) {
  const s = e.size;
  return { top: `${e.top}%`, left: `${e.left}%`, width: `${s}%`, height: `${s}%` };
}
function eyeGlowStyle(e) {
  const s = e.size * 0.4;
  return { top: `${e.top + e.size * 0.3}%`, left: `${e.left + e.size * 0.3}%`, width: `${s}%`, height: `${s}%` };
}

/** The one place CONFIG.model.type is read — see file header. */
function createRenderer(container) {
  if (CONFIG.model.type === "glb") {
    console.warn(
      "[iTech Robot] model.type is \"glb\" but no GLB renderer is implemented yet — falling back to the PNG mascot. " +
        "A future renderer module just needs to return the same `parts` shape as buildPngRenderer()."
    );
  }
  return buildPngRenderer(container);
}

function buildDOM() {
  injectStylesheet();
  const container = document.createElement("div");
  container.id = "itech-robot";
  container.className = "itech-robot";
  container.setAttribute("tabindex", "0");
  container.setAttribute("role", "img");
  container.setAttribute("aria-label", CONFIG.a11y.label);
  document.body.appendChild(container);
  return container;
}

function readGreeted() {
  try {
    return sessionStorage.getItem(CONFIG.session.greetedKey) === "1";
  } catch {
    return false;
  }
}
function writeGreeted() {
  try {
    sessionStorage.setItem(CONFIG.session.greetedKey, "1");
  } catch {
    /* private-mode storage may throw — non-fatal, just re-greets next load */
  }
}

function boot() {
  const container = buildDOM();
  const { floater, tilter, eyelidL, eyelidR, eyeGlowL, eyeGlowR, mouthGlow, hologram, zones } = createRenderer(container);
  const animator = createAnimator({ floater, tilter, eyelidL, eyelidR, eyeGlowL, eyeGlowR, mouthGlow, hologram });
  const speaker = createSpeech(container);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) window.gsap?.globalTimeline.pause();
    else window.gsap?.globalTimeline.resume();
  });

  animator.start();

  // ---------- per-body-part reactions ----------
  function reactToPart(part) {
    if (animator.isBusy()) return;
    switch (part) {
      case "head":
        return animator.nod();
      case "eyes":
        return animator.faceReaction();
      case "body":
        return animator.bounceLaugh();
      case "armL":
        return animator.wave();
      case "armR":
        return animator.thumbsUp();
      case "legL":
      case "legR":
        return animator.legReaction();
      case "tablet": {
        const topic = CONFIG.hologramTopics[Math.floor(Math.random() * CONFIG.hologramTopics.length)];
        animator.showHologram(topic);
        audio.thinking();
        speaker.say(`Showing ${topic} overview`, 2200);
        return;
      }
      default:
        return;
    }
  }

  let lastClickAt = 0;
  container.addEventListener("click", (e) => {
    const zoneEl = e.target.closest?.(".itech-robot-zone");
    const now = performance.now();
    const isDoubleClick = now - lastClickAt < CONFIG.timing.doubleClickWindowMs;
    lastClickAt = now;

    if (isDoubleClick) {
      animator.celebrate(() => spawnConfetti(container));
      speaker.say("Yay! 🎉", 2200);
      return;
    }
    if (!zoneEl) return;
    const count = state.registerClick();
    reactToPart(zoneEl.dataset.part);
    if (count === CONFIG.easterEggs.clickCount) {
      setTimeout(() => {
        animator.dance();
        speaker.say("Whee! You found my dance! 🕺", 2600);
      }, 500);
    }
  });

  // ---------- keyboard accessibility ----------
  container.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!animator.isBusy()) {
        animator.greetWave();
        speaker.say(CONFIG.greetings[Math.floor(Math.random() * CONFIG.greetings.length)]);
      }
    } else if (e.key === "Escape") {
      speaker.hide();
    }
  });

  // ---------- cursor follow (max CONFIG.camera.maxTiltDeg) ----------
  let cursorRaf = null;
  window.addEventListener(
    "pointermove",
    (e) => {
      if (cursorRaf) return;
      cursorRaf = requestAnimationFrame(() => {
        cursorRaf = null;
        const rect = container.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const dist = Math.hypot(dx, dy);
        const approachRadius = 420;
        if (dist < approachRadius && !animator.isBusy()) {
          state.setCursor(dx, dy, true);
          animator.lookAt(Math.max(-1, Math.min(1, dx / approachRadius)), Math.max(-1, Math.min(1, dy / approachRadius)));
        } else if (state.cursor.active) {
          state.setCursor(0, 0, false);
          if (!animator.isBusy()) animator.returnToRest(0.8);
        }
      });
    },
    { passive: true }
  );

  // ---------- scroll: look up/down ----------
  let lastScrollY = window.scrollY;
  let scrollEndTimer = null;
  window.addEventListener(
    "scroll",
    () => {
      const y = window.scrollY;
      const dir = y > lastScrollY ? 1 : -1;
      lastScrollY = y;
      if (!animator.isBusy() && !state.cursor.active) animator.lookAt(0, dir * 0.35);
      clearTimeout(scrollEndTimer);
      scrollEndTimer = setTimeout(() => {
        if (!animator.isBusy() && !state.cursor.active) animator.returnToRest(0.7);
      }, 180);
    },
    { passive: true }
  );

  // ---------- CTA hover-point / click-celebrate ----------
  let lastPointCooldown = 0;
  document.addEventListener(
    "pointerover",
    (e) => {
      const cta = e.target.closest?.(CONFIG.ctaSelectors) || e.target.closest?.(CONFIG.hoverAwareness.selectors);
      if (!cta || animator.isBusy()) return;
      const now = performance.now();
      if (now - lastPointCooldown < 1200) return;
      lastPointCooldown = now;
      const rect = container.getBoundingClientRect();
      const robotCx = rect.left + rect.width / 2;
      const targetRect = cta.getBoundingClientRect();
      animator.pointTo(targetRect.left + targetRect.width / 2 < robotCx ? -1 : 1);
    },
    { passive: true }
  );

  // Form submit buttons are excluded: a click doesn't mean success. The
  // contact form instead calls window.iTechRobot.celebrate() on a real
  // confirmed send — see js/main.js.
  document.addEventListener(
    "click",
    (e) => {
      const cta = e.target.closest?.(CONFIG.ctaSelectors);
      if (!cta || cta.matches('button[type="submit"]') || animator.isBusy()) return;
      animator.celebrate(() => spawnConfetti(container));
      audio.happy();
    },
    { passive: true }
  );

  // ---------- section awareness ----------
  const sections = document.querySelectorAll("section[id], [data-robot-section]");
  if (sections.length && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((en) => en.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) {
          const id = visible.target.dataset.robotSection || visible.target.id;
          if (CONFIG.sectionMessages[id]) state.setSection(id);
        }
      },
      { threshold: [0.4, 0.6] }
    );
    sections.forEach((s) => io.observe(s));
  }

  // ---------- greeting: once per visitor session ----------
  if (!readGreeted()) {
    setTimeout(() => {
      animator.greetWave();
      speaker.say(CONFIG.greetings[Math.floor(Math.random() * CONFIG.greetings.length)]);
      writeGreeted();
    }, CONFIG.timing.greetingDelayMs);
  }

  // ---------- public API + plugin system for future LLM/AI-employee integration ----------
  const plugins = new Map();
  window.iTechRobot = {
    speak: (text, ms) => speaker.say(text, ms),
    hideSpeech: () => speaker.hide(),
    mute: (v) => state.setMuted(v !== undefined ? v : !state.muted),
    isMuted: () => state.muted,
    wave: () => animator.wave(),
    nod: () => animator.nod(),
    celebrate: () => (animator.celebrate(() => spawnConfetti(container)), audio.happy()),
    showHologram: (topic, ms) => animator.showHologram(topic, ms),
    navigateTo: (url) => {
      window.location.href = url;
    },
    registerPlugin(name, plugin) {
      plugins.set(name, plugin);
      if (typeof plugin.onInit === "function") plugin.onInit({ animator, speaker, state });
      return () => plugins.delete(name);
    },
    getPlugin: (name) => plugins.get(name),
    destroy() {
      animator.stop();
      container.remove();
      delete window.iTechRobot;
    },
  };

  container.dispatchEvent(new CustomEvent("itech-robot:ready", { bubbles: true }));
}

// ---------- confetti (double-click / CTA-click celebration) ----------
function spawnConfetti(container) {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const canvas = document.createElement("canvas");
  canvas.className = "itech-robot-confetti";
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  document.body.appendChild(canvas);
  const c2d = canvas.getContext("2d");
  const rect = container.getBoundingClientRect();
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

function scheduleBoot() {
  const start = () => setTimeout(boot, CONFIG.performance.idleInitDelayMs);
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
}

scheduleBoot();
