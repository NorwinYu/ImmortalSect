/** Keyboard + pointer-drag camera input, augmented with a touch (virtual) surface. */
export class Input {
  private readonly keys = new Set<string>();
  private deltaX = 0;
  private deltaY = 0;
  private wheelDelta = 0;
  private leftClicks = 0;
  private rightClicks = 0;
  private combatMode = false;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private enabled = true;

  /** Virtual (touch) movement axes: x = strafe right, y = forward (camera-relative, -1..1). */
  private virtualMove = { x: 0, y: 0 };

  /** Whether the primary pointer is coarse (touch primary). */
  readonly touch = (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0);

  onKey?: (code: string) => void;

  constructor(private readonly el: HTMLElement) {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);

    el.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    el.addEventListener('wheel', this.handleWheel, { passive: false });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  setEnabled(v: boolean): void {
    this.enabled = v;
    if (!v) this.dragging = false;
  }

  setCombatMode(v: boolean): void {
    this.combatMode = v;
    if (v) this.dragging = false;
  }

  consumeClicks(): { left: number; right: number } {
    const out = { left: this.leftClicks, right: this.rightClicks };
    this.leftClicks = 0;
    this.rightClicks = 0;
    return out;
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  consumeMouseDelta(): { x: number; y: number } {
    const out = { x: this.deltaX, y: this.deltaY };
    this.deltaX = 0;
    this.deltaY = 0;
    return out;
  }

  consumeWheel(): number {
    const w = this.wheelDelta;
    this.wheelDelta = 0;
    return w;
  }

  /** Touch: set the virtual movement stick (x strafe, y forward). */
  setVirtualMove(x: number, y: number): void {
    this.virtualMove.x = x;
    this.virtualMove.y = y;
  }

  getVirtualMove(): { x: number; y: number } {
    return this.virtualMove;
  }

  /** Touch: whether the virtual stick is meaningfully deflected. */
  isVirtualMoving(): boolean {
    return Math.hypot(this.virtualMove.x, this.virtualMove.y) > 0.06;
  }

  /** Touch: momentarily hold a virtual key (auto-releases shortly after). */
  tapVirtual(code: string): void {
    this.keys.add(code);
    window.setTimeout(() => this.keys.delete(code), 90);
  }

  pressVirtual(code: string): void {
    this.keys.add(code);
  }

  releaseVirtual(code: string): void {
    this.keys.delete(code);
  }

  /** Touch: inject a combat click (0 = light, 2 = heavy). */
  injectClick(button: 0 | 2): void {
    if (button === 0) this.leftClicks++;
    else this.rightClicks++;
  }

  /** Touch: feed pinch-zoom as a wheel delta. */
  addWheel(delta: number): void {
    this.wheelDelta += delta;
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    this.keys.add(e.code);
    this.onKey?.(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private handleBlur = (): void => {
    this.keys.clear();
    this.dragging = false;
  };

  private handlePointerDown = (e: PointerEvent): void => {
    if (!this.enabled) return;

    if (this.combatMode) {
      if (e.button === 0) this.leftClicks++;
      if (e.button === 2) this.rightClicks++;
      return;
    }

    if (e.button !== 0) return;
    this.dragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.el.setPointerCapture?.(e.pointerId);
  };

  private handlePointerMove = (e: PointerEvent): void => {
    if (!this.dragging || !this.enabled) return;
    this.deltaX += e.clientX - this.lastX;
    this.deltaY += e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  };

  private handlePointerUp = (): void => {
    this.dragging = false;
  };

  private handleWheel = (e: WheelEvent): void => {
    if (!this.enabled) return;
    e.preventDefault();
    this.wheelDelta += e.deltaY;
  };
}
