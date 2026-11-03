import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { heightAt } from './terrain';
import type { Collider } from './sect';
import { BUILDINGS, type BuildingDef, type BuildingId } from '../game/buildings';
import type { GameState } from '../game/state';

const WOOD = '#5a3b28';
const DARK_WOOD = '#3c2a1f';
const WALL = '#d8cbb4';
const PLASTER = '#e3d7c1';
const ROOF = '#2e3a3f';
const ROOF_EDGE = '#1c2529';
const STONE = '#6b665c';
const STONE_DARK = '#4d4a43';
const GOLD = '#c8a15a';
const RED = '#8f3d32';
const GREEN = '#5d7d4d';
const SOIL = '#4a3a2a';

function tint(geo: THREE.BufferGeometry, color: string): THREE.BufferGeometry {
  const c = new THREE.Color(color);
  const count = geo.attributes.position.count;
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

class Builder {
  private readonly parts: THREE.BufferGeometry[] = [];

  add(
    geo: THREE.BufferGeometry,
    color: string,
    x: number,
    y: number,
    z: number,
    rx = 0,
    ry = 0,
    rz = 0,
    sx = 1,
    sy = 1,
    sz = 1,
  ): void {
    const g = geo.clone();
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz));
    m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz));
    g.applyMatrix4(m);
    tint(g, color);
    this.parts.push(g);
  }

  box(color: string, w: number, h: number, d: number, x: number, y: number, z: number, rx = 0, ry = 0): void {
    this.add(new THREE.BoxGeometry(w, h, d), color, x, y, z, rx, ry);
  }

  cyl(color: string, r: number, h: number, x: number, y: number, z: number, segments = 8): void {
    this.add(new THREE.CylinderGeometry(r, r * 1.05, h, segments), color, x, y, z);
  }

  build(): THREE.Mesh | null {
    const merged = mergeGeometries(this.parts, false);
    for (const g of this.parts) g.dispose();
    if (!merged) return null;
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.86,
      metalness: 0.02,
    });
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
}

function roof(b: Builder, w: number, d: number, x: number, y: number, z: number, color = ROOF): void {
  const slope = d * 0.72;
  b.add(new THREE.BoxGeometry(w, 0.18, slope), color, x, y, z - d * 0.19, -0.32, 0, 0);
  b.add(new THREE.BoxGeometry(w, 0.18, slope), color, x, y, z + d * 0.19, 0.32, 0, 0);
  b.box(ROOF_EDGE, w + 0.3, 0.1, 0.12, x, y + 0.36, z);
  b.box(ROOF_EDGE, w + 0.4, 0.08, 0.16, x, y + 0.18, z - d * 0.5);
  b.box(ROOF_EDGE, w + 0.4, 0.08, 0.16, x, y + 0.18, z + d * 0.5);
}

function windows(b: Builder, w: number, d: number, x: number, y: number, z: number): void {
  b.box('#24211c', 0.7, 1.1, 0.08, x - w * 0.28, y, z + d / 2 + 0.04);
  b.box(GOLD, 0.9, 0.06, 0.08, x - w * 0.28, y - 0.62, z + d / 2 + 0.04);
  b.box('#24211c', 0.7, 1.1, 0.08, x + w * 0.28, y, z + d / 2 + 0.04);
  b.box(GOLD, 0.9, 0.06, 0.08, x + w * 0.28, y - 0.62, z + d / 2 + 0.04);
}

