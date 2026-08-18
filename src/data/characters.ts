export type Alignment = 'hero' | 'villain';

export interface CharacterClass {
  id: string;
  name: string;
  alignment: Alignment;
  tagline: string;
  description: string;
  skinColor: number;
  outfitColor: number;
  accentColor: number;
}

export const CHARACTER_CLASSES: CharacterClass[] = [
  {
    id: 'warrior',
    name: 'Warrior',
    alignment: 'hero',
    tagline: 'Iron will, steady hand',
    description:
      'A retired dungeon veteran who traded the depths for a quiet cottage — though old habits (and old armor) die hard.',
    skinColor: 0xe0ac69,
    outfitColor: 0x8a1f1f,
    accentColor: 0xc9a227,
  },
  {
    id: 'mage',
    name: 'Mage',
    alignment: 'hero',
    tagline: 'Curious, careful, combustible',
    description:
      'Runs the town’s scroll shop by day and experiments with volatile enchantments by lamplight.',
    skinColor: 0xf1c27d,
    outfitColor: 0x2b3a8f,
    accentColor: 0x6fd3ff,
  },
  {
    id: 'rogue',
    name: 'Rogue',
    alignment: 'hero',
    tagline: 'Quiet feet, quicker wit',
    description:
      'Knows every rooftop and back alley in town — useful for a courier, suspicious for everyone else.',
    skinColor: 0xc68642,
    outfitColor: 0x2f2f2f,
    accentColor: 0x4c9a2a,
  },
  {
    id: 'huntress',
    name: 'Huntress',
    alignment: 'hero',
    tagline: 'Wild at heart, warm at home',
    description:
      'Splits her time between the forest edge and the market stall, trading pelts for gossip.',
    skinColor: 0xd8a06e,
    outfitColor: 0x2e5339,
    accentColor: 0xd97b29,
  },
  {
    id: 'plague-doctor',
    name: 'Plague Doctor',
    alignment: 'villain',
    tagline: 'Prescribes trouble',
    description:
      'Sells "cures" of questionable origin from a cart that smells faintly of the dungeon’s lower floors.',
    skinColor: 0xcfcfcf,
    outfitColor: 0x1c1c1c,
    accentColor: 0x7a2e8f,
  },
  {
    id: 'bandit-lord',
    name: 'Bandit Lord',
    alignment: 'villain',
    tagline: 'Taxes you personally',
    description:
      'Runs a "protection" racket out of the tavern’s back room and never quite pays for a drink.',
    skinColor: 0xb97a56,
    outfitColor: 0x5c1a1a,
    accentColor: 0x1a1a1a,
  },
  {
    id: 'necromancer',
    name: 'Necromancer',
    alignment: 'villain',
    tagline: 'Keeps odd company',
    description:
      'Lives at the edge of town where the fences lean and the crows don’t leave. Neighbors have opinions.',
    skinColor: 0xa9a4c9,
    outfitColor: 0x1f1330,
    accentColor: 0x3ddc84,
  },
  {
    id: 'corrupted-duelist',
    name: 'Corrupted Duelist',
    alignment: 'villain',
    tagline: 'Charming, until it isn’t',
    description:
      'A once-celebrated blade-for-hire, now chasing a whisper from the dungeon that never quite lets go.',
    skinColor: 0xe6b98c,
    outfitColor: 0x4a0e0e,
    accentColor: 0xffd166,
  },
];

export function getCharacterClass(id: string): CharacterClass {
  const found = CHARACTER_CLASSES.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown character class: ${id}`);
  return found;
}
