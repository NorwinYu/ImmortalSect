type Quality = 'high' | 'medium' | 'low';

const SHICHEN = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el;
}

export class Hud {
  onStart?: () => void;
  onQuality?: () => void;
  onAudio?: () => void;
  onSect?: () => void;
  onMap?: () => void;
  onOverview?: () => void;
  onAchievements?: () => void;

  private readonly loading = $('loading');
  private readonly loadBar = $('load-bar');
  private readonly loadText = $('load-text');
  private readonly startBtn = $('start') as HTMLButtonElement;
  private readonly hud = $('hud');
  private readonly perf = $('perf');
  private readonly toastEl = $('toast');
  private readonly letterbox = $('letterbox');
  private readonly help = $('help');
  private readonly dateEl = $('hud-date');
  private readonly timeEl = $('hud-time');
  private readonly qualityBtn = $('btn-quality');
  private readonly audioBtn = $('btn-audio');
  private readonly helpBtn = $('btn-help');
  private readonly helpClose = $('help-close');
  private readonly hintExplore = $('hint-explore');
  private readonly hintCombat = $('hint-combat');
  private readonly btnSect = $('btn-sect');
  private readonly hudStones = $('hud-stones');
  private readonly hudHerbs = $('hud-herbs');
  private readonly hudInsight = $('hud-insight');
  private readonly hudReputation = $('hud-reputation');
  private readonly hudObjective = $('hud-objective');
  private readonly worldPrompt = $('world-prompt');
  private readonly worldPromptText = $('world-prompt-text');
  private readonly hudRegion = $('hud-region');
  private readonly hudRealm = $('hud-realm');
  private readonly hudCultivation = $('hud-cultivation');
  private readonly btnMap = $('btn-map');
  private readonly btnOverview = $('btn-overview');
  private readonly btnAchv = $('btn-achv');

  private toastTimer = 0;
  private perfVisible = false;
  private uiHidden = false;
  private calendarDay = 1;

  constructor() {
    this.startBtn.addEventListener('click', () => this.onStart?.());
    this.qualityBtn.addEventListener('click', () => this.onQuality?.());
    this.audioBtn.addEventListener('click', () => this.onAudio?.());
    this.btnSect.addEventListener('click', () => this.onSect?.());
    this.btnMap.addEventListener('click', () => this.onMap?.());
    this.btnOverview.addEventListener('click', () => this.onOverview?.());
    this.btnAchv.addEventListener('click', () => this.onAchievements?.());
    this.helpBtn.addEventListener('click', () => this.openHelp());
    this.helpClose.addEventListener('click', () => this.closeHelp());
    this.help.addEventListener('click', (e) => {
      if (e.target === this.help) this.closeHelp();
    });

    this.perf.style.display = 'none';
  }

  get blocking(): boolean {
    return !this.help.classList.contains('is-hidden') || !this.loading.classList.contains('is-hidden');
  }

  setProgress(p: number, text: string): void {
    this.loadBar.style.width = `${Math.round(p * 100)}%`;
    this.loadText.textContent = text;
  }

  ready(): void {
    this.setProgress(1, '山门已开');
    this.startBtn.classList.remove('is-hidden');
  }

  hideLoading(): void {
    this.loading.classList.add('is-hidden');
  }

  showHud(): void {
    this.hud.classList.remove('is-hidden');
  }

  setLetterbox(active: boolean): void {
    this.letterbox.classList.toggle('is-hidden', !active);
    this.letterbox.classList.toggle('active', active);
  }

  setTime(hour: number): void {
    const idx = Math.floor((((hour + 1) % 24) / 2) % 12);
    const phase = hour < 5 ? '夜' : hour < 7 ? '晨' : hour < 17 ? '昼' : hour < 19.5 ? '暮' : '夜';
    this.timeEl.textContent = `${SHICHEN[idx]}时 · ${phase} · 晴`;
    this.dateEl.textContent = `天元三百一十二年 · 秋 · 第 ${this.calendarDay} 日`;
  }

