import * as THREE from 'three';
import { fbm, mulberry32 } from '../core/math';
import { createNoise2D } from 'simplex-noise';

type LayerSpec = {
  z: number;
  width: number;
  height: number;
  color: string;
  seed: number;
  snow: number;
};

const LAYERS: LayerSpec[] = [
  { z: -300, width: 1100, height: 98, color: '#5d7078', seed: 11, snow: 0.78 },
  { z: -430, width: 1400, height: 138, color: '#6f828a', seed: 27, snow: 0.74 },
  { z: -610, width: 1800, height: 182, color: '#87979e', seed: 41, snow: 0.7 },
];

function ridgeLayer(spec: LayerSpec): THREE.Mesh {
  const noise = createNoise2D(mulberry32(spec.seed));
  const seg = 120;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const baseY = -34;
  const topColor = new THREE.Color(spec.color);
  const bottomColor = topColor.clone().multiplyScalar(0.5);
  const snowColor = new THREE.Color('#dbe3e8');
  const c = new THREE.Color();

  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const x = -spec.width / 2 + spec.width * t;
    const n = fbm(noise, x * 0.0058, 0, 4) * 0.5 + 0.5;
    const ridge = Math.pow(n, 1.15);
    const peak = spec.height * (0.32 + 0.68 * ridge);
    const zz = spec.z + fbm(noise, x * 0.013, 3.7, 3) * 26;
    const top = baseY + peak;

    positions.push(x, baseY, zz, x, top, zz);

    bottomColor.clone();
    colors.push(bottomColor.r, bottomColor.g, bottomColor.b);

    c.copy(topColor);
    if (peak > spec.height * spec.snow) {
      c.lerp(snowColor, (peak - spec.height * spec.snow) / (spec.height * (1 - spec.snow)) * 0.85);
    }
    colors.push(c.r, c.g, c.b);

    if (i < seg) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.DoubleSide,
    fog: true,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return mesh;
}

export function buildMountains(scene: THREE.Scene): THREE.Group {
  const group = new THREE.Group();
  group.name = 'distant-mountains';
  for (const spec of LAYERS) group.add(ridgeLayer(spec));
  scene.add(group);
  return group;
}
