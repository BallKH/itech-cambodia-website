// iTech Cambodia — AI Robot Mascot — entry point & orchestrator
// Renders a real Three.js scene (see robot-rig.js) as a fixed, floating,
// interactive mascot and wires robot-animation.js / robot-audio.js /
// robot-speech.js / robot-state.js together. Exposes a small public API +
// plugin system so a future LLM integration can hook in without touching
// this file.
//
// SWITCHING TO A REAL .glb MODEL LATER: set CONFIG.model.type = "glb" in
// config.js and point CONFIG.model.glbUrl at the exported file.
// loadPreferredRig() below is the one place that reads that value — it
// tries loadGlbRig() first and falls back to the procedural rig (with a
// console warning) if the file is missing or doesn't contain every bone
// robot-animation.js expects, so a bad export can never take the mascot
// down. "static-glb" instead falls back to the flat-PNG mascot, then the
// procedural rig as a last resort — see loadPreferredRig() for the chain.

import { CONFIG } from "./config.js";
import { state } from "./robot-state.js";
import { audio } from "./robot-audio.js";
import { createAnimator } from "./robot-animation.js";
import { createSpeech } from "./robot-speech.js";
import { buildProceduralRig, loadGlbRig, loadStaticGlbRig, loadFlatPngRig } from "./robot-rig.js";
import * as THREE from "./vendor/three.module.min.js";
import { OrbitControls } from "./vendor/OrbitControls.js";

/** True on Data Saver / 2G — skip the ~10MB static-glb mascot for the lightweight PNG instead. */
function isDataSaverConnection() {
  const conn = navigator.connection || navigator.webkitConnection || navigator.mozConnection;
  if (!conn) return false;
  if (conn.saveData) return true;
  return typeof conn.effectiveType === "string" && /2g/.test(conn.effectiveType);
}

/** Frees geometries/materials/textures under `group` before it's discarded (e.g. on a rig swap). */
function disposeGroup(group) {
  group.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
    for (const m of mats) {
      if (m.map) m.map.dispose();
      m.dispose();
    }
  });
}

/**
 * Samples a small block at the canvas center and flags a near-uniform,
 * near-white render — the exact failure mode robot-static.glb has shown
 * before (a lit MeshStandardMaterial washing an unlit-baked texture out to
 * a flat white silhouette). A properly shaded model shows real luminance
 * contrast (visor, joints, trim) even through its lightest shell color, so
 * this only trips on a render that's actually broken, not just light-colored.
 */
function centerBlockLooksBlank(renderer) {
  try {
    const gl = renderer.getContext();
    const w = renderer.domElement.width;
    const h = renderer.domElement.height;
    const size = Math.max(8, Math.min(40, w, h));
    if (size < 8) return false;
    const x = Math.floor((w - size) / 2);
    const y = Math.floor((h - size) / 2);
    const pixels = new Uint8Array(size * size * 4);
    gl.readPixels(x, y, size, size, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let n = 0,
      sum = 0,
      sumSq = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] < 10) continue; // skip transparent background
      const lum = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
      n++;
      sum += lum;
      sumSq += lum * lum;
    }
    if (n < size) return false; // not enough model coverage in the sample to judge safely
    const mean = sum / n;
    const variance = sumSq / n - mean * mean;
    return mean > 248 && variance < 8;
  } catch {
    return false; // the safety check itself must never take the mascot down
  }
}

