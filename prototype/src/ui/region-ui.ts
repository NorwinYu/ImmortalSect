import { REGIONS, type RegionId } from '../game/scenes';

interface Callbacks {
  onTravel: (id: RegionId) => void;
}

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el;
}

export class RegionUI {
  private readonly root = $('region-map');
  private readonly list = $('region-list');
  private readonly closeBtn = $('region-close');

  constructor(private readonly callbacks: Callbacks) {
    this.closeBtn.addEventListener('click', () => this.close());
    this.list.addEventListener('click', (event) => {
      const tile = (event.target as HTMLElement).closest<HTMLElement>('[data-region]');
      if (!tile) return;
      const id = tile.dataset.region as RegionId;
      if (id === this.current) return;
      this.callbacks.onTravel(id);
    });
  }

  private current: RegionId = 'sect';
  private used: string[] = [];

  get isBlocking(): boolean {
    return !this.root.classList.contains('is-hidden');
  }

  open(current: RegionId, used: string[]): void {
    this.current = current;
    this.used = used;
    this.render();
    this.root.classList.remove('is-hidden');
  }

  close(): void {
    this.root.classList.add('is-hidden');
  }

  toggle(current: RegionId, used: string[]): void {
    if (this.isBlocking) this.close();
    else this.open(current, used);
  }

  handleEscape(): boolean {
    if (!this.isBlocking) return false;
    this.close();
    return true;
  }

  private render(): void {
    this.list.innerHTML = '';
    for (const region of REGIONS) {
      const isCurrent = region.id === this.current;
      const used = region.action ? this.used.includes(region.action.id) : false;
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = `region-tile${isCurrent ? ' current' : ''}`;
      tile.dataset.region = region.id;
      tile.disabled = isCurrent;
      tile.innerHTML = `
        <b>${region.name}</b>
        <span>${region.subtitle}</span>
        <p>${region.description}</p>
        <em>${isCurrent ? '所在' : region.action ? `${region.action.label}${used ? ' · 今日已做' : ''}` : '前往'}</em>
      `;
      this.list.appendChild(tile);
    }
  }
}
