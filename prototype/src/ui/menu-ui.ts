import { Game } from '../game/game';
import {
  SLOT_LABEL,
  formatDate,
  formatPlaytime,
  type SlotId,
} from '../game/saves';

type SaveMode = 'save' | 'load';
type SaveOrigin = 'title' | 'pause';

interface Callbacks {
  onStartContinue: () => void;
  onStartNew: () => void;
  onLoadSlot: (slot: SlotId, from: 'title' | 'pause') => void;
  onSaveSlot: (slot: SlotId) => void;
  onDeleteSlot: (slot: SlotId) => void;
  onTitleBack: () => void;
  onQuality: () => void;
  onAudio: () => void;
  onToast: (message: string) => void;
}

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el;
}

export class MenuUI {
  private readonly title = $('title-menu');
  private readonly pause = $('pause-menu');
  private readonly saves = $('save-menu');
  private readonly titleMeta = $('title-meta');
  private readonly pauseMeta = $('pause-meta');
  private readonly saveTitle = $('save-title');
  private readonly saveList = $('save-list');
  private readonly saveNote = $('save-note');
  private readonly continueBtn = $('title-continue') as HTMLButtonElement;
  private readonly titleQuality = $('title-quality');
  private readonly titleAudio = $('title-audio');
  private readonly pauseQuality = $('pause-quality');
  private readonly pauseAudio = $('pause-audio');
  private readonly importBtn = $('save-import');
  private readonly fileInput = $('save-file') as HTMLInputElement;
  private readonly saveClose = $('save-close');

  private saveMode: SaveMode = 'load';
  private saveOrigin: SaveOrigin = 'title';

  constructor(
    private readonly game: Game,
    private readonly callbacks: Callbacks,
  ) {
    this.continueBtn.addEventListener('click', () => {
      if (!this.canContinue()) return;
      this.closeAll();
      this.callbacks.onStartContinue();
    });

    $('title-new').addEventListener('click', () => {
      if (this.hasProgress() && !window.confirm('开始新的旅程？当前进度仍保存在自动存档中。')) return;
      this.closeAll();
      this.callbacks.onStartNew();
    });

    $('title-load').addEventListener('click', () => this.openSaves('load', 'title'));
    this.titleQuality.addEventListener('click', () => this.callbacks.onQuality());
    this.titleAudio.addEventListener('click', () => this.callbacks.onAudio());

    this.pause.addEventListener('click', (event) => {
      const btn = (event.target as HTMLElement).closest<HTMLElement>('[data-pause]');
      if (!btn) return;
      const action = btn.dataset.pause;
      if (action === 'resume') this.closeAll();
      if (action === 'save') this.openSaves('save', 'pause');
      if (action === 'load') this.openSaves('load', 'pause');
      if (action === 'title') {
        if (window.confirm('回到标题？当前进度已自动保存。')) {
          this.callbacks.onTitleBack();
        }
      }
    });
    this.pauseQuality.addEventListener('click', () => this.callbacks.onQuality());
    this.pauseAudio.addEventListener('click', () => this.callbacks.onAudio());

    this.saveClose.addEventListener('click', () => this.closeSaves());
    this.importBtn.addEventListener('click', () => this.fileInput.click());
    this.fileInput.addEventListener('change', () => {
      const file = this.fileInput.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const result = this.game.importText(String(reader.result ?? ''));
        this.callbacks.onToast(result.message);
        this.renderSaves();
      };
      reader.readAsText(file);
      this.fileInput.value = '';
    });

    this.saveList.addEventListener('click', (event) => {
      const btn = (event.target as HTMLElement).closest<HTMLElement>('[data-slot]');
      if (!btn) return;
      const slot = btn.dataset.slot as SlotId;
      const action = btn.dataset.action;
      const meta = this.game.listSaves().find((m) => m?.slot === slot) ?? null;

      if (action === 'save') {
        if (meta && !window.confirm(`覆盖${SLOT_LABEL[slot]}？`)) return;
        this.callbacks.onSaveSlot(slot);
        this.renderSaves();
      } else if (action === 'load') {
        if (!meta) return;
        this.closeAll();
        this.callbacks.onLoadSlot(slot, this.saveOrigin);
      } else if (action === 'delete') {
        if (!meta) return;
        if (!window.confirm(`删除${SLOT_LABEL[slot]}？`)) return;
        this.callbacks.onDeleteSlot(slot);
        this.renderSaves();
      } else if (action === 'export') {
        if (!meta) return;
        const text = this.game.exportSlot(slot);
        if (!text) return;
        const blob = new Blob([text], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `immortal-sect-${slot}.json`;
        a.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.callbacks.onToast(`已导出${SLOT_LABEL[slot]}`);
      }
    });
  }

  get isBlocking(): boolean {
    return (
      !this.title.classList.contains('is-hidden') ||
      !this.pause.classList.contains('is-hidden') ||
      !this.saves.classList.contains('is-hidden')
    );
  }

  get titleOpen(): boolean {
    return !this.title.classList.contains('is-hidden');
  }

  get pauseOpen(): boolean {
    return !this.pause.classList.contains('is-hidden');
  }

  openTitle(): void {
    this.pause.classList.add('is-hidden');
    this.saves.classList.add('is-hidden');
    this.title.classList.remove('is-hidden');
    this.renderTitle();
    this.updateSettings();
  }

