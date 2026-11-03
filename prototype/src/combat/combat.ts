import * as THREE from 'three';
import type { Input } from '../core/input';
import type { Ambience } from '../core/audio';
import type { Player } from '../characters/player';
import type { CombatHud } from './combat-hud';
import { SwordPuppet } from './enemy';
import { CombatVfx } from './vfx';

type AttackKind = 'light' | 'heavy' | 'skill';
type Finished = 'none' | 'win' | 'lose';

type AttackState = {
  kind: AttackKind;
  step: number;
  time: number;
  hitAt: number;
  duration: number;
  hitDone: boolean;
  queued: boolean;
};

const LIGHT_DAMAGE = [44, 52, 72];
const LIGHT_POISE = [12, 14, 18];

export class CombatSystem {
  readonly enemy: SwordPuppet;
  active = false;
  onVictory?: () => void;
  onDefeat?: () => void;
  onForfeit?: () => void;
  private boss = false;

  private finished: Finished = 'none';
  private finishTimer = 0;
  private attack: AttackState | null = null;
  private combo = 0;
  private comboTimer = 0;
  private skillCd = 0;
  private hitstop = 0;
  private rearm = true;
  private readonly vfx: CombatVfx;

  constructor(
    scene: THREE.Scene,
    private readonly input: Input,
    private readonly player: Player,
    private readonly hud: CombatHud,
    private readonly audio: Ambience,
    private readonly toast: (message: string, duration?: number) => void,
    private readonly onCombatState: (on: boolean) => void,
  ) {
    this.enemy = new SwordPuppet(scene, 0.9, 6);
    this.vfx = new CombatVfx(scene);
  }

  get inCombat(): boolean {
    return this.active || this.finished !== 'none';
  }

  get timeScale(): number {
    return this.hitstop > 0 ? 0.12 : 1;
  }

  start(config?: { boss?: boolean; bossScale?: number }): void {
    if (this.active || this.player.isDead) return;
    if (!this.enemy.isAlive) this.enemy.reset();

    const boss = config?.boss ?? false;
    this.boss = boss;
    if (boss) {
      this.enemy.setBoss(config?.bossScale ?? 1.35, '#9fd7ff', 0.6);
      this.hud.banner('天 劫', '雷劫化形 · 斩之', 'win');
    }

    this.player.restore();
    this.player.setCombat(true);
    this.player.setCombatTarget(this.enemy.position);
    this.player.setLockOn(true);

    this.enemy.activate();
    this.active = true;
    this.finished = 'none';
    this.attack = null;
    this.combo = 0;
    this.comboTimer = 0;
    this.skillCd = 0;
    this.hitstop = 0;
    this.rearm = false;

    this.input.setCombatMode(true);
    this.onCombatState(true);
    this.hud.show();
    this.hud.setCombo(0);
    this.hud.setEnemy(1, 1);
    this.hud.setPlayer(1, 1);
    this.hud.clearBanner();
    this.toast(boss ? '天劫临身 · 雷劫化形' : '试剑 · 执剑傀儡', 2800);
  }

  handleKey(code: string): void {
    if (code === 'Tab') {
      this.player.setLockOn(!this.player.lockOn);
      return;
    }

    if (!this.active) {
      if (code === 'KeyR' && (this.enemy.isAlive === false || this.finished !== 'none')) {
        this.enemy.reset();
        this.player.restore();
        this.start();
      }
      return;
    }

    if (code === 'KeyQ') this.tryDodge();
    if (code === 'KeyE') this.trySkill();
    if (code === 'KeyF') this.tryExecute();
  }

