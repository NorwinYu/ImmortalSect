import type { GameState, StoryEvent } from './state';
import { EXTRA_ARC_EVENTS } from './arcs-extra';

function arc(s: GameState, id: string): number {
  return Number(s.flags[id] ?? 0);
}

export const ARC_EVENTS: StoryEvent[] = [
  ...EXTRA_ARC_EVENTS,
  // ————————————————— 沈青梧 · 灭门 —————————————————
  {
    id: 'shen_arc_1',
    title: '旧剑穗',
    kicker: '人物线 · 沈青梧',
    text:
      '剑冢最深处多了一柄没有名的断剑。剑穗是旧的，织着半朵青梧花。\n' +
      '沈青梧站在碑前，没有拔剑。她说，这柄剑是她父亲的。',
    priority: 40,
    when: (s) => s.freeMode && arc(s, 'shenArc') === 0,
    options: [
      {
        id: 'ask',
        label: '问她',
        hint: '忠诚 +10 · 心得 +2',
        result:
          '她没有哭，只是把剑穗解下来，放在你手心。\n' +
          '“我本来姓沈。青云宗上一代宗主，杀了我全家。”\n' +
          '“我留下来，是想看看你和他有什么不同。”',
        effects: [
          { bond: { id: 'shen', delta: 10 }, insight: 2, daoHeart: 2 },
          { flag: { key: 'shenArc', value: 1 } },
          { flag: { key: 'shenChoice', value: 'ask' } },
        ],
      },
      {
        id: 'bury',
        label: '替她把剑埋回去',
        hint: '忠诚 +5 · 道心 +3',
        result:
          '你接过断剑，把它重新埋回碑下。\n' +
          '沈青梧看了你很久，最后说：“你不问，是给我留了退路。”',
        effects: [
          { bond: { id: 'shen', delta: 5 }, morale: 3, flag: { key: 'shenArc', value: 1 } },
          { flag: { key: 'shenChoice', value: 'bury' } },
        ],
      },
      {
        id: 'keep',
        label: '收起剑穗',
        hint: '心得 +5 · 声望 +2 · 忠诚 -5',
        result:
          '你把剑穗收进袖中。她看见了，没有阻止。\n' +
          '“宗主，你最好别用它来试探我。”',
        effects: [
          { insight: 5, reputation: 2, bond: { id: 'shen', delta: -5 }, flag: { key: 'shenArc', value: 1 } },
          { flag: { key: 'shenChoice', value: 'keep' } },
        ],
      },
    ],
  },
  {
    id: 'shen_arc_2',
    title: '夜访',
    kicker: '人物线 · 沈青梧',
    text:
      '夜里，一个戴斗笠的人在剑坪等她。\n' +
      '他带来半块旧玉：青云宗上一代宗主灭沈家满门时，山门阵的阵眼。\n' +
      '沈青梧没有接玉，只看着你。',
    priority: 50,
    when: (s) => s.freeMode && arc(s, 'shenArc') === 1,
    options: [
      {
        id: 'trust',
        label: '让她自己决定',
        hint: '忠诚 +10 · 道心 +3',
        result:
          '她让斗笠人把玉留下，然后当着他的面把玉按进你手里。\n' +
          '“我信的不是青云宗。是你。”\n' +
          '斗笠人走时，山门的灯灭了一盏。',
        effects: [
          { bond: { id: 'shen', delta: 10 }, daoHeart: 3, flag: { key: 'shenArc', value: 2 } },
          { flag: { key: 'shenChoice2', value: 'trust' } },
        ],
      },
      {
        id: 'investigate',
        label: '扣下斗笠人',
        hint: '心得 +5 · 声望 +2',
        result:
          '你扣下斗笠人，问了三夜。\n' +
          '他说上一代宗主确实做过那件事，也知道沈青梧还活着。\n' +
          '沈青梧在门外听完了全部。',
        effects: [
          { insight: 5, reputation: 2, bond: { id: 'shen', delta: 3 }, flag: { key: 'shenArc', value: 2 } },
          { flag: { key: 'shenChoice2', value: 'investigate' } },
        ],
      },
      {
        id: 'expel',
        label: '赶走斗笠人',
        hint: '忠诚 -10 · 道心 -3',
        result:
          '你让巡山弟子把斗笠人赶下山。\n' +
          '沈青梧没有拦，只说：“你连听都不敢听。”\n' +
          '那一夜，剑坪的灯亮到天明。',
        effects: [
          { bond: { id: 'shen', delta: -10 }, morale: -3, flag: { key: 'shenArc', value: 2 } },
          { flag: { key: 'shenChoice2', value: 'expel' } },
        ],
      },
    ],
  },
  {
    id: 'shen_arc_3',
    title: '剑冢问心',
    kicker: '人物线 · 沈青梧',
    text:
      '沈青梧在剑冢摆了两柄剑。\n' +
      '一柄是她父亲的断剑，一柄是青云宗的旧剑。\n' +
      '“今天你选一柄。我也选一柄。”',
    priority: 60,
    when: (s) => s.freeMode && arc(s, 'shenArc') === 2,
    options: [
      {
        id: 'apologize',
        label: '替上一代宗主道歉',
        hint: '忠诚 +15 · 道心 +5',
        result:
          '你跪下，替一个死人道歉。\n' +
          '沈青梧没有扶你。她把父亲的断剑留在碑前，拿起青云宗的旧剑。\n' +
          '“我不原谅他。但我留下。”',
        effects: [
          { bond: { id: 'shen', delta: 15 }, morale: 5, daoHeart: 3, flag: { key: 'shenArc', value: 3 } },
          { flag: { key: 'shenStay', value: true } },
        ],
      },
      {
        id: 'letgo',
        label: '让她走',
        hint: '沈青梧离开 · 道心 +2',
        result:
          '你替她打开山门。\n' +
          '她走到石阶下，回头看了一眼剑冢，没有回头看你。\n' +
          '“青云宗欠沈家的，今天两清。”',
        effects: [
          { leave: 'shen', daoHeart: 2, flag: { key: 'shenArc', value: 3 } },
          { flag: { key: 'shenGone', value: true } },
        ],
      },
      {
        id: 'bind',
        label: '把两柄剑都收走',
        hint: '声望 +6 · 忠诚 -15 · 道心 -4',
        result:
          '你把两柄剑都收进库房。\n' +
          '沈青梧看着空了的剑架，笑了一下。\n' +
          '“宗主，你比我父亲还像宗主。”',
        effects: [
          { reputation: 6, bond: { id: 'shen', delta: -15 }, daoHeart: -4, flag: { key: 'shenArc', value: 3 } },
          { flag: { key: 'shenResent', value: true } },
        ],
      },
    ],
  },

  // ————————————————— 顾长风 · 夺权 —————————————————
  {
    id: 'gu_arc_1',
    title: '大比之后',
    kicker: '人物线 · 顾长风',
    text:
      '大比结束的第二天，顾长风把七名弟子叫到主殿。\n' +
      '“宗门不能只靠宗主一个人撑着。我要一个副宗主的位置。”\n' +
      '他没有看你，但所有人都在看你。',
    priority: 40,
    when: (s) => s.freeMode && arc(s, 'guArc') === 0,
    options: [
      {
        id: 'share',
        label: '给他副宗主',
        hint: '忠诚 +10 · 道心 +2',
        result:
          '你把副宗主的印交给他。\n' +
          '顾长风接印时手很稳，只说了一句：“我不会让你后悔。”',
        effects: [
          { bond: { id: 'gu', delta: 10 }, morale: 2, flag: { key: 'guArc', value: 1 } },
          { flag: { key: 'guChoice', value: 'share' } },
        ],
      },
      {
        id: 'refuse',
        label: '当众拒绝',
        hint: '声望 +3 · 忠诚 -10',
        result:
          '你说宗门只有一个宗主。\n' +
          '顾长风没有争辩，只是把剑放回架上，转身出了主殿。\n' +
          '从那天起，他不再最后一个走。',
        effects: [
          { reputation: 3, bond: { id: 'gu', delta: -10 }, flag: { key: 'guArc', value: 1 } },
          { flag: { key: 'guChoice', value: 'refuse' } },
        ],
      },
      {
        id: 'duel',
        label: '按宗门旧规矩，试剑',
        hint: '需试剑胜场 · 声望 +5 · 忠诚 -15',
        result:
          '你们在试剑台打了三十招。\n' +
          '他输了半式，收剑时很平静：“我认。”\n' +
          '但你知道，他认的是剑，不是你。',
        effects: [
          { reputation: 5, bond: { id: 'gu', delta: -15 }, flag: { key: 'guArc', value: 1 } },
          { flag: { key: 'guChoice', value: 'duel' } },
        ],
        requires: (s) => s.trialWins > 0,
        requireText: '需要至少一场试剑胜场',
      },
    ],
  },
  {
    id: 'gu_arc_2',
    title: '私会',
    kicker: '人物线 · 顾长风',
    text:
      '巡山弟子看见顾长风夜里下山，在坊市后巷见了一个穿别宗服色的人。\n' +
      '他回来时，袖口沾着酒，也沾着一点香灰。',
    priority: 50,
    when: (s) => s.freeMode && arc(s, 'guArc') === 1,
    options: [
      {
        id: 'trust',
        label: '把话摊开',
        hint: '忠诚 +10 · 心得 +2',
        result:
          '他承认有别的宗门来挖他。\n' +
          '“我没答应。但我想听你怎么说。”\n' +
          '你把茶推过去，他把那家的信放在桌上，没有拆。',
        effects: [
          { bond: { id: 'gu', delta: 10 }, insight: 2, flag: { key: 'guArc', value: 2 } },
          { flag: { key: 'guChoice2', value: 'trust' } },
        ],
      },
      {
        id: 'expose',
        label: '当众查他',
        hint: '声望 +5 · 道心 -4 · 忠诚 -15',
        result:
          '你在晨会上让人搜了他的屋子。\n' +
          '信搜出来了，他也站在了所有人面前。\n' +
          '“宗主，你查的不是信。是我的心。”',
        effects: [
          { reputation: 5, morale: -4, bond: { id: 'gu', delta: -15 }, flag: { key: 'guArc', value: 2 } },
          { flag: { key: 'guChoice2', value: 'expose' } },
        ],
      },
      {
        id: 'compromise',
        label: '给他一笔灵石，让他自己去断',
        hint: '灵石 -30 · 忠诚 +5',
        result:
          '他收了灵石，第二天把一袋聘礼原封不动退回了山下。\n' +
          '“这回算你买我一次。下回不一定。”',
        effects: [
          { stones: -30, bond: { id: 'gu', delta: 5 }, flag: { key: 'guArc', value: 2 } },
          { flag: { key: 'guChoice2', value: 'compromise' } },
        ],
      },
    ],
  },
  {
    id: 'gu_arc_3',
    title: '山门之夜',
    kicker: '人物线 · 顾长风',
    text:
      '顾长风在主殿等到所有人都走了。\n' +
      '桌上放着副宗主的印，和一封没封口的信。\n' +
      '“宗主，今天你得给我一个准话。”',
    priority: 60,
    when: (s) => s.freeMode && arc(s, 'guArc') === 2,
    options: [
      {
        id: 'reconcile',
        label: '把印留给他',
        hint: '忠诚 +15 · 道心 +4',
        result:
          '你把印推回去。\n' +
          '他看了很久，最后把信收进袖中。\n' +
          '“行。青云宗的事，我替你扛一半。”',
        effects: [
          { bond: { id: 'gu', delta: 15 }, morale: 5, daoHeart: 2, flag: { key: 'guArc', value: 3 } },
          { flag: { key: 'guStay', value: true } },
        ],
      },
      {
        id: 'exile',
        label: '让他下山',
        hint: '顾长风离开 · 声望 +4 · 道心 -3',
        result:
          '他没有求情。\n' +
          '走到山门时，他回头看了一眼主殿的灯。\n' +
          '“你一个人扛得住，就当我没来过。”',
        effects: [
          { leave: 'gu', reputation: 4, morale: -3, flag: { key: 'guArc', value: 3 } },
          { flag: { key: 'guGone', value: true } },
        ],
      },
      {
        id: 'demote',
        label: '收印，留人',
        hint: '声望 +3 · 忠诚 -15',
        result:
          '你把印收回，让他去做巡山执事。\n' +
          '“行。”他只说了这一个字。\n' +
          '此后他巡山很勤，但再没进过主殿。',
        effects: [
          { reputation: 3, bond: { id: 'gu', delta: -15 }, flag: { key: 'guArc', value: 3 } },
          { flag: { key: 'guDemoted', value: true } },
        ],
      },
    ],
  },

  // ————————————————— 陆小满 · 天灵根 —————————————————
  {
    id: 'lu_arc_1',
    title: '灵根觉醒',
    kicker: '人物线 · 陆小满',
    text:
      '陆小满在药圃晕倒。苏晚照诊了三次，才敢开口：\n' +
      '“天灵根。而且是极纯的那种。”\n' +
      '整个山门都听见了。',
    priority: 40,
    when: (s) => s.freeMode && arc(s, 'luArc') === 0,
    options: [
      {
        id: 'protect',
        label: '封锁消息，护住他',
        hint: '忠诚 +10 · 药材 -10 · 道心 +2',
        result:
          '你让苏晚照把药圃的门关了三天。\n' +
          '陆小满醒来时第一句话是：“宗主，我是不是给你惹麻烦了？”',
        effects: [
          { herbs: -10, bond: { id: 'lu', delta: 10 }, morale: 2, flag: { key: 'luArc', value: 1 } },
          { flag: { key: 'luChoice', value: 'protect' } },
        ],
      },
      {
        id: 'hide',
        label: '让他自己选说不说',
        hint: '心得 +5 · 忠诚 +5',
        result:
          '他把自己的灵根说给每个来问的人听，语气像在说别人的事。\n' +
          '“藏不住的。藏住了，他们也会猜。”',
        effects: [
          { insight: 5, bond: { id: 'lu', delta: 5 }, flag: { key: 'luArc', value: 1 } },
          { flag: { key: 'luChoice', value: 'hide' } },
        ],
      },
      {
        id: 'announce',
        label: '昭告山下',
        hint: '声望 +8 · 道心 -2',
        result:
          '青云宗出了天灵根的消息，三天传遍三宗。\n' +
          '来道贺的人很多，带剑来的也不少。',
        effects: [
          { reputation: 8, morale: -2, flag: { key: 'luArc', value: 1 } },
          { flag: { key: 'luChoice', value: 'announce' } },
        ],
      },
    ],
  },
  {
    id: 'lu_arc_2',
    title: '大宗来使',
    kicker: '人物线 · 陆小满',
    text:
      '天剑宗来了一位长老。\n' +
      '他带来一箱灵石和一枚内门令，说陆小满这样的根骨，留在青云宗是浪费。',
    priority: 50,
    when: (s) => s.freeMode && arc(s, 'luArc') === 1,
    options: [
      {
        id: 'refuse',
        label: '回绝',
        hint: '声望 -5 · 忠诚 +10',
        result:
          '你把内门令推回去。\n' +
          '长老走时留下一句话：“青云宗护不住他。”\n' +
          '陆小满在门外听见了，没说话，只是把剑握得更紧。',
        effects: [
          { reputation: -5, bond: { id: 'lu', delta: 10 }, morale: 2, flag: { key: 'luArc', value: 2 } },
          { flag: { key: 'luChoice2', value: 'refuse' } },
        ],
      },
      {
        id: 'negotiate',
        label: '谈条件',
        hint: '灵石 +80 · 声望 +4 · 忠诚 -5',
        result:
          '你收下灵石，答应每年让陆小满去天剑宗听三个月课。\n' +
          '长老笑了。陆小满没笑。',
        effects: [
          { stones: 80, reputation: 4, bond: { id: 'lu', delta: -5 }, flag: { key: 'luArc', value: 2 } },
          { flag: { key: 'luChoice2', value: 'negotiate' } },
        ],
      },
      {
        id: 'letgo',
        label: '让他去',
        hint: '陆小满离开 · 灵石 +120 · 声望 +6',
        result:
          '你替他收拾了行李。\n' +
          '他站在山门口，忽然问：“宗主，你是因为我留下，还是因为青云宗需要我留下？”\n' +
          '你没有回答。他走了。',
        effects: [
          { leave: 'lu', stones: 120, reputation: 6, flag: { key: 'luArc', value: 3 } },
          { flag: { key: 'luGone', value: true } },
          { flag: { key: 'luChoice2', value: 'letgo' } },
        ],
      },
    ],
  },
  {
    id: 'lu_arc_3',
    title: '去留',
    kicker: '人物线 · 陆小满',
    text:
      '陆小满把内门令放在你桌上。\n' +
      '“天剑宗给的条件很好。苏姐姐说，我该去。顾师兄说，我该留。”\n' +
      '“宗主，你说呢？”',
    priority: 60,
    when: (s) => s.freeMode && arc(s, 'luArc') === 2 && s.disciples.some((d) => d.id === 'lu' && d.active),
    options: [
      {
        id: 'stay',
        label: '留下',
        hint: '忠诚 +15 · 道心 +4',
        result:
          '你把内门令扔进火盆。\n' +
          '陆小满看着火，忽然笑了：“那我就不走了。”\n' +
          '“不过宗主，你欠我一个更大的山门。”',
        effects: [
          { bond: { id: 'lu', delta: 15 }, morale: 5, daoHeart: 3, flag: { key: 'luArc', value: 3 } },
          { flag: { key: 'luStay', value: true } },
        ],
      },
      {
        id: 'seek',
        label: '让他去天剑宗',
        hint: '陆小满离开 · 声望 +5',
        result:
          '你替他系好行囊，送到山门。\n' +
          '“学成了，回来看看。”\n' +
          '“嗯。”他应得很轻，但走得很稳。',
        effects: [
          { leave: 'lu', reputation: 5, flag: { key: 'luArc', value: 3 } },
          { flag: { key: 'luGone', value: true } },
        ],
      },
      {
        id: 'test',
        label: '让他自己选',
        hint: '心得 +4 · 忠诚 +5',
        result:
          '你把内门令推回给他，没有说一个字。\n' +
          '他在桌前坐到天亮，最后把令牌收进怀里。\n' +
          '“我留下。但我不是因为青云宗。”',
        effects: [
          { insight: 4, bond: { id: 'lu', delta: 5 }, flag: { key: 'luArc', value: 3 } },
          { flag: { key: 'luStay', value: true } },
        ],
      },
    ],
  },
];

