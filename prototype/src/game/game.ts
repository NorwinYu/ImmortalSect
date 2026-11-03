import {
  ALL_EVENTS,
  ERA_EVENTS,
  FREE_EVENTS,
  MAX_ACTION_POINTS,
  RECALL_EVENTS,
  MAX_DAY,
  PROLOGUE,
  UPGRADES,
  createInitialState,
  getEvent,
  realmName,
  playerRealmName,
  SEASON_BONUS,
  SEASONS,
  faithBoon,
  faithLevel,
  technique,
  sectPerk,
  sectRank,
  seasonOf,
  type DayReport,
  type Effect,
  type Ending,
  type GameState,
  type ObjectiveMetric,
  type StoryEvent,
  type Task,
} from './state';

import { secretKnown, talkResult, type TalkKind } from './dialogue';
import { SaveManager, type GameSettings, type SaveMeta, type SlotId } from './saves';
import { REGIONS, regionById, type RegionId } from './scenes';
import { BUILDING_BY_ID, isPostSpecialist, nextCost, nextDays, type BuildingId } from './buildings';
import { allArcsDone, arcProgress, arcSummary, nextArcEvent } from './arcs';
import { nextDemonEvent } from './demon';

export interface EndDayResult {
  report: DayReport;
  event: StoryEvent | null;
  ending: Ending | null;
}

export interface ChoiceResult {
  text: string;
  ending: Ending | null;
}

const clamp = (v: number, min: number, max: number): number => (v < min ? min : v > max ? max : v);

/** New Game+ gifts that scale with the cycle count (第2周目起). */
function cyclePerk(cycle: number) {
  if (cycle <= 0) return { stones: 0, pills: 0, techniques: [] as string[], insight: 0, daoHeart: 0, qiMax: 0 };
  const n = Math.min(cycle, 5);
  return {
    stones: 20 + cycle * 10,
    pills: Math.min(3, Math.ceil(n / 2)),
    techniques: n >= 2 ? ['霜刃'] : [],
    insight: Math.max(0, (n - 1) * 2),
    daoHeart: Math.min(12, (n - 1) * 3),
    qiMax: Math.min(50, (n - 1) * 10),
  };
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}


type ObjectiveReward = { kind: 'stones' | 'herbs' | 'insight' | 'reputation' | 'daoHeart'; amount: number };

interface ObjectiveDef {
  id: string;
  metric: ObjectiveMetric;
  /** Base stock to gain in a single day. */
  delta: number;
  /** Extra difficulty per elapsed day. */
  ramp: number;
  label: string;
  /** True when the metric is clamped to 0-100 (reputation / morale). */
  noble: boolean;
  reward: ObjectiveReward;
  merits: number;
}

const OBJECTIVE_ROSTER: ObjectiveDef[] = [
  { id: 'herbs', metric: 'herbs', delta: 14, ramp: 0.3, label: '积攒药材', noble: false, reward: { kind: 'stones', amount: 6 }, merits: 10 },
  { id: 'stones', metric: 'stones', delta: 12, ramp: 0.4, label: '灵石入库', noble: false, reward: { kind: 'insight', amount: 2 }, merits: 8 },
  { id: 'insight', metric: 'insight', delta: 6, ramp: 0.2, label: '参悟心得', noble: false, reward: { kind: 'reputation', amount: 3 }, merits: 10 },
  { id: 'reputation', metric: 'reputation', delta: 5, ramp: 0.2, label: '广结声望', noble: true, reward: { kind: 'herbs', amount: 10 }, merits: 12 },
  { id: 'morale', metric: 'morale', delta: 6, ramp: 0.2, label: '提振士气', noble: true, reward: { kind: 'daoHeart', amount: 5 }, merits: 14 },
];

function metricValue(metric: ObjectiveMetric, s: GameState): number {
  const r = s.resources;
  if (metric === 'stones') return r.stones;
  if (metric === 'herbs') return r.herbs;
  if (metric === 'insight') return r.insight;
  if (metric === 'reputation') return r.reputation;
  return r.morale;
}

export class Game {
  state: GameState;
  isLoaded: boolean;
  playSeconds = 0;
  readonly saves: SaveManager;

  constructor(fresh = false) {
    this.saves = new SaveManager();
    if (!fresh) {
      const latest = this.saves.latest();
      if (latest) {
        this.state = latest.state;
        this.isLoaded = true;
        this.playSeconds = latest.playSeconds;
        this.ensureObjective();
        return;
      }
    }
    this.state = createInitialState();
    this.isLoaded = false;
    this.ensureObjective();
    this.save();
  }

  get activeDisciples() {
    return this.state.disciples.filter((d) => d.active);
  }

  get perk() {
    return sectPerk(this.state.sectMerits);
  }

  get maxActionPoints() {
    return MAX_ACTION_POINTS + this.perk.actionPoints;
  }

  get prologuePending(): boolean {
    return this.state.day === 1 && !this.state.seenEvents.includes('prologue');
  }

  get ending(): Ending | null {
    return this.state.ending;
  }

  getEventById(id: string): StoryEvent | null {
    return id === 'prologue' ? PROLOGUE : (getEvent(id) ?? null);
  }

  getEvent(): StoryEvent | null {
    if (!this.state.pendingEvent) return null;
    return getEvent(this.state.pendingEvent) ?? null;
  }

  getPrologue(): StoryEvent {
    return PROLOGUE;
  }

  assign(id: string, task: Task): void {
    const d = this.state.disciples.find((x) => x.id === id);
    if (!d || !d.active || this.state.ending) return;
    if (d.injury >= 70 && task !== 'rest') return;
    d.assignment = task;
    this.save();
  }

  travel(id: RegionId): void {
    if (this.state.ending) return;
    this.state.region = id;
    this.log(`你来到${regionById(id).name}。`, 'story');
    this.save();
  }

  regionAction(id: string): { ok: boolean; text: string; title: string } {
    if (this.state.ending) return { ok: false, text: '本章已终。', title: '山门之外' };
    const def = REGIONS.find((r) => r.action?.id === id);
    if (!def) return { ok: false, text: '这里没有可做的事。', title: '山门之外' };
    if (this.state.region !== def.id) return { ok: false, text: '你不在这里。', title: def.name };
    if (this.state.regionActions.includes(id)) {
      return { ok: false, text: '今日已经做过了，明日再来。', title: def.action?.label ?? def.name };
    }
    if (this.state.actionPoints <= 0) {
      return { ok: false, text: '今日行动已尽。', title: def.action?.label ?? def.name };
    }

    let text = '';
    if (id === 'swordMeditate') {
      this.state.resources.insight += 4;
      this.state.flags.swordTomb = true;
      this.state.player.cultivation += 6;
      if (this.state.player.cultivation >= 100) {
        this.state.player.cultivation = 100;
        this.state.player.bottleneck = true;
      }
      if (!this.state.player.techniques.includes('霜刃')) this.state.player.techniques.push('霜刃');
      text = '你在残碑前坐下。剑冢里没有风，但剑在响。起身时，心得 +4，修为 +6，习得「霜刃」。';
    } else if (id === 'gatherHerbs') {
      const gain = 18 + (this.state.upgrades.herbGarden ? 6 : 0);
      this.state.resources.herbs += gain;
      this.state.flags.herbGarden = true;
      text = `你收了一筐当季灵草，药材 +${gain}。`;
    } else {
      return { ok: false, text: '这里需要另一种做法。', title: def.name };
    }

    this.state.regionActions.push(id);
    this.state.actionPoints = Math.max(0, this.state.actionPoints - 1);
    this.state.log.unshift({ day: this.state.day, text, tone: 'good' });
    this.save();
    return { ok: true, text, title: def.action?.label ?? def.name };
  }

  market(kind: 'buy' | 'sell' | 'rumor' | 'pill'): { ok: boolean; text: string } {
    if (this.state.ending) return { ok: false, text: '本章已终。' };
    if (this.state.region !== 'market') return { ok: false, text: '你不在这里。' };
    if (this.state.regionActions.includes('market')) {
      return { ok: false, text: '今日已经赶过集了，明日再来。' };
    }
    if (this.state.actionPoints <= 0) {
      return { ok: false, text: '今日行动已尽。' };
    }

    if (kind === 'buy') {
      if (this.state.resources.stones < 25) return { ok: false, text: '灵石不足，买不起这批药材。' };
      this.state.resources.stones -= 25;
      this.state.resources.herbs += 30;
      this.state.log.unshift({ day: this.state.day, text: '坊市买入药材：灵石 -25，药材 +30。', tone: 'good' });
    } else if (kind === 'sell') {
      if (this.state.resources.herbs < 20) return { ok: false, text: '药材不足，没有可卖的。' };
      this.state.resources.herbs -= 20;
      this.state.resources.stones += 30;
      this.state.log.unshift({ day: this.state.day, text: '坊市卖出药材：药材 -20，灵石 +30。', tone: 'good' });
    } else if (kind === 'pill') {
      if (this.state.resources.stones < 30) return { ok: false, text: '灵石不足，买不起丹药。' };
      this.state.resources.stones -= 30;
      this.state.player.pills += 1;
      this.state.log.unshift({ day: this.state.day, text: '坊市买入一枚温养丹：灵石 -30。', tone: 'good' });
    } else {
      this.state.resources.reputation = clamp(this.state.resources.reputation + 3, 0, 100);
      this.state.flags.marketRumor = true;
      this.state.log.unshift({ day: this.state.day, text: '你在坊市打听到一条消息：声望 +3。', tone: 'good' });
    }

    this.state.regionActions.push('market');
    this.state.actionPoints = Math.max(0, this.state.actionPoints - 1);
    this.save();
    if (kind === 'buy') return { ok: true, text: '行商把三包药材推过来。灵石 -25，药材 +30。' };
    if (kind === 'sell') return { ok: true, text: '药材卖了不错的价。药材 -20，灵石 +30。' };
    if (kind === 'pill') return { ok: true, text: '你收下一枚温养丹。灵石 -30，丹药 +1。' };
    return { ok: true, text: '你听了一耳朵山下的风声。声望 +3，或许以后有用。' };
  }

