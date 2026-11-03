import type { GameState } from './state';

/**
 * Achievements (成就) — light meta-progression that makes a run feel like it
 * is "filling in" rather than just drifting. Checks are pure predicates over
 * `GameState`, so they can be re-evaluated at any save point.
 */
export interface Achievement {
  id: string;
  name: string;
  desc: string;
  /** Show as ??? until unlocked. */
  secret?: boolean;
  check: (s: GameState) => boolean;
  /** Optional numeric progress for the panel. */
  progress?: (s: GameState) => { have: number; need: number };
}

const ARC_IDS = ['shen', 'gu', 'lu', 'su', 'bai', 'qi', 'xuan'] as const;
const BUILDING_IDS = ['dorm', 'field', 'alchemy', 'sword', 'library', 'kitchen', 'store', 'array'] as const;
const ERA_IDS = ['era_three', 'era_two', 'era_first', 'era_famous', 'era_hegemon', 'era_sanctum'];

export function arcScenesDone(s: GameState): number {
  return ARC_IDS.reduce((sum, id) => sum + Math.min(3, Number(s.flags[`${id}Arc`] ?? 0)), 0);
}

export function arcsFinished(s: GameState): number {
  return ARC_IDS.filter((id) => Number(s.flags[`${id}Arc`] ?? 0) >= 3).length;
}

export function buildingsRaised(s: GameState): number {
  return BUILDING_IDS.filter((id) => (s.buildings[id]?.level ?? 0) >= 1).length;
}

