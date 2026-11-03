import { Game } from '../game/game';
import { BUILDINGS, buildingEffect } from '../game/buildings';
import { portraitFor } from '../game/portraits';
import { dialogueFor, secretKnown, type TalkKind } from '../game/dialogue';
import {
  TASKS,
  FAITH_BOONS,
  realmName,
  playerRealmName,
  sectRank,
  seasonOf,
  artifact,
  technique,
  TECHNIQUES,
  type DayReport,
  type Ending,
  type GameState,
  type StoryEvent,
  type Task,
} from '../game/state';

interface Callbacks {
  onBlockingChange?: (blocking: boolean) => void;
  onDayAdvanced?: (day: number) => void;
  onTrial?: () => void;
  onTribulation?: (method: 'steady' | 'sword' | 'pill') => void;
  onToast?: (message: string) => void;
  onStateChange?: () => void;
}

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el;
}

const SPOT_LABEL: Record<Task, string> = {
  cultivate: '剑坪西侧',
  gather: '山门东侧药圃',
  patrol: '山门石阶',
  study: '东侧殿前',
  rest: '西侧亭',
};

const TASK_LABEL: Record<Task, string> = {
  cultivate: '修炼',
  gather: '采药',
  patrol: '巡山',
  study: '研习',
  rest: '休养',
};


function relationLabel(v: number): string {
  if (v <= -30) return '仇视';
  if (v < 0) return '冷淡';
  if (v < 20) return '平常';
  if (v < 50) return '亲近';
  return '生死之交';
}

export class GameUI {
  private readonly panel = $('sect-panel');
  private readonly story = $('story-modal');
  private readonly storyKicker = $('story-kicker');
  private readonly storyTitle = $('story-title');
  private readonly storyText = $('story-text');
  private readonly storyCast = $('story-cast');
  private readonly storySpeaker = $('story-speaker');
  private readonly speakerImg = $('story-speaker-img') as HTMLImageElement;
  private readonly speakerName = $('story-speaker-name');
  private readonly speakerRole = $('story-speaker-role');
  private readonly storyOptions = $('story-options');
  private readonly storyResult = $('story-result');
  private readonly storyResultText = $('story-result-text');
  private readonly storyContinue = $('story-continue') as HTMLButtonElement;
  private readonly sectDay = $('sect-day');
  private readonly sectDayTotal = $('sect-day-total');
  private readonly sectRes = $('sect-res');
  private readonly master = $('master-strip');
  private readonly list = $('sect-disciples');
  private readonly detail = $('sect-detail');
  private readonly upgrades = $('upgrade-list');
  private readonly log = $('sect-log');
  private readonly objective = $('sect-objective');
  private readonly tutorial = $('sect-tutorial');
  private readonly endDay = $('end-day') as HTMLButtonElement;
  private readonly trialBtn = $('sect-trial') as HTMLButtonElement;
  private readonly newGameBtn = $('btn-newgame') as HTMLButtonElement;
  private readonly closeBtn = $('sect-close') as HTMLButtonElement;

  private selected = 'gu';
  private continueAction: (() => void) | null = null;

  constructor(
    private readonly game: Game,
    private readonly callbacks: Callbacks = {},
  ) {
    this.closeBtn.addEventListener('click', () => this.closePanel());
    this.endDay.addEventListener('click', () => this.handleEndDay());
    this.trialBtn.addEventListener('click', () => this.handleTrial());
    this.newGameBtn.addEventListener('click', () => this.handleNewGame());
    this.storyContinue.addEventListener('click', () => {
      const action = this.continueAction;
      this.continueAction = null;
      action?.();
    });

    this.list.addEventListener('click', (event) => {
      const card = (event.target as HTMLElement).closest<HTMLElement>('[data-disciple]');
      if (!card) return;
      const id = card.dataset.disciple;
      if (!id) return;
      this.selected = id;
      this.render();
    });

    this.detail.addEventListener('click', (event) => {
      const taskBtn = (event.target as HTMLElement).closest<HTMLElement>('[data-task]');
      if (taskBtn?.dataset.task) {
        this.game.assign(this.selected, taskBtn.dataset.task as Task);
        this.render();
        this.sync();
        return;
      }
      const giftBtn = (event.target as HTMLElement).closest<HTMLElement>('[data-gift]');
      if (giftBtn) {
        const result = this.game.gift(this.selected);
        this.callbacks.onToast?.(result.message);
        this.render();
        this.sync();
        return;
      }
      const pillBtn = (event.target as HTMLElement).closest<HTMLElement>('[data-pill]');
      if (pillBtn) {
        const result = this.game.useHerb(this.selected);
        this.callbacks.onToast?.(result.message);
        this.render();
        this.sync();
        return;
      }
      const teachBtn = (event.target as HTMLElement).closest<HTMLElement>('[data-teach]');
      if (teachBtn) {
        this.showTeach(this.selected);
      }
    });

    this.master.addEventListener('click', (event) => {
      const btn = (event.target as HTMLElement).closest<HTMLElement>('[data-master]');
      if (!btn) return;
      const action = btn.dataset.master;
      if (action === 'meditate') {
        const result = this.game.meditate();
        this.callbacks.onToast?.(result.text);
        this.render();
        this.sync();
      } else if (action === 'refine') {
        const result = this.game.refinePill();
        this.callbacks.onToast?.(result.text);
        this.render();
        this.sync();
      } else if (action === 'pill') {
        const result = this.game.usePill();
        this.callbacks.onToast?.(result.text);
        this.render();
        this.sync();
      } else if (action === 'breakthrough') {
        this.showBreakthrough();
      } else if (action === 'faith') {
        this.showFaithLadder();
      }
    });

    this.upgrades.addEventListener('click', (event) => {
      const btn = (event.target as HTMLElement).closest<HTMLElement>('[data-upgrade]');
      if (!btn?.dataset.upgrade) return;
      const result = this.game.upgrade(btn.dataset.upgrade);
      this.callbacks.onToast?.(result.message);
      this.render();
      this.sync();
    });
  }