  canMeditate(): { ok: boolean; reason: string } {
    if (this.state.ending) return { ok: false, reason: '本章已终' };
    if (this.state.player.bottleneck) return { ok: false, reason: '已到瓶颈，先破境' };
    if (this.state.playerActions.includes('meditate')) return { ok: false, reason: '今日已打坐' };
    if (this.state.actionPoints <= 0) return { ok: false, reason: '今日行动已尽' };
    return { ok: true, reason: '' };
  }

  meditate(): { ok: boolean; text: string } {
    const check = this.canMeditate();
    if (!check.ok) return { ok: false, text: check.reason };
    const p = this.state.player;
    const gain = Math.max(4, Math.round(9 + p.daoHeart / 20 - p.injury / 20 + (p.root.includes('天') ? 4 : 0) + (this.state.flags.swordTomb ? 2 : 0) + this.state.buildings.sword.level + (p.artifacts.includes('vein_locket') ? 2 : 0)));
    p.cultivation = Math.min(100, p.cultivation + gain);
    if (p.cultivation >= 100) {
      p.cultivation = 100;
      p.bottleneck = true;
    }
    this.state.playerActions.push('meditate');
    this.state.actionPoints = Math.max(0, this.state.actionPoints - 1);
    this.state.log.unshift({ day: this.state.day, text: `你在静室打坐，修为 +${gain}。`, tone: 'good' });
    this.save();
    return {
      ok: true,
      text: p.bottleneck
        ? `修为 +${gain}。气海已满，${playerRealmName(p.realmIndex)}的瓶颈到了。`
        : `你在静室坐了两个时辰。修为 +${gain}。`,
    };
  }

  private buildingRefineCost(): number {
    return Math.max(8, 20 - this.state.buildings.alchemy.level * 3);
  }

  refinePill(): { ok: boolean; text: string } {
    const cost = this.buildingRefineCost();
    if (this.state.resources.herbs < cost) return { ok: false, text: '药材不足，炼不了一炉。' };
    if (this.state.playerActions.includes('refine')) return { ok: false, text: '今日已经炼过一炉。' };
    if (this.state.actionPoints <= 0) return { ok: false, text: '今日行动已尽。' };
    this.state.resources.herbs -= cost;
    this.state.player.pills += 1;
    this.state.playerActions.push('refine');
    this.state.actionPoints = Math.max(0, this.state.actionPoints - 1);
    this.state.log.unshift({ day: this.state.day, text: `你炼成一枚温养丹，药材 -${cost}。`, tone: 'good' });
    this.save();
    return { ok: true, text: `一炉温养丹成了。药材 -${cost}，丹药 +1。` };
  }

  upgradeBuilding(id: BuildingId): { ok: boolean; text: string } {
    const def = BUILDING_BY_ID[id];
    const b = this.state.buildings[id];
    if (!def || !b) return { ok: false, text: '没有这栋建筑。' };
    if (b.construction > 0) return { ok: false, text: `${def.name}还在修建中。` };
    if (b.level >= def.maxLevel) return { ok: false, text: `${def.name}已到最高等级。` };
    const cost = nextCost(def, b.level);
    if (!cost) return { ok: false, text: '无法继续升级。' };
    for (const [key, value] of Object.entries(cost)) {
      const res = this.state.resources[key as keyof Game['state']['resources']];
      if (res < (value ?? 0)) {
        return { ok: false, text: '资源不足。' };
      }
    }
    for (const [key, value] of Object.entries(cost)) {
      this.state.resources[key as keyof Game['state']['resources']] -= value ?? 0;
    }
    b.construction = nextDays(def, b.level);
    this.state.log.unshift({ day: this.state.day, text: `${def.name}开始修建，预计 ${b.construction} 日。`, tone: 'story' });
    this.save();
    return { ok: true, text: `${def.name}开工，预计 ${b.construction} 日完成。` };
  }

  usePill(): { ok: boolean; text: string } {
    const p = this.state.player;
    if (p.pills <= 0) return { ok: false, text: '没有丹药了。' };
    if (p.cultivation >= 100 || p.bottleneck) return { ok: false, text: '气海已满，先破境。' };
    p.pills -= 1;
    p.cultivation = Math.min(100, p.cultivation + 12);
    if (p.cultivation >= 100) {
      p.cultivation = 100;
      p.bottleneck = true;
    }
    this.state.log.unshift({ day: this.state.day, text: '你服下一枚温养丹，修为 +12。', tone: 'good' });
    this.save();
    return { ok: true, text: '丹药入腹，气海一暖。修为 +12。' };
  }

  breakthroughInfo(): { ok: boolean; text: string; next: string; chance: number; tribulation: boolean; pills: number } {
    const p = this.state.player;
    if (!p.bottleneck) return { ok: false, text: '气海未满，还不到破境的时候。', next: '', chance: 0, tribulation: false, pills: p.pills };
    if (p.realmIndex >= 10) return { ok: false, text: '此界已到尽头。', next: '', chance: 0, tribulation: false, pills: p.pills };
    const nextIndex = p.realmIndex + 1;
    const chance = Math.max(0.22, Math.min(0.92, 0.52 + p.daoHeart / 250 - p.realmIndex * 0.025 + (p.techniques.length - 1) * 0.02 + (p.artifacts.includes('trial_seal') ? 0.05 : 0)));
    return {
      ok: true,
      text: `你已站在${playerRealmName(p.realmIndex)}的尽头。再进一步，便是${playerRealmName(nextIndex)}。`,
      next: playerRealmName(nextIndex),
      chance,
      tribulation: nextIndex >= 9,
      pills: p.pills,
    };
  }

  attemptBreakthrough(method: 'steady' | 'sword' | 'pill'): { ok: boolean; text: string; success: boolean; realm: string } {
    const info = this.breakthroughInfo();
    const p = this.state.player;
    if (!info.ok) return { ok: false, text: info.text, success: false, realm: playerRealmName(p.realmIndex) };
    let chance = info.chance;
    if (method === 'sword') chance += p.techniques.includes('霜刃') ? 0.1 : 0.04;
    if (method === 'pill') {
      if (p.pills <= 0) return { ok: false, text: '没有丹药护体。', success: false, realm: playerRealmName(p.realmIndex) };
      p.pills -= 1;
      chance += 0.16;
    }
    chance = Math.min(0.96, chance);
    const success = Math.random() < chance;

    if (success) {
      p.realmIndex += 1;
      p.cultivation = 0;
      p.bottleneck = false;
      p.qiMax = 100 + p.realmIndex * 10;
      p.daoHeart = Math.min(100, p.daoHeart + 3);
      p.lifespan += 5;
      this.state.log.unshift({ day: this.state.day, text: `破境成功，入${playerRealmName(p.realmIndex)}。`, tone: 'good' });
      this.save();
      return {
        ok: true,
        success: true,
        realm: playerRealmName(p.realmIndex),
        text: `${info.tribulation ? '雷声在云里滚了很久，最后散了。' : '气海一开，天地忽然宽了。'}

你破境成功，入${playerRealmName(p.realmIndex)}。真气上限提升，寿元 +5。`,
      };
    }

    p.cultivation = 55;
    p.bottleneck = false;
    p.daoHeart = Math.max(0, p.daoHeart - 6);
    p.injury = Math.min(100, p.injury + 18);
    if (info.tribulation) p.lifespan = Math.max(1, p.lifespan - 8);
    this.state.log.unshift({ day: this.state.day, text: `破境失败，道心受损。`, tone: 'bad' });
    this.save();
    return {
      ok: true,
      success: false,
      realm: playerRealmName(p.realmIndex),
      text: `${info.tribulation ? '雷光落下，你被劈回石阶。' : '气海一乱，你吐出一口血。'}

破境失败：修为跌回 55，道心 -6，伤势 +18${info.tribulation ? '，寿元 -8' : ''}。`,
    };
  }

