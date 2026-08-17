import type { CharacterClass } from '../data/characters';
import type { SaveData } from '../systems/SaveSystem';

class GameState {
  selectedCharacter: CharacterClass | null = null;
  /** Set by "Continue" on character select, consumed once by TownScene.create(). */
  resumeSave: SaveData | null = null;
}

export const gameState = new GameState();