function house(
  b: Builder,
  w: number,
  d: number,
  h: number,
  x: number,
  y: number,
  z: number,
  level: number,
  wallColor = WALL,
): void {
  b.box(STONE, w + 1.1, 0.24, d + 1.0, x, y + 0.12, z);
  b.box(wallColor, w, h, d, x, y + h / 2 + 0.24, z);
  b.box(DARK_WOOD, 0.42, h, 0.42, x - w / 2 + 0.1, y + h / 2 + 0.24, z + d / 2);
  b.box(DARK_WOOD, 0.42, h, 0.42, x + w / 2 - 0.1, y + h / 2 + 0.24, z + d / 2);
  b.box(DARK_WOOD, 0.42, h, 0.42, x - w / 2 + 0.1, y + h / 2 + 0.24, z - d / 2);
  b.box(DARK_WOOD, 0.42, h, 0.42, x + w / 2 - 0.1, y + h / 2 + 0.24, z - d / 2);
  b.box(DARK_WOOD, 1.1, h * 0.72, 0.14, x, y + h * 0.38 + 0.24, z + d / 2 + 0.02);
  b.box(GOLD, 1.35, 0.08, 0.14, x, y + h * 0.78, z + d / 2 + 0.04);
  roof(b, w + 0.8, d + 0.8, x, y + h + 0.48, z);
  windows(b, w, d, x, y + h * 0.66, z);
  if (level >= 2) {
    const wx = x + w / 2 + 1.5;
    b.box(wallColor, 2.2, h * 0.7, d * 0.7, wx, y + h * 0.35 + 0.24, z + 0.2);
    roof(b, 2.8, d * 0.9, wx, y + h * 0.72 + 0.5, z + 0.2);
    b.box(DARK_WOOD, 2.5, 0.9, 0.1, wx, y + 0.8, z + d * 0.35 + 0.2);
  }
  if (level >= 3) {
    b.box(wallColor, w * 0.82, h * 0.62, d * 0.78, x, y + h + h * 0.32 + 0.5, z);
    roof(b, w * 0.95, d * 0.9, x, y + h * 1.55 + 0.65, z, ROOF_EDGE);
    b.box(GOLD, 0.18, 1.5, 0.18, x + w * 0.42, y + h + 0.9, z + d * 0.35);
  }
}

function ruin(b: Builder, def: BuildingDef, level: number): void {
  const w = def.half.x * 1.4;
  const d = def.half.z * 1.4;
  b.box(STONE, w + 1, 0.22, d + 1, 0, 0.11, 0);
  b.box(STONE_DARK, w, 0.8, 0.35, -w * 0.15, 0.62, -d * 0.4, 0, 0.2);
  b.box(STONE_DARK, w * 0.7, 0.45, 0.35, w * 0.2, 0.38, d * 0.3, 0, -0.15);
  b.box(WOOD, 0.28, 2.4, 0.28, -w * 0.4, 1.2, d * 0.2, 0.2, 0.3);
  b.box(WOOD, 0.24, 1.8, 0.24, w * 0.35, 0.9, -d * 0.2, -0.15, -0.2);
  if (level > 0) {
    b.box(WALL, w * 0.8, 1.4, 0.3, 0, 1.4, -d * 0.45);
  }
}

function buildDorm(b: Builder, def: BuildingDef, level: number): void {
  if (level <= 0) return ruin(b, def, level);
  house(b, 7.2, 4.0, 2.3, 0, 0, 0, level);
  if (level >= 2) {
    b.box(DARK_WOOD, 0.16, 2.0, 0.16, 5.6, 1.0, -2.4);
    b.box(DARK_WOOD, 0.16, 2.0, 0.16, 5.6, 1.0, 2.4);
    b.box(DARK_WOOD, 0.12, 0.12, 4.8, 5.6, 1.9, 0);
  }
  if (level >= 3) {
    b.box(RED, 0.22, 3.2, 0.22, -4.7, 1.6, 2.6);
    b.box(GOLD, 1.0, 0.5, 0.06, -4.7, 2.8, 2.6);
  }
}

