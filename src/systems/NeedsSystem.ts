export type NeedKey = 'hunger' | 'energy' | 'social';

const DECAY_PER_SECOND: Record<NeedKey, number> = {
  hunger: 0.6,
  energy: 0.35,
  social: 0.25,
};

export class NeedsSystem {
  values: Record<NeedKey, number> = {
    hunger: 85,
    energy: 90,
    social: 70,
  };

  update(deltaSeconds: number): void {
    for (const key of Object.keys(this.values) as NeedKey[]) {
      this.values[key] = clamp(this.values[key] - DECAY_PER_SECOND[key] * deltaSeconds, 0, 100);
    }
  }

  restore(key: NeedKey, amount: number): void {
    this.values[key] = clamp(this.values[key] + amount, 0, 100);
  }

  get(key: NeedKey): number {
    return this.values[key];
  }

  isCritical(key: NeedKey): boolean {
    return this.values[key] <= 15;
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
