// iTech Cambodia — AI Robot Mascot — 3D rig
// Builds a real Three.js scene-graph skeleton: every bone in
// config.js#BONE_NAMES is its own Object3D "pivot" (joint), with a rigid
// visual mesh hanging off it and the next bone in the chain parented at the
// joint below. Rotating a pivot moves everything below it — a classic
// forward-kinematic rig, no vertex skinning needed since every part here is
// rigid geometry (only the flat PNG lost its parts; nothing here deforms).
//
// TWO RENDERERS, ONE CONTRACT: buildProceduralRig() draws the skeleton with
// primitive geometry colored from assets/robot.png's own palette (see
// config.js#palette) as a stand-in for real art. loadGlbRig() below loads an
// actual .glb (once you have one) through the vendored GLTFLoader and reads
// its bones *by name* — so both functions return the exact same shape:
//   { group, bones }
// `group` is the Object3D to add to the scene; `bones` is a plain object
// keyed by every name in BONE_NAMES. robot-animation.js and robot.js only
// ever touch `rig.bones.<name>` — they cannot tell which renderer built it.

import { CONFIG, BONE_NAMES, PART_TO_BONES } from "./config.js";

function boneToPart(boneName) {
  for (const [part, names] of Object.entries(PART_TO_BONES)) {
    if (names.includes(boneName)) return part;
  }
  return null;
}

/** Tags every mesh under `bone` with the click-part it belongs to. */
function tagSubtree(bone, part) {
  bone.traverse((obj) => {
    if (obj.isMesh) obj.userData.part = part;
  });
}