export function nextArcEvent(state: GameState): StoryEvent | null {
  const eligible = ARC_EVENTS.filter((e) => e.when(state));
  eligible.sort((a, b) => b.priority - a.priority);
  return eligible[0] ?? null;
}

export function arcProgress(state: GameState): { done: number; total: number } {
  const total = 21;
  const done =
    Math.min(3, Number(state.flags.shenArc ?? 0)) +
    Math.min(3, Number(state.flags.guArc ?? 0)) +
    Math.min(3, Number(state.flags.luArc ?? 0)) +
    Math.min(3, Number(state.flags.suArc ?? 0)) +
    Math.min(3, Number(state.flags.baiArc ?? 0)) +
    Math.min(3, Number(state.flags.qiArc ?? 0)) +
    Math.min(3, Number(state.flags.xuanArc ?? 0));
  return { done, total };
}

export function allArcsDone(state: GameState): boolean {
  return arcProgress(state).done >= 21;
}

export function arcSummary(state: GameState): string[] {
  const out: string[] = [];
  if (Number(state.flags.shenArc ?? 0) >= 3) {
    out.push(state.flags.shenStay ? '沈青梧留在剑冢，替你守着青云宗最早的剑。' : state.flags.shenGone ? '沈青梧离开了青云宗，剑冢再没有青梧花。' : '沈青梧留下了，但她不再拔那柄旧剑。');
  }
  if (Number(state.flags.guArc ?? 0) >= 3) {
    out.push(state.flags.guStay ? '顾长风接过了副宗主的印，主殿的灯终于有人分担。' : state.flags.guGone ? '顾长风下了山，山门再没响起他的剑。' : '顾长风仍在巡山，但他不再进主殿。');
  }
  if (Number(state.flags.luArc ?? 0) >= 3) {
    out.push(state.flags.luStay ? '陆小满留在了青云宗，天灵根终于长在自己的山里。' : state.flags.luGone ? '陆小满去了天剑宗，山门少了一个背药篓的影子。' : '陆小满把内门令收了起来，谁也不知道他最后怎么选。');
  }
  if (Number(state.flags.suArc ?? 0) >= 3) {
    out.push(state.flags.suStay ? '苏晚照在青云宗开了一间“青云”药堂，婚书早已成了灰。' : state.flags.suGone ? '苏晚照下山自立门户，铺子里的药香，隔着一条街都能闻见。' : '苏晚照退了婚，却把包袱一直放在山门口。');
  }
  if (Number(state.flags.baiArc ?? 0) >= 3) {
    out.push(state.flags.baiStay ? '白芷留在了药庐，月圆之夜，她腕上的旧疤不再发烫。' : state.flags.baiGone ? '白芷远走避祸，山门少了一炉春雪。' : '白芷仍守着药庐，只是不再锁门。');
  }
  if (Number(state.flags.qiArc ?? 0) >= 3) {
    out.push(state.flags.qiStay ? '阿七留在了青云宗，天生道体的眼睛只肯替自家山门看灵气。' : state.flags.qiGone ? '阿七去了大宗门，临行前说要偷剑谱回来。' : '阿七抱着认祖归宗的文书，到底没舍得走。');
  }
  if (Number(state.flags.xuanArc ?? 0) >= 3) {
    out.push(state.flags.xuanStay ? '玄真继续为青云宗守夜敲钟，也继续守着那个秘密。' : state.flags.xuanGone ? '玄真下山了，山门的钟，再无人敲得那样沉稳。' : '玄真把守夜人的钟留在了偏殿。');
  }
  return out;
}
