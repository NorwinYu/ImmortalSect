import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clamp, lerp } from '../core/math';

const SKIN = '#d9ad88';
const HAIR = '#171310';
const ROBE = '#e6dac4';
const TEAL = '#355e5a';
const TEAL_DARK = '#264743';
const DARK = '#2a2520';

export type PoseKind =
  | 'attack1'
  | 'attack2'
  | 'attack3'
  | 'heavy'
  | 'dodge'
  | 'hit'
  | 'execute'
  | 'cast'
  | 'victory'
  | 'defeat';

export interface CharacterRig {
  group: THREE.Group;
  update: (dt: number, speed: number, grounded: boolean, time: number, combat?: boolean) => void;
  playPose: (kind: PoseKind, t: number) => void;
  setSwordDrawn: (on: boolean) => void;
}

function mat(color: string, roughness = 0.8, metalness = 0.0): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

function smooth(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

/**
 * Merge the static direct meshes of a group by material. Child groups (arms,
 * legs, head, sheaths, swords) are left intact so their transforms still
 * animate; the merged meshes remain inside the same group.
 */
function mergeStaticChildren(group: THREE.Group): void {
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  for (const child of [...group.children]) {
    if (!(child instanceof THREE.Mesh)) continue;
    if (Array.isArray(child.material)) continue;
    child.updateMatrix();
    const geo = child.geometry.clone();
    geo.applyMatrix4(child.matrix);
    const list = buckets.get(child.material);
    if (list) list.push(geo);
    else buckets.set(child.material, [geo]);
    group.remove(child);
    child.geometry.dispose();
  }
  for (const [material, geometries] of buckets) {
    const merged = mergeGeometries(geometries, false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
}

/**
 * The playable master. A layered, hand-built cultivator with a functional
 * sword rig and a small library of procedural combat poses.
 */
export function createCharacter(): CharacterRig {
  const group = new THREE.Group();
  group.name = 'master';

  const body = new THREE.Group();
  group.add(body);

  const robeMat = mat(ROBE, 0.86);
  const trimMat = mat(TEAL, 0.7, 0.05);
  const darkTrimMat = mat(TEAL_DARK, 0.78);
  const skinMat = mat(SKIN, 0.72);
  const hairMat = mat(HAIR, 0.65);
  const darkMat = mat(DARK, 0.85);
  const goldMat = new THREE.MeshStandardMaterial({
    color: '#c8a15a',
    roughness: 0.3,
    metalness: 0.7,
  });
  const steelMat = new THREE.MeshStandardMaterial({
    color: '#dfe8ee',
    roughness: 0.22,
    metalness: 0.82,
    emissive: '#1a242c',
    emissiveIntensity: 0.35,
  });

  // ————————————————— 内袍 —————————————————
  const robePoints = [
    new THREE.Vector2(0.31, 0.52),
    new THREE.Vector2(0.4, 0.58),
    new THREE.Vector2(0.4, 0.68),
    new THREE.Vector2(0.34, 0.86),
    new THREE.Vector2(0.27, 1.0),
    new THREE.Vector2(0.235, 1.14),
  ];
  const robe = new THREE.Mesh(new THREE.LatheGeometry(robePoints, 24), robeMat);
  body.add(robe);

  const hem = new THREE.Mesh(new THREE.TorusGeometry(0.312, 0.018, 4, 36), trimMat);
  hem.rotation.x = Math.PI / 2;
  hem.position.y = 0.53;
  body.add(hem);

  const midTrim = new THREE.Mesh(new THREE.TorusGeometry(0.285, 0.008, 4, 32), goldMat);
  midTrim.rotation.x = Math.PI / 2;
  midTrim.position.y = 0.78;
  body.add(midTrim);

  // ————————————————— 躯干 —————————————————
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.5, 14), robeMat);
  torso.position.y = 1.28;
  body.add(torso);

  const vest = new THREE.Mesh(new THREE.CylinderGeometry(0.248, 0.29, 0.54, 16, 1, false), trimMat);
  vest.position.y = 1.26;
  body.add(vest);

  const sash = new THREE.Mesh(new THREE.CylinderGeometry(0.272, 0.272, 0.12, 14), darkTrimMat);
  sash.position.y = 1.04;
  body.add(sash);

  const knot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.06), trimMat);
  knot.position.set(0.06, 1.01, 0.26);
  body.add(knot);

  const pendant = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), goldMat);
  pendant.position.set(0.06, 0.92, 0.27);
  body.add(pendant);

  // V collar
  for (const sx of [-1, 1]) {
    const collar = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.42, 0.018), goldMat);
    collar.position.set(sx * 0.085, 1.38, 0.208);
    collar.rotation.z = sx * 0.42;
    body.add(collar);
  }

  // Shoulder mantle / short cape collar
  const mantle = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.35, 0.2, 18, 1, true),
    new THREE.MeshStandardMaterial({
      color: TEAL_DARK,
      roughness: 0.82,
      metalness: 0.05,
      side: THREE.DoubleSide,
    }),
  );
  mantle.position.y = 1.47;
  body.add(mantle);

  // Front apron panel
  const apron = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.52, 0.02), darkTrimMat);
  apron.position.set(0, 0.76, 0.315);
  apron.rotation.x = 0.04;
  body.add(apron);

  // ————————————————— 头 —————————————————
  const head = new THREE.Group();
  head.position.y = 1.58;
  body.add(head);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.062, 0.12, 8), skinMat);
  neck.position.y = -0.02;
  head.add(neck);

  const face = new THREE.Mesh(new THREE.SphereGeometry(0.135, 20, 16), skinMat);
  face.scale.set(0.93, 1.02, 0.96);
  head.add(face);

  const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 10), skinMat);
  jaw.scale.set(0.9, 0.72, 0.85);
  jaw.position.set(0, -0.055, 0.035);
  head.add(jaw);

  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.142, 18, 14), hairMat);
  hair.position.set(0, 0.025, -0.024);
  hair.scale.set(1.0, 1.0, 0.98);
  head.add(hair);

  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), hairMat);
  bun.position.set(0, 0.16, -0.1);
  bun.scale.set(0.9, 1.1, 0.9);
  head.add(bun);

  const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.22, 0.012), trimMat);
  ribbon.position.set(0.02, 0.1, -0.16);
  ribbon.rotation.z = 0.25;
  head.add(ribbon);

  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.26, 5), goldMat);
  pin.rotation.z = Math.PI / 2;
  pin.position.set(0, 0.18, -0.1);
  head.add(pin);

  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.026, 6, 5), skinMat);
    ear.position.set(sx * 0.126, 0.005, -0.005);
    ear.scale.set(0.55, 1, 0.8);
    head.add(ear);

    const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.019, 8, 6), mat('#efe6d8', 0.5));
    eyeWhite.position.set(sx * 0.047, 0.012, 0.121);
    eyeWhite.scale.set(1, 0.7, 0.5);
    head.add(eyeWhite);

    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.009, 6, 5), hairMat);
    pupil.position.set(sx * 0.047, 0.011, 0.135);
    head.add(pupil);

    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.009, 0.01), hairMat);
    brow.position.set(sx * 0.048, 0.047, 0.127);
    brow.rotation.z = sx * -0.12;
    head.add(brow);

    const sideLock = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.16, 0.025), hairMat);
    sideLock.position.set(sx * 0.115, 0.03, 0.02);
    sideLock.rotation.z = sx * 0.06;
    head.add(sideLock);
  }

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.017, 0.05, 5), skinMat);
  nose.position.set(0, -0.022, 0.132);
  nose.rotation.x = -Math.PI / 2;
  head.add(nose);

  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.008, 0.008), mat('#8f5f50', 0.7));
  mouth.position.set(0, -0.072, 0.126);
  head.add(mouth);

  // ————————————————— 手臂 —————————————————
  const arms: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(sx * 0.285, 1.45, 0);
    arm.rotation.z = sx * 0.06;
    body.add(arm);

    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.052, 0.2, 4, 10), robeMat);
    upper.position.y = -0.13;
    arm.add(upper);

    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.16, 0.36, 10), robeMat);
    sleeve.position.y = -0.36;
    arm.add(sleeve);

    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.014, 4, 20), trimMat);
    cuff.rotation.x = Math.PI / 2;
    cuff.position.y = -0.535;
    arm.add(cuff);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.054, 10, 8), skinMat);
    hand.position.y = -0.575;
    hand.scale.set(0.9, 1.1, 1);
    arm.add(hand);

    // A suggestion of fingers.
    for (let f = 0; f < 3; f++) {
      const finger = new THREE.Mesh(new THREE.CapsuleGeometry(0.011, 0.035, 2, 5), skinMat);
      finger.position.set(-0.018 + f * 0.018, -0.625, 0.024);
      arm.add(finger);
    }

    arms.push(arm);
  }

  // ————————————————— 腿 —————————————————
  const legs: THREE.Group[] = [];
  for (const sx of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(sx * 0.115, 0.86, 0);
    body.add(leg);

    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.062, 0.4, 8), darkMat);
    thigh.position.y = -0.2;
    leg.add(thigh);

    const knee = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.012, 4, 12), trimMat);
    knee.rotation.x = Math.PI / 2;
    knee.position.y = -0.42;
    leg.add(knee);

    const calf = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.38, 8), darkMat);
    calf.position.y = -0.58;
    leg.add(calf);

    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.24), darkMat);
    boot.position.set(0, -0.79, 0.05);
    leg.add(boot);

    const toe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.08), trimMat);
    toe.position.set(0, -0.815, 0.17);
    leg.add(toe);

    legs.push(leg);
  }

  // ————————————————— 背后的剑鞘 —————————————————
  const backSword = new THREE.Group();
  backSword.position.set(0.14, 1.12, -0.18);
  backSword.rotation.z = -0.42;
  backSword.rotation.x = 0.14;
  body.add(backSword);

  const sheath = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.94, 0.03), darkMat);
  backSword.add(sheath);

  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.025, 0.05), goldMat);
  guard.position.y = 0.45;
  backSword.add(guard);

  const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.2, 6), darkMat);
  hilt.position.y = 0.57;
  backSword.add(hilt);

  const pommel = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), goldMat);
  pommel.position.y = 0.68;
  backSword.add(pommel);

  const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.18, 5), mat('#8f2f28', 0.9));
  tassel.position.y = 0.41;
  tassel.rotation.z = 0.2;
  backSword.add(tassel);

  // Empty scabbard at the hip, visible only while the sword is drawn.
  const hipSheath = new THREE.Group();
  hipSheath.position.set(-0.24, 0.68, 0.03);
  hipSheath.rotation.z = 0.28;
  hipSheath.rotation.x = 0.08;
  hipSheath.visible = false;
  body.add(hipSheath);

  const hipCase = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.55, 0.028), darkMat);
  hipCase.position.y = -0.1;
  hipSheath.add(hipCase);
  const hipTip = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.06, 0.035), goldMat);
  hipTip.position.y = -0.37;
  hipSheath.add(hipTip);

  // ————————————————— 手中的剑 —————————————————
  const handSword = new THREE.Group();
  handSword.position.set(0.14, -0.575, 0.05);
  handSword.rotation.x = -0.2;
  handSword.visible = false;
  arms[1].add(handSword);

  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.98, 0.02), steelMat);
  blade.position.y = -0.5;
  handSword.add(blade);

  const edge = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.98, 0.018), mat('#e8eef1', 0.2, 0.9));
  edge.position.set(0.022, -0.5, 0);
  handSword.add(edge);

  const handGuard = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.028, 0.055), goldMat);
  handGuard.position.y = -0.02;
  handSword.add(handGuard);

  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.021, 0.021, 0.2, 6), darkMat);
  grip.position.y = 0.09;
  handSword.add(grip);

  const handPommel = new THREE.Mesh(new THREE.SphereGeometry(0.032, 6, 5), goldMat);
  handPommel.position.y = 0.2;
  handSword.add(handPommel);

  // Static parts are merged by material; animated limb/head groups stay.
  mergeStaticChildren(body);
  mergeStaticChildren(head);
  mergeStaticChildren(backSword);
  mergeStaticChildren(hipSheath);
  mergeStaticChildren(handSword);
  for (const arm of arms) mergeStaticChildren(arm);
  for (const leg of legs) mergeStaticChildren(leg);

  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  const setSwordDrawn = (on: boolean): void => {
    handSword.visible = on;
    backSword.visible = !on;
    hipSheath.visible = on;
  };

  let phase = 0;

  const update = (
    dt: number,
    speed: number,
    grounded: boolean,
    time: number,
    combat = false,
  ): void => {
    const moving = speed > 0.2;
    const gait = Math.min(speed / 5.4, 1);

    if (moving && grounded) phase += dt * (5.0 + speed * 1.45);

    const swing = moving && grounded ? Math.sin(phase) * 0.62 * gait : 0;
    legs[0].rotation.x = swing;
    legs[1].rotation.x = -swing;
    legs[0].rotation.z = 0;
    legs[1].rotation.z = 0;

    const guard = combat ? 1 : 0;
    arms[0].rotation.x = lerp(-swing * 0.75, -0.55, guard);
    arms[1].rotation.x = lerp(swing * 0.75, -1.1, guard);
    arms[0].rotation.y = 0;
    arms[1].rotation.y = lerp(0, -0.28, guard);
    arms[0].rotation.z = lerp(0.06 + Math.sin(phase) * 0.02, -0.12, guard);
    arms[1].rotation.z = lerp(-0.06 - Math.sin(phase) * 0.02, 0.42, guard);

    if (!grounded) {
      legs[0].rotation.x = 0.55;
      legs[1].rotation.x = -0.28;
      arms[0].rotation.x = -0.8;
      arms[1].rotation.x = -0.55;
    }

    const bob = moving && grounded ? Math.abs(Math.sin(phase * 2)) * 0.035 * gait : Math.sin(time * 1.7) * 0.007;
    body.position.set(0, bob - guard * 0.025, 0);
    body.rotation.set(0, 0, moving && grounded ? Math.sin(phase) * 0.018 * gait : 0);
    robe.rotation.x = moving && grounded ? Math.sin(phase * 2) * 0.028 * gait : Math.sin(time * 0.9) * 0.004;
    head.rotation.set(Math.sin(time * 0.23) * 0.02, Math.sin(time * 0.37) * 0.06, 0);
    handSword.rotation.set(-0.08, 0, 0);
  };

  const playPose = (kind: PoseKind, tRaw: number): void => {
    const t = clamp(tRaw, 0, 1);
    const s = Math.sin(Math.PI * t);

    // Reset to a neutral stance every frame; poses are absolute.
    body.position.set(0, 0, 0);
    body.rotation.set(0, 0, 0);
    arms[0].rotation.set(0, 0, 0.06);
    arms[1].rotation.set(0, 0, -0.06);
    legs[0].rotation.set(0, 0, 0);
    legs[1].rotation.set(0, 0, 0);
    head.rotation.set(0, 0, 0);
    handSword.rotation.set(-0.2, 0, 0);

    switch (kind) {
      case 'attack1': {
        const p = smooth((t - 0.18) / 0.55);
        body.rotation.y = lerp(-0.35, 0.45, p);
        arms[1].rotation.set(-1.35, lerp(-1.05, 1.15, p), -0.15);
        arms[0].rotation.set(-0.4, 0.35, 0.1);
        legs[0].rotation.x = 0.3;
        legs[1].rotation.x = -0.22;
        handSword.rotation.x = -0.08;
        break;
      }
      case 'attack2': {
        const p = smooth((t - 0.18) / 0.55);
        body.rotation.y = lerp(0.4, -0.45, p);
        arms[1].rotation.set(-1.4, lerp(1.1, -1.15, p), 0.2);
        arms[0].rotation.set(-0.35, -0.3, 0.1);
        legs[0].rotation.x = 0.24;
        legs[1].rotation.x = -0.28;
        handSword.rotation.x = -0.12;
        break;
      }
      case 'attack3': {
        const p = smooth((t - 0.25) / 0.52);
        body.rotation.x = lerp(-0.14, 0.24, p);
        arms[1].rotation.set(lerp(-2.75, -0.25, p), -0.15, -0.05);
        arms[0].rotation.set(lerp(-2.2, -0.6, p), 0.15, 0.1);
        legs[0].rotation.x = 0.35;
        legs[1].rotation.x = -0.3;
        handSword.rotation.x = -0.1;
        break;
      }
      case 'heavy': {
        const wind = smooth(t / 0.45);
        const slam = smooth((t - 0.45) / 0.28);
        body.rotation.x = lerp(-0.2, 0.35, slam);
        body.rotation.y = lerp(0, -0.25, wind) + lerp(0, 0.35, slam);
        arms[1].rotation.x = lerp(-0.4, -2.95, wind) + slam * 3.1;
        arms[1].rotation.y = -0.2;
        arms[0].rotation.x = lerp(-0.3, -2.4, wind) + slam * 2.4;
        arms[0].rotation.y = 0.2;
        legs[0].rotation.x = 0.45;
        legs[1].rotation.x = -0.35;
        handSword.rotation.x = -0.14;
        break;
      }
      case 'dodge': {
        body.position.y = -0.28 * s;
        body.rotation.x = -0.85 * s;
        body.rotation.z = 0.18 * s;
        legs[0].rotation.x = 1.1 * s;
        legs[1].rotation.x = 0.7 * s;
        arms[0].rotation.x = -0.9 * s;
        arms[1].rotation.x = -0.6 * s;
        head.rotation.x = 0.25 * s;
        break;
      }
      case 'hit': {
        body.rotation.x = 0.35 * s;
        body.rotation.z = -0.12 * s;
        head.rotation.x = 0.28 * s;
        arms[0].rotation.x = 0.5 * s;
        arms[1].rotation.x = 0.4 * s;
        arms[0].rotation.z = 0.3;
        arms[1].rotation.z = -0.3;
        legs[1].rotation.x = -0.15 * s;
        break;
      }
      case 'execute': {
        const p = smooth(t / 0.45);
        body.rotation.x = 0.18 * p;
        body.position.z = 0.22 * p;
        arms[1].rotation.set(-1.55, 0.05, -0.05);
        arms[0].rotation.set(-1.45, -0.1, 0.1);
        legs[0].rotation.x = 0.55;
        legs[1].rotation.x = -0.45;
        handSword.rotation.x = -0.03;
        break;
      }
      case 'cast': {
        const p = smooth(t / 0.4);
        body.rotation.y = 0.3 * p;
        arms[0].rotation.set(-1.5, 0.1, 0.15);
        arms[1].rotation.set(0.25, -0.3, -0.1);
        legs[0].rotation.x = 0.2;
        legs[1].rotation.x = -0.2;
        handSword.rotation.x = -0.2;
        break;
      }
      case 'victory': {
        arms[1].rotation.set(-2.45, 0.1, -0.2);
        arms[0].rotation.set(-0.2, 0, 0.1);
        head.rotation.x = -0.18;
        body.position.y = 0.02;
        break;
      }
      case 'defeat': {
        body.position.y = -0.48;
        body.rotation.x = 0.65;
        head.rotation.x = 0.5;
        arms[0].rotation.set(0.4, 0, 0.2);
        arms[1].rotation.set(0.45, 0, -0.2);
        legs[0].rotation.x = 1.25;
        legs[1].rotation.x = 1.1;
        break;
      }
    }
  };

  return { group, update, playPose, setSwordDrawn };
}

