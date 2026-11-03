import type { RegionId } from './scenes';
import { initialBuildings, type BuildingId, type BuildingState } from './buildings';
import { ARC_EVENTS } from './arcs';
import { DEMON_EVENTS } from './demon';

export type Task = 'cultivate' | 'gather' | 'patrol' | 'study' | 'rest';

export type StatKey = 'aptitude' | 'insight' | 'body' | 'heart' | 'luck';

export const PLAYER_REALMS = [
  '炼气一层',
  '炼气二层',
  '炼气三层',
  '炼气四层',
  '炼气五层',
  '炼气六层',
  '炼气七层',
  '炼气八层',
  '炼气九层',
  '筑基初期',
  '金丹初期',
];

export function playerRealmName(index: number): string {
  return PLAYER_REALMS[Math.max(0, Math.min(PLAYER_REALMS.length - 1, index))];
}

export interface PlayerCultivation {
  realmIndex: number;
  cultivation: number;
  root: string;
  qiMax: number;
  pills: number;
  techniques: string[];
  age: number;
  lifespan: number;
  daoHeart: number;
  karma: number;
  bottleneck: boolean;
  injury: number;
  /** Acquired artifacts (法宝); passive, stacking. */
  artifacts: string[];
}

export interface Disciple {
  id: string;
  name: string;
  title: string;
  role: string;
  root: string;
  realmIndex: number;
  cultivation: number;
  stats: Record<StatKey, number>;
  traits: string[];
  bond: number;
  mood: number;
  injury: number;
  /** Consecutive days unhappy / overworked; too high and the disciple may leave. */
  strain?: number;
  assignment: Task;
  /** A building this disciple is posted to, independent of their daily task. */
  post: BuildingId | null;
  /** Taught technique (功法); boosts a matching daily task. */
  technique: string | null;
  active: boolean;
  secret: string;
  story: number;
  epithet: string;
  relationships: Record<string, number>;
  palette: { robe: string; hair: string; accent: string };
}

export interface Resources {
  stones: number;
  herbs: number;
  insight: number;
  reputation: number;
  morale: number;
}

export interface LogEntry {
  day: number;
  text: string;
  tone: 'good' | 'bad' | 'neutral' | 'story';
}

export type ObjectiveMetric = 'stones' | 'herbs' | 'insight' | 'reputation' | 'morale';

export interface DailyObjective {
  id: string;
  metric: ObjectiveMetric;
  target: number;
  done: boolean;
}

export interface Opening {
  name: string;
  text: string;
}

export interface GameState {
  version: number;
  day: number;
  maxDay: number;
  resources: Resources;
  disciples: Disciple[];
  flags: Record<string, boolean | number | string>;
  upgrades: Record<string, boolean>;
  gifts: string[];
  pills: string[];
  talked: string[];
  log: LogEntry[];
  seenEvents: string[];
  /** Last day each event was resolved, used for repeat cooldowns. */
  eventSeenDay: Record<string, number>;
  candidateSeed: number;
  checkSeed: number;
  pendingEvent: string | null;
  /** Three event ids offered for the current day. */
  candidates: string[];
  /** Story event that should be carried to the next day if not picked. */
  candidateMain: string | null;
  candidateResolved: boolean;
  /** Mainline events the player postponed. */
  storyDeferred: string[];
  ending: Ending | null;
  freeMode: boolean;
  actionPoints: number;
  trialWins: number;
  assignmentsLocked: boolean;
  /** Disciples who left the sect (lost to neglect). */
  departed: string[];
  region: RegionId;
  regionActions: string[];
  playerActions: string[];
  player: PlayerCultivation;
  buildings: Record<BuildingId, BuildingState>;
  /** Today's optional goal; rolled fresh each day. */
  dailyObjective: DailyObjective | null;
  /** Cumulative merit points earned from completed objectives. */
  sectMerits: number;
  /** Spendable incense earned alongside merits; spent on the faith ladder (香火天梯). */
  sectFaith: number;
  /** Faith-ladder boon levels purchased, keyed by boon id. */
  faithBought: Record<string, number>;
  /** Highest sect-rank index that has granted its faith bonus. */
  faithRankIndex: number;
  /** New Game+ cycle; 0 is the first chapter. */
  cycle: number;
  /** Set while a tribulation boss fight is underway; cleared on resolution. */
  pendingTribulation: 'steady' | 'sword' | 'pill' | null;
  /** Current season index (0-3); updated in endDay. */
  season: number;
  lastObjectiveId: string;
  /** Random starting modifier rolled at new game, kept in the save. */
  opening: Opening;
}

export interface DayReport {
  day: number;
  lines: Array<{ text: string; tone: 'good' | 'bad' | 'neutral' | 'story' }>;
  resources: Resources;
}

export interface Ending {
  rank: 'champion' | 'top3' | 'hold' | 'lost' | 'lifespan';
  title: string;
  subtitle: string;
  text: string;
  epilogues: string[];
  score: number;
}

export interface Effect {
  stones?: number;
  herbs?: number;
  insight?: number;
  reputation?: number;
  morale?: number;
  daoHeart?: number;
  karma?: number;
  /** Grant sect merit points (sect rank progress). */
  merits?: number;
  /** Grant spendable incense (香火). */
  faith?: number;
  /** Inflict/relieve wounds on the player. */
  playerInjury?: number;
  /** Grant a master artifact (法宝) if not already owned. */
  artifact?: string;
  bond?: { id: string; delta: number };
  mood?: { id: string; delta: number };
  injury?: { id: string; delta: number };
  cultivation?: { id: string; delta: number };
  flag?: { key: string; value: boolean | number | string };
  leave?: string;
  /** Re-activate a departed disciple (recall subplot). */
  recall?: string;
  log?: string;
}

export interface EventCheck {
  chance: number | ((state: GameState) => number);
  failText: string;
  failEffects: Effect[];
}

export interface EventOption {
  id: string;
  label: string;
  hint: string;
  result: string;
  effects: Effect[];
  /** Optional risky action: roll a check, use failEffects on failure. */
  check?: EventCheck;
  requires?: (state: GameState) => boolean;
  requireText?: string;
}

export type EventRisk = 'low' | 'middle' | 'high';

export interface StoryEvent {
  id: string;
  title: string;
  kicker: string;
  text: string;
  priority: number;
  /** Optional danger/tier metadata shown on candidate cards. */
  tier?: 1 | 2 | 3;
  risk?: EventRisk;
  cooldown?: number;
  options: EventOption[];
  when: (state: GameState) => boolean;
}

export interface UpgradeDef {
  id: string;
  name: string;
  cost: Partial<Resources>;
  description: string;
  effect: string;
}

export interface TaskDef {
  id: Task;
  label: string;
  icon: string;
  description: string;
}

export const MAX_DAY = 12;
export const MAX_ACTION_POINTS = 3;

export const REALMS = [
  '炼气一层',
  '炼气三层',
  '炼气五层',
  '炼气七层',
  '炼气九层',
  '筑基初期',
  '筑基中期',
  '筑基后期',
  '金丹初期',
];

export function realmName(index: number): string {
  return REALMS[Math.max(0, Math.min(REALMS.length - 1, index))];
}

export const TASKS: TaskDef[] = [
  { id: 'cultivate', label: '修炼', icon: '息', description: '积累修为，冲击瓶颈。' },
  { id: 'gather', label: '采药', icon: '药', description: '入山采药，可能受伤，也可能得奇珍。' },
  { id: 'patrol', label: '巡山', icon: '巡', description: '巡视山门，积攒声望，遭遇不速之客。' },
  { id: 'study', label: '研习', icon: '经', description: '参读藏经，积攒悟道与心得。' },
  { id: 'rest', label: '休养', icon: '养', description: '疗伤、散心，恢复道心。' },
];

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'spiritArray',
    name: '聚灵阵',
    cost: { stones: 100, herbs: 10 },
    description: '在后山灵脉上刻阵，引气入殿。',
    effect: '修炼收益 +35%',
  },
  {
    id: 'herbGarden',
    name: '药庐',
    cost: { stones: 60, herbs: 20 },
    description: '修一间药庐，晒药、煎药、疗伤。',
    effect: '采药 +2 · 休养疗伤 +50%',
  },
  {
    id: 'library',
    name: '藏经阁',
    cost: { stones: 80, insight: 6 },
    description: '把残卷收进阁中，供弟子抄录。',
    effect: '研习 +2 心得',
  },
  {
    id: 'gateWard',
    name: '山门阵',
    cost: { stones: 90, reputation: 5 },
    description: '在山门埋下三十六枚阵旗。',
    effect: '巡山 +2 声望 · 受伤概率降低',
  },
];

