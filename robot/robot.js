// iTech Cambodia — AI Robot Mascot — entry point & orchestrator
// Builds the DOM widget, the Three.js scene, and (by default) a procedural
// robot mesh. Wires animation.js / interaction.js / speech.js together and
// exposes a small public API + plugin system so a future LLM integration
// (chat, navigation, quoting) can hook in without touching this file.
//
// To swap in a real, artist-made model later: export a .glb whose node
// names match the contract read by extractPartsFromGLTF() below, point
// CONFIG.model.url at it, and everything else (animation, interaction,
// speech, section-awareness) keeps working unchanged.

import * as THREE from "./vendor/three.module.min.js";
import { CONFIG } from "./config.js";
import { state } from "./state.js";
import { createAnimator } from "./animation.js";
import { createInteraction } from "./interaction.js";
import { createSpeech } from "./speech.js";

function makeShadowTexture() {
  const size = 64;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(0,0,0,0.35)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

function buildHolograms() {
  const mat = (c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.8, wireframe: true });
  const solidMat = (c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.55 });
  const accent = CONFIG.colors.accentGlow;

  const cloud = new THREE.Group();
  [[-0.06, 0, 0.02], [0.06, 0, 0.02], [0, 0.03, 0.04]].forEach(([x, y, extra]) => {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.07 + extra, 10, 10), solidMat(accent));
    puff.position.set(x, y, 0);
    cloud.add(puff);
  });

  const security = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.16, 4), mat(accent));
  security.rotation.x = Math.PI;

  const ai = new THREE.Group();
  const aiCore = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), solidMat(accent));
  const aiRing = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.006, 8, 24), mat(accent));
  aiRing.rotation.x = Math.PI / 2.4;
  ai.add(aiCore, aiRing);

  const server = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 0.1), solidMat(accent));
    slab.position.y = i * 0.045 - 0.045;
    server.add(slab);
  }

  const network = new THREE.Group();
  const nodePositions = [
    [0, 0.08, 0],
    [0.09, -0.05, 0],
    [-0.09, -0.05, 0],
  ];
  nodePositions.forEach((p) => {
    const node = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), solidMat(accent));
    node.position.set(...p);
    network.add(node);
  });
  const lineMat = new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.7 });
  for (let i = 0; i < nodePositions.length; i++) {
    for (let j = i + 1; j < nodePositions.length; j++) {
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(...nodePositions[i]),
        new THREE.Vector3(...nodePositions[j]),
      ]);
      network.add(new THREE.Line(geo, lineMat));
    }
  }

  const holo = { cloud, security, ai, server, network };
  for (const h of Object.values(holo)) h.visible = false;
  return holo;
}

