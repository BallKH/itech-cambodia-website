// iTech Cambodia — AI Robot Mascot — interaction layer
// Pointer (mouse+touch+pen unified via Pointer Events), keyboard, raycasting
// per body part, drag, double-click, long-press, hover-awareness on page
// elements, CTA click celebration, scroll reaction, section awareness,
// idle-sleep/wake, and easter eggs.

import * as THREE from "./vendor/three.module.min.js";
import { CONFIG } from "./config.js";
import { state } from "./state.js";
import { audio } from "./audio.js";

const gsap = window.gsap;
const deg2rad = Math.PI / 180;

export function createInteraction(ctx, animator, speaker, emotion) {
  const { renderer, camera, canvas, container, parts, hitMeshes } = ctx;
  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();

  let pointerDown = false;
  let dragging = false;
  let downX = 0, downY = 0;
  let longPressTimer = null;
  let lastPointerUpAt = 0;
  let lastArmClickAt = { L: 0, R: 0 };
  let lastPointCooldown = 0;
  let sitting = false;

  const worldPerPixel = () => {
    const h = canvas.clientHeight || CONFIG.size.desktop;
    return (2 * Math.tan((CONFIG.camera.fov / 2) * deg2rad) * CONFIG.camera.z) / h;
  };

  function pickPart(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    pointerNDC.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNDC.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNDC, camera);
    const hits = raycaster.intersectObjects(hitMeshes, false);
    return hits.length ? hits[0].object.userData.part : null;
  }

  function reactToPart(part) {
    if (animator.isBusy() || sitting || state.asleep) return;
    const now = performance.now();
    switch (part) {
      case "head":
        animator.nod();
        break;
      case "eyes":
        [animator.wink, animator.happyEyes, animator.surprisedEyes][Math.floor(Math.random() * 3)]();
        break;
      case "armL":
        if (now - lastArmClickAt.R < CONFIG.easterEggs.bothArmsWindowMs) {
          animator.clap();
        } else {
          animator.wave();
        }
        lastArmClickAt.L = now;
        break;
      case "armR":
        if (now - lastArmClickAt.L < CONFIG.easterEggs.bothArmsWindowMs) {
          animator.clap();
        } else {
          animator.thumbsUp();
        }
        lastArmClickAt.R = now;
        break;
      case "legL":
        animator.liftFoot("L");
        break;
      case "legR":
        animator.liftFoot("R");
        break;
      case "footL":
      case "footR":
        animator.hop();
        break;
      case "body":
        animator.giggleBounce();
        emotion.set("excited", { autoRevertMs: 1400 });
        break;
      case "tablet": {
        const topic = CONFIG.hologramTopics[Math.floor(Math.random() * CONFIG.hologramTopics.length)];
        animator.showHologram(topic, 2600);
        emotion.set("thinking", { autoRevertMs: 2600 });
        speaker.say(`Showing ${topic.toUpperCase()} overview`, 2200);
        break;
      }
      default:
        return;
    }
  }

  function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0 && e.pointerType === "mouse") return;
    state.markActivity();
    pointerDown = true;
    dragging = false;
    downX = e.clientX;
    downY = e.clientY;
    canvas.setPointerCapture?.(e.pointerId);

    longPressTimer = setTimeout(() => {
      if (pointerDown && !dragging && !sitting) {
        sitting = true;
        animator.sitDown(() => {
          setTimeout(() => {
            animator.yawn();
            setTimeout(() => {
              animator.standUp();
              sitting = false;
            }, 1400);
          }, 300);
        });
      }
    }, CONFIG.timing.longPressMs);
  }

  function onPointerMove(e) {
    if (!pointerDown) return;
    const dx = e.clientX - downX;
    const dy = e.clientY - downY;
    const dist = Math.hypot(dx, dy);
    if (!dragging && dist > 6) {
      dragging = true;
      clearTimeout(longPressTimer);
    }
    if (dragging) {
      const wpp = worldPerPixel();
      const maxOffset = 0.9;
      const x = Math.max(-maxOffset, Math.min(maxOffset, dx * wpp));
      const y = Math.max(-maxOffset, Math.min(maxOffset, -dy * wpp));
      parts.group.position.x = x;
      parts.group.position.y = y;
      animator.dragTilt(dx);
    }
  }

  function onPointerUp(e) {
    clearTimeout(longPressTimer);
    if (!pointerDown) return;
    pointerDown = false;

    if (dragging) {
      dragging = false;
      animator.dragRelease(0, 0);
      return;
    }

    const now = performance.now();
    const isDoubleClick = now - lastPointerUpAt < CONFIG.timing.doubleClickWindowMs;
    lastPointerUpAt = now;

    if (isDoubleClick) {
      if (state.asleep) return;
      animator.celebrate(() => speaker.confetti());
      emotion.set("excited", { autoRevertMs: 1800 });
      audio.happy();
      speaker.say("Yay! 🎉", 2200);
      return;
    }

    const part = pickPart(e.clientX, e.clientY);
    if (!part) return;
    const count = state.registerClick();
    reactToPart(part);
    if (count === CONFIG.easterEggs.clickCount) {
      setTimeout(() => {
        animator.dance();
        emotion.set("excited", { autoRevertMs: 2000 });
        audio.yay();
        speaker.say("Whee! You found my dance! 🕺", 2600);
      }, 500);
    }
  }

  function onPointerCancel() {
    pointerDown = false;
    dragging = false;
    clearTimeout(longPressTimer);
  }

  canvas.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerCancel);

  // ---------- global cursor follow ("approaches" + idle random look) ----------
  // Head/eyes only, capped at CONFIG.cursorFollow.maxAngleDeg — see animation.js.
  let cursorRaf = null;
  window.addEventListener(
    "pointermove",
    (e) => {
      state.markActivity();
      if (cursorRaf) return;
      cursorRaf = requestAnimationFrame(() => {
        cursorRaf = null;
        const rect = canvas.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const dist = Math.hypot(dx, dy);
        const approachRadius = CONFIG.cursorFollow.approachRadiusPx;
        if (dist < approachRadius && !animator.isBusy() && !sitting && !state.asleep) {
          state.setCursor(dx, dy, true);
          animator.lookAt(Math.max(-1, Math.min(1, dx / approachRadius)), Math.max(-1, Math.min(1, dy / approachRadius)));
        } else if (state.cursor.active) {
          state.setCursor(0, 0, false);
          if (!animator.isBusy()) animator.returnHeadToRest(0.8);
        }
      });
    },
    { passive: true }
  );

  // ---------- keyboard accessibility ----------
  container.addEventListener("keydown", (e) => {
    state.markActivity();
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!animator.isBusy()) {
        animator.greetWave();
        speaker.say(CONFIG.greetings[Math.floor(Math.random() * CONFIG.greetings.length)]);
      }
    } else if (e.key === "Escape") {
      speaker.hide();
    }
  });

  // ---------- Konami code (global) ----------
  let konamiIdx = 0;
  window.addEventListener("keydown", (e) => {
    state.markActivity();
    const seq = CONFIG.easterEggs.konamiSequence;
    const expected = seq[konamiIdx];
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (key === expected) {
      konamiIdx += 1;
      if (konamiIdx === seq.length) {
        konamiIdx = 0;
        state.triggerSuperhero();
        animator.superheroTransform();
        emotion.set("excited", { autoRevertMs: 3000 });
        speaker.say("Superhero mode activated! 🦸", 3200);
      }
    } else {
      konamiIdx = key === seq[0] ? 1 : 0;
    }
  });

  // ---------- hover-awareness on page elements ----------
  document.addEventListener(
    "pointerover",
    (e) => {
      const cta = e.target.closest?.(CONFIG.ctaSelectors);
      const target = cta || e.target.closest?.(CONFIG.hoverAwareness.selectors);
      if (!target || animator.isBusy() || sitting || state.asleep) return;
      const now = performance.now();
      if (now - lastPointCooldown < 1200) return;
      lastPointCooldown = now;
      const rect = canvas.getBoundingClientRect();
      const robotCx = rect.left + rect.width / 2;
      const targetRect = target.getBoundingClientRect();
      const targetCx = targetRect.left + targetRect.width / 2;
      animator.pointTo(targetCx < robotCx ? -1 : 1);
      if (cta) emotion.set("listening", { autoRevertMs: 1600 });
    },
    { passive: true }
  );

  // ---------- CTA click celebration (non-blocking — never hijacks navigation) ----------
  // Form submit buttons are excluded here: a click doesn't mean success (the
  // form could fail validation or the request could error) — the contact
  // form instead calls window.iTechRobot.celebrate() itself on a real 201,
  // see js/main.js. This handler covers plain navigational CTAs.
  document.addEventListener(
    "click",
    (e) => {
      const cta = e.target.closest?.(CONFIG.ctaSelectors);
      if (!cta || cta.matches('button[type="submit"]') || state.asleep) return;
      state.markActivity();
      if (!animator.isBusy()) {
        animator.celebrate(() => speaker.confetti());
        emotion.set("excited", { autoRevertMs: 1800 });
        audio.success();
      }
    },
    { passive: true }
  );

  // ---------- scroll reaction ----------
  let lastScrollY = window.scrollY;
  let scrollEndTimer = null;
  window.addEventListener(
    "scroll",
    () => {
      state.markActivity();
      const y = window.scrollY;
      const dir = y > lastScrollY ? 1 : -1;
      lastScrollY = y;
      if (!animator.isBusy() && !sitting && !state.asleep && !state.cursor.active) {
        animator.lookAt(0, dir * 0.35);
      }
      clearTimeout(scrollEndTimer);
      scrollEndTimer = setTimeout(() => {
        if (!animator.isBusy() && !sitting && !state.asleep && !state.cursor.active) animator.returnHeadToRest(0.7);
        // Reading the About page: point toward the page content a little more often.
        const pointChance = state.currentSection === "about" ? 0.25 : 0.12;
        if (Math.random() < pointChance && !animator.isBusy() && !sitting && !state.asleep) animator.pointTo(dir);
      }, 180);
    },
    { passive: true }
  );

  // ---------- section awareness ----------
  const sections = document.querySelectorAll("section[id], [data-robot-section]");
  if (sections.length && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((en) => en.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) {
          const id = visible.target.dataset.robotSection || visible.target.id;
          if (CONFIG.sectionMessages[id]) state.setSection(id);
        }
      },
      { threshold: [0.4, 0.6] }
    );
    sections.forEach((s) => io.observe(s));
  }

  // ---------- idle-sleep / wake ----------
  const sleepCheckInterval = setInterval(() => {
    if (state.asleep || animator.isBusy() || sitting) return;
    if (performance.now() - state.lastActivityAt > CONFIG.timing.idleSleepMs) {
      state.markAsleep();
    }
  }, 2000);

  return {
    destroy() {
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
      clearInterval(sleepCheckInterval);
    },
  };
}
