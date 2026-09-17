export interface PointerHandler {
  /** Return true to capture this pointer for a gesture (the camera will not look). */
  onPointerDown(x: number, y: number, pointerType: string): boolean;
  /** Return true to release the pointer back to camera look. */
  onPointerMove(x: number, y: number, dx: number, dy: number): boolean;
  onPointerUp(x: number, y: number, durationMs: number): void;
  /** Tap on empty space (not captured). */
  onEmptyTap(x: number, y: number): void;
  /** Hover without buttons (desktop, cursor visible). */
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
  /** Synthetic pointer driven by the interact key. */
  key?: boolean;
}

interface Pinch {
  idA: number;
  idB: number;
  dist: number;
}

/**
 * All player input: keyboard, mouse (with pointer lock for first-person look), touch (drag to look,
 * pinch to zoom), the on-screen joystick and the round walk button. Gestures on things are handed
 * to a PointerHandler; everything else becomes camera look, movement or zoom.
 */
export class Input {
  lookDX = 0;
  lookDY = 0;
  keys = new Set<string>();
  walkHeld = false;
  autoWalkToggle = false;
  menuRequested = false;
  moveX = 0;
  moveY = 0;
  /** Accumulated zoom input this frame: positive zooms in. */
  zoomDelta = 0;
  handler: PointerHandler | null = null;
  readonly isTouch: boolean;
  /** True while the mouse is captured by the canvas (first-person look, hidden cursor). */
  locked = false;