  get isBlocking(): boolean {
    return !this.panel.classList.contains('is-hidden') || !this.story.classList.contains('is-hidden');
  }

  get panelOpen(): boolean {
    return !this.panel.classList.contains('is-hidden');
  }

  get storyOpen(): boolean {
    return !this.story.classList.contains('is-hidden');
  }

  openPanel(force = false): void {
    if (this.game.ending && !force) {
      this.showEnding(this.game.ending);
      return;
    }
    this.panel.classList.remove('is-hidden');
    this.render();
    this.notifyBlocking();
  }

  closePanel(): void {
    if (this.storyOpen) return;
    this.panel.classList.add('is-hidden');
    this.notifyBlocking();
  }

  toggle(): void {
    if (this.storyOpen) return;
    if (this.panelOpen) this.closePanel();
    else this.openPanel();
  }

  forceClose(): void {
    this.panel.classList.add('is-hidden');
    this.story.classList.add('is-hidden');
    this.storySpeaker.classList.add('is-hidden');
    this.continueAction = null;
    this.notifyBlocking();
  }

  handleEscape(): boolean {
    if (this.storyOpen) return false;
    if (this.panelOpen) {
      this.closePanel();
      return true;
    }
    return false;
  }

  private renderMaster(s: GameState): void {
    const p = s.player;
    const med = this.game.canMeditate();
    const techs = p.techniques.join(' · ');
    const arts = p.artifacts.map((id) => artifact(id)?.name ?? id).join(' · ');
    this.master.innerHTML = `
      <div>
        <div class="master-name">掌门 · <b>${playerRealmName(p.realmIndex)}</b>${p.bottleneck ? ' · <span style="color:#e0a39a">瓶颈</span>' : ''}</div>
        <div class="master-sub">${p.root} · ${p.age} 岁 / 寿元 ${p.lifespan} · 道心 ${Math.round(p.daoHeart)} · 伤势 ${Math.round(p.injury)} · 行动 ${s.actionPoints}/${this.game.maxActionPoints}</div>
        <div class="master-bar${p.bottleneck ? ' bottleneck' : ''}"><i style="width:${Math.min(100, p.cultivation)}%"></i><span>${Math.round(p.cultivation)} / 100</span></div>
        <div class="master-tech">功法：${techs} · 丹药 ${p.pills}${arts ? ` · 法宝：${arts}` : ''}</div>
      </div>
      <div class="master-actions">
        <button data-master="meditate" ${!med.ok || s.ending || s.actionPoints <= 0 ? 'disabled' : ''}>打坐</button>
        <button data-master="breakthrough" class="primary" ${!p.bottleneck || s.ending ? 'disabled' : ''}>破境</button>
        <button data-master="faith" ${s.ending ? 'disabled' : ''}>香火天梯</button>
        <button data-master="pill" ${p.pills <= 0 || s.ending ? 'disabled' : ''}>服丹</button>
        <button data-master="refine" ${s.resources.herbs < 20 || s.playerActions.includes('refine') || s.ending || s.actionPoints <= 0 ? 'disabled' : ''}>炼丹</button>
      </div>
    `;
  }

  private showBreakthrough(): void {
    const info = this.game.breakthroughInfo();
    if (!info.ok) {
      this.callbacks.onToast?.(info.text);
      return;
    }
    const s = this.game.state;
    const pct = Math.round(info.chance * 100);
    const swordBonus = s.player.techniques.includes('霜刃') ? 10 : 4;
    const pillPct = 16;
    this.openStory();
    this.storyKicker.textContent = `破境 · 第 ${s.day} 日`;
    this.storyTitle.textContent = info.tribulation ? '天 劫' : '破 境';
    this.storyText.textContent =
      `${info.text}\n\n` +
      `气海已满。${info.tribulation ? '云层压得很低，雷声在等你。' : '再进一步，便是另一重天地。'}\n` +
      `基础成功率 ${pct}%。`;
    this.storyCast.innerHTML = '';
    this.storySpeaker.classList.add('is-hidden');
    this.storyOptions.innerHTML = '';
    this.storyResult.classList.add('is-hidden');

    const options: Array<{ method: 'steady' | 'sword' | 'pill' | 'leave'; label: string; hint: string; disabled: boolean }> = [
      { method: 'steady', label: '稳守心神', hint: `成功率 ${pct}%`, disabled: false },
      { method: 'sword', label: '以剑引雷', hint: `成功率 ${Math.min(96, pct + swordBonus)}% · 剑意护体`, disabled: false },
      {
        method: 'pill',
        label: '服丹护体',
        hint: `成功率 ${Math.min(96, pct + pillPct)}% · 丹药 -1`,
        disabled: s.player.pills <= 0,
      },
      { method: 'leave', label: '暂缓', hint: '再准备一日', disabled: false },
    ];

    for (const option of options) {
      const btn = document.createElement('button');
      btn.className = 'story-option';
      btn.disabled = option.disabled;
      btn.innerHTML = `
        <span><b>${option.label}</b><small>${option.disabled ? '丹药不足' : option.hint}</small></span>
        <em>${option.disabled ? '缺' : '择'}</em>
      `;
      btn.addEventListener('click', () => {
        if (option.disabled) return;
        if (option.method === 'leave') {
          this.closeStory();
          this.sync();
          return;
        }
        if (info.tribulation) {
          const started = this.game.beginTribulation(option.method);
          if (!started.ok) {
            this.callbacks.onToast?.(started.text);
            return;
          }
          this.closeStory();
          this.callbacks.onTribulation?.(option.method);
          return;
        }
        const result = this.game.attemptBreakthrough(option.method);
        if (!result.ok) {
          this.callbacks.onToast?.(result.text);
          return;
        }
        this.render();
        this.sync();
        this.showResult(result.text, () => {
          this.closeStory();
          this.sync();
        });
      });
      this.storyOptions.appendChild(btn);
    }
    this.notifyBlocking();
  }