const baseDisciples: Array<Omit<Disciple, 'relationships' | 'post' | 'technique'>> = [
  {
    id: 'gu',
    name: '顾长风',
    title: '大师兄',
    role: '剑修',
    root: '金灵根 · 双灵根',
    realmIndex: 4,
    cultivation: 42,
    stats: { aptitude: 8, insight: 7, body: 7, heart: 6, luck: 5 },
    traits: ['野心', '好胜', '护短'],
    bond: 58,
    mood: 70,
    injury: 0,
    assignment: 'cultivate',
    active: true,
    secret: '他认为掌门太软，青云宗需要一位更硬的宗主。',
    story: 0,
    epithet: '一剑当先',
    palette: { robe: '#3c3a36', hair: '#151311', accent: '#c8a15a' },
  },
  {
    id: 'shen',
    name: '沈青梧',
    title: '二师姐',
    role: '剑修',
    root: '冰灵根 · 变异',
    realmIndex: 3,
    cultivation: 60,
    stats: { aptitude: 7, insight: 8, body: 6, heart: 8, luck: 4 },
    traits: ['孤僻', '痴剑', '复仇'],
    bond: 52,
    mood: 55,
    injury: 0,
    assignment: 'cultivate',
    active: true,
    secret: '她是被魔道灭门的沈氏遗孤，剑匣里藏着一枚血色令牌。',
    story: 0,
    epithet: '霜刃未试',
    palette: { robe: '#31424e', hair: '#111318', accent: '#9fc7d8' },
  },
  {
    id: 'su',
    name: '苏晚照',
    title: '三师姐',
    role: '丹修',
    root: '木灵根 · 双灵根',
    realmIndex: 2,
    cultivation: 30,
    stats: { aptitude: 6, insight: 7, body: 5, heart: 9, luck: 6 },
    traits: ['仁善', '多疑', '持家'],
    bond: 66,
    mood: 62,
    injury: 0,
    assignment: 'gather',
    active: true,
    secret: '苏家想用她的婚事换一座灵矿，她一直没敢说。',
    story: 0,
    epithet: '药香满袖',
    palette: { robe: '#4a6b58', hair: '#1a1512', accent: '#d8c7a1' },
  },
  {
    id: 'lu',
    name: '陆小满',
    title: '外门弟子',
    role: '杂役',
    root: '五灵根（伪）',
    realmIndex: 0,
    cultivation: 18,
    stats: { aptitude: 9, insight: 9, body: 5, heart: 7, luck: 8 },
    traits: ['勤奋', '痴情', '自卑'],
    bond: 82,
    mood: 60,
    injury: 0,
    assignment: 'gather',
    active: true,
    secret: '她的灵根被人以禁术封住；封印之下，是一品天灵根。',
    story: 0,
    epithet: '山门里的小满',
    palette: { robe: '#6d8b7c', hair: '#1b1412', accent: '#e7d6b8' },
  },
  {
    id: 'bai',
    name: '白芷',
    title: '医修',
    role: '医修',
    root: '水灵根 · 单灵根',
    realmIndex: 2,
    cultivation: 36,
    stats: { aptitude: 5, insight: 8, body: 4, heart: 9, luck: 5 },
    traits: ['仁善', '寡言', '秘密'],
    bond: 48,
    mood: 58,
    injury: 0,
    assignment: 'rest',
    active: true,
    secret: '她曾是魔道药人，身上的旧疤会在月圆之夜发烫。',
    story: 0,
    epithet: '一炉春雪',
    palette: { robe: '#9aa9a4', hair: '#1a1b1d', accent: '#8fd0c4' },
  },
  {
    id: 'qi',
    name: '阿七',
    title: '记名弟子',
    role: '无灵根',
    root: '无灵根（自称）',
    realmIndex: 0,
    cultivation: 8,
    stats: { aptitude: 4, insight: 5, body: 6, heart: 8, luck: 10 },
    traits: ['乐观', '贪吃', '气运'],
    bond: 90,
    mood: 85,
    injury: 0,
    assignment: 'patrol',
    active: true,
    secret: '他能看见别人看不见的灵气流向，可能是天生道体。',
    story: 0,
    epithet: '总能捡到东西',
    palette: { robe: '#8a6a45', hair: '#211610', accent: '#e0b45e' },
  },
  {
    id: 'xuan',
    name: '玄真',
    title: '执事长老',
    role: '体修',
    root: '土灵根 · 单灵根',
    realmIndex: 4,
    cultivation: 70,
    stats: { aptitude: 5, insight: 6, body: 8, heart: 7, luck: 4 },
    traits: ['保守', '忠义', '固执'],
    bond: 44,
    mood: 50,
    injury: 0,
    assignment: 'patrol',
    active: true,
    secret: '当年青云宗灭门那一夜，他看见了不该看见的东西。',
    story: 0,
    epithet: '旧山门的守夜人',
    palette: { robe: '#4b4a45', hair: '#22201c', accent: '#a8a29a' },
  },
];

const initialRelations: Record<string, Record<string, number>> = {
  gu: { shen: -20, su: 10, lu: 5, bai: -5, qi: 15, xuan: -10 },
  shen: { gu: -20, su: 15, lu: 20, bai: 30, qi: 10, xuan: 5 },
  su: { gu: 10, shen: 15, lu: 25, bai: 20, qi: 15, xuan: 8 },
  lu: { gu: 5, shen: 20, su: 25, bai: 18, qi: 40, xuan: 12 },
  bai: { gu: -5, shen: 30, su: 20, lu: 18, qi: 22, xuan: 10 },
  qi: { gu: 15, shen: 10, su: 15, lu: 40, bai: 22, xuan: 5 },
  xuan: { gu: -10, shen: 5, su: 8, lu: 12, bai: 10, qi: 5 },
};

export const OPENINGS: Array<Opening & { apply: Partial<Resources> & { daoHeart?: number } }> = [
  { name: '名门之后', text: '祖上曾是外门执事，留下一笔声望与一桩旧债。', apply: { stones: -20, reputation: 10 } },
  { name: '药圃旧契', text: '山后药圃的地契还锁在你案头。', apply: { herbs: 25 } },
  { name: '横财入库', text: '山门地窖里翻出一袋多年无人认领的灵石。', apply: { stones: 30 } },
  { name: '散修故交', text: '山下散修念着旧情，托人捎来几卷心得。', apply: { insight: 5 } },
  { name: '债台高筑', text: '催债信不止一封，但你也因此看淡了身外之物。', apply: { stones: -20, daoHeart: 8 } },
];

function rollOpening(): Opening {
  const o = OPENINGS[Math.floor(Math.random() * OPENINGS.length)];
  return { name: o.name, text: o.text };
}