  /** Enter the tribulation boss fight. Choices 3D before the dice is cast. */
  beginTribulation(method: 'steady' | 'sword' | 'pill'): { ok: boolean; text: string } {
    const info = this.breakthroughInfo();
    const p = this.state.player;
    if (!info.ok || !info.tribulation) return { ok: false, text: '还未到天劫之时。' };
    if (method === 'pill') {
      if (p.pills <= 0) return { ok: false, text: '没有丹药护体。' };
      p.pills -= 1;
    }
    this.state.pendingTribulation = method;
    this.save();
    return { ok: true, text: '雷云压顶，天劫化形。拔剑，迎之。' };
  }

  /** Resolve the tribulation boss fight: win forces the breakthrough. */
  resolveTribulation(won: boolean): { ok: boolean; success: boolean; realm: string; text: string } {
    const method = this.state.pendingTribulation;
    const p = this.state.player;
    if (!method) return { ok: false, success: false, realm: playerRealmName(p.realmIndex), text: '' };
    this.state.pendingTribulation = null;

    if (won) {
      p.realmIndex += 1;
      p.cultivation = 0;
      p.bottleneck = false;
      p.qiMax = 100 + p.realmIndex * 10;
      p.daoHeart = Math.min(100, p.daoHeart + 3);
      p.lifespan += 5;
      this.state.log.unshift({ day: this.state.day, text: `渡过天劫，入${playerRealmName(p.realmIndex)}。`, tone: 'good' });
      this.save();
      return {
        ok: true,
        success: true,
        realm: playerRealmName(p.realmIndex),
        text: `雷劫散尽，你一剑斩开了天光。\n\n渡劫成功，入${playerRealmName(p.realmIndex)}。真气上限提升，寿元 +5。`,
      };
    }

    p.cultivation = 55;
    p.bottleneck = false;
    p.daoHeart = Math.max(0, p.daoHeart - 6);
    p.injury = Math.min(100, p.injury + 18);
    p.lifespan = Math.max(1, p.lifespan - 8);
    this.state.log.unshift({ day: this.state.day, text: '天劫落下，道心受损。', tone: 'bad' });
    this.save();
    return {
      ok: true,
      success: false,
      realm: playerRealmName(p.realmIndex),
      text: `雷光落下，把你劈回石阶。\n\n渡劫失败：修为跌回 55，道心 -6，伤势 +18，寿元 -8。`,
    };
  }

  /** Abandon a tribulation duel by walking away — no breakthrough, later retry. */
  cancelTribulation(): string {
    if (!this.state.pendingTribulation) return '';
    this.state.pendingTribulation = null;
    this.state.log.unshift({ day: this.state.day, text: '从天劫下退走，境界未动。', tone: 'bad' });
    this.save();
    return '暂避天劫 · 来日再渡';
  }

  talk(id: string, kind: TalkKind): { ok: boolean; text: string } {
    const d = this.state.disciples.find((x) => x.id === id);
    if (!d || !d.active) return { ok: false, text: '山门里没有这个人。' };
    if (kind === 'leave') return { ok: true, text: '改日再叙。' };
    if (this.state.talked.includes(id)) {
      return { ok: false, text: `${d.name}今日已经与你说过话了。明日再来吧。` };
    }
    if (kind === 'heart' && !secretKnown(d, this.state)) {
      return { ok: false, text: `${d.name}还没有把心事交给你。` };
    }
    if (this.state.talked.length >= 2) {
      return { ok: false, text: '今日已与两名弟子叙过。宗门事多，明日再谈吧。' };
    }
    if (this.state.actionPoints <= 0) {
      return { ok: false, text: '今日行动已尽。明日再谈吧。' };
    }

    if (kind === 'chat') {
      d.bond = clamp(d.bond + 3, 0, 100);
      d.mood = clamp(d.mood + 2, 0, 100);
      this.log(`你与${d.name}闲聊片刻，忠诚 +3，道心 +2。`, 'good');
    } else if (kind === 'train') {
      this.addCultivation(d, 6);
      d.mood = clamp(d.mood + 1, 0, 100);
      this.log(`你指点${d.name}修行，修为 +6。`, 'good');
    } else if (kind === 'heart') {
      this.state.resources.insight += 2;
      d.bond = clamp(d.bond + 4, 0, 100);
      this.state.flags[`heart_${d.id}`] = true;
      this.log(`${d.name}向你吐露了心事。心得 +2，忠诚 +4。`, 'story');
    }

    this.state.talked.push(id);
    this.state.actionPoints = Math.max(0, this.state.actionPoints - 1);
    this.save();
    return { ok: true, text: talkResult(d, kind) };
  }

  useHerb(id: string): { ok: boolean; message: string } {
    const d = this.state.disciples.find((x) => x.id === id);
    if (!d || !d.active || this.state.ending) return { ok: false, message: '无法温养' };
    if (this.state.pills.includes(id)) return { ok: false, message: '今日已温养' };
    if (this.state.resources.herbs < 20) return { ok: false, message: '药材不足' };

    this.state.resources.herbs -= 20;
    this.state.pills.push(id);
    this.addCultivation(d, 10);
    d.mood = clamp(d.mood + 2, 0, 100);
    this.log(`你以药材温养${d.name}，修为 +10。`, 'good');
    this.save();
    return { ok: true, message: `${d.name} 修为 +10` };
  }

  gift(id: string): { ok: boolean; message: string } {
    const d = this.state.disciples.find((x) => x.id === id);
    if (!d || !d.active || this.state.ending) return { ok: false, message: '无法赠礼' };
    if (this.state.gifts.includes(id)) return { ok: false, message: '今日已赠过' };
    if (this.state.resources.stones < 30) return { ok: false, message: '灵石不足' };

    this.state.resources.stones -= 30;
    this.state.gifts.push(id);
    d.bond = clamp(d.bond + 8, 0, 100);
    d.mood = clamp(d.mood + 4, 0, 100);
    this.log(`${d.name}收下你的礼物，耳根有点红。`, 'good');
    this.save();
    return { ok: true, message: `${d.name} 忠诚 +8` };
  }

  /** Teach a technique to a disciple, spending insight (功法研习). */
  teachTechnique(id: string, techId: string): { ok: boolean; message: string } {
    const d = this.state.disciples.find((x) => x.id === id);
    const t = technique(techId);
    if (!d || !d.active || this.state.ending) return { ok: false, message: '无法传法' };
    if (!t) return { ok: false, message: '没有这门功法' };
    if (d.technique === techId) return { ok: false, message: `${d.name}已会${t.name}` };
    if (this.state.resources.insight < t.cost) return { ok: false, message: `心得不足（需 ${t.cost}）` };
    this.state.resources.insight -= t.cost;
    d.technique = techId;
    this.log(`你将${t.name}传给了${d.name}。`, 'good');
    this.save();
    return { ok: true, message: `${d.name} 习得「${t.name}」· ${t.bonus}` };
  }

  canUpgrade(id: string): { ok: boolean; message: string } {
    if (this.state.ending) return { ok: false, message: '本章已终' };
    const def = UPGRADES.find((u) => u.id === id);
    if (!def) return { ok: false, message: '未知建筑' };
    if (this.state.upgrades[id]) return { ok: false, message: '已建成' };
    for (const [key, value] of Object.entries(def.cost)) {
      const have = this.state.resources[key as keyof GameState['resources']] ?? 0;
      if (have < (value ?? 0)) {
        return { ok: false, message: `${key === 'stones' ? '灵石' : key === 'herbs' ? '药材' : key === 'insight' ? '心得' : '声望'}不足` };
      }
    }
    return { ok: true, message: '' };
  }

  upgrade(id: string): { ok: boolean; message: string } {
    const check = this.canUpgrade(id);
    if (!check.ok) return check;
    const def = UPGRADES.find((u) => u.id === id)!;
    for (const [key, value] of Object.entries(def.cost)) {
      this.state.resources[key as keyof GameState['resources']] -= value ?? 0;
    }
    this.state.upgrades[id] = true;
    this.log(`宗门建成「${def.name}」：${def.effect}。`, 'good');
    this.save();
    return { ok: true, message: `${def.name}建成` };
  }

