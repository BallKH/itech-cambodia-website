// iTech Cambodia — AI Robot Mascot — animation library
// Every gesture the robot can perform, built as small GSAP timelines that act
// on the Object3D parts produced by robot.js. Exposed as a bound-method object
// via createAnimator(ctx) so callers never juggle raw part references.

import { CONFIG, prefersReducedMotion } from "./config.js";
import { state } from "./state.js";
import { audio } from "./audio.js";

const gsap = window.gsap;
const rand = (min, max) => min + Math.random() * (max - min);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function createAnimator(ctx) {
  const { parts } = ctx;
  const idleTimers = [];
  let busy = false; // true while a one-off gesture owns the arms/body
  let expression = "neutral";

  const setMouth = (name) => {
    for (const [key, mesh] of Object.entries(parts.mouths)) mesh.visible = key === name;
  };

  // Combined mouth + eye-width expression, for head/face gestures. Eye-only
  // reactions (wink/happyEyes/surprisedEyes) drive eye scale directly instead
  // and use setMouth() so the two systems never fight over eyeL/eyeR.scale.x.
  const setExpression = (name) => {
    expression = name;
    setMouth(name);
    const wide = name === "surprised" || name === "laugh";
    gsap.to(parts.eyeScale, {
      x: wide ? 1.25 : 1,
      duration: 0.25,
      ease: "back.out(3)",
      overwrite: "auto",
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

  // Head/eyes only — never the whole robot — and capped well below gesture
  // rotation ranges so it always reads as a subtle glance, not a spin.
  const maxLookRad = (CONFIG.cursorFollow.maxAngleDeg * Math.PI) / 180;
  const lookAt = (nx, ny) => {
    // nx, ny in [-1, 1] — normalized target direction (e.g. cursor offset)
    if (busy) return;
    gsap.to(parts.head.rotation, {
      y: nx * maxLookRad,
      x: -ny * maxLookRad * 0.6,
      duration: 0.6,
      ease: "power2.out",
      overwrite: "auto",
      id: "look",
    });
    gsap.to([parts.eyeL.position, parts.eyeR.position], {
      z: 0.02 + nx * 0.012,
      duration: 0.6,
      ease: "power2.out",
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

  // Slow, low-amplitude sway distinct from floating()'s tilt — reads as
  // "weight shifting," not "spinning." Ambient only, never during a gesture.
  const bodySway = () => {
    gsap.to(parts.root.rotation, {
      x: 0.035,
      duration: CONFIG.timing.bodySwayPeriodMs / 1000,
      ease: "sine.inOut",
      yoyo: true,
      repeat: -1,
    });
  };

  const scheduleBlink = () => {
    const t = setTimeout(() => {
      if (!busy && !state.asleep) blinkOnce();
      scheduleBlink();
    }, rand(CONFIG.timing.blinkMinMs, CONFIG.timing.blinkMaxMs));
    idleTimers.push(t);
  };

  const scheduleHeadTurn = () => {
    const t = setTimeout(() => {
      if (!busy && !state.asleep && !state.cursor.active) {
        lookAt(rand(-0.6, 0.6), rand(-0.3, 0.3));
        setTimeout(() => !busy && !state.asleep && !state.cursor.active && returnHeadToRest(1), 1200);
      }
      scheduleHeadTurn();
    }, rand(CONFIG.timing.headTurnMinMs, CONFIG.timing.headTurnMaxMs));
    idleTimers.push(t);
  };

  // Tiny random head tilt — "curious" micro-gesture, independent of look-at.
  const scheduleHeadTilt = () => {
    const t = setTimeout(() => {
      if (!busy && !state.asleep && !state.cursor.active) {
        const tilt = rand(-0.14, 0.14);
        gsap.to(parts.head.rotation, { z: tilt, duration: 0.7, ease: "sine.out", overwrite: "auto", id: "tilt" });
        setTimeout(() => {
          if (!busy) gsap.to(parts.head.rotation, { z: 0, duration: 0.9, ease: "sine.inOut", id: "tilt" });
        }, 1500);
      }
      scheduleHeadTilt();
    }, rand(CONFIG.timing.headTiltMinMs, CONFIG.timing.headTiltMaxMs));
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
      if (!busy && !state.asleep) runWorkAction();
      scheduleWork();
    }, rand(1800, 3400));
    idleTimers.push(t);
  };

  let lastWorkAction = null;
  const runWorkAction = () => {
    let action = pick(CONFIG.workingActions);
    if (CONFIG.workingActions.length > 1) {
      while (action === lastWorkAction) action = pick(CONFIG.workingActions);
    }
    lastWorkAction = action;
    const tl = gsap.timeline();
    switch (action) {
      case "typing":
        tl.to(parts.armR.rotation, {
          x: -0.15,
          duration: 0.15,
          repeat: 5,
          yoyo: true,
          ease: "sine.inOut",
          onRepeat: () => audio.typing(),
        });
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
      if (!busy && !state.asleep) runRandomEvent();
      scheduleRandomEvent();
    }, rand(CONFIG.timing.randomEventMinMs, CONFIG.timing.randomEventMaxMs));
    idleTimers.push(t);
  };

  let lastRandomEvent = null;
  const runRandomEvent = () => {
    let evt = pick(CONFIG.randomEvents);
    if (CONFIG.randomEvents.length > 1) {
      while (evt === lastRandomEvent) evt = pick(CONFIG.randomEvents);
    }
    lastRandomEvent = evt;
    switch (evt) {
      case "wave": return wave();
      case "stretch": return stretch();
      case "smile": return faceExpression("smile");
      case "checkTablet": return (showHologram(pick(CONFIG.hologramTopics), 2000), undefined);
      case "drinkCoffee": return showProp("coffee", 2200);
      case "repairServer": return repairServer();
      case "launchHologram": return showHologram(pick(CONFIG.hologramTopics), 2400);
      case "showShield": return showProp("shield", 2200);
      case "showCloudIcon": return showHologram("cloud", 2200);
      case "showAiIcon": return showHologram("ai", 2200);
      case "dance": return dance();
      case "thumbsUp": return thumbsUp();
      case "lookAtVisitor":
        lookAt(0, 0);
        return setTimeout(() => !busy && returnHeadToRest(1), 1400);
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
      audio.beep();
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

  // ---------- eyes-only reactions (distinct from head/face gestures) ----------
  function wink() {
    withBusy((done) => {
      const eye = Math.random() < 0.5 ? parts.eyeL : parts.eyeR;
      setMouth("smile");
      gsap.timeline({ onComplete: () => (setMouth("neutral"), done()) })
        .to(eye.scale, { y: 0.05, duration: 0.1, ease: "sine.in" })
        .to({}, { duration: 0.25 })
        .to(eye.scale, { y: 1, duration: 0.15, ease: "back.out(3)" });
    });
  }

  function happyEyes() {
    withBusy((done) => {
      setMouth("smile");
      gsap.timeline({ onComplete: () => (setMouth("neutral"), done()) })
        .to([parts.eyeL.scale, parts.eyeR.scale], { y: 0.35, x: 1.3, duration: 0.2, ease: "sine.out" })
        .to({}, { duration: 1 })
        .to([parts.eyeL.scale, parts.eyeR.scale], { y: 1, x: 1, duration: 0.25, ease: "sine.inOut" });
    });
  }

  function surprisedEyes() {
    withBusy((done) => {
      gsap.timeline({ onComplete: done })
        .to([parts.eyeL.scale, parts.eyeR.scale], { y: 1.5, x: 1.15, duration: 0.15, ease: "back.out(3)" })
        .to({}, { duration: 0.9 })
        .to([parts.eyeL.scale, parts.eyeR.scale], { y: 1, x: 1, duration: 0.3, ease: "sine.inOut" });
    });
  }

  function wave() {
    withBusy((done) => {
      audio.wave();
      setExpression("smile");
      gsap.timeline({ onComplete: () => (setExpression("neutral"), done()) })
        .to(parts.armL.rotation, { z: -2.1, x: -0.3, duration: 0.35, ease: "back.out(2)" })
        .to(parts.armL.rotation, { z: -1.7, duration: 0.18, yoyo: true, repeat: 5, ease: "sine.inOut" })
        .to(parts.armL.rotation, { z: 0, x: 0, duration: 0.4, ease: "sine.inOut" });
    });
  }

  function thumbsUp() {
    withBusy((done) => {
      audio.happy();
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

  // A small, cute full-body hop — the "feet click" reaction.
  function hop() {
    withBusy((done) => {
      audio.boop();
      setExpression("smile");
      gsap.timeline({ onComplete: () => (setExpression("neutral"), done()) })
        .to(parts.root.scale, { y: 0.88, duration: 0.1, ease: "sine.in" })
        .to(parts.root.position, { y: "+=0.22", duration: 0.22, ease: "power2.out" }, ">")
        .to(parts.root.scale, { y: 1.06, duration: 0.16, ease: "sine.out" }, "<")
        .to(parts.root.position, { y: "-=0.22", duration: 0.24, ease: "bounce.out" })
        .to(parts.root.scale, { y: 1, duration: 0.2, ease: "elastic.out(1, 0.5)" }, "<");
    });
  }

  function dance() {
    withBusy((done) => {
      audio.laugh();
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
      audio.laugh();
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

  // ---------- sleep / wake (idle-timeout bonus feature) ----------
  function sleepPose() {
    setExpression("neutral");
    gsap.to([parts.eyeL.scale, parts.eyeR.scale], { y: 0.06, duration: 0.45, ease: "sine.inOut", overwrite: "auto" });
    gsap.to(parts.head.rotation, { x: 0.22, z: 0.12, duration: 0.7, ease: "sine.inOut", overwrite: "auto", id: "look" });
  }

  function wakePose() {
    gsap.to([parts.eyeL.scale, parts.eyeR.scale], { y: 1, duration: 0.3, ease: "back.out(2.4)", overwrite: "auto" });
    gsap.timeline()
      .to(parts.head.rotation, { x: -0.12, z: 0, duration: 0.3, ease: "sine.out", overwrite: "auto", id: "look" })
      .to(parts.head.rotation, { x: 0, duration: 0.4, ease: "sine.inOut" });
  }

  // ---------- thinking / listening (emotion.js-driven eye behavior) ----------
  let thinkingTween = null;
  function setThinking(on) {
    if (on) {
      gsap.to(parts.head.rotation, { x: -0.1, duration: 0.5, ease: "sine.out", overwrite: "auto", id: "look" });
      thinkingTween = gsap.to([parts.eyeL.position, parts.eyeR.position], {
        x: "+=0.02",
        duration: 0.9,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      });
    } else {
      thinkingTween?.kill();
      thinkingTween = null;
      gsap.to([parts.eyeL.position, parts.eyeR.position], { x: (i) => (i === 0 ? -0.1 : 0.1), duration: 0.4, ease: "sine.inOut" });
      if (!busy) returnHeadToRest(0.5);
    }
  }

  function setListening(on) {
    gsap.to([parts.eyeL.scale, parts.eyeR.scale], { y: on ? 1.1 : 1, duration: 0.3, ease: "sine.out", overwrite: "auto" });
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
      audio.wave();
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
    bodySway();
    antennaPulse();
    scheduleBlink();
    scheduleHeadTurn();
    scheduleHeadTilt();
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
    nod, faceExpression, wink, happyEyes, surprisedEyes, wave, thumbsUp, pointTo, kick, liftFoot, hop, dance,
    giggleBounce, spinBody, stretch, celebrate, sitDown, yawn, standUp,
    showProp, hideProp, showHologram, hideHologram, repairServer, flyDrone,
    scanPage, superheroTransform, clap, greetWave, dragTilt, dragRelease,
    sleepPose, wakePose, setThinking, setListening,
    isBusy: () => busy,
    setBusy: (v) => (busy = v),
    getExpression: () => expression,
  };
}
