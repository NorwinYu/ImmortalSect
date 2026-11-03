import * as THREE from 'three';
import { Game } from '../game/game';
import { heightAt } from '../world/terrain';
import {
  BUILDING_BY_ID,
  BUILDINGS,
  buildingEffect,
  isPostSpecialist,
  nextCost,
  nextDays,
  type BuildingId,
} from '../game/buildings';

interface Callbacks {
  onToast?: (message: string) => void;
  onChanged?: () => void;
}

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el;
}

function costText(cost: Record<string, number> | null): string {
  if (!cost) return '已满级';
  const labels: Record<string, string> = { stones: '灵石', herbs: '药材', insight: '心得', reputation: '声望' };
  return Object.entries(cost)
    .map(([k, v]) => `${labels[k] ?? k} ${v}`)
    .join(' · ');
}

export class BuildingUI {
  private readonly root = $('building-panel');
  private readonly nameEl = $('building-name');
  private readonly subEl = $('building-sub');
  private readonly bodyEl = $('building-body');
  private readonly costEl = $('building-cost');
  private readonly upgradeBtn = $('building-upgrade') as HTMLButtonElement;
  private readonly closeBtn = $('building-close');
  private readonly overviewList = $('overview-list');
  private readonly overviewItems = $('overview-items');
  private readonly markersRoot = $('building-markers');
  private readonly markers = new Map<BuildingId, HTMLButtonElement>();

  private current: BuildingId | null = null;

  constructor(
    private readonly game: Game,
    private readonly callbacks: Callbacks = {},
  ) {
    this.closeBtn.addEventListener('click', () => this.close());
    this.upgradeBtn.addEventListener('click', () => this.upgrade());
    this.bodyEl.addEventListener('click', (event) => {
      const btn = (event.target as HTMLElement).closest<HTMLElement>('[data-post]');
      if (!btn?.dataset.post || !this.current) return;
      const result = this.game.assignPost(btn.dataset.post, this.current);
      this.callbacks.onToast?.(result.message);
      this.callbacks.onChanged?.();
      this.render();
    });
    this.overviewItems.addEventListener('click', (event) => {
      const item = (event.target as HTMLElement).closest<HTMLElement>('[data-building]');
      if (!item?.dataset.building) return;
      this.open(item.dataset.building as BuildingId);
    });
    for (const def of BUILDINGS) {
      const marker = document.createElement('button');
      marker.type = 'button';
      marker.className = 'building-marker';
      marker.dataset.building = def.id;
      marker.setAttribute('aria-label', `${def.name} · 查看建筑`);
      marker.addEventListener('click', () => this.open(def.id));
      this.markersRoot.appendChild(marker);
      this.markers.set(def.id, marker);
    }
    this.renderOverview();
  }

  updateMarkers(camera: THREE.PerspectiveCamera, overview: boolean, visible: boolean): void {
    this.markersRoot.classList.toggle('is-hidden', !visible);
    if (!visible) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const placed: Array<{ x: number; y: number }> = [];
    for (const def of BUILDINGS) {
      const marker = this.markers.get(def.id);
      if (!marker) continue;
      const b = this.game.state.buildings[def.id];
      const y = heightAt(def.plot.x, def.plot.z) + this.markerHeight(def.id, b?.level ?? 0);
      const p = new THREE.Vector3(def.plot.x, y, def.plot.z);
      const distance = p.distanceTo(camera.position);
      p.project(camera);
      const onScreen = p.z > -1 && p.z < 1 && Math.abs(p.x) < 1.02 && Math.abs(p.y) < 1.02;
      const inRange = overview || distance < 34;
      const x = (p.x * 0.5 + 0.5) * w;
      const screenY = (-p.y * 0.5 + 0.5) * h;
      // Keep the closest / first marker when two labels would collide.
      const collides = placed.some((q) => Math.abs(q.x - x) < 78 && Math.abs(q.y - screenY) < 30);
      const show = onScreen && inRange && !collides;
      marker.style.display = show ? 'block' : 'none';
      if (show) {
        marker.style.left = `${x}px`;
        marker.style.top = `${screenY}px`;
        placed.push({ x, y: screenY });
      }
    }
  }

  setOverviewList(on: boolean): void {
    this.overviewList.classList.toggle('is-hidden', !on);
    if (on) this.renderOverview();
  }

  get isBlocking(): boolean {
    return !this.root.classList.contains('is-hidden');
  }

  open(id: BuildingId): void {
    this.current = id;
    this.render();
    this.root.classList.remove('is-hidden');
  }

  close(): void {
    this.current = null;
    this.root.classList.add('is-hidden');
  }

  handleEscape(): boolean {
    if (!this.isBlocking) return false;
    this.close();
    return true;
  }

  private markerHeight(def: BuildingId, level: number): number {
    if (def === 'library') return level * 2.25 + 4.0;
    if (def === 'dorm' || def === 'kitchen' || def === 'alchemy' || def === 'store') return level >= 3 ? 6.0 : 4.2;
    return 3.6;
  }