  showFaithLadder(): void {
    const s = this.game.state;
    this.openStory();
    this.storyKicker.textContent = `香火天梯 · 第 ${s.day} 日`;
    this.storyTitle.textContent = '香 火 天 梯';
    this.storyText.textContent =
      `把宗门积攒的香火，化作山门永续的气运。\n当前香火 ${s.sectFaith}。每一项修到极致，都会悄然改变这座山。`;
    this.storyCast.innerHTML = '';
    this.storySpeaker.classList.add('is-hidden');
    this.storyOptions.innerHTML = '';
    this.storyResult.classList.add('is-hidden');

    for (const boon of FAITH_BOONS) {
      const cur = this.game.faithBoonLevel(boon.id);
      const maxed = cur >= boon.maxLevel;
      const cost = maxed ? 0 : boon.costs[cur];
      const afford = s.sectFaith >= cost;
      const btn = document.createElement('button');
      btn.className = 'story-option';
      btn.disabled = maxed || !afford;
      const status = maxed
        ? '圆满'
        : afford
          ? `第 ${cur + 1} 级 · 香火 ${cost}`
          : `香火不足（${cost}）`;
      btn.innerHTML = `
        <span><b>${boon.name} · ${boon.subtitle}</b><small>${boon.description}</small><small style="color:#c9a86a">${maxed ? '已至圆满' : `下一级：${boon.effects[cur]}`}</small></span>
        <em>${status}</em>
      `;
      btn.addEventListener('click', () => {
        const result = this.game.spendFaith(boon.id);
        this.callbacks.onToast?.(result.text);
        this.render();
        this.sync();
        this.showFaithLadder(); // 刷新列表
      });
      this.storyOptions.appendChild(btn);
    }

    const close = document.createElement('button');
    close.className = 'story-option subtle';
    close.innerHTML = `<span><b>收起天梯</b><small>继续经营山门</small></span><em>返</em>`;
    close.addEventListener('click', () => {
      this.closeStory();
      this.sync();
    });
    this.storyOptions.appendChild(close);
    this.notifyBlocking();
  }

  showTeach(id: string): void {
    const s = this.game.state;
    const d = s.disciples.find((x) => x.id === id);
    if (!d || !d.active || s.ending) return;
    this.openStory();
    this.storyKicker.textContent = `传法 · 第 ${s.day} 日`;
    this.storyTitle.textContent = `传 法 · ${d.name}`;
    this.storyText.textContent =
      `以宗门心得，为${d.name}点一门功法。\n当前心得 ${s.resources.insight}。功法强化对应日常任务，专精一条路者，事半功倍。`;
    this.storyCast.innerHTML = '';
    this.storySpeaker.classList.add('is-hidden');
    this.storyOptions.innerHTML = '';
    this.storyResult.classList.add('is-hidden');

    for (const t of TECHNIQUES) {
      const owned = d.technique === t.id;
      const afford = s.resources.insight >= t.cost;
      const btn = document.createElement('button');
      btn.className = 'story-option';
      btn.disabled = owned || !afford;
      const status = owned ? '已习' : afford ? `心得 ${t.cost}` : `心得不足（${t.cost}）`;
      btn.innerHTML = `
        <span><b>${t.name}</b><small>${t.bonus}</small></span>
        <em>${status}</em>
      `;
      btn.addEventListener('click', () => {
        const result = this.game.teachTechnique(id, t.id);
        this.callbacks.onToast?.(result.message);
        this.render();
        this.sync();
        this.showTeach(id); // 刷新列表
      });
      this.storyOptions.appendChild(btn);
    }

    const close = document.createElement('button');
    close.className = 'story-option subtle';
    close.innerHTML = `<span><b>收起</b><small>暂不传法</small></span><em>返</em>`;
    close.addEventListener('click', () => {
      this.closeStory();
      this.sync();
    });
    this.storyOptions.appendChild(close);
    this.notifyBlocking();
  }

