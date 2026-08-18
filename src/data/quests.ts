import type { Alignment } from './characters';
import type { NeedKey } from '../systems/NeedsSystem';
import type { Phase } from '../systems/DayNightCycle';

export type QuestStepType = 'talk' | 'visit';

export interface QuestStep {
  type: QuestStepType;
  /** NPC id (for 'talk') or building id (for 'visit') — see npcs.ts ids and TownScene's building defs. */
  targetId: string;
  text: string;
  /** Optional time-of-day gate, e.g. the villain finale step requiring night. */
  requiresPhase?: Phase;
}

export interface QuestReward {
  reputation: number;
  needs?: Partial<Record<NeedKey, number>>;
}

export interface Quest {
  id: string;
  alignment: Alignment;
  name: string;
  summary: string;
  steps: QuestStep[];
  reward: QuestReward;
}

// Each alignment's quests unlock in array order, one active at a time —
// QuestSystem tracks an index into this filtered-by-alignment list, not raw
// array position, so hero and villain questlines progress independently.
export const QUEST_SPECS: Quest[] = [
  {
    id: 'hero-prove-your-worth',
    alignment: 'hero',
    name: 'Prove Your Worth',
    summary: 'The guild wants to see what you\'re made of before they call you one of their own.',
    steps: [
      { type: 'visit', targetId: 'guild', text: 'Introduce yourself at the Guild Hall.' },
      { type: 'talk', targetId: 'watchman', text: 'Ask Watchman Bram about the gate.' },
      { type: 'visit', targetId: 'gate', text: 'See the Sealed Dungeon Gate for yourself.' },
    ],
    reward: { reputation: 8, needs: { energy: 20 } },
  },
  {
    id: 'hero-finns-favor',
    alignment: 'hero',
    name: "Finn's Favor",
    summary: "Old Finn's short on hands at the forge. A little help goes a long way.",
    steps: [
      { type: 'talk', targetId: 'finn', text: 'Talk to Old Finn at the Rusty Anvil.' },
      { type: 'visit', targetId: 'market', text: 'Pick up supplies at Market Row.' },
      { type: 'talk', targetId: 'finn', text: 'Bring the supplies back to Finn.' },
    ],
    reward: { reputation: 8, needs: { hunger: 20 } },
  },
  {
    id: 'hero-watch-over-wren',
    alignment: 'hero',
    name: 'Watch Over Wren',
    summary: "Wren's been running wild after dark. Someone ought to keep an eye on her.",
    steps: [
      { type: 'talk', targetId: 'wren', text: 'Catch up with Wren the Messenger.' },
      { type: 'talk', targetId: 'baker', text: "Ask Greta if she's seen Wren around." },
      { type: 'talk', targetId: 'wren', text: 'Find Wren again and see her home safe.' },
    ],
    reward: { reputation: 12, needs: { social: 30, energy: 15, hunger: 15 } },
  },
  {
    id: 'villain-first-impressions',
    alignment: 'villain',
    name: 'First Impressions',
    summary: "Word travels fast in a small town. Make sure it's the right kind of word.",
    steps: [
      { type: 'talk', targetId: 'barkeep', text: 'Get a read on Sella at the tavern.' },
      { type: 'visit', targetId: 'gate', text: 'Size up the Sealed Dungeon Gate.' },
      { type: 'talk', targetId: 'watchman', text: 'See how Watchman Bram reacts to you.' },
    ],
    reward: { reputation: 8, needs: { energy: 20 } },
  },
  {
    id: 'villain-leverage',
    alignment: 'villain',
    name: 'Leverage',
    summary: "Old Finn doesn't hand out favors for free. Time to change that.",
    steps: [
      { type: 'talk', targetId: 'finn', text: 'Lean on Old Finn at the forge.' },
      { type: 'visit', targetId: 'market', text: 'Case Market Row for an opportunity.' },
      { type: 'talk', targetId: 'finn', text: 'Collect what Finn owes you.' },
    ],
    reward: { reputation: 8, needs: { hunger: 20 } },
  },
  {
    id: 'villain-the-long-game',
    alignment: 'villain',
    name: 'The Long Game',
    summary: "The gate hums louder after dark. Whatever's behind it, it's yours for the taking — if you're patient.",
    steps: [
      { type: 'talk', targetId: 'wren', text: 'Get Wren talking — kids hear everything.' },
      { type: 'visit', targetId: 'gate', text: 'Return to the gate after nightfall.', requiresPhase: 'night' },
      { type: 'talk', targetId: 'watchman', text: 'Make sure Bram never suspects a thing.' },
    ],
    reward: { reputation: 12, needs: { social: 20, energy: 20, hunger: 20 } },
  },
];
