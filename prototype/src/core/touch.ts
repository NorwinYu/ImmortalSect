import type { Input } from './input';

export interface TouchCallbacks {
  /** World interaction (talk / region action) — replaces the F key. */
  onInteract: () => void;
  /** Combat action by keycode (KeyQ / KeyE / KeyF / Tab / KeyR). */
  onCombat: (code: string) => void;
}

/**
 * Mobile-first touch surface: a virtual movement stick on the left, action
 * buttons on the right, and two-finger pinch-to-zoom on the canvas. Feeds only
 * the `Input` abstraction (virtual axes / virtual keys / injected clicks /
 * wheel deltas), so the rest of the game never knows it is on a touchscreen.
 *
 * Only mounts when the primary pointer is coarse (touch). Desktop is untouched.
 */
export class TouchControls {
  private readonly root!: HTMLDivElement;
  private readonly stick!: HTMLDivElement;
  private readonly knob!: HTMLDivElement;
  private readonly actions!: HTMLDivElement;
  private readonly jumpBtn!: HTMLButtonElement;
  private readonly interactBtn!: HTMLButtonElement;
  private readonly combatCluster!: HTMLDivElement;
  private rotateHint!: HTMLDivElement;

  private stickPointer: number | null = null;
  private stickOrigin = { x: 0, y: 0 };
  private static readonly STICK_RADIUS = 52;

  private pinchDist = 0;

  constructor(
    private readonly input: Input,
    private readonly callbacks: TouchCallbacks,
    canvas: HTMLCanvasElement,
  ) {
    if (!input.touch) return;
    document.documentElement.classList.add('is-touch');

    this.root = document.createElement('div');
    this.root.className = 'touch-ui';

    // ── movement stick ────────────────────────────────────────────────
    this.stick = document.createElement('div');
    this.stick.className = 'touch-stick';
    this.knob = document.createElement('div');
    this.knob.className = 'touch-knob';
    this.stick.appendChild(this.knob);

    // ── right action cluster ──────────────────────────────────────────
    this.actions = document.createElement('div');
    this.actions.className = 'touch-actions';

    this.interactBtn = this.btn('touch-interact is-hidden', '交 谈');
    this.interactBtn.addEventListener('click', () => this.callbacks.onInteract());

    this.jumpBtn = this.btn('touch-jump', '跃');
    this.jumpBtn.addEventListener('click', () => this.input.tapVirtual('Space'));

    this.combatCluster = document.createElement('div');
    this.combatCluster.className = 'touch-combat is-hidden';

    const heavy = this.btn('', '重击');
    heavy.addEventListener('click', () => this.input.injectClick(2));
    const dodge = this.btn('', '闪避');
    dodge.addEventListener('click', () => this.callbacks.onCombat('KeyQ'));
    const skill = this.btn('', '剑气');
    skill.addEventListener('click', () => this.callbacks.onCombat('KeyE'));
    const exec = this.btn('', '处决');
    exec.addEventListener('click', () => this.callbacks.onCombat('KeyF'));
    const lock = this.btn('', '锁定');
    lock.addEventListener('click', () => this.callbacks.onCombat('Tab'));
    const again = this.btn('', '再战');
    again.addEventListener('click', () => this.callbacks.onCombat('KeyR'));

    this.combatCluster.append(heavy, dodge, skill, exec, lock, again);

    this.actions.append(this.interactBtn, this.jumpBtn, this.combatCluster);
    this.root.append(this.stick, this.actions);
    document.body.appendChild(this.root);

    // ── portrait hint: suggest rotating the phone (CSS decides visibility) ─
    this.rotateHint = document.createElement('div');
    this.rotateHint.className = 'touch-rotate';
    this.rotateHint.innerHTML = '<i>⟳</i><span>横屏体验更佳 · 点此关闭</span>';
    this.rotateHint.addEventListener('click', () => {
      this.rotateHint?.classList.add('is-dismissed');
    });
    document.body.appendChild(this.rotateHint);
    // Auto-dismiss after a few seconds so it never becomes clutter.
    window.setTimeout(() => this.rotateHint?.classList.add('is-dismissed'), 6000);

    // ── events ────────────────────────────────────────────────────────
    this.stick.addEventListener('pointerdown', this.onStickDown);
    this.stick.addEventListener('pointermove', this.onStickMove);
    this.stick.addEventListener('pointerup', this.onStickUp);
    this.stick.addEventListener('pointercancel', this.onStickUp);

    // Pinch zoom on the render canvas (two-finger).
    canvas.addEventListener('touchstart', this.onPinchStart, { passive: false });
    canvas.addEventListener('touchmove', this.onPinchMove, { passive: false });
    canvas.addEventListener('touchend', this.onPinchEnd, { passive: false });
  }