  beforeUpdate(dt: number, allowControl: boolean): void {
    this.hitstop = Math.max(0, this.hitstop - dt);

    if (this.finished !== 'none') {
      this.finishTimer -= dt;
      this.input.consumeClicks();
      if (this.finishTimer <= 0) this.finalize();
      return;
    }

    if (!this.active) {
      this.input.consumeClicks();
      const dist = this.distanceToEnemy();
      if (!this.rearm && dist > 16) this.rearm = true;
      if (allowControl && this.rearm && !this.player.isDead && dist < 9.5) {
        this.start();
      }
      return;
    }

    const dx = this.player.position.x - this.enemy.position.x;
    const dz = this.player.position.z - this.enemy.position.z;
    if (Math.hypot(dx, dz) > 23) {
      this.leave();
      return;
    }

    this.player.setCombatTarget(this.enemy.position);
    this.player.qi = Math.min(this.player.maxQi, this.player.qi + dt * 7);

    const clicks = this.input.consumeClicks();
    if (allowControl && !this.player.isDead) {
      if (clicks.left > 0) this.tryLight();
      if (clicks.right > 0) this.tryHeavy();
    }

    this.comboTimer -= dt;
    if (this.comboTimer <= 0 && this.combo > 0) {
      this.combo = 0;
      this.hud.setCombo(0);
    }
    this.skillCd = Math.max(0, this.skillCd - dt);
  }

  afterUpdate(dt: number): void {
    this.vfx.update(dt);

    if (!this.active) return;

    this.separate();

    if (this.attack) {
      const a = this.attack;
      a.time += dt;

      if (!a.hitDone && a.time >= a.hitAt) {
        a.hitDone = true;
        this.resolveHit(a);
      }

      if (a.time >= a.duration) {
        if (a.queued && a.step < 3) {
          this.beginLight(a.step + 1);
        } else {
          this.attack = null;
        }
      }
    }

    if (this.active) {
      this.enemy.update(
        dt,
        this.player.position,
        this.player.isInvulnerable,
        () => this.hitPlayer(),
        () => this.enemyStrikeVfx(),
      );
    }

    if (this.active) {
      this.hud.setEnemy(this.enemy.hpRatio, this.enemy.poiseRatio);
      this.hud.setPlayer(this.player.hp / this.player.maxHp, this.player.qi / this.player.maxQi);
      this.hud.setCombo(this.combo);
      this.hud.setPrompt(this.enemy.isStaggered && !this.player.isDead);
    }
  }

  private tryLight(): void {
    if (this.player.isDead) return;

    if (this.attack) {
      if (
        this.attack.kind === 'light' &&
        this.attack.step < 3 &&
        this.attack.time > this.attack.duration * 0.4
      ) {
        this.attack.queued = true;
      }
      return;
    }

    this.beginLight(1);
  }

  private beginLight(step: number): void {
    const poses = ['attack1', 'attack2', 'attack3'] as const;
    const durations = [0.5, 0.48, 0.64];
    const hitAt = [0.2, 0.2, 0.29];

    this.attack = {
      kind: 'light',
      step,
      time: 0,
      hitAt: hitAt[step - 1],
      duration: durations[step - 1],
      hitDone: false,
      queued: false,
    };
    this.player.playPose(poses[step - 1], durations[step - 1]);
    this.player.setMoveLock(durations[step - 1] * 0.82);
    this.audio.swing(step === 3 ? 1.25 : 0.95);
  }

  private tryHeavy(): void {
    if (this.player.isDead || this.attack) return;
    if (this.player.qi < 25) {
      this.toast('真气不足', 1200);
      return;
    }

    this.player.qi -= 25;
    this.attack = {
      kind: 'heavy',
      step: 0,
      time: 0,
      hitAt: 0.52,
      duration: 0.9,
      hitDone: false,
      queued: false,
    };
    this.player.playPose('heavy', 0.9);
    this.player.setMoveLock(0.78);
    this.player.addShake(0.06);
    this.audio.swing(1.45);
  }

  private trySkill(): void {
    if (this.player.isDead || this.attack) return;
    if (this.skillCd > 0) {
      this.toast('剑气未复', 1000);
      return;
    }
    if (this.player.qi < 30) {
      this.toast('真气不足', 1200);
      return;
    }

    this.player.qi -= 30;
    this.skillCd = 6;
    this.attack = {
      kind: 'skill',
      step: 0,
      time: 0,
      hitAt: 0.28,
      duration: 0.62,
      hitDone: false,
      queued: false,
    };
    this.player.playPose('cast', 0.62);
    this.player.setMoveLock(0.5);
    this.audio.swing(1.1);
  }

