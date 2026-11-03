import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createNpcAssets, type NpcAssets } from './character';
import { heightAt } from '../world/terrain';
import type { Disciple, Task } from '../game/state';
import type { Collider } from '../world/sect';

const SPOTS: Record<Task, { x: number; z: number }> = {
  cultivate: { x: -12, z: -8 },
  gather: { x: 18, z: 4 },
  patrol: { x: 2, z: 10 },
  study: { x: 35, z: -34 },
  rest: { x: -38, z: -24 },
};

const PATROL_PATH = [
  { x: 2, z: 6 },
  { x: 2, z: 18 },
  { x: -2, z: 18 },
  { x: -2, z: 6 },
];

const OFFSETS: Record<string, { x: number; z: number }> = {
  gu: { x: -1.3, z: -0.7 },
  shen: { x: 1.3, z: -0.7 },
  su: { x: -1.2, z: 0.8 },
  lu: { x: 1.2, z: 0.8 },
  bai: { x: 0, z: -1.1 },
  qi: { x: -1.4, z: 0 },
  xuan: { x: 1.4, z: 0 },
};

const SCALE: Record<string, number> = {
  gu: 1.06,
  shen: 1.0,
  su: 0.98,
  lu: 0.9,
  bai: 0.97,
  qi: 0.88,
  xuan: 1.02,
};

interface Actor {
  d: Disciple;
  group: THREE.Group;
  collider: Collider;
  mesh: THREE.Mesh;
  label: THREE.Sprite;
  task: Task;
  x: number;
  z: number;
  baseYaw: number;
  yaw: number;
  phase: number;
  active: boolean;
  patrolIndex: number;
}

function spotFor(d: Disciple): { x: number; z: number } {
  const base = SPOTS[d.assignment];
  const off = OFFSETS[d.id] ?? { x: 0, z: 0 };
  return { x: base.x + off.x, z: base.z + off.z };
}

function tint(geo: THREE.BufferGeometry, hex: string): THREE.BufferGeometry {
  const c = new THREE.Color(hex);
  const count = geo.attributes.position.count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

function accessory(id: string, accent: string): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  if (id === 'gu' || id === 'shen') {
    const blade = new THREE.BoxGeometry(0.055, 0.92, 0.018);
    blade.rotateZ(0.22);
    blade.translate(0.31, 0.92, 0.08);
    const guard = new THREE.BoxGeometry(0.18, 0.028, 0.035);
    guard.translate(0.31, 1.34, 0.08);
    parts.push(tint(blade, '#d8d4c8'), tint(guard, accent));
    if (id === 'gu') {
      const pauldron = new THREE.SphereGeometry(0.11, 8, 6);
      pauldron.scale(1.25, 0.55, 1.0);
      pauldron.translate(-0.27, 1.42, 0.02);
      parts.push(tint(pauldron, '#4c5b62'));
      const cloak = new THREE.BoxGeometry(0.34, 0.72, 0.025);
      cloak.rotateZ(0.06);
      cloak.translate(0, 1.04, -0.2);
      parts.push(tint(cloak, '#263238'));
    }
  } else if (id === 'su' || id === 'lu') {
    const basket = new THREE.CylinderGeometry(0.16, 0.115, 0.16, 9);
    basket.translate(0.34, 0.55, 0.08);
    parts.push(tint(basket, '#8a6a45'));
    const sprig = new THREE.CylinderGeometry(0.012, 0.012, 0.32, 5);
    sprig.translate(0.33, 0.78, 0.08);
    parts.push(tint(sprig, '#6a8552'));
  } else if (id === 'bai') {
    const box = new THREE.BoxGeometry(0.18, 0.12, 0.1);
    box.translate(0.3, 0.72, 0.06);
    parts.push(tint(box, '#8f7a5c'));
    const veil = new THREE.CylinderGeometry(0.12, 0.16, 0.22, 8, 1, true);
    veil.translate(0, 1.63, 0);
    parts.push(tint(veil, '#3f3a4a'));
  } else if (id === 'xuan') {
    const staff = new THREE.CylinderGeometry(0.022, 0.03, 1.72, 6);
    staff.translate(0.38, 0.86, 0);
    parts.push(tint(staff, '#5b4630'));
    const beard = new THREE.ConeGeometry(0.075, 0.34, 6);
    beard.rotateX(Math.PI);
    beard.translate(0, 1.42, 0.12);
    parts.push(tint(beard, '#d7d0c2'));
  } else if (id === 'qi') {
    const gourd = new THREE.SphereGeometry(0.085, 8, 6);
    gourd.scale(1, 1.25, 1);
    gourd.translate(0.29, 0.8, 0.06);
    parts.push(tint(gourd, '#b98b52'));
    const strap = new THREE.TorusGeometry(0.11, 0.012, 4, 12);
    strap.rotateY(Math.PI / 2);
    strap.translate(0.19, 1.12, 0);
    parts.push(tint(strap, '#6d4a2f'));
  }
  return parts;
}

