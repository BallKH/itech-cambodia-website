// iTech Cambodia — AI Robot Mascot — shared event bus
// One EventTarget every module can publish/subscribe through, so robot.js,
// robot-animation.js, robot-audio.js, robot-speech.js and robot-state.js
// never need to import each other directly to react to what's happening.

const bus = new EventTarget();

/** Subscribe. Returns an unsubscribe function. */
export function on(type, handler) {
  bus.addEventListener(type, handler);
  return () => bus.removeEventListener(type, handler);
}

export function off(type, handler) {
  bus.removeEventListener(type, handler);
}

/** Publish `type` with an optional detail payload. */
export function emit(type, detail = {}) {
  bus.dispatchEvent(new CustomEvent(type, { detail }));
}

export { bus };