  private active: ActivePointer | null = null;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinch: Pinch | null = null;
  private walkButtonHeld = false;
  private joyActive = false;
  private joyId = -1;
  private joyX = 0;
  private joyY = 0;
  private lastActivity = performance.now();
  private wantLock = false;
  private lockLost = false;
  private lockRequestedAt = 0;

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
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.zoomDelta -= e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0016);
        this.lastActivity = performance.now();
      },
      { passive: false },
    );

    document.addEventListener('pointerlockchange', () => {
      const was = this.locked;
      this.locked = document.pointerLockElement === canvas;
      // the browser released the mouse (Esc): let the app react (menu, put things down)
      if (was && !this.locked && this.wantLock) this.lockLost = true;
      if (!this.locked) this.wantLock = false;
      this.pinch = null;
    });
    document.addEventListener('pointerlockerror', () => {
      this.locked = false;
      this.wantLock = false;
    });

    let spaceDown = 0;
    window.addEventListener('keydown', (e) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
      if (e.repeat) return;
      this.keys.add(e.code);
      if (e.code === 'Escape') this.menuRequested = true;
      if (e.code === 'Space') {
        e.preventDefault();
        spaceDown = performance.now();
      }
      if (e.code === 'KeyE' || e.code === 'Enter') this.keyPress(true);
      this.lastActivity = performance.now();
    });
    window.addEventListener('keyup', (e) => {
      // a quick tap of Space toggles auto-walk, like a tap on the round button
      if (e.code === 'Space' && this.keys.has('Space') && performance.now() - spaceDown < 260) this.autoWalkToggle = true;
      if (e.code === 'KeyE' || e.code === 'Enter') this.keyPress(false);
      this.keys.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.walkButtonHeld = false;
      if (this.active?.key) this.keyPress(false);
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
      joystick.classList.add('active');
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
      joystick.classList.remove('active');
      (joystick.firstElementChild as HTMLElement).style.transform = '';
    };
    joystick.addEventListener('pointerup', joyEnd);
    joystick.addEventListener('pointercancel', joyEnd);
    joystick.addEventListener('lostpointercapture', joyEnd);
  }

  // ---------------------------------------------------------------- pointer lock

  /** Capture the mouse for first-person look (desktop only; needs a user gesture). */
  lock() {
    if (this.isTouch || this.locked) return;
    // browsers refuse a new lock for a moment after Esc released the last one
    if (performance.now() - this.lockRequestedAt < 1200) return;
    this.lockRequestedAt = performance.now();
    this.wantLock = true;
    try {
      const r = (this.canvas as unknown as { requestPointerLock: (o?: object) => Promise<void> | undefined }).requestPointerLock({ unadjustedMovement: false });
      if (r && typeof r.catch === 'function') {
        r.catch(() => {
          // fall back to plain (unadjusted) lock, then to cursor mode if that fails too
          try {
            const r2 = (this.canvas as unknown as { requestPointerLock: () => Promise<void> | undefined }).requestPointerLock();
            if (r2 && typeof r2.catch === 'function') r2.catch(() => (this.wantLock = false));
          } catch {
            this.wantLock = false;
          }
        });
      }
    } catch {
      this.wantLock = false;
    }
  }

  unlock() {
    this.wantLock = false;
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }

  consumeLockLost() {
    const v = this.lockLost;
    this.lockLost = false;
    return v;
  }

  private get centerX() {
    return window.innerWidth / 2;
  }

  private get centerY() {
    return window.innerHeight / 2;
  }

  // ---------------------------------------------------------------- joystick

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

  // ---------------------------------------------------------------- pointers

  /** The interact key behaves like a press of the mouse button at the centre of the view. */
  private keyPress(down: boolean) {
    if (down) {
      if (this.active) return;
      const x = this.centerX;
      const y = this.centerY;
      const captured = this.handler ? this.handler.onPointerDown(x, y, 'mouse') : false;
      this.active = { id: -99, x, y, startX: x, startY: y, startTime: performance.now(), captured, moved: false, key: true };
    } else {
      const a = this.active;
      if (!a || !a.key) return;
      const duration = performance.now() - a.startTime;
      if (a.captured) this.handler?.onPointerUp(a.x, a.y, duration);
      else if (duration < 350) this.handler?.onEmptyTap(a.x, a.y);
      this.active = null;
    }
  }

  private onDown = (e: PointerEvent) => {
    this.lastActivity = performance.now();
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.active && !this.active.key) {
      // a second finger while looking around starts a pinch (never while a gesture holds the first one)
      if (!this.active.captured && e.pointerType !== 'mouse' && this.pointers.size === 2 && !this.pinch) {
        const a = this.active;
        this.pinch = { idA: a.id, idB: e.pointerId, dist: Math.hypot(e.clientX - a.x, e.clientY - a.y) };
      }
      return;
    }
    if (this.active?.key) return;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* a locked pointer cannot be captured; it already belongs to the canvas */
    }
    const mouse = e.pointerType === 'mouse';
    if (mouse && !this.locked && !this.isTouch) this.lock();
    // with the mouse captured, every press is at the reticle in the middle of the view
    const x = this.locked ? this.centerX : e.clientX;
    const y = this.locked ? this.centerY : e.clientY;
    const captured = this.handler ? this.handler.onPointerDown(x, y, e.pointerType) : false;
    this.active = {
      id: e.pointerId,
      x,
      y,
      startX: x,
      startY: y,
      startTime: performance.now(),
      captured,
      moved: false,
    };
  };

  private onMove = (e: PointerEvent) => {
    const p = this.pointers.get(e.pointerId);
    if (p) {
      p.x = e.clientX;
      p.y = e.clientY;
    }
    if (this.pinch) {
      const a = this.pointers.get(this.pinch.idA);
      const b = this.pointers.get(this.pinch.idB);
      if (a && b) {
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        this.zoomDelta += (d - this.pinch.dist) / Math.min(window.innerWidth, window.innerHeight) * 2.2;
        this.pinch.dist = d;
        this.lastActivity = performance.now();
      }
      return;
    }
    const a = this.active;
    if (!a || a.id !== e.pointerId) {
      if (!a && this.handler && e.pointerType === 'mouse' && !this.locked) this.handler.onHover(e.clientX, e.clientY);
      else if (this.locked && !a && e.pointerType === 'mouse') {
        this.lookDX += e.movementX;
        this.lookDY += e.movementY;
        this.lastActivity = performance.now();
      }
      return;
    }
    const dx = this.locked && e.pointerType === 'mouse' ? e.movementX : e.clientX - a.x;
    const dy = this.locked && e.pointerType === 'mouse' ? e.movementY : e.clientY - a.y;
    a.x += dx;
    a.y += dy;
    if (Math.hypot(a.x - a.startX, a.y - a.startY) > 6) a.moved = true;
    this.lastActivity = performance.now();
    if (a.captured) {
      const release = this.handler ? this.handler.onPointerMove(a.x, a.y, dx, dy) : true;
      if (release) a.captured = false;
    } else {
      this.lookDX += dx;
      this.lookDY += dy;
    }
  };

  private onUp = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    if (this.pinch && (e.pointerId === this.pinch.idA || e.pointerId === this.pinch.idB)) {
      // the pinch ends; whichever finger remains just looks around from here
      this.pinch = null;
      if (this.active && this.active.id === e.pointerId) {
        const other = [...this.pointers.entries()][0];
        this.active = other
          ? { id: other[0], x: other[1].x, y: other[1].y, startX: other[1].x, startY: other[1].y, startTime: performance.now(), captured: false, moved: true }
          : null;
      }
      return;
    }
    const a = this.active;
    if (!a || a.id !== e.pointerId) return;
    const duration = performance.now() - a.startTime;
    if (a.captured) {
      this.handler?.onPointerUp(a.x, a.y, duration);
    } else if (!a.moved && duration < 350) {
      this.handler?.onEmptyTap(a.x, a.y);
    }
    this.active = null;
  };

  private onLeave = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && !this.active && !this.locked) this.handler?.onHover(-1, -1);
  };

  // ---------------------------------------------------------------- per frame

  /** Call once per frame before consumers read the state. */
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
    if (this.walkButtonHeld) my -= 1;
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

  consumeZoom() {
    const z = this.zoomDelta;
    this.zoomDelta = 0;
    return z;
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

  /** True while any movement input is held (keys, joystick or the round button). */
  get moving() {
    return Math.hypot(this.moveX, this.moveY) > 0.2;
  }

  get idleSeconds() {
    return (performance.now() - this.lastActivity) / 1000;
  }

  touch() {
    this.lastActivity = performance.now();
  }
}