export function topBuildingLevel(s: GameState): number {
  return Math.max(0, ...BUILDING_IDS.map((id) => s.buildings[id]?.level ?? 0));
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_days',
    name: '山中三日',
    desc: '在山门里过完三日。',
    check: (s) => s.day >= 4,
    progress: (s) => ({ have: Math.min(3, s.day - 1), need: 3 }),
  },
  {
    id: 'merit_80',
    name: '二流气象',
    desc: '宗门功业达到 80。',
    check: (s) => s.sectMerits >= 80,
    progress: (s) => ({ have: Math.min(80, s.sectMerits), need: 80 }),
  },
  {
    id: 'merit_240',
    name: '一方名门',
    desc: '宗门功业达到 240。',
    check: (s) => s.sectMerits >= 240,
    progress: (s) => ({ have: Math.min(240, s.sectMerits), need: 240 }),
  },
  {
    id: 'merit_500',
    name: '万古圣地',
    desc: '宗门功业达到 500，位列万古圣地。',
    check: (s) => s.sectMerits >= 500,
    progress: (s) => ({ have: Math.min(500, s.sectMerits), need: 500 }),
  },
  {
    id: 'build_all',
    name: '八栋齐全',
    desc: '让山门里的八栋建筑全部落成。',
    check: (s) => buildingsRaised(s) >= 8,
    progress: (s) => ({ have: buildingsRaised(s), need: 8 }),
  },
  {
    id: 'build_max',
    name: '匠心独运',
    desc: '把任意一栋建筑升到最高级。',
    check: (s) => topBuildingLevel(s) >= 3,
    progress: (s) => ({ have: topBuildingLevel(s), need: 3 }),
  },
  {
    id: 'realm_5',
    name: '筑基之上',
    desc: '掌门修为踏入第五境。',
    check: (s) => s.player.realmIndex >= 5,
    progress: (s) => ({ have: Math.min(5, s.player.realmIndex), need: 5 }),
  },
  {
    id: 'realm_8',
    name: '金丹在握',
    desc: '掌门修为踏入第八境。',
    check: (s) => s.player.realmIndex >= 8,
    progress: (s) => ({ have: Math.min(8, s.player.realmIndex), need: 8 }),
  },
  {
    id: 'realm_10',
    name: '此界尽头',
    desc: '走到此界最后一境。',
    check: (s) => s.player.realmIndex >= 10,
    progress: (s) => ({ have: Math.min(10, s.player.realmIndex), need: 10 }),
  },
  {
    id: 'tribulation',
    name: '渡劫客',
    desc: '第一次渡天劫成功。',
    check: (s) => Number(s.flags.tribWins ?? 0) >= 1,
    progress: (s) => ({ have: Number(s.flags.tribWins ?? 0), need: 1 }),
  },
  {
    id: 'trial_1',
    name: '试剑初胜',
    desc: '第一次击破试剑傀儡。',
    check: (s) => s.trialWins >= 1,
    progress: (s) => ({ have: Math.min(1, s.trialWins), need: 1 }),
  },
  {
    id: 'trial_3',
    name: '三胜金令',
    desc: '三次击破试剑傀儡。',
    check: (s) => s.trialWins >= 3,
    progress: (s) => ({ have: Math.min(3, s.trialWins), need: 3 }),
  },
  {
    id: 'arc_1',
    name: '一诺既定',
    desc: '走完任意一名弟子的三段人生。',
    check: (s) => arcsFinished(s) >= 1,
    progress: (s) => ({ have: arcsFinished(s), need: 1 }),
  },
  {
    id: 'arc_all',
    name: '七人同心',
    desc: '走完全部七名弟子的人生。',
    check: (s) => arcsFinished(s) >= 7,
    progress: (s) => ({ have: arcsFinished(s), need: 7 }),
  },
  {
    id: 'demon',
    name: '破煞',
    desc: '击退山门外的魔道旧影。',
    check: (s) => Number(s.flags.demonChain ?? 0) >= 4,
  },
  {
    id: 'era_all',
    name: '六纪',
    desc: '见证宗门纪年的六段时代事件。',
    check: (s) => ERA_IDS.every((id) => s.seenEvents.includes(id)),
    progress: (s) => ({ have: ERA_IDS.filter((id) => s.seenEvents.includes(id)).length, need: 6 }),
  },
  {
    id: 'artifact_1',
    name: '得一至宝',
    desc: '获得第一件掌门法宝。',
    check: (s) => s.player.artifacts.length >= 1,
    progress: (s) => ({ have: Math.min(1, s.player.artifacts.length), need: 1 }),
  },
  {
    id: 'artifact_4',
    name: '四宝齐备',
    desc: '集齐四件掌门法宝。',
    check: (s) => s.player.artifacts.length >= 4,
    progress: (s) => ({ have: s.player.artifacts.length, need: 4 }),
  },
  {
    id: 'faith_1',
    name: '香火初用',
    desc: '第一次用香火兑换天梯上的增益。',
    check: (s) => Object.values(s.faithBought).some((v) => Number(v) >= 1),
  },
  {
    id: 'teach_1',
    name: '传法',
    desc: '给任意一名弟子传下一门功法。',
    check: (s) => s.disciples.some((d) => Boolean(d.technique)),
  },
  {
    id: 'ngo',
    name: '再入轮回',
    desc: '开始第二周目。',
    check: (s) => (s.cycle ?? 0) >= 1,
  },
  {
    id: 'chapter_end',
    name: '尘埃落定',
    desc: '走到第一章的结局。',
    check: (s) => s.seenEvents.includes('tournament'),
  },
  {
    id: 'champion',
    name: '三宗魁首',
    desc: '在三宗大比中拿下魁首。',
    check: (s) => s.flags.chapterRank === 'champion',
  },
];

export function achievementById(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((a) => a.id === id);
}

/** Ids that satisfy their condition but are not yet stored on the state. */
export function newlyUnlocked(s: GameState): string[] {
  const out: string[] = [];
  for (const a of ACHIEVEMENTS) {
    if (s.achievements.includes(a.id)) continue;
    let ok = false;
    try {
      ok = a.check(s);
    } catch {
      ok = false;
    }
    if (ok) out.push(a.id);
  }
  return out;
}
