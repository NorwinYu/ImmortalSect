/**
 * First-run onboarding. A short, skippable, step-by-step card that explains
 * the one loop the game expects you to understand: move → read the day's
 * objective → open the sect ledger → practise in the trial duel.
 */
export interface TutorialStep {
  title: string;
  text: string;
}

const DESKTOP_STEPS: TutorialStep[] = [
  {
    title: '走一走',
    text: 'WASD 行走，Shift 疾行，Space 跃起。\n按住鼠标拖拽可以环视，滚轮拉远拉近。\n靠近弟子时按 F 与他交谈。',
  },
  {
    title: '看今天要做什么',
    text: '每天会给你一条「今日要务」。完成后宗门功业 +，山门才能往上升。\n屏幕右下角会提示今日的行动点，用完了就到「结束今日」。',
  },
  {
    title: '打开宗门簿',
    text: '按 B 打开宗门簿：左边是七名弟子，中间安排他们今日的差事，右边是建筑与日志。\n建筑可以升级，升到三级会长出新的外观。',
  },
  {
    title: '去剑坪试试身手',
    text: '走近试剑傀儡会自动开战。左键三段剑，右键重击，Q 闪避，E 剑气，F 处决。\n赢三场，可以拿到第一件掌门法宝。',
  },
];

const TOUCH_STEPS: TutorialStep[] = [
  {
    title: '走一走',
    text: '左下角是摇杆，推到底会自动疾行。\n右半屏单指拖拽环视，双指捏合缩放。\n走近弟子时会出现「交谈」按钮。',
  },
  {
    title: '看今天要做什么',
    text: '每天会给你一条「今日要务」。完成后宗门功业 +，山门才能往上升。\n右下角的按钮用完了，就点「结束今日」。',
  },
  {
    title: '打开宗门簿',
    text: '点右上角「宗门」：左边是七名弟子，中间安排他们今日的差事，右边是建筑与日志。\n建筑可以升级，升到三级会长出新的外观。',
  },
  {
    title: '去剑坪试试身手',
    text: '走近试剑傀儡会自动开战。点屏幕轻击，「重击 / 闪避 / 剑气 / 处决」都在右侧。\n赢三场，可以拿到第一件掌门法宝。',
  },
];

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el;
}

export class Tutorial {
  isBlocking = false;
  /** Called when the player finishes or skips (the shell marks it done). */
  onDone?: () => void;
  /** Called whenever blocking state changes. */
  onBlockingChange?: (blocking: boolean) => void;

  private readonly root = $('tutorial');
  private readonly stepEl = $('tutorial-step');
  private readonly titleEl = $('tutorial-title');
  private readonly textEl = $('tutorial-text');
  private readonly dotsEl = $('tutorial-dots');
  private readonly skipBtn = $('tutorial-skip') as HTMLButtonElement;
  private readonly nextBtn = $('tutorial-next') as HTMLButtonElement;

  private readonly steps: TutorialStep[];
  private index = 0;

  constructor(touch: boolean) {
    this.steps = touch ? TOUCH_STEPS : DESKTOP_STEPS;
    this.nextBtn.addEventListener('click', () => this.next());
    this.skipBtn.addEventListener('click', () => this.finish());
  }

  get open(): boolean {
    return this.isBlocking;
  }

  begin(): void {
    this.index = 0;
    this.render();
    this.root.classList.remove('is-hidden');
    this.setBlocking(true);
  }

  next(): void {
    if (this.index >= this.steps.length - 1) {
      this.finish();
      return;
    }
    this.index += 1;
    this.render();
  }

  finish(): void {
    this.root.classList.add('is-hidden');
    this.setBlocking(false);
    this.onDone?.();
  }

  private setBlocking(v: boolean): void {
    this.isBlocking = v;
    this.onBlockingChange?.(v);
  }

  private render(): void {
    const step = this.steps[this.index];
    this.stepEl.textContent = `${this.index + 1} / ${this.steps.length}`;
    this.titleEl.textContent = step.title;
    this.textEl.textContent = step.text;
    this.dotsEl.innerHTML = this.steps
      .map((_, i) => `<i class="${i <= this.index ? 'on' : ''}"></i>`)
      .join('');
    this.nextBtn.textContent = this.index >= this.steps.length - 1 ? '开始经营' : '下一步';
  }
}