export function buildProceduralRig(THREE) {
  const P = CONFIG.palette;
  const materials = new Map();
  function mat(hex, opts = {}) {
    const key = `${hex}|${opts.metalness ?? 0.18}|${opts.roughness ?? 0.42}|${opts.emissive ?? ""}|${opts.emissiveIntensity ?? 1}`;
    let m = materials.get(key);
    if (m) return m;
    m = new THREE.MeshStandardMaterial({
      color: hex,
      metalness: opts.metalness ?? 0.18,
      roughness: opts.roughness ?? 0.42,
    });
    if (opts.emissive != null) {
      m.emissive = new THREE.Color(opts.emissive);
      m.emissiveIntensity = opts.emissiveIntensity ?? 1;
    }
    materials.set(key, m);
    return m;
  }

  const shell = mat(P.shellLight, { metalness: 0.15, roughness: 0.4, emissive: P.eyeGlow, emissiveIntensity: 0 });
  const shellShadow = mat(P.shellShadow, { metalness: 0.15, roughness: 0.45, emissive: P.eyeGlow, emissiveIntensity: 0 });
  const visor = mat(P.visorDark, { metalness: 0.35, roughness: 0.25 });
  const trim = mat(P.trimNavy, { metalness: 0.3, roughness: 0.35 });
  const joint = mat(P.jointNavy, { metalness: 0.4, roughness: 0.3 });
  const eyeGlowMat = mat(P.eyeGlow, { metalness: 0, roughness: 0.5, emissive: P.eyeGlow, emissiveIntensity: 1.4 });
  const highlightMat = mat(0xffffff, { metalness: 0, roughness: 0.3, emissive: 0xffffff, emissiveIntensity: 0.9 });
  const accentMat = mat(P.accentOrange, { metalness: 0, roughness: 0.4, emissive: P.accentOrange, emissiveIntensity: 0.55 });
  const tabletBody = mat(P.trimNavyDark, { metalness: 0.3, roughness: 0.4 });
  const tabletScreenMat = mat(P.tabletScreen, {
    metalness: 0,
    roughness: 0.4,
    emissive: P.tabletGlow,
    emissiveIntensity: 0.35,
  });

  // ---------- proportions (arbitrary units, recentered + framed later) ----------
  // Chunky/chibi on purpose: big head, thick stubby limbs, wide torso — a
  // "fat and bigger" cute-mascot read rather than a slender human rig.
  const S = {
    headR: 0.23,
    neckH: 0.03,
    neckR: 0.06,
    torsoH: 0.32,
    torsoW: 0.4,
    torsoD: 0.26,
    hipW: 0.32,
    hipH: 0.1,
    hipD: 0.24,
    upperArmLen: 0.15,
    upperArmR: 0.075,
    foreArmLen: 0.13,
    foreArmR: 0.065,
    handR: 0.075,
    fingerLen: 0.045,
    fingerR: 0.014,
    upperLegLen: 0.17,
    upperLegR: 0.09,
    lowerLegLen: 0.15,
    lowerLegR: 0.075,
    footW: 0.13,
    footH: 0.045,
    footD: 0.19,
    tabletW: 0.17,
    tabletH: 0.11,
    tabletD: 0.014,
  };

  const bones = {};
  function pivot(name, parent, x, y, z) {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(x, y, z);
    parent.add(g);
    bones[name] = g;
    return g;
  }
  function capsule(radius, len, material) {
    const straight = Math.max(0.01, len - radius * 2);
    return new THREE.Mesh(new THREE.CapsuleGeometry(radius, straight, 4, 8), material);
  }

  const group = new THREE.Group();
  const rigRoot = new THREE.Group();
  group.add(rigRoot);

  // ---------- hip (pelvis) — root of the chain ----------
  const legTotal = S.upperLegLen + S.lowerLegLen + S.footH;
  const hip = pivot("hip", rigRoot, 0, legTotal, 0);
  {
    const m = new THREE.Mesh(new THREE.BoxGeometry(S.hipW, S.hipH, S.hipD), trim);
    m.position.set(0, 0, 0);
    hip.add(m);
  }

  // ---------- torso / neck / head ----------
  const torso = pivot("torso", hip, 0, S.hipH * 0.5, 0);
  {
    const m = capsule(S.torsoW * 0.5, S.torsoH, shell);
    m.position.set(0, S.torsoH * 0.5, 0);
    torso.add(m);
    const chest = new THREE.Mesh(new THREE.CircleGeometry(S.torsoW * 0.22, 20), trim);
    chest.position.set(0, S.torsoH * 0.55, S.torsoD * 0.5 + 0.001);
    torso.add(chest);
    const chestDot = new THREE.Mesh(new THREE.CircleGeometry(S.torsoW * 0.035, 12), accentMat);
    chestDot.position.set(-S.torsoW * 0.17, S.torsoH * 0.63, S.torsoD * 0.5 + 0.002);
    torso.add(chestDot);
  }

  const neck = pivot("neck", torso, 0, S.torsoH, 0);
  {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(S.neckR, S.neckR * 1.05, S.neckH * 2.4, 12), joint);
    m.position.set(0, S.neckH, 0);
    neck.add(m);
  }

  const headY = S.headR * 0.95;
  const head = pivot("head", neck, 0, S.neckH * 2, 0);
  {
    const m = new THREE.Mesh(new THREE.SphereGeometry(S.headR, 28, 20), shell);
    m.position.set(0, headY, 0);
    head.add(m);

    // face visor — a flattened rounded plaque (a sideways capsule has
    // naturally rounded left/right edges, unlike a plain box) set into the
    // front of the head, matching the reference art's dark screen-face.
    const visorW = S.headR * 1.28;
    const visorH = S.headR * 0.88;
    const visorPlaque = new THREE.Mesh(
      new THREE.CapsuleGeometry(visorH / 2, Math.max(0.001, visorW - visorH), 4, 14),
      visor
    );
    visorPlaque.rotation.z = Math.PI / 2;
    visorPlaque.scale.z = 0.22;
    visorPlaque.position.set(0, headY, S.headR * 0.88);
    head.add(visorPlaque);

    // brow ridge — small raised bump on top of the head, like the reference
    const brow = new THREE.Mesh(new THREE.BoxGeometry(S.headR * 0.55, S.headR * 0.14, S.headR * 0.5), shell);
    brow.position.set(0, headY + S.headR * 0.92, S.headR * 0.25);
    brow.rotation.x = -0.12;
    head.add(brow);

    // ears — ring pods on each side of the head
    for (const side of [-1, 1]) {
      const earX = side * S.headR * 1.02;
      const earY = headY - S.headR * 0.05;
      const earCup = new THREE.Mesh(new THREE.CylinderGeometry(S.headR * 0.26, S.headR * 0.26, S.headR * 0.1, 20), visor);
      earCup.rotation.z = Math.PI / 2;
      earCup.position.set(earX, earY, 0);
      head.add(earCup);
      const earRing = new THREE.Mesh(new THREE.TorusGeometry(S.headR * 0.17, S.headR * 0.032, 8, 20), eyeGlowMat);
      earRing.rotation.y = Math.PI / 2;
      earRing.position.set(earX + side * S.headR * 0.052, earY, 0);
      head.add(earRing);
    }
  }
  const eyeY = headY + S.headR * 0.06;
  const eyeZ = S.headR * 0.97;
  const eyeX = S.headR * 0.36;
  const eyeSize = S.headR * 0.21;

  function buildEye(name, x) {
    const eye = pivot(name, head, x, eyeY, eyeZ);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(eyeSize, 20), eyeGlowMat);
    glow.scale.set(0.85, 1, 1);
    eye.add(glow);
    const highlight = new THREE.Mesh(new THREE.CircleGeometry(eyeSize * 0.26, 12), highlightMat);
    highlight.position.set(-eyeSize * 0.3, eyeSize * 0.3, 0.003);
    eye.add(highlight);
    return eye;
  }
  buildEye("eyeL", -eyeX);
  buildEye("eyeR", eyeX);

  function buildEyelid(name, x) {
    const lid = pivot(name, head, x, eyeY, eyeZ + 0.003);
    const m = new THREE.Mesh(new THREE.CircleGeometry(eyeSize * 1.15, 16), visor);
    lid.add(m);
    lid.scale.set(1, 0.05, 1); // 0.05≈open (barely visible sliver), 1≈closed
    return lid;
  }
  buildEyelid("eyelidL", -eyeX);
  buildEyelid("eyelidR", eyeX);

  const mouth = pivot("mouth", head, 0, S.headR * 0.55, eyeZ + 0.01);
  {
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(S.headR * 0.045, S.headR * 0.28, 4, 6), visor);
    m.rotation.z = Math.PI / 2;
    mouth.add(m);
  }

  // ---------- arms (shared builder, mirrored by sign of x) ----------
  // Joint collars (flattened cylinders around each limb, ring-like) mark
  // shoulder/elbow/wrist the way the reference art shows dark segment
  // rings, and hands/feet are built oversized on purpose — a cute mascot
  // reads "friendly" with big paws/boots, not anatomically slender ones.
  function jointCollar(radius) {
    return new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.22, radius * 1.22, radius * 0.55, 16), joint);
  }
  function buildArm(side, signX) {
    const shoulderX = signX * (S.torsoW * 0.52);
    const upper = pivot(`arm${side}_upper`, torso, shoulderX, S.torsoH * 0.86, 0);
    {
      upper.add(jointCollar(S.upperArmR));
      const m = capsule(S.upperArmR, S.upperArmLen, shell);
      m.position.set(0, -S.upperArmLen / 2, 0);
      upper.add(m);
    }
    const fore = pivot(`arm${side}_fore`, upper, 0, -S.upperArmLen, 0);
    {
      const elbow = new THREE.Mesh(new THREE.SphereGeometry(S.foreArmR * 1.05, 12, 10), joint);
      fore.add(elbow);
      const m = capsule(S.foreArmR, S.foreArmLen, shellShadow);
      m.position.set(0, -S.foreArmLen / 2, 0);
      fore.add(m);
    }
    const hand = pivot(`arm${side}_hand`, fore, 0, -S.foreArmLen, 0);
    {
      hand.add(jointCollar(S.foreArmR * 0.9));
      // oversized rounded paw/mitten
      const palm = new THREE.Mesh(new THREE.SphereGeometry(S.handR, 16, 14), shell);
      palm.scale.set(1, 0.95, 0.85);
      palm.position.set(0, -S.handR * 0.7, S.handR * 0.08);
      hand.add(palm);
    }
    const fingers = pivot(`fingers${side}`, hand, 0, -S.handR * 1.3, S.handR * 0.32);
    {
      for (let i = -1; i <= 1; i++) {
        const f = new THREE.Mesh(new THREE.CapsuleGeometry(S.fingerR, S.fingerLen, 3, 6), shell);
        f.position.set(i * S.fingerR * 2.8, -S.fingerLen / 2, 0);
        fingers.add(f);
      }
    }
    return { upper, fore, hand, fingers };
  }
  buildArm("L", -1);
  buildArm("R", 1);

  // ---------- tablet, held in the left hand ----------
  const tablet = pivot("tablet", bones.armL_hand, 0, -S.handR * 0.7, S.handR + S.tabletD);
  {
    const body = new THREE.Mesh(new THREE.BoxGeometry(S.tabletW, S.tabletH, S.tabletD), tabletBody);
    tablet.add(body);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(S.tabletW * 0.82, S.tabletH * 0.78), tabletScreenMat);
    screen.position.set(0, 0, S.tabletD / 2 + 0.001);
    screen.name = "tabletScreen";
    tablet.add(screen);
    tablet.rotation.x = -0.25;
    tablet.userData.screenMaterial = tabletScreenMat;
  }

  // ---------- legs (shared builder, mirrored by sign of x) ----------
  function buildLeg(side, signX) {
    const hipX = signX * (S.hipW * 0.28);
    const upper = pivot(`leg${side}_upper`, hip, hipX, -S.hipH * 0.1, 0);
    {
      upper.add(jointCollar(S.upperLegR));
      const m = capsule(S.upperLegR, S.upperLegLen, shell);
      m.position.set(0, -S.upperLegLen / 2, 0);
      upper.add(m);
    }
    const lower = pivot(`leg${side}_lower`, upper, 0, -S.upperLegLen, 0);
    {
      const knee = new THREE.Mesh(new THREE.SphereGeometry(S.lowerLegR * 1.02, 12, 10), joint);
      lower.add(knee);
      const m = capsule(S.lowerLegR, S.lowerLegLen, shellShadow);
      m.position.set(0, -S.lowerLegLen / 2, 0);
      lower.add(m);
    }
    const foot = pivot(`foot${side}`, lower, 0, -S.lowerLegLen, 0);
    {
      foot.add(jointCollar(S.lowerLegR * 0.95));
      // oversized rounded boot: tapered cylinder (ankle -> wide base) + flat
      // sole + a glowing strip along the front, echoing the reference art.
      const boot = new THREE.Mesh(
        new THREE.CylinderGeometry(S.lowerLegR * 0.9, S.footW * 0.56, S.footH * 1.7, 14),
        shell
      );
      boot.position.set(0, -S.footH * 0.85, S.footD * 0.06);
      foot.add(boot);
      const sole = new THREE.Mesh(new THREE.BoxGeometry(S.footW, S.footH * 0.55, S.footD), trim);
      sole.position.set(0, -S.footH * 1.7, S.footD * 0.18);
      foot.add(sole);
      const glow = new THREE.Mesh(new THREE.BoxGeometry(S.footW * 0.62, S.footH * 0.16, S.footD * 0.5), eyeGlowMat);
      glow.position.set(0, -S.footH * 1.95, S.footD * 0.16);
      foot.add(glow);
    }
    return { upper, lower, foot };
  }
  buildLeg("L", -1);
  buildLeg("R", 1);

  // ---------- tag every mesh with its clickable part ----------
  for (const name of BONE_NAMES) {
    const bone = bones[name];
    if (!bone) continue;
    const part = boneToPart(name);
    if (part) tagSubtree(bone, part);
  }

  // ---------- recenter so (0,0,0) is the rig's visual center, independent
  // of the exact proportions above — camera framing never needs updating
  // when S.* is retuned.
  const box = new THREE.Box3().setFromObject(rigRoot);
  const center = box.getCenter(new THREE.Vector3());
  rigRoot.position.sub(center);
  const size = box.getSize(new THREE.Vector3());

  return {
    group,
    bones,
    boundingSize: size,
    materials: { shell, shellShadow, tabletScreen: tabletScreenMat, eyeGlow: eyeGlowMat },
  };
}

