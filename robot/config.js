// iTech Cambodia — AI Robot Mascot — central configuration
// Single source of truth for the mascot's rig, palette, sizing, timing and
// feature flags.
//
// SWITCHING TO A REAL .glb MODEL LATER: change `model.type` from "rig" to
// "glb" and point `model.glbUrl` at the exported file. robot.js reads only
// this one value to decide which renderer to build. A real .glb is loaded
// through robot/vendor/GLTFLoader.js and its bones are matched *by name*
// against BONE_NAMES below — export your rig from Blender/Mixamo/etc. with
// bones named exactly as listed there (a Blender "Rigify"-style human rig
// renamed to these names works fine) and every gesture in
// robot-animation.js keeps working completely unchanged, because it only
// ever touches `rig.bones.<name>`, never raw geometry.

// The canonical bone/part names every renderer (procedural rig today, a
// loaded .glb tomorrow) must expose on `rig.bones`. robot-animation.js and
// the per-part click map in robot.js are written entirely in terms of this
// list — nothing else in the codebase names a bone directly.
export const BONE_NAMES = [
  "hip",
  "torso",
  "neck",
  "head",
  "eyeL",
  "eyeR",
  "eyelidL",
  "eyelidR",
  "mouth",
  "armL_upper",
  "armL_fore",
  "armL_hand",
  "fingersL",
  "armR_upper",
  "armR_fore",
  "armR_hand",
  "fingersR",
  "tablet",
  "legL_upper",
  "legL_lower",
  "footL",
  "legR_upper",
  "legR_lower",
  "footR",
];

// Bone -> clickable "part" a visitor can interact with. Several bones share
// one part (e.g. the whole left leg reacts as one zone) — see
// robot.js#reactToPart. Every raycast hit walks up parents until it finds an
// object whose userData.part is a key here.
export const PART_TO_BONES = {
  head: ["head", "neck"],
  eyes: ["eyeL", "eyeR", "eyelidL", "eyelidR"],
  mouth: ["mouth"],
  torso: ["torso"],
  hip: ["hip"],
  armL: ["armL_upper", "armL_fore", "armL_hand", "fingersL"],
  armR: ["armR_upper", "armR_fore", "armR_hand", "fingersR"],
  legL: ["legL_upper", "legL_lower", "footL"],
  legR: ["legR_upper", "legR_lower", "footR"],
  tablet: ["tablet"],
};

export const CONFIG = {
  model: {
    type: "rig", // "rig" (procedural Three.js geometry, today) | "glb" (future)
    glbUrl: "assets/robot.glb",
    // Reference-only: the flat mascot artwork the procedural rig's colors
    // and proportions were sampled from. Not rendered once the rig is live.
    referencePng: "assets/robot.png",
  },

  // Palette sampled directly from assets/robot.png's alpha-covered pixels
  // (white/light-grey shell, near-black visor, navy trim/tablet) so the 3D
  // rig reads as the same character, not a redesign. Retune here only if a
  // future art revision changes the source palette.
  palette: {
    shellLight: 0xf3f4f6,
    shellMid: 0xd7dae0,
    shellShadow: 0xaeb4bd,
    visorDark: 0x070f1c,
    trimNavy: 0x1c3350,
    trimNavyDark: 0x16283f,
    jointNavy: 0x24344a,
    eyeGlow: 0x8fe3ff,
    tabletScreen: 0x1c3350,
    tabletGlow: 0x8fe3ff,
  },

  // Mirrored in robot/css/robot.css media queries — keep both in sync.
  size: {
    desktop: 140, // px
    tablet: 110, // px, <= tabletBreakpoint
    mobile: 90, // px, <= mobileBreakpoint
    tabletBreakpoint: 1024,
    mobileBreakpoint: 600,
    maxPixelRatio: 2,
  },

  position: {
    right: 30,
    bottom: 25,
  },

  camera: {
    fovDeg: 32,
    // Whole-head/eye turn toward the cursor is capped here — never the
    // whole robot spinning to face the mouse, just a subtle "aware" turn.
    maxLookDeg: 15,
  },

  performance: {
    pauseWhenHidden: true,
    idleInitDelayMs: 300,
  },

  timing: {
    blinkMinMs: 2600,
    blinkMaxMs: 6500,
    lookAroundMinMs: 5000,
    lookAroundMaxMs: 10000,
    randomEventMinMs: 20000,
    randomEventMaxMs: 60000,
    greetingDelayMs: 900,
    speechAutoHideMs: 5000,
    doubleClickWindowMs: 320,
    hologramAutoHideMs: 2600,
  },

  greetings: [
    "Hello 👋",
    "Welcome to iTech Cambodia",
    "Need IT consultation?",
    "How may I help you?",
  ],

  sectionMessages: {
    hero: "Welcome to iTech Cambodia! 👋",
    about: "Let me introduce our company — certified engineers you can trust.",
    services: "We provide cloud, virtualization, and cybersecurity.",
    partners: "Thanks to our world-class technology partners.",
    customers: "Trusted across Cambodia's leading businesses.",
    contact: "Let's build something together — I'd love to help.",
  },

  // Full idle-behavior library — never the same one twice in a row.
  randomEvents: [
    "wave",
    "raiseHand",
    "smile",
    "tiltHead",
    "checkTablet",
    "lookAround",
    "stretch",
    "dance",
    "walk",
    "sitDown",
    "repairServer",
    "showShield",
    "launchHologram",
  ],

  hologramTopics: ["Cloud", "Cybersecurity", "VMware", "Networking", "AI", "SAP"],

  easterEggs: {
    clickCount: 10,
  },

  // Real MP3s — dropped in later at these paths. Missing files fail silently
  // (caught promise rejection) so the site never errors before they exist.
  sounds: {
    basePath: "assets/sounds/",
    hello: "hello.mp3",
    wave: "wave.mp3",
    happy: "happy.mp3",
    thinking: "thinking.mp3",
    click: "click.mp3",
    volume: 0.5,
    storageKey: "itech-robot-muted",
    enabledByDefault: true,
  },

  tts: {
    enabled: true,
    lang: "en-US",
    rate: 1.02,
    pitch: 1.08,
    volume: 0.85,
    voiceNameHints: ["Google US English", "Samantha", "Microsoft Aria", "Microsoft Jenny"],
  },

  hoverAwareness: {
    selectors: ".btn, .card, .pillar-card, .customer-card, .value-row, .svc-tab, .partner-logo",
  },
  ctaSelectors: ".btn-primary",

  session: {
    greetedKey: "itech-robot-greeted",
  },

  a11y: {
    label: "iTech Cambodia AI assistant mascot. Press Enter to greet.",
  },
};

export const prefersReducedMotion = () =>
  window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
