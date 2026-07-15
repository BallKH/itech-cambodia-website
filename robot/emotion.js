// iTech Cambodia — AI Robot Mascot — emotion state machine
// A thin coordination layer above animation.js's low-level primitives.
// Named emotions (happy, thinking, excited, surprised, working, listening,
// sleeping, waiting) drive eye/mouth behavior consistently everywhere they're
// triggered from (clicks, random events, section-awareness, idle-sleep).

import { state } from "./state.js";

const TRANSIENT_MS = {
  happy: 1600,
  excited: 1800,
  surprised: 1400,
};

export function createEmotion(animator) {
  let revertTimer = null;
  let thinkingActive = false;
  let listeningActive = false;

  function clearRevert() {
    clearTimeout(revertTimer);
    revertTimer = null;
  }

  function leave(name) {
    if (name === "thinking" && thinkingActive) {
      animator.setThinking(false);
      thinkingActive = false;
    }
    if (name === "listening" && listeningActive) {
      animator.setListening(false);
      listeningActive = false;
    }
    if (name === "sleeping") animator.wakePose();
  }

  function enter(name) {
    switch (name) {
      case "happy":
        animator.setExpression("smile");
        break;
      case "excited":
        animator.setExpression("laugh");
        break;
      case "surprised":
        animator.setExpression("surprised");
        break;
      case "thinking":
        animator.setExpression("neutral");
        animator.setThinking(true);
        thinkingActive = true;
        break;
      case "listening":
        animator.setExpression("neutral");
        animator.setListening(true);
        listeningActive = true;
        break;
      case "working":
        animator.setExpression("neutral");
        break;
      case "sleeping":
        animator.sleepPose();
        break;
      case "waiting":
      default:
        animator.setExpression("neutral");
        break;
    }
  }

  /**
   * Set the robot's current emotion. Transient emotions (happy/excited/
   * surprised) auto-revert to "waiting" unless `stickyMs` is given; states
   * that represent an ongoing activity (thinking/working/listening/sleeping)
   * persist until something else changes them.
   */
  function set(name, opts = {}) {
    if (name === state.emotion && name !== "sleeping") return;
    clearRevert();
    leave(state.emotion);
    state.setEmotion(name);
    enter(name);

    const autoRevertMs = opts.autoRevertMs ?? TRANSIENT_MS[name];
    if (autoRevertMs) {
      revertTimer = setTimeout(() => set("waiting"), autoRevertMs);
    }
  }

  function get() {
    return state.emotion;
  }

  return { set, get };
}
