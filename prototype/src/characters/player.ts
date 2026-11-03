import * as THREE from 'three';
import { clamp, damp, easeInOutCubic, TAU } from '../core/math';
import type { Input } from '../core/input';
import type { Collider } from '../world/sect';
import { heightAt } from '../world/terrain';
import { createCharacter, type CharacterRig, type PoseKind } from './character';

function dampAngle(current: number, target: number, lambda: number, dt: number): number {
  let delta = (target - current + Math.PI) % TAU;
  if (delta < 0) delta += TAU;
  delta -= Math.PI;
  return current + delta * (1 - Math.exp(-lambda * dt));
}

const INTRO_DURATION = 7.2;

type PoseState = { kind: PoseKind; time: number; duration: number };

export class Player {
  readonly group = new THREE.Group();
  readonly position = new THREE.Vector3();
  readonly rig: CharacterRig;

  readonly maxHp = 120;
  maxQi = 100;
  hp = 120;
  qi = 100;

  introActive = true;
  combatMode = false;
  lockOn = true;
  combatTarget: THREE.Vector3 | null = null;

  private readonly camera: THREE.PerspectiveCamera;
  private readonly occluders: THREE.Object3D[];
  private readonly cameraRay = new THREE.Raycaster();
  private readonly introCurve: THREE.CatmullRomCurve3;
  private readonly introLook = new THREE.Vector3();
  private readonly dodgeDir = new THREE.Vector3(0, 0, 1);
  private readonly lastMove = new THREE.Vector3(0, 0, -1);
  private introTime = 0;
  private cameraYaw = 0.28;
  private cameraPitch = 0.3;
  private cameraDist = 10.8;
  private cameraPos = new THREE.Vector3(0, 44, 96);
  private facing = Math.PI;
  private velocityY = 0;
  private grounded = true;
  private speed = 0;
  private jumpLatch = false;
  private pose: PoseState | null = null;
  private moveLock = 0;
  private dodgeTimer = 0;
  private invuln = 0;
  private shake = 0;
  private cameraObstructed = false;

