import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../core/math';
import { heightAt } from './terrain';
import { REGIONS, regionById, type RegionDef, type RegionId } from '../game/scenes';

interface Collider {
  type: 'circle' | 'box';
  x: number;
  z: number;
  r?: number;
  hx?: number;
  hz?: number;
}

class Batch {
  private readonly buckets = new Map<string, THREE.BufferGeometry[]>();

  constructor(private readonly parent: THREE.Object3D) {}

  add(
    geo: THREE.BufferGeometry,
    color: string,
    x: number,
    y: number,
    z: number,
    ry = 0,
    rz = 0,
    sx = 1,
    sy = 1,
    sz = 1,
  ): void {
    const g = geo.clone();
    const matrix = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, rz));
    matrix.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz));
    g.applyMatrix4(matrix);
    const list = this.buckets.get(color) ?? [];
    list.push(g);
    this.buckets.set(color, list);
  }

  build(): void {
    for (const [color, geos] of this.buckets) {
      const merged = mergeGeometries(geos, false);
      for (const g of geos) g.dispose();
      if (!merged) continue;
      const material = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.86,
        metalness: 0.02,
      });
      const mesh = new THREE.Mesh(merged, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = true;
      this.parent.add(mesh);
    }
    this.buckets.clear();
  }
}

function signTexture(text: string, sub: string, accent: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 160;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('region sign canvas unavailable');
  ctx.fillStyle = 'rgba(22, 20, 17, 0.95)';
  ctx.fillRect(0, 0, 512, 160);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 3;
  ctx.strokeRect(10, 10, 492, 140);
  ctx.fillStyle = '#e8ddc8';
  ctx.font = '58px "Songti SC", "STSong", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 72);
  ctx.fillStyle = accent;
  ctx.font = '18px "Songti SC", "STSong", serif';
  ctx.fillText(sub, 256, 124);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface Marker {
  mesh: THREE.Mesh;
  ring: THREE.Mesh;
  x: number;
  z: number;
  phase: number;
}

export interface RegionActionHit {
  region: RegionDef;
  id: string;
  label: string;
  description: string;
}

/**
 * Three pocket regions built into the same mountain, connected by the map.
 * Geometry is merged per colour to keep the draw-call cost small.
 */
export class Regions {
  current: RegionId = 'sect';
  private readonly markers = new Map<RegionId, Marker>();
  private readonly groups = new Map<RegionId, THREE.Group>();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly colliders: Collider[],
  ) {
    for (const id of ['swordTomb', 'herbGarden', 'market'] as RegionId[]) {
      const group = new THREE.Group();
      group.visible = false;
      this.scene.add(group);
      this.groups.set(id, group);
    }
    this.buildSwordTomb();
    this.buildHerbGarden();
    this.buildMarket();
  }

  enter(id: RegionId, player: { teleport: (x: number, z: number) => void }): void {
    this.current = id;
    for (const [region, group] of this.groups) group.visible = region === id;
    const def = regionById(id);
    player.teleport(def.spawn.x, def.spawn.z);
  }

  nearestAction(player: THREE.Vector3, radius = 3.8): RegionActionHit | null {
    const def = regionById(this.current);
    if (!def.action || !def.actionPoint) return null;
    const dist = Math.hypot(player.x - def.actionPoint.x, player.z - def.actionPoint.z);
    if (dist > radius) return null;
    return {
      region: def,
      id: def.action.id,
      label: def.action.label,
      description: def.action.description,
    };
  }

  update(dt: number, time: number): void {
    for (const [id, marker] of this.markers) {
      if (id !== this.current) continue;
      marker.mesh.rotation.y += dt * 0.9;
      marker.mesh.position.y = heightAt(marker.x, marker.z) + 2.1 + Math.sin(time * 1.4 + marker.phase) * 0.08;
      marker.ring.rotation.z += dt * 0.45;
    }
  }

  private marker(id: RegionId, x: number, z: number, accent: string): void {
    const group = this.groups.get(id);
    if (!group) return;
    const baseY = heightAt(x, z);

    const geo = new THREE.OctahedronGeometry(0.3, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: accent,
      emissive: accent,
      emissiveIntensity: 1.2,
      roughness: 0.3,
      metalness: 0.1,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, baseY + 2.1, z);
    group.add(mesh);

    const ringGeo = new THREE.RingGeometry(0.55, 0.64, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, baseY + 0.08, z);
    group.add(ring);

    const beamGeo = new THREE.CylinderGeometry(0.055, 0.055, 5.2, 8);
    const beamMat = new THREE.MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(x, baseY + 2.6, z);
    group.add(beam);

    const light = new THREE.PointLight(accent, 55, 30, 1.8);
    light.position.set(x, baseY + 4.5, z);
    group.add(light);

    const ambient = new THREE.AmbientLight(accent, 0.35);
    group.add(ambient);

    this.markers.set(id, { mesh, ring, x, z, phase: Math.random() * Math.PI * 2 });
  }

  private buildSwordTomb(): void {
    const base = heightAt(-58, -20);
    const b = new Batch(this.groups.get('swordTomb')!);
    const rng = mulberry32(0x57a0_1d);
    const box = new THREE.BoxGeometry(1, 1, 1);
    const cyl = new THREE.CylinderGeometry(0.08, 0.13, 1, 6);

    // The tomb is cut into the hillside; no raised slab.
    // Tombstones / steles
    for (let i = 0; i < 12; i++) {
      const x = -66 + rng() * 16;
      const z = -26 + rng() * 12;
      if (Math.hypot(x + 58, z + 20) < 4) continue;
      const h = 0.8 + rng() * 1.0;
      b.add(box, '#5b5850', x, heightAt(x, z) + h * 0.5 + 0.2, z, rng() * 0.3, (rng() - 0.5) * 0.12, 0.55, h, 0.22);
      b.add(box, '#3c3a35', x, heightAt(x, z) + 0.55, z + 0.15, 0, 0, 0.7, 0.1, 0.06);
    }

    // Swords in the ground
    for (let i = 0; i < 11; i++) {
      const x = -66 + rng() * 16;
      const z = -26 + rng() * 12;
      if (Math.hypot(x + 58, z + 20) < 3) continue;
      b.add(box, '#b9c0bd', x, heightAt(x, z) + 0.85, z, rng() * 1.5, 0.18 + rng() * 0.25, 0.045, 1.2, 0.015);
      b.add(box, '#8f7748', x, heightAt(x, z) + 1.45, z, 0, 0.18 + rng() * 0.25, 0.22, 0.035, 0.035);
    }

    // Central broken sword
    b.add(box, '#6f7574', -58, base + 1.25, -20, 0, 0.32, 0.3, 2.2, 0.08);
    b.add(box, '#9a7d4b', -58, base + 2.35, -20, 0, 0.32, 0.65, 0.07, 0.1);
    b.add(box, '#3a3328', -58, base + 0.35, -20, 0, 0.32, 0.5, 0.3, 0.5);

    // Dead trees
    for (let i = 0; i < 4; i++) {
      const x = -67 + rng() * 3;
      const z = -27 + rng() * 3;
      const h = 3.2 + rng() * 2;
      b.add(cyl, '#3b332b', x, heightAt(x, z) + h * 0.5, z, 0, 0, 1, h, 1);
      b.add(box, '#3b332b', x + 0.5, heightAt(x, z) + h * 0.7, z, 0, 0.6, 1.4, 0.1, 0.1);
    }

    b.build();
    this.marker('swordTomb', -58, -19, '#9fc7d8');
    this.colliders.push({ type: 'circle', x: -58, z: -20, r: 1.4 });
  }

  private buildHerbGarden(): void {
    const b = new Batch(this.groups.get('herbGarden')!);
    const rng = mulberry32(0x8e4b_2c);
    const box = new THREE.BoxGeometry(1, 1, 1);
    const cone = new THREE.ConeGeometry(0.12, 0.42, 5);
    const cyl = new THREE.CylinderGeometry(0.07, 0.1, 1, 6);

    // Soil plots
    for (let i = 0; i < 3; i++) {
      const x = 45.5 + i * 2.6;
      b.add(box, '#4a3a2a', x, heightAt(x, 7.5) + 0.08, 7.5, 0, 0, 4.8, 0.16, 2.5);
      for (let j = 0; j < 9; j++) {
        const hx = x - 1.7 + rng() * 3.4;
        const hz = 6.4 + rng() * 2.2;
        b.add(cone, '#6e8d58', hx, heightAt(hx, hz) + 0.35, hz, 0, (rng() - 0.5) * 0.2, 1, 0.8 + rng() * 0.5, 1);
      }
      b.add(box, '#7b5d3a', x, heightAt(x, 6.1) + 0.35, 6.1, 0, 0, 4.9, 0.08, 0.12);
    }

    // Hut
    const hx = 54;
    const hz = 3.5;
    b.add(box, '#6d563a', hx, heightAt(hx, hz) + 1.4, hz, 0, 0, 4.2, 2.8, 3.0);
    b.add(box, '#3f3730', hx, heightAt(hx, hz) + 2.95, hz, 0, 0, 5.2, 0.2, 3.8);
    b.add(box, '#2e2a25', hx + 2.1, heightAt(hx, hz) + 1.1, hz, 0, 0, 0.1, 1.9, 1.1);
    for (let i = 0; i < 4; i++) {
      b.add(box, '#5a4932', hx - 2.0 + i * 1.3, heightAt(hx, hz) + 2.55, hz + 1.55, 0, 0, 0.12, 1.2, 0.12);
    }

    // Drying rack
    const rx = 43;
    const rz = 14.5;
    b.add(cyl, '#5a4932', rx - 1.3, heightAt(rx, rz) + 1.1, rz, 0, 0, 1, 2.2, 1);
    b.add(cyl, '#5a4932', rx + 1.3, heightAt(rx, rz) + 1.1, rz, 0, 0, 1, 2.2, 1);
    b.add(box, '#5a4932', rx, heightAt(rx, rz) + 2.15, rz, 0, 0, 3.0, 0.1, 0.1);
    for (let i = 0; i < 5; i++) {
      b.add(box, '#8c7c55', rx - 1.2 + i * 0.6, heightAt(rx, rz) + 1.7, rz, 0.2, 0, 0.5, 0.7, 0.03);
    }

    // Baskets
    for (let i = 0; i < 3; i++) {
      b.add(cyl, '#8a6a45', 45 + i * 1.6, heightAt(45 + i * 1.6, 16) + 0.25, 16, 0, 0, 0.5, 0.5, 0.5);
    }

    b.build();
    this.marker('herbGarden', 48, 10, '#8fb98b');
    this.colliders.push({ type: 'box', x: 54, z: 3.5, hx: 2.5, hz: 1.9 });
  }

  private buildMarket(): void {
    const b = new Batch(this.groups.get('market')!);
    const rng = mulberry32(0x3d21_77);
    const box = new THREE.BoxGeometry(1, 1, 1);
    const cyl = new THREE.CylinderGeometry(0.05, 0.07, 1, 6);
    const sphere = new THREE.SphereGeometry(0.15, 8, 6);

    const stalls = [
      { x: -53, z: 9, color: '#8f3d32' },
      { x: -43, z: 9, color: '#3f5f78' },
      { x: -53, z: 15, color: '#6f5b38' },
      { x: -43, z: 15, color: '#7a3e4a' },
    ];

    for (const s of stalls) {
      const y = heightAt(s.x, s.z);
      for (const [dx, dz] of [[-1.4, -1], [1.4, -1], [-1.4, 1], [1.4, 1]]) {
        b.add(cyl, '#4a3826', s.x + dx, y + 1.3, s.z + dz, 0, 0, 1, 2.6, 1);
      }
      b.add(box, s.color, s.x, y + 2.55, s.z, 0, 0, 3.2, 0.1, 2.5);
      b.add(box, '#3a2d20', s.x, y + 0.8, s.z, 0, 0, 2.6, 1.5, 1.4);
      b.add(box, '#5e4930', s.x - 0.8, y + 1.75, s.z, 0, 0, 0.7, 0.16, 1.8);
      b.add(box, '#5e4930', s.x + 0.8, y + 1.75, s.z, 0, 0, 0.7, 0.16, 1.8);
      b.add(sphere, '#e0b45e', s.x, y + 2.2, s.z + 1.3, 0, 0, 1, 1, 1);
      for (let i = 0; i < 3; i++) {
        b.add(box, '#6b5235', s.x - 1.1 + i * 0.5, y + 1.68, s.z - 0.4, rng() * 0.5, 0, 0.35, 0.25, 0.35);
      }
    }

    // Crates and barrels
    for (let i = 0; i < 8; i++) {
      const x = -56 + rng() * 16;
      const z = 5 + rng() * 5;
      b.add(box, '#6a5136', x, heightAt(x, z) + 0.25, z, rng() * 0.6, 0, 0.5, 0.5, 0.5);
    }
    for (let i = 0; i < 4; i++) {
      b.add(cyl, '#5c4129', -55 + i * 1.7, heightAt(-55 + i * 1.7, 18) + 0.4, 18, 0, 0, 0.55, 0.8, 0.55);
    }

    // Torii-like entrance frame
    b.add(cyl, '#5a3326', -51, heightAt(-51, 19) + 2.2, 19, 0, 0, 1, 4.4, 1);
    b.add(cyl, '#5a3326', -45, heightAt(-45, 19) + 2.2, 19, 0, 0, 1, 4.4, 1);
    b.add(box, '#6b3b2b', -48, heightAt(-48, 19) + 4.3, 19, 0, 0, 7.4, 0.24, 0.4);

    b.build();

    // Sign
    const tex = signTexture('坊 市', 'MARKET · 山门之下', '#d08a5a');
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(3.6, 1.1),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, metalness: 0.0, side: THREE.DoubleSide }),
    );
    sign.position.set(-48, heightAt(-48, 6) + 3.1, 6.05);
    this.groups.get('market')?.add(sign);

    this.marker('market', -48, 16, '#d08a5a');
    this.colliders.push({ type: 'box', x: -53, z: 9, hx: 1.9, hz: 1.5 });
    this.colliders.push({ type: 'box', x: -43, z: 9, hx: 1.9, hz: 1.5 });
    this.colliders.push({ type: 'box', x: -53, z: 15, hx: 1.9, hz: 1.5 });
    this.colliders.push({ type: 'box', x: -43, z: 15, hx: 1.9, hz: 1.5 });
  }
}

// Keep the list referenced so tree-shaking cannot drop the region metadata.
export const REGION_IDS = REGIONS.map((r) => r.id);
