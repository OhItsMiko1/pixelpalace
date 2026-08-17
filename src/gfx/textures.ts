import Phaser from 'phaser';
import type { CharacterClass } from '../data/characters';

const CHAR_W = 16;
const CHAR_H = 24;
export const TILE_SIZE = 16;

/** Draws a simple placeholder humanoid sprite for a character class onto a new texture. */
export function generateCharacterTexture(
  scene: Phaser.Scene,
  key: string,
  cls: CharacterClass,
): void {
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics();

  // hair / hat accent
  g.fillStyle(cls.accentColor, 1);
  g.fillRect(4, 0, 8, 3);

  // head
  g.fillStyle(cls.skinColor, 1);
  g.fillRect(5, 2, 6, 6);

  // eyes
  g.fillStyle(0x1a1a1a, 1);
  g.fillRect(6, 5, 1, 1);
  g.fillRect(9, 5, 1, 1);

  // outfit / body
  g.fillStyle(cls.outfitColor, 1);
  g.fillRect(4, 9, 8, 9);

  // belt / accent stripe
  g.fillStyle(cls.accentColor, 1);
  g.fillRect(4, 13, 8, 2);

  // arms
  g.fillStyle(cls.skinColor, 1);
  g.fillRect(2, 10, 2, 6);
  g.fillRect(12, 10, 2, 6);

  // legs
  g.fillStyle(0x2a2a2a, 1);
  g.fillRect(5, 18, 2, 5);
  g.fillRect(9, 18, 2, 5);

  // villain cape flourish
  if (cls.alignment === 'villain') {
    g.fillStyle(cls.outfitColor, 0.85);
    g.fillRect(1, 9, 2, 10);
    g.fillRect(13, 9, 2, 10);
  }

  g.generateTexture(key, CHAR_W, CHAR_H);
  g.destroy();
}

export function generateGrassTile(scene: Phaser.Scene, key: string): void {
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics();
  g.fillStyle(0x3a7d3f, 1);
  g.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  g.fillStyle(0x2f6b34, 1);
  g.fillRect(2, 3, 2, 2);
  g.fillRect(9, 7, 2, 2);
  g.fillRect(5, 12, 2, 2);
  g.fillRect(12, 2, 2, 2);
  g.generateTexture(key, TILE_SIZE, TILE_SIZE);
  g.destroy();
}

export function generatePathTile(scene: Phaser.Scene, key: string): void {
  if (scene.textures.exists(key)) return;
  const g = scene.add.graphics();
  g.fillStyle(0xc2a06a, 1);
  g.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
  g.fillStyle(0xb08e57, 1);
  g.fillRect(1, 2, 2, 2);
  g.fillRect(10, 9, 2, 2);
  g.fillRect(6, 5, 2, 2);
  g.generateTexture(key, TILE_SIZE, TILE_SIZE);
  g.destroy();
}

export interface BuildingSpec {
  key: string;
  width: number;
  height: number;
  wallColor: number;
  roofColor: number;
  doorColor: number;
}

export function generateBuildingTexture(scene: Phaser.Scene, spec: BuildingSpec): void {
  if (scene.textures.exists(spec.key)) return;
  const { key, width, height, wallColor, roofColor, doorColor } = spec;
  const g = scene.add.graphics();
  const roofH = Math.floor(height * 0.28);

  // walls
  g.fillStyle(wallColor, 1);
  g.fillRect(0, roofH, width, height - roofH);

  // roof (triangle)
  g.fillStyle(roofColor, 1);
  g.fillTriangle(0, roofH, width, roofH, width / 2, 0);

  // windows
  g.fillStyle(0xffe9a8, 1);
  const winY = roofH + Math.floor((height - roofH) * 0.25);
  g.fillRect(width * 0.15, winY, width * 0.15, width * 0.15);
  g.fillRect(width * 0.7, winY, width * 0.15, width * 0.15);

  // door
  g.fillStyle(doorColor, 1);
  const doorW = width * 0.22;
  const doorH = height - roofH - height * 0.05;
  g.fillRect(width / 2 - doorW / 2, height - doorH, doorW, doorH);

  g.generateTexture(key, width, height);
  g.destroy();
}