export function createInitialState(): GameState {
  const opening = rollOpening();
  const resources: Resources = { stones: 120, herbs: 40, insight: 8, reputation: 12, morale: 60 };
  for (const o of OPENINGS) {
    if (o.name !== opening.name) continue;
    if (o.apply.stones) resources.stones += o.apply.stones;
    if (o.apply.herbs) resources.herbs += o.apply.herbs;
    if (o.apply.insight) resources.insight += o.apply.insight;
    if (o.apply.reputation) resources.reputation += o.apply.reputation;
  }
  const openingDaoHeart = OPENINGS.find((o) => o.name === opening.name)?.apply.daoHeart ?? 0;
  return {
    version: 1,
    day: 1,
    maxDay: MAX_DAY,
    resources,
    disciples: baseDisciples.map((d) => ({
      ...d,
      post: null,
      strain: 0,
      technique: null,
      stats: { ...d.stats },
      traits: [...d.traits],
      palette: { ...d.palette },
      relationships: { ...initialRelations[d.id] },
    })),
    flags: {},
    upgrades: {},
    gifts: [],
    pills: [],
    talked: [],
    log: [
      {
        day: 1,
        text: '青云宗只剩七名弟子。十二日后是三宗大比，输的人交出山门。',
        tone: 'story',
      },
      {
        day: 1,
        text: `开局「${opening.name}」：${opening.text}`,
        tone: 'story',
      },
    ],
    seenEvents: [],
    eventSeenDay: {},
    candidateSeed: 20261102,
    checkSeed: 778899,
    pendingEvent: null,
    candidates: [],
    candidateMain: null,
    candidateResolved: true,
    storyDeferred: [],
    ending: null,
    freeMode: false,
    actionPoints: MAX_ACTION_POINTS,
    trialWins: 0,
    assignmentsLocked: false,
    departed: [],
    region: 'sect',
    regionActions: [],
    playerActions: [],
    buildings: initialBuildings(),
    player: {
      realmIndex: 2,
      cultivation: 20,
      root: '水木双灵根',
      qiMax: 120,
      pills: 1,
      techniques: ['青云剑诀'],
      age: 19,
      lifespan: 120,
      daoHeart: 60 + openingDaoHeart,
      karma: 0,
      bottleneck: false,
      injury: 0,
      artifacts: [],
    },
    dailyObjective: null,
    sectMerits: 0,
    sectFaith: 0,
    faithBought: {},
    faithRankIndex: 0,
    cycle: 0,
    pendingTribulation: null,
    season: 0,
    lastObjectiveId: '',
    opening,
  };
}

// ————————————————— 事件 —————————————————

const find = (s: GameState, id: string): Disciple | undefined => s.disciples.find((d) => d.id === id);

export const PROLOGUE: StoryEvent = {
  id: 'prologue',
  title: '残山剩水',
  kicker: '天元三百一十二年 · 秋 · 第一日',
  text:
    '青云宗只剩七名弟子。山门漏雨，丹房断火，藏经阁里最值钱的东西是一封催债的信。\n\n' +
    '十二日后，三宗大比。输的人交出山门。\n\n' +
    '案上摆着最后一百二十枚灵石、半卷《青云剑典》，还有一封没有署名的旧信。你先做哪一件事？',
  priority: 100,
  when: () => false,
  options: [
    {
      id: 'open',
      label: '重开山门',
      hint: '声望 +8 · 灵石 -20 · 道心 +5',
      result: '你把山门重新推开，扫净石阶。山下的人看见青云宗的旗子又升起来了。',
      effects: [
        { reputation: 8, stones: -20, morale: 5, daoHeart: 3, flag: { key: 'path', value: 'open' }, log: '重开山门，声望 +8。' },
      ],
    },
    {
      id: 'seclude',
      label: '闭门苦修',
      hint: '心得 +6 · 声望 -2',
      result: '你关上山门，把最后一点灵气留给弟子。外面的人很快会忘记青云宗——但你们需要时间。',
      effects: [
        { insight: 6, reputation: -2, daoHeart: 2, flag: { key: 'path', value: 'seclude' }, log: '闭门苦修，心得 +6。' },
      ],
    },
    {
      id: 'sell',
      label: '变卖旧物',
      hint: '灵石 +80 · 声望 -8 · 道心 -5',
      result: '你卖掉了祖师留下的铜炉和两亩灵田。灵石到手，山门却更空了。',
      effects: [
        { stones: 80, reputation: -8, morale: -5, daoHeart: -5, flag: { key: 'path', value: 'sell' }, log: '变卖旧物，灵石 +80。' },
      ],
    },
  ],
};