  private tryDodge(): void {
    if (this.player.isDead) return;
    if (this.attack && this.attack.time < 0.24) return;
    this.attack = null;
    this.player.dodge();
    this.audio.dodge();
    this.vfx.shockwave(this.player.position, '#cbbd9f', 2.2);
  }

  private tryExecute(): void {
    if (!this.active || this.player.isDead || !this.enemy.isStaggered) return;
    if (this.distanceToEnemy() > 3.6) {
      this.toast('距离太远', 900);
      return;
    }

    this.attack = null;
    this.player.playPose('execute', 0.85);
    this.player.setMoveLock(0.85);
    this.enemy.execute();
    this.hitstop = 0.14;
    this.player.addShake(0.55);
    this.audio.execute();

    const pos = this.enemy.position.clone().add(new THREE.Vector3(0, 1.45, 0));
    this.vfx.impact(pos, '#ffcf8a');
    this.vfx.shockwave(this.enemy.position, '#ffb066', 4.2);
    this.vfx.slash(pos, '#ffe0a8', 1.6, -0.8);

    this.recordHit(320, 'skill');
    this.hud.damage(pos, 320, 'skill');

    if (!this.enemy.isAlive) this.finish('win');
  }

  private resolveHit(a: AttackState): void {
    const forward = this.player.forward;
    const toEnemy = new THREE.Vector3(
      this.enemy.position.x - this.player.position.x,
      0,
      this.enemy.position.z - this.player.position.z,
    );
    const dist = toEnemy.length();
    if (dist > 0.001) toEnemy.divideScalar(dist);
    const facing = forward.dot(toEnemy);

    const range = a.kind === 'heavy' ? 4.0 : a.kind === 'skill' ? 20 : 3.7;
    const arc = a.kind === 'skill' ? 0.55 : 0.2;

    const hitPos = this.player.position.clone().addScaledVector(forward, 1.7);
    hitPos.y += 1.25;

    if (a.kind === 'skill') {
      const end = this.enemy.position.clone().add(new THREE.Vector3(0, 1.45, 0));
      const from = this.player.position.clone().add(new THREE.Vector3(0, 1.25, 0));
      this.vfx.beam(from, end, '#9ff3e2');
      this.vfx.impact(end, '#bff8ea');
      this.vfx.shockwave(this.enemy.position, '#9ff3e2', 3.2);
      this.hitstop = 0.06;
    } else {
      this.vfx.slash(
        hitPos,
        a.kind === 'heavy' ? '#ffcf8a' : '#dff6ff',
        a.kind === 'heavy' ? 1.45 : 1,
        a.step === 2 ? -0.6 : 0.45,
      );
    }

    if (dist > range || facing < arc) return;

    let damage: number;
    let poise: number;
    if (a.kind === 'heavy') {
      damage = 122;
      poise = 36;
    } else if (a.kind === 'skill') {
      damage = 92;
      poise = 26;
    } else {
      damage = LIGHT_DAMAGE[a.step - 1];
      poise = LIGHT_POISE[a.step - 1];
    }

    const result = this.enemy.takeHit(damage, poise);
    const pos = this.enemy.position.clone().add(new THREE.Vector3(0, 1.55, 0));

    this.vfx.impact(pos, a.kind === 'heavy' ? '#ffd9a0' : '#dff6ff');
    if (a.kind === 'heavy') this.vfx.shockwave(this.enemy.position, '#ffcf8a', 3.6);

    this.hitstop = a.kind === 'heavy' ? 0.09 : 0.055;
    this.player.addShake(a.kind === 'heavy' ? 0.32 : 0.18);
    this.audio.hit(a.kind === 'heavy');

    this.recordHit(damage, a.kind === 'light' ? 'hit' : a.kind);
    this.hud.damage(pos, damage, a.kind === 'light' ? 'hit' : a.kind);

    if (result.staggered) this.toast('架势已破 · F 处决', 2000);
    if (result.dead) this.finish('win');
  }

  private recordHit(_damage: number, _kind: string): void {
    this.combo++;
    this.comboTimer = 2.4;
    this.hud.setCombo(this.combo);
  }

