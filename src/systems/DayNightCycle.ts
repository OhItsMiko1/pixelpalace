export type Phase = 'dawn' | 'day' | 'dusk' | 'night';

const REAL_SECONDS_PER_GAME_DAY = 240; // 4 real minutes = 1 in-game day

/** Standalone so a saved hour value can be displayed without a live DayNightCycle instance. */
export function formatClockString(hours: number): string {
  const h24 = Math.floor(hours);
  const m = Math.floor((hours - h24) * 60);
  const period = h24 >= 12 ? 'PM' : 'AM';
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
}

export class DayNightCycle {
  /** 0..24 in-game hours, starts mid-morning */
  private gameHours = 8;
  private day = 1;

  update(deltaSeconds: number): void {
    const hoursPerSecond = 24 / REAL_SECONDS_PER_GAME_DAY;
    const raw = this.gameHours + deltaSeconds * hoursPerSecond;
    this.day += Math.floor(raw / 24);
    this.gameHours = raw % 24;
  }

  getHours(): number {
    return this.gameHours;
  }

  getDay(): number {
    return this.day;
  }

  /** Restores a previously saved point in time (e.g. loading a save). */
  restore(hours: number, day: number): void {
    this.gameHours = hours;
    this.day = day;
  }

  getClockString(): string {
    return formatClockString(this.gameHours);
  }

  getPhase(): Phase {
    const h = this.gameHours;
    if (h >= 5 && h < 7) return 'dawn';
    if (h >= 7 && h < 18) return 'day';
    if (h >= 18 && h < 20) return 'dusk';
    return 'night';
  }

  /** Overlay tint color + alpha to darken the scene, based on time of day. */
  getOverlay(): { color: number; alpha: number } {
    const phase = this.getPhase();
    switch (phase) {
      case 'day':
        return { color: 0x0a1a3a, alpha: 0 };
      case 'dawn':
        return { color: 0xff9d5c, alpha: 0.18 };
      case 'dusk':
        return { color: 0xff6f3c, alpha: 0.28 };
      case 'night':
        return { color: 0x0a1245, alpha: 0.55 };
    }
  }
}
