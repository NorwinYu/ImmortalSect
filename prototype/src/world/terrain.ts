import * as THREE from 'three';
import { fbm, lerp, noiseA, noiseB, noiseC, noiseD, ridged, smoothstep } from '../core/math';
import { groundTexture } from '../core/textures';

const PLATEAU_CENTER_Z = -30;

/**
 * The single source of truth for the mountain's surface.
 * Everything that walks, grows or is built samples this function.
 */
export function heightAt(x: number, z: number): number {
  const dx = x;
  const dz = (z - PLATEAU_CENTER_Z) * 0.94;
  const dist = Math.hypot(dx, dz);

  // A broad, flat shoulder for the sect; the valley falls away beyond it.
  const plateau = 1 - smoothstep(68, 102, dist);
  let h = -19;

  // Foothills
  h += smoothstep(55, 150, dist) * fbm(noiseC, x * 0.026, z * 0.026, 3) * 8;

  // Mountain ring — ridged noise gives the sharp, layered Chinese silhouette.
  const ring = smoothstep(95, 270, dist);
  const ridge = ridged(noiseA, x * 0.0052 + 11, z * 0.0052 - 7, 5);
  const massif = fbm(noiseB, x * 0.011 - 4, z * 0.011 + 9, 4);
  // A notch behind the main hall opens the valley toward the cloud sea.
  const vista = (1 - smoothstep(48, 115, Math.abs(x))) * smoothstep(-55, -190, z);
  h += ring * (46 + 80 * Math.pow(ridge, 1.35) + 26 * massif) * (1 - vista * 0.72);

  // Flatten the sect terrace.
  h = lerp(h, 0.16, plateau);

  // Gentle unevenness so the plateau never reads as a perfect plane.
  h += plateau * fbm(noiseD, x * 0.105, z * 0.105, 2) * 0.32;

  // The stone path: a shallow, flattened ribbon.
  const inZ = smoothstep(-32, -25, z) * (1 - smoothstep(40, 48, z));
  const inX = 1 - smoothstep(3.4, 5.8, Math.abs(x));
  h = lerp(h, 0.17, inZ * inX * 0.94);

  // Gate apron.
  const gate = 1 - smoothstep(10, 17, Math.hypot(x, z + 18));
  h = lerp(h, 0.2, gate * 0.92);

  // Main hall terrace.
  const hall = 1 - smoothstep(17, 27, Math.hypot(x, (z + 52) * 0.88));
  h = lerp(h, 0.14, hall * 0.9);

  // Plaza, pavilion, bell tower and side halls: flat pads for the architecture.
  const plaza = 1 - smoothstep(16, 25, Math.hypot(x, z + 6));
  h = lerp(h, 0.16, plaza * 0.95);
  const pavilion = 1 - smoothstep(6, 11, Math.hypot(x + 32, z + 28));
  h = lerp(h, 0.16, pavilion * 0.92);
  const tower = 1 - smoothstep(6, 11, Math.hypot(x - 32, z + 30));
  h = lerp(h, 0.16, tower * 0.92);
  const sideHall = 1 - smoothstep(8, 13, Math.hypot(Math.abs(x) - 40, (z + 46) * 0.9));
  h = lerp(h, 0.16, sideHall * 0.9);

  return h;
}

export function slopeAt(x: number, z: number, eps = 1.4): number {
  const hL = heightAt(x - eps, z);
  const hR = heightAt(x + eps, z);
  const hD = heightAt(x, z - eps);
  const hU = heightAt(x, z + eps);
  const nx = hL - hR;
  const nz = hD - hU;
  return Math.hypot(nx, nz) / (2 * eps);
}

export function buildTerrain(scene: THREE.Scene): THREE.Mesh {
  const size = 760;
  const segments = 300;
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  const pos = geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, heightAt(x, z));
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();

  const normals = geometry.attributes.normal as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);

  const grass = new THREE.Color('#5f7a4e');
  const grassDark = new THREE.Color('#455f3f');
  const grassLight = new THREE.Color('#8a9a62');
  const rock = new THREE.Color('#746c5e');
  const rockDark = new THREE.Color('#4f4b43');
  const snow = new THREE.Color('#d9dfe4');
  const dirt = new THREE.Color('#7a6a51');

  const tmp = new THREE.Color();

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const ny = normals.getY(i);

    const n = fbm(noiseD, x * 0.045, z * 0.045, 3) * 0.5 + 0.5;
    tmp.copy(grass).lerp(grassLight, n * 0.45);

    if (y < -4) {
      tmp.lerp(grassDark, smoothstep(-4, -18, y) * 0.75);
    }

    const rockAmount =
      smoothstep(0.72, 0.45, ny) * 0.9 +
      smoothstep(28, 48, y) * 0.35;
    if (rockAmount > 0) {
      tmp.lerp(rock.clone().lerp(rockDark, n), Math.min(rockAmount, 1));
    }

    if (y > 64) {
      const snowAmount = smoothstep(64, 88, y) * smoothstep(0.42, 0.7, ny);
      tmp.lerp(snow, snowAmount * 0.92);
    }

    // Slight dirt tint around the path edges.
    const pathEdge =
      (1 - smoothstep(4, 10, Math.abs(x))) *
      smoothstep(-26, -18, z) *
      (1 - smoothstep(34, 42, z));
    tmp.lerp(dirt, pathEdge * 0.35);

    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const grain = groundTexture();
  grain.repeat.set(110, 110);

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: grain,
    roughness: 0.98,
    metalness: 0.0,
    dithering: true,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  scene.add(mesh);

  return mesh;
}
