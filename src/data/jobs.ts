import type { ByAlignment } from './alignment';
import type { Phase } from '../systems/DayNightCycle';

export interface JobSpec {
  /** Building id where this alignment's job is worked — see TownScene's building defs. */
  buildingId: string;
  /** Optional time-of-day gate; undefined means available any time. */
  requiresPhase?: Phase;
  gold: number;
  actionLabel: string;
  successText: string;
}

// One job per alignment, each at a building whose flavor already sets up the
// idea (the guild's daytime training, Market Row's "vendor loses count").
export const JOBS: ByAlignment<JobSpec> = {
  hero: {
    buildingId: 'guild',
    requiresPhase: 'day',
    gold: 12,
    actionLabel: 'Take a Bounty',
    successText: 'You clear a small bounty posted on the board. Not glamorous, but it pays.',
  },
  villain: {
    buildingId: 'market',
    gold: 12,
    actionLabel: 'Pick a Pocket',
    successText: 'A distracted shopper, a loose coin purse, a clean getaway.',
  },
};
