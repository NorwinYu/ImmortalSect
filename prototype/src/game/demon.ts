import type { GameState, StoryEvent } from './state';

function chain(s: GameState): number {
  return Number(s.flags.demonChain ?? 0);
}

/** 魔道仇敌主线：把“灭门旧案”的暗线收束成一个跨章反派弧。 */
export const DEMON_EVENTS: StoryEvent[] = [
  {
    id: 'demon_1',
    title: '阴风乍起',
    kicker: '魔道旧影',
    text:
      '一流宗门的名头传开后，山门外开始出现不速之客。\n' +
      '深夜里，几个裹着黑斗篷的人在石阶上留了记号：一枚血色的药人牌。\n' +
      '那牌子与白芷腕上旧疤的纹路，一模一样。',
    priority: 90,
    when: (s) => s.freeMode && s.sectMerits >= 150 && chain(s) === 0,
    options: [
      {
        id: 'hunt',
        label: '连夜搜山，揪出来',
        hint: '声望 +3 · 心得 +2 · 风险',
        result:
          '你带人封了三条山道，却只找到半截烧焦的药人牌。\n' +
          '对方来得比你想的更早，也退得更干净。',
        effects: [
          { reputation: 3, insight: 2, flag: { key: 'demonChain', value: 1 } },
        ],
      },
      {
        id: 'guard',
        label: '加固山门，以静制动',
        hint: '忠诚（玄真）+5 · 道心 +2',
        result:
          '玄真领人连夜在门楣上布了辟邪的符。\n' +
          '“当年就是这一晚，放魔道进了山。”他说。',
        effects: [
          { bond: { id: 'xuan', delta: 5 }, daoHeart: 2, flag: { key: 'demonChain', value: 1 } },
        ],
      },
      {
        id: 'bait',
        label: '佯装不知，引蛇出洞',
        hint: '心得 +4',
        result:
          '你按住不动，只暗中记下他们每日点旁的时辰。\n' +
          '三天后，记号依旧，人影折返了两次。',
        effects: [
          { insight: 4, flag: { key: 'demonChain', value: 1 } },
        ],
      },
    ],
  },
  {
    id: 'demon_2',
    title: '旧主亲至',
    kicker: '魔道旧影',
    text:
      '一辆乌黑的马车停在山门。车帘掀开，是个两鬓斑白的男人。\n' +
      '“青云宗的余孽，倒养得像模像样。”\n' +
      '“把白芷交出来——或者，把沈家那柄断剑交出来。二选一。”',
    priority: 95,
    when: (s) => s.freeMode && chain(s) === 1,
    options: [
      {
        id: 'refuse',
        label: '两样都不交',
        hint: '声望 +2 · 道心 +3 · 引来决战',
        result:
          '“人和剑，都是青云宗的。”\n' +
          '那男人笑了，笑意比夜风还冷：“那就等着山门起炉。”',
        effects: [
          { reputation: 2, daoHeart: 3, flag: { key: 'demonChain', value: 2 } },
          { flag: { key: 'demonReject', value: true } },
        ],
      },
      {
        id: 'stall',
        label: '虚与委蛇，拖到明天',
        hint: '心得 +3 · 换一日备战',
        result:
          '你与他谈了一炷香，答应“考虑一夜”。\n' +
          '多出的一夜，足够布下几重禁制。',
        effects: [
          { insight: 3, flag: { key: 'demonChain', value: 2 } },
          { flag: { key: 'demonPrep', value: true } },
        ],
      },
      {
        id: 'pay',
        label: '以宗门名义买断旧怨',
        hint: '灵石 -80 · 声望 +4 · 换太平',
        result:
          '你押出八十枚灵石为当年旧债画押。\n' +
          '他掂了掂，冷笑一声：“这一笔，先记下。”',
        effects: [
          { stones: -80, reputation: 4, flag: { key: 'demonChain', value: 2 } },
          { flag: { key: 'demonPaid', value: true } },
        ],
      },
    ],
  },
  {
    id: 'demon_3',
    title: '山门夜战',
    kicker: '魔道旧影',
    text:
      '入夜，魔道众人沿山道上，阵势森严。\n' +
      '护法亲临阵前，一身煞气逼得山雾都低了三分。\n' +
      '你的剑在鞘中轻鸣，像在催你出鞘。',
    priority: 100,
    when: (s) => s.freeMode && chain(s) === 2,
    options: [
      {
        id: 'duel',
        label: '亲临阵前，与护法一战',
        hint: '以境界与剑意决一胜负',
        result:
          '你越众而出，与那护法在山阶上相对。\n' +
          '两道剑气撞在一处，惊得整座山的夜鸟四散。\n' +
          '胜了——护法败退，魔道众人如潮水般褪去。',
        check: {
          chance: (s) => 45 + s.player.realmIndex * 5 + (s.player.techniques.includes('霜刃') ? 10 : 0) + Math.floor(s.player.daoHeart / 12),
          failText: '那护法的煞气压下，你身形一晃，被震退数丈。\n' + '好在宗门众人拼死断后，才把魔道逼退——但代价惨重。',
          failEffects: [
            { playerInjury: 18, reputation: -4, daoHeart: -3, flag: { key: 'demonChain', value: 3 } },
            { flag: { key: 'demonLost', value: true } },
          ],
        },
        effects: [
          { reputation: 8, daoHeart: 5, merits: 40, bond: { id: 'gu', delta: 8 }, artifact: 'demon_tassel', flag: { key: 'demonChain', value: 3 } },
          { flag: { key: 'demonWon', value: true } },
        ],
      },
      {
        id: 'array',
        label: '依山布阵，以守为攻',
        hint: '稳妥一战 · 慧根与元气定胜负',
        result:
          '你坐镇中军，指挥七人以山势成阵。\n' +
          '禁制一道接一道亮起，把来犯之敌一步步逼下山去。\n' +
          '魔道见占不到便宜，退去前撂下一句“后会有期”。',
        check: {
          chance: (s) => 50 + Math.floor(s.player.daoHeart / 6) + (s.flags.demonPrep ? 10 : 0),
          failText: '禁制被那护法以煞气强行击穿，几处阵眼崩坏。\n' + '守住了山门，却伤得不轻。',
          failEffects: [
            { stones: -30, reputation: -2, bond: { id: 'xuan', delta: -4 }, flag: { key: 'demonChain', value: 3 } },
            { flag: { key: 'demonLost', value: true } },
          ],
        },
        effects: [
          { reputation: 6, insight: 5, merits: 30, artifact: 'demon_tassel', flag: { key: 'demonChain', value: 3 } },
          { flag: { key: 'demonWon', value: true } },
        ],
      },
      {
        id: 'summon',
        label: '燃旧故香火，唤当年援手',
        hint: '灵石 -50 · 借势退敌',
        result:
          '你以青云宗旧印，请动了山下几户受过恩的散修。\n' +
          '援手一出，魔道见势不妙，当夜便撤了个干净。',
        effects: [
          { stones: -50, reputation: 5, merits: 25, artifact: 'demon_tassel', flag: { key: 'demonChain', value: 3 } },
          { flag: { key: 'demonWon', value: true } },
        ],
      },
    ],
  },
  {
    id: 'demon_4',
    title: '尘埃落定',
    kicker: '魔道旧影',
    text:
      '魔道退了，山门的石板缝里还留着昨夜的血与灰。\n' +
      '白芷蹲在阶边，把散落的药人牌一片片拾起来，扔进火盆。\n' +
      '“这回，是真的过去了。”',
    priority: 100,
    when: (s) => s.freeMode && chain(s) === 3,
    options: [
      {
        id: 'done',
        label: '让旧事随烟散',
        hint: '声望 +6 · 道心 +5 · 功业 +30',
        result:
          '你与众人立在火盆前，看最后一片药人牌烧成灰。\n' +
          '从此，青云宗的山门再没有魔道的旧影。\n' +
          '那柄旧剑的剑穗，也终于不再系着旧仇。',
        effects: [
          { reputation: 6, daoHeart: 5, merits: 30, flag: { key: 'demonChain', value: 4 } },
        ],
      },
    ],
  },
];

export function nextDemonEvent(state: GameState): StoryEvent | null {
  const eligible = DEMON_EVENTS.filter((e) => e.when(state) && !state.seenEvents.includes(e.id));
  eligible.sort((a, b) => b.priority - a.priority);
  return eligible[0] ?? null;
}