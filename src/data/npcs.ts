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
// Offset from MARKET_DOOR on purpose: Greta's stall sits right at the door
// zone's exact center for ~12 hours a day, and building-vs-NPC proximity is a
// simple point distance (see TownScene.updateNearInteractables) — sitting on
// the identical point would make the building itself untalkable-around
// whenever she's there, same class of bug fixed for the blacksmith earlier.
const MARKET_STALL = { x: 268, y: 122 };
const TAVERN_DOOR = { x: 88, y: 130 };
const GUILD_DOOR = { x: 250, y: 394 };
const GATE_DOOR = { x: 505, y: 280 };
const FORGE_DOOR = { x: 455, y: 388 };
// South of the forge, not a real landmark — just a safe staging point so a
// straight line to/from FORGE_DOOR never cuts through the building itself.
const SOUTH_FORGE_ROAD = { x: 455, y: 430 };
const WEST_CROSSROADS = { x: 144, y: 224 };
const EAST_CROSSROADS = { x: 400, y: 224 };
const STUDY_DOOR = { x: 588, y: 122 };
const WELL_DOOR = { x: 585, y: 380 };
// Staging points, not real landmarks — same purpose as SOUTH_FORGE_ROAD: keep
// straight-line legs from clipping the Sealed Dungeon Gate (x460-550) or the
// well itself. EAST_ROAD_SOUTH sits entirely east of the gate's x-range.
const EAST_ROAD_SOUTH = { x: 600, y: 265 };
const SOUTH_WELL_ROAD = { x: 585, y: 420 };

export const NPC_SPECS: NpcSpec[] = [
  {
    id: 'baker',
    name: 'Greta the Baker',
    flavor: same('"Fresh bread, still warm. Don\'t tell the mice."'),
    socialRestore: same(8),
    schedule: [
      { hour: 7, ...MARKET_STALL, label: 'tending the market stall' },
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
  {
    id: 'finn',
    name: 'Old Finn',
    flavor: {
      hero: '"Good blade needs good balance. You want the truth or the flattering answer?"',
      villain: '"Cash up front. I don\'t extend credit to folks who don\'t give their real name."',
    },
    socialRestore: same(8),
    schedule: [
      { hour: 7, ...FORGE_DOOR, label: 'stoking the forge' },
      { hour: 19, ...SOUTH_FORGE_ROAD, label: 'heading home for the night' },
    ],
  },
  {
    id: 'wren',
    name: 'Wren the Messenger',
    flavor: same('"Bet you can\'t catch me!" She\'s already gone before you can answer.'),
    socialRestore: same(5),
    // A restless kid's all-day loop — deliberately routed so no leg's straight
    // line clips a building's collision box (see gen scripts for the same
    // concern with player pathing). Doesn't care about your alignment.
    schedule: [
      { hour: 0, ...EAST_CROSSROADS, label: 'still up past bedtime, darting through the crossroads' },
      { hour: 4, ...MARKET_DOOR, label: 'ducking around the market stalls before dawn deliveries' },
      { hour: 8, ...WEST_CROSSROADS, label: 'racing through the west crossroads' },
      { hour: 12, ...TAVERN_DOOR, label: 'begging scraps outside the tavern' },
      { hour: 16, ...GATE_DOOR, label: 'daring herself to touch the sealed gate and running off' },
      { hour: 18, ...SOUTH_FORGE_ROAD, label: 'circling back along the south road' },
      { hour: 20, ...FORGE_DOOR, label: 'bothering Old Finn at the forge' },
    ],
  },
  {
    id: 'mira',
    name: 'Mira the Scrivener',
    flavor: {
      hero: '"Careful with that ink, it still bites." She taps a shelf of scrolls. "This one\'s about the old maps, if you\'re curious."',
      villain: 'She doesn\'t stop writing. "I don\'t sell rumors. I sell parchment." A pause. "Rumors cost extra."',
    },
    socialRestore: same(8),
    schedule: [
      { hour: 7, ...STUDY_DOOR, label: 'cataloguing scrolls at the Study' },
      { hour: 21, ...EAST_ROAD_SOUTH, label: 'heading home for the night' },
    ],
  },
  {
    id: 'silas',
    name: 'Silas the Well-Keeper',
    flavor: {
      hero: '"Fetch water if you like — just mind the bucket rope, it\'s seen better decades."',
      villain: '"Well\'s just a well." He doesn\'t quite meet your eyes. "Unless you\'re asking the right way."',
    },
    socialRestore: same(6),
    schedule: [
      { hour: 8, ...WELL_DOOR, label: 'minding the well' },
      { hour: 19, ...SOUTH_WELL_ROAD, label: 'heading home for the night' },
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
