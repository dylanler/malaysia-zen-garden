export type LocomotionMode = 'stroll' | 'free';
export type QualitySetting = 'auto' | 'low' | 'high';

export interface Settings {
  volume: number; // 0..1
  locomotion: LocomotionMode;
  quality: QualitySetting;
  reducedMotion: boolean;
  hints: boolean;
}

export interface Progress {
  visited: string[];
  completed: string[];
  u: number; // position along the path 0..1
  hour: number;
  lanternLit: boolean;
  loops: number;
}

interface SaveData {
  version: number;
  settings: Settings;
  progress: Progress;
}

const KEY = 'taman-kenangan.v1';

const defaultSettings = (): Settings => ({
  volume: 0.8,
  locomotion: 'free',
  quality: 'auto',
  reducedMotion: typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  hints: true,
});

const defaultProgress = (): Progress => ({
  visited: [],
  completed: [],
  u: 0,
  hour: 6.75,
  lanternLit: false,
  loops: 0,
});

export class Save {
  settings: Settings;
  progress: Progress;
  private timer: number | null = null;

  constructor() {
    const data = this.read();
    this.settings = { ...defaultSettings(), ...(data?.settings ?? {}) };
    this.progress = { ...defaultProgress(), ...(data?.progress ?? {}) };
    // saves from before first-person controls default to the path; start them free roaming like everyone else
    if (data && data.version < 2) this.settings.locomotion = 'free';
  }

  private read(): SaveData | null {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as SaveData;
      if (parsed.version !== 1 && parsed.version !== 2) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  /** Debounced write. */
  flush(immediate = false) {
    const write = () => {
      this.timer = null;
      try {
        const data: SaveData = { version: 2, settings: this.settings, progress: this.progress };
        localStorage.setItem(KEY, JSON.stringify(data));
      } catch {
        /* storage unavailable: the walk still works */
      }
    };
    if (immediate) {
      if (this.timer !== null) clearTimeout(this.timer);
      write();
      return;
    }
    if (this.timer !== null) return;
    this.timer = window.setTimeout(write, 800);
  }

  hasProgress() {
    return this.progress.visited.length > 0 && this.progress.u > 0.002;
  }

  markVisited(id: string) {
    if (!this.progress.visited.includes(id)) this.progress.visited.push(id);
    this.flush();
  }

  markCompleted(id: string) {
    if (!this.progress.completed.includes(id)) this.progress.completed.push(id);
    this.flush();
  }

  resetProgress() {
    const loops = this.progress.loops;
    this.progress = { ...defaultProgress(), loops };
    this.flush(true);
  }
}
