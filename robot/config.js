// iTech Cambodia — AI Robot Mascot — central configuration
// Single source of truth for colors, sizing, timing and feature flags.
// Swap `model.url` to a real .glb later — robot.js will load it via GLTFLoader
// instead of building the procedural mesh, with zero changes anywhere else.

export const CONFIG = {
  model: {
    // Set to a path (e.g. "robot/assets/robot.glb") to switch to a real GLB.
    // Loader is imported lazily so leaving this null costs nothing on load.
    url: null,
    dracoDecoderPath: null,
  },

  colors: {
    primary: 0xf5f7fa, // white shell
    secondary: 0x3a3f4b, // dark gray joints/visor
    accent: 0x3ec6ff, // blue LED
    accentGlow: 0x8fe3ff,
    eye: 0x4fe0ff,
    eyeCore: 0xffffff,
    shadow: 0x0e1f3d, // brand navy, used for contact shadow tint
  },

  size: {
    desktop: 150, // px, canvas square (within 120-180 spec range)
    mobile: 100, // px (within 80-120 spec range)
    mobileBreakpoint: 720,
  },

  position: {
    right: 24,
    bottom: 90, // clears the site's .back-top button (46px + 24px + gap)
    rightMobile: 14,
    bottomMobile: 78,
  },

  camera: {
    fov: 32,
    near: 0.1,
    far: 20,
    z: 6,
  },

  performance: {
    maxPixelRatio: 2,
    pauseWhenHidden: true,
    idleInitDelayMs: 400, // defer heavy init until after first paint
  },

  timing: {
    blinkMinMs: 2600,
    blinkMaxMs: 6500,
    headTurnMinMs: 4000,
    headTurnMaxMs: 9000,
    randomEventMinMs: 30000,
    randomEventMaxMs: 90000,
    greetingDelayMs: 900,
    speechAutoHideMs: 4200,
    longPressMs: 650,
    doubleClickWindowMs: 320,
    tenClickWindowMs: 5000,
  },

  greetings: [
    "Hello 👋",
    "Welcome to iTech Cambodia",
    "Need IT consultation?",
    "How may I help you?",
  ],

  // Section-awareness: element id -> spoken line. Matched against
  // <section id="..."> ancestors and data-robot-section attributes.
  sectionMessages: {
    hero: "Welcome to iTech Cambodia! 👋",
    about: "Our certified engineers design and manage secure IT.",
    services: "We provide cloud, virtualization, and cybersecurity.",
    partners: "We work with world-class technology partners.",
    customers: "Trusted across Cambodia's leading businesses.",
    projects: "Our implementation experience runs deep.",
    contact: "Let's build something together.",
  },

  workingActions: [
    "reading",
    "typing",
    "touchingTablet",
    "analyzing",
    "lookingAtHologram",
    "checkingServer",
    "watchingCloud",
  ],

  randomEvents: [
    "wave",
    "stretch",
    "smile",
    "drinkCoffee",
    "holdWrench",
    "showShield",
    "launchHologram",
    "repairServer",
    "flyDrone",
    "scanPage",
  ],

  hologramTopics: ["cloud", "security", "ai", "server", "network"],

  easterEggs: {
    clickCount: 10,
    konamiSequence: [
      "ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown",
      "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight",
      "b", "a",
    ],
    bothArmsWindowMs: 400,
  },

  sound: {
    enabledByDefault: true,
    storageKey: "itech-robot-muted",
    masterGain: 0.06,
  },

  hoverAwareness: {
    selectors: ".btn, .card, .pillar-card, .customer-card, .value-row, .svc-tab, .partner-logo",
  },

  a11y: {
    label: "iTech Cambodia AI assistant mascot. Press Enter to greet.",
  },
};

export const prefersReducedMotion = () =>
  window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