/**
 * Loads a real .glb and binds it to the same { group, bones } contract as
 * buildProceduralRig(). Requires every bone in BONE_NAMES to exist as a
 * named node in the file (Object3D, Bone or Group — any type works, only
 * the name matters). Throws if any are missing so the caller can fall back
 * to the procedural rig instead of shipping a half-broken mascot.
 */
export async function loadGlbRig(THREE, url) {
  const { GLTFLoader } = await import("./vendor/GLTFLoader.js");
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url);
  const group = gltf.scene || gltf.scenes[0];

  const bones = {};
  group.traverse((obj) => {
    if (BONE_NAMES.includes(obj.name)) bones[obj.name] = obj;
  });

  const missing = BONE_NAMES.filter((n) => !bones[n]);
  if (missing.length) {
    throw new Error(`robot.glb is missing required bone(s): ${missing.join(", ")}`);
  }

  for (const name of BONE_NAMES) {
    const part = boneToPart(name);
    if (part) tagSubtree(bones[name], part);
  }

  const tabletScreen = bones.tablet?.getObjectByName("tabletScreen");
  if (tabletScreen) bones.tablet.userData.screenMaterial = tabletScreen.material;

  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());

  return { group, bones, boundingSize: size };
}

/**
 * Loads a single fused (non-rigged) .glb — e.g. a Blender/AI-generated
 * export with no skeleton — as the mascot's visual. It cannot satisfy the
 * real BONE_NAMES contract (nothing to independently move), so every bone
 * is a harmless inert placeholder Object3D instead: gesture code in
 * robot-animation.js can still call `bones.armR_upper.rotation...` without
 * throwing, it just has no visible effect. `isStatic: true` tells
 * createAnimator() to use its whole-body gesture set (built on the shared
 * floater/tilter wrappers, same as any rig) instead of per-bone gestures.
 *
 * Use this for a nicer-looking placeholder while waiting on a properly
 * rigged export; switch to loadGlbRig() the moment one exists — nothing
 * else in the codebase needs to change either time.
 */
