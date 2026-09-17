import { clamp, damp } from './util';

export type WeatherState = 'clear' | 'gathering' | 'rain' | 'easing';

/** Rain state machine. Stations ask for rain; everything else reads intensity/wetness. */
export class Weather {
  state: WeatherState = 'clear';
  /** 0..1 rain falling right now. */
  rain = 0;
  /** 0..1 how wet the ground looks (lags the rain). */
  wetness = 0;
  /** 0..1 how dark the sky is. */
  overcast = 0;
  /** Set by the shelter the player stands under; changes the sound, not the rain. */
  sheltered = false;
  private target = 0;
  private timer = 0;

  gather() {
    if (this.state === 'clear' || this.state === 'easing') {
      this.state = 'gathering';
      this.timer = 0;
    }
  }

  startRain() {
    this.state = 'rain';
    this.target = 1;
  }

  ease() {
    if (this.state === 'rain' || this.state === 'gathering') {
      this.state = 'easing';
      this.target = 0;
    }
  }

  clear() {
    this.state = 'clear';
    this.target = 0;
  }

  update(dt: number) {
    if (this.state === 'gathering') {
      this.timer += dt;
      this.overcast = damp(this.overcast, 0.85, 0.35, dt);
      if (this.timer > 14) this.startRain();
    } else if (this.state === 'rain') {
      this.overcast = damp(this.overcast, 1, 0.5, dt);
      this.rain = damp(this.rain, this.target, 0.25, dt);
    } else if (this.state === 'easing') {
      this.rain = damp(this.rain, 0, 0.12, dt);
      this.overcast = damp(this.overcast, 0, 0.08, dt);
      if (this.rain < 0.01 && this.overcast < 0.02) this.state = 'clear';
    } else {
      this.rain = damp(this.rain, 0, 0.5, dt);
      this.overcast = damp(this.overcast, 0, 0.2, dt);
    }
    const wetTarget = this.rain > 0.2 ? 1 : 0;
    this.wetness = damp(this.wetness, wetTarget, this.rain > 0.2 ? 0.15 : 0.03, dt);
    this.rain = clamp(this.rain, 0, 1);
  }
}
