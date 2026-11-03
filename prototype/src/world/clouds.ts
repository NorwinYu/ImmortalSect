import * as THREE from 'three';
import { cloudTexture, glowTexture } from '../core/textures';
import { mulberry32, randomRange } from '../core/math';

type SeaLayer = {
  mesh: THREE.Mesh;
  driftX: number;
  driftY: number;
};

export class Clouds {
  private readonly layers: SeaLayer[] = [];
  private readonly mists: THREE.Sprite[] = [];
  private readonly mistBase: number[] = [];

  constructor(scene: THREE.Scene) {
    const tex = cloudTexture();

    const specs = [
      { y: -11.2, size: 1240, opacity: 0.5, color: '#f6e3c8', drift: 0.0016 },
      { y: -16.4, size: 980, opacity: 0.62, color: '#f6e3c8', drift: 0.0022 },
      { y: -14.7, size: 760, opacity: 0.46, color: '#f3dcc0', drift: 0.0034 },
      { y: -12.9, size: 540, opacity: 0.32, color: '#efd3b4', drift: 0.0048 },
    ];

    for (let i = 0; i < specs.length; i++) {
      const s = specs[i];
      const map = tex.clone();
      map.needsUpdate = true;
      map.wrapS = THREE.RepeatWrapping;
      map.wrapT = THREE.RepeatWrapping;
      map.repeat.set(2.4, 2.4);
      map.offset.set(i * 0.27, i * 0.41);

      const mat = new THREE.MeshBasicMaterial({
        map,
        transparent: true,
        opacity: s.opacity,
        depthWrite: false,
        color: s.color,
        fog: true,
        side: THREE.DoubleSide,
      });

      const geo = new THREE.PlaneGeometry(s.size, s.size, 1, 1);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.rotation.z = i * 0.35;
      mesh.position.set(0, s.y, -20);
      mesh.renderOrder = 4 + i;
      mesh.frustumCulled = false;
      scene.add(mesh);

      this.layers.push({ mesh, driftX: s.drift, driftY: s.drift * 0.4 });
    }

    // Low mist banks hugging the plateau rim.
    const rng = mulberry32(0xc10d);
    const mistMat = new THREE.SpriteMaterial({
      map: tex,
      color: '#f7e6ce',
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      fog: true,
    });

    for (let i = 0; i < 20; i++) {
      const sprite = new THREE.Sprite(mistMat.clone());
      const angle = (i / 20) * Math.PI * 2 + 0.3;
      const r = randomRange(rng, 64, 122);
      sprite.position.set(Math.cos(angle) * r, randomRange(rng, -2, 6), -20 + Math.sin(angle) * r);
      const s = randomRange(rng, 44, 92);
      sprite.scale.set(s, s * 0.38, 1);
      sprite.material.opacity = randomRange(rng, 0.07, 0.15);
      sprite.renderOrder = 3;
      scene.add(sprite);
      this.mists.push(sprite);
      this.mistBase.push(sprite.position.y);
    }

    // A low sun glow behind the western ridge.
    const sunGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture(),
        color: '#ffb36b',
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      }),
    );
    sunGlow.position.set(-280, 52, -270);
    sunGlow.scale.set(240, 240, 1);
    sunGlow.renderOrder = 0;
    scene.add(sunGlow);

    // A high, wide cloud bank across the visible sky.
    for (let i = 0; i < 3; i++) {
      const sprite = new THREE.Sprite(mistMat.clone());
      sprite.position.set(-260 + i * 260, 86 + (i % 2) * 16, -280);
      sprite.scale.set(460, 96, 1);
      sprite.material.opacity = 0.16;
      sprite.material.color.set('#ffd9b2');
      sprite.renderOrder = 1;
      scene.add(sprite);
    }

    // Low sky clouds in front of the ridge, so the sky never reads as a flat gradient.
    for (let i = 0; i < 4; i++) {
      const sprite = new THREE.Sprite(mistMat.clone());
      sprite.position.set(-240 + i * 165, 52 + (i % 2) * 14, -230 - (i % 2) * 30);
      sprite.scale.set(240 + i * 26, 54 + (i % 2) * 16, 1);
      sprite.material.opacity = 0.2 + (i % 2) * 0.06;
      sprite.material.color.set('#f4d2ae');
      sprite.renderOrder = 1;
      scene.add(sprite);
    }

    // High cloud banks above the ridgeline.
    for (let i = 0; i < 6; i++) {
      const sprite = new THREE.Sprite(mistMat.clone());
      sprite.position.set(-360 + i * 145, 118 + (i % 3) * 30, -520 - (i % 2) * 60);
      sprite.scale.set(260 + i * 26, 62 + (i % 3) * 18, 1);
      sprite.material.opacity = 0.14 + (i % 2) * 0.05;
      sprite.material.color.set(i % 2 === 0 ? '#f6d8b8' : '#e4cdb4');
      sprite.renderOrder = 1;
      scene.add(sprite);
    }

    // Horizontal cloud bands between the distant peaks.
    for (const [x, y, z, w, h, o] of [
      [-60, 30, -300, 420, 72, 0.16],
      [80, 46, -420, 520, 90, 0.13],
      [0, 24, -340, 360, 58, 0.12],
      [-40, 10, -170, 320, 44, 0.16],
      [60, 14, -210, 380, 52, 0.14],
    ] as const) {
      const sprite = new THREE.Sprite(mistMat.clone());
      sprite.position.set(x, y, z);
      sprite.scale.set(w, h, 1);
      sprite.material.opacity = o;
      sprite.material.color.set('#e8d4b8');
      sprite.renderOrder = 2;
      scene.add(sprite);
    }
  }

  update(dt: number, time: number): void {
    for (const layer of this.layers) {
      const mat = layer.mesh.material as THREE.MeshBasicMaterial;
      if (mat.map) {
        mat.map.offset.x += layer.driftX * dt;
        mat.map.offset.y += layer.driftY * dt;
      }
    }

    this.mists.forEach((sprite, i) => {
      sprite.position.y = this.mistBase[i] + Math.sin(time * 0.12 + i * 1.7) * 0.5;
    });
  }
}
