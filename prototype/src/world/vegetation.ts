import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32, randomRange } from '../core/math';
import { grassTexture } from '../core/textures';
import { heightAt, slopeAt } from './terrain';

const inPocketRegion = (x: number, z: number): boolean =>
  Math.hypot(x + 58, z + 20) < 18 ||
  Math.hypot(x - 48, z - 9) < 16 ||
  Math.hypot(x + 48, z - 9) < 16;

const BUILDING_CLEARINGS: Array<[number, number, number]> = [
  [-24, 12, 8],
  [24, 12, 9],
  [30, 4, 7],
  [-30, 4, 8],
  [24, -16, 7],
  [-24, -16, 7],
  [34, 14, 7],
  [0, -30, 8],
];

const inBuildingPlot = (x: number, z: number): boolean =>
  BUILDING_CLEARINGS.some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r);

type WindShader = { uniforms: { uTime: { value: number } } };

function paint(geo: THREE.BufferGeometry, color: THREE.Color): THREE.BufferGeometry {
  const count = geo.attributes.position.count;
  const arr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    arr[i * 3] = color.r;
    arr[i * 3 + 1] = color.g;
    arr[i * 3 + 2] = color.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

function makePineGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const trunk = new THREE.CylinderGeometry(0.07, 0.13, 1.7, 5, 1);
  trunk.translate(0, 0.85, 0);
  parts.push(paint(trunk, new THREE.Color('#4a3524')));

  const layers = [
    { r: 1.05, h: 1.7, y: 1.6, c: '#2e4935' },
    { r: 0.82, h: 1.55, y: 2.45, c: '#38573a' },
    { r: 0.56, h: 1.35, y: 3.2, c: '#436443' },
  ];
  for (const l of layers) {
    const cone = new THREE.ConeGeometry(l.r, l.h, 7, 1);
    cone.translate(0, l.y, 0);
    parts.push(paint(cone, new THREE.Color(l.c)));
  }

  const merged = mergeGeometries(parts, false);
  if (!merged) throw new Error('pine merge failed');
  merged.computeVertexNormals();
  return merged;
}

function makeGrassGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 3; i++) {
    const plane = new THREE.PlaneGeometry(0.62, 0.52, 1, 1);
    plane.translate(0, 0.26, 0);
    plane.rotateY((i / 3) * Math.PI);
    parts.push(plane);
  }
  const merged = mergeGeometries(parts, false);
  if (!merged) throw new Error('grass merge failed');
  return merged;
}

function addWind(
  material: THREE.Material,
  shaders: WindShader[],
  amplitude: number,
  heightStart: number,
  heightEnd: number,
): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      '#include <common>\nuniform float uTime;',
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      /* glsl */ `
        #include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 iOrigin = instanceMatrix[3].xyz;
          float sway = sin(uTime * 1.35 + iOrigin.x * 0.16 + iOrigin.z * 0.11)
                     * ${amplitude.toFixed(3)}
                     * smoothstep(${heightStart.toFixed(2)}, ${heightEnd.toFixed(2)}, transformed.y);
          transformed.x += sway;
          transformed.z += sway * 0.55;
        #endif
      `,
    );
    shaders.push(shader as unknown as WindShader);
  };
}

export class Vegetation {
  private readonly windShaders: WindShader[] = [];
  readonly trees: THREE.InstancedMesh;
  private readonly grass: THREE.InstancedMesh;
  private readonly treeMax: number;
  private readonly grassMax: number;