function buildField(b: Builder, level: number): void {
  const n = level <= 0 ? 0 : level + 1;
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * 2.7;
    b.box(SOIL, 2.3, 0.16, 3.4, x, 0.1, 0);
    b.box(WOOD, 2.5, 0.12, 0.12, x, 0.22, 1.75);
    b.box(WOOD, 2.5, 0.12, 0.12, x, 0.22, -1.75);
    for (let j = 0; j < 6; j++) {
      const sx = x - 0.8 + (j % 3) * 0.8;
      const sz = -0.9 + Math.floor(j / 3) * 1.8;
      b.add(new THREE.ConeGeometry(0.14, 0.45, 5), GREEN, sx, 0.42, sz);
    }
  }
  if (level >= 2) {
    for (let i = 0; i < 6; i++) {
      b.box(WOOD, 0.12, 1.1, 0.12, -5.4 + i * 2.2, 0.55, 4.1);
      b.box(WOOD, 0.12, 1.1, 0.12, -5.4 + i * 2.2, 0.55, -4.1);
    }
    b.box(WOOD, 11, 0.08, 0.08, 0, 1.0, 4.1);
    b.box(WOOD, 11, 0.08, 0.08, 0, 1.0, -4.1);
  }
  if (level >= 3) {
    b.box(WOOD, 0.18, 2.2, 0.18, 0, 1.1, 0);
    b.box(WOOD, 1.8, 0.12, 0.12, 0, 1.8, 0);
    b.add(new THREE.SphereGeometry(0.3, 8, 6), '#c9b079', 0, 2.15, 0);
    b.box(RED, 0.5, 0.4, 0.5, 0, 2.2, 0);
  }
}

function buildAlchemy(b: Builder, level: number): void {
  house(b, 4.6, 4.0, 2.1, 0, 0, 0, level, PLASTER);
  if (level >= 1) {
    b.cyl(STONE_DARK, 0.42, 3.4, -1.4, 1.9, -1.1, 10);
    b.add(new THREE.CylinderGeometry(0.22, 0.3, 0.4, 10), '#2b2520', -1.4, 3.55, -1.1);
    b.add(new THREE.SphereGeometry(0.28, 8, 6), '#d08a5a', -1.4, 3.8, -1.1);
  }
  if (level >= 2) {
    b.cyl(STONE_DARK, 0.36, 2.8, 1.8, 1.6, 1.2, 10);
  }
  if (level >= 3) {
    b.box(GOLD, 3.4, 0.12, 0.12, 0, 2.55, 2.2);
    b.box(RED, 0.22, 2.2, 0.22, -2.6, 1.1, 2.2);
  }
}

function buildKitchen(b: Builder, level: number): void {
  house(b, 5.2, 3.6, 2.0, 0, 0, 0, level, '#cbbda5');
  if (level >= 1) {
    b.cyl(STONE_DARK, 0.38, 2.8, 2.0, 1.7, -1.0, 9);
    b.box(WOOD, 3.6, 0.12, 0.9, 0, 0.65, 2.2);
    b.add(new THREE.SphereGeometry(0.18, 8, 6), '#e0c08a', 0.8, 0.85, 2.2);
    b.add(new THREE.SphereGeometry(0.18, 8, 6), '#e0c08a', -0.8, 0.85, 2.2);
  }
  if (level >= 2) {
    b.box(WOOD, 2.0, 0.5, 1.0, -4.2, 0.25, 1.0);
  }
  if (level >= 3) {
    b.box(RED, 0.8, 0.7, 0.08, 0, 2.5, 1.9);
    b.box(GOLD, 1.1, 0.06, 0.08, 0, 2.72, 1.9);
  }
}

function buildStore(b: Builder, level: number): void {
  house(b, 5.8, 4.6, 2.0, 0, 0, 0, level, '#b8a078');
  for (let i = 0; i < level + 1; i++) {
    b.box(WOOD, 1.0, 0.9, 1.0, -4.0 + i * 1.15, 0.45, 3.1);
    b.box(DARK_WOOD, 1.0, 0.08, 1.0, -4.0 + i * 1.15, 0.9, 3.1);
  }
  if (level >= 2) {
    b.box(WOOD, 1.6, 0.8, 1.2, 4.4, 0.4, 2.2);
    b.box(WOOD, 1.2, 0.6, 1.0, 4.1, 1.0, 2.2);
  }
  if (level >= 3) {
    b.cyl(GOLD, 0.08, 2.6, 2.8, 1.3, 2.2, 6);
    b.box(RED, 1.4, 0.8, 0.08, 2.8, 2.1, 2.2);
  }
}