export const STORY_EVENTS: StoryEvent[] = [
  {
    id: 'vein',
    title: '灵脉异动',
    kicker: '第三日 · 后山',
    text:
      '后山灵脉裂开一道口子，灵气像白雾一样往外涌。\n\n' +
      '顾长风说：“让我去。灵脉认强者，吞下去，大比就有把握。”\n' +
      '沈青梧按住剑：“裂口下面有东西。你吞得下，山门吞不下。”\n\n' +
      '两个人都在等你开口。',
    priority: 100,
    when: (s) => s.day === 3,
    options: [
      {
        id: 'gu',
        label: '让顾长风去',
        hint: '灵石 +40 · 顾长风 +8 · 沈青梧 -6',
        result: '顾长风在灵脉里坐了半夜，出来时眼底有金光。他更强了，也更不像从前。',
        effects: [
          { stones: 40, bond: { id: 'gu', delta: 8 }, mood: { id: 'shen', delta: -6 }, flag: { key: 'vein', value: 'gu' } },
        ],
      },
      {
        id: 'shen',
        label: '让沈青梧封脉',
        hint: '心得 +5 · 沈青梧 +8 · 顾长风 -5',
        result: '沈青梧以剑封脉，寒气顺着山脊退了半里。她没说裂口下面是什么。',
        effects: [{ insight: 5, bond: { id: 'shen', delta: 8 }, mood: { id: 'gu', delta: -5 }, flag: { key: 'vein', value: 'sealed' } }],
      },
      {
        id: 'self',
        label: '亲自下脉',
        hint: '心得 +3 · 道心 +5 · 受伤',
        result: '你亲自下到裂口。灵气割破了你的手，但你看见灵脉深处有一枚旧剑匣。',
        effects: [
          { insight: 3, morale: 5, flag: { key: 'vein', value: 'self' }, log: '你亲自下脉，带回一枚旧剑匣。' },
        ],
      },
    ],
  },
  {
    id: 'baiPast',
    title: '药炉里的魔印',
    kicker: '第五日 · 药庐',
    text:
      '半夜，药庐还亮着灯。你推门进去，白芷正把一枚黑色药印按进炉火。\n\n' +
      '她跪下来，声音很轻：“我从前……是魔道药人。这枚印能压住我体内的东西。”\n\n' +
      '炉火映着她的脸。你可以信她，也可以现在就把她逐出山门。',
    priority: 100,
    when: (s) => s.day === 5,
    options: [
      {
        id: 'trust',
        label: '信她',
        hint: '白芷 +15 · 心得 +3',
        result: '你替她关上药庐的门。她没道谢，只是把药炉的火拨旺了一点。',
        effects: [{ bond: { id: 'bai', delta: 15 }, insight: 3, daoHeart: 3, flag: { key: 'baiTrust', value: true }, log: '你选择相信白芷。' }],
      },
      {
        id: 'watch',
        label: '留下察看',
        hint: '声望 +3 · 白芷 -10',
        result: '你收走了药印，留她在山门里。她点头，从此话更少了。',
        effects: [{ reputation: 3, bond: { id: 'bai', delta: -10 }, flag: { key: 'baiTrust', value: false }, log: '你收走药印，留白芷察看。' }],
      },
      {
        id: 'exile',
        label: '逐出山门',
        hint: '声望 +6 · 道心 -10 · 白芷离开',
        result: '白芷没有辩解，只带走一只旧药箱。山门外的雾很快把她吞没了。',
        effects: [{ reputation: 6, morale: -10, daoHeart: -4, leave: 'bai', flag: { key: 'baiGone', value: true }, log: '白芷离开青云宗。' }],
      },
    ],
  },
  {
    id: 'guCrisis',
    title: '大师兄的剑',
    kicker: '第七日 · 大殿',
    text:
      '顾长风把剑横在殿前：“师父，你太软了。青云宗需要一个敢杀人的宗主。”\n\n' +
      '玄真站在他身后，没有说话。苏晚照低着头，陆小满攥着衣角。\n\n' +
      '这一剑，你可以接，也可以不接。',
    priority: 100,
    when: (s) => s.day === 7,
    options: [
      {
        id: 'yield',
        label: '让他主事',
        hint: '顾长风 +20 · 玄真 -10 · 声望 -5',
        result: '你把宗主印交给顾长风。他接过去，手很稳。从今天起，山门里说话最响的人换了。',
        effects: [{ bond: { id: 'gu', delta: 20 }, mood: { id: 'xuan', delta: -10 }, reputation: -5, daoHeart: -3, flag: { key: 'guLead', value: true } }],
      },
      {
        id: 'refuse',
        label: '拒绝',
        hint: '顾长风 -15 · 声望 +5',
        result: '你说：“等我死了，你再拿。”顾长风收剑，笑了一下。那笑不像服气。',
        effects: [
          { bond: { id: 'gu', delta: -15 }, reputation: 5, daoHeart: 2, flag: { key: 'guRefused', value: true }, log: '你拒绝顾长风主事。' },
        ],
      },
      {
        id: 'talk',
        label: '与他夜谈',
        hint: '顾长风 +8 · 心得 +2',
        result: '你们在大殿坐到天亮。他说起灭门那夜，你第一次看见他手在抖。',
        effects: [{ bond: { id: 'gu', delta: 8 }, insight: 2, flag: { key: 'guTalk', value: true } }],
      },
    ],
  },
  {
    id: 'suMarriage',
    title: '一纸婚书',
    kicker: '第九日 · 山门',
    text:
      '苏家的人送来一箱灵石和一张婚书。赵氏愿意以一座灵矿为聘，只要苏晚照过门。\n\n' +
      '苏晚照站在阶下，指尖发白。她没有看婚书，只看着你。',
    priority: 100,
    when: (s) => s.day === 9,
    options: [
      {
        id: 'accept',
        label: '应下婚事',
        hint: '灵石 +120 · 苏晚照 -25 · 道心 -8',
        result: '婚书按了印。苏晚照回房收拾东西，一夜没点灯。',
        effects: [{ stones: 120, bond: { id: 'su', delta: -25 }, morale: -8, daoHeart: -4, flag: { key: 'suMarried', value: true } }],
      },
      {
        id: 'refuse',
        label: '退回婚书',
        hint: '声望 -6 · 灵石 -30 · 苏晚照 +20',
        result: '你把婚书丢进火盆。苏家来人拂袖而去。苏晚照第一次在你面前哭出声。',
        effects: [{ reputation: -6, stones: -30, bond: { id: 'su', delta: 20 }, daoHeart: 3, flag: { key: 'suFree', value: true } }],
        requires: (s) => s.resources.stones >= 30,
        requireText: '灵石不足',
      },
      {
        id: 'self',
        label: '让她自决',
        hint: '苏晚照 +12 · 未知',
        result: '你把婚书推回她面前：“你自己选。”她看了很久，最后把婚书折好，收进袖中。',
        effects: [{ bond: { id: 'su', delta: 12 }, flag: { key: 'suChoice', value: true } }],
      },
    ],
  },
  {
    id: 'luRoot',
    title: '天灵根',
    kicker: '第十一日 · 试剑台',
    text:
      '试剑台的傀儡忽然暴走。陆小满挡在阿七身前，体内封印碎裂，一道青色灵光冲上夜空。\n\n' +
      '一品天灵根。整个山门都看见了。\n\n' +
      '玄真低声说：“把她交出去，三宗会抢着要。留下她，青云宗就再也藏不住了。”',
    priority: 100,
    when: (s) => s.day === 11,
    options: [
      {
        id: 'reveal',
        label: '公开护她',
        hint: '声望 +10 · 陆小满 +15',
        result: '你当众收陆小满为真传。她跪在试剑台上，哭得说不出话。',
        effects: [{ reputation: 10, bond: { id: 'lu', delta: 15 }, daoHeart: 3, flag: { key: 'luReveal', value: true } }],
      },
      {
        id: 'hide',
        label: '压下消息',
        hint: '心得 +5 · 陆小满 +8 · 声望 -2',
        result: '你封了试剑台，对外只说傀儡失灵。陆小满继续做她的外门弟子，只是眼里多了一点光。',
        effects: [{ insight: 5, bond: { id: 'lu', delta: 8 }, reputation: -2, flag: { key: 'luHide', value: true } }],
      },
      {
        id: 'send',
        label: '送去大宗',
        hint: '灵石 +100 · 道心 -12 · 陆小满离开',
        result: '你把陆小满送上前往天剑宗的船。她没回头。阿七追着船跑了很远。',
        effects: [{ stones: 100, morale: -12, daoHeart: -5, leave: 'lu', flag: { key: 'luGone', value: true } }],
      },
    ],
  },
  {
    id: 'tournament',
    title: '三宗大比',
    kicker: '第十二日 · 云台',
    text:
      '云台之上，三宗弟子列阵。青云宗的旗子只剩半幅，风一吹就响。\n\n' +
      '你回头看：顾长风握着剑，沈青梧站在阴影里，苏晚照攥着药囊，陆小满（如果还在）低着头，阿七在数台下的台阶。\n\n' +
      '十二日了。该你落子。',
    priority: 200,
    when: (s) => s.day >= 12,
    options: [
      {
        id: 'fight',
        label: '掌门亲自登台',
        hint: '以十二日积累定胜负',
        result: '',
        effects: [{ flag: { key: 'finalChoice', value: 'fight' } }],
      },
      {
        id: 'gu',
        label: '派顾长风出战',
        hint: '取决于顾长风的忠诚与修为',
        result: '',
        effects: [{ flag: { key: 'finalChoice', value: 'gu' } }],
      },
      {
        id: 'yield',
        label: '弃权 · 保山门',
        hint: '保住人，放弃山门',
        result: '',
        effects: [{ flag: { key: 'finalChoice', value: 'yield' } }],
      },
    ],
  },
];

export const PERSONAL_EVENTS: StoryEvent[] = [
  {
    id: 'luHerb',
    title: '崖边的灵草',
    kicker: '第二日 · 后山',
    text: '陆小满采药时从崖边滑下去，怀里却死死护着一株发青光的草。她小声说：“这个……是不是很值钱？”',
    priority: 60,
    when: (s) => s.day === 2 && find(s, 'lu')?.assignment === 'gather',
    options: [
      {
        id: 'praise',
        label: '夸她，把草给她',
        hint: '陆小满 +10 · 药材 +15',
        result: '陆小满把草种进药庐的破盆里，天天浇水。她说，等她厉害了，要种满整座山。',
        effects: [{ bond: { id: 'lu', delta: 10 }, herbs: 15, flag: { key: 'luHerb', value: true } }],
      },
      {
        id: 'take',
        label: '收归宗门',
        hint: '药材 +25 · 陆小满 -5',
        result: '你把灵草收进库房，记了她一功。她笑着说没事，手指却抠着衣角。',
        effects: [{ herbs: 25, bond: { id: 'lu', delta: -5 } }],
      },
    ],
  },
  {
    id: 'shenSword',
    title: '剑冢里的旧剑',
    kicker: '第四日 · 后山剑冢',
    text: '沈青梧在剑冢里坐了一整天。她找到一柄断剑，剑脊上刻着“沈”字。她问你：“我能留着吗？”',
    priority: 60,
    when: (s) => s.day === 4 && find(s, 'shen')?.assignment === 'cultivate',
    options: [
      {
        id: 'keep',
        label: '让她留着',
        hint: '沈青梧 +10 · 修为 +10',
        result: '她把断剑重新磨了一遍。那天夜里，剑冢里有很轻的哭声。',
        effects: [{ bond: { id: 'shen', delta: 10 }, cultivation: { id: 'shen', delta: 10 }, flag: { key: 'shenSword', value: true } }],
      },
      {
        id: 'library',
        label: '收入藏经阁',
        hint: '心得 +5 · 沈青梧 -5',
        result: '断剑被登记入库。沈青梧站在门口看了很久，才转身离开。',
        effects: [{ insight: 5, bond: { id: 'shen', delta: -5 } }],
      },
    ],
  },
  {
    id: 'qiScout',
    title: '阿七看见的东西',
    kicker: '第六日 · 山门外',
    text: '阿七巡山回来，蹲在门槛上啃冷馒头：“山门外那棵歪脖子树，今天多了一个人。他没影子。”',
    priority: 60,
    when: (s) => s.day === 6 && find(s, 'qi')?.assignment === 'patrol',
    options: [
      {
        id: 'reward',
        label: '信他，加派人手',
        hint: '灵石 -10 · 声望 +4 · 阿七 +8',
        result: '你在山门外守了一夜，果然逮住一个魔道探子。阿七得了两只鸡腿。',
        effects: [{ stones: -10, reputation: 4, bond: { id: 'qi', delta: 8 }, flag: { key: 'demonWarn', value: true } }],
      },
      {
        id: 'ignore',
        label: '让他别胡说',
        hint: '声望 -3 · 阿七 -5',
        result: '阿七哦了一声，把馒头掰成两半，一半塞进你手里。',
        effects: [{ reputation: -3, bond: { id: 'qi', delta: -5 } }],
      },
    ],
  },
  {
    id: 'xuanLetter',
    title: '旧信',
    kicker: '第八日 · 藏经阁',
    text: '玄真在藏经阁烧一封信。你只看见半行字：“……青云宗灭门那夜，我看见……”',
    priority: 60,
    when: (s) => s.day === 8,
    options: [
      {
        id: 'ask',
        label: '追问',
        hint: '心得 +4 · 玄真 +6',
        result: '玄真沉默很久，说：“当年带人上山的，不是魔道。是正道。”',
        effects: [{ insight: 4, bond: { id: 'xuan', delta: 6 }, flag: { key: 'xuanTruth', value: true } }],
      },
      {
        id: 'burn',
        label: '替他烧完',
        hint: '玄真 +10 · 声望 +2',
        result: '你把剩下的信纸扔进火里。玄真看着火，眼睛很红。',
        effects: [{ bond: { id: 'xuan', delta: 10 }, reputation: 2 }],
      },
    ],
  },
  {
    id: 'guBreak',
    title: '今夜破境',
    kicker: '第十日 · 后山',
    text: '顾长风的剑气把后山石壁削出一道白痕。他站在月光里，气息不稳：“今晚，我要破境。你护不护法？”',
    priority: 60,
    when: (s) => s.day === 10 && (find(s, 'gu')?.cultivation ?? 0) >= 55,
    options: [
      {
        id: 'guard',
        label: '亲自护法',
        hint: '灵石 -30 · 顾长风 +10 · 修为 +15',
        result: '你在他身后坐了一夜。天亮时他破境成功，第一句话是：“多谢。”',
        effects: [{ stones: -30, bond: { id: 'gu', delta: 10 }, cultivation: { id: 'gu', delta: 15 }, flag: { key: 'guBreak', value: true } }],
        requires: (s) => s.resources.stones >= 30,
        requireText: '灵石不足',
      },
      {
        id: 'let',
        label: '让他自己来',
        hint: '顾长风 -5 · 修为 +8',
        result: '他一个人走进后山。第二天出来时满身是血，但境界稳了。',
        effects: [{ bond: { id: 'gu', delta: -5 }, cultivation: { id: 'gu', delta: 8 } }],
      },
    ],
  },
];