  /** Applies a story choice. Handles the final tournament specially. */
  choose(eventId: string, optionId: string): ChoiceResult {
    const event = eventId === 'prologue' ? PROLOGUE : getEvent(eventId);
    if (!event) return { text: '事件不存在。', ending: null };
    const option = event.options.find((o) => o.id === optionId);
    if (!option) return { text: '选项不存在。', ending: null };
    if (option.requires && !option.requires(this.state)) {
      return { text: option.requireText ?? '条件不足。', ending: null };
    }

    let outcome = option.result;
    let effects = option.effects;
    if (option.check) {
      const chance = this.checkChance(option);
      if (this.rollCheck() >= chance) {
        outcome = option.check.failText;
        effects = option.check.failEffects;
      }
    }
    for (const effect of effects) this.applyEffect(effect);

    if (eventId === 'tournament') {
      const ending = this.resolveEnding(optionId);
      this.state.ending = ending;
      this.state.pendingEvent = null;
      this.state.candidates = [];
      this.state.candidateMain = null;
      this.state.candidateResolved = true;
      this.state.eventSeenDay[eventId] = this.state.day;
      this.state.seenEvents.push(eventId);
      this.save();
      return { text: ending.text, ending };
    }

    if (outcome) this.log(outcome, 'story');
    if (eventId === 'free_finale') {
      for (const line of this.arcStatus().summary) this.log(line, 'story');
    }
    this.state.pendingEvent = null;
    this.state.candidates = [];
    this.state.candidateMain = null;
    this.state.candidateResolved = true;
    this.state.storyDeferred = this.state.storyDeferred.filter((id) => id !== eventId);
    this.state.eventSeenDay[eventId] = this.state.day;
    if (!this.state.seenEvents.includes(eventId)) this.state.seenEvents.push(eventId);
    this.save();
    return { text: outcome, ending: null };
  }

  /** Public so the option UI can show the same chance the roll uses. */
  checkChance(option: { check?: { chance: number | ((s: GameState) => number) } }): number {
    if (!option.check) return 100;
    const raw = typeof option.check.chance === 'function' ? option.check.chance(this.state) : option.check.chance;
    return Math.max(5, Math.min(95, Math.round(raw)));
  }

  private rollCheck(): number {
    let seed = this.state.checkSeed >>> 0;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    this.state.checkSeed = seed;
    return seed / 4294967296;
  }

  // — 今日要务 / 宗门功业 / 弟子离心 ———————————————————

  private ensureObjective(): void {
    const o = this.state.dailyObjective;
    if (!o || !OBJECTIVE_ROSTER.some((r) => r.id === o.id)) this.rollObjective();
  }

  private rollObjective(): void {
    // An unmet objective persists across days (progress keeps accumulating);
    // a fresh one is rolled only when none is active or the last was done.
    if (this.state.dailyObjective && !this.state.dailyObjective.done) return;
    const pool = OBJECTIVE_ROSTER.filter((r) => r.id !== this.state.lastObjectiveId);
    if (pool.length === 0) return;
    const def = pool[Math.floor(Math.random() * pool.length)];
    const cur = metricValue(def.metric, this.state);
    let target = Math.round(cur + def.delta + Math.floor(this.state.day * def.ramp));
    if (def.noble) target = Math.min(100, Math.max(cur + 2, target));
    this.state.dailyObjective = { id: def.id, metric: def.metric, target, done: false };
    this.state.lastObjectiveId = def.id;
  }

  /** Human-readable description with live progress, or null when none. */
  objectiveDesc(): string | null {
    const o = this.state.dailyObjective;
    if (!o) return null;
    const def = OBJECTIVE_ROSTER.find((r) => r.id === o.id);
    if (!def) return null;
    const v = Math.round(metricValue(def.metric, this.state));
    return `今日要务 · ${def.label} ${v}/${o.target}`;
  }

  private evaluateObjective(lines: DayReport['lines']): void {
    const o = this.state.dailyObjective;
    if (!o || o.done) return;
    const def = OBJECTIVE_ROSTER.find((r) => r.id === o.id);
    if (!def) return;
    const v = metricValue(def.metric, this.state);
    if (v >= o.target) {
      o.done = true;
      this.state.sectMerits += def.merits;
      this.state.sectFaith += 1;
      const reward = this.applyReward(def.reward);
      const text = `要务达成：${def.label}至 ${o.target}。宗门功业 +${def.merits}，香火 +1，${reward}。`;
      lines.push({ text, tone: 'good' });
      this.log(text, 'good');
    } else {
      lines.push({ text: `今日要务未竟：${def.label}差 ${Math.round(o.target - v)}。`, tone: 'neutral' });
    }
  }

  /** Passive daily harvest granted by the current sect rank. */
  private processSectPerk(lines: DayReport['lines']): void {
    const p = this.perk;
    const r = this.state.resources;
    const parts: string[] = [];
    if (p.stones) { r.stones += p.stones; parts.push(`灵石 +${p.stones}`); }
    if (p.herbs) { r.herbs += p.herbs; parts.push(`药材 +${p.herbs}`); }
    if (p.insight) { r.insight += p.insight; parts.push(`心得 +${p.insight}`); }
    if (p.reputation) { r.reputation = clamp(r.reputation + p.reputation, 0, 100); parts.push(`声望 +${p.reputation}`); }
    if (parts.length) {
      const text = `宗阶香火「${p.label}」：${parts.join('，')}。`;
      lines.push({ text, tone: 'good' });
    }
  }

  /** Current purchased level of a faith-ladder boon. */
  faithBoonLevel(id: string): number {
    return faithLevel(this.state.faithBought, id);
  }

  /** Spend incense on the next level of a faith-ladder boon. */
  spendFaith(boonId: string): { ok: boolean; text: string; level: number } {
    const boon = faithBoon(boonId);
    if (!boon) return { ok: false, text: '香火天梯无此项。', level: 0 };
    const cur = this.faithBoonLevel(boonId);
    if (cur >= boon.maxLevel) return { ok: false, text: `${boon.name}已修到极致。`, level: cur };
    const cost = boon.costs[cur];
    if (this.state.sectFaith < cost) return { ok: false, text: `香火不足（需 ${cost}）。`, level: cur };
    this.state.sectFaith -= cost;
    this.state.faithBought[boonId] = cur + 1;
    this.save();
    return {
      ok: true,
      text: `${boon.name}升至 ${cur + 1} 级：${boon.effects[cur]}。`,
      level: cur + 1,
    };
  }

  /**
   * Faith ladder: grant a one-time incense bonus for each newly crossed sect
   * rank, and harvest passive boon income for the day.
   */
  private processFaith(lines: DayReport['lines']): void {
    const st = this.state;
    const rankIdx = sectRank(st.sectMerits).index;
    let granted = 0;
    while (rankIdx > st.faithRankIndex) {
      st.faithRankIndex += 1;
      st.sectFaith += 2;
      granted += 2;
    }
    if (granted > 0) {
      const text = `宗门晋升「${sectRank(st.sectMerits).name}」，香火 +${granted}。`;
      lines.push({ text, tone: 'good' });
      this.log(text, 'good');
    }

    // Passive boon harvest (production + reputation).
    const r = st.resources;
    const parts: string[] = [];
    const vein = this.faithBoonLevel('vein');
    if (vein > 0) { r.herbs += vein * 2; r.stones += vein * 2; parts.push(`药材 +${vein * 2}，灵石 +${vein * 2}`); }
    const array = this.faithBoonLevel('array');
    if (array > 0) { r.reputation = clamp(r.reputation + array, 0, 100); parts.push(`声望 +${array}`); }
    if (parts.length) {
      const text = `香火天梯：${parts.join('，')}。`;
      lines.push({ text, tone: 'good' });
    }
  }

  private applyReward(r: ObjectiveReward): string {
    const res = this.state.resources;
    switch (r.kind) {
      case 'stones':
        res.stones += r.amount;
        return `灵石 +${r.amount}`;
      case 'herbs':
        res.herbs += r.amount;
        return `药材 +${r.amount}`;
      case 'insight':
        res.insight += r.amount;
        return `心得 +${r.amount}`;
      case 'reputation':
        res.reputation = clamp(res.reputation + r.amount, 0, 100);
        return `声望 +${r.amount}`;
      case 'daoHeart':
        this.state.player.daoHeart = clamp(this.state.player.daoHeart + r.amount, 0, 100);
        return `道心 +${r.amount}`;
    }
  }

  /** Day-over-day dissatisfaction; a neglected disciple may leave the sect. */
  private applyStrain(d: Game['state']['disciples'][number], lines: DayReport['lines']): void {
    let next = d.strain ?? 0;
    if (d.mood < 30 || d.injury >= 70) next += 1;
    else if (d.mood >= 55) next = Math.max(0, next - 1);
    d.strain = next;

    if (next === 2) {
      lines.push({ text: `${d.name}近来心绪不稳，若再冷落怕是会生去意。`, tone: 'bad' });
    } else if (next >= 4) {
      let chance = 0.25 + (1 - d.bond / 100) * 0.6;
      chance = Math.max(0.06, chance - this.faithBoonLevel('array') * 0.18); // 护山大阵
      if (Math.random() < chance) {
        d.active = false;
        d.post = null;
        d.assignment = 'rest';
        d.strain = 0;
        if (!this.state.departed.includes(d.id)) this.state.departed.push(d.id);
        this.state.resources.reputation = clamp(this.state.resources.reputation - 2, 0, 100);
        this.state.player.daoHeart = clamp(this.state.player.daoHeart - 3, 0, 100);
        lines.push({ text: `${d.name}心灰意冷，收拾行囊离开了青云宗。`, tone: 'bad' });
        this.log(`${d.name}离开了青云宗。山门声望与你的道心都蒙了尘。`, 'bad');
      } else {
        lines.push({ text: `${d.name}动了去意，却仍在迟疑。`, tone: 'bad' });
      }
    }
  }