  private renderOverview(): void {
    for (const def of BUILDINGS) {
      const marker = this.markers.get(def.id);
      const b = this.game.state.buildings[def.id];
      if (!marker || !b) continue;
      marker.innerHTML = `<b>${def.name}</b><span>${b.construction > 0 ? `建造 ${b.construction}日` : `Lv.${b.level}`}</span>`;
    }
    this.overviewItems.innerHTML = '';
    for (const def of BUILDINGS) {
      const b = this.game.state.buildings[def.id];
      if (!b) continue;
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'overview-item';
      item.dataset.building = def.id;
      item.setAttribute('aria-label', `${def.name} · ${b.construction > 0 ? '建造中' : `等级 ${b.level}`}`);
      item.innerHTML = `<b>${def.name}</b><span>${b.construction > 0 ? `建造 ${b.construction}日` : `Lv.${b.level}`}</span>`;
      this.overviewItems.appendChild(item);
    }
  }

  render(): void {
    this.renderOverview();
    if (!this.current) return;
    const def = BUILDING_BY_ID[this.current];
    const b = this.game.state.buildings[this.current];
    if (!def || !b) return;
    const next = b.level < def.maxLevel ? b.level + 1 : null;
    const cost = nextCost(def, b.level);
    const days = next ? nextDays(def, b.level) : 0;
    const affordable =
      cost !== null &&
      Object.entries(cost).every(
        ([k, v]) => this.game.state.resources[k as keyof Game['state']['resources']] >= (v ?? 0),
      );

    this.nameEl.textContent = def.name;
    this.subEl.textContent = `${def.subtitle} · 固定地块`;
    this.bodyEl.innerHTML = `
      <div class="building-level"><b>${b.level}</b><span>/ ${def.maxLevel} 级</span></div>
      <p class="building-desc">${def.description}</p>
      <div class="building-effect">当前：${buildingEffect(def, b.level)}${next ? `<br />下一级：${buildingEffect(def, next)}` : ''}</div>
      ${b.construction > 0 ? `<div class="building-construction">施工中：剩余 ${b.construction} 日。结束今日后推进。</div>` : ''}
      <div class="building-next">
        ${next ? `升级耗时：<b>${days} 日</b><br />升级后外观会变化，岗位/产出提升。` : '<b>已达最高等级。</b>'}
      </div>
      ${this.postsMarkup(def.id, b.level)}
      <div class="building-upkeep">维护：每两座建筑等级消耗 1 灵石/日；灵石不足会掉道心。</div>
    `;

    if (b.construction > 0) {
      this.upgradeBtn.textContent = `施工中 · ${b.construction} 日`;
      this.upgradeBtn.disabled = true;
      this.costEl.textContent = '';
    } else if (!next) {
      this.upgradeBtn.textContent = '已满级';
      this.upgradeBtn.disabled = true;
      this.costEl.textContent = '';
    } else {
      this.upgradeBtn.textContent = b.level <= 0 ? '修建' : '升级';
      this.upgradeBtn.disabled = !affordable;
      this.costEl.textContent = costText(cost as Record<string, number> | null);
    }
  }

  private postsMarkup(id: BuildingId, level: number): string {
    const active = this.game.state.disciples.filter((d) => d.active);
    const def = BUILDING_BY_ID[id];
    const posts = active.filter((d) => d.post === id).length;
    const rows = active
      .map((d) => {
        const activePost = d.post === id;
        const specialist = isPostSpecialist(id, d.role);
        return `<button type="button" class="post-btn${activePost ? ' active' : ''}${specialist ? ' specialist' : ''}" data-post="${d.id}" ${level <= 0 ? 'disabled' : ''} aria-label="${activePost ? '召回' : '驻派'} ${d.name} 到${def.name}${specialist ? '，专业对口' : ''}" title="${activePost ? '召回' : '驻派'} ${d.name}${specialist ? ' · 专业对口' : ''}">
          <b>${d.name}${specialist ? ' <i>专长</i>' : ''}</b><span>${d.role}</span><em>${activePost ? '召回' : '驻派'}</em>
        </button>`;
      })
      .join('');
    return `
      <div class="building-posts">
        <div class="building-posts-head"><b>驻派弟子</b><span>${posts} / ${Math.max(0, level)} 个岗位</span></div>
        <p class="building-posts-hint">驻派后按岗位提升日产出；弟子职业与建筑对口时额外加成。岗位数等于建筑等级。</p>
        <div class="building-posts-list">${rows || '<span class="muted">暂无可驻派弟子</span>'}</div>
      </div>
    `;
  }

  private upgrade(): void {
    if (!this.current) return;
    const result = this.game.upgradeBuilding(this.current);
    this.callbacks.onToast?.(result.text);
    this.callbacks.onChanged?.();
    this.render();
  }
}