function buildLibrary(b: Builder, def: BuildingDef, level: number): void {
  if (level <= 0) return ruin(b, def, level);
  const floors = level;
  b.box(STONE, 5.2, 0.3, 4.2, 0, 0.15, 0);
  for (let f = 0; f < floors; f++) {
    const y = 0.3 + f * 2.25;
    b.box(f % 2 === 0 ? WALL : PLASTER, 4.0, 2.0, 3.2, 0, y + 1.0, 0);
    b.box(DARK_WOOD, 0.3, 2.1, 0.3, -1.8, y + 1.0, 1.5);
    b.box(DARK_WOOD, 0.3, 2.1, 0.3, 1.8, y + 1.0, 1.5);
    b.box(DARK_WOOD, 1.0, 1.3, 0.1, 0, y + 0.75, 1.62);
    roof(b, 4.9, 3.9, 0, y + 2.35, 0, f === floors - 1 ? ROOF : ROOF_EDGE);
  }
  if (level >= 2) b.box(GOLD, 0.16, 3.4, 0.16, 0, 1.8, 1.9);
  if (level >= 3) {
    b.add(new THREE.ConeGeometry(0.12, 1.2, 6), GOLD, 0, floors * 2.25 + 3.0, 0);
  }
}

function buildSword(b: Builder, level: number): void {
  const w = 6.5 + level * 1.2;
  const d = 4.4 + level * 0.7;
  b.box(STONE, w, 0.22, d, 0, 0.11, 0);
  if (level <= 0) {
    b.box(STONE_DARK, 1.2, 0.8, 0.4, -1, 0.6, 0, 0, 0.2);
    return;
  }
  for (let i = 0; i < level + 1; i++) {
    const x = -w / 2 + 1.0 + i * 1.5;
    b.box(DARK_WOOD, 0.14, 1.5, 1.8, x, 0.9, -d / 2 + 0.7);
    b.box(WOOD, 0.1, 0.1, 1.9, x, 1.35, -d / 2 + 0.7);
    b.add(new THREE.BoxGeometry(0.04, 1.2, 0.02), '#c8d2cf', x, 1.2, -d / 2 + 0.4, 0, 0, 0.12);
  }
  for (let i = 0; i < level; i++) {
    b.box(RED, 0.2, 2.8, 0.2, -w / 2 + 0.4, 1.4, d / 2 - 0.3);
    b.box(GOLD, 0.8, 0.45, 0.06, -w / 2 + 0.4, 2.35, d / 2 - 0.3);
  }
  if (level >= 2) {
    b.box(STONE_DARK, 2.4, 0.4, 0.8, 0, 0.3, 1.9);
  }
  if (level >= 3) {
    b.add(new THREE.CylinderGeometry(0.08, 0.08, 3.4, 6), GOLD, w / 2 - 0.4, 1.7, d / 2 - 0.4);
  }
}

function buildArray(b: Builder, def: BuildingDef, level: number): void {
  if (level <= 0) return ruin(b, def, level);
  const r = 2.8 + level * 0.6;
  b.add(new THREE.CylinderGeometry(r, r + 0.2, 0.22, 20), STONE, 0, 0.11, 0);
  b.add(new THREE.CylinderGeometry(r * 0.62, r * 0.62, 0.26, 20), STONE_DARK, 0, 0.15, 0);
  const pillars = level * 4;
  for (let i = 0; i < pillars; i++) {
    const a = (i / pillars) * Math.PI * 2;
    b.box(STONE_DARK, 0.28, 1.8, 0.28, Math.cos(a) * r * 0.82, 0.9, Math.sin(a) * r * 0.82, 0, a);
    b.add(new THREE.OctahedronGeometry(0.16, 0), GOLD, Math.cos(a) * r * 0.82, 1.95, Math.sin(a) * r * 0.82);
  }
  b.add(new THREE.CylinderGeometry(0.45, 0.7, 2.6, 6), STONE, 0, 1.3, 0);
  b.add(new THREE.OctahedronGeometry(0.32, 0), '#8fd0c4', 0, 2.9, 0);
}