  get hasCandidates(): boolean {
    return this.state.candidates.length > 0 && !this.state.candidateResolved;
  }

  canEndDay(): boolean {
    return !this.state.ending && !this.state.pendingEvent && !this.hasCandidates;
  }

  endDay(): EndDayResult {
    if (this.state.ending) {
      return {
        report: { day: this.state.day, lines: [], resources: this.state.resources },
        event: null,
        ending: this.state.ending,
      };
    }

    if (this.state.pendingEvent || this.hasCandidates) {
      return {
        report: { day: this.state.day, lines: [{ text: '先处理今日候选，再结束今日。', tone: 'neutral' }], resources: this.state.resources },
        event: null,
        ending: null,
      };
    }

    const day = this.state.day;
    const lines: DayReport['lines'] = [];

    for (const d of this.activeDisciples) {
      if (d.injury >= 70 && d.assignment !== 'rest') {
        d.assignment = 'rest';
        lines.push({ text: `${d.name}伤势太重，被送去药庐休养。`, tone: 'bad' });
      }
      this.resolveTask(d, lines);
      this.applyStrain(d, lines);
    }

    for (const line of lines) this.log(line.text, line.tone);

    this.driftRelationships();

    this.state.day = this.state.freeMode
      ? this.state.day + 1
      : Math.min(MAX_DAY, this.state.day + 1);
    this.state.actionPoints = this.maxActionPoints;
    this.state.gifts = [];
    this.state.pills = [];
    this.state.talked = [];
    this.state.regionActions = [];
    this.state.playerActions = [];

    // Season rotation (3 days each; winter rolls back to spring).
    const season = seasonOf(this.state.day).index;
    if (season !== this.state.season) {
      this.state.season = season;
      lines.push({ text: `节气轮转 · ${SEASONS[season].name}${SEASONS[season].label}`, tone: 'neutral' });
      this.log(`节气轮转，入${SEASONS[season].name}。`, 'neutral');
    }

    this.state.pendingEvent = null;
    this.state.candidates = [];
    this.state.candidateMain = null;
    this.state.candidateResolved = false;
    if (this.state.day >= MAX_DAY && !this.state.freeMode) {
      this.state.pendingEvent = 'tournament';
      this.state.candidateResolved = true;
    } else {
      this.buildCandidates();
      this.state.candidateResolved = this.state.candidates.length === 0;
    }

    this.state.resources.morale = Math.round(
      avg(this.activeDisciples.map((d) => d.mood)) * 0.75 + this.state.resources.reputation * 0.25,
    );

    this.processBuildings(lines);
    this.evaluateObjective(lines);
    this.processSectPerk(lines);
    this.processFaith(lines);
    this.processSeason(lines);
    this.advanceYear(lines);
    this.rollObjective();
    this.log(`第 ${day} 日结束。`, 'neutral');

    if (!this.state.ending && this.state.player.age >= this.state.player.lifespan) {
      this.state.ending = this.resolveLifespanEnding();
    }
    this.save();

    return {
      report: { day, lines, resources: { ...this.state.resources } },
      event: this.state.pendingEvent ? this.getEvent() : null,
      ending: this.state.ending ?? null,
    };
  }

  /** Daily harvest granted by the current season. */
  private processSeason(lines: DayReport['lines']): void {
    const r = this.state.resources;
    const b = SEASON_BONUS[this.state.season];
    const parts: string[] = [];
    if (b.herbs) { r.herbs += b.herbs; parts.push(`药材 +${b.herbs}`); }
    if (b.insight) { r.insight += b.insight; parts.push(`心得 +${b.insight}`); }
    if (b.stones) { r.stones += b.stones; parts.push(`灵石 +${b.stones}`); }
    if (b.reputation) { r.reputation = clamp(r.reputation + b.reputation, 0, 100); parts.push(`声望 +${b.reputation}`); }
    if (parts.length) {
      lines.push({ text: `节气「${SEASONS[this.state.season].name}」：${parts.join('，')}。`, tone: 'good' });
    }
  }

  /** Advance the player's age every twelve days (one year). */
  private advanceYear(lines: DayReport['lines']): void {
    const year = Math.floor((this.state.day - 1) / 12) + 1;
    const prevYear = Math.floor((this.state.day - 2) / 12) + 1;
    if (year > prevYear) {
      this.state.player.age += 1;
      lines.push({ text: `岁序更替，你今年 ${this.state.player.age} 岁。`, tone: 'neutral' });
    }
  }

  /** Choose one of the three daily candidates. Returns false if invalid. */
  chooseCandidate(id: string): boolean {
    if (!this.hasCandidates || !this.state.candidates.includes(id)) return false;
    const event = getEvent(id);
    if (!event) return false;
    const main = this.state.candidateMain;
    if (!this.state.freeMode && main && main !== id) this.deferMain(main);
    if (main === id) this.state.storyDeferred = this.state.storyDeferred.filter((x) => x !== id);
    this.state.pendingEvent = id;
    this.state.candidateResolved = true;
    this.state.candidates = [];
    this.state.candidateMain = null;
    this.save();
    return true;
  }

  /** Take none of the offers today. */
  skipCandidates(): void {
    if (!this.hasCandidates) return;
    if (!this.state.freeMode && this.state.candidateMain) this.deferMain(this.state.candidateMain);
    this.state.candidates = [];
    this.state.candidateMain = null;
    this.state.candidateResolved = true;
    this.log('你没有接今日的候选。山中安静了一日。', 'neutral');
    this.save();
  }

  private deferMain(id: string): void {
    if (!this.state.storyDeferred.includes(id)) this.state.storyDeferred.push(id);
  }

  onTrialWin(): string {
    if (this.state.ending) return '';
    this.state.trialWins += 1;
    this.state.resources.reputation = clamp(this.state.resources.reputation + 4, 0, 100);
    this.state.resources.stones += 20;
    let extra = '';
    if (this.state.trialWins === 3 && !this.state.player.artifacts.includes('trial_seal')) {
      this.state.player.artifacts.push('trial_seal');
      extra = ' · 得法宝「试剑金令」';
    }
    this.log(`试剑傀儡被击破。声望 +4，灵石 +20。${extra}`, 'good');
    this.save();
    return `试剑获胜 · 声望 +4 · 灵石 +20${extra}`;
  }

  reset(): void {
    this.state = createInitialState();
    this.isLoaded = false;
    this.playSeconds = 0;
    this.save();
  }

  /** Start a new chapter carrying the sect rank (merits) forward. */
  newGamePlus(): boolean {
    const carried = this.state.sectMerits;
    const nextCycle = (this.state.cycle ?? 0) + 1;
    this.state = createInitialState();
    this.state.sectMerits = carried;
    this.state.cycle = nextCycle;
    // Avoid re-triggering milestone events already crossed in a prior run.
    this.state.seenEvents = ERA_EVENTS.filter((e) => e.when(this.state)).map((e) => e.id);
    // Cycle-scaled starting gifts.
    const perk = cyclePerk(nextCycle);
    this.state.resources.stones += perk.stones;
    this.state.resources.insight += perk.insight;
    this.state.player.pills += perk.pills;
    this.state.player.daoHeart = clamp(this.state.player.daoHeart + perk.daoHeart, 0, 100);
    this.state.player.qiMax += perk.qiMax;
    for (const t of perk.techniques) {
      if (!this.state.player.techniques.includes(t)) this.state.player.techniques.push(t);
    }
    if (nextCycle >= 2 && !this.state.player.artifacts.includes('vein_locket')) {
      this.state.player.artifacts.push('vein_locket');
    }
    this.ensureObjective();
    const gifts: string[] = [];
    if (perk.stones) gifts.push(`灵石 +${perk.stones}`);
    if (perk.pills) gifts.push(`丹药 +${perk.pills}`);
    if (perk.techniques.length) gifts.push(`传授「${perk.techniques.join('、')}」`);
    if (perk.daoHeart) gifts.push(`道心 +${perk.daoHeart}`);
    if (nextCycle >= 2) gifts.push('得法宝「灵脉之钥」');
    const giftText = gifts.length ? ` 得${gifts.join('，')}。` : '。';
    this.state.log.unshift({
      day: 1,
      text: `第 ${nextCycle + 1} 周目：宗门功业 ${carried} 结转，宗阶「${sectRank(carried).name}」犹在。${giftText}`,
      tone: 'story',
    });
    this.isLoaded = false;
    this.playSeconds = 0;
    this.save();
    return true;
  }

  save(): void {
    this.saves.save('auto', this.state, this.playSeconds);
  }

  saveTo(slot: SlotId): SaveMeta {
    return this.saves.save(slot, this.state, this.playSeconds);
  }

