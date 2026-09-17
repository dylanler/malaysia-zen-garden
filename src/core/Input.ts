export interface PointerHandler {
  /** Return true to capture this pointer for a gesture (the camera will not look). */
  onPointerDown(x: number, y: number, pointerType: string): boolean;
  /** Return true to release the pointer back to camera look. */
  onPointerMove(x: number, y: number, dx: number, dy: number): boolean;
  onPointerUp(x: number, y: number, durationMs: number): void;
  /** Tap on empty space (not captured). */
  onEmptyTap(x: number, y: number): void;
  /** Hover without buttons (desktop). */
  onHover(x: number, y: number): void;
}

interface ActivePointer {
  id: number;
  x: number;
  y: number;
  startX: number;
  startY: number;
  startTime: number;
  captured: boolean;
  moved: boolean;
}

export class Input {
  lookDX = 0;
  lookDY = 0;
  keys = new Set<string>();
  walkHeld = false;
  autoWalkToggle = false;
  menuRequested = false;
  moveX = 0;
  moveY = 0;
  handler: PointerHandler | null = null;
  readonly isTouch: boolean;

  private active: ActivePointer | null = null;
  private walkButtonHeld = false;
  private joyActive = false;
  private joyId = -1;
  private joyX = 0;
  private joyY = 0;
  private lastActivity = performance.now();

  constructor(
    private canvas: HTMLCanvasElement,
    walkButton: HTMLButtonElement,
    private joystick: HTMLElement,
  ) {
    this.isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointercancel', this.onUp);
    canvas.addEventListener('pointerleave', this.onLeave);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    let spaceDown = 0;
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
      this.keys.add(e.code);
      if (e.code === 'Escape') this.menuRequested = true;
      if (e.code === 'Space') {
        e.preventDefault();
        spaceDown = performance.now();
      }
      this.lastActivity = performance.now();
    });
    window.addEventListener('keyup', (e) => {
      // a quick tap of Space toggles auto-walk, like a tap on the round button
      if (e.code === 'Space' && this.keys.has('Space') && performance.now() - spaceDown < 260) this.autoWalkToggle = true;
      this.keys.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.walkButtonHeld = false;
    });

    let walkDownTime = 0;
    let walkMoved = false;
    walkButton.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      walkButton.setPointerCapture(e.pointerId);
      this.walkButtonHeld = true;
      walkDownTime = performance.now();
      walkMoved = false;
      walkButton.classList.add('held');
      this.lastActivity = performance.now();
    });
    walkButton.addEventListener('pointermove', () => {
      walkMoved = true;
    });
    const walkRelease = () => {
      if (!this.walkButtonHeld) return;
      this.walkButtonHeld = false;
      walkButton.classList.remove('held');
      const dt = performance.now() - walkDownTime;
      if (dt < 260 && !walkMoved) this.autoWalkToggle = true;
    };
    walkButton.addEventListener('pointerup', walkRelease);
    walkButton.addEventListener('pointercancel', walkRelease);
    walkButton.addEventListener('lostpointercapture', walkRelease);

    joystick.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      joystick.setPointerCapture(e.pointerId);
      this.joyActive = true;
      this.joyId = e.pointerId;
      this.updateJoy(e);
    });
    joystick.addEventListener('pointermove', (e) => {
      if (this.joyActive && e.pointerId === this.joyId) this.updateJoy(e);
    });
    const joyEnd = (e: PointerEvent) => {
      if (e.pointerId !== this.joyId) return;
      this.joyActive = false;
      this.joyX = 0;
      this.joyY = 0;
      (joystick.firstElementChild as HTMLElement).style.transform = '';
    };
    joystick.addEventListener('pointerup', joyEnd);
    joystick.addEventListener('pointercancel', joyEnd);
  }

  private updateJoy(e: PointerEvent) {
    const r = this.joystick.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const max = r.width * 0.36;
    const len = Math.hypot(dx, dy);
    if (len > max) {
      dx = (dx / len) * max;
      dy = (dy / len) * max;
    }
    (this.joystick.firstElementChild as HTMLElement).style.transform = `translate(${dx}px, ${dy}px)`;
    this.joyX = dx / max;
    this.joyY = dy / max;
    this.lastActivity = performance.now();
  }

  private onDown = (e: PointerEvent) => {
    if (this.active) return;
    this.canvas.setPointerCapture(e.pointerId);
    this.lastActivity = performance.now();
    const captured = this.handler ? this.handler.onPointerDown(e.clientX, e.clientY, e.pointerType) : false;
    this.active = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
      startTime: performance.now(),
      captured,
      moved: false,
    };
  };

  private onMove = (e: PointerEvent) => {
    const a = this.active;
    if (!a || a.id !== e.pointerId) {
      if (!a && this.handler && e.pointerType === 'mouse') this.handler.onHover(e.clientX, e.clientY);
      return;
    }
    const dx = e.clientX - a.x;
    const dy = e.clientY - a.y;
    a.x = e.clientX;
    a.y = e.clientY;
    if (Math.hypot(e.clientX - a.startX, e.clientY - a.startY) > 6) a.moved = true;
    this.lastActivity = performance.now();
    if (a.captured) {
      const release = this.handler ? this.handler.onPointerMove(e.clientX, e.clientY, dx, dy) : true;
      if (release) a.captured = false;
    } else {
      this.lookDX += dx;
      this.lookDY += dy;
    }
  };

  private onUp = (e: PointerEvent) => {
    const a = this.active;
    if (!a || a.id !== e.pointerId) return;
    const duration = performance.now() - a.startTime;
    if (a.captured) {
      this.handler?.onPointerUp(e.clientX, e.clientY, duration);
    } else if (!a.moved && duration < 350) {
      this.handler?.onEmptyTap(e.clientX, e.clientY);
    }
    this.active = null;
  };

  private onLeave = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && !this.active) this.handler?.onHover(-1, -1);
  };

  /** Call once per frame before consumers read the state; resets per-frame accumulators after use via consume(). */
  poll() {
    const k = this.keys;
    this.walkHeld =
      this.walkButtonHeld || k.has('KeyW') || k.has('ArrowUp') || k.has('Space') || (this.joyActive && -this.joyY > 0.5 && Math.abs(this.joyX) < 0.5);
    let mx = 0;
    let my = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) my -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) my += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) mx -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) mx += 1;
    if (this.joyActive) {
      mx += this.joyX;
      my += this.joyY;
    }
    const l = Math.hypot(mx, my);
    if (l > 1) {
      mx /= l;
      my /= l;
    }
    this.moveX = mx;
    this.moveY = my;
    if (l > 0.01) this.lastActivity = performance.now();
  }

  consumeLook() {
    const r = { dx: this.lookDX, dy: this.lookDY };
    this.lookDX = 0;
    this.lookDY = 0;
    return r;
  }

  consumeAutoWalkToggle() {
    const v = this.autoWalkToggle;
    this.autoWalkToggle = false;
    return v;
  }

  consumeMenuRequest() {
    const v = this.menuRequested;
    this.menuRequested = false;
    return v;
  }

  get idleSeconds() {
    return (performance.now() - this.lastActivity) / 1000;
  }

  touch() {
    this.lastActivity = performance.now();
  }
}
