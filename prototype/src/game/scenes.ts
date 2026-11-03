export type RegionId = 'sect' | 'swordTomb' | 'herbGarden' | 'market';

export interface RegionAction {
  id: string;
  label: string;
  description: string;
}

export interface RegionDef {
  id: RegionId;
  name: string;
  subtitle: string;
  description: string;
  spawn: { x: number; z: number };
  actionPoint?: { x: number; z: number };
  action?: RegionAction;
  accent: string;
}

export const REGIONS: RegionDef[] = [
  {
    id: 'sect',
    name: '青云山门',
    subtitle: '山门 · 宗门',
    description: '主殿、剑坪、药庐与七名弟子都在这里。宗门簿、试剑与交谈都在山门。',
    spawn: { x: 0, z: 26 },
    accent: '#c8a15a',
  },
  {
    id: 'swordTomb',
    name: '后山剑冢',
    subtitle: '剑冢 · 悟剑',
    description: '青云宗历代剑修的埋剑地。残碑、断剑与不散的剑意。',
    spawn: { x: -58, z: -15 },
    actionPoint: { x: -58, z: -19 },
    action: {
      id: 'swordMeditate',
      label: '悟剑',
      description: '在残碑前坐一炷香，心得 +4。',
    },
    accent: '#9fc7d8',
  },
  {
    id: 'herbGarden',
    name: '灵田药圃',
    subtitle: '药圃 · 采药',
    description: '山门东侧的灵田。土里还留着上一场秋雨，药香很重。',
    spawn: { x: 48, z: 13 },
    actionPoint: { x: 48, z: 10 },
    action: {
      id: 'gatherHerbs',
      label: '采药',
      description: '收一筐当季灵草，药材 +18（药庐 +6）。',
    },
    accent: '#8fb98b',
  },
  {
    id: 'market',
    name: '山门坊市',
    subtitle: '坊市 · 交易',
    description: '山下散修与行商歇脚的地方。灵石、药材与消息在这里流动。',
    spawn: { x: -48, z: 13 },
    actionPoint: { x: -48, z: 10 },
    action: {
      id: 'market',
      label: '赶集',
      description: '买药、卖药，或打听一条消息。每日一次。',
    },
    accent: '#d08a5a',
  },
];

export function regionById(id: RegionId): RegionDef {
  return REGIONS.find((r) => r.id === id) ?? REGIONS[0];
}