  loadSlot(slot: SlotId): boolean {
    const meta = this.saves.load(slot);
    if (!meta) return false;
    this.state = meta.state;
    this.playSeconds = meta.playSeconds;
    this.isLoaded = true;
    this.save();
    return true;
  }

  loadLatest(): boolean {
    const latest = this.saves.latest();
    if (!latest) return false;
    this.state = latest.state;
    this.playSeconds = latest.playSeconds;
    this.isLoaded = true;
    this.save();
    return true;
  }

  latestMeta(): SaveMeta | null {
    return this.saves.latest();
  }

  listSaves(): Array<SaveMeta | null> {
    return this.saves.list();
  }

  deleteSlot(slot: SlotId): void {
    this.saves.delete(slot);
  }

  getSettings(): GameSettings {
    return this.saves.settings;
  }

  setSettings(patch: Partial<GameSettings>): void {
    this.saves.setSettings(patch);
  }

  exportSlot(slot: SlotId): string | null {
    return this.saves.exportSlot(slot);
  }

  importText(text: string): { ok: boolean; message: string } {
    return this.saves.importText(text);
  }

  private processBuildings(lines: DayReport['lines']): void {
    const r = this.state.resources;
    let herbs = 0;
    let insight = 0;
    let stones = 0;
    let morale = 0;
    let cultivation = 0;
    let reputation = 0;
    let builtLevels = 0;

    const active = this.activeDisciples;
    const postCount = new Map<BuildingId, number>();
    const specialistCount = new Map<BuildingId, number>();
    for (const d of active) {
      if (!d.post) continue;
      postCount.set(d.post, (postCount.get(d.post) ?? 0) + 1);
      if (isPostSpecialist(d.post, d.role)) {
        specialistCount.set(d.post, (specialistCount.get(d.post) ?? 0) + 1);
      }
    }

    for (const def of Object.values(BUILDING_BY_ID)) {
      const b = this.state.buildings[def.id];
      if (!b) continue;
      if (b.construction > 0) {
        b.construction -= 1;
        if (b.construction <= 0) {
          b.construction = 0;
          b.level = Math.min(def.maxLevel, b.level + 1);
          lines.push({ text: `${def.name}建成，升至 ${b.level} 级。`, tone: 'good' });
          this.log(`${def.name}建成，升至 ${b.level} 级。`, 'good');
        }
      }
      if (b.level <= 0 || b.construction > 0) continue;
      const level = b.level;
      const posted = postCount.get(def.id) ?? 0;
      const specialists = specialistCount.get(def.id) ?? 0;
      builtLevels += level;
      if (def.id === 'field') herbs += 2 * level + posted * level + specialists * level;
      if (def.id === 'library') insight += level + posted + specialists;
      if (def.id === 'store') stones += level + posted + specialists;
      if (def.id === 'kitchen' || def.id === 'dorm') morale += level + posted + specialists;
      if (def.id === 'array') cultivation += 2 * level + posted * 2 + specialists * 2;
      if (def.id === 'alchemy') insight += posted + specialists * 2;
      if (def.id === 'sword') reputation += posted + specialists * 2;
    }

    // Adjacency: buildings that support each other give a small flat bonus.
    const lv = (id: BuildingId): number => {
      const b = this.state.buildings[id];
      return b && b.construction <= 0 ? b.level : 0;
    };
    if (lv('field') > 0 && lv('alchemy') > 0) herbs += 1;
    if (lv('sword') > 0 && lv('array') > 0) cultivation += 1;
    if (lv('library') > 0 && lv('dorm') > 0) insight += 1;
    if (lv('kitchen') > 0 && lv('store') > 0) morale += 1;

    if (herbs) r.herbs += herbs;
    if (insight) r.insight += insight;
    if (stones) r.stones += stones;
    if (reputation) r.reputation = clamp(r.reputation + reputation, 0, 100);
    if (morale) r.morale = clamp(r.morale + morale, 0, 100);
    if (cultivation) {
      this.state.player.cultivation = Math.min(100, this.state.player.cultivation + cultivation);
      if (this.state.player.cultivation >= 100) {
        this.state.player.cultivation = 100;
        this.state.player.bottleneck = true;
      }
    }

    // Upkeep: one stone per two built levels, rounded up. Posts can pay for it.
    const upkeep = Math.ceil(builtLevels / 2);
    if (upkeep > 0) {
      if (r.stones >= upkeep) {
        r.stones -= upkeep;
        lines.push({ text: `建筑维护：灵石 -${upkeep}。`, tone: 'neutral' });
      } else {
        r.morale = clamp(r.morale - 2, 0, 100);
        r.stones = 0;
        lines.push({ text: `灵石不足，建筑失修，道心 -2。`, tone: 'bad' });
      }
    }

    const parts: string[] = [];
    if (herbs) parts.push(`药材 +${herbs}`);
    if (insight) parts.push(`心得 +${insight}`);
    if (stones) parts.push(`灵石 +${stones}`);
    if (reputation) parts.push(`声望 +${reputation}`);
    if (morale) parts.push(`道心 +${morale}`);
    if (cultivation) parts.push(`修为 +${cultivation}`);
    if (parts.length) {
      const text = `宗门建筑产出：${parts.join('，')}。`;
      lines.push({ text, tone: 'good' });
      this.log(text, 'good');
    }
  }

  /** Post a disciple to a built building. Returns a user-facing result. */
  assignPost(discipleId: string, id: BuildingId): { ok: boolean; message: string } {
    const d = this.state.disciples.find((x) => x.id === discipleId);
    if (!d || !d.active) return { ok: false, message: '这名弟子不在山门。' };
    const b = this.state.buildings[id];
    const def = BUILDING_BY_ID[id];
    if (!b || !def) return { ok: false, message: '没有这栋建筑。' };
    if (b.level <= 0 || b.construction > 0) return { ok: false, message: `${def.name}还不能驻派。` };
    if (d.post === id) {
      d.post = null;
      this.log(`${d.name}离开${def.name}。`, 'neutral');
      this.save();
      return { ok: true, message: `${d.name}已离开${def.name}。` };
    }
    const count = this.activeDisciples.filter((x) => x.post === id && x.id !== d.id).length;
    if (count >= b.level) return { ok: false, message: `${def.name}岗位已满（${b.level} 个）。` };
    d.post = id;
    this.log(`${d.name}开始驻派${def.name}。`, 'good');
    this.save();
    return { ok: true, message: `${d.name}已驻派${def.name}，产出提升。` };
  }

  private applyEffect(effect: Effect): void {
    const r = this.state.resources;
    if (effect.stones) r.stones = Math.max(0, r.stones + effect.stones);
    if (effect.herbs) r.herbs = Math.max(0, r.herbs + effect.herbs);
    if (effect.insight) r.insight = Math.max(0, r.insight + effect.insight);
    if (effect.reputation) r.reputation = clamp(r.reputation + effect.reputation, 0, 100);
    if (effect.morale) r.morale = clamp(r.morale + effect.morale, 0, 100);
    if (effect.daoHeart) this.state.player.daoHeart = clamp(this.state.player.daoHeart + effect.daoHeart, 0, 100);
    if (effect.karma) this.state.player.karma = clamp(this.state.player.karma + effect.karma, -100, 100);
    if (effect.merits) this.state.sectMerits = Math.max(0, this.state.sectMerits + effect.merits);
    if (effect.faith) this.state.sectFaith = Math.max(0, this.state.sectFaith + effect.faith);
    if (effect.playerInjury) this.state.player.injury = clamp(this.state.player.injury + effect.playerInjury, 0, 100);
    if (effect.artifact) {
      const a = this.state.player.artifacts;
      if (!a.includes(effect.artifact)) a.push(effect.artifact);
    }

    if (effect.bond) {
      const d = this.state.disciples.find((x) => x.id === effect.bond!.id);
      if (d) d.bond = clamp(d.bond + effect.bond.delta, 0, 100);
    }
    if (effect.mood) {
      const d = this.state.disciples.find((x) => x.id === effect.mood!.id);
      if (d) d.mood = clamp(d.mood + effect.mood.delta, 0, 100);
    }
    if (effect.injury) {
      const d = this.state.disciples.find((x) => x.id === effect.injury!.id);
      if (d) d.injury = clamp(d.injury + effect.injury.delta, 0, 100);
    }
    if (effect.cultivation) {
      const d = this.state.disciples.find((x) => x.id === effect.cultivation!.id);
      if (d) this.addCultivation(d, effect.cultivation.delta);
    }
    if (effect.flag) this.state.flags[effect.flag.key] = effect.flag.value;
    if (effect.leave) {
      const d = this.state.disciples.find((x) => x.id === effect.leave);
      if (d) d.active = false;
    }
    if (effect.recall) {
      const d = this.state.disciples.find((x) => x.id === effect.recall);
      if (d) {
        d.active = true;
        d.injury = clamp(d.injury - 40, 0, 100);
        d.strain = 0;
        this.state.departed = this.state.departed.filter((x) => x !== d.id);
      }
    }
    if (effect.log) this.log(effect.log, 'story');
  }