  constructor(scene: THREE.Scene, camera: THREE.PerspectiveCamera, occluders: THREE.Object3D[] = []) {
    this.camera = camera;
    this.occluders = occluders;
    this.position.set(0, heightAt(0, 26) + 0.08, 26);

    this.rig = createCharacter();
    this.group.add(this.rig.group);
    this.group.position.copy(this.position);
    this.group.rotation.y = this.facing;
    scene.add(this.group);

    this.introCurve = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(2, 46, 104),
        new THREE.Vector3(13, 19, 62),
        new THREE.Vector3(5, 7.2, 42),
        new THREE.Vector3(2.0, 4.05, 34.0),
      ],
      false,
      'catmullrom',
      0.22,
    );
    this.camera.position.set(2, 46, 104);
    this.camera.lookAt(0, 8, -30);
  }

  get isDead(): boolean {
    return this.hp <= 0;
  }

  get isInvulnerable(): boolean {
    return this.invuln > 0 || this.isDead;
  }

  get forward(): THREE.Vector3 {
    return new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
  }

  beginIntro(): void {
    this.introActive = true;
    this.introTime = 0;
    this.speed = 0;
  }

  skipIntro(): void {
    this.introTime = INTRO_DURATION;
  }

  setCombat(on: boolean): void {
    this.combatMode = on;
    this.rig.setSwordDrawn(on);
    if (!on) {
      this.combatTarget = null;
      this.pose = null;
    }
  }

  setCombatTarget(target: THREE.Vector3 | null): void {
    this.combatTarget = target;
  }

  setLockOn(on: boolean): void {
    this.lockOn = on;
  }

  playPose(kind: PoseKind, duration: number): void {
    this.pose = { kind, time: 0, duration };
  }

  setMoveLock(seconds: number): void {
    this.moveLock = Math.max(this.moveLock, seconds);
  }

  dodge(): void {
    if (this.dodgeTimer > 0 || this.isDead) return;

    const move = this.lastMove.lengthSq() > 0.01 ? this.lastMove : this.forward.clone().negate();
    this.dodgeDir.copy(move).normalize();
    this.dodgeTimer = 0.38;
    this.invuln = 0.3;
    this.playPose('dodge', 0.4);
    this.shake = 0.08;
  }

  addShake(amount: number): void {
    this.shake = Math.max(this.shake, amount);
  }

  takeDamage(amount: number): boolean {
    if (this.invuln > 0 || this.isDead) return false;
    this.hp = Math.max(0, this.hp - amount);
    this.pose = { kind: 'hit', time: 0, duration: 0.34 };
    this.shake = 0.42;
    if (this.hp <= 0) {
      this.pose = { kind: 'defeat', time: 0, duration: 2.4 };
      this.speed = 0;
    }
    return true;
  }

  setMaxQi(value: number, refill = true): void {
    this.maxQi = Math.max(100, Math.round(value));
    if (refill) this.qi = this.maxQi;
    else this.qi = Math.min(this.qi, this.maxQi);
  }

  restore(): void {
    this.hp = this.maxHp;
    this.qi = this.maxQi;
    this.pose = null;
    this.dodgeTimer = 0;
    this.invuln = 0.8;
    this.shake = 0;
  }

  teleport(x: number, z: number): void {
    this.position.set(x, heightAt(x, z) + 0.08, z);
    this.group.position.copy(this.position);
    this.cameraPos.set(x + 1.4, this.position.y + 3.2, z + 6.4);
    this.cameraYaw = 0.12;
  }

  update(dt: number, input: Input, colliders: Collider[], allowControl: boolean): void {
    if (this.introActive) {
      this.updateIntro(dt);
      return;
    }

    this.moveLock = Math.max(0, this.moveLock - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.shake = Math.max(0, this.shake - dt * 2.2);

    if (this.pose) {
      this.pose.time += dt;
      if (this.pose.time >= this.pose.duration) this.pose = null;
    }

    if (this.dodgeTimer > 0) this.dodgeTimer = Math.max(0, this.dodgeTimer - dt);
    if (!this.combatMode) this.qi = Math.min(this.maxQi, this.qi + dt * 5);

    this.updateMovement(dt, input, colliders, allowControl);
    this.updateCamera(dt, input, allowControl, colliders);

    if (this.pose) {
      this.rig.playPose(this.pose.kind, this.pose.time / this.pose.duration);
    } else {
      this.rig.update(dt, this.speed, this.grounded, performance.now() / 1000, this.combatMode);
    }
  }

  private updateIntro(dt: number): void {
    this.introTime = Math.min(this.introTime + dt, INTRO_DURATION);
    const t = easeInOutCubic(this.introTime / INTRO_DURATION);
    const p = this.introCurve.getPoint(t);
    this.camera.position.copy(p);

    const lookT = easeInOutCubic(clamp(t * 1.1, 0, 1));
    this.introLook.set(
      THREE.MathUtils.lerp(0, 0, lookT),
      THREE.MathUtils.lerp(8, 2.1, lookT),
      THREE.MathUtils.lerp(-30, -10, lookT),
    );
    this.camera.lookAt(this.introLook);

    if (this.introTime >= INTRO_DURATION) {
      this.introActive = false;
      this.cameraYaw = 0.28;
      this.cameraPitch = 0.1;
      this.cameraDist = 7.4;
      this.cameraPos.set(2.0, 4.05, 34.0);
    }
  }

  private updateMovement(dt: number, input: Input, colliders: Collider[], allowControl: boolean): void {
    const dodging = this.dodgeTimer > 0;
    const locked = this.pose !== null || this.moveLock > 0 || this.isDead;

    if (dodging) {
      this.position.x += this.dodgeDir.x * 7.4 * dt;
      this.position.z += this.dodgeDir.z * 7.4 * dt;
      this.speed = 7.4;
    } else {
      let fwd = 0;
      let right = 0;

      if (allowControl && !locked) {
        fwd = (input.isDown('KeyW') || input.isDown('ArrowUp') ? 1 : 0) -
          (input.isDown('KeyS') || input.isDown('ArrowDown') ? 1 : 0);
        right = (input.isDown('KeyD') || input.isDown('ArrowRight') ? 1 : 0) -
          (input.isDown('KeyA') || input.isDown('ArrowLeft') ? 1 : 0);
      }

      const forward = new THREE.Vector3(-Math.sin(this.cameraYaw), 0, -Math.cos(this.cameraYaw));
      const side = new THREE.Vector3(Math.cos(this.cameraYaw), 0, -Math.sin(this.cameraYaw));
      const move = forward.multiplyScalar(fwd).add(side.multiplyScalar(right));

      const hasMove = move.lengthSq() > 0.0001;
      if (hasMove) {
        move.normalize();
        this.lastMove.copy(move);
      }

      const sprint = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
      const targetSpeed = hasMove ? (sprint ? 5.5 : 2.5) : 0;
      this.speed = damp(this.speed, targetSpeed, 9, dt);

      this.position.x += move.x * this.speed * dt;
      this.position.z += move.z * this.speed * dt;
    }

    this.position.x = clamp(this.position.x, -180, 180);
    this.position.z = clamp(this.position.z, -190, 150);

    this.resolveCollisions(colliders);

    if (this.combatTarget && !dodging && !this.isDead) {
      const dx = this.combatTarget.x - this.position.x;
      const dz = this.combatTarget.z - this.position.z;
      if (dx * dx + dz * dz > 0.001) {
        this.facing = dampAngle(this.facing, Math.atan2(dx, dz), 10, dt);
      }
    } else if (!dodging && this.lastMove.lengthSq() > 0.01 && this.speed > 0.1) {
      this.facing = dampAngle(this.facing, Math.atan2(this.lastMove.x, this.lastMove.z), 12, dt);
    }

    const ground = heightAt(this.position.x, this.position.z);

    const jumpDown = input.isDown('Space');
    if (allowControl && !locked && this.grounded && jumpDown && !this.jumpLatch) {
      this.velocityY = 6.4;
      this.grounded = false;
    }
    this.jumpLatch = jumpDown;

    if (this.grounded) {
      this.position.y = ground;
    } else {
      this.velocityY -= 19 * dt;
      this.position.y += this.velocityY * dt;
      if (this.position.y <= ground) {
        this.position.y = ground;
        this.velocityY = 0;
        this.grounded = true;
      }
    }

    this.group.position.copy(this.position);
    this.group.rotation.y = this.facing;
  }

  private resolveCollisions(colliders: Collider[]): void {
    const radius = 0.44;
    for (const c of colliders) {
      if (c.type === 'circle') {
        const dx = this.position.x - c.x;
        const dz = this.position.z - c.z;
        const d = Math.hypot(dx, dz);
        const min = c.r + radius;
        if (d < min && d > 0.0001) {
          const push = (min - d) / d;
          this.position.x += dx * push;
          this.position.z += dz * push;
        }
      } else {
        const cx = clamp(this.position.x, c.x - c.hx, c.x + c.hx);
        const cz = clamp(this.position.z, c.z - c.hz, c.z + c.hz);
        const dx = this.position.x - cx;
        const dz = this.position.z - cz;
        const d = Math.hypot(dx, dz);
        if (d < radius && d > 0.0001) {
          const push = (radius - d) / d;
          this.position.x += dx * push;
          this.position.z += dz * push;
        } else if (d <= 0.0001) {
          const left = Math.abs(this.position.x - (c.x - c.hx));
          const rightD = Math.abs(c.x + c.hx - this.position.x);
          const top = Math.abs(this.position.z - (c.z - c.hz));
          const bottom = Math.abs(c.z + c.hz - this.position.z);
          const m = Math.min(left, rightD, top, bottom);
          if (m === left) this.position.x = c.x - c.hx - radius;
          else if (m === rightD) this.position.x = c.x + c.hx + radius;
          else if (m === top) this.position.z = c.z - c.hz - radius;
          else this.position.z = c.z + c.hz + radius;
        }
      }
    }
  }

  private clampCamera(origin: THREE.Vector3, desired: THREE.Vector3, colliders: Collider[]): THREE.Vector3 {
    const dx = desired.x - origin.x;
    const dz = desired.z - origin.z;
    const len = Math.hypot(dx, dz);
    let t = 1;
    if (len > 0.001) {
      const pad = 0.32;
      for (const c of colliders) {
        if (c.type === 'circle') {
          const ex = c.x - origin.x;
          const ez = c.z - origin.z;
          const r = c.r + pad;
          const a = dx * dx + dz * dz;
          const b = 2 * (ex * dx + ez * dz);
          const cc = ex * ex + ez * ez - r * r;
          const disc = b * b - 4 * a * cc;
          if (disc > 0) {
            const root = Math.sqrt(disc);
            const t0 = (-b - root) / (2 * a);
            if (t0 >= 0 && t0 < t) t = t0;
          }
        } else {
          const minX = c.x - c.hx - pad;
          const maxX = c.x + c.hx + pad;
          const minZ = c.z - c.hz - pad;
          const maxZ = c.z + c.hz + pad;
          let t0 = 0;
          let t1 = 1;
          for (const [p, d, lo, hi] of [
            [origin.x, dx, minX, maxX],
            [origin.z, dz, minZ, maxZ],
          ] as Array<[number, number, number, number]>) {
            if (Math.abs(d) < 0.0001) {
              if (p < lo || p > hi) {
                t0 = t1 + 1;
                break;
              }
            } else {
              const a = (lo - p) / d;
              const b = (hi - p) / d;
              t0 = Math.max(t0, Math.min(a, b));
              t1 = Math.min(t1, Math.max(a, b));
            }
          }
          if (t0 <= t1 && t0 >= 0 && t0 < t) t = t0;
        }
      }
    }

    // Keep the camera above the terrain along the whole ray.
    for (let i = 1; i <= 10; i++) {
      const f = i / 10;
      const x = origin.x + dx * f;
      const z = origin.z + dz * f;
      const y = origin.y + (desired.y - origin.y) * f;
      if (y < heightAt(x, z) + 0.32) {
        t = Math.min(t, Math.max(0.1, f - 0.06));
      }
    }

    // Trees and other instanced occluders are not in the 2D collider list.
    if (this.occluders.length > 0) {
      const dir = desired.clone().sub(origin);
      const dist = dir.length();
      if (dist > 0.001) {
        this.cameraRay.set(origin, dir.normalize());
        this.cameraRay.near = 0.15;
        this.cameraRay.far = dist;
        let hit = dist;
        for (const obj of this.occluders) {
          for (const h of this.cameraRay.intersectObject(obj, true)) {
            if (h.distance > 0.2 && h.distance < hit) hit = h.distance;
          }
        }
        if (hit < dist) t = Math.min(t, Math.max(0.1, (hit - 0.18) / dist));
      }
    }

    if (t < 0.999) this.cameraObstructed = true;
    if (t >= 0.999) return desired;
    return origin.clone().addScaledVector(desired.clone().sub(origin), Math.max(0.1, t - 0.025));
  }

  private updateCamera(dt: number, input: Input, allowControl: boolean, colliders: Collider[]): void {
    this.cameraObstructed = false;
    const locked = this.combatMode && this.combatTarget !== null && this.lockOn;

    if (allowControl) {
      const mouse = input.consumeMouseDelta();
      const wheel = input.consumeWheel();
      if (locked) {
        this.cameraDist = clamp(this.cameraDist + wheel * 0.007, 4.0, 10.0);
      } else {
        this.cameraYaw -= mouse.x * 0.0042;
        this.cameraPitch = clamp(this.cameraPitch - mouse.y * 0.0028, 0.04, 1.12);
        this.cameraDist = clamp(this.cameraDist + wheel * 0.007, 5.0, 18.0);
      }
    }

    if (locked && this.combatTarget) {
      const dx = this.combatTarget.x - this.position.x;
      const dz = this.combatTarget.z - this.position.z;
      const desiredYaw = Math.atan2(-dx, -dz);
      this.cameraYaw = dampAngle(this.cameraYaw, desiredYaw, 6.5, dt);
      this.cameraPitch = damp(this.cameraPitch, 0.2, 5, dt);
      this.cameraDist = damp(this.cameraDist, 6.8, 5, dt);
    }

    const target = new THREE.Vector3(this.position.x, this.position.y + 1.58, this.position.z);
    const right = new THREE.Vector3(Math.cos(this.cameraYaw), 0, -Math.sin(this.cameraYaw));
    const shoulder = locked ? 1.2 : 0;
    const look = target.clone().addScaledVector(right, shoulder * 0.18);

    if (locked && this.combatTarget) {
      const dx = this.combatTarget.x - this.position.x;
      const dz = this.combatTarget.z - this.position.z;
      const len = Math.hypot(dx, dz);
      if (len > 0.001) look.addScaledVector(new THREE.Vector3(dx / len, 0, dz / len), 1.9);
    }

    const cp = Math.cos(this.cameraPitch);
    const desired = new THREE.Vector3(
      target.x + Math.sin(this.cameraYaw) * this.cameraDist * cp,
      target.y + Math.sin(this.cameraPitch) * this.cameraDist + 0.25,
      target.z + Math.cos(this.cameraYaw) * this.cameraDist * cp,
    ).addScaledVector(right, shoulder);

    const minY = heightAt(desired.x, desired.z) + 0.7;
    if (desired.y < minY) desired.y = minY;

    const safe = this.clampCamera(target, desired, colliders);
    if (safe.distanceTo(target) < 2.25) {
      const front = new THREE.Vector3(Math.sin(this.facing), 0, Math.cos(this.facing));
      safe.copy(target).addScaledVector(front, 3.2);
      safe.y = target.y + 2.4;
      safe.y = Math.max(safe.y, heightAt(safe.x, safe.z) + 1.2);
      this.cameraObstructed = true;
    }
    this.cameraPos.x = damp(this.cameraPos.x, safe.x, 7.5, dt);
    this.cameraPos.y = damp(this.cameraPos.y, safe.y, 7.5, dt);
    this.cameraPos.z = damp(this.cameraPos.z, safe.z, 7.5, dt);

    // Damping can cut a corner; re-clamp the interpolated position.
    const corrected = this.clampCamera(target, this.cameraPos, colliders);
    this.cameraPos.copy(corrected);

    this.camera.position.copy(this.cameraPos);
    this.camera.lookAt(look);
    this.rig.group.visible = !this.cameraObstructed && this.cameraPos.distanceTo(target) > 1.75;

    if (this.shake > 0.001) {
      const s = this.shake;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s * 0.6;
      this.camera.position.z += (Math.random() - 0.5) * s;
    }
  }
}
