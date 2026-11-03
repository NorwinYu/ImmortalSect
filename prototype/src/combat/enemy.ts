import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { clamp, damp } from '../core/math';
import { heightAt } from '../world/terrain';

export type PuppetState = 'dormant' | 'chase' | 'windup' | 'strike' | 'recover' | 'stagger' | 'dead';

type HitResult = { dead: boolean; staggered: boolean };

/**
 * 试剑傀儡 — a bound sword-puppet used to test disciples.
 * Slow, readable, heavy; its telegraph is the lesson.
 */
export class SwordPuppet {
  readonly group = new THREE.Group();
  readonly maxHp = 900;
  readonly maxPoise = 120;

  hp = 900;
  poise = 120;
  private hpScale = 1;
  state: PuppetState = 'dormant';

  private stateTime = 0;
  private cooldown = 1.2;
  private staggerTimer = 0;
  private hitFlash = 0;
  private poiseIdle = 0;
  private bob = 0;

  private readonly body = new THREE.Group();
  private readonly armR = new THREE.Group();
  private readonly armL = new THREE.Group();
  private readonly head = new THREE.Group();
  private readonly legL = new THREE.Group();
  private readonly legR = new THREE.Group();
  private readonly runeMat: THREE.MeshStandardMaterial;
  private readonly eyeMat: THREE.MeshStandardMaterial;
  private runeOrig = { color: '#ff7a45', emissive: '#ff4a22', intensity: 0.1 };
  private eyeOrig = { color: '#ffb28a', emissive: '#ff3b1c', intensity: 0.15 };
  private readonly telegraph: THREE.Mesh;
  private readonly telegraphMat: THREE.MeshBasicMaterial;
  private readonly arenaMat: THREE.MeshBasicMaterial;
  private readonly groundY: number;
  private idleMesh: THREE.Mesh | null = null;