  openPause(): void {
    this.game.save();
    this.title.classList.add('is-hidden');
    this.saves.classList.add('is-hidden');
    this.pause.classList.remove('is-hidden');
    this.renderPause();
    this.updateSettings();
  }

  closeAll(): void {
    this.title.classList.add('is-hidden');
    this.pause.classList.add('is-hidden');
    this.saves.classList.add('is-hidden');
  }

  handleEscape(): boolean {
    if (!this.saves.classList.contains('is-hidden')) {
      this.closeSaves();
      return true;
    }
    if (!this.pause.classList.contains('is-hidden')) {
      this.pause.classList.add('is-hidden');
      return true;
    }
    return false;
  }

  updateSettings(): void {
    const settings = this.game.getSettings();
    const q = settings.quality === 'high' ? '高' : settings.quality === 'medium' ? '中' : '低';
    this.titleQuality.textContent = `画质 · ${q}`;
    this.pauseQuality.textContent = `画质 · ${q}`;
    this.titleAudio.textContent = `音 · ${settings.muted ? '关' : '开'}`;
    this.pauseAudio.textContent = `音 · ${settings.muted ? '关' : '开'}`;
  }

  private hasProgress(): boolean {
    const latest = this.game.latestMeta();
    if (!latest) return false;
    return latest.day > 1 || latest.state.seenEvents.length > 0 || Boolean(latest.ending);
  }

  private canContinue(): boolean {
    return this.hasProgress();
  }

  private renderTitle(): void {
    const latest = this.game.latestMeta();
    this.continueBtn.disabled = !this.canContinue();
    if (!latest || !this.canContinue()) {
      this.titleMeta.textContent = '尚无进度 · 从新的旅程开始';
      return;
    }
    const ending = latest.ending ? ` · ${latest.ending}` : '';
    this.titleMeta.textContent = `最近 · 第 ${latest.day} 日${ending} · ${formatPlaytime(latest.playSeconds)}`;
  }

  private renderPause(): void {
    const s = this.game.state;
    const latest = this.game.latestMeta();
    const ending = s.ending ? ` · ${s.ending.title}` : '';
    this.pauseMeta.textContent =
      `第 ${s.day} 日 · ${s.ending ? '本章已终' : '残山剩水'}${ending}\n` +
      `在册 ${s.disciples.filter((d) => d.active).length} 人 · 游戏时长 ${formatPlaytime(this.game.playSeconds)}\n` +
      `自动存档 ${latest ? formatDate(latest.updatedAt) : '—'}`;
  }

  private openSaves(mode: SaveMode, origin: SaveOrigin): void {
    this.saveMode = mode;
    this.saveOrigin = origin;
    this.title.classList.add('is-hidden');
    this.pause.classList.add('is-hidden');
    this.saves.classList.remove('is-hidden');
    this.saveTitle.textContent = mode === 'save' ? '保存进度' : '载入存档';
    this.saveNote.textContent =
      mode === 'save'
        ? '自动存档在每次行动后更新；手动槽位可随时覆盖。'
        : '自动存档与三个手动槽位；导入的存档会写入存档一。';
    this.renderSaves();
  }

  private closeSaves(): void {
    this.saves.classList.add('is-hidden');
    if (this.saveOrigin === 'title') this.openTitle();
    else this.openPause();
  }

  private renderSaves(): void {
    const slots = this.game.listSaves();
    this.saveList.innerHTML = '';

    for (const slot of ['auto', '1', '2', '3'] as SlotId[]) {
      const meta = slots.find((m) => m?.slot === slot) ?? null;
      const row = document.createElement('div');
      row.className = `save-row${meta ? '' : ' empty'}${slot === 'auto' ? ' auto' : ''}`;

      const info = document.createElement('div');
      info.className = 'save-info';
      if (meta) {
        info.innerHTML = `
          <b>${SLOT_LABEL[slot]}${meta.ending ? ' · 已通关' : ''}</b>
          <span>第 ${meta.day} 日 · ${meta.chapter}${meta.ending ? ` · <em>${meta.ending}</em>` : ''}</span>
          <span>${formatDate(meta.updatedAt)} · ${formatPlaytime(meta.playSeconds)} · 在册 ${meta.active} 人</span>
        `;
      } else {
        info.innerHTML = `<b>${SLOT_LABEL[slot]}</b><span>空存档</span>`;
      }

      const actions = document.createElement('div');
      actions.className = 'save-actions';

      if (this.saveMode === 'save' && slot !== 'auto') {
        const save = document.createElement('button');
        save.dataset.slot = slot;
        save.dataset.action = 'save';
        save.className = 'primary';
        save.textContent = meta ? '覆盖' : '保存';
        actions.appendChild(save);
      }

      if (meta) {
        const load = document.createElement('button');
        load.dataset.slot = slot;
        load.dataset.action = 'load';
        if (this.saveMode === 'load') load.className = 'primary';
        load.textContent = '载入';
        actions.appendChild(load);

        const exportBtn = document.createElement('button');
        exportBtn.dataset.slot = slot;
        exportBtn.dataset.action = 'export';
        exportBtn.textContent = '导出';
        actions.appendChild(exportBtn);

        if (slot !== 'auto') {
          const del = document.createElement('button');
          del.dataset.slot = slot;
          del.dataset.action = 'delete';
          del.className = 'danger';
          del.textContent = '删除';
          actions.appendChild(del);
        }
      }

      row.append(info, actions);
      this.saveList.appendChild(row);
    }
  }
}