  showDialogue(id: string): void {
    const s = this.game.state;
    const d = s.disciples.find((x) => x.id === id);
    if (!d || !d.active || s.ending) return;

    this.openStory();
    this.storyKicker.textContent = `山门 · 交谈 · 第 ${s.day} 日`;
    this.storyTitle.textContent = d.name;
    this.storyCast.innerHTML = '';
    this.storySpeaker.classList.remove('is-hidden');
    this.speakerImg.src = portraitFor(d);
    this.speakerImg.alt = d.name;
    this.speakerName.textContent = `${d.title} · ${d.role}`;
    this.speakerRole.textContent = `${d.root} · ${realmName(d.realmIndex)} · 忠诚 ${Math.round(d.bond)}`;

    const talked = s.talked.includes(id);
    const heartSeen = Boolean(s.flags[`heart_${id}`]);
    const limit = s.talked.length >= 2 || s.actionPoints <= 0;
    const limitReason = s.actionPoints <= 0 ? '今日行动已尽' : '今日已叙两人';
    const known = secretKnown(d, s);
    this.storyText.textContent =
      dialogueFor(d, s) +
      (talked
        ? '\n\n（今日已经叙过，明日再来。）'
        : limit
          ? '\n\n（今日已与两名弟子叙过，剩下的人只能明日再谈。）'
          : '');
    this.storyOptions.innerHTML = '';
    this.storyResult.classList.add('is-hidden');

    const options: Array<{
      kind: TalkKind;
      label: string;
      hint: string;
      disabled: boolean;
      reason: string;
    }> = [
      {
        kind: 'chat',
        label: '闲聊片刻',
        hint: '忠诚 +3 · 道心 +2',
        disabled: talked || limit,
        reason: talked ? '今日已叙' : limitReason,
      },
      {
        kind: 'train',
        label: '指点修行',
        hint: '修为 +6',
        disabled: talked || limit,
        reason: talked ? '今日已叙' : limitReason,
      },
      {
        kind: 'heart',
        label: '问心事',
        hint: '心得 +2 · 忠诚 +4',
        disabled: talked || limit || heartSeen || !known,
        reason: heartSeen ? '已经问过' : !known ? '信任不足' : talked ? '今日已叙' : limitReason,
      },
      {
        kind: 'leave',
        label: '告辞',
        hint: '改日再叙',
        disabled: false,
        reason: '',
      },
    ];

    for (const option of options) {
      const btn = document.createElement('button');
      btn.className = 'story-option';
      btn.disabled = option.disabled;
      btn.innerHTML = `
        <span><b>${option.label}</b><small>${option.disabled ? option.reason : option.hint}</small></span>
        <em>${option.disabled ? '缺' : '谈'}</em>
      `;
      btn.addEventListener('click', () => {
        if (option.disabled) return;
        const result = this.game.talk(d.id, option.kind);
        if (!result.ok) {
          this.callbacks.onToast?.(result.text);
          return;
        }
        this.showResult(result.text, () => {
          this.closeStory();
          this.sync();
        });
      });
      this.storyOptions.appendChild(btn);
    }
    this.notifyBlocking();
  }

  showRegionResult(title: string, text: string): void {
    this.openStory();
    this.storyKicker.textContent = '山门之外 · 今日';
    this.storyTitle.textContent = title;
    this.storyText.textContent = text;
    this.storyCast.innerHTML = '';
    this.storySpeaker.classList.add('is-hidden');
    this.storyOptions.innerHTML = '';
    this.storyResult.classList.add('is-hidden');

    const btn = document.createElement('button');
    btn.className = 'sect-btn primary';
    btn.textContent = '继续';
    btn.addEventListener('click', () => {
      this.closeStory();
      this.sync();
    });
    this.storyOptions.appendChild(btn);
    this.notifyBlocking();
  }

  showMarket(): void {
    const s = this.game.state;
    const used = s.regionActions.includes('market');
    this.openStory();
    this.storyKicker.textContent = `山门坊市 · 第 ${s.day} 日`;
    this.storyTitle.textContent = '赶 集';
    this.storyText.textContent = used
      ? '摊子还在，但今日的行情已经过去了。明日再来。'
      : '行商、散修、卖药的与卖消息的挤在一条土街上。\n\n你可以买药、卖药，或者听一耳朵山下的风声。';
    this.storyCast.innerHTML = '';
    this.storySpeaker.classList.add('is-hidden');
    this.storyOptions.innerHTML = '';
    this.storyResult.classList.add('is-hidden');

    const options: Array<{
      kind: 'buy' | 'sell' | 'rumor' | 'pill' | 'leave';
      label: string;
      hint: string;
      disabled: boolean;
    }> = [
      {
        kind: 'buy',
        label: '买入药材',
        hint: '灵石 -25 · 药材 +30',
        disabled: used || s.resources.stones < 25,
      },
      {
        kind: 'sell',
        label: '卖出药材',
        hint: '药材 -20 · 灵石 +30',
        disabled: used || s.resources.herbs < 20,
      },
      {
        kind: 'pill',
        label: '买一枚温养丹',
        hint: '灵石 -30 · 丹药 +1',
        disabled: used || s.resources.stones < 30,
      },
      {
        kind: 'rumor',
        label: '打听消息',
        hint: '声望 +3',
        disabled: used,
      },
      {
        kind: 'leave',
        label: '离开',
        hint: '改日再来',
        disabled: false,
      },
    ];

    for (const option of options) {
      const btn = document.createElement('button');
      btn.className = 'story-option';
      btn.disabled = option.disabled;
      btn.innerHTML = `
        <span><b>${option.label}</b><small>${option.disabled ? (used ? '今日已赶过集' : '资源不足') : option.hint}</small></span>
        <em>${option.disabled ? '缺' : '择'}</em>
      `;
      btn.addEventListener('click', () => {
        if (option.disabled) return;
        if (option.kind === 'leave') {
          this.closeStory();
          this.sync();
          return;
        }
        const result = this.game.market(option.kind);
        if (!result.ok) {
          this.callbacks.onToast?.(result.text);
          return;
        }
        this.showResult(result.text, () => {
          this.closeStory();
          this.sync();
        });
      });
      this.storyOptions.appendChild(btn);
    }
    this.notifyBlocking();
  }