export const RANDOM_EVENTS: StoryEvent[] = [
  {
    id: 'merchant',
    title: '行商',
    kicker: '山门外',
    text: '一个挑着担子的行商在山门外歇脚，想用一批药材换灵石。',
    priority: 20,
    when: (s) => s.day >= 2,
    options: [
      {
        id: 'buy',
        label: '买下药材',
        hint: '灵石 -30 · 药材 +35',
        result: '行商留下三包药材，哼着歌下山了。',
        effects: [{ stones: -30, herbs: 35 }],
        requires: (s) => s.resources.stones >= 30,
        requireText: '灵石不足',
      },
      {
        id: 'sell',
        label: '卖点余药',
        hint: '灵石 +35 · 药材 -25',
        result: '你把库房里发潮的药材卖了个好价。',
        effects: [{ stones: 35, herbs: -25 }],
        requires: (s) => s.resources.herbs >= 25,
        requireText: '药材不足',
      },
      {
        id: 'no',
        label: '送客',
        hint: '无',
        result: '行商挑着担子走了。山门又安静下来。',
        effects: [],
      },
    ],
  },
  {
    id: 'storm',
    title: '秋雨',
    kicker: '山中',
    text: '一场秋雨下了三天，药田淹了一半，弟子们挤在大殿里烤火。',
    priority: 15,
    when: (s) => s.day >= 4,
    options: [
      {
        id: 'repair',
        label: '花灵石修缮',
        hint: '灵石 -25 · 道心 +5',
        result: '你带人修好了药田的排水沟，弟子们轮流喝上了热姜汤。',
        effects: [{ stones: -25, morale: 5 }],
        requires: (s) => s.resources.stones >= 25,
        requireText: '灵石不足',
      },
      {
        id: 'endure',
        label: '硬扛',
        hint: '药材 -15 · 道心 -3',
        result: '雨停后，药田毁了三成。没人抱怨，但大殿里更冷了。',
        effects: [{ herbs: -15, morale: -3 }],
      },
    ],
  },
  {
    id: 'thief',
    title: '库房失窃',
    kicker: '夜里',
    text: '库房的灵石少了一小袋。门锁没坏，像是自己人拿的。',
    priority: 18,
    when: (s) => s.day >= 5,
    options: [
      {
        id: 'investigate',
        label: '暗中查',
        hint: '心得 +3 · 人心 -3',
        result: '你查了三天，最后在阿七的床下找到空袋子。他说是拿去换了药，给受伤的师弟。',
        effects: [{ insight: 3, morale: -3, flag: { key: 'thiefQi', value: true } }],
      },
      {
        id: 'drop',
        label: '不再追究',
        hint: '道心 +5',
        result: '你在库房门口多放了一袋灵石，什么也没说。',
        effects: [{ morale: 5 }],
      },
    ],
  },
];