function injectStylesheet() {
  const href = new URL("./css/robot.css", import.meta.url).href;
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

async function loadPngFallback() {
  return loadFlatPngRig(THREE, `${CONFIG.model.spritePngUrl}?v=${CONFIG.model.spritePngVersion || 1}`);
}

/**
 * The one place CONFIG.model.type is read — see file header. Returns
 * { rig, source } so callers can tell whether the mascot actually came from
 * the requested .glb (relevant for the post-render blank-check below) or
 * already fell back to something else.
 */
async function loadPreferredRig() {
  if (CONFIG.model.type === "glb") {
    try {
      return { rig: await loadGlbRig(THREE, `${CONFIG.model.glbUrl}?v=${CONFIG.model.glbVersion || 1}`), source: "glb" };
    } catch (err) {
      console.warn(
        `[iTech Robot] Couldn't use robot.glb (${err.message}) — falling back to the procedural rig. ` +
          "A valid export just needs every bone named in config.js#BONE_NAMES present in the scene graph."
      );
    }
  } else if (CONFIG.model.type === "static-glb") {
    if (isDataSaverConnection()) {
      console.info(
        `[iTech Robot] Data-saver / slow connection detected — skipping the ${CONFIG.model.staticGlbUrl} download and using the PNG mascot instead.`
      );
    } else {
      try {
        return {
          rig: await loadStaticGlbRig(THREE, `${CONFIG.model.staticGlbUrl}?v=${CONFIG.model.staticGlbVersion || 1}`),
          source: "static-glb",
        };
      } catch (err) {
        console.warn(`[iTech Robot] Couldn't load ${CONFIG.model.staticGlbUrl} (${err.message}) — falling back to the PNG mascot.`);
      }
    }
    try {
      return { rig: await loadPngFallback(), source: "flat-png" };
    } catch (err) {
      console.warn(`[iTech Robot] PNG fallback also failed (${err.message}) — using the procedural rig.`);
    }
  } else if (CONFIG.model.type === "flat-png") {
    try {
      return { rig: await loadPngFallback(), source: "flat-png" };
    } catch (err) {
      console.warn(`[iTech Robot] Couldn't load ${CONFIG.model.spritePngUrl} (${err.message}) — falling back to the procedural rig.`);
    }
  }
  return { rig: buildProceduralRig(THREE), source: "rig" };
}

function buildDOM() {
  injectStylesheet();
  const container = document.createElement("div");
  container.id = "itech-robot";
  container.className = "itech-robot itech-robot--loading";
  container.setAttribute("tabindex", "0");
  container.setAttribute("role", "img");
  container.setAttribute("aria-label", CONFIG.a11y.label);
  document.body.appendChild(container);

  const canvasHost = document.createElement("div");
  canvasHost.className = "itech-robot-canvas-host";
  container.appendChild(canvasHost);

  const loading = document.createElement("div");
  loading.className = "itech-robot-loading";
  loading.setAttribute("aria-hidden", "true");
  canvasHost.appendChild(loading);

  const hologram = document.createElement("div");
  hologram.className = "itech-robot-hologram";
  container.appendChild(hologram);

  return { container, canvasHost, hologram };
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

async function boot() {
  const { container, canvasHost, hologram } = buildDOM();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CONFIG.camera.fovDeg, 1, 0.05, 20);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  canvasHost.appendChild(renderer.domElement);

  // Key + fill + a subtle rim/back light (from behind-above, cool cyan-white
  // tint) so the shell reads with more depth instead of flat front lighting.
  scene.add(new THREE.HemisphereLight(0xffffff, 0x2c3450, 1.15));
  const keyLight = new THREE.DirectionalLight(0xffffff, 0.85);
  keyLight.position.set(1.1, 1.6, 2.2);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xdbe9ff, 0.35);
  fillLight.position.set(-1.4, 0.5, 1.2);
  scene.add(fillLight);
  const rimLight = new THREE.DirectionalLight(0x8fe3ff, 0.4);
  rimLight.position.set(-0.6, 1.4, -1.8);
  scene.add(rimLight);

  const { rig: initialRig, source: initialSource } = await loadPreferredRig();

  // Two nested wrappers — see robot-animation.js header for why ambient
  // (floater) and reactive (tilter) motion must live on different objects.
  const floater = new THREE.Group();
  const tilter = new THREE.Group();
  floater.add(tilter);
  scene.add(floater);

  // Free-orbit drag-to-rotate + wheel-to-zoom directly on the mascot.
  // Panning is disabled — sliding the view sideways makes no sense for a
  // model that's always recentered at (0,0,0) in its own small canvas.
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.rotateSpeed = 0.9;
  controls.zoomSpeed = 0.8;
  let orbitActive = false;
  controls.addEventListener("start", () => {
    orbitActive = true;
    container.classList.add("itech-robot--dragging");
  });
  controls.addEventListener("end", () => {
    orbitActive = false;
    container.classList.remove("itech-robot--dragging");
  });

  // Mounts `nextRig` as the tilter's visible child and reframes the camera
  // + orbit distance limits around its own measured size (never hand-tuned
  // per pose). Kept tight so the mascot reads big inside its small canvas
  // instead of floating in empty space, while still leaving headroom for
  // jump/celebrate's vertical root motion and a raised arm. Also the one
  // place a live rig swap (e.g. the blank-render fallback below) happens.
  let rig = initialRig;
  function mountRig(nextRig) {
    for (const child of [...tilter.children]) {
      tilter.remove(child);
      disposeGroup(child);
    }
    tilter.add(nextRig.group);
    rig = nextRig;
    const span = Math.max(rig.boundingSize.x, rig.boundingSize.y) * 1.7;
    const dist = span / 2 / Math.tan((CONFIG.camera.fovDeg * Math.PI) / 360);
    camera.position.set(0, 0, dist);
    camera.lookAt(0, 0, 0);
    controls.target.set(0, 0, 0);
    controls.minDistance = dist * 0.55;
    controls.maxDistance = dist * 2.2;
    controls.update();
  }
  mountRig(initialRig);

  // Sized directly from CONFIG.size breakpoints rather than the canvas
  // host's measured layout box — the stylesheet is injected via a <link>
  // that loads asynchronously, so clientWidth/clientHeight can't be trusted
  // to be correct (or non-zero) the instant boot() runs.
  function currentSizePx() {
    const w = window.innerWidth;
    if (w <= CONFIG.size.mobileBreakpoint) return CONFIG.size.mobile;
    if (w <= CONFIG.size.tabletBreakpoint) return CONFIG.size.tablet;
    return CONFIG.size.desktop;
  }
  function resize() {
    const px = currentSizePx();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.size.maxPixelRatio));
    renderer.setSize(px, px, false);
    camera.aspect = 1;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener("resize", resize);

  // One synchronous test render before the loop starts (and before the
  // loading placeholder is hidden), so a broken static-glb material — this
  // exact model rendered flat white here once before, even after a
  // targeted material fix — gets caught and swapped for the PNG mascot
  // before the visitor ever sees it, instead of shipping a silently broken
  // render again.
  controls.update();
  renderer.render(scene, camera);
  if (initialSource === "static-glb" && centerBlockLooksBlank(renderer)) {
    console.warn(
      "[iTech Robot] robot-static.glb rendered as a near-blank/washed-out fill (the same failure mode seen before) — swapping to the PNG mascot."
    );
    try {
      mountRig(await loadPngFallback());
    } catch (err) {
      console.warn(`[iTech Robot] PNG fallback failed too (${err.message}) — keeping the static-glb render.`);
    }
    controls.update();
    renderer.render(scene, camera);
  }
  container.classList.remove("itech-robot--loading");

  let hologramTimer = null;
  function showHologram(topic, ms = CONFIG.timing.hologramAutoHideMs) {
    hologram.textContent = topic;
    hologram.classList.add("show");
    clearTimeout(hologramTimer);
    if (ms > 0) hologramTimer = setTimeout(hideHologram, ms);
  }
  function hideHologram() {
    clearTimeout(hologramTimer);
    hologram.classList.remove("show");
  }

  const animator = createAnimator(rig, { floater, tilter });
  animator.setHologramHandlers(showHologram, hideHologram);
  const speaker = createSpeech(container);

  let running = true;
  let rafId = null;
  function renderLoop() {
    if (running) {
      controls.update();
      renderer.render(scene, camera);
    }
    rafId = requestAnimationFrame(renderLoop);
  }
  renderLoop();

  document.addEventListener("visibilitychange", () => {
    running = !document.hidden || !CONFIG.performance.pauseWhenHidden;
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
      case "mouth":
        return animator.smilePulse(1.2);
      case "torso":
        return animator.bounceLaugh();
      case "hip":
        return animator.tiltHead();
      case "armL":
        return animator.wave();
      case "armR":
        return animator.thumbsUp();
      case "legL":
        return animator.legReaction("L");
      case "legR":
        return animator.legReaction("R");
      case "tablet": {
        const topic = CONFIG.hologramTopics[Math.floor(Math.random() * CONFIG.hologramTopics.length)];
        animator.useTablet(topic);
        speaker.say(`Showing ${topic} overview`, 2200);
        return;
      }
      default:
        return;
    }
  }

  // ---------- raycasting: which bone/part is under the pointer ----------
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function partAtEvent(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    ndc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObject(scene, true);
    for (const hit of hits) {
      if (hit.object?.userData?.part) return hit.object.userData.part;
    }
    return null;
  }

  // OrbitControls shares this same element for drag-to-rotate, so a click
  // reaction only fires on pointerup, and only if the pointer barely moved
  // — otherwise it was an orbit drag, not a click.
  let lastClickAt = 0;
  let pointerDownAt = null;
  const CLICK_DRAG_THRESHOLD_PX = 6;
  renderer.domElement.addEventListener("pointerdown", (e) => {
    pointerDownAt = { x: e.clientX, y: e.clientY };
  });
  renderer.domElement.addEventListener("pointerup", (e) => {
    const start = pointerDownAt;
    pointerDownAt = null;
    if (!start || Math.hypot(e.clientX - start.x, e.clientY - start.y) > CLICK_DRAG_THRESHOLD_PX) return;

    const part = partAtEvent(e);
    const now = performance.now();
    const isDoubleClick = now - lastClickAt < CONFIG.timing.doubleClickWindowMs;
    lastClickAt = now;

    if (isDoubleClick) {
      animator.celebrate(() => spawnConfetti(container));
      speaker.say("Yay! 🎉", 2200);
      return;
    }
    if (!part) return;
    const count = state.registerClick();
    reactToPart(part);
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

  // ---------- cursor follow: head + eyes turn toward the mouse, capped at
  // CONFIG.camera.maxLookDeg (never the whole robot spinning) ----------
  let cursorRaf = null;
  window.addEventListener(
    "pointermove",
    (e) => {
      if (orbitActive || cursorRaf) return;
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
      if (orbitActive) return;
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
    clap: () => animator.clap(),
    thumbsUp: () => animator.thumbsUp(),
    raiseHand: (side) => animator.raiseHand(side),
    tiltHead: () => animator.tiltHead(),
    dance: () => animator.dance(),
    jump: () => animator.jump(),
    walk: () => animator.walk(),
    sitDown: () => animator.sitDown(),
    useTablet: (topic) => animator.useTablet(topic || CONFIG.hologramTopics[0]),
    celebrate: () => (animator.celebrate(() => spawnConfetti(container)), audio.happy()),
    showHologram: (topic, ms) => showHologram(topic, ms),
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
      running = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      controls.dispose();
      renderer.dispose();
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
  const start = () =>
    setTimeout(() => {
      boot().catch((err) => console.error("[iTech Robot] failed to start:", err));
    }, CONFIG.performance.idleInitDelayMs);
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
}

scheduleBoot();