export class BuildingSystem {
  private readonly groups = new Map<BuildingId, THREE.Group>();
  private pickables: THREE.Object3D[] = [];
  private readonly last = new Map<BuildingId, string>();
  private visible = true;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly colliders: Collider[],
    state: GameState,
  ) {
    for (const def of BUILDINGS) {
      this.colliders.push({
        type: 'box',
        x: def.plot.x,
        z: def.plot.z,
        hx: def.half.x,
        hz: def.half.z,
      });
    }
    this.refresh(state, true);
  }

  refresh(state: GameState, force = false): void {
    for (const def of BUILDINGS) {
      const b = state.buildings[def.id];
      if (!b) continue;
      const key = `${b.level}:${b.construction}`;
      if (!force && this.last.get(def.id) === key) continue;
      this.last.set(def.id, key);
      this.rebuild(def, b.level, b.construction);
    }
  }

  pick(raycaster: THREE.Raycaster): BuildingId | null {
    const hits = raycaster.intersectObjects(this.pickables, false);
    for (const hit of hits) {
      const id = hit.object.userData.buildingId as BuildingId | undefined;
      if (id) return id;
    }
    return null;
  }

  obstacles(): Array<{ x: number; z: number; r: number }> {
    return BUILDINGS.map((def) => ({
      x: def.plot.x,
      z: def.plot.z,
      r: Math.max(def.half.x, def.half.z) + 0.8,
    }));
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    for (const group of this.groups.values()) group.visible = visible;
  }

  private rebuild(def: BuildingDef, level: number, construction: number): void {
    this.pickables = this.pickables.filter((o) => o.userData.buildingId !== def.id);
    const old = this.groups.get(def.id);
    if (old) {
      this.scene.remove(old);
      old.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
    }
    const group = new THREE.Group();
    const y = heightAt(def.plot.x, def.plot.z);
    group.position.set(def.plot.x, y, def.plot.z);
    group.visible = this.visible;

    const b = new Builder();
    this.build(def, b, level);
    if (construction > 0) this.scaffold(b, def);
    const mesh = b.build();
    if (mesh) {
      mesh.userData.buildingId = def.id;
      mesh.name = `building-${def.id}`;
      group.add(mesh);
      this.pickables.push(mesh);
    }
    if (def.id === 'array' && level > 0) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(1.2 + level * 0.5, 1.36 + level * 0.5, 36),
        new THREE.MeshBasicMaterial({
          color: '#8fd0c4',
          transparent: true,
          opacity: 0.45,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.3;
      ring.userData.buildingId = def.id;
      group.add(ring);
      this.pickables.push(ring);
    }


    this.scene.add(group);
    this.groups.set(def.id, group);
  }

  private build(def: BuildingDef, b: Builder, level: number): void {
    switch (def.id) {
      case 'dorm':
        buildDorm(b, def, level);
        break;
      case 'field':
        buildField(b, level);
        break;
      case 'alchemy':
        buildAlchemy(b, level);
        break;
      case 'sword':
        buildSword(b, level);
        break;
      case 'library':
        buildLibrary(b, def, level);
        break;
      case 'kitchen':
        buildKitchen(b, level);
        break;
      case 'store':
        buildStore(b, level);
        break;
      case 'array':
        buildArray(b, def, level);
        break;
    }
  }

  private scaffold(b: Builder, def: BuildingDef): void {
    const w = def.half.x * 1.6;
    const d = def.half.z * 1.6;
    for (const [x, z] of [
      [-w, -d],
      [w, -d],
      [-w, d],
      [w, d],
    ]) {
      b.box(WOOD, 0.16, 3.2, 0.16, x, 1.6, z);
    }
    b.box(WOOD, w * 2, 0.12, 0.12, 0, 2.2, -d);
    b.box(WOOD, w * 2, 0.12, 0.12, 0, 2.2, d);
    b.box(WOOD, 0.1, 0.1, d * 2, -w, 2.2, 0);
    b.box(WOOD, 0.1, 0.1, d * 2, w, 2.2, 0);
    b.add(new THREE.ConeGeometry(0.2, 0.4, 6), RED, 0, 3.0, 0);
  }

}
