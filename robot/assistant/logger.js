// iTech Cambodia — AI website assistant — minimal client logger
// Silent by default (matches the site's zero-console-noise standard).
// Flip on via: localStorage.setItem('itech-assistant-debug','1')

import { isDebugEnabled } from "./assistant-config.js";

function emit(level, args) {
  if (!isDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console[level]?.("[assistant]", ...args);
}

export const logger = {
  debug: (...args) => emit("debug", args),
  info: (...args) => emit("info", args),
  warn: (...args) => emit("warn", args),
  error: (...args) => emit("error", args),
};