  constructor(scene: THREE.Scene) {
    const rng = mulberry32(0x7a11_ee);

    // ————— Trees —————
    const treeGeo = makePineGeometry();
    const treeMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.92,
      metalness: 0.0,
    });
    addWind(treeMat, this.windShaders, 0.055, 1.0, 4.2);

    const treeCount = 560;
    this.treeMax = treeCount;
    this.trees = new THREE.InstancedMesh(treeGeo, treeMat, treeCount);
    this.trees.castShadow = true;
    this.trees.receiveShadow = true;
    this.trees.frustumCulled = false;
    this.trees.name = 'pines';

    const dummy = new THREE.Object3D();
    let placed = 0;
    let guard = 0;
    while (placed < treeCount && guard < 12000) {
      guard++;
      const angle = rng() * Math.PI * 2;
      const radius = randomRange(rng, 52, 250);
      const x = Math.cos(angle) * radius;
      const z = -25 + Math.sin(angle) * radius * 0.95;
      const h = heightAt(x, z);

      if (h < -13 || h > 52) continue;
      if (slopeAt(x, z) > 1.15) continue;
      if (Math.abs(x) < 8 && z > -32 && z < 48) continue;
      if (Math.hypot(x, z + 8) < 22) continue;
      if (Math.hypot(x, z + 18) < 15) continue;
      if (Math.hypot(x, z + 52) < 24) continue;
      if (inPocketRegion(x, z) || inBuildingPlot(x, z)) continue;

      const scale = randomRange(rng, 0.75, 1.65);
      dummy.position.set(x, h - 0.05, z);
      dummy.rotation.set(0, rng() * Math.PI * 2, 0);
      dummy.scale.set(scale, scale * randomRange(rng, 0.9, 1.2), scale);
      dummy.updateMatrix();
      this.trees.setMatrixAt(placed, dummy.matrix);
      placed++;
    }
    this.trees.count = placed;

    // A few feature pines on the terrace rim.
    const feature: Array<[number, number, number]> = [
      [-27, 6, 1.35],
      [24, 10, 1.15],
      [-40, -34, 1.45],
      [41, -38, 1.3],
      [-18, -66, 1.2],
      [19, -68, 1.05],
    ];
    for (const [x, z, s] of feature) {
      if (placed >= treeCount) break;
      const h = heightAt(x, z);
      dummy.position.set(x, h - 0.05, z);
      dummy.rotation.set(0, rng() * Math.PI * 2, 0);
      dummy.scale.set(s, s * 1.1, s);
      dummy.updateMatrix();
      this.trees.setMatrixAt(placed, dummy.matrix);
      placed++;
    }
    this.trees.count = placed;
    scene.add(this.trees);

    // ————— Grass —————
    const grassGeo = makeGrassGeometry();
    const grassMat = new THREE.MeshStandardMaterial({
      map: grassTexture(),
      alphaTest: 0.42,
      side: THREE.DoubleSide,
      roughness: 0.95,
      metalness: 0.0,
    });
    addWind(grassMat, this.windShaders, 0.11, 0.05, 0.5);

    const grassCount = 2000;
    this.grassMax = grassCount;
    this.grass = new THREE.InstancedMesh(grassGeo, grassMat, grassCount);
    this.grass.receiveShadow = true;
    this.grass.frustumCulled = false;
    this.grass.name = 'grass';

    let gPlaced = 0;
    guard = 0;
    while (gPlaced < grassCount && guard < 16000) {
      guard++;
      const x = randomRange(rng, -46, 46);
      const z = randomRange(rng, -78, 46);
      const h = heightAt(x, z);
      if (h < -0.2 || h > 1.4) continue;
      if (Math.abs(x) < 4.6 && z > -30 && z < 46) continue;
      if (Math.hypot(x, z + 8) < 18) continue;
      if (Math.hypot(x, z + 18) < 13) continue;
      if (Math.hypot(x, z + 52) < 19) continue;
      if (inPocketRegion(x, z) || inBuildingPlot(x, z)) continue;

      const s = randomRange(rng, 0.7, 1.55);
      dummy.position.set(x, h, z);
      dummy.rotation.set(0, rng() * Math.PI * 2, 0);
      dummy.scale.set(s, s * randomRange(rng, 0.8, 1.25), s);
      dummy.updateMatrix();
      this.grass.setMatrixAt(gPlaced, dummy.matrix);
      gPlaced++;
    }
    this.grass.count = gPlaced;
    scene.add(this.grass);

    // ————— Rocks —————
    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    const rockMat = new THREE.MeshStandardMaterial({
      color: '#6e675b',
      roughness: 0.96,
      metalness: 0.0,
      flatShading: true,
    });
    const rockCount = 90;
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockCount);
    rocks.castShadow = true;
    rocks.receiveShadow = true;
    rocks.frustumCulled = false;
    rocks.name = 'rocks';

    let rPlaced = 0;
    guard = 0;
    while (rPlaced < rockCount && guard < 5000) {
      guard++;
      const x = randomRange(rng, -120, 120);
      const z = randomRange(rng, -150, 80);
      const h = heightAt(x, z);
      if (h < -12 || h > 55) continue;
      if (Math.hypot(x, z + 8) < 20) continue;
      if (Math.abs(x) < 6 && z > -30 && z < 45) continue;
      if (inPocketRegion(x, z) || inBuildingPlot(x, z)) continue;

      const s = randomRange(rng, 0.35, 1.9);
      dummy.position.set(x, h + s * 0.18, z);
      dummy.rotation.set(rng() * 0.4, rng() * Math.PI * 2, rng() * 0.4);
      dummy.scale.set(s, s * randomRange(rng, 0.55, 0.9), s * randomRange(rng, 0.7, 1.1));
      dummy.updateMatrix();
      rocks.setMatrixAt(rPlaced, dummy.matrix);
      rPlaced++;
    }
    rocks.count = rPlaced;
    scene.add(rocks);

    // ————— Wildflowers —————
    const flowerGeo = new THREE.SphereGeometry(0.055, 5, 4);
    const flowerMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: 0.8,
      emissive: '#2a2418',
      emissiveIntensity: 0.3,
    });
    const flowerCount = 260;
    const flowers = new THREE.InstancedMesh(flowerGeo, flowerMat, flowerCount);
    flowers.frustumCulled = false;
    const palette = ['#f0d98a', '#f4efe0', '#e9a5a5', '#d9c6e8'];
    const col = new THREE.Color();
    let fPlaced = 0;
    guard = 0;
    while (fPlaced < flowerCount && guard < 8000) {
      guard++;
      const x = randomRange(rng, -40, 40);
      const z = randomRange(rng, -72, 40);
      const h = heightAt(x, z);
      if (h < -0.2 || h > 1.3) continue;
      if (Math.abs(x) < 4.6 && z > -30 && z < 46) continue;
      if (Math.hypot(x, z + 8) < 17) continue;
      if (inPocketRegion(x, z) || inBuildingPlot(x, z)) continue;

      dummy.position.set(x, h + 0.22, z);
      dummy.rotation.set(0, rng() * Math.PI, 0);
      dummy.scale.setScalar(randomRange(rng, 0.7, 1.5));
      dummy.updateMatrix();
      flowers.setMatrixAt(fPlaced, dummy.matrix);
      col.set(palette[Math.floor(rng() * palette.length) % palette.length]);
      flowers.setColorAt(fPlaced, col);
      fPlaced++;
    }
    flowers.count = fPlaced;
    scene.add(flowers);
  }

  update(time: number): void {
    for (const shader of this.windShaders) shader.uniforms.uTime.value = time;
  }

  setQuality(level: 'high' | 'medium' | 'low'): void {
    const factor = level === 'high' ? 1 : level === 'medium' ? 0.62 : 0.3;
    this.grass.count = Math.floor(this.grassMax * factor);
    this.trees.count = Math.floor(this.treeMax * (level === 'low' ? 0.55 : 1));
  }
}