  showPrologue(): void {
    this.showEvent(this.game.getPrologue(), () => {
      this.closeStory();
      this.openPanel();
      this.callbacks.onToast?.('为七名弟子安排任务，然后点「结束今日」');
    });
  }

  showPendingEvent(): boolean {
    const event = this.game.getEvent();
    if (!event) return false;
    this.showEvent(event, () => {
      this.closeStory();
      if (this.game.ending) this.showEnding(this.game.ending);
      else this.openPanel();
    });
    return true;
  }

  /** Show today's event, then today's three candidates, or report nothing. */
  showDailyFlow(): boolean {
    if (this.game.state.pendingEvent) return this.showPendingEvent();
    if (this.game.hasCandidates) {
      this.showCandidates();
      return true;
    }
    return false;
  }

  showCandidates(): void {
    const s = this.game.state;
    this.openStory();
    this.storyKicker.textContent = `第 ${s.day} 日 · 晨`;
    this.storyTitle.textContent = '今日三事';
    this.storyText.textContent = '山门每天都有事。你只有一双手，今日只接一件；也可以不接。';
    this.storyCast.innerHTML = '';
    this.storySpeaker.classList.add('is-hidden');
    this.storyOptions.innerHTML = '';
    this.storyResult.classList.add('is-hidden');

    for (const id of s.candidates) {
      const event = this.game.getEventById(id);
      if (!event) continue;
      const main = id === s.candidateMain;
      const brief = event.text.replace(/\s+/g, ' ').trim().slice(0, 54);
      const tier = event.tier ?? 2;
      const risk = event.risk ?? 'middle';
      const riskLabel = risk === 'high' ? '高风险' : risk === 'middle' ? '中风险' : '低风险';
      const btn = document.createElement('button');
      btn.className = `story-option candidate${main ? ' main' : ''}`;
      btn.innerHTML = `
        <span><b>${main ? '【主线】' : ''}${event.title}</b><span class="candidate-tags"><i>Lv.${tier}</i><i class="risk ${risk}">${riskLabel}</i></span><small>${event.kicker}</small><em class="candidate-brief">${brief}${event.text.length > 54 ? '…' : ''}</em></span>
        <em>选</em>
      `;
      btn.addEventListener('click', () => {
        if (!this.game.chooseCandidate(id)) return;
        this.showPendingEvent();
      });
      this.storyOptions.appendChild(btn);
    }

    const skip = document.createElement('button');
    skip.className = 'story-option candidate skip';
    skip.innerHTML = `<span><b>今日不接</b><small>不处理任何候选，直接进下一日</small></span><em>过</em>`;
    skip.addEventListener('click', () => {
      this.game.skipCandidates();
      this.closeStory();
      this.openPanel();
      this.sync();
    });
    this.storyOptions.appendChild(skip);
    this.storyOptions.querySelector<HTMLButtonElement>('button')?.focus();
    this.notifyBlocking();
  }

  showEnding(ending: Ending): void {
    this.panel.classList.add('is-hidden');
    this.story.classList.remove('is-hidden');
    this.storyResult.classList.add('is-hidden');
    this.storyKicker.textContent = '本章终 · 青云宗志';
    this.storyTitle.textContent = ending.title;
    this.storyText.innerHTML = '';

    const sub = document.createElement('p');
    sub.textContent = ending.subtitle;
    sub.style.color = 'rgba(200,161,90,.75)';
    sub.style.letterSpacing = '.18em';
    sub.style.fontSize = '11px';
    this.storyText.appendChild(sub);

    const body = document.createElement('p');
    body.textContent = ending.text;
    this.storyText.appendChild(body);

    const score = document.createElement('div');
    score.className = 'ending-score';
    score.innerHTML = `<b>${ending.score}</b><span>宗门评分 / 100</span>`;
    this.storyText.appendChild(score);

    const epi = document.createElement('div');
    epi.className = 'ending-epilogues';
    for (const line of ending.epilogues) {
      const p = document.createElement('p');
      p.textContent = line;
      epi.appendChild(p);
    }
    this.storyText.appendChild(epi);

    this.storyCast.innerHTML = '';
    this.storyOptions.innerHTML = '';
    this.storyResult.classList.add('is-hidden');

    const ngp = document.createElement('button');
    ngp.className = 'sect-btn primary';
    ngp.textContent = `携功业重开 · 第 ${this.game.state.cycle + 2} 周目 · 功业 ${this.game.state.sectMerits}`;
    ngp.addEventListener('click', () => {
      this.game.newGamePlus();
      this.closeStory();
      this.selected = 'gu';
      this.showPrologue();
      this.sync();
    });
    this.storyOptions.appendChild(ngp);

    const restart = document.createElement('button');
    restart.className = 'sect-btn ghost';
    restart.textContent = '再开一局';
    restart.addEventListener('click', () => {
      this.game.reset();
      this.closeStory();
      this.selected = 'gu';
      this.showPrologue();
      this.sync();
    });
    this.storyOptions.appendChild(restart);

    const stay = document.createElement('button');
    stay.className = 'sect-btn ghost';
    stay.textContent = '留在山门';
    stay.addEventListener('click', () => {
      if (!this.game.enterFreeMode()) return;
      this.closeStory();
      this.selected = this.game.state.disciples.find((d) => d.active)?.id ?? 'gu';
      this.openPanel(true);
      this.callbacks.onToast?.('自由修行 · 大比之后，日子还长');
      this.sync();
    });
    this.storyOptions.appendChild(stay);
    this.notifyBlocking();
    this.sync();
  }

