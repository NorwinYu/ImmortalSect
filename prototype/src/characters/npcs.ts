import * as THREE from 'three';
import { mulberry32, randomRange } from '../core/math';
import { createCrowdAssets } from './character';
import { heightAt } from '../world/terrain';

type Zone =
  | { kind: 'ellipse'; x: number; z: number; rx: number; rz: number; count: number }
  | { kind: 'path'; z0: number; z1: number; x: number; spread: number; count: number }
  | { kind: 'circle'; x: number; z: number; r: number; count: number };

const ZONES: Zone[] = [
  { kind: 'ellipse', x: 0, z: -6, rx: 14, rz: 9, count: 58 },
  { kind: 'path', z0: 2, z1: 20, x: 0, spread: 2.7, count: 30 },
  { kind: 'ellipse', x: 0, z: -18, rx: 11, rz: 4.2, count: 24 },
  { kind: 'ellipse', x: 0, z: -41, rx: 12, rz: 3.2, count: 18 },
  { kind: 'circle', x: -32, z: -28, r: 5, count: 12 },
  { kind: 'circle', x: 32, z: -30, r: 4.2, count: 10 },
  { kind: 'ellipse', x: -40, z: -46, rx: 6, rz: 4, count: 12 },
  { kind: 'ellipse', x: 40, z: -46, rx: 6, rz: 4, count: 12 },
  { kind: 'ellipse', x: 0, z: -74, rx: 10, rz: 4, count: 24 },
];

const ROBE_COLORS = ['#e8dfcd', '#c7d2cb', '#7f9a92', '#d8cbb4', '#a8b8b1', '#c9b79c', '#5f7f78', '#e0d2ba', '#9b8d78'];
const SKIN_COLORS = ['#d8ab86', '#c99772', '#e0b995', '#b98563', '#d2a17d'];
const TRIM_COLORS = ['#c8a15a', '#8f3d32', '#3f6f6a', '#b8a078', '#6b665c'];

interface Npc {
  x: number;
  z: number;
  y: number;
  tx: number;
  tz: number;
  speed: number;
  phase: number;
  idle: number;
  facing: number;
  scale: number;
  zone: number;
}

function sampleZone(zone: Zone, rng: () => number): { x: number; z: number } {
  if (zone.kind === 'ellipse') {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng());
    return { x: zone.x + Math.cos(a) * zone.rx * r, z: zone.z + Math.sin(a) * zone.rz * r };
  }
  if (zone.kind === 'path') {
    return { x: zone.x + randomRange(rng, -zone.spread, zone.spread), z: randomRange(rng, zone.z0, zone.z1) };
  }
  const a = rng() * Math.PI * 2;
  const r = Math.sqrt(rng()) * zone.r;
  return { x: zone.x + Math.cos(a) * r, z: zone.z + Math.sin(a) * r };
}

export class Disciples {
  private readonly robe: THREE.InstancedMesh;
  private readonly trim: THREE.InstancedMesh;
  private readonly lower: THREE.InstancedMesh;
  private readonly head: THREE.InstancedMesh;
  private readonly hair: THREE.InstancedMesh;
  private readonly face: THREE.InstancedMesh;
  private readonly npcs: Npc[] = [];
  private readonly dummy = new THREE.Object3D();
  private readonly maxCount = 200;
  private count = 200;