export interface NpcAssets {
  robe: THREE.BufferGeometry;
  trim: THREE.BufferGeometry;
  lower: THREE.BufferGeometry;
  head: THREE.BufferGeometry;
  hair: THREE.BufferGeometry;
  face: THREE.BufferGeometry;
}

function paintLower(geo: THREE.BufferGeometry): void {
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const dark = new THREE.Color('#241f1b');
  const teal = new THREE.Color('#3f6f6a');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    c.copy(y > 0.95 && y < 1.09 ? teal : dark);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

/**
 * Crowd-only low-poly variant. Same silhouette language as the named cast,
 * but ~4x fewer triangles. Named disciples keep the detailed asset.
 */
export function createCrowdAssets(): NpcAssets {
  const robe = new THREE.LatheGeometry(
    [
      new THREE.Vector2(0.32, 0.16),
      new THREE.Vector2(0.46, 0.23),
      new THREE.Vector2(0.45, 0.4),
      new THREE.Vector2(0.35, 0.65),
      new THREE.Vector2(0.245, 0.95),
      new THREE.Vector2(0.22, 1.12),
    ],
    8,
  );
  const shoulders = new THREE.SphereGeometry(0.13, 6, 4);
  shoulders.scale(1.55, 0.58, 0.95);
  shoulders.translate(0, 1.36, 0);
  const neck = new THREE.CylinderGeometry(0.052, 0.064, 0.18, 5);
  neck.translate(0, 1.47, 0);
  const sleeves: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    const sleeve = new THREE.CylinderGeometry(0.062, 0.165, 0.42, 5);
    sleeve.rotateZ(sx * 0.14);
    sleeve.translate(sx * 0.29, 1.12, 0.01);
    sleeves.push(sleeve);
  }
  const mantle = new THREE.CylinderGeometry(0.19, 0.34, 0.16, 8, 1, true);
  mantle.translate(0, 1.34, 0);
  const robeMerged = mergeGeometries([robe, shoulders, neck, ...sleeves, mantle], false);
  if (!robeMerged) throw new Error('crowd robe merge failed');

  const trimParts: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    const collar = new THREE.BoxGeometry(0.045, 0.34, 0.018);
    collar.rotateZ(sx * 0.42);
    collar.translate(sx * 0.075, 1.3, 0.215);
    trimParts.push(collar);
  }
  const sash = new THREE.TorusGeometry(0.267, 0.026, 4, 12);
  sash.rotateX(Math.PI / 2);
  sash.translate(0, 1.02, 0);
  trimParts.push(sash);
  const knot = new THREE.BoxGeometry(0.13, 0.08, 0.05);
  knot.translate(0.08, 0.99, 0.245);
  trimParts.push(knot);
  const trimMerged = mergeGeometries(trimParts, false);
  if (!trimMerged) throw new Error('crowd trim merge failed');

  const lowerParts: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    const leg = new THREE.CylinderGeometry(0.065, 0.055, 0.46, 5);
    leg.translate(sx * 0.11, 0.28, 0);
    lowerParts.push(leg);
    const boot = new THREE.BoxGeometry(0.11, 0.1, 0.22);
    boot.translate(sx * 0.11, 0.06, 0.04);
    lowerParts.push(boot);
  }
  const belt = new THREE.TorusGeometry(0.262, 0.026, 4, 12);
  belt.rotateX(Math.PI / 2);
  belt.translate(0, 1.02, 0);
  lowerParts.push(belt);
  const lowerMerged = mergeGeometries(lowerParts, false);
  if (!lowerMerged) throw new Error('crowd lower merge failed');
  paintLower(lowerMerged);

  const head = new THREE.SphereGeometry(0.14, 8, 6);
  head.scale(0.94, 1.02, 0.96);
  head.translate(0, 1.6, 0);

  const cap = new THREE.SphereGeometry(0.147, 8, 6);
  cap.scale(1.0, 1.0, 0.98);
  cap.translate(0, 1.625, -0.02);
  const bun = new THREE.SphereGeometry(0.078, 6, 4);
  bun.scale(0.92, 1.15, 0.92);
  bun.translate(0, 1.77, -0.1);
  const hairMerged = mergeGeometries([cap, bun], false);
  if (!hairMerged) throw new Error('crowd hair merge failed');

  const faceParts: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    const eye = new THREE.SphereGeometry(0.018, 5, 4);
    eye.scale(1, 0.72, 0.5);
    eye.translate(sx * 0.047, 1.612, 0.126);
    faceParts.push(eye);
    const brow = new THREE.BoxGeometry(0.052, 0.009, 0.01);
    brow.rotateZ(sx * -0.12);
    brow.translate(sx * 0.048, 1.647, 0.128);
    faceParts.push(brow);
  }
  const mouth = new THREE.BoxGeometry(0.045, 0.008, 0.008);
  mouth.translate(0, 1.528, 0.127);
  faceParts.push(mouth);
  const faceMerged = mergeGeometries(faceParts, false);
  if (!faceMerged) throw new Error('crowd face merge failed');

  return { robe: robeMerged, trim: trimMerged, lower: lowerMerged, head, hair: hairMerged, face: faceMerged };
}

