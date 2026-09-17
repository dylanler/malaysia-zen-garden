import type { StationDef } from '../content/stations';
import type { Settings } from '../core/Save';
import { STATIONS } from '../content/stations';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;

export class UI {
  readonly canvas = $<HTMLCanvasElement>('#scene');
  readonly walkButton = $<HTMLButtonElement>('#walk');
  readonly joystick = $<HTMLElement>('#joystick');
  private hud = $<HTMLElement>('#hud');
  private title = $<HTMLElement>('#title');
  private enterBtn = $<HTMLButtonElement>('#enter');
  private resumeNote = $<HTMLElement>('#resume-note');
  private card = $<HTMLElement>('#station-card');
  private memory = $<HTMLElement>('#memory');
  private hint = $<HTMLElement>('#hint');
  private toastEl = $<HTMLElement>('#toast');
  private progress = $<HTMLElement>('#progress');
  private menu = $<HTMLElement>('#menu');
  private about = $<HTMLElement>('#about');
  private closeFocusBtn = $<HTMLButtonElement>('#close-focus');
  private menuBtn = $<HTMLButtonElement>('#menu-btn');
  private cardTimer: number | null = null;
  private memoryTimer: number | null = null;
  private toastTimer: number | null = null;
  private hintText: string | null = null;
  private afterword: string | null = null;
  private afterwordShownAt = 0;
  private closeFocusCbs: (() => void)[] = [];
  private settingsCbs: ((s: Settings) => void)[] = [];
  private resetCbs: (() => void)[] = [];
  menuOpen = false;

  constructor(private settings: Settings) {
    for (let i = 0; i < STATIONS.length; i++) {
      const dot = document.createElement('span');
      dot.title = STATIONS[i].names.native;
      this.progress.appendChild(dot);
    }
    this.closeFocusBtn.addEventListener('click', () => this.closeFocusCbs.forEach((cb) => cb()));
    this.menuBtn.addEventListener('click', () => this.openMenu());
    $('#menu-close').addEventListener('click', () => this.closeMenu());
    $('#menu-about').addEventListener('click', () => {
      this.menu.classList.add('hidden');
      this.about.classList.remove('hidden');
    });
    $('#about-close').addEventListener('click', () => {
      this.about.classList.add('hidden');
      this.menu.classList.remove('hidden');
    });
    $('#menu-reset').addEventListener('click', () => {
      this.closeMenu();
      this.resetCbs.forEach((cb) => cb());
    });

    const sound = $<HTMLInputElement>('#opt-sound');
    const loco = $<HTMLSelectElement>('#opt-loco');
    const quality = $<HTMLSelectElement>('#opt-quality');
    const motion = $<HTMLInputElement>('#opt-motion');
    const hints = $<HTMLInputElement>('#opt-hints');
    sound.value = String(Math.round(settings.volume * 100));
    loco.value = settings.locomotion;
    quality.value = settings.quality;
    motion.checked = settings.reducedMotion;
    hints.checked = settings.hints;
    const emit = () => {
      settings.volume = Number(sound.value) / 100;
      settings.locomotion = loco.value as Settings['locomotion'];
      settings.quality = quality.value as Settings['quality'];
      settings.reducedMotion = motion.checked;
      settings.hints = hints.checked;
      this.settingsCbs.forEach((cb) => cb(settings));
    };
    for (const el of [sound, loco, quality, motion, hints]) el.addEventListener('change', emit);
    sound.addEventListener('input', emit);
    if ('ontouchstart' in window || navigator.maxTouchPoints > 0) document.body.classList.add('touch');
  }

  onEnter(cb: () => void) {
    this.enterBtn.addEventListener('click', cb, { once: true });
  }

  setResumeNote(text: string | null) {
    this.resumeNote.textContent = text ?? '';
  }

  hideTitle() {
    this.title.style.transition = 'opacity 1.4s ease';
    this.title.style.opacity = '0';
    window.setTimeout(() => this.title.classList.add('hidden'), 1400);
    this.hud.classList.remove('hidden');
  }

