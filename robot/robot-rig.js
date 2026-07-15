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
  }

  const neck = pivot("neck", torso, 0, S.torsoH, 0);
  {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(S.neckR, S.neckR * 1.05, S.neckH * 2.4, 12), joint);
    m.position.set(0, S.neckH, 0);
    neck.add(m);
  }

  const head = pivot("head", neck, 0, S.neckH * 2, 0);
  {
    const m = new THREE.Mesh(new THREE.SphereGeometry(S.headR, 24, 18), shell);
    m.position.set(0, S.headR * 0.95, 0);
    head.add(m);
    // visor band across the face for a friendly "AI face" read
    const visorBand = new THREE.Mesh(
      new THREE.SphereGeometry(S.headR * 1.001, 24, 18, 0, Math.PI * 2, Math.PI * 0.32, Math.PI * 0.3),
      visor
    );
    visorBand.position.copy(m.position);
    head.add(visorBand);
  }
  const eyeY = S.headR * 0.98;
  const eyeZ = S.headR * 0.92;
  const eyeX = S.headR * 0.4;
  const eyeSize = S.headR * 0.16;

  function buildEye(name, x) {
    const eye = pivot(name, head, x, eyeY, eyeZ);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(eyeSize, 16), eyeGlowMat);
    glow.position.set(0, 0, 0.002);
    eye.add(glow);
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
  function buildArm(side, signX) {
    const shoulderX = signX * (S.torsoW * 0.52);
    const upper = pivot(`arm${side}_upper`, torso, shoulderX, S.torsoH * 0.86, 0);
    {
      const shoulderCap = new THREE.Mesh(new THREE.SphereGeometry(S.upperArmR * 1.05, 14, 12), trim);
      upper.add(shoulderCap);
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
      const m = new THREE.Mesh(new THREE.SphereGeometry(S.handR, 14, 12), shell);
      m.position.set(0, -S.handR * 0.6, 0);
      hand.add(m);
    }
    const fingers = pivot(`fingers${side}`, hand, 0, -S.handR * 1.15, S.handR * 0.25);
    {
      for (let i = -1; i <= 1; i++) {
        const f = new THREE.Mesh(new THREE.CapsuleGeometry(S.fingerR, S.fingerLen, 3, 6), shell);
        f.position.set(i * S.fingerR * 2.6, -S.fingerLen / 2, 0);
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
      const m = new THREE.Mesh(new THREE.BoxGeometry(S.footW, S.footH, S.footD), trim);
      m.position.set(0, -S.footH / 2, S.footD * 0.18);
      foot.add(m);
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

  return { group, bones, boundingSize: size, materials: { shell, shellShadow, tabletScreen: tabletScreenMat } };
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