function buildRobot() {
  const parts = {};
  const hitMeshes = [];
  const invisible = () => new THREE.MeshBasicMaterial({ visible: false });

  const matPrimary = () => new THREE.MeshStandardMaterial({ color: CONFIG.colors.primary, roughness: 0.5, metalness: 0.08 });
  const matSecondary = () => new THREE.MeshStandardMaterial({ color: CONFIG.colors.secondary, roughness: 0.55, metalness: 0.2 });
  const matAccent = (intensity = 1) =>
    new THREE.MeshStandardMaterial({ color: CONFIG.colors.accent, emissive: CONFIG.colors.accent, emissiveIntensity: intensity, roughness: 0.35, metalness: 0.1 });

  const group = new THREE.Group(); // drag target / home-position anchor
  const root = new THREE.Group(); // idle-animation target (breathing/floating/gestures)
  group.add(root);

  // ---- contact shadow ----
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: makeShadowTexture(), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -1.05;
  root.add(shadow);

  // ---- body ----
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.46, 0.5, 6, 14), matPrimary());
  root.add(body);

  const chestBack = new THREE.Mesh(new THREE.CircleGeometry(0.2, 20), matSecondary());
  chestBack.position.set(0, 0.05, 0.46);
  root.add(chestBack);

  const core = new THREE.Mesh(new THREE.CircleGeometry(0.09, 20), matAccent(1.2));
  core.position.set(0, 0.05, 0.468);
  root.add(core);

  const bodyHit = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8), invisible());
  bodyHit.position.y = -0.05;
  bodyHit.userData.part = "body";
  root.add(bodyHit);
  hitMeshes.push(bodyHit);

  // ---- head ----
  const head = new THREE.Group();
  head.position.set(0, 0.86, 0);
  root.add(head);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 18), matPrimary());
  skull.scale.set(1, 0.94, 0.98);
  head.add(skull);

  const visor = new THREE.Mesh(new THREE.CircleGeometry(0.28, 24), matSecondary());
  visor.position.set(0, -0.02, 0.385);
  head.add(visor);

  const eyeGeo = new THREE.BoxGeometry(0.085, 0.05, 0.02);
  const eyeMat = () => new THREE.MeshStandardMaterial({ color: CONFIG.colors.eye, emissive: CONFIG.colors.eye, emissiveIntensity: 1, roughness: 0.2 });
  const eyeL = new THREE.Mesh(eyeGeo, eyeMat());
  eyeL.position.set(-0.1, -0.01, 0.4);
  head.add(eyeL);
  const eyeR = new THREE.Mesh(eyeGeo, eyeMat());
  eyeR.position.set(0.1, -0.01, 0.4);
  head.add(eyeR);

  const mouths = {};
  mouths.neutral = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.02), matAccent(0.8));
  mouths.smile = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.014, 8, 16, Math.PI), matAccent(0.8));
  mouths.smile.rotation.z = Math.PI;
  mouths.surprised = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.05, 16), matAccent(0.8));
  mouths.laugh = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.03, 8, 16, Math.PI), matAccent(0.9));
  mouths.laugh.rotation.z = Math.PI;
  for (const m of Object.values(mouths)) {
    m.position.set(0, -0.13, 0.4);
    m.visible = false;
    head.add(m);
  }
  mouths.neutral.visible = true;

  const antennaStick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.22, 8), matSecondary());
  antennaStick.position.set(0, 0.42, 0);
  head.add(antennaStick);
  const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 12), matAccent(1.4));
  antennaTip.position.set(0, 0.54, 0);
  head.add(antennaTip);

  const headHit = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 8), invisible());
  headHit.position.set(0, 0.14, -0.05);
  headHit.userData.part = "head";
  head.add(headHit);
  hitMeshes.push(headHit);

  const faceHit = new THREE.Mesh(new THREE.CircleGeometry(0.3, 12), invisible());
  faceHit.position.set(0, -0.03, 0.39);
  faceHit.userData.part = "face";
  head.add(faceHit);
  hitMeshes.push(faceHit);

  // ---- arms ----
  function buildArm(sign) {
    const shoulder = new THREE.Group();
    shoulder.position.set(sign * 0.5, 0.2, 0);
    root.add(shoulder);

    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.28, 4, 8), matPrimary());
    upper.position.set(sign * 0.05, -0.18, 0);
    upper.rotation.z = sign * 0.15;
    shoulder.add(upper);

    const hand = new THREE.Group();
    hand.position.set(sign * 0.09, -0.42, 0);
    shoulder.add(hand);
    const palm = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), matSecondary());
    hand.add(palm);

    const armHit = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.4, 4, 8), invisible());
    armHit.position.set(sign * 0.05, -0.25, 0);
    armHit.userData.part = sign < 0 ? "armL" : "armR";
    shoulder.add(armHit);
    hitMeshes.push(armHit);

    return { shoulder, hand };
  }
  const armLParts = buildArm(-1);
  const armRParts = buildArm(1);

  // ---- tablet (held by right hand) ----
  const tabletGroup = new THREE.Group();
  tabletGroup.position.set(0.02, -0.02, 0.1);
  armRParts.hand.add(tabletGroup);
  const tabletFrame = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.018), matSecondary());
  tabletGroup.add(tabletFrame);
  const tabletScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.24), matAccent(0.9));
  tabletScreen.position.z = 0.011;
  tabletGroup.add(tabletScreen);
  const tabletHit = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.38, 0.1), invisible());
  tabletHit.userData.part = "tablet";
  tabletGroup.add(tabletHit);
  hitMeshes.push(tabletHit);

  // ---- legs ----
  function buildLeg(sign) {
    const hip = new THREE.Group();
    hip.position.set(sign * 0.2, -0.52, 0);
    root.add(hip);
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.32, 10), matSecondary());
    shin.position.y = -0.16;
    hip.add(shin);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.22), matPrimary());
    foot.position.set(0, -0.33, 0.04);
    hip.add(foot);
    const legHit = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.32, 4, 8), invisible());
    legHit.position.y = -0.2;
    legHit.userData.part = sign < 0 ? "legL" : "legR";
    hip.add(legHit);
    hitMeshes.push(legHit);
    return hip;
  }
  const legL = buildLeg(-1);
  const legR = buildLeg(1);

  // ---- handheld props (coffee / wrench / shield) on left hand ----
  const propAnchor = new THREE.Group();
  armLParts.hand.add(propAnchor);
  const props = {};

  const coffee = new THREE.Group();
  coffee.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.09, 10), matSecondary()));
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.025, 0.008, 6, 10), matSecondary());
  handle.position.x = 0.06;
  handle.rotation.y = Math.PI / 2;
  coffee.add(handle);
  props.coffee = coffee;

  props.wrench = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.02), matSecondary());

  const shield = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.14, 4), matAccent(1));
  shield.rotation.x = Math.PI;
  props.shield = shield;

  for (const p of [coffee, props.wrench, shield]) {
    p.visible = false;
    p.position.set(0, -0.06, 0.02);
    propAnchor.add(p);
  }

  const drone = new THREE.Group();
  drone.add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), matPrimary()));
  for (const [dx, dz] of [
    [0.07, 0.07],
    [-0.07, 0.07],
    [0.07, -0.07],
    [-0.07, -0.07],
  ]) {
    const propBlade = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.006, 8), matAccent(0.6));
    propBlade.position.set(dx, 0.02, dz);
    drone.add(propBlade);
  }
  drone.visible = false;
  root.add(drone);
  props.drone = drone;

  // ---- hologram anchor (above tablet) ----
  const hologramAnchor = new THREE.Group();
  hologramAnchor.position.set(0, 1.5, 0);
  hologramAnchor.visible = false;
  root.add(hologramAnchor);
  const holograms = buildHolograms();
  for (const h of Object.values(holograms)) hologramAnchor.add(h);

  // ---- cape (superhero easter egg) ----
  const cape = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.6, 4, 6),
    new THREE.MeshStandardMaterial({ color: 0xf36a1f, side: THREE.DoubleSide, roughness: 0.6, transparent: true, opacity: 0.92 })
  );
  cape.position.set(0, 0.1, -0.32);
  cape.scale.y = 0;
  cape.visible = false;
  root.add(cape);

  Object.assign(parts, {
    group, root, body, head, skull,
    eyeL, eyeR, eyeScale: { x: 1 }, mouths, core, antennaTip,
    armL: armLParts.shoulder, armR: armRParts.shoulder, handR: armRParts.hand, handL: armLParts.hand,
    legL, legR, propAnchor, props, hologramAnchor, holograms, cape,
  });

  return { group, parts, hitMeshes };
}

