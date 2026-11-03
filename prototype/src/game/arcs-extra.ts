import type { GameState, StoryEvent } from './state';

function arc(s: GameState, id: string): number {
  return Number(s.flags[id] ?? 0);
}

/** Second batch of character lines (苏晚照 · 白芷 · 阿七 · 玄真). */
export const EXTRA_ARC_EVENTS: StoryEvent[] = [
  // ————————————————— 苏晚照 · 婚事与药堂 —————————————————
  {
    id: 'su_arc_1',
    title: '一封婚书',
    kicker: '人物线 · 苏晚照',
    text:
      '苏家送来一封信，还附着一纸婚书。\n' +
      '信上说，苏家愿用这门亲事，向山下新开的灵矿换一点路。\n' +
      '苏晚照把信压在药臼底下，没敢拆。',
    priority: 40,
    when: (s) => s.freeMode && arc(s, 'suArc') === 0 && s.disciples.some((d) => d.id === 'su' && d.active),
    options: [
      {
        id: 'burn',
        label: '当她的面烧了',
        hint: '忠诚 +10 · 道心 +3 · 声望 -2',
        result:
          '你当着她把婚书点着。\n' +
          '“你的婚事，先问你自己。”\n' +
          '她盯着火苗看了很久，忽然说：“宗主，我想开一间自己的药堂。”',
        effects: [
          { bond: { id: 'su', delta: 10 }, reputation: -2, daoHeart: 3, flag: { key: 'suArc', value: 1 } },
        ],
      },
      {
        id: 'ask',
        label: '先问她',
        hint: '忠诚 +3 · 心得 +2',
        result:
          '你把信推到她面前。\n' +
          '“我不替你拿主意。你若不嫁，天塌下来宗门替你顶。”\n' +
          '她的眼眶红了一下。',
        effects: [
          { bond: { id: 'su', delta: 3 }, insight: 2, flag: { key: 'suArc', value: 1 } },
        ],
      },
      {
        id: 'hold',
        label: '压下来，静观其变',
        hint: '苏家态度缓和 · 忠诚 +0',
        result:
          '你回信说“再议”。\n' +
          '苏家没有再来信，但山门外的眼线多了一个。',
        effects: [
          { flag: { key: 'suArc', value: 1 } },
        ],
      },
    ],
  },
  {
    id: 'su_arc_2',
    title: '苏家上门',
    kicker: '人物线 · 苏晚照',
    text:
      '苏家主带着一箱聘礼上了山，身后还跟着两个矿上的打手。\n' +
      '“晚照嫁过去，灵矿分青云宗三成。这买卖，不亏。”',
    priority: 40,
    when: (s) => s.freeMode && arc(s, 'suArc') === 1 && s.disciples.some((d) => d.id === 'su' && d.active),
    options: [
      {
        id: 'refuse',
        label: '亮剑送客',
        hint: '声望 -3 · 忠诚 +10',
        result:
          '你拔剑架在聘礼箱上。\n' +
          '“她若愿嫁，我亲自送嫁。她若不愿，谁也别想用她做生意。”',
        effects: [
          { bond: { id: 'su', delta: 10 }, reputation: -3, flag: { key: 'suArc', value: 2 } },
        ],
      },
      {
        id: 'buy',
        label: '出灵石买断这桩亲',
        hint: '灵石 -40 · 忠诚 +12 · 声望 +2',
        result:
          '你数出四十枚灵石，押在聘礼上。\n' +
          '“苏家要的是路，不是人。”\n' +
          '苏家主盯着你，到底没敢接那柄还悬着的剑。',
        effects: [
          { stones: -40, bond: { id: 'su', delta: 12 }, reputation: 2, flag: { key: 'suArc', value: 2 } },
        ],
      },
      {
        id: 'let',
        label: '让她自己与家里谈',
        hint: '忠诚 +5',
        result:
          '你退到门外，把正堂留给她。\n' +
          '一个时辰后苏家主下山，聘礼没带走。',
        effects: [
          { bond: { id: 'su', delta: 5 }, flag: { key: 'suArc', value: 2 } },
        ],
      },
    ],
  },
  {
    id: 'su_arc_3',
    title: '去留',
    kicker: '人物线 · 苏晚照',
    text:
      '亲事退了，苏晚照却把包袱放在了山门口。\n' +
      '“宗主，山下有间空铺子。我想……自己立个门户。”',
    priority: 60,
    when: (s) => s.freeMode && arc(s, 'suArc') === 2 && s.disciples.some((d) => d.id === 'su' && d.active),
    options: [
      {
        id: 'stay',
        label: '留她在山门开坊',
        hint: '忠诚 +15 · 药材 +20',
        result:
          '“山门里给你拨一间房。药堂的名字，你定。”\n' +
          '她把招牌写成了“青云”。\n' +
          '“我从家里带出来的，只有一身药术。以后，就放在这儿了。”',
        effects: [
          { bond: { id: 'su', delta: 15 }, herbs: 20, flag: { key: 'suArc', value: 3 } } , { flag: { key: 'suStay', value: true } },
        ],
      },
      {
        id: 'let',
        label: '放她下山自立',
        hint: '苏晚照离开 · 声望 +4',
        result:
          '你替她把铺子看好，送到山下。\n' +
          '“混不下去，就回来。”\n' +
          '她回头笑了一下，是这几日最轻松的一次。',
        effects: [
          { leave: 'su', reputation: 4, flag: { key: 'suArc', value: 3 } } , { flag: { key: 'suGone', value: true } },
        ],
      },
      {
        id: 'both',
        label: '两边都留着',
        hint: '心得 +3 · 忠诚 +6',
        result:
          '“铺子你开，山门也留着你的房。”\n' +
          '她愣住，随即笑了：“宗主，你惯会占人便宜。”',
        effects: [
          { insight: 3, bond: { id: 'su', delta: 6 }, flag: { key: 'suArc', value: 3 } } , { flag: { key: 'suStay', value: true } },
        ],
      },
    ],
  },

  // ————————————————— 白芷 · 月圆旧疤 —————————————————
  {
    id: 'bai_arc_1',
    title: '月圆夜',
    kicker: '人物线 · 白芷',
    text:
      '又是月圆。白芷手腕上的旧疤又开始发烫，药庐里飘出一股异香，闻之令人恍惚。\n' +
      '她把自己锁在门里，不让人进。',
    priority: 40,
    when: (s) => s.freeMode && arc(s, 'baiArc') === 0 && s.disciples.some((d) => d.id === 'bai' && d.active),
    options: [
      {
        id: 'guard',
        label: '在门外守到天亮',
        hint: '忠诚 +10 · 道心 +3',
        result:
          '你在药庐外坐了一夜。\n' +
          '天亮她开门，看着你眼下的青，轻声说：“进来吧，我给你煎碗安神的药。”',
        effects: [
          { bond: { id: 'bai', delta: 10 }, daoHeart: 3, flag: { key: 'baiArc', value: 1 } },
        ],
      },
      {
        id: 'ask',
        label: '问她旧疤的来历',
        hint: '忠诚 +5 · 心得 +2',
        result:
          '“宗主，有些过去，说一次就醒一次。”\n' +
          '她终究没让你看那道疤，但也没再躲你。',
        effects: [
          { bond: { id: 'bai', delta: 5 }, insight: 2, flag: { key: 'baiArc', value: 1 } },
        ],
      },
      {
        id: 'alone',
        label: '让她一个人',
        hint: '忠诚 +0 · 道心 +1',
        result:
          '你在门外放下灯，没有敲门。\n' +
          '异香到后半夜才散。',
        effects: [
          { daoHeart: 1, flag: { key: 'baiArc', value: 1 } },
        ],
      },
    ],
  },
  {
    id: 'bai_arc_2',
    title: '旧主寻来',
    kicker: '人物线 · 白芷',
    text:
      '一个裹着黑斗篷的人出现在山门外，指名要见白芷。\n' +
      '“药人还债，天经地义。魔道要的，不是她的人，是她这副身子养出来的丹性。”',
    priority: 40,
    when: (s) => s.freeMode && arc(s, 'baiArc') === 1 && s.disciples.some((d) => d.id === 'bai' && d.active),
    options: [
      {
        id: 'shield',
        label: '替他挡下',
        hint: '忠诚 +10 · 声望 +2',
        result:
          '你拦在药庐前。\n' +
          '“要人，先踏过我的剑。”\n' +
          '黑斗篷的人盯着你看了很久，留下一句“日子还长”便走了。',
        effects: [
          { bond: { id: 'bai', delta: 10 }, reputation: 2, flag: { key: 'baiArc', value: 2 } },
        ],
      },
      {
        id: 'settle',
        label: '让她亲手了结',
        hint: '忠诚 +8 · 心得 +3',
        result:
          '白芷自己走了出去，与那人低语了半盏茶。\n' +
          '那人走时，把当年锁她的药人牌扔在了山阶上。',
        effects: [
          { bond: { id: 'bai', delta: 8 }, insight: 3, flag: { key: 'baiArc', value: 2 } },
        ],
      },
      {
        id: 'pay',
        label: '用丹药与灵石买断',
        hint: '灵石 -30 · 药材 -15 · 忠诚 +12',
        result:
          '你以宗门的名义递上一匣丹药。\n' +
          '“从今往后，她的命，归她自己。”',
        effects: [
          { stones: -30, herbs: -15, bond: { id: 'bai', delta: 12 }, flag: { key: 'baiArc', value: 2 } },
        ],
      },
    ],
  },
  {
    id: 'bai_arc_3',
    title: '去留',
    kicker: '人物线 · 白芷',
    text:
      '旧事了结，白芷却收拾起了行囊。\n' +
      '“魔道不会善罢甘休。我留在山里，早晚连累你们。”',
    priority: 60,
    when: (s) => s.freeMode && arc(s, 'baiArc') === 2 && s.disciples.some((d) => d.id === 'bai' && d.active),
    options: [
      {
        id: 'stay',
        label: '留下，一起扛',
        hint: '忠诚 +15 · 道心 +4',
        result:
          '“魔道来了，有整座山门替你挡。”\n' +
          '她沉默良久，把药篓重新挂回门后。\n' +
          '“那我这条命，就不算白捡了。”',
        effects: [
          { bond: { id: 'bai', delta: 15 }, daoHeart: 4, flag: { key: 'baiArc', value: 3 } } , { flag: { key: 'baiStay', value: true } },
        ],
      },
      {
        id: 'go',
        label: '送她远走避祸',
        hint: '白芷离开 · 声望 +3',
        result:
          '你替她备好盘缠与几炉丹药，送到山门。\n' +
          '“等风头过了，再回来。”',
        effects: [
          { leave: 'bai', reputation: 3, flag: { key: 'baiArc', value: 3 } } , { flag: { key: 'baiGone', value: true } },
        ],
      },
      {
        id: 'seal',
        label: '封住她的药人旧脉',
        hint: '心得 +4 · 忠诚 +6',
        result:
          '你与玄真合力布阵，封住她体内残留的药人丹性。\n' +
          '从此月圆之夜，她腕上的疤不再发烫。',
        effects: [
          { insight: 4, bond: { id: 'bai', delta: 6 }, flag: { key: 'baiArc', value: 3 } } , { flag: { key: 'baiStay', value: true } },
        ],
      },
    ],
  },

  // ————————————————— 阿七 · 抬望气运 —————————————————
  {
    id: 'qi_arc_1',
    title: '看得见风的少年',
    kicker: '人物线 · 阿七',
    text:
      '阿七拦住你，神神秘秘地说，他能看见别人看不见的灵气流向——哪片云后有雷、哪座山底有脉。\n' +
      '他说：“宗主，我真的没骗你。”',
    priority: 40,
    when: (s) => s.freeMode && arc(s, 'qiArc') === 0 && s.disciples.some((d) => d.id === 'qi' && d.active),
    options: [
      {
        id: 'trust',
        label: '信他，试他一试',
        hint: '忠诚 +10 · 心得 +3',
        result:
          '你按他指的方位，果然在后山挖出一小片灵晶。\n' +
          '“看吧看吧，”他得意地搓鼻子，“我就是有这门手艺。”',
        effects: [
          { bond: { id: 'qi', delta: 10 }, insight: 3, flag: { key: 'qiArc', value: 1 } },
        ],
      },
      {
        id: 'laugh',
        label: '一笑置之',
        hint: '忠诚 -4',
        result:
          '你当他小孩子吹牛。\n' +
          '他难得地没吭声，只是用木棍在沙地上画了半宿。',
        effects: [
          { bond: { id: 'qi', delta: -4 }, flag: { key: 'qiArc', value: 1 } },
        ],
      },
      {
        id: 'doubt',
        label: '提醒他别乱说',
        hint: '道心 +2',
        result:
          '“阿七，有些话传出去，会有人惦记。”\n' +
          '他似懂非懂地点点头。',
        effects: [
          { daoHeart: 2, flag: { key: 'qiArc', value: 1 } },
        ],
      },
    ],
  },
  {
    id: 'qi_arc_2',
    title: '大宗门来挖人',
    kicker: '人物线 · 阿七',
    text:
      '一对锦袍人找上门，自称是大宗门的执事。\n' +
      '“这孩子的眼睛，是天生道体。留在青云宗，可惜了。”',
    priority: 40,
    when: (s) => s.freeMode && arc(s, 'qiArc') === 1 && s.disciples.some((d) => d.id === 'qi' && d.active),
    options: [
      {
        id: 'refuse',
        label: '替他回绝',
        hint: '忠诚 +15',
        result:
          '“他是我青云宗的人。”\n' +
          '阿七躲在门后，把这话听了去，走路都带着风。',
        effects: [
          { bond: { id: 'qi', delta: 15 }, flag: { key: 'qiArc', value: 2 } },
        ],
      },
      {
        id: 'ask',
        label: '问他自己',
        hint: '忠诚 +5 · 心得 +2',
        result:
          '你把人带到他面前，让他自己选。\n' +
          '他当着贵客的面，认认真真算了半天：“还是山门这一日三餐香。”',
        effects: [
          { bond: { id: 'qi', delta: 5 }, insight: 2, flag: { key: 'qiArc', value: 2 } },
        ],
      },
      {
        id: 'bargain',
        label: '替他与大宗门谈条件',
        hint: '声望 +6 · 心得 +2',
        result:
          '你以“他日可引荐”为条件，换来大宗门对青云宗的一纸庇护。\n' +
          '阿七没走，宗门却多了个靠山。',
        effects: [
          { reputation: 6, insight: 2, flag: { key: 'qiArc', value: 2 } },
        ],
      },
    ],
  },
  {
    id: 'qi_arc_3',
    title: '去留',
    kicker: '人物线 · 阿七',
    text:
      '大宗门的执事又来了，这次带着认祖归宗的文书。\n' +
      '阿七捏着文书，第一次没笑。',
    priority: 60,
    when: (s) => s.freeMode && arc(s, 'qiArc') === 2 && s.disciples.some((d) => d.id === 'qi' && d.active),
    options: [
      {
        id: 'stay',
        label: '留他在山门',
        hint: '忠诚 +16 · 声望 +3',
        result:
          '“不去。金窝银窝，不如——”。\n' +
          '他想了半天，接上：“不如青云宗的窝。”\n' +
          '满山的人都笑了。',
        effects: [
          { bond: { id: 'qi', delta: 16 }, reputation: 3, flag: { key: 'qiArc', value: 3 } } , { flag: { key: 'qiStay', value: true } },
        ],
      },
      {
        id: 'go',
        label: '放他去大宗门',
        hint: '阿七离开 · 声望 +6',
        result:
          '你送他下山。他一步三回头。\n' +
          '“宗主，等我学成，把大宗门的剑谱全偷来给你。”\n' +
          '你哭笑不得。',
        effects: [
          { leave: 'qi', reputation: 6, flag: { key: 'qiArc', value: 3 } } , { flag: { key: 'qiGone', value: true } },
        ],
      },
      {
        id: 'wander',
        label: '让他两处走走',
        hint: '心得 +4 · 忠诚 +6',
        result:
          '“想去就去，山门永远给你留着饭。”\n' +
          '他抱着文书在门口站了很久，最后没收进怀里，也没撕。',
        effects: [
          { insight: 4, bond: { id: 'qi', delta: 6 }, flag: { key: 'qiArc', value: 3 } } , { flag: { key: 'qiStay', value: true } },
        ],
      },
    ],
  },

  // ————————————————— 玄真 · 守夜人 —————————————————
  {
    id: 'xuan_arc_1',
    title: '灭门那一夜',
    kicker: '人物线 · 玄真',
    text:
      '玄真把你拉到偏殿，欲言又止。\n' +
      '“宗主，青云宗当年被灭门那一夜……我看见了不该看见的东西。”\n' +
      '他说，若现在查出真相，可能会引火烧身。',
    priority: 40,
    when: (s) => s.freeMode && arc(s, 'xuanArc') === 0 && s.disciples.some((d) => d.id === 'xuan' && d.active),
    options: [
      {
        id: 'press',
        label: '逼他说出口',
        hint: '心得 +5 · 忠诚 -3 · 道心 -2',
        result:
          '他终究开了口：当年放魔道进山的，是宗门里的自己人。\n' +
          '说出这话，他像老了十岁。',
        effects: [
          { insight: 5, bond: { id: 'xuan', delta: -3 }, daoHeart: -2, flag: { key: 'xuanArc', value: 1 } },
        ],
      },
      {
        id: 'wait',
        label: '等他愿意再说',
        hint: '忠诚 +8',
        result:
          '“你守了这么多年，不差这一夜。”\n' +
          '他如释重负，连夜搬来自己的铺盖，说要睡在偏殿替你守门。',
        effects: [
          { bond: { id: 'xuan', delta: 8 }, flag: { key: 'xuanArc', value: 1 } },
        ],
      },
      {
        id: 'silence',
        label: '不必再提',
        hint: '道心 +2',
        result:
          '“有些账，等宗门站得住再算。”\n' +
          '他点点头，紧紧抿着嘴。',
        effects: [
          { daoHeart: 2, flag: { key: 'xuanArc', value: 1 } },
        ],
      },
    ],
  },
  {
    id: 'xuan_arc_2',
    title: '一封旧信',
    kicker: '人物线 · 玄真',
    text:
      '玄真从墙缝里取出一封泛黄的信。\n' +
      '那是当年内奸留与魔道的往来，落款处，墨已洇了一半。',
    priority: 40,
    when: (s) => s.freeMode && arc(s, 'xuanArc') === 1 && s.disciples.some((d) => d.id === 'xuan' && d.active),
    options: [
      {
        id: 'trace',
        label: '顺着线索查下去',
        hint: '心得 +6 · 声望 +2 · 有风险',
        result:
          '你顺着信上的暗语，查到山下一处早已荒废的联络点。\n' +
          '真相更近了，可也惊动了不该惊动的人。',
        effects: [
          { insight: 6, reputation: 2, flag: { key: 'xuanArc', value: 2 } },
          { flag: { key: 'xuanTrail', value: true } },
        ],
      },
      {
        id: 'burn',
        label: '把信烧了，到此为止',
        hint: '道心 +4',
        result:
          '你把信投进烛火。\n' +
          '“过去就让它过去。山门要往前看。”\n' +
          '玄真看着灰，长叹一口气，像是放下了半辈子的担子。',
        effects: [
          { daoHeart: 4, flag: { key: 'xuanArc', value: 2 } },
        ],
      },
      {
        id: 'hide',
        label: '存档不查，静待时机',
        hint: '心得 +2 · 忠诚 +4',
        result:
          '你把信重新封进锦匣，锁进藏经阁顶。\n' +
          '“等有朝一日，用得上。”',
        effects: [
          { insight: 2, bond: { id: 'xuan', delta: 4 }, flag: { key: 'xuanArc', value: 2 } },
        ],
      },
    ],
  },
  {
    id: 'xuan_arc_3',
    title: '去留',
    kicker: '人物线 · 玄真',
    text:
      '真相查罢，玄真把守夜人的旧钟交到你手里。\n' +
      '“宗主，这口钟我敲了二十年。现在，该交给愿意敲它的人。”',
    priority: 60,
    when: (s) => s.freeMode && arc(s, 'xuanArc') === 2 && s.disciples.some((d) => d.id === 'xuan' && d.active),
    options: [
      {
        id: 'stay',
        label: '留他继续守夜',
        hint: '忠诚 +15 · 声望 +2',
        result:
          '“这口钟，旁人敲不响。”\n' +
          '他怔了怔，笑了。这是你头一回见他笑。',
        effects: [
          { bond: { id: 'xuan', delta: 15 }, reputation: 2, flag: { key: 'xuanArc', value: 3 } } , { flag: { key: 'xuanStay', value: true } },
        ],
      },
      {
        id: 'grant',
        label: '让他下山养老',
        hint: '玄真离开 · 声望 +4',
        result:
          '“山下给你置了块地，好好歇歇。”\n' +
          '他摇了摇头，还是走了。走前把旧钟擦得锃亮。',
        effects: [
          { leave: 'xuan', reputation: 4, flag: { key: 'xuanArc', value: 3 } } , { flag: { key: 'xuanGone', value: true } },
        ],
      },
      {
        id: 'named',
        label: '授他长老之位',
        hint: '心得 +3 · 忠诚 +6',
        result:
          '你当众授他长老印。\n' +
          '“守夜人敲钟，长老守宗。这担子，还是你的。”',
        effects: [
          { insight: 3, bond: { id: 'xuan', delta: 6 }, flag: { key: 'xuanArc', value: 3 } } , { flag: { key: 'xuanStay', value: true } },
        ],
      },
    ],
  },
];