  onCloseFocus(cb: () => void) {
    this.closeFocusCbs.push(cb);
  }

  onSettings(cb: (s: Settings) => void) {
    this.settingsCbs.push(cb);
  }

  onReset(cb: () => void) {
    this.resetCbs.push(cb);
  }

  openMenu() {
    this.menuOpen = true;
    this.menu.classList.remove('hidden');
  }

  closeMenu() {
    this.menuOpen = false;
    this.menu.classList.add('hidden');
    this.about.classList.add('hidden');
  }

  toggleMenu() {
    if (this.menuOpen) this.closeMenu();
    else this.openMenu();
  }

  showStationCard(def: StationDef) {
    this.afterword = null;
    this.card.querySelector('.native')!.textContent = def.names.native;
    this.card.querySelector('.ms')!.textContent = def.names.ms;
    this.card.querySelector('.en')!.textContent = def.names.en;
    this.card.querySelector('.intro')!.textContent = def.intro;
    this.card.classList.remove('hidden', 'leaving');
    if (this.cardTimer) clearTimeout(this.cardTimer);
    const words = def.intro.split(' ').length;
    const ms = Math.min(16000, 5000 + words * 190);
    this.cardTimer = window.setTimeout(() => this.hideStationCard(), ms);
  }

  hideStationCard() {
    if (this.card.classList.contains('hidden')) return;
    this.card.classList.add('leaving');
    window.setTimeout(() => this.card.classList.add('hidden'), 700);
  }

  showMemory(text: string) {
    this.memory.textContent = text;
    this.memory.classList.remove('hidden', 'leaving');
    if (this.memoryTimer) clearTimeout(this.memoryTimer);
    this.memoryTimer = window.setTimeout(() => {
      this.memory.classList.add('leaving');
      window.setTimeout(() => this.memory.classList.add('hidden'), 700);
    }, 6500 + text.length * 30);
  }

  showAfterword(text: string) {
    this.afterword = text;
    this.afterwordShownAt = performance.now();
  }

  clearAfterword() {
    this.afterword = null;
  }

  /** Called every frame with the interaction hint (or null). */
  setHint(text: string | null) {
    let show: string | null = text;
    if (!show && this.afterword && performance.now() - this.afterwordShownAt < 14000) show = this.afterword;
    if (!this.settings.hints) show = null;
    if (show === this.hintText) return;
    this.hintText = show;
    if (show) {
      this.hint.textContent = show;
      this.hint.classList.remove('hidden');
    } else {
      this.hint.classList.add('hidden');
    }
  }

  toast(text: string, ms = 3800) {
    this.toastEl.textContent = text;
    this.toastEl.classList.remove('hidden');
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.add('hidden'), ms);
  }

  setProgress(visited: string[], completed: string[], current: string | null) {
    const dots = this.progress.children;
    STATIONS.forEach((s, i) => {
      const d = dots[i] as HTMLElement;
      d.classList.toggle('visited', visited.includes(s.id) || completed.includes(s.id));
      d.classList.toggle('current', s.id === current);
    });
  }

  setFocusMode(on: boolean) {
    this.hud.classList.toggle('focus', on);
    this.closeFocusBtn.classList.toggle('hidden', !on);
    this.menuBtn.classList.toggle('hidden', on);
  }

  setIdle(on: boolean) {
    this.hud.classList.toggle('idle', on);
  }

  setWalkAuto(on: boolean) {
    this.walkButton.classList.toggle('auto', on);
  }

  setWalkVisible(on: boolean) {
    this.walkButton.style.display = on ? '' : 'none';
    $('#walk-label').style.display = on ? '' : 'none';
  }

  setJoystickVisible(on: boolean) {
    this.joystick.classList.toggle('hidden', !on);
  }

  /** Reflect a locomotion change made by the world (e.g. boarding the sampan) in the menu. */
  setLocomotionOption(mode: Settings['locomotion']) {
    $<HTMLSelectElement>('#opt-loco').value = mode;
  }
}