  private resolveTask(d: Game['state']['disciples'][number], lines: DayReport['lines']): void {
    const r = this.state.resources;
    const moodF = 0.55 + d.mood / 160;
    const injuryF = 1 - d.injury / 140;
    const s = d.stats;

    switch (d.assignment) {
      case 'cultivate': {
        let gain = (7 + s.insight * 0.5 + s.aptitude * 0.45) * moodF * injuryF;
        if (this.state.upgrades.spiritArray) gain *= 1.35;
        gain += this.faithBoonLevel('pool') * 0.5; // 洗剑池
        if (this.state.player.artifacts.includes('sanctum_seal')) gain += 0.5; // 圣地古印
        if (d.technique === 'sword') gain += 1.5; // 青云剑诀
        gain = Math.round(gain * 10) / 10;
        const before = d.realmIndex;
        this.addCultivation(d, gain);
        d.mood = clamp(d.mood - 1, 0, 100);
        if (d.realmIndex > before) {
          lines.push({ text: `${d.name}破境，入${realmName(d.realmIndex)}。`, tone: 'good' });
        } else {
          lines.push({ text: `${d.name}静坐一日，修为 +${gain}。`, tone: 'neutral' });
        }
        break;
      }
      case 'gather': {
        let gain = 5 + s.body * 0.3 + s.luck * 0.25;
        if (this.state.upgrades.herbGarden) gain += 2;
        if (d.technique === 'herb') gain += 2.5; // 采药百草术
        gain = Math.round(gain * moodF * injuryF);
        r.herbs += gain;
        lines.push({ text: `${d.name}背回一筐药材，药材 +${gain}。`, tone: 'good' });

        const injuryChance = Math.max(0.02, 0.08 - s.body * 0.005);
        if (Math.random() < injuryChance) {
          d.injury = clamp(d.injury + 14, 0, 100);
          lines.push({ text: `${d.name}在崖边滑了一跤，受伤 +14。`, tone: 'bad' });
        }
        if (Math.random() < 0.1 + s.luck * 0.015) {
          r.herbs += 10;
          r.insight += 1;
          lines.push({ text: `${d.name}发现一株百年灵草，药材 +10，心得 +1。`, tone: 'good' });
        }
        d.mood = clamp(d.mood - 0, 0, 100);
        break;
      }
      case 'patrol': {
        let rep = 2 + s.body * 0.12;
        if (this.state.upgrades.gateWard) rep += 2;
        if (d.technique === 'ward') rep += 1.5; // 巡山诀
        rep = Math.round(rep);
        r.reputation = clamp(r.reputation + rep, 0, 100);
        lines.push({ text: `${d.name}巡山一日，声望 +${rep}。`, tone: 'good' });

        const injuryChance = Math.max(0.01, 0.11 - s.body * 0.008 - (this.state.upgrades.gateWard ? 0.03 : 0));
        if (Math.random() < injuryChance) {
          d.injury = clamp(d.injury + 18, 0, 100);
          lines.push({ text: `${d.name}在山道遇袭，受伤 +18。`, tone: 'bad' });
        }
        d.mood = clamp(d.mood - 2, 0, 100);
        break;
      }
      case 'study': {
        let gain = 1 + s.insight * 0.14;
        if (this.state.upgrades.library) gain += 2;
        if (d.technique === 'dao') gain += 0.8; // 悟道心经
        gain = Math.round(gain * 10) / 10;
        r.insight += gain;
        lines.push({ text: `${d.name}在藏经阁抄书，心得 +${gain}。`, tone: 'neutral' });
        d.mood = clamp(d.mood + 2, 0, 100);
        if (Math.random() < 0.08 + s.insight * 0.01) {
          r.insight += 2;
          lines.push({ text: `${d.name}忽有顿悟，心得 +2。`, tone: 'good' });
        }
        break;
      }
      case 'rest': {
        let heal = 18 + s.heart * 1.2;
        if (this.state.upgrades.herbGarden) heal *= 1.5;
        const before = d.injury;
        d.injury = clamp(d.injury - heal, 0, 100);
        d.mood = clamp(d.mood + 8, 0, 100);
        const healed = Math.round(before - d.injury);
        lines.push({
          text: healed > 0 ? `${d.name}休养一日，伤势 -${healed}，道心 +8。` : `${d.name}静养一日，道心 +8。`,
          tone: 'neutral',
        });
        break;
      }
    }

    if (d.mood < 25) {
      d.bond = clamp(d.bond - 2, 0, 100);
    }
    if (d.injury > 80) {
      d.mood = clamp(d.mood - 4, 0, 100);
    }
  }

  private addCultivation(d: Game['state']['disciples'][number], amount: number): void {
    d.cultivation += amount;
    while (d.cultivation >= 100 && d.realmIndex < 8) {
      d.cultivation -= 100;
      d.realmIndex += 1;
      d.stats.aptitude = clamp(d.stats.aptitude + 1, 1, 10);
      d.mood = clamp(d.mood + 12, 0, 100);
    }
    if (d.realmIndex >= 8) d.cultivation = Math.min(d.cultivation, 99);
  }

