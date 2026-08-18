import warriorUrl from '../assets/characters/warrior.png';
import mageUrl from '../assets/characters/mage.png';
import rogueUrl from '../assets/characters/rogue.png';
import huntressUrl from '../assets/characters/huntress.png';
import plagueDoctorUrl from '../assets/characters/plague-doctor.png';
import banditLordUrl from '../assets/characters/bandit-lord.png';
import necromancerUrl from '../assets/characters/necromancer.png';
import corruptedDuelistUrl from '../assets/characters/corrupted-duelist.png';

import grassUrl from '../assets/tiles/grass.png';
import pathUrl from '../assets/tiles/path.png';

import bld0Url from '../assets/buildings/bld-0.png';
import bld1Url from '../assets/buildings/bld-1.png';
import bld2Url from '../assets/buildings/bld-2.png';
import bld3Url from '../assets/buildings/bld-3.png';
import bld4Url from '../assets/buildings/bld-4.png';
import bld5Url from '../assets/buildings/bld-5.png';

import bakerUrl from '../assets/npcs/baker.png';
import barkeepUrl from '../assets/npcs/barkeep.png';
import watchmanUrl from '../assets/npcs/watchman.png';
import finnUrl from '../assets/npcs/finn.png';
import wrenUrl from '../assets/npcs/wren.png';

export const CHARACTER_IMAGES: Record<string, string> = {
  warrior: warriorUrl,
  mage: mageUrl,
  rogue: rogueUrl,
  huntress: huntressUrl,
  'plague-doctor': plagueDoctorUrl,
  'bandit-lord': banditLordUrl,
  necromancer: necromancerUrl,
  'corrupted-duelist': corruptedDuelistUrl,
};

export const TILE_IMAGES: Record<'grass' | 'path', string> = {
  grass: grassUrl,
  path: pathUrl,
};

export const BUILDING_IMAGES: string[] = [bld0Url, bld1Url, bld2Url, bld3Url, bld4Url, bld5Url];

export const NPC_IMAGES: Record<string, string> = {
  baker: bakerUrl,
  barkeep: barkeepUrl,
  watchman: watchmanUrl,
  finn: finnUrl,
  wren: wrenUrl,
};
