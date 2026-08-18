import type { Alignment } from '../data/characters';

const HERO_LABELS = ['Unknown', 'Regarded', 'Respected', 'Beloved'];
const VILLAIN_LABELS = ['Forgettable', 'Whispered About', 'Feared', 'Notorious'];

export class ReputationSystem {
  /** 0-100, starts neutral. Rises with interactions, falls when a need is let run dry. */
  value = 50;

  adjust(delta: number): void {
    this.value = Math.max(0, Math.min(100, this.value + delta));
  }

  /** Scales all needs restores: 0.75x at 0 reputation, 1x at 50, 1.25x at 100. */
  getMultiplier(): number {
    return 1 + (this.value - 50) / 200;
  }

  getLabel(alignment: Alignment): string {
    const tier = this.value < 25 ? 0 : this.value < 50 ? 1 : this.value < 75 ? 2 : 3;
    return (alignment === 'hero' ? HERO_LABELS : VILLAIN_LABELS)[tier];
  }
}
