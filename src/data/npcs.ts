import { same, type ByAlignment } from './alignment';

export interface ScheduleEntry {
  /** In-game hour (0-24) this leg of the schedule starts. Entries must be sorted ascending. */
  hour: number;
  x: number;
  y: number;
  label: string;
}

export interface NpcSpec {
  id: string;
  name: string;
  flavor: ByAlignment<string>;
  socialRestore: ByAlignment<number>;
  /** Any order — the active entry is the one with the latest hour <= now, wrapping across midnight. */
  schedule: ScheduleEntry[];
}

// Waypoints reuse the same building-door coordinates as TownScene's interaction
// zones, plus two road crossroads, so NPC walk paths stay on open ground.
const MARKET_DOOR = { x: 248, y: 122 };
const TAVERN_DOOR = { x: 88, y: 130 };
const GUILD_DOOR = { x: 250, y: 394 };
const GATE_DOOR = { x: 505, y: 280 };
const WEST_CROSSROADS = { x: 144, y: 224 };
const EAST_CROSSROADS = { x: 400, y: 224 };

export const NPC_SPECS: NpcSpec[] = [
  {
    id: 'baker',
    name: 'Greta the Baker',
    flavor: same('"Fresh bread, still warm. Don\'t tell the mice."'),
    socialRestore: same(8),
    schedule: [
      { hour: 7, ...MARKET_DOOR, label: 'tending the market stall' },
      { hour: 19, ...WEST_CROSSROADS, label: 'heading home for the night' },
    ],
  },
  {
    id: 'barkeep',
    name: 'Sella the Barkeep',
    flavor: {
      hero: '"Same order as always? I remember faces, not names."',
      villain: '"Same order as always? I don\'t ask where the coin comes from."',
    },
    socialRestore: same(8),
    schedule: [
      { hour: 10, ...TAVERN_DOOR, label: 'pouring drinks at the tavern' },
      { hour: 23, ...EAST_CROSSROADS, label: 'closing up for the night' },
    ],
  },
  {
    id: 'watchman',
    name: 'Watchman Bram',
    flavor: {
      hero: '"Gate\'s still sealed. Still humming. Still not my problem — yet."',
      villain: '"Don\'t linger. Gate\'s still sealed, and so is my patience for your sort."',
    },
    socialRestore: { hero: 8, villain: 2 },
    schedule: [
      { hour: 6, ...GUILD_DOOR, label: 'starting rounds at the guild hall' },
      { hour: 12, ...EAST_CROSSROADS, label: 'patrolling the crossroads' },
      { hour: 18, ...GATE_DOOR, label: 'checking the sealed gate' },
      { hour: 0, ...WEST_CROSSROADS, label: 'making the night round' },
    ],
  },
];

export function getScheduleTarget(schedule: ScheduleEntry[], hours: number): ScheduleEntry {
  // Sort defensively rather than trusting call-site ordering — an entry
  // written last for narrative reasons (e.g. an hour:0 "midnight" leg) must
  // not be treated as merely appended, or it would wrongly win every check
  // after its neighbor since 0 <= hours is true for any hours >= 0.
  const sorted = [...schedule].sort((a, b) => a.hour - b.hour);
  let active = sorted[sorted.length - 1];
  for (const entry of sorted) {
    if (entry.hour <= hours) active = entry;
    else break;
  }
  return active;
}