  render(): void {
    const s = this.game.state;
    this.sectDay.textContent = String(s.day);
    this.sectDayTotal.textContent = s.freeMode ? '/ 自由' : `/ ${s.maxDay} 日`;

    if (!s.disciples.some((d) => d.id === this.selected && d.active)) {
      this.selected = s.disciples.find((d) => d.active)?.id ?? s.disciples[0]?.id ?? 'gu';
    }

    this.renderResources(s);
    this.renderMaster(s);
    this.renderList(s);
    this.renderDetail(s);
    this.renderUpgrades(s);
    this.renderLog(s);

    const left = Math.max(0, s.maxDay - s.day);
    const arcs = this.game.arcStatus();
    const goal = s.ending
      ? '本章已结束。'
      : s.freeMode
        ? `自由修行 · 第 ${s.day} 日 · 行动 ${s.actionPoints}/${this.game.maxActionPoints} · 人物线 ${arcs.done}/${arcs.total}`
        : `距三宗大比还有 ${left} 日 · 行动 ${s.actionPoints}/${this.game.maxActionPoints} · 今日安排决定明日。`;
    const duty = s.ending ? null : this.game.objectiveDesc();
    const rank = sectRank(s.sectMerits);
    const roster = s.disciples.filter((d) => d.active).length;
    const gone = s.disciples.filter((d) => !d.active).length;
    const perk = this.game.perk;
    const cycleText = s.cycle > 0 ? ` · 第 ${s.cycle + 1} 周目` : '';
    const se = seasonOf(s.day);
    const year = Math.floor((s.day - 1) / 12) + 1;
    const perkText = s.sectMerits > 0
      ? `香火「${perk.label}」· 行动 +${perk.actionPoints}${perk.extraCandidates ? ' · 候选 +1' : ''}`
      : '';
    const lifeLeft = s.player.lifespan - s.player.age;
    const lifeWarn = lifeLeft <= 15
      ? `<div class="obj-line obj-perk obj-life-warn">寿元将尽 · 尚余 ${lifeLeft} 年</div>`
      : '';
    this.objective.innerHTML = `
      <div class="obj-line">${goal}</div>
      ${duty ? `<div class="obj-line obj-daily">${duty}</div>` : ''}
      <div class="obj-line obj-meta">宗阶「${rank.name}」· ${se.name}日 · 第 ${year} 年 / ${s.player.age} 岁 · 功业 ${s.sectMerits} · 香火 ${s.sectFaith} · 在册 ${roster}，离山 ${gone} · 开局「${s.opening.name}」${cycleText}</div>
      ${perkText ? `<div class="obj-line obj-perk">${perkText}</div>` : ''}
      ${lifeWarn}
    `;

    this.endDay.disabled = Boolean(s.ending);
    this.endDay.textContent = s.ending ? '本章已终' : s.freeMode ? '结束今日 · 自由修行' : '结束今日';
    this.trialBtn.disabled = Boolean(s.ending);
    this.tutorial.classList.toggle('is-hidden', s.day > 1 || s.freeMode || Boolean(s.ending));
  }

  /** Called by main when the state changed outside the panel (trial, day). */
  sync(): void {
    this.callbacks.onStateChange?.();
    if (this.panelOpen) this.render();
  }

  private renderResources(s: GameState): void {
    this.sectRes.innerHTML = `
      <span>灵石 <b>${s.resources.stones}</b></span>
      <span>药材 <b>${s.resources.herbs}</b></span>
      <span>心得 <b>${s.resources.insight}</b></span>
      <span>声望 <b>${s.resources.reputation}</b></span>
      <span>道心 <b>${s.resources.morale}</b></span>
    `;
  }

