// iTech Cambodia — AI Robot Mascot — interaction layer
// Pointer (mouse+touch+pen unified via Pointer Events), keyboard, raycasting
// per body part, drag, double-click, long-press, hover-awareness on page
// elements, scroll reaction, section awareness, and easter eggs.

import * as THREE from "./vendor/three.module.min.js";
import { CONFIG } from "./config.js";
import { state } from "./state.js";

const gsap = window.gsap;
const deg2rad = Math.PI / 180;

export function createInteraction(ctx, animator, speaker) {
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
    if (animator.isBusy() || sitting) return;
    const now = performance.now();
    switch (part) {
      case "head":
        animator.nod();
        break;
      case "face":
        animator.faceExpression(["smile", "surprised", "laugh"][Math.floor(Math.random() * 3)]);
        break;
      case "armL":
        if (now - lastArmClickAt.R < CONFIG.easterEggs.bothArmsWindowMs) {
          animator.clap();
        } else {
          [animator.wave, animator.thumbsUp, () => animator.pointTo(-1)][Math.floor(Math.random() * 3)]();
        }
        lastArmClickAt.L = now;
        break;
      case "armR":
        if (now - lastArmClickAt.L < CONFIG.easterEggs.bothArmsWindowMs) {
          animator.clap();
        } else {
          [animator.wave, animator.thumbsUp, () => animator.pointTo(1)][Math.floor(Math.random() * 3)]();
        }
        lastArmClickAt.R = now;
        break;
      case "legL":
        [() => animator.kick("L"), () => animator.liftFoot("L"), animator.dance][Math.floor(Math.random() * 3)]();
        break;
      case "legR":
        [() => animator.kick("R"), () => animator.liftFoot("R"), animator.dance][Math.floor(Math.random() * 3)]();
        break;
      case "body":
        [animator.giggleBounce, animator.spinBody][Math.floor(Math.random() * 2)]();
        break;
      case "tablet": {
        const topic = CONFIG.hologramTopics[Math.floor(Math.random() * CONFIG.hologramTopics.length)];
        animator.showHologram(topic, 2600);
        speaker.say(`Showing ${topic.toUpperCase()} overview`, 2200);
        break;
      }
      default:
        return;
    }
  }

  function onPointerDown(e) {
    if (e.button !== undefined && e.button !== 0 && e.pointerType === "mouse") return;
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
      animator.celebrate(() => speaker.confetti());
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
  let cursorRaf = null;
  window.addEventListener(
    "pointermove",
    (e) => {
      if (cursorRaf) return;
      cursorRaf = requestAnimationFrame(() => {
        cursorRaf = null;
        const rect = canvas.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const dist = Math.hypot(dx, dy);
        const approachRadius = 420;
        if (dist < approachRadius && !animator.isBusy() && !sitting) {
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
    const seq = CONFIG.easterEggs.konamiSequence;
    const expected = seq[konamiIdx];
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (key === expected) {
      konamiIdx += 1;
      if (konamiIdx === seq.length) {
        konamiIdx = 0;
        state.triggerSuperhero();
        animator.superheroTransform();
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
      const target = e.target.closest?.(CONFIG.hoverAwareness.selectors);
      if (!target || animator.isBusy() || sitting) return;
      const now = performance.now();
      if (now - lastPointCooldown < 1200) return;
      lastPointCooldown = now;
      const rect = canvas.getBoundingClientRect();
      const robotCx = rect.left + rect.width / 2;
      const targetRect = target.getBoundingClientRect();
      const targetCx = targetRect.left + targetRect.width / 2;
      animator.pointTo(targetCx < robotCx ? -1 : 1);
    },
    { passive: true }
  );

  // ---------- scroll reaction ----------
  let lastScrollY = window.scrollY;
  let scrollEndTimer = null;
  window.addEventListener(
    "scroll",
    () => {
      const y = window.scrollY;
      const dir = y > lastScrollY ? 1 : -1;
      lastScrollY = y;
      if (!animator.isBusy() && !sitting && !state.cursor.active) {
        animator.lookAt(0, dir * 0.35);
      }
      clearTimeout(scrollEndTimer);
      scrollEndTimer = setTimeout(() => {
        if (!animator.isBusy() && !sitting && !state.cursor.active) animator.returnHeadToRest(0.7);
        if (Math.random() < 0.12 && !animator.isBusy() && !sitting) animator.pointTo(dir);
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

  return {
    destroy() {
      canvas.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerCancel);
    },
  };
}
