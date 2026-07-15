// iTech Cambodia — AI Robot Mascot — animation library
// Simulates life on a single flat PNG using GSAP-driven CSS transforms plus
// a handful of small overlay elements (eyelids, eye-glow dots, mouth glow)
// layered on top of the art for blink/smile/cursor-tracking effects that a
// static image can't otherwise show.
//
// Two nested wrappers avoid a subtle GSAP trap: if the same logical property
// (e.g. "y") is driven by both an infinite idle loop and a one-off reaction
// with overwrite:"auto", GSAP kills the *infinite* tween the first time they
// collide — permanently. So ambient motion (float bob, breathing) lives on
// the outer "floater" and everything reactive (cursor tilt, bounce, jump,
// dance, celebrate-spin) lives on the inner "tilter". Different elements,
// same property names, zero conflict.

import { CONFIG, prefersReducedMotion } from "./config.js";
import { state } from "./robot-state.js";
import { audio } from "./robot-audio.js";

const gsap = window.gsap;
const rand = (min, max) => min + Math.random() * (max - min);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function createAnimator(parts) {
  const { floater, tilter, eyelidL, eyelidR, eyeGlowL, eyeGlowR, mouthGlow, hologram } = parts;
  const idleTimers = [];
  let busy = false;
  let hologramTimer = null;

  function withBusy(fn) {
    busy = true;
    const done = () => (busy = false);
    fn(done);
  }

  // ---------- micro-expressions (overlay elements) ----------
  function blinkOnce() {
    if (eyelidL.dataset.blinking) return;
    eyelidL.dataset.blinking = "1";
    gsap
      .timeline({ onComplete: () => delete eyelidL.dataset.blinking })
      .to([eyelidL, eyelidR], { scaleY: 1, duration: 0.06, ease: "sine.in", transformOrigin: "top" })
      .to([eyelidL, eyelidR], { scaleY: 0, duration: 0.12, ease: "sine.out", transformOrigin: "top" });
  }

  function eyesClose(holdSeconds = 0.6) {
    gsap.to([eyelidL, eyelidR], { scaleY: 1, duration: 0.18, ease: "sine.out", transformOrigin: "top" });
    gsap.delayedCall(holdSeconds, () =>
      gsap.to([eyelidL, eyelidR], { scaleY: 0, duration: 0.25, ease: "sine.inOut", transformOrigin: "top" })
    );
  }

  function smilePulse(holdSeconds = 0.9) {
    gsap
      .timeline()
      .to(mouthGlow, { opacity: 1, scale: 1.2, duration: 0.22, ease: "back.out(3)" })
      .to(mouthGlow, { opacity: 0.7, scale: 1, duration: holdSeconds, ease: "sine.inOut" });
  }

  function shieldFlash() {
    gsap
      .timeline()
      .to(tilter, { filter: "brightness(1.35) drop-shadow(0 0 18px rgba(62,198,255,.85))", duration: 0.25, ease: "sine.out" })
      .to(tilter, { filter: "brightness(1) drop-shadow(0 0 0 rgba(62,198,255,0))", duration: 0.6, ease: "sine.inOut" });
  }

  // ---------- cursor / scroll look (max CONFIG.camera.maxTiltDeg) ----------
  const maxTilt = CONFIG.camera.maxTiltDeg;
  function lookAt(nx, ny) {
    if (busy) return;
    gsap.to(tilter, { rotation: nx * maxTilt, y: ny * 5, duration: 0.55, ease: "power2.out", overwrite: "auto", id: "look" });
    gsap.to([eyeGlowL, eyeGlowR], { x: nx * 3, y: ny * 2.2, duration: 0.55, ease: "power2.out", overwrite: "auto" });
  }
  function returnToRest(duration = 0.6) {
    gsap.to(tilter, { rotation: 0, y: 0, duration, ease: "sine.inOut", overwrite: "auto", id: "look" });
    gsap.to([eyeGlowL, eyeGlowR], { x: 0, y: 0, duration, ease: "sine.inOut" });
  }

  // ---------- ambient idle (outer "floater" — never touched by gestures) ----------
  function floatBob() {
    gsap.to(floater, { y: "+=10", duration: 2.6, ease: "sine.inOut", yoyo: true, repeat: -1 });
  }
  function breathing() {
    gsap.to(floater, { scale: 1.035, duration: 1.9, ease: "sine.inOut", yoyo: true, repeat: -1 });
  }

  function scheduleBlink() {
    const t = setTimeout(() => {
      if (!busy) blinkOnce();
      scheduleBlink();
    }, rand(CONFIG.timing.blinkMinMs, CONFIG.timing.blinkMaxMs));
    idleTimers.push(t);
  }

  function scheduleLookAround() {
    const t = setTimeout(() => {
      if (!busy && !state.cursor.active) {
        lookAt(rand(-0.7, 0.7), rand(-0.4, 0.4));
        setTimeout(() => !busy && !state.cursor.active && returnToRest(1), 1100);
      }
      scheduleLookAround();
    }, rand(CONFIG.timing.lookAroundMinMs, CONFIG.timing.lookAroundMaxMs));
    idleTimers.push(t);
  }

  // ---------- gesture library ----------
  function nod() {
    withBusy((done) => {
      audio.click();
      smilePulse();
      gsap
        .timeline({ onComplete: done })
        .to(tilter, { y: 8, duration: 0.16, ease: "sine.out" })
        .to(tilter, { y: -3, duration: 0.14, ease: "sine.inOut" })
        .to(tilter, { y: 0, duration: 0.18, ease: "sine.inOut" });
      blinkOnce();
    });
  }

  function faceReaction() {
    withBusy((done) => {
      audio.click();
      const kind = pick(["wink", "happy", "surprised"]);
      if (kind === "wink") {
        const eye = Math.random() < 0.5 ? eyelidL : eyelidR;
        gsap
          .timeline({ onComplete: done })
          .to(eye, { scaleY: 1, duration: 0.09, ease: "sine.in", transformOrigin: "top" })
          .to({}, { duration: 0.22 })
          .to(eye, { scaleY: 0, duration: 0.14, ease: "back.out(3)", transformOrigin: "top" });
      } else if (kind === "surprised") {
        gsap
          .timeline({ onComplete: done })
          .to([eyeGlowL, eyeGlowR], { scale: 1.5, duration: 0.15, ease: "back.out(3)" })
          .to({}, { duration: 0.7 })
          .to([eyeGlowL, eyeGlowR], { scale: 1, duration: 0.3, ease: "sine.inOut" });
      } else {
        smilePulse(1);
        gsap.delayedCall(1, done);
      }
    });
  }

  function wave() {
    withBusy((done) => {
      audio.wave();
      smilePulse(1.1);
      gsap
        .timeline({ onComplete: done })
        .to(tilter, { rotation: -6, duration: 0.16, ease: "sine.inOut" })
        .to(tilter, { rotation: 5, duration: 0.16, ease: "sine.inOut", repeat: 3, yoyo: true })
        .to(tilter, { rotation: 0, duration: 0.2, ease: "sine.inOut" });
    });
  }

  function thumbsUp() {
    withBusy((done) => {
      audio.click();
      smilePulse(1);
      gsap
        .timeline({ onComplete: done })
        .to(tilter, { scale: 1.08, duration: 0.2, ease: "back.out(2.5)" })
        .to({}, { duration: 0.6 })
        .to(tilter, { scale: 1, duration: 0.3, ease: "sine.inOut" });
    });
  }

  function bounceLaugh() {
    withBusy((done) => {
      audio.happy();
      smilePulse(1.2);
      eyesClose(0.5);
      gsap
        .timeline({ onComplete: done })
        .to(tilter, { scaleY: 0.88, scaleX: 1.08, duration: 0.12, ease: "sine.in" })
        .to(tilter, { scaleY: 1.08, scaleX: 0.96, duration: 0.14, ease: "sine.out" })
        .to(tilter, { scaleY: 1, scaleX: 1, duration: 0.22, ease: "elastic.out(1, 0.4)" });
    });
  }

  function legReaction() {
    const kind = pick(["jump", "kick", "dance"]);
    withBusy((done) => {
      audio.click();
      if (kind === "jump") {
        gsap
          .timeline({ onComplete: done })
          .to(tilter, { scaleY: 0.9, duration: 0.1, ease: "sine.in" })
          .to(tilter, { y: -22, scaleY: 1.05, duration: 0.22, ease: "power2.out" }, ">")
          .to(tilter, { y: 0, scaleY: 1, duration: 0.28, ease: "bounce.out" });
      } else if (kind === "kick") {
        gsap
          .timeline({ onComplete: done })
          .to(tilter, { rotation: -8, duration: 0.14, ease: "back.out(3)" })
          .to(tilter, { rotation: 0, duration: 0.22, ease: "sine.inOut" });
      } else {
        danceTimeline(done);
      }
    });
  }

  function danceTimeline(onDone) {
    const tl = gsap.timeline({ onComplete: onDone });
    for (let i = 0; i < 3; i++) {
      tl.to(tilter, { rotation: 8, y: -6, duration: 0.18, ease: "sine.inOut" }).to(tilter, {
        rotation: -8,
        y: -6,
        duration: 0.18,
        ease: "sine.inOut",
      });
    }
    tl.to(tilter, { rotation: 0, y: 0, duration: 0.25, ease: "sine.inOut" });
    return tl;
  }

  function dance() {
    // Can be triggered (10-click easter egg) a beat after another gesture
    // already claimed `tilter` — clear it first so the two don't fight over
    // the same transform properties instead of one cleanly taking over.
    gsap.killTweensOf(tilter);
    withBusy((done) => {
      audio.happy();
      smilePulse(1.4);
      danceTimeline(done);
    });
  }

  function stretch() {
    withBusy((done) => {
      gsap
        .timeline({ onComplete: done })
        .to(tilter, { scaleY: 1.12, duration: 0.5, ease: "sine.out" })
        .to({}, { duration: 0.4 })
        .to(tilter, { scaleY: 1, duration: 0.5, ease: "sine.inOut" });
    });
  }

  function repairServer() {
    withBusy((done) => {
      smilePulse(1);
      gsap
        .timeline({ onComplete: done })
        .to(tilter, { rotation: -4, duration: 0.13, ease: "sine.inOut", repeat: 5, yoyo: true })
        .to(tilter, { rotation: 0, duration: 0.15 });
    });
  }

  function celebrate(onConfetti) {
    // Double-click celebration can land mid-gesture (the first click of the
    // pair already triggered its own zone reaction) — clear any in-flight
    // tweens on `tilter` first so celebrate() cleanly takes over instead of
    // fighting the interrupted gesture for the same properties.
    gsap.killTweensOf(tilter);
    withBusy((done) => {
      audio.happy();
      smilePulse(1.6);
      gsap
        .timeline({ onComplete: done })
        .to(tilter, { y: -18, duration: 0.22, ease: "power2.out" })
        .to(tilter, { rotation: "+=360", duration: 0.55, ease: "power1.inOut" }, "<")
        .to(tilter, { y: 0, duration: 0.3, ease: "bounce.out" })
        .call(() => onConfetti && onConfetti());
    });
  }

  function pointTo(dirX = 1) {
    withBusy((done) => {
      gsap
        .timeline({ onComplete: done })
        .to(tilter, { rotation: dirX * 7, x: dirX * 6, duration: 0.32, ease: "back.out(2)" })
        .to({}, { duration: 1 })
        .to(tilter, { rotation: 0, x: 0, duration: 0.4, ease: "sine.inOut" });
    });
  }

  function showHologram(topic, autoHideMs = CONFIG.timing.hologramAutoHideMs) {
    hologram.textContent = topic;
    hologram.classList.add("show");
    clearTimeout(hologramTimer);
    hologramTimer = setTimeout(() => hologram.classList.remove("show"), autoHideMs);
  }
  function hideHologram() {
    clearTimeout(hologramTimer);
    hologram.classList.remove("show");
  }

  // ---------- random ambient events (never the same one twice in a row) ----------
  let lastEvent = null;
  function runRandomEvent() {
    let evt = pick(CONFIG.randomEvents);
    if (CONFIG.randomEvents.length > 1) {
      while (evt === lastEvent) evt = pick(CONFIG.randomEvents);
    }
    lastEvent = evt;
    switch (evt) {
      case "wave":
        return wave();
      case "smile":
        return smilePulse(1.4);
      case "checkTablet":
        return showHologram(pick(CONFIG.hologramTopics));
      case "lookAround":
        lookAt(rand(-0.8, 0.8), rand(-0.4, 0.4));
        return setTimeout(() => !busy && returnToRest(1), 1200);
      case "stretch":
        return stretch();
      case "dance":
        return dance();
      case "repairServer":
        return repairServer();
      case "showShield":
        return shieldFlash();
      case "launchHologram":
        return showHologram(pick(CONFIG.hologramTopics));
      default:
        return null;
    }
  }
  function scheduleRandomEvent() {
    const t = setTimeout(() => {
      if (!busy) runRandomEvent();
      scheduleRandomEvent();
    }, rand(CONFIG.timing.randomEventMinMs, CONFIG.timing.randomEventMaxMs));
    idleTimers.push(t);
  }

  function greetWave() {
    withBusy((done) => {
      audio.hello();
      smilePulse(1.2);
      gsap
        .timeline({ onComplete: done })
        .to(tilter, { rotation: -7, duration: 0.2, ease: "back.out(2)" })
        .to(tilter, { rotation: 6, duration: 0.2, ease: "sine.inOut", repeat: 4, yoyo: true })
        .to(tilter, { rotation: 0, duration: 0.3, ease: "sine.inOut" });
    });
  }

  function start() {
    if (prefersReducedMotion()) {
      scheduleBlink();
      return { reduced: true };
    }
    floatBob();
    breathing();
    scheduleBlink();
    scheduleLookAround();
    scheduleRandomEvent();
    return { reduced: false };
  }

  function stop() {
    idleTimers.forEach(clearTimeout);
  }

  return {
    start, stop,
    blinkOnce, lookAt, returnToRest, smilePulse, eyesClose,
    nod, faceReaction, wave, thumbsUp, bounceLaugh, legReaction, dance, stretch,
    repairServer, shieldFlash, celebrate, pointTo, greetWave,
    showHologram, hideHologram,
    isBusy: () => busy,
  };
}