export async function loadStaticGlbRig(THREE, url) {
  const { GLTFLoader } = await import("./vendor/GLTFLoader.js");
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(url);
  const loaded = gltf.scene || gltf.scenes[0];

  // These Blender/AI exports bake the model's real colors into an
  // emissive texture with baseColorFactor zeroed out — a "shadeless" trick
  // so the paint job looks right in any viewer regardless of its lights.
  // Left as MeshStandardMaterial, our own scene lights (hemisphere + key +
  // fill + rim, added so the *procedural* rig reads with depth) still mix
  // their own specular/ambient response into an all-black-diffuse surface
  // and wash the paint out to a flat white silhouette. Swapping to
  // MeshBasicMaterial makes the mesh fully unlit — it always shows exactly
  // the texture pixels, immune to whatever lighting the scene has.
  loaded.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.userData.part = "torso"; // any click -> a generic whole-body reaction
    const src = obj.material;
    const paint = src?.emissiveMap || src?.map;
    if (paint) {
      obj.material = new THREE.MeshBasicMaterial({ map: paint, side: src.side });
      src.dispose();
    }
  });

  // The export's own origin is whatever Blender's object origin happened
  // to be (often the feet, or an arbitrary point) — recenter the same way
  // buildProceduralRig() does so the camera's lookAt(0,0,0) actually frames
  // the model instead of an off-center crop.
  const group = new THREE.Group();
  group.add(loaded);
  const preBox = new THREE.Box3().setFromObject(loaded);
  loaded.position.sub(preBox.getCenter(new THREE.Vector3()));

  const bones = {};
  for (const name of BONE_NAMES) {
    const placeholder = new THREE.Group();
    placeholder.name = name;
    group.add(placeholder);
    bones[name] = placeholder;
  }

  const box = new THREE.Box3().setFromObject(group);
  const size = box.getSize(new THREE.Vector3());

  return { group, bones, boundingSize: size, materials: null, isStatic: true };
}
