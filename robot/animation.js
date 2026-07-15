// iTech Cambodia — AI Robot Mascot — animation library
// Every gesture the robot can perform, built as small GSAP timelines that act
// on the Object3D parts produced by robot.js. Exposed as a bound-method object
// via createAnimator(ctx) so callers never juggle raw part references.

import { CONFIG, prefersReducedMotion } from "./config.js";
import { state } from "./state.js";

const gsap = window.gsap;
const rand = (min, max) => min + Math.random() * (max - min);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function createAnimator(ctx) {
  const { parts } = ctx;
  const idleTimers = [];
  let busy = false; // true while a one-off gesture owns the arms/body
  let expression = "neutral";

  const setExpression = (name) => {
    expression = name;
    for (const [key, mesh] of Object.entries(parts.mouths)) mesh.visible = key === name;
    const wide = name === "surprised" || name === "laugh";
    gsap.to(parts.eyeScale, {
      x: wide ? 1.25 : 1,
      duration: 0.25,
      ease: "back.out(3)",
      onUpdate: () => {
        parts.eyeL.scale.x = parts.eyeScale.x;
        parts.eyeR.scale.x = parts.eyeScale.x;
      },
    });
  };

  const blinkOnce = () => {
    if (parts.eyeL.userData.blinking) return;
    parts.eyeL.userData.blinking = true;
    const tl = gsap.timeline({
      onComplete: () => (parts.eyeL.userData.blinking = false),
    });
    tl.to([parts.eyeL.scale, parts.eyeR.scale], { y: 0.05, duration: 0.07, ease: "sine.in" })
      .to([parts.eyeL.scale, parts.eyeR.scale], { y: 1, duration: 0.1, ease: "sine.out" });
  };

  const lookAt = (nx, ny) => {
    // nx, ny in [-1, 1] — normalized target direction (e.g. cursor offset)
    if (busy) return;
    gsap.to(parts.head.rotation, {
      y: nx * 0.42,
      x: -ny * 0.22,
      duration: 0.5,
      ease: "sine.out",
      overwrite: "auto",
      id: "look",
    });
    gsap.to([parts.eyeL.position, parts.eyeR.position], {
      z: 0.02 + nx * 0.015,
      duration: 0.5,
      overwrite: "auto",
    });
  };

  const returnHeadToRest = (duration = 0.6) => {
    gsap.to(parts.head.rotation, { x: 0, y: 0, duration, ease: "sine.inOut", overwrite: "auto", id: "look" });
  };

  // ---------- ambient idle loops ----------
  const breathing = () => {
    gsap.to(parts.body.scale, {
      y: 1.035,
      x: 1.012,
      z: 1.012,
      duration: 1.9,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
    });
    gsap.to(parts.core.material, {
      emissiveIntensity: 1.6,
      duration: 1.9,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
    });
  };

  const floating = () => {
    gsap.to(parts.root.position, {
      y: "+=0.09",
      duration: 2.6,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
    });
    gsap.to(parts.root.rotation, {
      z: 0.02,
      duration: 3.4,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
    });
  };

  const scheduleBlink = () => {
    const t = setTimeout(() => {
      if (!busy) blinkOnce();
      scheduleBlink();
    }, rand(CONFIG.timing.blinkMinMs, CONFIG.timing.blinkMaxMs));
    idleTimers.push(t);
  };

  const scheduleHeadTurn = () => {
    const t = setTimeout(() => {
      if (!busy && !state.cursor.active) {
        lookAt(rand(-0.6, 0.6), rand(-0.3, 0.3));
        setTimeout(() => !busy && !state.cursor.active && returnHeadToRest(1), 1200);
      }
      scheduleHeadTurn();
    }, rand(CONFIG.timing.headTurnMinMs, CONFIG.timing.headTurnMaxMs));
    idleTimers.push(t);
  };

  const antennaPulse = () => {
    gsap.to(parts.antennaTip.material, {
      emissiveIntensity: 2.2,
      duration: 1.1,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
    });
  };

  // ---------- work loop (tablet interactions) ----------
  // Scheduled the same way as blink/head-turn/random-event: a self-rescheduling
  // setTimeout that *always* re-queues itself, only skipping the actual gesture
  // (not the scheduling) while busy. Chaining via a GSAP onComplete instead would
  // let the loop die permanently the first time it completes while a click
  // gesture is playing, since that completion callback would see busy === true.
  const scheduleWork = () => {
    const t = setTimeout(() => {
      if (!busy) runWorkAction();
      scheduleWork();
    }, rand(1800, 3400));
    idleTimers.push(t);
  };

  const runWorkAction = () => {
    const action = pick(CONFIG.workingActions);
    const tl = gsap.timeline();
    switch (action) {
      case "typing":
        tl.to(parts.armR.rotation, { x: -0.15, duration: 0.15, repeat: 5, yoyo: true, ease: "sine.inOut" });
        break;
      case "touchingTablet":
        tl.to(parts.handR.rotation, { z: 0.3, duration: 0.4, yoyo: true, repeat: 1, ease: "sine.inOut" });
        break;
      case "reading":
      case "analyzing":
        tl.to(parts.head.rotation, { x: 0.18, duration: 0.8, ease: "sine.inOut" }).to(parts.head.rotation, {
          x: 0,
          duration: 0.8,
          ease: "sine.inOut",
          delay: 1.4,
        });
        break;
      case "lookingAtHologram":
        showHologram(pick(CONFIG.hologramTopics), 2200);
        break;
      case "checkingServer":
      case "watchingCloud":
        tl.to(parts.head.rotation, { y: 0.25, duration: 0.6 }).to(parts.head.rotation, { y: 0, duration: 0.6, delay: 1 });
        break;
      default:
        break;
    }
  };

  // ---------- random ambient events ----------
  const scheduleRandomEvent = () => {
    const t = setTimeout(() => {
      if (!busy) runRandomEvent();
      scheduleRandomEvent();
    }, rand(CONFIG.timing.randomEventMinMs, CONFIG.timing.randomEventMaxMs));
    idleTimers.push(t);
  };

  const runRandomEvent = () => {
    const evt = pick(CONFIG.randomEvents);
    switch (evt) {
      case "wave": return wave();
      case "stretch": return stretch();
      case "smile": return faceExpression("smile");
      case "drinkCoffee": return showProp("coffee", 2200);
      case "holdWrench": return showProp("wrench", 2200);
      case "showShield": return showProp("shield", 2200);
      case "launchHologram": return showHologram(pick(CONFIG.hologramTopics), 2400);
      case "repairServer": return repairServer();
      case "flyDrone": return flyDrone();
      case "scanPage": return scanPage();
      default: return null;
    }
  };

  // ---------- gesture library (click reactions + random events share these) ----------
  function withBusy(fn) {
    busy = true;
    const done = () => (busy = false);
    fn(done);
  }

  function nod() {
    withBusy((done) => {
      setExpression("smile");
      gsap.timeline({ onComplete: () => (setExpression("neutral"), done()) })
        .to(parts.head.rotation, { x: 0.28, duration: 0.18, ease: "sine.out" })
        .to(parts.head.rotation, { x: -0.05, duration: 0.16, ease: "sine.inOut" })
        .to(parts.head.rotation, { x: 0, duration: 0.2, ease: "sine.inOut" });
      blinkOnce();
    });
  }

  function faceExpression(name) {
    withBusy((done) => {
      setExpression(name);
      gsap.delayedCall(1.4, () => {
        setExpression("neutral");
        done();
      });
    });
  }

  function wave() {
    withBusy((done) => {
      setExpression("smile");
      gsap.timeline({ onComplete: () => (setExpression("neutral"), done()) })
        .to(parts.armL.rotation, { z: -2.1, x: -0.3, duration: 0.35, ease: "back.out(2)" })
        .to(parts.armL.rotation, { z: -1.7, duration: 0.18, yoyo: true, repeat: 5, ease: "sine.inOut" })
        .to(parts.armL.rotation, { z: 0, x: 0, duration: 0.4, ease: "sine.inOut" });
    });
  }

  function thumbsUp() {
    withBusy((done) => {
      setExpression("smile");
      gsap.timeline({ onComplete: () => (setExpression("neutral"), done()) })
        .to(parts.armL.rotation, { z: -1.9, duration: 0.3, ease: "back.out(2)" })
        .to({}, { duration: 0.9 })
        .to(parts.armL.rotation, { z: 0, duration: 0.35, ease: "sine.inOut" });
    });
  }

  function pointTo(dirX = 1) {
    withBusy((done) => {
      gsap.timeline({ onComplete: done })
        .to(parts.armR.rotation, { z: dirX * -1.6, x: -0.2, duration: 0.35, ease: "back.out(2)" })
        .to(parts.head.rotation, { y: dirX * 0.3, duration: 0.35, ease: "sine.out" }, "<")
        .to({}, { duration: 1 })
        .to(parts.armR.rotation, { z: 0, x: 0, duration: 0.4, ease: "sine.inOut" })
        .to(parts.head.rotation, { y: 0, duration: 0.4, ease: "sine.inOut" }, "<");
    });
  }

  function kick(side = "L") {
    const leg = side === "L" ? parts.legL : parts.legR;
    withBusy((done) => {
      gsap.timeline({ onComplete: done })
        .to(leg.rotation, { x: -0.9, duration: 0.18, ease: "back.out(3)" })
        .to(leg.rotation, { x: 0, duration: 0.3, ease: "sine.inOut" });
    });
  }

  function liftFoot(side = "L") {
    const leg = side === "L" ? parts.legL : parts.legR;
    withBusy((done) => {
      gsap.timeline({ onComplete: done })
        .to(leg.rotation, { x: -0.5, duration: 0.3, ease: "sine.out" })
        .to({}, { duration: 0.6 })
        .to(leg.rotation, { x: 0, duration: 0.35, ease: "sine.inOut" });
    });
  }

  function dance() {
    withBusy((done) => {
      setExpression("laugh");
      const tl = gsap.timeline({ onComplete: () => (setExpression("neutral"), done()) });
      for (let i = 0; i < 4; i++) {
        tl.to(parts.root.rotation, { z: 0.22, duration: 0.22, ease: "sine.inOut" })
          .to(parts.legL.rotation, { x: -0.4, duration: 0.22 }, "<")
          .to(parts.root.rotation, { z: -0.22, duration: 0.22, ease: "sine.inOut" })
          .to(parts.legL.rotation, { x: 0, duration: 0.22 }, "<")
          .to(parts.legR.rotation, { x: -0.4, duration: 0.22 }, "<");
      }
      tl.to([parts.root.rotation, parts.legR.rotation, parts.legL.rotation], { x: 0, z: 0, duration: 0.3 });
    });
  }

  function giggleBounce() {
    withBusy((done) => {
      setExpression("laugh");
      gsap.timeline({ onComplete: () => (setExpression("neutral"), done()) })
        .to(parts.root.scale, { y: 0.85, x: 1.12, duration: 0.12, ease: "sine.in" })
        .to(parts.root.scale, { y: 1.1, x: 0.95, duration: 0.14, ease: "sine.out" })
        .to(parts.root.scale, { y: 1, x: 1, duration: 0.2, ease: "elastic.out(1, 0.4)" });
    });
  }

  function spinBody() {
    withBusy((done) => {
      gsap.to(parts.root.rotation, {
        y: parts.root.rotation.y + Math.PI * 2,
        duration: 0.9,
        ease: "power2.inOut",
        onComplete: done,
      });
    });
  }

  function stretch() {
    withBusy((done) => {
      gsap.timeline({ onComplete: done })
        .to([parts.armL.rotation, parts.armR.rotation], { z: (i) => (i === 0 ? 2.6 : -2.6), duration: 0.5, ease: "sine.out" })
        .to(parts.body.scale, { y: 1.15, duration: 0.5, ease: "sine.out" }, "<")
        .to({}, { duration: 0.5 })
        .to([parts.armL.rotation, parts.armR.rotation], { z: 0, duration: 0.5, ease: "sine.inOut" })
        .to(parts.body.scale, { y: 1, duration: 0.5, ease: "sine.inOut" }, "<");
    });
  }

  function celebrate(onConfetti) {
    withBusy((done) => {
      setExpression("laugh");
      const tl = gsap.timeline({ onComplete: () => (setExpression("neutral"), done()) });
      tl.to(parts.root.position, { y: "+=0.5", duration: 0.28, ease: "power2.out" })
        .to(parts.root.rotation, { y: parts.root.rotation.y + Math.PI * 2, duration: 0.56, ease: "power1.inOut" }, "<")
        .to(parts.root.position, { y: "-=0.5", duration: 0.3, ease: "bounce.out" })
        .call(() => onConfetti && onConfetti())
        .add(danceTimeline(), ">-0.1");
    });
  }

  function danceTimeline() {
    const tl = gsap.timeline();
    for (let i = 0; i < 3; i++) {
      tl.to(parts.root.rotation, { z: 0.18, duration: 0.18 })
        .to(parts.root.rotation, { z: -0.18, duration: 0.18 });
    }
    tl.to(parts.root.rotation, { z: 0, duration: 0.2 });
    return tl;
  }

  function sitDown(onSat) {
    withBusy(() => {
      setExpression("neutral");
      gsap.timeline({ onComplete: () => onSat && onSat() })
        .to(parts.root.position, { y: "-=0.42", duration: 0.5, ease: "sine.out" })
        .to(parts.legL.rotation, { x: -1.1, duration: 0.5, ease: "sine.out" }, "<")
        .to(parts.legR.rotation, { x: -1.1, duration: 0.5, ease: "sine.out" }, "<")
        .to(parts.armL.rotation, { z: 0.5, duration: 0.4 }, "<0.1")
        .to(parts.armR.rotation, { z: -0.5, duration: 0.4 }, "<");
    });
  }

  function yawn() {
    setExpression("surprised");
    gsap.timeline({ onComplete: () => setExpression("neutral") })
      .to(parts.head.rotation, { x: -0.2, duration: 0.5, ease: "sine.out" })
      .to(parts.armL.rotation, { z: 1.4, duration: 0.5, ease: "sine.out" }, "<")
      .to({}, { duration: 0.6 })
      .to(parts.head.rotation, { x: 0, duration: 0.5, ease: "sine.inOut" })
      .to(parts.armL.rotation, { z: 0, duration: 0.5, ease: "sine.inOut" }, "<");
  }

  function standUp() {
    gsap.timeline({ onComplete: () => (busy = false) })
      .to(parts.root.position, { y: "+=0.42", duration: 0.5, ease: "sine.inOut" })
      .to(parts.legL.rotation, { x: 0, duration: 0.5, ease: "sine.inOut" }, "<")
      .to(parts.legR.rotation, { x: 0, duration: 0.5, ease: "sine.inOut" }, "<")
      .to(parts.armL.rotation, { z: 0, duration: 0.4 }, "<")
      .to(parts.armR.rotation, { z: 0, duration: 0.4 }, "<");
  }

  function showProp(name, autoHideMs) {
    for (const [key, obj] of Object.entries(parts.props)) obj.visible = key === name;
    gsap.fromTo(parts.propAnchor.scale, { x: 0, y: 0, z: 0 }, { x: 1, y: 1, z: 1, duration: 0.3, ease: "back.out(3)" });
    if (autoHideMs) {
      gsap.delayedCall(autoHideMs / 1000, () => {
        gsap.to(parts.propAnchor.scale, {
          x: 0, y: 0, z: 0, duration: 0.25, ease: "sine.in",
          onComplete: () => Object.values(parts.props).forEach((o) => (o.visible = false)),
        });
      });
    }
  }

  function hideProp() {
    Object.values(parts.props).forEach((o) => (o.visible = false));
  }

  function showHologram(topic, autoHideMs) {
    for (const [key, obj] of Object.entries(parts.holograms)) obj.visible = key === topic;
    parts.hologramAnchor.visible = true;
    gsap.fromTo(
      parts.hologramAnchor.scale,
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 1, z: 1, duration: 0.35, ease: "back.out(2.5)" }
    );
    if (autoHideMs) gsap.delayedCall(autoHideMs / 1000, hideHologram);
  }

  function hideHologram() {
    gsap.to(parts.hologramAnchor.scale, {
      x: 0, y: 0, z: 0, duration: 0.25, ease: "sine.in",
      onComplete: () => (parts.hologramAnchor.visible = false),
    });
  }

  function repairServer() {
    withBusy((done) => {
      showProp("wrench");
      gsap.timeline({ onComplete: () => (hideProp(), done()) })
        .to(parts.armL.rotation, { z: -0.6, duration: 0.15, yoyo: true, repeat: 7, ease: "sine.inOut" })
        .to({}, { duration: 0.2 });
    });
  }

  function flyDrone() {
    withBusy((done) => {
      const drone = parts.props.drone;
      drone.visible = true;
      drone.position.set(0, 1.3, 0);
      gsap.timeline({
        onComplete: () => {
          drone.visible = false;
          done();
        },
      })
        .to(drone.position, { x: 0.9, y: 1.7, duration: 0.7, ease: "sine.inOut" })
        .to(drone.position, { x: -0.9, y: 1.5, duration: 1, ease: "sine.inOut" })
        .to(drone.rotation, { y: Math.PI * 4, duration: 1.7, ease: "none" }, "<")
        .to(drone.position, { x: 0, y: 1.3, duration: 0.6, ease: "sine.inOut" });
    });
  }

  function scanPage() {
    withBusy((done) => {
      gsap.timeline({ onComplete: done })
        .to(parts.eyeL.material, { emissiveIntensity: 2.4, duration: 0.2 })
        .to(parts.eyeR.material, { emissiveIntensity: 2.4, duration: 0.2 }, "<")
        .to(parts.head.rotation, { y: -0.3, duration: 0.4 })
        .to(parts.head.rotation, { y: 0.3, duration: 0.6 })
        .to(parts.head.rotation, { y: 0, duration: 0.3 })
        .to(parts.eyeL.material, { emissiveIntensity: 1, duration: 0.3 }, "<")
        .to(parts.eyeR.material, { emissiveIntensity: 1, duration: 0.3 }, "<");
    });
  }

  function superheroTransform() {
    parts.cape.visible = true;
    gsap.fromTo(parts.cape.scale, { y: 0 }, { y: 1, duration: 0.5, ease: "back.out(2)" });
    gsap.to(parts.core.material.color, { r: 1, g: 0.42, b: 0.12, duration: 0.6 });
    gsap.to(parts.eyeL.material.color, { r: 1, g: 0.42, b: 0.12, duration: 0.6 });
    gsap.to(parts.eyeR.material.color, { r: 1, g: 0.42, b: 0.12, duration: 0.6 });
    setExpression("smile");
    gsap.to(parts.cape.rotation, { x: 0.15, duration: 1.4, yoyo: true, repeat: -1, ease: "sine.inOut" });
  }

  function clap() {
    withBusy((done) => {
      setExpression("laugh");
      gsap.timeline({ onComplete: () => (setExpression("neutral"), done()) })
        .to(parts.armL.rotation, { z: -1.1, x: -0.3, duration: 0.2, ease: "sine.out" })
        .to(parts.armR.rotation, { z: 1.1, x: -0.3, duration: 0.2, ease: "sine.out" }, "<")
        .to([parts.armL.rotation, parts.armR.rotation], { z: (i) => (i === 0 ? -0.85 : 0.85), duration: 0.12, yoyo: true, repeat: 5 })
        .to([parts.armL.rotation, parts.armR.rotation], { z: 0, x: 0, duration: 0.3 });
    });
  }

  function greetWave() {
    withBusy((done) => {
      setExpression("smile");
      gsap.timeline({ onComplete: done })
        .to(parts.armL.rotation, { z: -2.1, x: -0.3, duration: 0.4, ease: "back.out(2)" })
        .to(parts.armL.rotation, { z: -1.7, duration: 0.2, yoyo: true, repeat: 5, ease: "sine.inOut" })
        .to(parts.armL.rotation, { z: 0, x: 0, duration: 0.4, ease: "sine.inOut", delay: 0.2 })
        .call(() => (busy = false), null, "-=0.3");
    });
  }

  function dragTilt(dx) {
    gsap.to(parts.root.rotation, { z: Math.max(-0.35, Math.min(0.35, dx * 0.002)), duration: 0.2, overwrite: "auto", id: "drag" });
  }

  function dragRelease(homeX, homeY) {
    gsap.to(parts.root.rotation, { z: 0, duration: 0.4, ease: "elastic.out(1, 0.5)", id: "drag" });
    gsap.to(parts.group.position, {
      x: homeX,
      y: homeY,
      duration: 0.6,
      ease: "elastic.out(1, 0.55)",
    });
  }

  function start() {
    if (prefersReducedMotion()) {
      antennaPulse();
      scheduleBlink();
      return { reduced: true };
    }
    breathing();
    floating();
    antennaPulse();
    scheduleBlink();
    scheduleHeadTurn();
    scheduleRandomEvent();
    scheduleWork();
    return { reduced: false };
  }

  function stop() {
    idleTimers.forEach(clearTimeout);
  }

  return {
    start, stop,
    setExpression, blinkOnce, lookAt, returnHeadToRest,
    nod, faceExpression, wave, thumbsUp, pointTo, kick, liftFoot, dance,
    giggleBounce, spinBody, stretch, celebrate, sitDown, yawn, standUp,
    showProp, hideProp, showHologram, hideHologram, repairServer, flyDrone,
    scanPage, superheroTransform, clap, greetWave, dragTilt, dragRelease,
    isBusy: () => busy,
    setBusy: (v) => (busy = v),
    getExpression: () => expression,
  };
}