export function createNpcAssets(): NpcAssets {
  // A deliberately stylised, low-poly sect disciple: wider hem, layered
  // collar, bell sleeves and a tied sash. One colour bucket per material keeps
  // the crowd at four draw calls while giving the named cast a readable
  // silhouette.
  const robePoints = [
    new THREE.Vector2(0.32, 0.16),
    new THREE.Vector2(0.46, 0.23),
    new THREE.Vector2(0.45, 0.4),
    new THREE.Vector2(0.35, 0.65),
    new THREE.Vector2(0.245, 0.95),
    new THREE.Vector2(0.22, 1.12),
  ];
  const robe = new THREE.LatheGeometry(robePoints, 18);

  const shoulders = new THREE.SphereGeometry(0.13, 10, 8);
  shoulders.scale(1.55, 0.58, 0.95);
  shoulders.translate(0, 1.36, 0);

  const neck = new THREE.CylinderGeometry(0.052, 0.064, 0.18, 8);
  neck.translate(0, 1.47, 0);

  const sleeves: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    const sleeve = new THREE.CylinderGeometry(0.062, 0.165, 0.42, 8);
    sleeve.rotateZ(sx * 0.14);
    sleeve.translate(sx * 0.29, 1.12, 0.01);
    sleeves.push(sleeve);
  }

  const mantle = new THREE.CylinderGeometry(0.19, 0.34, 0.16, 16, 1, true);
  mantle.translate(0, 1.34, 0);
  const robeMerged = mergeGeometries([robe, shoulders, neck, ...sleeves, mantle], false);
  if (!robeMerged) throw new Error('npc robe merge failed');

  const trimParts: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    const collar = new THREE.BoxGeometry(0.045, 0.34, 0.018);
    collar.rotateZ(sx * 0.42);
    collar.translate(sx * 0.075, 1.3, 0.215);
    trimParts.push(collar);
  }
  const sash = new THREE.TorusGeometry(0.267, 0.026, 5, 20);
  sash.rotateX(Math.PI / 2);
  sash.translate(0, 1.02, 0);
  trimParts.push(sash);
  const knot = new THREE.BoxGeometry(0.13, 0.08, 0.05);
  knot.translate(0.08, 0.99, 0.245);
  trimParts.push(knot);
  const hem = new THREE.TorusGeometry(0.335, 0.014, 4, 24);
  hem.rotateX(Math.PI / 2);
  hem.translate(0, 0.25, 0);
  trimParts.push(hem);
  for (const sx of [-1, 1]) {
    const cuff = new THREE.TorusGeometry(0.155, 0.012, 4, 16);
    cuff.rotateX(Math.PI / 2);
    cuff.translate(sx * 0.335, 0.9, 0.02);
    trimParts.push(cuff);
    const panel = new THREE.BoxGeometry(0.11, 0.62, 0.018);
    panel.rotateZ(sx * 0.035);
    panel.translate(sx * 0.12, 0.62, 0.275);
    trimParts.push(panel);
  }
  const hairpin = new THREE.CylinderGeometry(0.008, 0.008, 0.22, 5);
  hairpin.rotateZ(Math.PI / 2);
  hairpin.translate(0, 1.8, -0.09);
  trimParts.push(hairpin);
  const trimMerged = mergeGeometries(trimParts, false);
  if (!trimMerged) throw new Error('npc trim merge failed');

  const lowerParts: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    const leg = new THREE.CylinderGeometry(0.065, 0.055, 0.46, 7);
    leg.translate(sx * 0.11, 0.28, 0);
    lowerParts.push(leg);
    const boot = new THREE.BoxGeometry(0.11, 0.1, 0.22);
    boot.translate(sx * 0.11, 0.06, 0.04);
    lowerParts.push(boot);
  }
  const belt = new THREE.TorusGeometry(0.262, 0.026, 5, 20);
  belt.rotateX(Math.PI / 2);
  belt.translate(0, 1.02, 0);
  lowerParts.push(belt);
  const lowerMerged = mergeGeometries(lowerParts, false);
  if (!lowerMerged) throw new Error('npc lower merge failed');
  paintLower(lowerMerged);

  const headParts: THREE.BufferGeometry[] = [];
  const head = new THREE.SphereGeometry(0.14, 12, 10);
  head.scale(0.94, 1.02, 0.96);
  head.translate(0, 1.6, 0);
  headParts.push(head);
  for (const sx of [-1, 1]) {
    const ear = new THREE.SphereGeometry(0.025, 6, 5);
    ear.scale(0.55, 1, 0.8);
    ear.translate(sx * 0.132, 1.6, -0.005);
    headParts.push(ear);
  }
  const headMerged = mergeGeometries(headParts, false);
  if (!headMerged) throw new Error('npc head merge failed');

  const cap = new THREE.SphereGeometry(0.147, 12, 10);
  cap.scale(1.0, 1.0, 0.98);
  cap.translate(0, 1.625, -0.02);
  const bun = new THREE.SphereGeometry(0.078, 8, 6);
  bun.scale(0.92, 1.15, 0.92);
  bun.translate(0, 1.77, -0.1);
  const hairParts: THREE.BufferGeometry[] = [cap, bun];
  for (const sx of [-1, 1]) {
    const lock = new THREE.BoxGeometry(0.018, 0.16, 0.025);
    lock.rotateZ(sx * 0.06);
    lock.translate(sx * 0.118, 1.59, 0.02);
    hairParts.push(lock);
  }
  const hairMerged = mergeGeometries(hairParts, false);
  if (!hairMerged) throw new Error('npc hair merge failed');

  const faceParts: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1]) {
    const eye = new THREE.SphereGeometry(0.018, 7, 5);
    eye.scale(1, 0.72, 0.5);
    eye.translate(sx * 0.047, 1.612, 0.126);
    faceParts.push(eye);
    const brow = new THREE.BoxGeometry(0.052, 0.009, 0.01);
    brow.rotateZ(sx * -0.12);
    brow.translate(sx * 0.048, 1.647, 0.128);
    faceParts.push(brow);
  }
  const nose = new THREE.ConeGeometry(0.017, 0.05, 5);
  nose.rotateX(-Math.PI / 2);
  nose.translate(0, 1.578, 0.133);
  faceParts.push(nose);
  const mouth = new THREE.BoxGeometry(0.045, 0.008, 0.008);
  mouth.translate(0, 1.528, 0.127);
  faceParts.push(mouth);
  const faceMerged = mergeGeometries(faceParts, false);
  if (!faceMerged) throw new Error('npc face merge failed');

  return { robe: robeMerged, trim: trimMerged, lower: lowerMerged, head: headMerged, hair: hairMerged, face: faceMerged };
}