export const FREE_EVENTS: StoryEvent[] = [
  {
    id: 'free_wanderer',
    tier: 1,
    risk: 'low',
    cooldown: 2,
    title: '游方散修',
    kicker: '自由修行 · 山门',
    text: '一名背着断剑的散修在山门外站了很久。他说只求一顿热饭，愿意替宗门做三日杂役。',
    priority: 10,
    when: () => true,
    options: [
      {
        id: 'take',
        label: '留下他',
        hint: '灵石 -10 · 声望 +4 · 道心 +3',
        result: '散修留了下来。他话不多，但把山门的石阶修得很平。',
        effects: [{ stones: -10, reputation: 4, morale: 3 }],
        requires: (s) => s.resources.stones >= 10,
        requireText: '灵石不足',
      },
      {
        id: 'meal',
        label: '只给一顿饭',
        hint: '药材 -5 · 道心 +1',
        result: '他吃完，把碗洗干净，转身走进雨里。',
        effects: [{ herbs: -5, morale: 1 }],
      },
      {
        id: 'refuse',
        label: '闭门',
        hint: '道心 -2',
        result: '山门关了。夜里你听见门外有剑鞘碰石的声音，很久才消失。',
        effects: [{ morale: -2 }],
      },
    ],
  },
  {
    id: 'free_harvest',
    tier: 1,
    risk: 'low',
    cooldown: 2,
    title: '灵田抽穗',
    kicker: '自由修行 · 灵田',
    text: '灵田里的灵谷一夜之间抽了穗，比往年早了半个月。苏晚照说，这不是好兆头。',
    priority: 10,
    when: () => true,
    options: [
      {
        id: 'harvest',
        label: '提前收割',
        hint: '药材 +25 · 心得 +2',
        result: '你们抢在寒潮前收了灵谷。苏晚照把第一束穗子供在药庐。',
        effects: [{ herbs: 25, insight: 2 }],
      },
      {
        id: 'wait',
        label: '再等三日',
        hint: '药材 +40，但有风险',
        result: '三日后果真下了霜。灵田毁了一半，剩下的谷子却格外饱满。',
        effects: [{ herbs: 40, morale: -2 }],
        check: {
          chance: 62,
          failText: '寒潮提前了。等你赶到灵田，半畦灵谷已经冻成黑穗，苏晚照蹲在田埂上没说话。',
          failEffects: [{ herbs: -10, morale: -3 }],
        },
      },
      {
        id: 'inspect',
        label: '查灵脉',
        hint: '心得 +5 · 灵石 -10',
        result: '你在田埂下找到一缕细小的灵脉。它很弱，但还活着。',
        effects: [{ insight: 5, stones: -10, flag: { key: 'freeVein', value: true } }],
        requires: (s) => s.resources.stones >= 10,
        requireText: '灵石不足',
      },
    ],
  },
  {
    id: 'free_beast',
    tier: 2,
    risk: 'high',
    cooldown: 3,
    title: '夜半兽吼',
    kicker: '自由修行 · 后山',
    text: '后山传来兽吼。巡山弟子说看见一双青色的眼睛，在剑冢方向。',
    priority: 10,
    when: () => true,
    options: [
      {
        id: 'hunt',
        label: '亲自去看看',
        hint: '声望 +5 · 药材 +10',
        result: '你追到剑冢，只看见一截断尾和半块被啃过的碑。',
        effects: [{ reputation: 5, herbs: 10 }],
        check: {
          chance: (s) => Math.min(88, 55 + Math.round(s.resources.reputation * 0.5)),
          failText: '你追到剑冢，青色眼睛一闪而过。有什么东西撞在你肩上，回山门时袖口全是血。',
          failEffects: [{ reputation: -4, morale: -3, herbs: -6 }],
        },
      },
      {
        id: 'guard',
        label: '加派人手',
        hint: '灵石 -15 · 道心 +2',
        result: '山门点了三夜灯。兽没有再出现，弟子们的剑却握得更稳了。',
        effects: [{ stones: -15, morale: 2 }],
        requires: (s) => s.resources.stones >= 15,
        requireText: '灵石不足',
      },
      {
        id: 'ignore',
        label: '不加理会',
        hint: '药材 -10',
        result: '第二天，药圃少了半畦灵草。',
        effects: [{ herbs: -10 }],
      },
    ],
  },
  {
    id: 'free_delegation',
    tier: 2,
    risk: 'middle',
    cooldown: 3,
    title: '小宗来访',
    kicker: '自由修行 · 山门',
    text: '山下一个小宗派派了人来，想用一批灵石换青云宗的剑谱抄本。',
    priority: 10,
    when: () => true,
    options: [
      {
        id: 'trade',
        label: '换',
        hint: '灵石 +45 · 心得 -5',
        result: '他们带走一卷抄本，留下两袋灵石。',
        effects: [{ stones: 45, insight: -5 }],
        requires: (s) => s.resources.insight >= 5,
        requireText: '心得不足',
      },
      {
        id: 'refuse',
        label: '不换',
        hint: '声望 -2 · 道心 +2',
        result: '来客脸色不好，但你还是把剑谱留在了藏经阁。',
        effects: [{ reputation: -2, morale: 2 }],
      },
      {
        id: 'gift',
        label: '抄一份相赠',
        hint: '灵石 -10 · 声望 +6',
        result: '对方千恩万谢。你知道这份人情以后会回来。',
        effects: [{ stones: -10, reputation: 6 }],
        requires: (s) => s.resources.stones >= 10,
        requireText: '灵石不足',
      },
    ],
  },
  {
    id: 'free_dream',
    tier: 1,
    risk: 'low',
    cooldown: 2,
    title: '弟子梦魇',
    kicker: '自由修行 · 夜里',
    text: '半夜有人敲你的门。阿七说，他梦见山门后面站着一个人，穿着一百年前的青云宗服。',
    priority: 10,
    when: () => true,
    options: [
      {
        id: 'listen',
        label: '听完',
        hint: '心得 +3 · 道心 +2',
        result: '你听完，给他倒了杯热水。他走后，你在灯下坐了半宿。',
        effects: [{ insight: 3, morale: 2 }],
      },
      {
        id: 'scold',
        label: '让他回去睡',
        hint: '道心 -2',
        result: '阿七低头走了。第二天他照常扫院子，只是没看你。',
        effects: [{ morale: -2 }],
      },
      {
        id: 'investigate',
        label: '去后山看看',
        hint: '心得 +2 · 道心 +1',
        result: '后山什么也没有，只有一块旧碑。你摸了摸碑上的字，手心是凉的。',
        effects: [{ insight: 2, daoHeart: 1 }],
      },
    ],
  },
  {
    id: 'free_rain',
    tier: 1,
    risk: 'low',
    cooldown: 2,
    title: '连雨',
    kicker: '自由修行 · 山中',
    text: '雨下了七天。山道塌了一段，库房的墙也渗了水。',
    priority: 10,
    when: () => true,
    options: [
      {
        id: 'repair',
        label: '带人修路',
        hint: '灵石 -20 · 声望 +4 · 道心 +2',
        result: '你们在雨里搬了两天石头。路通了，弟子们看你的眼神也变了。',
        effects: [{ stones: -20, reputation: 4, morale: 2 }],
        requires: (s) => s.resources.stones >= 20,
        requireText: '灵石不足',
      },
      {
        id: 'wait',
        label: '等雨停',
        hint: '药材 -12 · 道心 -2',
        result: '雨停后，山道塌了更多，库房也潮了半间。',
        effects: [{ herbs: -12, morale: -2 }],
      },
      {
        id: 'move',
        label: '把药材搬到主殿',
        hint: '药材 -5 · 道心 +1',
        result: '主殿里堆满了药包。虽然挤，但没人抱怨。',
        effects: [{ herbs: -5, morale: 1 }],
      },
    ],
  },
  {
    id: 'free_fox',
    tier: 1,
    risk: 'low',
    cooldown: 2,
    title: '走失的野狐',
    kicker: '自由修行 · 山道',
    text: '山道边趴着一只幼狐，后腿被猎夹夹伤。它看你，既不逃，也不叫。',
    priority: 10,
    when: () => true,
    options: [
      {
        id: 'help',
        label: '替它疗伤',
        hint: '药材 -5 · 因果 +2 · 道心 +1',
        result: '你替幼狐上了药。它舔了舔你的手，一瘸一拐地钻进林子里。',
        effects: [{ herbs: -5, karma: 2, daoHeart: 1 }],
      },
      {
        id: 'leave',
        label: '由它去',
        hint: '道心 -2',
        result: '你走开几步，又回头。幼狐已经不见了。',
        effects: [{ karma: -1, daoHeart: -2 }],
      },
    ],
  },
  {
    id: 'free_spring',
    tier: 2,
    risk: 'middle',
    cooldown: 3,
    title: '灵泉复涌',
    kicker: '自由修行 · 后崖',
    text: '后崖下枯了多年的灵泉，忽然又涌出水来，水里有微弱的灵光。',
    priority: 10,
    when: () => true,
    options: [
      {
        id: 'draw',
        label: '引水入田',
        hint: '药材 +12 · 灵石 -8',
        result: '你用竹管把泉水分去灵田。苏晚照说，今年的药会格外精神。',
        effects: [{ herbs: 12, stones: -8 }],
        requires: (s) => s.resources.stones >= 8,
        requireText: '灵石不足',
      },
      {
        id: 'meditate',
        label: '临泉打坐',
        hint: '心得 +3',
        result: '你在泉边坐了一夜。泉水声很轻，像在念一段旧诀。',
        effects: [{ insight: 3 }],
      },
      {
        id: 'seal',
        label: '先封住',
        hint: '声望 +2',
        result: '你让人用禁制把泉口封了。弟子们都说稳妥，只是夜里总听见水声。',
        effects: [{ reputation: 2 }],
      },
    ],
  },
  {
    id: 'free_finale',
    tier: 3,
    risk: 'middle',
    cooldown: 99,
    title: '宗门志',
    kicker: '自由修行 · 终章',
    text:
      '三宗大比已经是很久以前的事了。\n' +
      '剑冢的草长高了，主殿的灯换过三盏，山门前的石阶被弟子们踩得发亮。\n' +
      '你翻开宗门志，发现上面已经写满了人名。',
    priority: 100,
    when: (s) =>
      Number(s.flags.shenArc ?? 0) >= 3 &&
      Number(s.flags.guArc ?? 0) >= 3 &&
      Number(s.flags.luArc ?? 0) >= 3 &&
      !s.flags.arcFinale,
    options: [
      {
        id: 'close',
        label: '合上宗门志',
        hint: '道心 +5 · 声望 +3',
        result:
          '你把宗门志合上，放回主殿最高的一层。\n' +
          '山门还在，人还在。青云宗的故事没有结束，只是这一卷写到了这里。',
        effects: [{ morale: 5, reputation: 3, flag: { key: 'arcFinale', value: true } }],
      },
      {
        id: 'next',
        label: '翻到下一页',
        hint: '灵石 +50 · 道心 +2',
        result:
          '你翻到空白的一页，提笔写下第一行：\n' +
          '“青云宗，第三年。”\n' +
          '门外有人喊你，说山下来了一群想入宗的少年。',
        effects: [{ stones: 50, morale: 2, flag: { key: 'arcFinale', value: true } }],
      },
    ],
  },
];