  setPerf(stats: { fps: number; ms: number; calls: number; tris: number; quality: Quality }): void {
    if (!this.perfVisible) return;
    const q = stats.quality === 'high' ? '高' : stats.quality === 'medium' ? '中' : '低';
    this.perf.textContent =
      `帧率 ${stats.fps.toFixed(0).padStart(3)} · ${stats.ms.toFixed(1)}ms\n` +
      `绘制 ${stats.calls} · 三角面 ${(stats.tris / 1_000_000).toFixed(2)}M\n` +
      `画质 ${q} · 实时`;
    this.perf.classList.toggle('warn', stats.fps < 48);
  }

  setAchievements(have: number, total: number): void {
    this.btnAchv.textContent = have >= total ? '成就 ✓' : `成就 ${have}/${total}`;
  }

  togglePerf(): void {
    this.perfVisible = !this.perfVisible;
    this.perf.style.display = this.perfVisible ? 'block' : 'none';
  }

  toggleUi(): void {
    this.uiHidden = !this.uiHidden;
    this.hud.classList.toggle('is-hidden', this.uiHidden);
  }

  toast(message: string, duration = 2200): void {
    this.toastEl.textContent = message;
    this.toastEl.classList.add('show');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('show'), duration);
  }

  setQuality(q: Quality): void {
    this.qualityBtn.textContent = `画质 · ${q === 'high' ? '高' : q === 'medium' ? '中' : '低'}`;
  }

  setAudio(muted: boolean): void {
    this.audioBtn.textContent = `音 · ${muted ? '关' : '开'}`;
  }

  setGameInfo(
    day: number,
    maxDay: number,
    resources: { stones: number; herbs: number; insight: number; reputation: number },
    ended: boolean,
    freeMode = false,
    actionPoints = 3,
    duty?: string | null,
    maxAction = 3,
  ): void {
    this.calendarDay = day;
    this.hudStones.textContent = String(resources.stones);
    this.hudHerbs.textContent = String(resources.herbs);
    this.hudInsight.textContent = String(resources.insight);
    this.hudReputation.textContent = String(resources.reputation);
    const base = ended
      ? '本章已终 · 宗门志待书'
      : freeMode
        ? `自由修行 · 第 ${day} 日 · 行动 ${actionPoints}/${maxAction}`
        : `距三宗大比 · ${Math.max(0, maxDay - day)} 日 · 行动 ${actionPoints}/${maxAction}`;
    this.hudObjective.textContent = duty ? `${base} ｜ ${duty}` : base;
  }

  setWorldPrompt(text: string | null): void {
    this.worldPrompt.classList.toggle('is-hidden', !text);
    if (text) this.worldPromptText.innerHTML = text;
  }

  setRegion(name: string): void {
    this.hudRegion.textContent = name;
  }

  setOverview(on: boolean): void {
    this.btnOverview.textContent = on ? '返回行走 · C' : '俯瞰 · C';
    this.btnOverview.classList.toggle('active', on);
  }

  setPlayerCultivation(realm: string, value: number, bottleneck: boolean): void {
    this.hudRealm.textContent = bottleneck ? `${realm} · 瓶颈` : realm;
    this.hudCultivation.style.width = `${Math.max(0, Math.min(100, value))}%`;
    this.hudCultivation.style.background = bottleneck
      ? 'linear-gradient(90deg, #a53a2d, #e0b45e)'
      : '';
  }

  setCombatHints(on: boolean): void {
    this.hintExplore.classList.toggle('is-hidden', on);
    this.hintCombat.classList.toggle('is-hidden', !on);
  }

  openHelp(): void {
    this.help.classList.remove('is-hidden');
  }

  closeHelp(): void {
    this.help.classList.add('is-hidden');
  }

  get helpOpen(): boolean {
    return !this.help.classList.contains('is-hidden');
  }

  hideStart(): void {
    this.startBtn.classList.add('is-hidden');
  }
}