  constructor(scene: THREE.Scene) {
    const assets = createCrowdAssets();
    const rng = mulberry32(0xd15c_171e);

    const robeMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.86,
      metalness: 0.0,
    });
    const headMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.7,
      metalness: 0.0,
    });
    const hairMat = new THREE.MeshStandardMaterial({
      color: '#171410',
      roughness: 0.65,
      metalness: 0.0,
    });
    const lowerMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.88,
      metalness: 0.0,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.72,
      metalness: 0.05,
    });
    const faceMat = new THREE.MeshStandardMaterial({
      color: '#2a201a',
      roughness: 0.7,
      metalness: 0.0,
    });

    this.robe = new THREE.InstancedMesh(assets.robe, robeMat, this.maxCount);
    this.trim = new THREE.InstancedMesh(assets.trim, trimMat, this.maxCount);
    this.lower = new THREE.InstancedMesh(assets.lower, lowerMat, this.maxCount);
    this.head = new THREE.InstancedMesh(assets.head, headMat, this.maxCount);
    this.hair = new THREE.InstancedMesh(assets.hair, hairMat, this.maxCount);
    this.face = new THREE.InstancedMesh(assets.face, faceMat, this.maxCount);

    for (const mesh of [this.robe, this.trim, this.lower, this.head, this.hair, this.face]) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(mesh);
    }

    const robeColor = new THREE.Color();
    const skinColor = new THREE.Color();
    const trimColor = new THREE.Color();
    let index = 0;

    for (let zi = 0; zi < ZONES.length; zi++) {
      const zone = ZONES[zi];
      for (let i = 0; i < zone.count && index < this.maxCount; i++) {
        const p = sampleZone(zone, rng);
        const t = sampleZone(zone, rng);
        const npc: Npc = {
          x: p.x,
          z: p.z,
          y: heightAt(p.x, p.z),
          tx: t.x,
          tz: t.z,
          speed: randomRange(rng, 0.5, 1.15),
          phase: rng() * Math.PI * 2,
          idle: rng() * 3,
          facing: rng() * Math.PI * 2,
          scale: randomRange(rng, 0.9, 1.06),
          zone: zi,
        };
        this.npcs.push(npc);

        robeColor.set(ROBE_COLORS[Math.floor(rng() * ROBE_COLORS.length) % ROBE_COLORS.length]);
        skinColor.set(SKIN_COLORS[Math.floor(rng() * SKIN_COLORS.length) % SKIN_COLORS.length]);
        this.robe.setColorAt(index, robeColor);
        this.head.setColorAt(index, skinColor);
        trimColor.set(TRIM_COLORS[Math.floor(rng() * TRIM_COLORS.length) % TRIM_COLORS.length]);
        this.trim.setColorAt(index, trimColor);
        index++;
      }
    }

    this.count = index;
    this.robe.count = index;
    this.trim.count = index;
    this.lower.count = index;
    this.head.count = index;
    this.hair.count = index;
    this.face.count = index;
    if (this.robe.instanceColor) this.robe.instanceColor.needsUpdate = true;
    if (this.trim.instanceColor) this.trim.instanceColor.needsUpdate = true;
    if (this.head.instanceColor) this.head.instanceColor.needsUpdate = true;

    this.writeMatrices();
  }

  private writeMatrices(): void {
    for (let i = 0; i < this.count; i++) {
      const n = this.npcs[i];
      this.dummy.position.set(n.x, n.y, n.z);
      this.dummy.rotation.set(0, n.facing, 0);
      this.dummy.scale.setScalar(n.scale);
      this.dummy.updateMatrix();
      this.robe.setMatrixAt(i, this.dummy.matrix);
      this.trim.setMatrixAt(i, this.dummy.matrix);
      this.lower.setMatrixAt(i, this.dummy.matrix);
      this.head.setMatrixAt(i, this.dummy.matrix);
      this.hair.setMatrixAt(i, this.dummy.matrix);
      this.face.setMatrixAt(i, this.dummy.matrix);
    }
    this.robe.instanceMatrix.needsUpdate = true;
    this.trim.instanceMatrix.needsUpdate = true;
    this.lower.instanceMatrix.needsUpdate = true;
    this.head.instanceMatrix.needsUpdate = true;
    this.hair.instanceMatrix.needsUpdate = true;
    this.face.instanceMatrix.needsUpdate = true;
  }

  update(dt: number, avoid: Array<{ x: number; z: number; r: number }> = []): void {
    for (let i = 0; i < this.count; i++) {
      const n = this.npcs[i];

      if (n.idle > 0) {
        n.idle -= dt;
        n.phase += dt * 1.2;
      } else {
        const dx = n.tx - n.x;
        const dz = n.tz - n.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 0.45) {
          const zone = ZONES[n.zone];
          const t = sampleZone(zone, Math.random);
          n.tx = t.x;
          n.tz = t.z;
          n.idle = 1.5 + Math.random() * 4;
        } else {
          const inv = 1 / dist;
          n.x += dx * inv * n.speed * dt;
          n.z += dz * inv * n.speed * dt;
          n.phase += dt * (4.4 + n.speed * 3.2);
          n.facing += (((Math.atan2(dx, dz) - n.facing + Math.PI) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 7);
          n.y = heightAt(n.x, n.z);
        }
      }

      for (const o of avoid) {
        const dx = n.x - o.x;
        const dz = n.z - o.z;
        const d = Math.hypot(dx, dz);
        const min = o.r + 0.45;
        if (d < min && d > 0.0001) {
          const push = (min - d) / d;
          n.x += dx * push;
          n.z += dz * push;
          n.tx = n.x + dx * 1.4;
          n.tz = n.z + dz * 1.4;
          n.idle = 0.4;
          n.y = heightAt(n.x, n.z);
        }
      }
    }

    this.writeMatrices();
  }

  setVisible(visible: boolean): void {
    this.robe.visible = visible;
    this.trim.visible = visible;
    this.lower.visible = visible;
    this.head.visible = visible;
    this.hair.visible = visible;
    this.face.visible = visible;
  }

  setQuality(level: 'high' | 'medium' | 'low'): void {
    const n = level === 'high' ? this.maxCount : level === 'medium' ? 160 : 110;
    this.count = Math.min(n, this.npcs.length);
    this.robe.count = this.count;
    this.trim.count = this.count;
    this.lower.count = this.count;
    this.head.count = this.count;
    this.hair.count = this.count;
    this.face.count = this.count;
  }
}