function buildBody(d: Disciple, assets: NpcAssets): THREE.BufferGeometry {
  const robe = tint(assets.robe.clone(), d.palette.robe);
  const trim = tint(assets.trim.clone(), d.palette.accent);
  const lower = tint(assets.lower.clone(), '#26221d');
  const head = tint(assets.head.clone(), '#d8ab86');
  const face = tint(assets.face.clone(), '#2a201a');
  const hair = tint(assets.hair.clone(), d.palette.hair);
  const extra = accessory(d.id, d.palette.accent);
  const merged = mergeGeometries([robe, trim, lower, head, face, hair, ...extra], false);
  if (!merged) throw new Error(`named geometry merge failed: ${d.id}`);
  return merged;
}

function nameTexture(name: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('nameplate canvas unavailable');
  ctx.clearRect(0, 0, 256, 64);
  ctx.fillStyle = 'rgba(8, 10, 14, 0.72)';
  ctx.beginPath();
  ctx.roundRect(10, 8, 236, 48, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(200, 161, 90, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = 'rgba(240, 230, 210, 0.92)';
  ctx.font = '28px "Songti SC", "STSong", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, 128, 33);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function makeLabel(name: string): THREE.Sprite {
  const material = new THREE.SpriteMaterial({
    map: nameTexture(name),
    transparent: true,
    depthWrite: false,
    depthTest: true,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.9, 0.48, 1);
  sprite.position.set(0, 2.2, 0);
  return sprite;
}

/**
 * Seven named disciples, standing where their current assignment puts them.
 * One merged, vertex-coloured mesh each (7 draw calls) plus a nameplate.
 */
export class NamedDisciples {
  private readonly actors: Actor[] = [];
  private readonly assets: NpcAssets;
  private worldVisible = true;

  constructor(scene: THREE.Scene, disciples: Disciple[], colliders: Collider[] = []) {
    this.assets = createNpcAssets();
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.86,
      metalness: 0.0,
    });

    for (const d of disciples) {
      const geo = buildBody(d, this.assets);
      const mesh = new THREE.Mesh(geo, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;

      const group = new THREE.Group();
      group.add(mesh);
      const label = makeLabel(d.name);
      group.add(label);
      group.scale.setScalar(SCALE[d.id] ?? 1);

      const spot = spotFor(d);
      group.position.set(spot.x, heightAt(spot.x, spot.z), spot.z);
      scene.add(group);

      const collider: Collider = { type: 'circle', x: spot.x, z: spot.z, r: 0.5 };
      colliders.push(collider);

      this.actors.push({
        d,
        group,
        collider,
        mesh,
        label,
        task: d.assignment,
        x: spot.x,
        z: spot.z,
        baseYaw: Math.PI,
        yaw: Math.PI,
        phase: Math.random() * Math.PI * 2,
        active: d.active,
        patrolIndex: 0,
      });
    }
    this.sync(disciples, true);
  }

  /** Re-read assignment/active state after the ledger changes. */
  sync(disciples: Disciple[], force = false): void {
    for (const actor of this.actors) {
      const d = disciples.find((x) => x.id === actor.d.id);
      if (!d) continue;
      actor.d = d;
      actor.active = d.active;
      actor.group.visible = this.worldVisible && d.active;
      actor.collider.x = this.worldVisible && d.active ? actor.x : 9999;
      actor.collider.z = this.worldVisible && d.active ? actor.z : 9999;

      if (force || actor.task !== d.assignment) {
        actor.task = d.assignment;
        const spot = spotFor(d);
        actor.x = spot.x;
        actor.z = spot.z;
        actor.patrolIndex = 0;
        actor.baseYaw = Math.PI;
        actor.yaw = Math.PI;
        actor.group.position.set(spot.x, heightAt(spot.x, spot.z), spot.z);
        actor.group.rotation.y = Math.PI;
      }
    }
  }

  update(dt: number, time: number, player: THREE.Vector3): void {
    for (const actor of this.actors) {
      if (!actor.active) continue;
      const d = actor.d;

      if (d.assignment === 'patrol') {
        const p = PATROL_PATH[actor.patrolIndex];
        const off = OFFSETS[d.id] ?? { x: 0, z: 0 };
        const dx = p.x + off.x - actor.x;
        const dz = p.z + off.z - actor.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.35) {
          actor.patrolIndex = (actor.patrolIndex + 1) % PATROL_PATH.length;
        } else if (dt > 0) {
          const step = Math.min(dist, dt * 0.62);
          actor.x += (dx / dist) * step;
          actor.z += (dz / dist) * step;
          actor.baseYaw = Math.atan2(dx, dz);
        }
      }

      const dxp = player.x - actor.x;
      const dzp = player.z - actor.z;
      const near = Math.hypot(dxp, dzp) < 5.5;
      const targetYaw = near ? Math.atan2(dxp, dzp) : actor.baseYaw;
      let delta = targetYaw - actor.yaw;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      actor.yaw += delta * Math.min(1, dt * 3.5);
      actor.group.rotation.y = actor.yaw;

      const bob = Math.sin(time * 1.15 + actor.phase) * 0.012;
      actor.group.position.set(actor.x, heightAt(actor.x, actor.z) + bob, actor.z);
      actor.collider.x = this.worldVisible ? actor.x : 9999;
      actor.collider.z = this.worldVisible ? actor.z : 9999;
      actor.mesh.rotation.z =
        d.assignment === 'study' ? Math.sin(time * 0.7 + actor.phase) * 0.012 : 0;
    }
  }

  nearest(player: THREE.Vector3, radius = 3.6): { id: string; name: string; dist: number } | null {
    let best: { id: string; name: string; dist: number } | null = null;
    for (const actor of this.actors) {
      if (!actor.active) continue;
      const dist = Math.hypot(player.x - actor.x, player.z - actor.z);
      if (dist <= radius && (!best || dist < best.dist)) {
        best = { id: actor.d.id, name: actor.d.name, dist };
      }
    }
    return best;
  }

  debugState(): Array<{ id: string; visible: boolean; x: number; z: number; task: Task }> {
    return this.actors.map((a) => ({
      id: a.d.id,
      visible: a.group.visible,
      x: +a.x.toFixed(1),
      z: +a.z.toFixed(1),
      task: a.d.assignment,
    }));
  }

  obstacles(player?: THREE.Vector3): Array<{ x: number; z: number; r: number }> {
    const out = this.actors
      .filter((a) => a.active && this.worldVisible)
      .map((a) => ({ x: a.x, z: a.z, r: 1.3 }));
    if (player) out.push({ x: player.x, z: player.z, r: 0.85 });
    return out;
  }

  setVisible(visible: boolean): void {
    this.worldVisible = visible;
    for (const actor of this.actors) {
      actor.group.visible = visible && actor.active;
      actor.collider.x = visible && actor.active ? actor.x : 9999;
      actor.collider.z = visible && actor.active ? actor.z : 9999;
    }
  }
}