export const SECT_RANKS: Array<{ at: number; name: string }> = [
  { at: 0, name: '败落遗宗' },
  { at: 30, name: '三流宗门' },
  { at: 80, name: '二流宗门' },
  { at: 150, name: '一流宗门' },
  { at: 240, name: '一方名门' },
  { at: 350, name: '霸主宗门' },
  { at: 500, name: '万古圣地' },
];

export function sectRank(merits: number): { index: number; name: string; next: number | null } {
  let idx = 0;
  for (let i = 0; i < SECT_RANKS.length; i++) if (merits >= SECT_RANKS[i].at) idx = i;
  const next = idx < SECT_RANKS.length - 1 ? SECT_RANKS[idx + 1].at : null;
  return { index: idx, name: SECT_RANKS[idx].name, next };
}

export interface SectPerk {
  label: string;
  stones: number;
  herbs: number;
  insight: number;
  reputation: number;
  actionPoints: number;
  extraCandidates: number;
}

export const SECT_PERKS: SectPerk[] = [
  { label: '白手起家', stones: 0, herbs: 0, insight: 0, reputation: 0, actionPoints: 0, extraCandidates: 0 },
  { label: '小有名气', stones: 2, herbs: 2, insight: 0, reputation: 0, actionPoints: 0, extraCandidates: 0 },
  { label: '香火渐盛', stones: 3, herbs: 3, insight: 0, reputation: 0, actionPoints: 0, extraCandidates: 0 },
  { label: '声名远播', stones: 4, herbs: 4, insight: 1, reputation: 0, actionPoints: 1, extraCandidates: 0 },
  { label: '一方名门', stones: 5, herbs: 5, insight: 1, reputation: 1, actionPoints: 1, extraCandidates: 1 },
  { label: '霸主气象', stones: 7, herbs: 7, insight: 2, reputation: 1, actionPoints: 1, extraCandidates: 1 },
  { label: '万古圣地', stones: 10, herbs: 10, insight: 3, reputation: 2, actionPoints: 2, extraCandidates: 1 },
];

export function sectPerk(merits: number): SectPerk {
  return SECT_PERKS[sectRank(merits).index];
}

export interface FaithBoon {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  maxLevel: number;
  /** Faith cost per level; index = current level → next level cost. */
  costs: number[];
  effects: string[];
  accent: string;
}

/**
 * 香火天梯：把“功业溢出”变成可兑换的永久增益。
 * 香火来自每日要务（+1）与宗阶晋升（每新跨一阶 +2）。
 */
export const FAITH_BOONS: FaithBoon[] = [
  {
    id: 'vein',
    name: '灵脉回春',
    subtitle: '山运 · 产出',
    description: '以香火滋养山根灵脉，灵田与灵石矿的日获更丰。',
    maxLevel: 3,
    costs: [3, 6, 9],
    effects: ['药材 +2/日 · 灵石 +2/日', '药材 +4/日 · 灵石 +4/日', '药材 +6/日 · 灵石 +6/日'],
    accent: '#8fb98b',
  },
  {
    id: 'pool',
    name: '洗剑池',
    subtitle: '弟子 · 修炼',
    description: '引香火温养剑池，弟子每日修行进境更快。',
    maxLevel: 3,
    costs: [4, 8, 12],
    effects: ['每日修炼 +0.5/日', '每日修炼 +1.0/日', '每日修炼 +1.5/日'],
    accent: '#9fc7d8',
  },
  {
    id: 'array',
    name: '护山大阵',
    subtitle: '宗脉 · 声望',
    description: '香火凝成护山云篆，声名远播，弟子也更愿留下。',
    maxLevel: 2,
    costs: [5, 10],
    effects: ['声望 +1/日 · 弟子不易离山', '声望 +2/日 · 弟子更难离山'],
    accent: '#c8a15a',
  },
  {
    id: 'talisman',
    name: '渡劫护符',
    subtitle: '掌教 · 天劫',
    description: '香火结成的护符，能替你挡下一缕天劫雷光。',
    maxLevel: 2,
    costs: [6, 12],
    effects: ['天劫威势 -5%', '天劫威势 -10%'],
    accent: '#e0a39a',
  },
];

export function faithBoon(id: string): FaithBoon | undefined {
  return FAITH_BOONS.find((b) => b.id === id);
}

export function faithLevel(bought: Record<string, number>, id: string): number {
  return Number(bought[id] ?? 0);
}

export interface Artifact {
  id: string;
  name: string;
  epithet: string;
  description: string;
  accent: string;
}

/** 掌门法宝：历险所得、被动生效、可叠加。 */
export const ARTIFACTS: Artifact[] = [
  {
    id: 'trial_seal',
    name: '试剑金令',
    epithet: '三胜所得',
    description: '三场试剑全胜的金令。持之，破境时心更稳。破境成功率 +5%。',
    accent: '#e0b45e',
  },
  {
    id: 'demon_tassel',
    name: '破煞剑穗',
    epithet: '击退魔道',
    description: '以魔道护法之败炼成的剑穗。天劫威势 -4%。',
    accent: '#c25a5a',
  },
  {
    id: 'sanctum_seal',
    name: '圣地古印',
    epithet: '万古圣地',
    description: '圣地的古印。全宗弟子每日修炼 +0.5。',
    accent: '#9fc7d8',
  },
  {
    id: 'vein_locket',
    name: '灵脉之钥',
    epithet: '二周目所得',
    description: '重开山门时结下的灵脉之钥。每日打坐收益 +2。',
    accent: '#8fb98b',
  },
];

export function artifact(id: string): Artifact | undefined {
  return ARTIFACTS.find((a) => a.id === id);
}

export interface Technique {
  id: string;
  name: string;
  task: Task;
  bonus: string;
  cost: number;
}

/** 功法研习：消耗心得为弟子传法，强化其一门日常任务。 */
export const TECHNIQUES: Technique[] = [
  { id: 'sword', name: '青云剑诀', task: 'cultivate', bonus: '修炼 +1.5/日', cost: 10 },
  { id: 'herb', name: '采药百草术', task: 'gather', bonus: '采药 +2.5/日', cost: 8 },
  { id: 'ward', name: '巡山诀', task: 'patrol', bonus: '巡山声望 +1.5/日', cost: 8 },
  { id: 'dao', name: '悟道心经', task: 'study', bonus: '参悟 +0.8/日', cost: 10 },
];

export function technique(id: string | null | undefined): Technique | undefined {
  if (!id) return undefined;
  return TECHNIQUES.find((t) => t.id === id);
}

/** Four seasons; each last three days, a full year spans twelve days. */
export const SEASONS = [
  { name: '春', label: '生发' },
  { name: '夏', label: '炎阳' },
  { name: '秋', label: '肃收' },
  { name: '冬', label: '藏雪' },
] as const;

export const SEASON_BONUS: ReadonlyArray<{ herbs?: number; insight?: number; stones?: number; reputation?: number }> = [
  { herbs: 2 },
  { insight: 1 },
  { stones: 2 },
  { reputation: 1 },
];

export function seasonOf(day: number): { index: number; name: string; label: string } {
  const index = Math.floor(((day - 1) % 12) / 3) % 4;
  return { index, name: SEASONS[index].name, label: SEASONS[index].label };
}

