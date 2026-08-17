import type { CharacterClass } from '../data/characters';

class GameState {
  selectedCharacter: CharacterClass | null = null;
}

export const gameState = new GameState();
