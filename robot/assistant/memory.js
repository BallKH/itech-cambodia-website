// iTech Cambodia — AI website assistant — per-visitor session memory
// sessionStorage (not localStorage) so history persists across page
// navigations within the same tab/session — matching the same storage
// choice already used for the mascot's "greeted once per session" flag —
// but clears when the tab closes, never becoming a long-term profile.

import { ASSISTANT_CONFIG } from "./assistant-config.js";
import { logger } from "./logger.js";

const { storageKey, maxTurns, maxChars } = ASSISTANT_CONFIG.memory;

function read() {
  try {
    const raw = sessionStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    logger.warn("memory read failed", err);
    return [];
  }
}

function write(turns) {
  try {
    sessionStorage.setItem(storageKey, JSON.stringify(turns));
  } catch (err) {
    logger.warn("memory write failed (private mode / quota?)", err);
  }
}

function trim(turns) {
  let trimmed = turns.slice(-maxTurns);
  let size = JSON.stringify(trimmed).length;
  while (size > maxChars && trimmed.length > 2) {
    trimmed = trimmed.slice(1);
    size = JSON.stringify(trimmed).length;
  }
  return trimmed;
}

export function getHistory() {
  return read();
}

export function pushTurn(role, content) {
  if (!content) return;
  const turns = trim([...read(), { role, content }]);
  write(turns);
}

export function clearHistory() {
  try {
    sessionStorage.removeItem(storageKey);
  } catch {
    /* non-fatal */
  }
}
