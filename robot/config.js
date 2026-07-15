// iTech Cambodia — AI Robot Mascot — central configuration
// Single source of truth for the mascot's asset paths, sizing, positions,
// hit-zones, timing and feature flags.
//
// SWITCHING TO A REAL 3D MODEL LATER: change `model.type` from "png" to
// "glb" and point `model.glbUrl` at the exported file. robot.js reads only
// this one value to decide which renderer to build — nothing else in the
// codebase needs to change. (The "glb" renderer is a documented extension
// point, not yet implemented — see the comment on createRenderer() in
// robot.js for what a future renderer module must provide.)

export const CONFIG = {
  model: {
    type: "png", // "png" (today) | "glb" (future — see robot.js)
    // /assets/ is served with a 1-year immutable Cache-Control header (see
    // vercel.json). If robot.png is ever replaced in place (same filename —
    // e.g. swapping in a cleaner transparent export), bump pngVersion so
    // browsers actually fetch the new file instead of serving the old one
    // for up to a year.
    pngUrl: "assets/robot.png",
    pngVersion: 1,
    glbUrl: "assets/robot.glb",
  },

  // Mirrored in robot/css/robot.css media queries — keep both in sync.
  size: {
    desktop: 140, // px
    tablet: 110, // px, <= tabletBreakpoint
    mobile: 90, // px, <= mobileBreakpoint
    tabletBreakpoint: 1024,
    mobileBreakpoint: 600,
  },

  position: {
    right: 30,
    bottom: 25,
  },

  // Percentage-based hit-zones over the flat PNG (top/left/width/height, all
  // % of the image box). Tuned for the official mascot's proportions — retune
  // here if a future image revision shifts the pose; nothing else references
  // raw coordinates.
  hitZones: {
    head: { top: 2, left: 30, width: 40, height: 34 },
    eyes: { top: 14, left: 38, width: 24, height: 10 },
    body: { top: 36, left: 40, width: 20, height: 24 },
    armL: { top: 38, left: 22, width: 20, height: 26 },
    armR: { top: 38, left: 58, width: 20, height: 26 },
    tablet: { top: 42, left: 52, width: 22, height: 26 },
    legL: { top: 68, left: 36, width: 12, height: 24 },
    legR: { top: 68, left: 48, width: 12, height: 24 },
  },

  // Eye overlay positions (% of image box) — drives blink eyelids and the
  // small cursor-tracking glow dots layered on top of the source art.
  eyeOverlay: {
    left: { top: 16, left: 38, size: 8 },
    right: { top: 16, left: 54, size: 8 },
  },
  mouthOverlay: { top: 25, left: 42, width: 16, height: 4 },

  camera: {
    // Max rotation applied to the whole mascot toward the cursor — simulates
    // head/body turn on a flat image. Never the "spin the whole robot" kind
    // of rotation; kept small and eased.
    maxTiltDeg: 10,
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

  randomEvents: ["wave", "smile", "checkTablet", "lookAround", "stretch", "dance", "repairServer", "showShield", "launchHologram"],

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