  private hitPlayer(): void {
    if (this.player.isDead) return;

    const applied = this.player.takeDamage(24);
    if (!applied) return;

    const pos = this.player.position.clone().add(new THREE.Vector3(0, 1.6, 0));
    this.vfx.impact(pos, '#ff8a6a');
    this.hud.flash();
    this.hud.damage(pos, 24, 'hurt');
    this.audio.hurt();
    this.player.addShake(0.5);
    this.hitstop = 0.05;

    if (this.player.isDead) this.finish('lose');
  }

  private enemyStrikeVfx(): void {
    const yaw = this.enemy.group.rotation.y;
    const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
    const pos = this.enemy.position.clone().addScaledVector(forward, 2.1);
    pos.y += 1.25;
    this.vfx.slash(pos, '#ff6a4a', 1.3, -0.55);
    this.audio.swing(1.2);
  }

  private finish(kind: 'win' | 'lose'): void {
    if (this.finished !== 'none') return;
    this.finished = kind;
    this.active = false;
    this.attack = null;
    this.hitstop = 0;
    this.hud.setPrompt(false);
    this.hud.setCombo(0);

    if (kind === 'win') {
      this.finishTimer = 4.2;
      this.hud.setEnemy(0, this.enemy.poiseRatio);
      this.hud.setPlayer(this.player.hp / this.player.maxHp, this.player.qi / this.player.maxQi);
      this.hud.banner(this.boss ? '渡 劫 · 成' : '试 剑 · 成', this.boss ? '九霄云散' : '剑心已定', 'win');
      this.onVictory?.();
      this.player.playPose('victory', 3);
      this.player.setMoveLock(4.2);
      this.audio.execute();
    } else {
      this.finishTimer = 3.2;
      this.hud.banner('力 竭', '再试一次', 'lose');
      this.player.setMoveLock(3.2);
      this.onDefeat?.();
      this.audio.hurt();
    }
  }

  private finalize(): void {
    const kind = this.finished;
    this.finished = 'none';
    this.finishTimer = 0;
    if (this.boss) {
      this.boss = false;
      this.enemy.clearBoss();
    }
    this.player.setCombat(false);
    this.player.setLockOn(false);
    this.input.setCombatMode(false);
    this.onCombatState(false);
    this.hud.hide();
    this.hud.clearBanner();

    if (kind === 'lose') {
      this.player.restore();
      this.player.teleport(0, 26);
      this.enemy.reset();
      this.rearm = true;
      this.toast('回到山门 · 再试一次', 2400);
    } else {
      this.rearm = false;
      // Put the training puppet back into its one-mesh dormant silhouette.
      // The detailed rig (and its ~40 draw calls) only exists during a duel.
      this.enemy.reset();
      this.toast('试剑完成 · R 再试一次', 3200);
    }
  }

  private leave(): void {
    this.active = false;
    this.finished = 'none';
    this.attack = null;
    if (this.boss) {
      this.boss = false;
      this.enemy.clearBoss();
      this.onForfeit?.();
    }
    this.player.setCombat(false);
    this.player.setLockOn(false);
    this.input.setCombatMode(false);
    this.onCombatState(false);
    this.enemy.reset();
    this.hud.hide();
    this.rearm = false;
    this.toast('离开试剑台', 1800);
  }

  private separate(): void {
    const dx = this.player.position.x - this.enemy.position.x;
    const dz = this.player.position.z - this.enemy.position.z;
    const dist = Math.hypot(dx, dz);
    const min = 3.0;
    if (dist >= min) return;

    const nx = dist > 0.001 ? dx / dist : 0;
    const nz = dist > 0.001 ? dz / dist : 1;
    this.player.position.x = this.enemy.position.x + nx * min;
    this.player.position.z = this.enemy.position.z + nz * min;
    this.player.group.position.copy(this.player.position);
  }

  private distanceToEnemy(): number {
    return Math.hypot(
      this.player.position.x - this.enemy.position.x,
      this.player.position.z - this.enemy.position.z,
    );
  }
}
