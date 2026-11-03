import * as THREE from 'three';
import { glowTexture, petalTexture } from '../core/textures';
import { mulberry32, randomRange } from '../core/math';

export class Particles {
  private readonly petals: THREE.Points;
  private readonly petalPos: Float32Array;
  private readonly petalPhase: Float32Array;

  private readonly dust: THREE.Points;
  private readonly dustPos: Float32Array;
  private readonly dustPhase: Float32Array;

  private readonly fireflies: THREE.Points;
  private readonly fireflyPos: Float32Array;
  private readonly fireflyPhase: Float32Array;
  private readonly fireflyMat: THREE.PointsMaterial;

  private readonly rng = mulberry32(0x9e37_79b9);

  constructor(scene: THREE.Scene) {
    // ————— Petals —————
    const petalCount = 340;
    this.petalPos = new Float32Array(petalCount * 3);
    this.petalPhase = new Float32Array(petalCount);
    for (let i = 0; i < petalCount; i++) {
      this.petalPos[i * 3] = randomRange(this.rng, -35, 35);
      this.petalPos[i * 3 + 1] = randomRange(this.rng, 0.5, 13);
      this.petalPos[i * 3 + 2] = randomRange(this.rng, -40, 30);
      this.petalPhase[i] = this.rng() * Math.PI * 2;
    }
    const petalGeo = new THREE.BufferGeometry();
    petalGeo.setAttribute('position', new THREE.BufferAttribute(this.petalPos, 3));
    this.petals = new THREE.Points(
      petalGeo,
      new THREE.PointsMaterial({
        map: petalTexture(),
        size: 0.2,
        transparent: true,
        depthWrite: false,
        opacity: 0.85,
        color: '#f4d6d4',
        sizeAttenuation: true,
      }),
    );
    this.petals.frustumCulled = false;
    scene.add(this.petals);

    // ————— Dust motes —————
    const dustCount = 220;
    this.dustPos = new Float32Array(dustCount * 3);
    this.dustPhase = new Float32Array(dustCount);
    for (let i = 0; i < dustCount; i++) {
      this.dustPos[i * 3] = randomRange(this.rng, -24, 24);
      this.dustPos[i * 3 + 1] = randomRange(this.rng, 0.5, 9);
      this.dustPos[i * 3 + 2] = randomRange(this.rng, -34, 20);
      this.dustPhase[i] = this.rng() * Math.PI * 2;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(this.dustPos, 3));
    this.dust = new THREE.Points(
      dustGeo,
      new THREE.PointsMaterial({
        map: glowTexture(),
        size: 0.055,
        transparent: true,
        depthWrite: false,
        opacity: 0.32,
        color: '#ffe2b0',
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      }),
    );
    this.dust.frustumCulled = false;
    scene.add(this.dust);

    // ————— Fireflies —————
    const flyCount = 90;
    this.fireflyPos = new Float32Array(flyCount * 3);
    this.fireflyPhase = new Float32Array(flyCount);
    for (let i = 0; i < flyCount; i++) {
      this.fireflyPos[i * 3] = randomRange(this.rng, -36, 36);
      this.fireflyPos[i * 3 + 1] = randomRange(this.rng, 0.35, 2.2);
      this.fireflyPos[i * 3 + 2] = randomRange(this.rng, -60, 30);
      this.fireflyPhase[i] = this.rng() * Math.PI * 2;
    }
    const flyGeo = new THREE.BufferGeometry();
    flyGeo.setAttribute('position', new THREE.BufferAttribute(this.fireflyPos, 3));
    this.fireflyMat = new THREE.PointsMaterial({
      map: glowTexture(),
      size: 0.16,
      transparent: true,
      depthWrite: false,
      opacity: 0,
      color: '#ffd27a',
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    this.fireflies = new THREE.Points(flyGeo, this.fireflyMat);
    this.fireflies.frustumCulled = false;
    scene.add(this.fireflies);
  }

  update(dt: number, time: number, center: THREE.Vector3, night: number): void {
    // Petals drift on a slow wind, wrapping around the player.
    for (let i = 0; i < this.petalPhase.length; i++) {
      const i3 = i * 3;
      const ph = this.petalPhase[i];
      this.petalPos[i3] += (Math.sin(time * 0.55 + ph) * 0.32 + 0.28) * dt;
      this.petalPos[i3 + 1] -= (0.22 + Math.sin(ph) * 0.08) * dt;
      this.petalPos[i3 + 2] += Math.cos(time * 0.47 + ph) * 0.24 * dt;

      if (this.petalPos[i3 + 1] < 0.2) {
        this.petalPos[i3] = center.x + randomRange(this.rng, -30, 30);
        this.petalPos[i3 + 1] = randomRange(this.rng, 8, 15);
        this.petalPos[i3 + 2] = center.z + randomRange(this.rng, -30, 30);
      }
    }
    (this.petals.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;

    // Dust
    for (let i = 0; i < this.dustPhase.length; i++) {
      const i3 = i * 3;
      const ph = this.dustPhase[i];
      this.dustPos[i3] += Math.sin(time * 0.22 + ph) * 0.035 * dt;
      this.dustPos[i3 + 1] += (0.03 + Math.sin(ph) * 0.02) * dt;
      this.dustPos[i3 + 2] += Math.cos(time * 0.19 + ph) * 0.03 * dt;
      if (this.dustPos[i3 + 1] > 10) this.dustPos[i3 + 1] = 0.4;
    }
    (this.dust.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;

    // Fireflies
    this.fireflyMat.opacity = night * 0.85;
    if (night > 0.02) {
      for (let i = 0; i < this.fireflyPhase.length; i++) {
        const i3 = i * 3;
        const ph = this.fireflyPhase[i];
        this.fireflyPos[i3] += Math.sin(time * 0.7 + ph) * 0.05 * dt;
        this.fireflyPos[i3 + 1] += Math.sin(time * 1.1 + ph) * 0.04 * dt;
        this.fireflyPos[i3 + 2] += Math.cos(time * 0.6 + ph) * 0.05 * dt;
      }
      (this.fireflies.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }
  }
}
