import * as THREE from 'three';

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el;
}

export class CombatHud {
  private readonly root = $('combat');
  private readonly enemyHp = $('enemy-hp');
  private readonly enemyPoise = $('enemy-poise');
  private readonly playerHp = $('player-hp');
  private readonly playerQi = $('player-qi');
  private readonly comboEl = $('combo');
  private readonly comboValue = document.querySelector('#combo b') as HTMLElement;
  private readonly executeEl = $('execute');
  private readonly bannerEl = $('banner');
  private readonly damageLayer = $('damage-layer');
  private readonly flashEl = $('combat-flash');

  constructor(private readonly camera: THREE.PerspectiveCamera) {}

  show(): void {
    this.root.classList.remove('is-hidden');
  }

  hide(): void {
    this.root.classList.add('is-hidden');
    this.executeEl.classList.add('is-hidden');
    this.comboEl.classList.add('is-hidden');
    this.bannerEl.classList.add('is-hidden');
    this.damageLayer.replaceChildren();
  }

  setEnemy(hp: number, poise: number): void {
    this.enemyHp.style.width = `${Math.max(0, Math.min(1, hp)) * 100}%`;
    this.enemyPoise.style.width = `${Math.max(0, Math.min(1, poise)) * 100}%`;
  }

  setPlayer(hp: number, qi: number): void {
    this.playerHp.style.width = `${Math.max(0, Math.min(1, hp)) * 100}%`;
    this.playerQi.style.width = `${Math.max(0, Math.min(1, qi)) * 100}%`;
    this.playerHp.classList.toggle('low', hp < 0.3);
  }

  setCombo(n: number): void {
    this.comboValue.textContent = String(n);
    this.comboEl.classList.toggle('is-hidden', n < 2);
  }

  setPrompt(visible: boolean): void {
    this.executeEl.classList.toggle('is-hidden', !visible);
  }

  banner(title: string, subtitle: string, tone: 'win' | 'lose'): void {
    this.bannerEl.className = `combat-banner ${tone}`;
    const b = this.bannerEl.querySelector('b') as HTMLElement;
    const s = this.bannerEl.querySelector('span') as HTMLElement;
    b.textContent = title;
    s.textContent = subtitle;
    this.bannerEl.classList.remove('is-hidden');
  }

  clearBanner(): void {
    this.bannerEl.classList.add('is-hidden');
  }

  damage(world: THREE.Vector3, amount: number, kind: 'hit' | 'heavy' | 'skill' | 'heal' | 'hurt'): void {
    const p = world.clone().project(this.camera);
    if (p.z > 1) return;
    const x = (p.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-p.y * 0.5 + 0.5) * window.innerHeight;
    const el = document.createElement('div');
    el.className = `damage-number ${kind}`;
    el.textContent = kind === 'heal' ? `+${amount}` : String(amount);
    el.style.left = `${x + (Math.random() - 0.5) * 28}px`;
    el.style.top = `${y - 12 + (Math.random() - 0.5) * 18}px`;
    this.damageLayer.appendChild(el);
    window.setTimeout(() => el.remove(), 900);
  }

  flash(): void {
    this.flashEl.classList.remove('active');
    void this.flashEl.offsetWidth;
    this.flashEl.classList.add('active');
  }
}
