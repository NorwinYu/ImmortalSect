import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  bannerTexture,
  latticeTexture,
  plaqueTexture,
  roofNormalTexture,
  roofTexture,
  stoneTexture,
} from '../core/textures';
import { heightAt } from './terrain';

export type Collider =
  | { type: 'circle'; x: number; z: number; r: number }
  | { type: 'box'; x: number; z: number; hx: number; hz: number };

function shadowify(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
}

function makeRoofGeometry(w: number, d: number, h: number, lift: number): THREE.BufferGeometry {
  const sx = 28;
  const sz = 14;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let j = 0; j <= sz; j++) {
    const v = (j / sz) * 2 - 1;
    for (let i = 0; i <= sx; i++) {
      const u = (i / sx) * 2 - 1;
      const y =
        h * (1 - Math.pow(Math.abs(v), 0.82)) +
        lift * Math.pow(Math.abs(u), 6) * Math.pow(Math.abs(v), 2.2);
      positions.push((u * w) / 2, y, (v * d) / 2);
      uvs.push((u + 1) / 2, (v + 1) / 2);
    }
  }
  for (let j = 0; j < sz; j++) {
    for (let i = 0; i < sx; i++) {
      const a = j * (sx + 1) + i;
      const b = a + 1;
      const c = a + sx + 1;
      const dd = c + 1;
      indices.push(a, c, b, b, c, dd);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export class Sect {
  readonly group = new THREE.Group();
  readonly colliders: Collider[] = [];
  private readonly lanternMaterial: THREE.MeshStandardMaterial;
  private readonly windowMaterial: THREE.MeshStandardMaterial;
  private readonly lanternLights: THREE.PointLight[] = [];
  private readonly hallGlow: THREE.PointLight;
  private readonly banners: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene) {
    this.group.name = 'qingyun-sect';

    const woodDark = new THREE.MeshStandardMaterial({ color: '#241a15', roughness: 0.9 });
    const wall = new THREE.MeshStandardMaterial({ color: '#d3c6ae', roughness: 0.96 });
    const stone = new THREE.MeshStandardMaterial({ color: '#7c7466', roughness: 0.95 });
    const stoneDark = new THREE.MeshStandardMaterial({ color: '#555047', roughness: 0.96 });
    const vermilion = new THREE.MeshStandardMaterial({ color: '#8f3a2c', roughness: 0.72 });
    const gold = new THREE.MeshStandardMaterial({
      color: '#c8a15a',
      roughness: 0.32,
      metalness: 0.72,
    });
    const bronze = new THREE.MeshStandardMaterial({
      color: '#7e6a45',
      roughness: 0.5,
      metalness: 0.55,
    });

    const roofTex = roofTexture();
    const roofMat = new THREE.MeshStandardMaterial({
      map: roofTex,
      normalMap: roofNormalTexture(),
      normalScale: new THREE.Vector2(0.9, 0.9),
      color: '#e4ecec',
      roughness: 0.62,
      metalness: 0.14,
      side: THREE.DoubleSide,
    });

    this.lanternMaterial = new THREE.MeshStandardMaterial({
      color: '#ffd2a0',
      emissive: '#ff8a3c',
      emissiveIntensity: 2.2,
      roughness: 0.6,
    });

    const lattice = latticeTexture();
    this.windowMaterial = new THREE.MeshStandardMaterial({
      map: lattice,
      emissive: '#ffae5e',
      emissiveMap: lattice,
      emissiveIntensity: 0.0,
      roughness: 0.85,
    });

    const addBox = (
      parent: THREE.Object3D,
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      mat: THREE.Material,
      ry = 0,
    ): THREE.Mesh => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, y, z);
      mesh.rotation.y = ry;
      parent.add(mesh);
      return mesh;
    };

    const addCyl = (
      parent: THREE.Object3D,
      rt: number,
      rb: number,
      h: number,
      x: number,
      y: number,
      z: number,
      mat: THREE.Material,
      seg = 10,
    ): THREE.Mesh => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
      mesh.position.set(x, y, z);
      parent.add(mesh);
      return mesh;
    };

    const addRoof = (
      parent: THREE.Object3D,
      w: number,
      d: number,
      h: number,
      lift: number,
      x: number,
      y: number,
      z: number,
    ): THREE.Group => {
      const g = new THREE.Group();
      g.position.set(x, y, z);
      const roof = new THREE.Mesh(makeRoofGeometry(w, d, h, lift), roofMat);
      g.add(roof);

      addBox(g, w, 0.22, 0.34, 0, h + 0.02, 0, woodDark);
      addBox(g, 0.26, 0.34, 0.34, -w / 2 + 0.1, h + 0.16, 0, gold);
      addBox(g, 0.26, 0.34, 0.34, w / 2 - 0.1, h + 0.16, 0, gold);

      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const tip = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 5), gold);
          tip.position.set((sx * w) / 2, lift + 0.06, (sz * d) / 2);
          g.add(tip);
        }
      }

      addBox(g, w + 0.3, 0.13, 0.18, 0, 0.02, d / 2, woodDark);
      addBox(g, w + 0.3, 0.13, 0.18, 0, 0.02, -d / 2, woodDark);

      // Exposed rafters under the eaves.
      const rafters: THREE.BufferGeometry[] = [];
      const count = Math.max(4, Math.floor(w / 1.1));
      for (let i = 0; i < count; i++) {
        const x = -w / 2 + (i + 0.5) * (w / count);
        for (const sz of [-1, 1]) {
          const r = new THREE.BoxGeometry(0.16, 0.2, 0.55);
          r.translate(x, -0.16, (sz * d) / 2 - sz * 0.18);
          rafters.push(r);
        }
      }
      const rafterMesh = new THREE.Mesh(mergeBoxes(rafters), woodDark);
      g.add(rafterMesh);

      parent.add(g);
      return g;
    };

    const addPlaque = (text: string, w: number, h: number, x: number, y: number, z: number, parent: THREE.Object3D): void => {
      const mat = new THREE.MeshStandardMaterial({
        map: plaqueTexture(text),
        roughness: 0.62,
        metalness: 0.18,
        emissive: '#2a1c0c',
        emissiveIntensity: 0.25,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      mesh.position.set(x, y, z);
      parent.add(mesh);
    };

    // ————————————————— 山门 —————————————————
    const gate = new THREE.Group();
    gate.position.set(0, 0, -18);
    this.group.add(gate);

    addBox(gate, 22, 0.9, 7.5, 0, 0.62, 0, stone);
    addBox(gate, 23, 0.18, 8.4, 0, 1.13, 0, stoneDark);

    for (const x of [-7.2, -2.5, 2.5, 7.2]) {
      addCyl(gate, 0.34, 0.42, 7.4, x, 4.75, 0, vermilion, 12);
      addBox(gate, 1.15, 0.24, 1.15, x, 1.2, 0, stoneDark);
      this.colliders.push({ type: 'circle', x, z: -18, r: 0.62 });
    }

    addBox(gate, 17.6, 0.52, 0.52, 0, 7.0, 0, woodDark);
    addBox(gate, 17.2, 0.36, 0.4, 0, 6.25, 0, vermilion);
    addBox(gate, 17.0, 0.26, 0.3, 0, 5.55, 0, woodDark);

    addRoof(gate, 9.4, 3.8, 2.15, 0.62, 0, 7.5, 0);
    addRoof(gate, 5.6, 3.3, 1.25, 0.46, -7.4, 6.8, 0);
    addRoof(gate, 5.6, 3.3, 1.25, 0.46, 7.4, 6.8, 0);

    addPlaque('青云', 3.3, 1.15, 0, 6.72, 1.95, gate);

    // Gate steps
    for (let i = 0; i < 4; i++) {
      addBox(gate, 9, 0.18, 0.7, 0, 0.12 + i * 0.16, 4.0 + i * 0.55, stone);
    }

    // Lanterns hanging under the gate
    for (const x of [-4.7, 4.7]) {
      addBox(gate, 0.05, 0.9, 0.05, x, 6.2, 1.4, woodDark);
      addCyl(gate, 0.26, 0.3, 0.52, x, 5.55, 1.4, this.lanternMaterial, 8);
      addCyl(gate, 0.34, 0.34, 0.08, x, 5.83, 1.4, woodDark, 8);
      addCyl(gate, 0.34, 0.34, 0.08, x, 5.27, 1.4, woodDark, 8);
    }

    // Stone lions
    for (const sx of [-1, 1]) {
      const x = sx * 9.4;
      addBox(gate, 1.5, 0.7, 1.5, x, 0.55, 2.4, stoneDark);
      addBox(gate, 1.0, 0.75, 1.2, x, 1.25, 2.4, stone);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.48, 8, 6), stone);
      head.position.set(x, 1.95, 2.7);
      gate.add(head);
      const mane = new THREE.Mesh(new THREE.SphereGeometry(0.56, 8, 6), stoneDark);
      mane.position.set(x, 1.92, 2.6);
      mane.scale.set(1, 1, 0.7);
      gate.add(mane);
      this.colliders.push({ type: 'circle', x, z: -15.6, r: 0.9 });
    }

    // ————————————————— 主殿 —————————————————
    const hall = new THREE.Group();
    hall.position.set(0, 5.2, -58);
    this.group.add(hall);

    // Stone terrace lifts the hall so it reads above the gate.
    const foundationTex = stoneTexture().clone();
    foundationTex.needsUpdate = true;
    foundationTex.repeat.set(9, 3);
    const foundationMat = new THREE.MeshStandardMaterial({
      map: foundationTex,
      color: '#c9bda8',
      roughness: 0.94,
      metalness: 0.0,
    });
    addBox(hall, 44, 5.2, 30, 0, -2.6, 0, foundationMat);
    addBox(hall, 45, 0.24, 31, 0, 0.04, 0, stoneDark);

    // Pilasters break up the retaining wall.
    for (const x of [-20, -13.5, -7, 7, 13.5, 20]) {
      addBox(hall, 0.55, 5.2, 0.6, x, -2.6, 15.2, stoneDark);
    }
    for (const z of [-12, -6, 0, 6, 12]) {
      addBox(hall, 0.6, 5.2, 0.55, -22.2, -2.6, z, stoneDark);
      addBox(hall, 0.6, 5.2, 0.55, 22.2, -2.6, z, stoneDark);
    }

    // A few shrubs soften the base.
    const shrubMat = new THREE.MeshStandardMaterial({ color: '#3f5b3a', roughness: 0.95 });
    for (const [x, z, s] of [
      [-19, 16.2, 1.2],
      [-6, 16.4, 0.9],
      [8, 16.2, 1.0],
      [19, 16.1, 1.3],
      [-23, 5, 1.1],
    ] as const) {
      const shrub = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), shrubMat);
      shrub.position.set(x, -0.1, z);
      shrub.scale.y = 0.7;
      hall.add(shrub);
    }

    addBox(hall, 34, 1.45, 24, 0, 0.72, 0, stone);
    addBox(hall, 32, 0.22, 22, 0, 1.52, 0, stoneDark);

    for (let i = 0; i < 18; i++) {
      addBox(this.group, 10, 0.3, 0.66, 0, 0.16 + i * 0.29, -34 - i * 0.64, stone);
    }
    addBox(this.group, 10, 0.12, 14, 0, 0.21, -27.5, stoneDark);

    const colX = [-13.2, -8.8, -4.4, 0, 4.4, 8.8, 13.2];
    for (const x of colX) {
      addCyl(hall, 0.36, 0.44, 7.4, x, 5.25, 7.0, vermilion, 12);
      addCyl(hall, 0.36, 0.44, 7.4, x, 5.25, -7.0, vermilion, 12);
      addBox(hall, 1.2, 0.24, 1.2, x, 1.66, 7.0, stoneDark);
      addBox(hall, 1.2, 0.24, 1.2, x, 1.66, -7.0, stoneDark);
      this.colliders.push({ type: 'circle', x, z: -51, r: 0.6 });
      this.colliders.push({ type: 'circle', x, z: -65, r: 0.6 });
    }

    addBox(hall, 30, 7.0, 0.55, 0, 5.2, -10.6, wall);
    addBox(hall, 0.55, 7.0, 18, -14.6, 5.2, 0, wall);
    addBox(hall, 0.55, 7.0, 18, 14.6, 5.2, 0, wall);

    // Front bays: alternating wall + lattice.
    for (let i = 0; i < 6; i++) {
      const x = -13.2 + 4.4 * i + 2.2;
      if (i === 2 || i === 3) continue;
      addBox(hall, 3.5, 4.6, 0.5, x, 3.4, 10.4, wall);
      const win = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.2), this.windowMaterial);
      win.position.set(x, 5.4, 10.7);
      hall.add(win);
      const win2 = win.clone();
      win2.position.z = 10.68;
      win2.scale.setScalar(0.98);
      hall.add(win2);
    }

    // Central doors
    for (const sx of [-1, 1]) {
      addBox(hall, 2.1, 4.6, 0.4, sx * 2.2, 3.4, 10.35, woodDark);
    }
    addBox(hall, 9.6, 0.7, 0.6, 0, 6.0, 10.45, woodDark);
    addBox(hall, 9.6, 0.4, 0.5, 0, 1.9, 10.45, gold);

    addRoof(hall, 34, 23, 4.3, 0.95, 0, 8.95, 0);
    addRoof(hall, 22, 13.2, 3.3, 0.8, 0, 12.15, 0);

    addPlaque('青云殿', 4.4, 1.45, 0, 7.95, 10.9, hall);

    // White stone balustrade around the terrace.
    const railParts: THREE.BufferGeometry[] = [];
    const postAt = (x: number, z: number): void => {
      const g = new THREE.BoxGeometry(0.2, 1.0, 0.2);
      g.translate(x, 1.95, z);
      railParts.push(g);
    };
    const railAt = (x: number, z: number, len: number, horizontal: boolean): void => {
      const g = new THREE.BoxGeometry(horizontal ? len : 0.16, 0.12, horizontal ? 0.16 : len);
      g.translate(x, 2.42, z);
      railParts.push(g);
    };
    for (let x = -21; x <= 21.01; x += 2.1) {
      if (Math.abs(x) < 6.2) continue;
      postAt(x, 11.6);
    }
    for (let x = -20; x < 21; x += 2.1) {
      if (Math.abs(x + 1.05) < 6.2) continue;
      railAt(x + 1.05, 11.6, 2.0, true);
    }
    for (const sx of [-1, 1]) {
      for (let z = -14.4; z <= 11.6; z += 2.1) postAt(sx * 21.7, z);
      for (let z = -14.4; z < 11.6; z += 2.1) railAt(sx * 21.7, z + 1.05, 2.0, false);
    }
    const railMesh = new THREE.Mesh(mergeBoxes(railParts), stone);
    hall.add(railMesh);

    this.colliders.push({ type: 'box', x: 0, z: -58, hx: 23, hz: 16 });

    // Lanterns along the front columns
    for (const x of [-4.4, 4.4]) {
      addCyl(hall, 0.3, 0.34, 0.6, x, 4.9, 10.9, this.lanternMaterial, 8);
      addCyl(hall, 0.38, 0.38, 0.08, x, 5.2, 10.9, woodDark, 8);
    }

    // ————————————————— 侧殿 —————————————————
    for (const sx of [-1, 1]) {
      const side = new THREE.Group();
      side.position.set(sx * 40, 0, -46);
      this.group.add(side);
      addBox(side, 15, 0.9, 13, 0, 0.45, 0, stone);
      for (const x of [-5, 0, 5]) {
        addCyl(side, 0.26, 0.32, 4.4, x, 3.0, 4.2, vermilion, 10);
      }
      addBox(side, 14.5, 4.4, 0.4, 0, 3.0, -4.6, wall);
      addBox(side, 0.4, 4.4, 9.2, -7.1, 3.0, 0, wall);
      addBox(side, 0.4, 4.4, 9.2, 7.1, 3.0, 0, wall);
      addRoof(side, 17, 14.5, 2.6, 0.6, 0, 5.4, 0);
      this.colliders.push({ type: 'box', x: sx * 40, z: -46, hx: 8, hz: 7 });
    }

    // ————————————————— 六角亭 —————————————————
    const pavilion = new THREE.Group();
    pavilion.position.set(-32, 0, -28);
    this.group.add(pavilion);

    const pavBase = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 5.9, 0.6, 6), stone);
    pavBase.position.y = 0.3;
    pavilion.add(pavBase);

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      addCyl(pavilion, 0.2, 0.24, 4.4, Math.cos(a) * 4.3, 2.8, Math.sin(a) * 4.3, vermilion, 8);
    }

    const roofProfile: THREE.Vector2[] = [
      new THREE.Vector2(6.1, 0),
      new THREE.Vector2(5.6, 0.7),
      new THREE.Vector2(4.5, 1.5),
      new THREE.Vector2(3.0, 2.3),
      new THREE.Vector2(1.3, 2.9),
      new THREE.Vector2(0.06, 3.15),
    ];
    const pavRoof = new THREE.Mesh(
      new THREE.LatheGeometry(roofProfile, 18),
      roofMat,
    );
    pavRoof.position.y = 5.0;
    pavilion.add(pavRoof);

    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), gold);
    finial.position.y = 8.35;
    pavilion.add(finial);

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const x1 = Math.cos(a) * 5.2;
      const z1 = Math.sin(a) * 5.2;
      addBox(pavilion, 1.5, 0.55, 0.35, x1 * 0.85, 1.0, z1 * 0.85, stoneDark, -a);
    }
    this.colliders.push({ type: 'circle', x: -32, z: -28, r: 6.2 });

    // ————————————————— 钟楼 —————————————————
    const tower = new THREE.Group();
    tower.position.set(32, 0, -30);
    this.group.add(tower);

    addBox(tower, 9, 5.2, 9, 0, 2.6, 0, stone);
    addBox(tower, 7.6, 0.4, 7.6, 0, 5.3, 0, woodDark);
    for (const x of [-3, 3]) {
      for (const z of [-3, 3]) {
        addCyl(tower, 0.22, 0.26, 3.6, x, 7.2, z, vermilion, 8);
      }
    }
    addBox(tower, 7.4, 0.5, 0.5, 0, 9.1, 0, woodDark);
    addBox(tower, 0.5, 0.5, 7.4, 0, 9.1, 0, woodDark);
    addRoof(tower, 10.5, 10.5, 2.4, 0.7, 0, 9.5, 0);

    const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.85, 1.5, 12), bronze);
    bell.position.set(0, 7.6, 0);
    tower.add(bell);
    const bellTop = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.08, 6, 10), bronze);
    bellTop.rotation.x = Math.PI / 2;
    bellTop.position.set(0, 8.4, 0);
    tower.add(bellTop);
    this.colliders.push({ type: 'box', x: 32, z: -30, hx: 5, hz: 5 });

    // ————————————————— 山墙 —————————————————
    const wallGeoParts: THREE.BufferGeometry[] = [];
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 14; i++) {
        const z = -14 - i * 5;
        const y = heightAt(sx * 50, z);
        const g = new THREE.BoxGeometry(0.7, 2.4, 5.1);
        g.translate(sx * 50, y + 1.2, z);
        wallGeoParts.push(g);
      }
    }
    const wallGeo = mergeBoxes(wallGeoParts);
    const wallMesh = new THREE.Mesh(wallGeo, stone);
    this.group.add(wallMesh);
    this.colliders.push({ type: 'box', x: -50, z: -46, hx: 0.8, hz: 33 });
    this.colliders.push({ type: 'box', x: 50, z: -46, hx: 0.8, hz: 33 });

    // ————————————————— 道路与广场 —————————————————
    const pathTex = stoneTexture().clone();
    pathTex.needsUpdate = true;
    pathTex.repeat.set(1.8, 9.0);
    const pathMat = new THREE.MeshStandardMaterial({
      map: pathTex,
      color: '#e9dcc6',
      roughness: 0.88,
      metalness: 0.0,
    });
    const pathGeo = makePathGeometry();
    const path = new THREE.Mesh(pathGeo, pathMat);
    path.receiveShadow = true;
    this.group.add(path);


    const plazaTex = stoneTexture().clone();
    plazaTex.needsUpdate = true;
    plazaTex.repeat.set(7, 7);
    const plazaMat = new THREE.MeshStandardMaterial({
      map: plazaTex,
      color: '#e0d2b8',
      roughness: 0.93,
      metalness: 0.0,
    });
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(19, 56), plazaMat);
    plaza.rotation.x = -Math.PI / 2;
    plaza.position.set(0, 0.28, -6);
    plaza.receiveShadow = true;
    this.group.add(plaza);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(19.2, 0.14, 4, 72), stoneDark);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 0.31, -6);
    this.group.add(ring);

    // ————————————————— 石灯 —————————————————
    const lanternSpots: Array<[number, number]> = [
      [-4.8, 38],
      [4.8, 38],
      [-4.8, 22],
      [4.8, 22],
      [-4.8, 2],
      [4.8, 2],
      [-12, -10],
      [12, -10],
    ];
    for (let i = 0; i < lanternSpots.length; i++) {
      const [x, z] = lanternSpots[i];
      const y = heightAt(x, z);
      const g = new THREE.Group();
      g.position.set(x, y, z);
      addBox(g, 0.8, 0.18, 0.8, 0, 0.09, 0, stoneDark);
      addCyl(g, 0.12, 0.16, 1.9, 0, 1.05, 0, stone, 8);
      addBox(g, 0.5, 0.55, 0.5, 0, 2.2, 0, this.lanternMaterial);
      addCyl(g, 0.38, 0.46, 0.18, 0, 2.55, 0, stoneDark, 6);
      this.group.add(g);
      this.colliders.push({ type: 'circle', x, z, r: 0.5 });
    }

    // A few warm lights, budget-conscious.
    for (const [x, z] of [
      [0, -12],
      [0, -44],
      [-4.7, -16.4],
      [0, -52],
    ]) {
      const light = new THREE.PointLight('#ff9a4e', 0, 22, 2);
      light.position.set(x, 3.2, z);
      this.group.add(light);
      this.lanternLights.push(light);
    }

    this.hallGlow = new THREE.PointLight('#ffb066', 16, 42, 2);
    this.hallGlow.position.set(0, 9.0, -56);
    this.group.add(this.hallGlow);

    // ————————————————— 香炉 —————————————————
    const ding = new THREE.Group();
    ding.position.set(0, 0.24, -6);
    this.group.add(ding);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.15, 1.1, 14), bronze);
    body.position.y = 1.25;
    ding.add(body);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.09, 6, 18), gold);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 1.82;
    ding.add(rim);
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      addCyl(ding, 0.11, 0.14, 0.8, Math.cos(a) * 0.62, 0.4, Math.sin(a) * 0.62, bronze, 6);
    }
    for (const sx of [-1, 1]) {
      const handle = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.06, 5, 10), bronze);
      handle.position.set(sx * 1.05, 1.5, 0);
      handle.rotation.y = Math.PI / 2;
      ding.add(handle);
    }
    this.colliders.push({ type: 'circle', x: 0, z: -6, r: 1.4 });

    // ————————————————— 旗幡 —————————————————
    const bannerMat = new THREE.MeshStandardMaterial({
      map: bannerTexture('青云'),
      side: THREE.DoubleSide,
      roughness: 0.9,
      metalness: 0.0,
      transparent: false,
    });
    for (const sx of [-1, 1]) {
      const x = sx * 10.8;
      addCyl(this.group, 0.08, 0.11, 6.8, x, 3.5, -17.5, woodDark, 8);
      const banner = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 4.5, 6, 12), bannerMat);
      banner.position.set(x - sx * 0.65, 4.1, -17.5);
      banner.rotation.y = sx * 0.08;
      banner.userData.dynamic = true;
      this.banners.push(banner);
      this.group.add(banner);
    }

    scene.add(this.group);

    // Collapse the static architecture into one mesh per material. This is the
    // difference between a few hundred draw calls and a few dozen.
    const merged = collapseStatic(this.group);
    shadowify(this.group);

    const pathMesh = merged.get(pathMat);
    if (pathMesh) {
      pathMesh.castShadow = false;
      pathMesh.receiveShadow = true;
    }
    const plazaMesh = merged.get(plazaMat);
    if (plazaMesh) {
      plazaMesh.castShadow = false;
      plazaMesh.receiveShadow = true;
    }
  }

  update(night: number, time: number): void {
    this.lanternMaterial.emissiveIntensity = 1.1 + night * 2.8;
    this.windowMaterial.emissiveIntensity = 0.06 + night * 0.95;
    for (const light of this.lanternLights) {
      light.intensity = night * 58;
    }
    this.hallGlow.intensity = 9 + night * 40;
    this.banners.forEach((banner, i) => {
      banner.rotation.y = (i === 0 ? -1 : 1) * 0.08 + Math.sin(time * 0.9 + i * 2.1) * 0.045;
      banner.rotation.z = Math.sin(time * 1.3 + i) * 0.012;
    });
  }
}