  private driftRelationships(): void {
    const active = this.activeDisciples;
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const a = active[i];
        const b = active[j];
        if (a.assignment === b.assignment) {
          const delta = a.assignment === 'rest' || a.assignment === 'study' ? 1.2 : 0.5;
          a.relationships[b.id] = clamp((a.relationships[b.id] ?? 0) + delta, -100, 100);
          b.relationships[a.id] = clamp((b.relationships[a.id] ?? 0) + delta, -100, 100);
        }
        if (
          (a.id === 'gu' && b.id === 'shen') ||
          (a.id === 'shen' && b.id === 'gu')
        ) {
          if (a.assignment === 'cultivate' && b.assignment === 'cultivate') {
            a.relationships[b.id] = clamp((a.relationships[b.id] ?? 0) - 1.5, -100, 100);
            b.relationships[a.id] = clamp((b.relationships[a.id] ?? 0) - 1.5, -100, 100);
          }
        }
      }
    }
  }

  enterFreeMode(): boolean {
    if (!this.state.ending) return false;
    this.state.freeMode = true;
    this.state.ending = null;
    this.state.pendingEvent = null;
    this.state.day = Math.max(13, this.state.day);
    this.state.actionPoints = this.maxActionPoints;
    this.state.log.unshift({
      day: this.state.day,
      text: '你留在山门。十二日的大比成了旧事，青云宗的日子还长。',
      tone: 'story',
    });
    this.save();
    return true;
  }

  private buildCandidates(): void {
    const ids: string[] = [];
    let main: string | null = null;

    if (this.state.freeMode) {
      const demon = nextDemonEvent(this.state);
      if (demon) main = demon.id;
      else {
        const arc = this.pickArcEvent();
        if (arc) main = arc.id;
        else if (allArcsDone(this.state) && !this.state.flags.arcFinale) main = 'free_finale';
      }
    } else {
      const story = this.pickEvent();
      if (story) main = story.id;
    }
    if (main) ids.push(main);

    const cap = 3 + this.perk.extraCandidates;
    let seed = this.state.candidateSeed >>> 0;
    const rand = (): number => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const offCooldown = (e: StoryEvent): boolean => {
      if (!e.cooldown) return true;
      const last = this.state.eventSeenDay[e.id];
      return last === undefined || this.state.day - last >= e.cooldown;
    };

    const pool: StoryEvent[] = [];
    // Ambient events are always available as fillers; in the chapter they are
    // the "other things happening at the gate" beside the mainline.
    for (const e of FREE_EVENTS) {
      if (e.when(this.state) && offCooldown(e)) pool.push(e);
    }
    for (const e of ALL_EVENTS) {
      // Forced day-end events and character-arc scenes are never filler cards;
      // the next arc is already the main card when one is available.
      if (e.id === 'tournament' || e.id === 'free_finale' || e.id.includes('_arc_')) continue;
      if (e.when(this.state) && offCooldown(e) && !pool.some((p) => p.id === e.id)) pool.push(e);
    }

    // Milestone era events and recall subplots take a guaranteed card as
    // soon as they unlock (a departed disciple should offer a way back).
    for (const e of ERA_EVENTS) {
      if (ids.length >= cap) break;
      if (e.when(this.state) && !this.state.seenEvents.includes(e.id) && !ids.includes(e.id)) {
        ids.push(e.id);
      }
    }
    for (const e of RECALL_EVENTS) {
      if (ids.length >= cap) break;
      if (e.when(this.state) && !this.state.seenEvents.includes(e.id) && !ids.includes(e.id)) {
        ids.push(e.id);
      }
    }

    const unseen = pool.filter((e) => !ids.includes(e.id) && !this.state.seenEvents.includes(e.id));
    const fallback = pool.filter((e) => !ids.includes(e.id));
    const fill = (unseen.length ? unseen : fallback).slice();
    for (let i = fill.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [fill[i], fill[j]] = [fill[j], fill[i]];
    }
    this.state.candidateSeed = seed;
    for (const e of fill) {
      if (ids.length >= cap) break;
      if (!ids.includes(e.id)) ids.push(e.id);
    }

    this.state.candidates = ids;
    this.state.candidateMain = main;
  }

  private pickArcEvent(): StoryEvent | null {
    return nextArcEvent(this.state);
  }


  arcStatus(): { done: number; total: number; summary: string[] } {
    const p = arcProgress(this.state);
    return { ...p, summary: arcSummary(this.state) };
  }

  private pickEvent(): StoryEvent | null {
    for (const id of this.state.storyDeferred) {
      const deferred = ALL_EVENTS.find((e) => e.id === id);
      if (deferred) return deferred;
    }
    const eligible = ALL_EVENTS.filter(
      (e) => !this.state.seenEvents.includes(e.id) && e.when(this.state),
    );
    if (eligible.length === 0) return null;
    eligible.sort((a, b) => b.priority - a.priority);
    return eligible[0];
  }

  /** Base accomplishment score, shared by the tournament and lifespan endings. */
  private computeScore(): number {
    const active = this.activeDisciples;
    const avgRealm = avg(active.map((d) => d.realmIndex)) / 8;
    const avgCult = avg(active.map((d) => d.cultivation)) / 100;
    const avgBond = avg(active.map((d) => d.bond)) / 100;
    const rep = clamp(this.state.resources.reputation, 0, 60) / 60;

    let score = avgRealm * 34 + avgCult * 16 + rep * 20 + avgBond * 18;
    score += Math.min(9, this.state.trialWins * 3);
    // Sect-management layer: merits carry real weight, and each rank crossed
    // adds a visible bonus so objectives/perks matter for the chapter result.
    score += Math.min(18, Math.round(this.state.sectMerits * 0.18));
    score += sectRank(this.state.sectMerits).index * 3;
    const departed = this.state.disciples.filter((d) => !d.active).length;
    score -= departed * 4;

    if (this.state.flags.vein === 'sealed') score += 2;
    if (this.state.flags.baiTrust === true) score += 2;
    if (this.state.flags.luReveal === true) score += 3;
    if (this.state.flags.suFree === true) score += 2;
    if (this.state.flags.xuanTruth === true) score += 2;
    if (this.state.flags.demonWarn === true) score += 2;
    return score;
  }

  private resolveEnding(choice: string): Ending {
    let score = this.computeScore();

    if (choice === 'fight') score += this.state.trialWins > 0 ? 4 : 0;
    if (choice === 'gu') {
      const gu = this.state.disciples.find((d) => d.id === 'gu');
      score += gu && gu.active && gu.bond >= 55 ? 5 : -5;
    }
    if (choice === 'yield') score = Math.min(score, 52);

    score = Math.round(clamp(score, 0, 100));

    let rank: Ending['rank'];
    if (choice === 'yield') rank = 'hold';
    else if (score >= 76) rank = 'champion';
    else if (score >= 62) rank = 'top3';
    else if (score >= 45) rank = 'hold';
    else rank = 'lost';

    const titles: Record<'champion' | 'top3' | 'hold' | 'lost', [string, string]> = {
      champion: ['三 宗 魁 首', '青云宗的旗子，第一次插在云台最高处。'],
      top3: ['名 列 三 甲', '青云宗站住了。虽然只是第三面旗，但山门保住了。'],
      hold: ['山 门 犹 在', '你们没有赢，但也没有散。山门还在，人还在。'],
      lost: ['山 门 易 主', '旗子被摘下来的时候，阿七追着旗杆跑了很久。'],
    };

    const [title, subtitle] = titles[rank];
    const epilogues = this.buildEpilogues(rank);
    const text =
      rank === 'champion'
        ? '云台之上，三宗掌门起身。你回头，七个人站在风里，衣袍猎猎。青云宗没有回到从前，但它有了以后。'
        : rank === 'top3'
          ? '三宗大比落幕，青云宗列第三。山门保住了，灵矿分到一小块。顾长风在庆功宴上喝醉了，沈青梧没来。'
          : rank === 'hold'
            ? '青云宗弃了名次，换来山门不被收回。弟子们没有说什么，第二天照常扫阶、采药、练剑。'
            : '三宗收走了山门。你带着剩下的人下山，回头看见玄真站在门口，没有跟上来。';

    return { rank, title, subtitle, text, epilogues, score };
  }

  /** Natural end when the player's age reaches their lifespan. */
  private resolveLifespanEnding(): Ending {
    const s = this.state;
    const score = Math.round(clamp(this.computeScore(), 0, 100));
    const epilogues = this.buildEpilogues(score >= 60 ? 'top3' : 'hold');
    return {
      rank: 'lifespan',
      title: '寿 元 已 尽',
      subtitle: `第 ${Math.floor((s.day - 1) / 12) + 1} 年 · 寿 ${s.player.age} 岁`,
      text:
        score >= 60
          ? '你在山门后的老松下坐化。弟子们替你守了七日夜，后来每逢节气，都会在松下放一盏灯。宗门还在，剑还悬着。'
          : '你走得很安静。山门渐渐空了，只有阿七还讲得清你年轻时的那些事。',
      epilogues,
      score,
    };
  }

  private buildEpilogues(rank: Ending['rank']): string[] {
    const lines: string[] = [];
    const d = (id: string) => this.state.disciples.find((x) => x.id === id);
    const gu = d('gu');
    const shen = d('shen');
    const su = d('su');
    const lu = d('lu');
    const bai = d('bai');
    const qi = d('qi');
    const xuan = d('xuan');

    if (gu && !gu.active) lines.push('顾长风：离开了青云宗，据说去了北境战场。');
    else if (this.state.flags.guLead) lines.push('顾长风：接掌青云宗，把山门改成了兵营。他做得比你狠，也比你稳。');
    else if ((gu?.bond ?? 0) >= 60) lines.push('顾长风：留在山门，成了你最锋利的那把剑。');
    else lines.push('顾长风：在大比后独自下山，留下一句“我还会回来”。');

    if (shen && !shen.active) lines.push('沈青梧：不知所踪，剑冢里多了一座衣冠冢。');
    else if ((shen?.bond ?? 0) >= 65) lines.push('沈青梧：留在剑冢，替你守着青云宗最早的剑。');
    else lines.push('沈青梧：带着断剑去了魔道旧地，没人拦她。');

    if (su && !su.active) lines.push('苏晚照：下山自立门户，她药堂里的炉火再没凉过。');
    else if (this.state.flags.suMarried) lines.push('苏晚照：嫁入赵氏，用一座灵矿换青云宗三年喘息。');
    else if (this.state.flags.suFree || this.state.flags.suStay) lines.push('苏晚照：退了婚，把“青云”二字挂在了自己的药堂上。');
    else lines.push('苏晚照：留在山门，把药庐的炉火看得比命还重。');

    if (lu && !lu.active) lines.push('陆小满：被送往天剑宗，据说成了那一年最亮的新星。');
    else if (this.state.flags.luReveal) lines.push('陆小满：正式拜入真传，天灵根再也藏不住了。');
    else lines.push('陆小满：还是那个在崖边采药的小满，只是再也没人让她去挑水。');

    if (bai && !bai.active) lines.push('白芷：远走避祸，药箱里留了一瓶治你旧伤的药。');
    else if (this.state.flags.baiTrust || this.state.flags.baiStay) lines.push('白芷：守着药庐，月圆之夜不再锁门。');
    else lines.push('白芷：留在山门，但药庐的门总是关着。');

    if (qi && !qi.active) lines.push('阿七：去了大宗门，偶尔托人捎回半本剑谱。');
    else if (qi) lines.push('阿七：还是记名弟子，负责给新弟子讲“当年我们七个人”的故事。');
    if (xuan && !xuan.active) lines.push('玄真：下山养老去了，山门的钟再没人敲得那样沉稳。');
    else if (xuan) {
      lines.push(
        this.state.flags.xuanTruth
          ? '玄真：把旧信交给了你，从此每天在藏经阁坐到天黑。'
          : '玄真：守着藏经阁，再没提过那封信。',
      );
    }

    if (Number(this.state.flags.demonChain ?? 0) >= 4) {
      lines.push(
        this.state.flags.demonWon
          ? '魔道：被击退之后，再没有踏进过青云宗的山门。'
          : '魔道：退去了，但山门外的夜里，偶尔还能看见半枚烧焦的药人牌。',
      );
    }

    if (rank === 'lost') lines.push('你：在山下租了一间小屋，开始写《青云宗志》。');
    else lines.push('你：在宗门志上写下这一年的最后一笔，然后合上卷。');

    return lines;
  }

  private log(text: string, tone: 'good' | 'bad' | 'neutral' | 'story'): void {
    this.state.log.unshift({ day: this.state.day, text, tone });
    if (this.state.log.length > 40) this.state.log.length = 40;
  }
}