  private btn(className: string, label: string): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = className;
    b.textContent = label;
    return b;
  }

  /** Show/hide the contextual world-interact button. */
  setInteract(label: string | null): void {
    if (!this.input.touch || !this.interactBtn) return;
    if (label) {
      this.interactBtn.textContent = label.replace(/<[^>]*>/g, '').slice(0, 6) || '交互';
      this.interactBtn.classList.remove('is-hidden');
    } else {
      this.interactBtn.classList.add('is-hidden');
    }
  }

  /** Show/hide the combat action cluster. */
  setCombat(active: boolean): void {
    if (!this.input.touch || !this.combatCluster) return;
    this.combatCluster.classList.toggle('is-hidden', !active);
    // Jump is pointless mid-duel and eats space on short landscape screens.
    this.jumpBtn.classList.toggle('is-hidden', active);
  }

  /** Hide everything and reset the stick (e.g. when a modal blocks play). */
  setBlocked(blocked: boolean): void {
    if (!this.input.touch || !this.root) return;
    if (blocked) this.onStickUp();
    this.root.classList.toggle('is-blocked', blocked);
    // The "rotate for a better view" pill must not sit on top of a full-screen
    // panel such as the sect ledger.
    this.rotateHint?.classList.toggle('is-suppressed', blocked);
  }

  private onStickDown = (e: PointerEvent): void => {
    e.preventDefault();
    this.stickPointer = e.pointerId;
    const r = this.stick.getBoundingClientRect();
    this.stickOrigin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    this.applyStick(e.clientX, e.clientY);
    try {
      this.stick.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic / detached pointer — position tracking still works */
    }
  };

  private onStickMove = (e: PointerEvent): void => {
    if (this.stickPointer !== e.pointerId) return;
    this.applyStick(e.clientX, e.clientY);
  };

  private onStickUp = (): void => {
    if (this.stickPointer === null) return;
    this.stickPointer = null;
    this.knob.style.transform = 'translate(-50%, -50%)';
    this.input.setVirtualMove(0, 0);
  };

  private applyStick(cx: number, cy: number): void {
    let dx = cx - this.stickOrigin.x;
    let dy = cy - this.stickOrigin.y;
    const len = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(len / TouchControls.STICK_RADIUS, 1);
    const nx = (dx / len) * clamped;
    const ny = (dy / len) * clamped;
    this.knob.style.transform = `translate(calc(-50% + ${nx * TouchControls.STICK_RADIUS}px), calc(-50% + ${ny * TouchControls.STICK_RADIUS}px))`;
    // x = strafe right, y = forward (screen up = forward).
    this.input.setVirtualMove(nx, -ny);
  }

  private onPinchStart = (e: TouchEvent): void => {
    if (e.touches.length === 2) {
      this.pinchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
    }
  };

  private onPinchMove = (e: TouchEvent): void => {
    if (e.touches.length !== 2) return;
    e.preventDefault();
    const dist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY,
    );
    if (this.pinchDist > 0) {
      const delta = (dist - this.pinchDist) * 0.5; // spread → zoom out
      this.input.addWheel(delta);
    }
    this.pinchDist = dist;
  };

  private onPinchEnd = (e: TouchEvent): void => {
    if (e.touches.length < 2) this.pinchDist = 0;
  };
}