  private renderList(s: GameState): void {
    this.list.innerHTML = '';
    for (const d of s.disciples) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `disciple-card${d.id === this.selected ? ' selected' : ''}${d.active ? '' : ' departed'}`;
      card.dataset.disciple = d.id;
      card.innerHTML = `
        <img src="${portraitFor(d)}" alt="${d.name}" />
        <div>
          <div class="dc-name">${d.name}</div>
          <div class="dc-title">${d.title} · ${realmName(d.realmIndex)}</div>
          <div class="dc-meta">
            <span class="dc-task">${d.active ? TASK_LABEL[d.assignment] : '已离开'}</span>
            <span>${d.root}</span>
            ${d.active && (d.strain ?? 0) >= 2 ? '<span class="dc-warn">心绪不稳</span>' : ''}
          </div>
          <div class="dc-bars">
            <i style="--v:${d.bond}%"></i>
            <i style="--v:${d.mood}%"></i>
            <i style="--v:${100 - d.injury}%"></i>
          </div>
        </div>
      `;
      this.list.appendChild(card);
    }
  }

  private renderDetail(s: GameState): void {
    const d = s.disciples.find((x) => x.id === this.selected);
    if (!d) {
      this.detail.innerHTML = '<p style="color:rgba(233,225,209,.4)">弟子名册是空的。</p>';
      return;
    }

    const known = secretKnown(d, s);

    const rel = Object.entries(d.relationships)
      .map(([id, v]) => ({ d: s.disciples.find((x) => x.id === id), v }))
      .filter((x) => x.d)
      .sort((a, b) => Math.abs(b.v) - Math.abs(a.v))
      .slice(0, 4)
      .map(
        ({ d: other, v }) => `
        <div class="rel-line"><span>${other!.name} · ${relationLabel(v)}</span><b>${v > 0 ? '+' : ''}${Math.round(v)}</b></div>
      `,
      )
      .join('');

    const stats = [
      ['灵根', d.stats.aptitude],
      ['悟性', d.stats.insight],
      ['根骨', d.stats.body],
      ['心性', d.stats.heart],
      ['气运', d.stats.luck],
    ] as const;

    this.detail.innerHTML = `
      <div class="detail-top">
        <div class="detail-portrait">
          <div class="portrait-mono" style="--robe:${d.palette.robe};--accent:${d.palette.accent}">
            <span>${d.name.slice(0, 1)}</span>
            <i>${d.epithet}</i>
          </div>
          <div class="detail-seal">${d.active ? '在册' : '离山'}</div>
        </div>
        <div>
          <div class="detail-name">${d.name}</div>
          <div class="detail-sub">${d.title} · ${d.role} · ${d.root}</div>
          <div class="detail-epithet">「${d.epithet}」</div>
          <div class="trait-row">
            ${d.traits.map((t) => `<span class="trait">${t}</span>`).join('')}
            <span class="trait gold">${realmName(d.realmIndex)}</span>
          </div>
          <div class="detail-quote">${known ? d.secret : '他/她似乎藏着什么。多给一点信任，或许会说出来。'}</div>
          <div class="detail-vitals">
            <span>忠诚 <b>${Math.round(d.bond)}</b></span>
            <span>道心 <b>${Math.round(d.mood)}</b></span>
            <span>伤势 <b>${Math.round(d.injury)}</b></span>
          </div>
        </div>
      </div>

      <div class="stat-grid">
        ${stats
          .map(
            ([label, v]) => `
          <div class="stat-line"><span>${label}</span><div class="track"><i style="width:${v * 10}%"></i></div><b>${v}</b></div>
        `,
          )
          .join('')}
      </div>

      <div class="detail-section">
        <h3>今日安排</h3>
        <div class="assign-row">
          ${TASKS.map(
            (t) => `
            <button class="assign-btn${d.assignment === t.id ? ' active' : ''}" data-task="${t.id}" title="${t.description}"
              ${!d.active || Boolean(s.ending) || (d.injury >= 70 && t.id !== 'rest') ? 'disabled' : ''}>
              <span>${t.icon}</span>${t.label}
            </button>
          `,
          ).join('')}
        </div>
        <p class="task-hint">${TASKS.find((t) => t.id === d.assignment)?.description ?? ''}<br />今日去处：${SPOT_LABEL[d.assignment]}</p>
        <div class="care-row">
          <button class="gift-btn" data-gift="1" ${!d.active || Boolean(s.ending) || s.gifts.includes(d.id) || s.resources.stones < 30 ? 'disabled' : ''}>
            赠礼 · 灵石 30 · 忠诚 +8
          </button>
          <button class="gift-btn" data-pill="1" ${!d.active || Boolean(s.ending) || s.pills.includes(d.id) || s.resources.herbs < 20 ? 'disabled' : ''}>
            温养 · 药材 20 · 修为 +10
          </button>
        </div>
      </div>

      <div class="detail-section">
        <h3>功法</h3>
        <div class="tech-line">
          <span>${d.technique ? `${technique(d.technique)?.name ?? '秘传'} · ${technique(d.technique)?.bonus ?? ''}` : '尚未传法'}</span>
          <button class="teach-btn" data-teach="1" ${!d.active || Boolean(s.ending) ? 'disabled' : ''}>传授功法 · 耗心得</button>
        </div>
      </div>

      <div class="detail-section">
        <h3>关系</h3>
        <div class="rel-list">${rel || '<span style="font-size:9px;color:rgba(233,225,209,.3)">独来独往。</span>'}</div>
      </div>
    `;
  }

  private renderUpgrades(s: GameState): void {
    this.upgrades.innerHTML = '<p class="upgrade-hint">按 C 俯瞰山门，点击建筑或左侧列表升级。</p>';
    for (const def of BUILDINGS) {
      const b = s.buildings[def.id];
      if (!b) continue;
      const card = document.createElement('div');
      card.className = 'upgrade-card owned';
      card.innerHTML = `
        <div class="upgrade-name">${def.name} <span class="building-lv-inline">Lv.${b.level}</span></div>
        <div class="upgrade-effect">${buildingEffect(def, b.level)}</div>
        <div class="upgrade-desc">${b.construction > 0 ? `施工中 · 剩余 ${b.construction} 日` : def.description}</div>
      `;
      this.upgrades.appendChild(card);
    }
  }

  private renderLog(s: GameState): void {
    const entries = s.log.slice(0, 8);
    this.log.innerHTML = entries
      .map(
        (e) => `
      <div class="log-entry ${e.tone}"><b>第 ${e.day} 日</b>${e.text}</div>
    `,
      )
      .join('');
  }

  private handleEndDay(): void {
    if (this.game.ending) return;
    if (!this.game.canEndDay()) {
      this.callbacks.onToast?.('先处理今日候选，再结束今日。');
      return;
    }
    const result = this.game.endDay();
    this.render();
    this.sync();
    this.callbacks.onDayAdvanced?.(this.game.state.day);

    this.showReport(result.report, () => {
      if (result.ending) {
        this.showEnding(result.ending);
        return;
      }
      if (!this.showDailyFlow()) {
        this.openPanel();
        this.sync();
      }
    });
  }

  private showReport(report: DayReport, next: () => void): void {
    this.openStory();
    this.storyKicker.textContent = `第 ${report.day} 日 · 夜`;
    this.storyTitle.textContent = '今日结算';
    this.storyText.innerHTML = '';
    this.storyCast.innerHTML = '';
    this.storySpeaker.classList.add('is-hidden');

    const ul = document.createElement('ul');
    ul.className = 'report-list';
    if (report.lines.length === 0) {
      const li = document.createElement('li');
      li.textContent = '山中无事。';
      ul.appendChild(li);
    } else {
      for (const line of report.lines) {
        const li = document.createElement('li');
        li.className = line.tone;
        li.textContent = line.text;
        ul.appendChild(li);
      }
    }
    this.storyText.appendChild(ul);

    this.storyOptions.innerHTML = '';
    this.storyResult.classList.add('is-hidden');
    const btn = document.createElement('button');
    btn.className = 'sect-btn primary';
    btn.textContent = '继续';
    btn.addEventListener('click', () => {
      this.closeStory();
      next();
    });
    this.storyOptions.appendChild(btn);
    btn.focus();
    this.notifyBlocking();
  }

  private showEvent(event: StoryEvent, done: () => void): void {
    this.openStory();
    this.storyKicker.textContent = event.kicker;
    this.storyTitle.textContent = event.title;
    this.storyText.textContent = event.text;
    this.storyCast.innerHTML = '';
    this.storySpeaker.classList.add('is-hidden');
    const arcOwner = event.id.startsWith('shen_')
      ? 'shen'
      : event.id.startsWith('gu_')
        ? 'gu'
        : event.id.startsWith('lu_')
          ? 'lu'
          : null;
    if (arcOwner) {
      const d = this.game.state.disciples.find((x) => x.id === arcOwner);
      if (d) {
        this.storySpeaker.classList.remove('is-hidden');
        this.speakerImg.src = portraitFor(d);
        this.speakerImg.alt = d.name;
        this.speakerName.textContent = `${d.title} · ${d.role}`;
        this.speakerRole.textContent = `${d.root} · ${realmName(d.realmIndex)} · 忠诚 ${Math.round(d.bond)}`;
      }
    }
    if (event.id === 'prologue' || event.id === 'tournament') {
      for (const d of this.game.state.disciples) {
        const member = document.createElement('div');
        member.className = `cast-member${d.active ? '' : ' departed'}`;
        member.innerHTML = `<img src="${portraitFor(d)}" alt="${d.name}" /><span>${d.name}</span>`;
        this.storyCast.appendChild(member);
      }
    }
    this.storyOptions.innerHTML = '';
    this.storyResult.classList.add('is-hidden');

    for (const option of event.options) {
      const btn = document.createElement('button');
      btn.className = 'story-option';
      const allowed = !option.requires || option.requires(this.game.state);
      const chance = option.check ? ` · 成功率 ${this.game.checkChance(option)}%` : '';
      btn.disabled = !allowed;
      btn.innerHTML = `
        <span><b>${option.label}</b><small>${allowed ? `${option.hint}${chance}` : option.requireText ?? '条件不足'}</small></span>
        <em>${allowed ? '择' : '缺'}</em>
      `;
      btn.addEventListener('click', () => {
        if (!allowed) return;
        const result = this.game.choose(event.id, option.id);
        if (result.ending) {
          this.showEnding(result.ending);
          return;
        }
        this.showResult(result.text, () => {
          this.closeStory();
          done();
          this.sync();
        });
      });
      this.storyOptions.appendChild(btn);
    }
    this.storyOptions.querySelector<HTMLButtonElement>('button')?.focus();
    this.notifyBlocking();
  }

  private showResult(text: string, next: () => void): void {
    this.storyOptions.innerHTML = '';
    this.storyResult.classList.remove('is-hidden');
    this.storyResultText.textContent = text || '风从山门吹过。';
    this.continueAction = next;
    this.storyContinue.focus();
    this.notifyBlocking();
  }

  private openStory(): void {
    this.story.classList.remove('is-hidden');
    this.storyResult.classList.add('is-hidden');
    this.continueAction = null;
    this.notifyBlocking();
  }

  private closeStory(): void {
    this.story.classList.add('is-hidden');
    this.storySpeaker.classList.add('is-hidden');
    this.continueAction = null;
    this.notifyBlocking();
  }

  private handleTrial(): void {
    if (this.game.ending) return;
    this.closePanel();
    this.callbacks.onTrial?.();
  }

  private handleNewGame(): void {
    if (!window.confirm('重开一局？当前进度会丢失。')) return;
    this.game.reset();
    this.selected = 'gu';
    this.render();
    this.showPrologue();
    this.sync();
  }

  private notifyBlocking(): void {
    this.callbacks.onBlockingChange?.(this.isBlocking);
  }
}
