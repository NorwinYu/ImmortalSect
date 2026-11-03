import type { GameState } from './state';
import { initialBuildings } from './buildings';

export type SlotId = 'auto' | '1' | '2' | '3';
export type Quality = 'high' | 'medium' | 'low';

export interface SaveMeta {
  slot: SlotId;
  day: number;
  chapter: string;
  updatedAt: number;
  playSeconds: number;
  active: number;
  ending: string | null;
  state: GameState;
}

export interface GameSettings {
  quality: Quality;
  muted: boolean;
  /** Vibration feedback on touch devices. */
  haptics: boolean;
}

interface SaveFile {
  version: 2;
  slots: Partial<Record<SlotId, SaveMeta>>;
  settings: GameSettings;
}

const KEY = 'immortal-sect-saves-v2';
const LEGACY_KEY = 'immortal-sect-save-v1';
const SLOT_ORDER: SlotId[] = ['auto', '1', '2', '3'];

export const SLOT_LABEL: Record<SlotId, string> = {
  auto: '自动存档',
  '1': '存档一',
  '2': '存档二',
  '3': '存档三',
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function defaultSettings(): GameSettings {
  // Phones/tablets default to medium to keep the first frames smooth.
  const coarse =
    typeof window !== 'undefined' &&
    !!window.matchMedia &&
    window.matchMedia('(pointer: coarse)').matches;
  return { quality: coarse ? 'medium' : 'high', muted: false, haptics: true };
}

function emptyFile(): SaveFile {
  return { version: 2, slots: {}, settings: defaultSettings() };
}

function normalizeState(parsed: GameState): GameState {
  if (!Array.isArray(parsed.gifts)) parsed.gifts = [];
  if (!Array.isArray(parsed.pills)) parsed.pills = [];
  if (!Array.isArray(parsed.talked)) parsed.talked = [];
  if (!Array.isArray(parsed.seenEvents)) parsed.seenEvents = [];
  if (!Array.isArray(parsed.log)) parsed.log = [];
  if (!Array.isArray(parsed.achievements)) parsed.achievements = [];
  if (!parsed.region) parsed.region = 'sect';
  if (!Array.isArray(parsed.regionActions)) parsed.regionActions = [];
  for (const d of parsed.disciples) {
    if (!('post' in d) || !d.post) d.post = null;
    if (typeof d.strain !== 'number') d.strain = 0;
    if (d.technique == null) d.technique = null;
  }
  if (!Array.isArray(parsed.candidates)) parsed.candidates = [];
  if (!Array.isArray(parsed.departed)) parsed.departed = [];
  if (!Array.isArray(parsed.storyDeferred)) parsed.storyDeferred = [];
  if (!parsed.eventSeenDay || typeof parsed.eventSeenDay !== 'object') parsed.eventSeenDay = {};
  if (typeof parsed.candidateSeed !== 'number') parsed.candidateSeed = 20261102;
  if (typeof parsed.checkSeed !== 'number') parsed.checkSeed = 778899;
  if (typeof parsed.candidateMain !== 'string') parsed.candidateMain = null;
  if (typeof parsed.candidateResolved !== 'boolean') parsed.candidateResolved = true;
  if (!parsed.dailyObjective || typeof parsed.dailyObjective !== 'object') parsed.dailyObjective = null;
  if (typeof parsed.sectMerits !== 'number') parsed.sectMerits = 0;
  if (typeof parsed.sectFaith !== 'number') parsed.sectFaith = 0;
  if (!parsed.faithBought || typeof parsed.faithBought !== 'object') parsed.faithBought = {};
  if (typeof parsed.faithRankIndex !== 'number') parsed.faithRankIndex = 0;
  if (typeof parsed.cycle !== 'number') parsed.cycle = 0;
  if (parsed.pendingTribulation !== 'steady' && parsed.pendingTribulation !== 'sword' && parsed.pendingTribulation !== 'pill') parsed.pendingTribulation = null;
  if (typeof parsed.season !== 'number') parsed.season = 0;
  if (typeof parsed.lastObjectiveId !== 'string') parsed.lastObjectiveId = '';
  if (!parsed.opening || typeof parsed.opening.name !== 'string') parsed.opening = { name: '青云遗脉', text: '' };
  if (!parsed.flags || typeof parsed.flags !== 'object') parsed.flags = {};
  if (!parsed.upgrades || typeof parsed.upgrades !== 'object') parsed.upgrades = {};

  // Buildings added after the save was written must exist or every
  // `state.buildings[id].level` would throw.
  if (!parsed.buildings || typeof parsed.buildings !== 'object') {
    parsed.buildings = initialBuildings();
  } else {
    const base = initialBuildings();
    for (const id of Object.keys(base) as Array<keyof typeof base>) {
      if (!parsed.buildings[id] || typeof parsed.buildings[id].level !== 'number') {
        parsed.buildings[id] = base[id];
      }
    }
  }

  // Player fields accrued over releases (artifacts in particular is read with
  // `.includes()` / `.length`, which throws when undefined).
  const p = parsed.player;
  if (p) {
    if (typeof p.realmIndex !== 'number') p.realmIndex = 2;
    if (typeof p.cultivation !== 'number') p.cultivation = 20;
    if (typeof p.root !== 'string') p.root = '水木双灵根';
    if (typeof p.qiMax !== 'number') p.qiMax = 120;
    if (typeof p.pills !== 'number') p.pills = 0;
    if (!Array.isArray(p.techniques)) p.techniques = ['青云剑诀'];
    if (typeof p.age !== 'number') p.age = 19;
    if (typeof p.lifespan !== 'number') p.lifespan = 120;
    if (typeof p.daoHeart !== 'number') p.daoHeart = 60;
    if (typeof p.karma !== 'number') p.karma = 0;
    if (typeof p.bottleneck !== 'boolean') p.bottleneck = false;
    if (typeof p.injury !== 'number') p.injury = 0;
    if (!Array.isArray(p.artifacts)) p.artifacts = [];
  }

  const r = parsed.resources;
  if (r) {
    for (const key of ['stones', 'herbs', 'insight', 'reputation', 'morale'] as const) {
      if (typeof r[key] !== 'number') r[key] = key === 'stones' ? 120 : key === 'herbs' ? 40 : key === 'insight' ? 8 : 12;
    }
  }
  return parsed;
}

export function formatPlaytime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h} 小时 ${m} 分`;
  return `${m} 分 ${s % 60} 秒`;
}

export function formatDate(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export class SaveManager {
  private data: SaveFile;

  constructor() {
    this.data = this.read();
    this.migrateLegacy();
  }

  get settings(): GameSettings {
    return { ...this.data.settings };
  }

  setSettings(patch: Partial<GameSettings>): void {
    this.data.settings = { ...this.data.settings, ...patch };
    this.write();
  }

  list(): Array<SaveMeta | null> {
    return SLOT_ORDER.map((slot) => this.data.slots[slot] ?? null);
  }

  meta(slot: SlotId): SaveMeta | null {
    return this.data.slots[slot] ?? null;
  }

  latest(): SaveMeta | null {
    let best: SaveMeta | null = null;
    for (const slot of SLOT_ORDER) {
      const meta = this.data.slots[slot];
      if (!meta) continue;
      if (!best || meta.updatedAt > best.updatedAt) best = meta;
    }
    return best ? clone(best) : null;
  }

  load(slot: SlotId): SaveMeta | null {
    const meta = this.data.slots[slot];
    return meta ? clone(meta) : null;
  }

  save(slot: SlotId, state: GameState, playSeconds: number): SaveMeta {
    const now = Date.now();
    const meta: SaveMeta = {
      slot,
      day: state.day,
      chapter: state.ending ? '第一章 · 终' : '第一章 · 残山剩水',
      updatedAt: now,
      playSeconds: Math.max(0, Math.round(playSeconds)),
      active: state.disciples.filter((d) => d.active).length,
      ending: state.ending?.title ?? null,
      state: clone(state),
    };
    this.data.slots[slot] = meta;
    this.write();
    return clone(meta);
  }

  delete(slot: SlotId): void {
    if (slot === 'auto') return;
    delete this.data.slots[slot];
    this.write();
  }

  exportSlot(slot: SlotId): string | null {
    const meta = this.data.slots[slot];
    if (!meta) return null;
    return JSON.stringify(meta, null, 2);
  }

  importText(text: string): { ok: boolean; message: string; slot?: SlotId } {
    try {
      const parsed = JSON.parse(text) as unknown;
      const meta = this.asMeta(parsed);
      if (!meta) return { ok: false, message: '不是有效的存档 JSON。' };
      const target: SlotId = meta.slot === 'auto' ? '1' : meta.slot;
      const next: SaveMeta = { ...meta, slot: target, updatedAt: Date.now() };
      this.data.slots[target] = next;
      this.write();
      return { ok: true, message: `已导入到${SLOT_LABEL[target]}。`, slot: target };
    } catch {
      return { ok: false, message: '存档 JSON 解析失败。' };
    }
  }

  private asMeta(value: unknown): SaveMeta | null {
    if (!value || typeof value !== 'object') return null;
    const v = value as Partial<SaveMeta> & { state?: GameState };
    if (!v.state || !Array.isArray(v.state.disciples)) return null;
    if (typeof v.day !== 'number') return null;
    const slot: SlotId =
      v.slot === '1' || v.slot === '2' || v.slot === '3' || v.slot === 'auto' ? v.slot : '1';
    return {
      slot,
      day: v.day,
      chapter: typeof v.chapter === 'string' ? v.chapter : '第一章 · 残山剩水',
      updatedAt: typeof v.updatedAt === 'number' ? v.updatedAt : Date.now(),
      playSeconds: typeof v.playSeconds === 'number' ? v.playSeconds : 0,
      active: typeof v.active === 'number' ? v.active : v.state.disciples.filter((d) => d.active).length,
      ending: typeof v.ending === 'string' ? v.ending : null,
      state: normalizeState(v.state),
    };
  }

  private read(): SaveFile {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return emptyFile();
      const parsed = JSON.parse(raw) as Partial<SaveFile>;
      if (!parsed || parsed.version !== 2 || typeof parsed.slots !== 'object') return emptyFile();
      // Older saves predate newer state fields (achievements, technique, …).
      // Normalise every slot on read, not just on import, otherwise those
      // fields stay undefined and the first `.length` on them throws.
      const slots: SaveFile['slots'] = {};
      for (const stored of Object.values(parsed.slots ?? {})) {
        const meta = this.asMeta(stored);
        if (meta) slots[meta.slot] = meta;
        else console.warn('[saves] dropped an unreadable slot (missing disciples/day)');
      }
      return {
        version: 2,
        slots,
        settings: { ...defaultSettings(), ...(parsed.settings ?? {}) },
      };
    } catch {
      return emptyFile();
    }
  }

  private migrateLegacy(): void {
    if (this.data.slots.auto) return;
    try {
      const raw = localStorage.getItem(LEGACY_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as GameState;
      if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.disciples)) return;
      this.data.slots.auto = {
        slot: 'auto',
        day: parsed.day,
        chapter: parsed.ending ? '第一章 · 终' : '第一章 · 残山剩水',
        updatedAt: Date.now(),
        playSeconds: 0,
        active: parsed.disciples.filter((d) => d.active).length,
        ending: parsed.ending?.title ?? null,
        state: normalizeState(parsed),
      };
      this.data.settings = { ...this.data.settings };
      this.write();
    } catch {
      /* ignore corrupt legacy save */
    }
  }

  private write(): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* quota / privacy mode */
    }
  }
}
