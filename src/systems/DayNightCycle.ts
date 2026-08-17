export type Phase = 'dawn' | 'day' | 'dusk' | 'night';

const REAL_SECONDS_PER_GAME_DAY = 240; // 4 real minutes = 1 in-game day

export class DayNightCycle {
  /** 0..24 in-game hours, starts mid-morning */
  private gameHours = 8;

  update(deltaSeconds: number): void {
    const hoursPerSecond = 24 / REAL_SECONDS_PER_GAME_DAY;
    this.gameHours = (this.gameHours + deltaSeconds * hoursPerSecond) % 24;
  }

  getHours(): number {
    return this.gameHours;
  }

  getClockString(): string {
    const h24 = Math.floor(this.gameHours);
    const m = Math.floor((this.gameHours - h24) * 60);
    const period = h24 >= 12 ? 'PM' : 'AM';
    let h12 = h24 % 12;
    if (h12 === 0) h12 = 12;
    return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
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
