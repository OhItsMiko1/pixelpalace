import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { CharacterSelectScene } from './scenes/CharacterSelectScene';
import { TownScene } from './scenes/TownScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'app',
  width: 960,
  height: 640,
  backgroundColor: '#0b0b12',
  pixelArt: true,
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scene: [BootScene, CharacterSelectScene, TownScene],
});