/** Milestone events unlocked by climbing the sect-rank ladder. */
export const ERA_EVENTS: StoryEvent[] = [
  {
    id: 'era_three',
    tier: 2,
    risk: 'middle',
    title: '初露锋芒',
    kicker: '宗门 · 纪年',
    text: '青云宗的名声传出了山坳。一位锦衣老者登门，说自己是山下坊市的执事，想看看这座宗门值不值得下注。',
    priority: 90,
    when: (s) => sectRank(s.sectMerits).index >= 1,
    options: [
      {
        id: 'show',
        label: '带他看剑坪',
        hint: '声望 +8 · 灵石 +20',
        result: '老者看过剑坪，又看了藏经阁，走时留下两袋灵石：“且看三日后。”',
        effects: [{ reputation: 8, stones: 20 }],
      },
      {
        id: 'decline',
        label: '闭门谢客',
        hint: '道心 +4',
        result: '你没让他进来。老者捻须一笑，说这样的宗门才有意思，转身下山去了。',
        effects: [{ daoHeart: 4 }],
      },
    ],
  },
  {
    id: 'era_two',
    tier: 2,
    risk: 'middle',
    title: '修士来投',
    kicker: '宗门 · 纪年',
    text: '山门外聚了十几个闻讯而来的散修，求一个栖身之处。人多了，是非也多。',
    priority: 90,
    when: (s) => sectRank(s.sectMerits).index >= 2,
    options: [
      {
        id: 'take',
        label: '开门纳贤',
        hint: '声望 +10 · 道心 -3 · 灵石 -15',
        result: '你开了山门。新来的散修里有几个好苗子，也混进了两个探子。',
        effects: [{ reputation: 10, daoHeart: -3, stones: -15 }],
      },
      {
        id: 'test',
        label: '设下考较',
        hint: '声望 +6 · 心得 +3',
        result: '你设下问心、试剑、制药三关。留下三人，其余下山时都心服口服。',
        effects: [{ reputation: 6, insight: 3 }],
      },
    ],
  },
  {
    id: 'era_first',
    tier: 3,
    risk: 'middle',
    title: '天骄来投',
    kicker: '宗门 · 纪年',
    text: '一个自称百年难遇的天骄少年，背着剑站在山门外，点名要拜在你这一脉门下。',
    priority: 90,
    when: (s) => sectRank(s.sectMerits).index >= 3,
    options: [
      {
        id: 'accept',
        label: '收他入门',
        hint: '声望 +15 · 心得 +6',
        result: '少年拜了三拜。你后来才知道，他父亲是另一宗的长老。',
        effects: [{ reputation: 15, insight: 6 }],
      },
      {
        id: 'watch',
        label: '留观三年',
        hint: '声望 +8 · 道心 +5',
        result: '你让他先在剑坪扫地三年。少年二话不说，扫得比谁都干净。',
        effects: [{ reputation: 8, daoHeart: 5 }],
      },
    ],
  },
  {
    id: 'era_famous',
    tier: 3,
    risk: 'middle',
    title: '山门盟约',
    kicker: '宗门 · 纪年',
    text: '邻域两个宗门派人来，说要与青云宗结盟，共抗下一次灵气潮汐。结盟要出人，也要担风险。',
    priority: 90,
    when: (s) => sectRank(s.sectMerits).index >= 4,
    options: [
      {
        id: 'sign',
        label: '签下盟约',
        hint: '声望 +12 · 灵石 +30 · 药材 +20',
        result: '三宗在云台立誓。盟书一式三份，你那份压在香炉下。',
        effects: [{ reputation: 12, stones: 30, herbs: 20 }],
      },
      {
        id: 'hesitate',
        label: '再议三年',
        hint: '道心 +6',
        result: '你没有签。来使脸色不好，但你睡得更安稳了。',
        effects: [{ daoHeart: 6 }],
      },
    ],
  },
  {
    id: 'era_hegemon',
    tier: 3,
    risk: 'middle',
    title: '名动一域',
    kicker: '宗门 · 纪年',
    text: '青云宗的名号终于上了域榜。那一夜，山门外的灵灯亮了一整宿。',
    priority: 90,
    when: (s) => sectRank(s.sectMerits).index >= 5,
    options: [
      {
        id: 'celebrate',
        label: '大宴三日',
        hint: '声望 +18 · 灵石 -25 · 道心 +5',
        result: '山门摆了三日流水席。所有人都喝醉了，连玄真都哼了两句。',
        effects: [{ reputation: 18, stones: -25, daoHeart: 5 }],
      },
      {
        id: 'humble',
        label: '闭门谢贺',
        hint: '道心 +8 · 心得 +4',
        result: '你谢绝了贺客，只留弟子们在殿里听你讲了一夜的剑理。',
        effects: [{ daoHeart: 8, insight: 4 }],
      },
    ],
  },
  {
    id: 'era_sanctum',
    tier: 3,
    risk: 'middle',
    title: '万古圣地 · 域界大比',
    kicker: '宗门 · 纪年',
    text: '青云宗位列万古圣地。这一回，整个域界的宗门都递上了拜帖，要与你家争一争那面不传之旗。',
    priority: 95,
    when: (s) => sectRank(s.sectMerits).index >= 6,
    options: [
      {
        id: 'fight',
        label: '依剑出战',
        hint: '声望 +25 · 心得 +8 · 道心 +4',
        result: '你在云台之巅站了三天。战过十七场，最后一场，对方自己认了输。',
        effects: [{ reputation: 25, insight: 8, daoHeart: 4 },
          { artifact: 'sanctum_seal' }],
      },
      {
        id: 'host',
        label: '作东设擂',
        hint: '声望 +18 · 灵石 -40 · 道心 +6',
        result: '青云宗做东道主，摆下百丈擂台。域界高手来了个遍，山门成了天下人的山门。',
        effects: [{ reputation: 18, stones: -40, daoHeart: 6 },
          { flag: { key: 'era_sanctum_done', value: true } },
          { artifact: 'sanctum_seal' }],
      },
    ],
  },
];

export const RECALL_EVENTS: StoryEvent[] = baseDisciples.map((d) => ({
  id: `recall_${d.id}`,
  tier: 2,
  risk: 'middle',
  title: `${d.name} · 山外`,
  kicker: '寻回 · 宗门',
  text: `${d.name}离山之后，坊市里偶尔有人提起：有个${d.role}在镇口卖艺、替人代写书信。山门始终虚掩着。`,
  priority: 85,
  when: (s) => (s.departed ?? []).includes(d.id) && !s.flags[`recalled_${d.id}`],
  options: [
    {
      id: 'seek',
      label: '亲自去寻',
      hint: `灵石 -30 · ${d.name}归来`,
      result: `你在雨里等了半宿，${d.name}最后是跟着你的灯笼回来的。`,
      effects: [
        { stones: -30, recall: d.id, bond: { id: d.id, delta: 10 }, mood: { id: d.id, delta: 5 }, flag: { key: `recalled_${d.id}`, value: true } },
      ],
      requires: (s) => s.resources.stones >= 30,
      requireText: '灵石不足',
    },
    {
      id: 'send',
      label: '派人去请',
      hint: `灵石 -15 · ${d.name}归来（忠心略低）`,
      result: `派去的人回来了，身后跟着${d.name}，脸色不太好看。`,
      effects: [
        { stones: -15, recall: d.id, bond: { id: d.id, delta: -5 }, mood: { id: d.id, delta: -5 }, flag: { key: `recalled_${d.id}`, value: true } },
      ],
      requires: (s) => s.resources.stones >= 15,
      requireText: '灵石不足',
    },
    {
      id: 'letgo',
      label: '是缘是劫都好',
      hint: '道心 +3 · 就此作罢',
      result: '你把山门掩上。有些因果，强留也无用。',
      effects: [{ daoHeart: 3, flag: { key: `recalled_${d.id}`, value: true } }],
    },
  ],
}));

export const ALL_EVENTS = [...STORY_EVENTS, ...PERSONAL_EVENTS, ...RANDOM_EVENTS];

export function getEvent(id: string): StoryEvent | undefined {
  if (id === 'prologue') return PROLOGUE;
  if (id === 'tournament') return STORY_EVENTS.find((e) => e.id === 'tournament');
  return ALL_EVENTS.find((e) => e.id === id) ?? FREE_EVENTS.find((e) => e.id === id) ?? ARC_EVENTS.find((e) => e.id === id) ?? DEMON_EVENTS.find((e) => e.id === id) ?? ERA_EVENTS.find((e) => e.id === id) ?? RECALL_EVENTS.find((e) => e.id === id);
}