  constructor(scene: THREE.Scene, x: number, z: number) {
    this.groundY = heightAt(x, z);
    this.group.position.set(x, this.groundY, z);
    this.group.name = 'sword-puppet';
    scene.add(this.group);

    const wood = new THREE.MeshStandardMaterial({ color: '#3a2a20', roughness: 0.9 });
    const woodDark = new THREE.MeshStandardMaterial({ color: '#221812', roughness: 0.95 });
    const bronze = new THREE.MeshStandardMaterial({
      color: '#8a6a3e',
      roughness: 0.42,
      metalness: 0.62,
    });
    const steel = new THREE.MeshStandardMaterial({
      color: '#aeb8bd',
      roughness: 0.32,
      metalness: 0.8,
    });
    const cloth = new THREE.MeshStandardMaterial({
      color: '#2b3737',
      roughness: 0.95,
      side: THREE.DoubleSide,
    });

    this.runeMat = new THREE.MeshStandardMaterial({
      color: '#ff7a45',
      emissive: '#ff4a22',
      emissiveIntensity: 0.1,
      roughness: 0.5,
    });
    this.eyeMat = new THREE.MeshStandardMaterial({
      color: '#ffb28a',
      emissive: '#ff3b1c',
      emissiveIntensity: 0.15,
      roughness: 0.4,
    });
    this.runeOrig = { color: '#ff7a45', emissive: '#ff4a22', intensity: 0.1 };
    this.eyeOrig = { color: '#ffb28a', emissive: '#ff3b1c', intensity: 0.15 };

    this.group.add(this.body);

    const add = (
      parent: THREE.Object3D,
      geo: THREE.BufferGeometry,
      material: THREE.Material,
      x: number,
      y: number,
      z: number,
    ): THREE.Mesh => {
      const mesh = new THREE.Mesh(geo, material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    };

    // Legs
    for (const [side, leg] of [
      [-1, this.legL],
      [1, this.legR],
    ] as const) {
      leg.position.set(side * 0.18, 0.92, 0);
      this.body.add(leg);
      add(leg, new THREE.CylinderGeometry(0.07, 0.085, 0.86, 7), wood, 0, -0.43, 0);
      add(leg, new THREE.SphereGeometry(0.095, 8, 6), bronze, 0, -0.86, 0);
      add(leg, new THREE.BoxGeometry(0.15, 0.09, 0.3), woodDark, 0, -0.95, 0.07);
    }

    // Pelvis + spine + chest
    add(this.body, new THREE.BoxGeometry(0.46, 0.2, 0.3), woodDark, 0, 1.0, 0);
    add(this.body, new THREE.CylinderGeometry(0.11, 0.15, 0.55, 8), wood, 0, 1.32, 0);
    add(this.body, new THREE.BoxGeometry(0.5, 0.58, 0.34), wood, 0, 1.66, 0);
    add(this.body, new THREE.BoxGeometry(0.54, 0.08, 0.38), bronze, 0, 1.92, 0);

    // Ribs
    for (let i = 0; i < 4; i++) {
      add(this.body, new THREE.BoxGeometry(0.46, 0.045, 0.36), bronze, 0, 1.48 + i * 0.11, 0);
    }

    // Runes
    for (let i = 0; i < 3; i++) {
      add(this.body, new THREE.BoxGeometry(0.035, 0.2, 0.012), this.runeMat, -0.1 + i * 0.1, 1.68, 0.178);
    }

    // Tattered robe
    const robe = new THREE.Mesh(
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0.38, 0.5),
          new THREE.Vector2(0.36, 0.68),
          new THREE.Vector2(0.31, 0.88),
          new THREE.Vector2(0.26, 1.02),
        ],
        14,
      ),
      cloth,
    );
    this.body.add(robe);

    // Head
    this.head.position.y = 2.02;
    this.body.add(this.head);
    add(this.head, new THREE.CylinderGeometry(0.07, 0.08, 0.16, 8), bronze, 0, -0.05, 0);
    add(this.head, new THREE.BoxGeometry(0.26, 0.32, 0.24), bronze, 0, 0.16, 0);
    add(this.head, new THREE.BoxGeometry(0.28, 0.06, 0.26), woodDark, 0, 0.32, 0);

    for (const sx of [-1, 1]) {
      add(this.head, new THREE.SphereGeometry(0.028, 8, 6), this.eyeMat, sx * 0.065, 0.18, 0.125);
    }
    add(this.head, new THREE.BoxGeometry(0.1, 0.018, 0.02), woodDark, 0, 0.08, 0.128);

    const hat = add(
      this.head,
      new THREE.ConeGeometry(0.46, 0.22, 12, 1, true),
      cloth,
      0,
      0.46,
      0,
    );
    hat.rotation.x = 0.12;
    hat.rotation.z = -0.08;

    // Shoulders + arms
    for (const [side, arm] of [
      [-1, this.armL],
      [1, this.armR],
    ] as const) {
      add(this.body, new THREE.SphereGeometry(0.14, 8, 6), bronze, side * 0.36, 1.84, 0);
      arm.position.set(side * 0.38, 1.8, 0);
      this.body.add(arm);
      add(arm, new THREE.CylinderGeometry(0.07, 0.08, 0.68, 7), wood, 0, -0.34, 0);
      add(arm, new THREE.SphereGeometry(0.09, 8, 6), bronze, 0, -0.68, 0);
      add(arm, new THREE.CylinderGeometry(0.055, 0.065, 0.55, 7), wood, 0, -0.95, 0);
      add(arm, new THREE.BoxGeometry(0.11, 0.13, 0.12), bronze, 0, -1.25, 0);

      for (let f = 0; f < 3; f++) {
        const claw = add(
          arm,
          new THREE.ConeGeometry(0.022, 0.2, 5),
          bronze,
          -0.05 + f * 0.05,
          -1.38,
          0.02,
        );
        claw.rotation.x = Math.PI;
      }
    }

    // Sword
    const sword = new THREE.Group();
    sword.position.set(0, -1.22, 0);
    sword.rotation.x = -0.2;
    this.armR.add(sword);

    add(sword, new THREE.BoxGeometry(0.07, 1.45, 0.02), steel, 0, -0.75, 0);
    add(sword, new THREE.BoxGeometry(0.22, 0.03, 0.06), bronze, 0, -0.02, 0);
    add(sword, new THREE.CylinderGeometry(0.026, 0.026, 0.26, 6), woodDark, 0, 0.12, 0);
    add(sword, new THREE.SphereGeometry(0.045, 6, 5), bronze, 0, 0.27, 0);

    // Telegraph ring
    this.telegraphMat = new THREE.MeshBasicMaterial({
      color: '#e04a2f',
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const ringGeo = new THREE.RingGeometry(3.02, 3.18, 72);
    this.telegraph = new THREE.Mesh(ringGeo, this.telegraphMat);
    this.telegraph.rotation.x = -Math.PI / 2;
    this.telegraph.position.y = 0.13;
    this.telegraph.visible = false;
    this.group.add(this.telegraph);

    this.arenaMat = new THREE.MeshBasicMaterial({
      color: '#c8a15a',
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const arena = new THREE.Mesh(new THREE.RingGeometry(3.86, 4.02, 72), this.arenaMat);
    arena.rotation.x = -Math.PI / 2;
    arena.position.y = 0.12;
    this.group.add(arena);

    this.group.scale.setScalar(1.12);
    this.buildIdleSilhouette();
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }

  /**
   * A dormant puppet does not need forty separate parts. Bake the whole body
   * into one vertex-coloured silhouette; the full rig is only revealed when a
   * duel starts. This saves ~40 draw calls in the sect hub and keeps the trial
   * ground readable from the overview camera.
   */
  private buildIdleSilhouette(): void {
    this.group.updateMatrixWorld(true);
    this.body.updateWorldMatrix(true, true);
    const inverse = new THREE.Matrix4().copy(this.group.matrixWorld).invert();
    const parts: THREE.BufferGeometry[] = [];
    const color = new THREE.Color();
    this.body.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const material = child.material;
      if (Array.isArray(material) || !(material instanceof THREE.MeshStandardMaterial)) return;
      const geo = child.geometry.clone();
      const local = new THREE.Matrix4().multiplyMatrices(inverse, child.matrixWorld);
      geo.applyMatrix4(local);
      color.copy(material.color);
      const count = geo.attributes.position.count;
      const colors = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      parts.push(geo);
    });
    const merged = parts.length ? mergeGeometries(parts, false) : null;
    if (!merged) return;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.18 });
    const mesh = new THREE.Mesh(merged, mat);
    mesh.name = 'puppet-idle';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    this.idleMesh = mesh;
    this.body.visible = false;
  }

  get position(): THREE.Vector3 {
    return this.group.position;
  }

  get isAlive(): boolean {
    return this.state !== 'dead';
  }

  get isStaggered(): boolean {
    return this.state === 'stagger';
  }

  get hpRatio(): number {
    return clamp(this.hp / (this.maxHp * this.hpScale), 0, 1);
  }

  get poiseRatio(): number {
    return clamp(this.poise / (this.maxPoise * this.hpScale), 0, 1);
  }

  /** Restore the standard puppet after a special duel. */
  clearBoss(): void {
    this.hpScale = 1;
    this.hp = this.maxHp;
    this.poise = this.maxPoise;
    this.runeMat.color.set(this.runeOrig.color);
    this.runeMat.emissive.set(this.runeOrig.emissive);
    this.runeMat.emissiveIntensity = this.runeOrig.intensity;
    this.eyeMat.color.set(this.eyeOrig.color);
    this.eyeMat.emissive.set(this.eyeOrig.emissive);
    this.eyeMat.emissiveIntensity = this.eyeOrig.intensity;
  }

  /** Scale health/poise and retint for a special duel (e.g. the tribulation). */
  setBoss(scale: number, tint: string, emissiveIntensity = 0.55): void {
    this.hpScale = scale;
    this.hp = Math.round(this.maxHp * scale);
    this.poise = Math.round(this.maxPoise * scale);
    this.runeMat.color.set(tint);
    this.runeMat.emissive.set(tint);
    this.runeMat.emissiveIntensity = emissiveIntensity;
    this.eyeMat.color.set(tint);
    this.eyeMat.emissive.set(tint);
    this.eyeMat.emissiveIntensity = emissiveIntensity * 1.25;
  }

  activate(): void {
    if (this.state === 'dead') return;
    this.state = 'chase';
    this.stateTime = 0;
    this.body.visible = true;
    if (this.idleMesh) this.idleMesh.visible = false;
    this.telegraph.visible = false;
  }

  reset(): void {
    this.hp = Math.round(this.maxHp * this.hpScale);
    this.poise = Math.round(this.maxPoise * this.hpScale);
    this.state = 'dormant';
    this.stateTime = 0;
    this.cooldown = 1.2;
    this.hitFlash = 0;
    this.bob = 0;
    this.group.visible = true;
    this.group.rotation.set(0, 0, 0);
    this.body.rotation.set(0, 0, 0);
    this.body.position.set(0, 0, 0);
    this.armR.rotation.set(0, 0, 0);
    this.armL.rotation.set(0, 0, 0);
    this.head.rotation.set(0, 0, 0);
    this.telegraph.visible = false;
    this.telegraphMat.opacity = 0;
    this.body.visible = false;
    if (this.idleMesh) this.idleMesh.visible = true;
  }

  takeHit(damage: number, poiseDamage: number): HitResult {
    if (this.state === 'dead') return { dead: true, staggered: false };

    this.hp = Math.max(0, this.hp - damage);
    this.poise = Math.max(0, this.poise - poiseDamage);
    this.hitFlash = 0.16;
    this.poiseIdle = 0;

    if (this.hp <= 0) {
      this.state = 'dead';
      this.stateTime = 0;
      this.telegraph.visible = false;
      return { dead: true, staggered: false };
    }

    if (this.poise <= 0) {
      this.state = 'stagger';
      this.stateTime = 0;
      this.staggerTimer = 2.2;
      this.poise = this.maxPoise * 0.65;
      this.telegraph.visible = false;
      return { dead: false, staggered: true };
    }

    return { dead: false, staggered: false };
  }

  execute(): void {
    if (this.state === 'dead') return;
    this.hp = 0;
    this.hitFlash = 0.25;
    if (this.hp <= 0) {
      this.state = 'dead';
      this.stateTime = 0;
      this.telegraph.visible = false;
    } else {
      this.state = 'stagger';
      this.stateTime = 0;
      this.staggerTimer = 1.4;
    }
  }

  update(
    dt: number,
    playerPos: THREE.Vector3,
    playerInvulnerable: boolean,
    onHitPlayer: () => void,
    onStrike: () => void,
  ): void {
    this.stateTime += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.poiseIdle += dt;

    if (this.poiseIdle > 3 && this.state !== 'stagger' && this.state !== 'dead') {
      this.poise = Math.min(this.maxPoise, this.poise + dt * 7);
    }
    if (this.state !== 'dead') {
      this.cooldown = Math.max(0, this.cooldown - dt);
    }

    this.runeMat.emissiveIntensity = 0.15 + this.hitFlash * 8;
    this.arenaMat.opacity = this.state === 'dormant' ? 0.2 : 0.36 + Math.sin(this.bob * 2) * 0.05;
    this.eyeMat.emissiveIntensity = this.state === 'dormant' ? 0.12 : 1.2 + this.hitFlash * 6;

    const dx = playerPos.x - this.group.position.x;
    const dz = playerPos.z - this.group.position.z;
    const dist = Math.hypot(dx, dz);
    const targetYaw = Math.atan2(dx, dz);

    if (this.state !== 'dead') {
      this.group.rotation.y = damp(this.group.rotation.y, targetYaw, 6, dt);
    }

    switch (this.state) {
      case 'dormant': {
        this.animateIdle(dt);
        break;
      }
      case 'chase': {
        this.animateWalk(dt, dist > 2.8);
        if (dist > 3.1) {
          const speed = 1.55;
          const nx = this.group.position.x + (dx / Math.max(dist, 0.001)) * speed * dt;
          const nz = this.group.position.z + (dz / Math.max(dist, 0.001)) * speed * dt;
          this.group.position.x = nx;
          this.group.position.z = nz;
          this.group.position.y = heightAt(nx, nz);
        }
        if (dist < 3.8 && this.cooldown <= 0) {
          this.state = 'windup';
          this.stateTime = 0;
          this.telegraph.visible = true;
          this.telegraphMat.opacity = 0.1;
        }
        break;
      }
      case 'windup': {
        const t = clamp(this.stateTime / 0.72, 0, 1);
        this.armR.rotation.x = -0.4 - t * 2.35;
        this.armR.rotation.z = -0.15;
        this.armL.rotation.x = -0.2 - t * 0.6;
        this.body.rotation.x = -0.15 * t;
        this.body.position.y = 0.04 * t;
        this.telegraph.scale.setScalar(0.5 + t * 0.5);
        this.telegraphMat.opacity = 0.18 + t * 0.42;
        if (this.stateTime >= 0.72) {
          this.state = 'strike';
          this.stateTime = 0;
          this.telegraph.visible = false;
          onStrike();
          if (dist < 3.8 && !playerInvulnerable) onHitPlayer();
        }
        break;
      }
      case 'strike': {
        const t = clamp(this.stateTime / 0.18, 0, 1);
        this.armR.rotation.x = -2.75 + t * 3.15;
        this.body.rotation.x = -0.15 + t * 0.4;
        this.body.rotation.y = -0.25 + t * 0.5;
        if (this.stateTime >= 0.18) {
          this.state = 'recover';
          this.stateTime = 0;
          this.cooldown = 1.35;
        }
        break;
      }
      case 'recover': {
        const t = clamp(this.stateTime / 0.75, 0, 1);
        this.armR.rotation.x = damp(this.armR.rotation.x, 0, 5, dt);
        this.body.rotation.x = damp(this.body.rotation.x, 0, 5, dt);
        this.body.rotation.y = damp(this.body.rotation.y, 0, 5, dt);
        this.armL.rotation.x = damp(this.armL.rotation.x, 0, 5, dt);
        if (t >= 1) {
          this.state = 'chase';
          this.stateTime = 0;
        }
        break;
      }
      case 'stagger': {
        this.staggerTimer -= dt;
        this.body.rotation.x = damp(this.body.rotation.x, 0.38, 8, dt);
        this.body.rotation.z = Math.sin(this.stateTime * 14) * 0.04;
        this.armR.rotation.x = damp(this.armR.rotation.x, 0.4, 8, dt);
        this.armL.rotation.x = damp(this.armL.rotation.x, 0.35, 8, dt);
        this.head.rotation.x = 0.4;
        if (this.staggerTimer <= 0) {
          this.state = 'chase';
          this.stateTime = 0;
          this.cooldown = 0.6;
          this.body.rotation.z = 0;
          this.head.rotation.x = 0;
        }
        break;
      }
      case 'dead': {
        const t = clamp(this.stateTime / 1.6, 0, 1);
        this.body.rotation.x = t * 1.35;
        this.body.position.y = -t * 0.25;
        this.armR.rotation.x = t * 0.8;
        this.armL.rotation.x = t * 0.7;
        this.head.rotation.x = t * 0.4;
        break;
      }
    }

    this.bob += dt;
    const breathing = Math.sin(this.bob * 1.8) * 0.01;
    if (this.state !== 'dead') this.body.position.y = breathing;
  }

  private animateIdle(dt: number): void {
    this.armR.rotation.x = damp(this.armR.rotation.x, 0.02, 4, dt);
    this.armL.rotation.x = damp(this.armL.rotation.x, -0.02, 4, dt);
    this.head.rotation.y = Math.sin(this.bob * 0.7) * 0.08;
  }

  private animateWalk(dt: number, moving: boolean): void {
    const t = this.bob * 7.5;
    const amp = moving ? 0.45 : 0.06;
    this.legL.rotation.x = Math.sin(t) * amp;
    this.legR.rotation.x = -Math.sin(t) * amp;
    this.armR.rotation.x = damp(this.armR.rotation.x, 0.1 - Math.sin(t) * 0.12, 6, dt);
    this.armL.rotation.x = damp(this.armL.rotation.x, -Math.sin(t) * 0.12, 6, dt);
    this.head.rotation.y = Math.sin(this.bob * 0.5) * 0.05;
  }
}
