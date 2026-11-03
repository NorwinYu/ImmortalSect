import type { Resources } from './state';

export type BuildingId =
  | 'dorm'
  | 'field'
  | 'alchemy'
  | 'sword'
  | 'library'
  | 'kitchen'
  | 'store'
  | 'array';

export interface BuildingDef {
  id: BuildingId;
  name: string;
  subtitle: string;
  description: string;
  plot: { x: number; z: number };
  half: { x: number; z: number };
  maxLevel: number;
  baseLevel: number;
  costs: Array<Partial<Resources>>;
  days: number[];
  effects: string[];
  accent: string;
}

export interface BuildingState {
  level: number;
  construction: number;
}

export const BUILDINGS: BuildingDef[] = [
  {
    id: 'dorm',
    name: '弟子居',
    subtitle: '居所 · 道心',
    description: '弟子起居的院落。住得安稳，道心才稳。',
    plot: { x: -24, z: 12 },
    half: { x: 4.5, z: 2.8 },
    maxLevel: 3,
    baseLevel: 1,
    costs: [
      { stones: 40, herbs: 10 },
      { stones: 100, herbs: 20 },
      { stones: 180, herbs: 30, insight: 8 },
    ],
    days: [1, 2, 3],
    effects: ['道心 +1/日', '道心 +2/日', '道心 +3/日'],
    accent: '#c8a15a',
  },
  {
    id: 'field',
    name: '灵田',
    subtitle: '灵田 · 药材',
    description: '引山泉灌田，种灵谷与药材。',
    plot: { x: 24, z: 12 },
    half: { x: 5, z: 3.2 },
    maxLevel: 3,
    baseLevel: 1,
    costs: [
      { stones: 30, herbs: 10 },
      { stones: 90, herbs: 25 },
      { stones: 160, herbs: 40, insight: 6 },
    ],
    days: [1, 2, 3],
    effects: ['药材 +2/日', '药材 +4/日', '药材 +6/日'],
    accent: '#8fb98b',
  },
  {
    id: 'alchemy',
    name: '丹房',
    subtitle: '丹房 · 炼丹',
    description: '炉火不熄，丹香不散。炼丹时省药材。',
    plot: { x: 30, z: 4 },
    half: { x: 3.6, z: 3 },
    maxLevel: 3,
    baseLevel: 0,
    costs: [
      { stones: 60, herbs: 15 },
      { stones: 120, herbs: 30 },
      { stones: 200, herbs: 45, insight: 10 },
    ],
    days: [2, 2, 3],
    effects: ['炼丹省药材 3', '炼丹省药材 6', '炼丹省药材 9'],
    accent: '#d08a5a',
  },
  {
    id: 'sword',
    name: '剑坪',
    subtitle: '剑坪 · 修行',
    description: '剑修练剑的石坪。掌门在此打坐，修为更稳。',
    plot: { x: -30, z: 4 },
    half: { x: 4.5, z: 3.6 },
    maxLevel: 3,
    baseLevel: 1,
    costs: [
      { stones: 50, herbs: 5 },
      { stones: 110, insight: 8 },
      { stones: 190, insight: 16 },
    ],
    days: [1, 2, 3],
    effects: ['打坐修为 +1', '打坐修为 +2', '打坐修为 +3'],
    accent: '#9fc7d8',
  },
  {
    id: 'library',
    name: '藏经阁',
    subtitle: '藏经阁 · 心得',
    description: '收残卷、抄经、参悟。阁楼越高，心越静。',
    plot: { x: 24, z: -16 },
    half: { x: 3.2, z: 3.2 },
    maxLevel: 3,
    baseLevel: 0,
    costs: [
      { stones: 70, insight: 6 },
      { stones: 140, insight: 12 },
      { stones: 220, insight: 20 },
    ],
    days: [2, 3, 3],
    effects: ['心得 +1/日', '心得 +2/日', '心得 +3/日'],
    accent: '#9a8fc7',
  },
  {
    id: 'kitchen',
    name: '膳堂',
    subtitle: '膳堂 · 道心',
    description: '热饭热汤。弟子吃得饱，才愿意留下。',
    plot: { x: -24, z: -16 },
    half: { x: 3.8, z: 2.8 },
    maxLevel: 3,
    baseLevel: 1,
    costs: [
      { stones: 30, herbs: 15 },
      { stones: 80, herbs: 30 },
      { stones: 150, herbs: 45 },
    ],
    days: [1, 2, 2],
    effects: ['道心 +1/日', '道心 +2/日', '道心 +3/日'],
    accent: '#d0b070',
  },
  {
    id: 'store',
    name: '库房',
    subtitle: '库房 · 灵石',
    description: '存灵石、药材与旧物。仓廪实，心里不慌。',
    plot: { x: 34, z: 14 },
    half: { x: 3.2, z: 3.2 },
    maxLevel: 3,
    baseLevel: 1,
    costs: [
      { stones: 35, herbs: 5 },
      { stones: 90, herbs: 15 },
      { stones: 160, herbs: 25, insight: 5 },
    ],
    days: [1, 2, 3],
    effects: ['灵石 +1/日', '灵石 +2/日', '灵石 +3/日'],
    accent: '#b8a078',
  },
  {
    id: 'array',
    name: '聚灵阵',
    subtitle: '聚灵阵 · 修炼',
    description: '以灵石为眼，引山门灵气。阵成，全宗受益。',
    plot: { x: 0, z: -30 },
    half: { x: 4.2, z: 4.2 },
    maxLevel: 3,
    baseLevel: 0,
    costs: [
      { stones: 90, insight: 8 },
      { stones: 170, insight: 16 },
      { stones: 260, insight: 28 },
    ],
    days: [2, 3, 4],
    effects: ['掌门修炼 +2/日', '掌门修炼 +4/日', '掌门修炼 +6/日'],
    accent: '#8fd0c4',
  },
];

/** Roles that get an extra bonus when posted to each building. */
export const POST_SPECIALTY: Record<BuildingId, string[]> = {
  dorm: ['医修', '杂役'],
  field: ['丹修', '杂役'],
  alchemy: ['丹修'],
  sword: ['剑修'],
  library: ['剑修', '体修'],
  kitchen: ['医修', '杂役'],
  store: ['无灵根', '杂役'],
  array: ['剑修', '体修'],
};

export function isPostSpecialist(id: BuildingId, role: string): boolean {
  return POST_SPECIALTY[id]?.includes(role) ?? false;
}

export const BUILDING_BY_ID: Record<BuildingId, BuildingDef> = BUILDINGS.reduce(
  (acc, b) => {
    acc[b.id] = b;
    return acc;
  },
  {} as Record<BuildingId, BuildingDef>,
);

export function initialBuildings(): Record<BuildingId, BuildingState> {
  return BUILDINGS.reduce(
    (acc, b) => {
      acc[b.id] = { level: b.baseLevel, construction: 0 };
      return acc;
    },
    {} as Record<BuildingId, BuildingState>,
  );
}

export function nextCost(def: BuildingDef, level: number): Partial<Resources> | null {
  if (level >= def.maxLevel) return null;
  return def.costs[Math.max(0, Math.min(def.costs.length - 1, level))];
}

export function nextDays(def: BuildingDef, level: number): number {
  return def.days[Math.max(0, Math.min(def.days.length - 1, level))];
}

export function buildingEffect(def: BuildingDef, level: number): string {
  if (level <= 0) return '尚未修建';
  return def.effects[Math.max(0, Math.min(def.effects.length - 1, level - 1))];
}
