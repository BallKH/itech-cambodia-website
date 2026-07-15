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

  // Mirrored in robot/css/robot.css media queries — keep both in sync.
  size: {
    desktop: 140, // px, canvas square
    tablet: 110, // px, <= tabletBreakpoint
    mobile: 90, // px, <= mobileBreakpoint
    tabletBreakpoint: 1024,
    mobileBreakpoint: 600,
  },

  position: {
    right: 24,
    bottom: 90, // clears the site's .back-top button (46px + 24px + gap)
    rightTablet: 18,
    bottomTablet: 84,
    rightMobile: 14,
    bottomMobile: 76,
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
    headTiltMinMs: 6000,
    headTiltMaxMs: 14000,
    bodySwayPeriodMs: 5200,
    randomEventMinMs: 20000,
    randomEventMaxMs: 60000,
    greetingDelayMs: 900,
    speechAutoHideMs: 5000,
    longPressMs: 650,
    doubleClickWindowMs: 320,
    tenClickWindowMs: 5000,
    idleSleepMs: 50000, // no pointer/keyboard/scroll activity -> robot dozes off
    dwellThankYouMs: 60000, // cumulative time on site this session -> thank-you line
  },

  // Cursor / scroll head-follow is capped well below gesture rotation ranges
  // so it always reads as "glancing," never as the robot spinning its head off.
  cursorFollow: {
    maxAngleDeg: 15,
    approachRadiusPx: 420,
  },

  greetings: [
    "Hello 👋",
    "Welcome to iTech Cambodia",
    "Need help finding the right IT solution?",
  ],

  // Section-awareness: matched against data-robot-section attributes.
  sectionMessages: {
    hero: "Welcome to iTech Cambodia! 👋",
    about: "Let me introduce our company — certified engineers you can trust.",
    services: "We provide cloud, virtualization, and cybersecurity.",
    partners: "Thanks to our world-class technology partners.",
    customers: "Trusted across Cambodia's leading businesses.",
    projects: "Our implementation experience runs deep.",
    contact: "Let's build something together — I'd love to help.",
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
    "checkTablet",
    "drinkCoffee",
    "repairServer",
    "launchHologram",
    "showShield",
    "showCloudIcon",
    "showAiIcon",
    "dance",
    "thumbsUp",
    "lookAtVisitor",
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
    masterGain: 0.2, // ~20% — small, cute, never annoying
  },

  // SpeechSynthesis (TTS). Never speaks before the first user gesture unlocks
  // audio — see audio.js. Bubble text still shows immediately regardless.
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
    startKey: "itech-robot-session-start",
    thankedKey: "itech-robot-thanked",
  },

  a11y: {
    label: "iTech Cambodia AI assistant mascot. Press Enter to greet.",
  },
};

export const prefersReducedMotion = () =>
  window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
