import type { Disciple, GameState, Task } from './state';

export type TalkKind = 'chat' | 'train' | 'heart' | 'leave';

const GREETINGS: Record<string, [string, string, string]> = {
  gu: [
    '掌门。',
    '掌门，今日可有要事？',
    '你来了。剑坪的风，正好。',
  ],
  shen: [
    '……',
    '后山风大。',
    '你站过来些，这里看得见云。',
  ],
  su: [
    '掌门有事？',
    '药庐还温着，坐吗？',
    '你来得正好，帮我尝一口汤。',
  ],
  lu: [
    '掌门！',
    '我今天也很努力！',
    '掌门，你上次说的那件事，我想明白了。',
  ],
  bai: [
    '……',
    '别站太近，药味重。',
    '手伸出来，我看看你的旧伤。',
  ],
  qi: [
    '掌门！',
    '你猜我今天看见什么了？',
    '这个给你，我留的最大的。',
  ],
  xuan: [
    '掌门。',
    '山门旧了，但还站得住。',
    '有些话，我憋了很多年。',
  ],
};

const TASK_LINES: Record<string, Record<Task, string>> = {
  gu: {
    cultivate: '剑要快，心要更硬。今日这一式，我练了三百遍。',
    gather: '让我去采药？也好。剑修不能只会杀人。',
    patrol: '山门有我。你只管做你的决定。',
    study: '藏经阁的旧剑谱，缺了最后一页。',
    rest: '我不用休养。……但这是你的命令。',
  },
  shen: {
    cultivate: '冰灵根压得住剑，压不住念头。',
    gather: '崖边的药，霜打过后最好。',
    patrol: '山道上有脚印。不是人的。',
    study: '这本剑谱，和我家传的那本很像。',
    rest: '我睡不着。闭上眼就是那夜的雪。',
  },
  su: {
    cultivate: '丹火也是火，能烧心。',
    gather: '这一株是给白芷的，那一株给阿七。',
    patrol: '我走不快，但会看清每一张脸。',
    study: '药方和剑谱，写的都是人心。',
    rest: '让我歇一会儿。炉子别灭。',
  },
  lu: {
    cultivate: '我灵根不好，但我能坐一整天。',
    gather: '崖边那株草又长高了！',
    patrol: '我跑得快！真的！',
    study: '这些字……我认得，但连起来就不懂。',
    rest: '今天可以早点睡吗？',
  },
  bai: {
    cultivate: '水灵根不适合杀人，适合救人。',
    gather: '别碰那株，有毒。',
    patrol: '我闻到了血味。很远。',
    study: '魔道药经……我看得懂。',
    rest: '月圆之前，我要把药配好。',
  },
  qi: {
    cultivate: '我也要修炼！……从哪开始？',
    gather: '我找到三株！有一株被兔子啃了。',
    patrol: '山门外那棵树，今天没有影子。',
    study: '掌门，这个字念什么？',
    rest: '今天吃什么都行。',
  },
  xuan: {
    cultivate: '土灵根慢，但稳。',
    gather: '后山的药田，是我师父开的。',
    patrol: '三十六盏灯，一盏都不能灭。',
    study: '旧信不能看。看了，就回不去了。',
    rest: '人老了，坐一会儿就好。',
  },
};

const FLAG_LINES: Record<string, { flag: string; line: string }> = {
  guLead: { flag: 'guLead', line: '宗主印在你手里。你打算什么时候用？' },
  guTalk: { flag: 'guTalk', line: '那夜的话，我只说了一次。' },
  shenSword: { flag: 'shenSword', line: '断剑我磨好了。它认得我。' },
  suMarried: { flag: 'suMarried', line: '婚期定了。赵家的人，明日来取庚帖。' },
  suFree: { flag: 'suFree', line: '婚书烧了。灰还埋在药庐下面。' },
  luReveal: { flag: 'luReveal', line: '现在所有人都知道我是天灵根了。' },
  luHide: { flag: 'luHide', line: '他们看我的眼神，和从前不一样了。' },
  baiTrust: { flag: 'baiTrust', line: '药庐的门，今晚不锁。' },
  xuanTruth: { flag: 'xuanTruth', line: '那封信，你烧了吗？' },
  demonWarn: { flag: 'demonWarn', line: '山门外那个人，我总觉得还会回来。' },
};

const CHAT_REPLIES: Record<string, string> = {
  gu: '顾长风把剑横在膝上，听你说完，才点头。',
  shen: '沈青梧没有看你，但往旁边挪了半步。',
  su: '苏晚照笑了一下，把温着的茶推过来。',
  lu: '陆小满眼睛亮起来，说了很多山里的琐事。',
  bai: '白芷安静地听完，把药炉的火拨小了一点。',
  qi: '阿七把最后半块饼分给你，自己啃手指。',
  xuan: '玄真嗯了一声，继续擦那盏旧灯。',
};

const TRAIN_REPLIES: Record<string, string> = {
  gu: '顾长风与你对了三剑，收剑时呼吸才乱。',
  shen: '沈青梧以霜气凝成一线，替你压住经脉。',
  su: '苏晚照把一枚温丹按进你掌心。',
  lu: '陆小满学得慢，但一遍也没喊停。',
  bai: '白芷替你行针，指尖比针还凉。',
  qi: '阿七学了两招，第三招自己摔了。',
  xuan: '玄真在你背上拍了一掌，真气沉得像山。',
};

const HEART_REPLIES: Record<string, string> = {
  gu: '他没有否认。过了很久才说：“等大比之后，我会给你一个交代。”',
  shen: '她把断剑抱紧了一点。“沈家的事，我自己了。”',
  su: '她低头把婚书折成很小的一块。“你知道了，还会留我吗？”',
  lu: '她捂住脸，过了好一会儿才从指缝里看你。“你……不嫌弃我？”',
  bai: '她把袖子拉下来遮住旧疤。“别用那种眼神看我。”',
  qi: '阿七挠头：“看见灵气很厉害吗？能换鸡腿吗？”',
  xuan: '玄真闭上眼。“那夜带人上山的，不是魔道。”',
};

export function secretKnown(d: Disciple, state: GameState): boolean {
  if (d.bond >= 60) return true;
  if (state.flags[`heart_${d.id}`]) return true;
  if (d.id === 'bai' && state.flags.baiTrust) return true;
  if (d.id === 'xuan' && state.flags.xuanTruth) return true;
  if (d.id === 'lu' && state.flags.luReveal) return true;
  if (d.id === 'shen' && state.flags.shenSword) return true;
  if (d.id === 'su' && (state.flags.suFree || state.flags.suMarried)) return true;
  if (d.id === 'gu' && state.flags.guLead) return true;
  return false;
}

export function dialogueFor(d: Disciple, state: GameState): string {
  const tier = d.bond >= 70 ? 2 : d.bond >= 40 ? 1 : 0;
  const greeting = GREETINGS[d.id]?.[tier] ?? '掌门。';
  const task = TASK_LINES[d.id]?.[d.assignment] ?? '';
  const flag = FLAG_LINES[d.id];
  const flagLine = flag && state.flags[flag.flag] ? `\n\n${flag.line}` : '';
  return `${greeting}\n\n${task}${flagLine}`;
}

export function talkResult(d: Disciple, kind: TalkKind): string {
  if (kind === 'chat') return CHAT_REPLIES[d.id] ?? '你们聊了一会儿。';
  if (kind === 'train') return TRAIN_REPLIES[d.id] ?? '你们对练了一刻钟。';
  if (kind === 'heart') return `${d.secret}\n\n${HEART_REPLIES[d.id] ?? ''}`;
  return '改日再叙。';
}