function collapseStatic(group: THREE.Group): Map<THREE.Material, THREE.Mesh> {
  group.updateMatrixWorld(true);
  const byMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const originals: THREE.Mesh[] = [];

  group.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    if (obj.userData.dynamic) return;
    const material = obj.material as THREE.Material;
    if (Array.isArray(material)) return;

    const geo = obj.geometry.clone();
    geo.applyMatrix4(obj.matrixWorld);
    const list = byMaterial.get(material) ?? [];
    list.push(geo);
    byMaterial.set(material, list);
    originals.push(obj);
  });

  for (const mesh of originals) mesh.parent?.remove(mesh);

  const mergedMeshes = new Map<THREE.Material, THREE.Mesh>();
  for (const [material, geometries] of byMaterial) {
    const mergedGeo = mergeGeometries(geometries, false);
    if (!mergedGeo) continue;
    const mesh = new THREE.Mesh(mergedGeo, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = 'sect-static';
    group.add(mesh);
    mergedMeshes.set(material, mesh);
  }
  return mergedMeshes;
}

function makePathGeometry(): THREE.BufferGeometry {
  const segs = 90;
  const width = 4.8;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const z = 44 - t * 70;
    const y = heightAt(0, z) + 0.2;
    const wobble = Math.sin(t * 9.0) * 0.18;
    positions.push(-width / 2 + wobble, y, z);
    positions.push(width / 2 + wobble, y, z);
    uvs.push(0, t * 12);
    uvs.push(1, t * 12);
    if (i < segs) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function mergeBoxes(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = new THREE.BufferGeometry();
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  let offset = 0;
  for (const g of parts) {
    const p = g.attributes.position;
    const n = g.attributes.normal;
    const uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      positions.push(p.getX(i), p.getY(i), p.getZ(i));
      normals.push(n.getX(i), n.getY(i), n.getZ(i));
      uvs.push(uv.getX(i), uv.getY(i));
    }
    const idx = g.index;
    if (idx) {
      for (let i = 0; i < idx.count; i++) indices.push(idx.getX(i) + offset);
    }
    offset += p.count;
  }
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  merged.setIndex(indices);
  return merged;
}
