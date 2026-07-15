// iTech Cambodia — AI Robot Mascot — 3D gesture & idle library
// Drives the rig built by robot-rig.js (either the procedural primitive
// skeleton or, later, a loaded .glb) purely through `rig.bones.<name>` —
// this file never touches raw geometry, so it works unmodified against
// either renderer.
//
// Two nested Object3D wrappers around the whole rig avoid a subtle GSAP
// trap carried over from the previous CSS build: an infinite idle tween and
// a one-off reactive tween sharing the same property on the *same* object,
// combined with overwrite:"auto", makes GSAP permanently kill the infinite
// one the first time they collide. So ambient motion (float bob, breathing)
// lives on the outer "floater" and everything reactive (cursor look, jump,
// dance, celebrate, walk) lives on the inner "tilter" — different objects,
// same property names, zero conflict.

import { CONFIG, prefersReducedMotion } from "./config.js";
import { state } from "./robot-state.js";
import { audio } from "./robot-audio.js";

const gsap = window.gsap;
const rand = (min, max) => min + Math.random() * (max - min);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const DEG = Math.PI / 180;

export function createAnimator(rig, wrappers) {
  const { bones, materials } = rig;
  const { floater, tilter } = wrappers;
  const idleTimers = [];
  let busy = false;
  let hologramShow = null; // set by robot.js: (topic, ms) => void
  let hologramHide = null;

  function withBusy(fn) {
    busy = true;
    const done = () => (busy = false);
    fn(done);
  }

  function setHologramHandlers(show, hide) {
    hologramShow = show;
    hologramHide = hide;
  }

  // ---------- micro-expressions ----------
  function blinkOnce() {
    const { eyelidL, eyelidR } = bones;
    if (eyelidL.userData.blinking) return;
    eyelidL.userData.blinking = true;
    gsap
      .timeline({ onComplete: () => (eyelidL.userData.blinking = false) })
      .to([eyelidL.scale, eyelidR.scale], { y: 1, duration: 0.06, ease: "sine.in" })
      .to([eyelidL.scale, eyelidR.scale], { y: 0.05, duration: 0.12, ease: "sine.out" });
  }

  function eyesClose(holdSeconds = 0.6) {
    const { eyelidL, eyelidR } = bones;
    gsap.to([eyelidL.scale, eyelidR.scale], { y: 1, duration: 0.18, ease: "sine.out" });
    gsap.delayedCall(holdSeconds, () => gsap.to([eyelidL.scale, eyelidR.scale], { y: 0.05, duration: 0.25, ease: "sine.inOut" }));
  }

  function smilePulse(holdSeconds = 0.9) {
    gsap
      .timeline()
      .to(bones.mouth.scale, { x: 1.35, y: 1.15, duration: 0.2, ease: "back.out(3)" })
      .to(bones.mouth.scale, { x: 1, y: 1, duration: holdSeconds, ease: "sine.inOut" });
  }

  function shieldFlash() {
    if (!materials) return; // no-op on a future GLB rig without matching material refs
    const { shell, shellShadow } = materials;
    gsap
      .timeline()
      .to([shell, shellShadow], { emissiveIntensity: 0.9, duration: 0.25, ease: "sine.out" })
      .to([shell, shellShadow], { emissiveIntensity: 0, duration: 0.65, ease: "sine.inOut" });
  }

  // ---------- cursor / scroll look — head + neck turn only, never the
  // whole robot, capped at CONFIG.camera.maxLookDeg ----------
  const maxLook = CONFIG.camera.maxLookDeg * DEG;
  function lookAt(nx, ny) {
    if (busy) return;
    const yaw = Math.max(-1, Math.min(1, nx)) * maxLook;
    const pitch = Math.max(-1, Math.min(1, ny)) * maxLook * 0.6;
    gsap.to(bones.head.rotation, { y: yaw, x: pitch, duration: 0.55, ease: "power2.out", overwrite: "auto" });
    gsap.to(bones.neck.rotation, { y: yaw * 0.35, duration: 0.55, ease: "power2.out", overwrite: "auto" });
    gsap.to(bones.eyeL.rotation, { y: yaw * 0.5, duration: 0.4, ease: "power2.out", overwrite: "auto" });
    gsap.to(bones.eyeR.rotation, { y: yaw * 0.5, duration: 0.4, ease: "power2.out", overwrite: "auto" });
  }
  function returnToRest(duration = 0.6) {
    gsap.to(bones.head.rotation, { x: 0, y: 0, z: 0, duration, ease: "sine.inOut", overwrite: "auto" });
    gsap.to(bones.neck.rotation, { x: 0, y: 0, z: 0, duration, ease: "sine.inOut", overwrite: "auto" });
    gsap.to([bones.eyeL.rotation, bones.eyeR.rotation], { y: 0, duration, ease: "sine.inOut", overwrite: "auto" });
  }

  function tiltHead() {
    withBusy((done) => {
      audio.click();
      const dir = Math.random() < 0.5 ? -1 : 1;
      gsap
        .timeline({ onComplete: done })
        .to(bones.head.rotation, { z: dir * 16 * DEG, duration: 0.4, ease: "back.out(2)" })
        .to({}, { duration: 0.7 })
        .to(bones.head.rotation, { z: 0, duration: 0.45, ease: "sine.inOut" });
      smilePulse(1);
    });
  }

  // ---------- ambient idle (outer "floater" — never touched by gestures) ----------
  function floatBob() {
    gsap.to(floater.position, { y: "+=0.05", duration: 2.6, ease: "sine.inOut", yoyo: true, repeat: -1 });
  }
  function breathing() {
    gsap.to(bones.torso.scale, { y: 1.045, x: 1.02, z: 1.02, duration: 1.9, ease: "sine.inOut", yoyo: true, repeat: -1 });
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

  // ---------- arm gestures ----------
  function armGesture(side, { upperX = 0, upperZ = 0, foreX = 0, handZ = 0 }, duration = 0.35, ease = "back.out(2)") {
    const upper = bones[`arm${side}_upper`];
    const fore = bones[`arm${side}_fore`];
    const hand = bones[`arm${side}_hand`];
    return gsap.timeline().to(upper.rotation, { x: upperX, z: upperZ, duration, ease }, 0).to(fore.rotation, { x: foreX, duration, ease }, 0).to(hand.rotation, { z: handZ, duration, ease }, 0);
  }
  function armRest(side, duration = 0.4) {
    return armGesture(side, {}, duration, "sine.inOut");
  }

  function wave() {
    withBusy((done) => {
      audio.wave();
      smilePulse(1.1);
      const tl = gsap.timeline({ onComplete: done });
      tl.add(armGesture("R", { upperZ: 82 * DEG, foreX: -35 * DEG }, 0.28));
      tl.to(
        bones.armR_hand.rotation,
        { z: "+=" + 22 * DEG, duration: 0.16, ease: "sine.inOut", yoyo: true, repeat: 5 },
        ">"
      );
      tl.add(armRest("R", 0.3));
    });
  }

  function raiseHand(side = "R") {
    withBusy((done) => {
      audio.click();
      const tl = gsap.timeline({ onComplete: done });
      tl.add(armGesture(side, { upperX: -150 * DEG, foreX: -10 * DEG }, 0.4));
      tl.to({}, { duration: 0.9 });
      tl.add(armRest(side, 0.4));
    });
  }

  function pointTo(dirX = 1) {
    withBusy((done) => {
      const side = dirX < 0 ? "L" : "R";
      const tl = gsap.timeline({ onComplete: done });
      tl.add(armGesture(side, { upperX: -95 * DEG, upperZ: dirX * 20 * DEG, foreX: -8 * DEG }, 0.32, "back.out(2.4)"));
      tl.to({}, { duration: 1 });
      tl.add(armRest(side, 0.4));
    });
  }

  function thumbsUp() {
    withBusy((done) => {
      audio.click();
      smilePulse(1);
      const tl = gsap.timeline({ onComplete: done });
      tl.add(armGesture("R", { upperX: -70 * DEG, foreX: -95 * DEG, handZ: 90 * DEG }, 0.3, "back.out(2.4)"));
      tl.to({}, { duration: 0.8 });
      tl.add(armRest("R", 0.35));
    });
  }

  function clap() {
    withBusy((done) => {
      audio.happy();
      smilePulse(1.2);
      const tl = gsap.timeline({ onComplete: done });
      tl.add(armGesture("L", { upperX: -80 * DEG, upperZ: -25 * DEG, foreX: -60 * DEG }, 0.28), 0);
      tl.add(armGesture("R", { upperX: -80 * DEG, upperZ: 25 * DEG, foreX: -60 * DEG }, 0.28), 0);
      tl.to([bones.armL_hand.rotation, bones.armR_hand.rotation], { z: "+=" + 10 * DEG, duration: 0.09, ease: "sine.inOut", yoyo: true, repeat: 5 }, ">");
      tl.add(armRest("L", 0.35), ">");
      tl.add(armRest("R", 0.35), "<");
    });
  }

  function bounceLaugh() {
    withBusy((done) => {
      audio.happy();
      smilePulse(1.2);
      eyesClose(0.5);
      gsap
        .timeline({ onComplete: done })
        .to(tilter.scale, { y: 0.9, x: 1.06, duration: 0.12, ease: "sine.in" })
        .to(tilter.scale, { y: 1.06, x: 0.97, duration: 0.14, ease: "sine.out" })
        .to(tilter.scale, { y: 1, x: 1, duration: 0.22, ease: "elastic.out(1, 0.4)" });
    });
  }

  // ---------- leg gestures ----------
  function legKick(side) {
    const upper = bones[`leg${side}_upper`];
    const lower = bones[`leg${side}_lower`];
    return gsap
      .timeline()
      .to(upper.rotation, { x: -55 * DEG, duration: 0.16, ease: "back.out(2.5)" })
      .to(lower.rotation, { x: 30 * DEG, duration: 0.16, ease: "back.out(2.5)" }, "<")
      .to([upper.rotation, lower.rotation], { x: 0, duration: 0.24, ease: "sine.inOut" });
  }

  function jump() {
    withBusy((done) => {
      audio.click();
      const legs = ["legL_upper", "legR_upper", "legL_lower", "legR_lower"].map((n) => bones[n]);
      gsap
        .timeline({ onComplete: done })
        .to(legs.map((l) => l.rotation), { x: 22 * DEG, duration: 0.14, ease: "sine.in" })
        .to(tilter.scale, { y: 0.9, duration: 0.14, ease: "sine.in" }, "<")
        .to(tilter.position, { y: "+=0.22", duration: 0.24, ease: "power2.out" }, ">")
        .to(tilter.scale, { y: 1.06, duration: 0.24, ease: "sine.out" }, "<")
        .to(legs.map((l) => l.rotation), { x: 0, duration: 0.24, ease: "sine.out" }, "<")
        .to(tilter.position, { y: "-=0.22", duration: 0.26, ease: "bounce.out" })
        .to(tilter.scale, { y: 1, duration: 0.2, ease: "sine.out" }, "<");
    });
  }

  function legReaction(side) {
    const kind = pick(["jump", "kick", "dance"]);
    if (kind === "jump") return jump();
    withBusy((done) => {
      audio.click();
      if (kind === "kick") legKick(side || "R").eventCallback("onComplete", done);
      else danceTimeline(done);
    });
  }

  function danceTimeline(onDone) {
    const tl = gsap.timeline({ onComplete: onDone });
    for (let i = 0; i < 3; i++) {
      tl.to(tilter.rotation, { z: 10 * DEG, duration: 0.18, ease: "sine.inOut" }, i === 0 ? 0 : ">")
        .to(bones.armL_upper.rotation, { z: -50 * DEG, duration: 0.18, ease: "sine.inOut" }, "<")
        .to(bones.armR_upper.rotation, { z: 50 * DEG, duration: 0.18, ease: "sine.inOut" }, "<")
        .to(tilter.rotation, { z: -10 * DEG, duration: 0.18, ease: "sine.inOut" })
        .to(bones.armL_upper.rotation, { z: 0, duration: 0.18, ease: "sine.inOut" }, "<")
        .to(bones.armR_upper.rotation, { z: 0, duration: 0.18, ease: "sine.inOut" }, "<");
    }
    tl.to(tilter.rotation, { z: 0, duration: 0.25, ease: "sine.inOut" });
    return tl;
  }

  function dance() {
    // Can land a beat after another gesture already claimed `tilter` (10-
    // click easter egg) — clear it first so the two cleanly hand off.
    gsap.killTweensOf(tilter.rotation);
    gsap.killTweensOf(tilter.position);
    withBusy((done) => {
      audio.happy();
      smilePulse(1.4);
      danceTimeline(done);
    });
  }

  function walk() {
    withBusy((done) => {
      const steps = 3;
      const stepDist = 0.06;
      const tl = gsap.timeline({ onComplete: done });
      for (let i = 0; i < steps; i++) {
        const fwd = i % 2 === 0 ? "L" : "R";
        const back = fwd === "L" ? "R" : "L";
        tl.to(bones[`leg${fwd}_upper`].rotation, { x: -26 * DEG, duration: 0.22, ease: "sine.inOut" }, ">")
          .to(bones[`leg${back}_upper`].rotation, { x: 20 * DEG, duration: 0.22, ease: "sine.inOut" }, "<")
          .to(tilter.position, { x: `+=${stepDist}`, duration: 0.22, ease: "sine.inOut" }, "<");
      }
      tl.to(["legL_upper", "legR_upper"].map((n) => bones[n].rotation), { x: 0, duration: 0.3, ease: "sine.inOut" });
      tl.to(tilter.position, { x: 0, duration: 0.4, ease: "sine.inOut" });
    });
  }

  function stretch() {
    withBusy((done) => {
      const tl = gsap.timeline({ onComplete: done });
      tl.add(armGesture("L", { upperX: -160 * DEG }, 0.5, "sine.out"), 0);
      tl.add(armGesture("R", { upperX: -160 * DEG }, 0.5, "sine.out"), 0);
      tl.to(tilter.scale, { y: 1.06, duration: 0.5, ease: "sine.out" }, 0);
      tl.to({}, { duration: 0.4 });
      tl.add(armRest("L", 0.5), ">");
      tl.add(armRest("R", 0.5), "<");
      tl.to(tilter.scale, { y: 1, duration: 0.5, ease: "sine.inOut" }, "<");
    });
  }

  function repairServer() {
    withBusy((done) => {
      smilePulse(1);
      gsap
        .timeline({ onComplete: done })
        .add(armGesture("R", { upperX: -95 * DEG, foreX: -30 * DEG }, 0.2))
        .to(bones.armR_hand.rotation, { z: "+=" + 18 * DEG, duration: 0.1, ease: "sine.inOut", yoyo: true, repeat: 7 }, ">")
        .add(armRest("R", 0.25));
    });
  }

  function sitDown() {
    withBusy((done) => {
      const tl = gsap.timeline({ onComplete: done });
      tl.to(bones.hip.rotation, { x: -12 * DEG, duration: 0.35, ease: "sine.out" }, 0)
        .to([bones.legL_upper.rotation, bones.legR_upper.rotation], { x: -95 * DEG, duration: 0.35, ease: "sine.out" }, 0)
        .to([bones.legL_lower.rotation, bones.legR_lower.rotation], { x: 100 * DEG, duration: 0.35, ease: "sine.out" }, 0)
        .to(tilter.position, { y: "-=0.18", duration: 0.35, ease: "sine.out" }, 0)
        .to({}, { duration: 1.4 })
        .to(bones.hip.rotation, { x: 0, duration: 0.4, ease: "sine.inOut" }, ">")
        .to([bones.legL_upper.rotation, bones.legR_upper.rotation], { x: 0, duration: 0.4, ease: "sine.inOut" }, "<")
        .to([bones.legL_lower.rotation, bones.legR_lower.rotation], { x: 0, duration: 0.4, ease: "sine.inOut" }, "<")
        .to(tilter.position, { y: "+=0.18", duration: 0.4, ease: "sine.inOut" }, "<");
    });
  }

  function useTablet(topic) {
    withBusy((done) => {
      audio.thinking();
      const tl = gsap.timeline({ onComplete: done });
      tl.add(armGesture("L", { upperX: -95 * DEG, upperZ: -15 * DEG, foreX: -85 * DEG }, 0.35, "back.out(1.8)"), 0);
      tl.add(armGesture("R", { upperX: -70 * DEG, upperZ: 20 * DEG, foreX: -70 * DEG }, 0.35, "back.out(1.8)"), 0);
      if (materials?.tabletScreen) {
        tl.to(materials.tabletScreen, { emissiveIntensity: 0.9, duration: 0.3 }, 0.1);
      }
      tl.call(() => hologramShow && hologramShow(topic));
      tl.to({}, { duration: 1.6 });
      tl.call(() => hologramHide && hologramHide());
      if (materials?.tabletScreen) {
        tl.to(materials.tabletScreen, { emissiveIntensity: 0.35, duration: 0.4 }, ">-0.3");
      }
      tl.add(armRest("L", 0.4), ">");
      tl.add(armRest("R", 0.4), "<");
    });
  }

  function celebrate(onConfetti) {
    // Double-click can land mid-gesture (the first click already triggered
    // its own zone reaction) — clear tilter's tweens first so celebrate
    // cleanly takes over instead of fighting the interrupted gesture.
    gsap.killTweensOf(tilter.rotation);
    gsap.killTweensOf(tilter.position);
    gsap.killTweensOf(tilter.scale);
    withBusy((done) => {
      audio.happy();
      smilePulse(1.6);
      const tl = gsap.timeline({ onComplete: done });
      tl.add(armGesture("L", { upperX: -150 * DEG }, 0.3), 0);
      tl.add(armGesture("R", { upperX: -150 * DEG }, 0.3), 0);
      tl.to(tilter.position, { y: "+=0.22", duration: 0.22, ease: "power2.out" }, 0);
      tl.to(tilter.rotation, { y: "+=" + Math.PI * 2, duration: 0.6, ease: "power1.inOut" }, 0);
      tl.to(tilter.position, { y: "-=0.22", duration: 0.32, ease: "bounce.out" }, ">");
      tl.call(() => onConfetti && onConfetti());
      tl.add(armRest("L", 0.35), ">");
      tl.add(armRest("R", 0.35), "<");
    });
  }

  function greetWave() {
    withBusy((done) => {
      audio.hello();
      smilePulse(1.2);
      const tl = gsap.timeline({ onComplete: done });
      tl.add(armGesture("R", { upperZ: 80 * DEG, foreX: -30 * DEG }, 0.3));
      tl.to(bones.armR_hand.rotation, { z: "+=" + 22 * DEG, duration: 0.16, ease: "sine.inOut", yoyo: true, repeat: 4 }, ">");
      tl.add(armRest("R", 0.35));
    });
  }

  function nod() {
    withBusy((done) => {
      audio.click();
      smilePulse();
      gsap
        .timeline({ onComplete: done })
        .to(bones.head.rotation, { x: 16 * DEG, duration: 0.16, ease: "sine.out" })
        .to(bones.head.rotation, { x: -6 * DEG, duration: 0.14, ease: "sine.inOut" })
        .to(bones.head.rotation, { x: 0, duration: 0.18, ease: "sine.inOut" });
      blinkOnce();
    });
  }

  function faceReaction() {
    withBusy((done) => {
      audio.click();
      const kind = pick(["wink", "happy", "surprised"]);
      if (kind === "wink") {
        const eyelid = Math.random() < 0.5 ? bones.eyelidL : bones.eyelidR;
        gsap
          .timeline({ onComplete: done })
          .to(eyelid.scale, { y: 1, duration: 0.09, ease: "sine.in" })
          .to({}, { duration: 0.22 })
          .to(eyelid.scale, { y: 0.05, duration: 0.14, ease: "back.out(3)" });
      } else if (kind === "surprised") {
        gsap
          .timeline({ onComplete: done })
          .to([bones.eyeL.scale, bones.eyeR.scale], { x: 1.4, y: 1.4, duration: 0.15, ease: "back.out(3)" })
          .to({}, { duration: 0.7 })
          .to([bones.eyeL.scale, bones.eyeR.scale], { x: 1, y: 1, duration: 0.3, ease: "sine.inOut" });
      } else {
        smilePulse(1);
        gsap.delayedCall(1, done);
      }
    });
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
      case "raiseHand":
        return raiseHand(Math.random() < 0.5 ? "L" : "R");
      case "smile":
        return smilePulse(1.4);
      case "tiltHead":
        return tiltHead();
      case "checkTablet":
      case "launchHologram":
        return useTablet(pick(CONFIG.hologramTopics));
      case "lookAround":
        lookAt(rand(-0.8, 0.8), rand(-0.4, 0.4));
        return setTimeout(() => !busy && returnToRest(1), 1200);
      case "stretch":
        return stretch();
      case "dance":
        return dance();
      case "walk":
        return walk();
      case "sitDown":
        return sitDown();
      case "repairServer":
        return repairServer();
      case "showShield":
        return shieldFlash();
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
    start, stop, setHologramHandlers,
    blinkOnce, lookAt, returnToRest, smilePulse, eyesClose, tiltHead,
    nod, faceReaction, wave, raiseHand, pointTo, thumbsUp, clap, bounceLaugh,
    legReaction, jump, dance, walk, stretch, sitDown, useTablet,
    repairServer, shieldFlash, celebrate, greetWave,
    isBusy: () => busy,
  };
}