// Future-proofing stub: a real .glb should name its nodes to match this
// contract. Anything missing falls back to a console warning + procedural
// build so the widget never breaks while an asset is in progress.
async function loadFromGLTF(url) {
  const { GLTFLoader } = await import("./vendor/GLTFLoader.js");
  const loader = new GLTFLoader();
  if (CONFIG.model.dracoDecoderPath) {
    const { DRACOLoader } = await import("./vendor/DRACOLoader.js").catch(() => ({ DRACOLoader: null }));
    if (DRACOLoader) {
      const draco = new DRACOLoader();
      draco.setDecoderPath(CONFIG.model.dracoDecoderPath);
      loader.setDRACOLoader(draco);
    }
  }
  const gltf = await new Promise((resolve, reject) => loader.load(url, resolve, undefined, reject));
  const scene = gltf.scene;
  const required = ["group", "body", "head", "armL", "armR", "legL", "legR", "eyeL", "eyeR", "core", "antennaTip", "handR", "handL", "propAnchor", "hologramAnchor", "cape"];
  const parts = {};
  const missing = [];
  for (const key of required) {
    const found = scene.getObjectByName(key);
    if (found) parts[key] = found;
    else missing.push(key);
  }
  if (missing.length) {
    console.warn(`[iTech Robot] GLB "${url}" is missing named nodes: ${missing.join(", ")}. Falling back to procedural robot.`);
    return null;
  }
  parts.root = parts.group;
  parts.eyeScale = { x: 1 };
  parts.mouths = {};
  ["neutral", "smile", "surprised", "laugh"].forEach((n) => {
    const m = scene.getObjectByName(`mouth_${n}`);
    if (m) parts.mouths[n] = m;
  });
  parts.props = {};
  ["coffee", "wrench", "shield", "drone"].forEach((n) => {
    const p = scene.getObjectByName(`prop_${n}`);
    if (p) parts.props[n] = p;
  });
  parts.holograms = {};
  CONFIG.hologramTopics.forEach((n) => {
    const h = scene.getObjectByName(`holo_${n}`);
    if (h) parts.holograms[n] = h;
  });
  const hitMeshes = [];
  scene.traverse((obj) => {
    if (obj.userData && obj.userData.part) hitMeshes.push(obj);
  });
  return { group: scene, parts, hitMeshes };
}

