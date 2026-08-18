import Phaser from 'phaser';
import { CHARACTER_IMAGES, TILE_IMAGES, BUILDING_IMAGES, NPC_IMAGES } from '../gfx/assets';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    for (const [id, url] of Object.entries(CHARACTER_IMAGES)) {
      this.load.image(`char-${id}`, url);
    }
    this.load.image('tile-grass', TILE_IMAGES.grass);
    this.load.image('tile-path', TILE_IMAGES.path);
    BUILDING_IMAGES.forEach((url, i) => this.load.image(`bld-${i}`, url));
    for (const [id, url] of Object.entries(NPC_IMAGES)) {
      this.load.image(`npc-${id}`, url);
    }
  }

  create(): void {
    this.scene.start('CharacterSelect');
  }
}