function injectStylesheet() {
  const href = new URL("./css/robot.css", import.meta.url).href;
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
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

  const canvas = document.createElement("canvas");
  canvas.className = "itech-robot-canvas";
  container.appendChild(canvas);

  return { container, canvas };
}

async function boot() {
  const { container, canvas } = buildDOM();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(CONFIG.camera.fov, 1, CONFIG.camera.near, CONFIG.camera.far);
  camera.position.set(0, 0.15, CONFIG.camera.z);
  camera.lookAt(0, 0.05, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.65));
  const key = new THREE.DirectionalLight(0xffffff, 0.85);
  key.position.set(1.2, 2, 2.5);
  scene.add(key);
  const rim = new THREE.PointLight(CONFIG.colors.accent, 0.7, 4);
  rim.position.set(-0.6, 0.6, 1.4);
  scene.add(rim);

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.performance.maxPixelRatio));

  let built = CONFIG.model.url ? await loadFromGLTF(CONFIG.model.url).catch((err) => (console.warn("[iTech Robot] GLB load failed, using procedural robot.", err), null)) : null;
  if (!built) built = buildRobot();
  const { group, parts, hitMeshes } = built;
  scene.add(group);

  const ctx = { scene, camera, renderer, canvas, container, parts, hitMeshes };

  const animator = createAnimator(ctx);
  const speaker = createSpeech(ctx);
  const interactionCtl = createInteraction(ctx, animator, speaker);

  function resize() {
    const rect = container.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  if ("ResizeObserver" in window) {
    new ResizeObserver(resize).observe(container);
  } else {
    window.addEventListener("resize", resize);
  }
  resize();

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) window.gsap?.globalTimeline.pause();
    else window.gsap?.globalTimeline.resume();
  });

  function tick() {
    requestAnimationFrame(tick);
    if (document.hidden) return;
    if (parts.hologramAnchor.visible) parts.hologramAnchor.rotation.y += 0.014;
    if (parts.props.drone.visible) {
      parts.props.drone.children.slice(1).forEach((blade) => (blade.rotation.y += 0.9));
    }
    renderer.render(scene, camera);
  }
  requestAnimationFrame(tick);

  animator.start();

  setTimeout(() => {
    animator.greetWave();
    speaker.say(CONFIG.greetings[Math.floor(Math.random() * CONFIG.greetings.length)]);
    speaker.sound.hello();
  }, CONFIG.timing.greetingDelayMs);

  // ---------- public API + plugin system for future LLM/AI-employee integration ----------
  const plugins = new Map();
  window.iTechRobot = {
    speak: (text, ms) => speaker.say(text, ms),
    hideSpeech: () => speaker.hide(),
    mute: (v) => state.setMuted(v !== undefined ? v : !state.muted),
    isMuted: () => state.muted,
    setMood: (name) => animator.setExpression(name),
    wave: () => animator.wave(),
    nod: () => animator.nod(),
    celebrate: () => (animator.celebrate(() => speaker.confetti()), speaker.sound.happy()),
    showHologram: (topic, ms) => animator.showHologram(topic, ms),
    navigateTo: (url) => {
      window.location.href = url;
    },
    registerPlugin(name, plugin) {
      plugins.set(name, plugin);
      if (typeof plugin.onInit === "function") {
        plugin.onInit({ animator, speaker, state, ctx });
      }
      return () => plugins.delete(name);
    },
    getPlugin: (name) => plugins.get(name),
    destroy() {
      interactionCtl.destroy();
      animator.stop();
      renderer.dispose();
      container.remove();
      delete window.iTechRobot;
    },
  };

  container.dispatchEvent(new CustomEvent("itech-robot:ready", { bubbles: true }));
}

function scheduleBoot() {
  const start = () => setTimeout(boot, CONFIG.performance.idleInitDelayMs);
  if (document.readyState === "complete") start();
  else window.addEventListener("load", start, { once: true });
}

scheduleBoot();
