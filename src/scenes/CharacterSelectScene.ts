import Phaser from 'phaser';
import { CHARACTER_CLASSES, type CharacterClass } from '../data/characters';
import { gameState } from '../state/gameState';
import { loadGame, type SaveData } from '../systems/SaveSystem';
import { formatClockString } from '../systems/DayNightCycle';

const CARD_W = 168;
const CARD_H = 148;
const COLS = 4;
const GAP = 18;

export class CharacterSelectScene extends Phaser.Scene {
  private selectedId: string | null = null;
  private cardBorders = new Map<string, Phaser.GameObjects.Rectangle>();
  private startButton!: Phaser.GameObjects.Container;

  constructor() {
    super('CharacterSelect');
  }

  create(): void {
    const { width } = this.scale;

    this.add
      .text(width / 2, 46, 'PIXEL PALACE', {
        fontFamily: 'monospace',
        fontSize: '40px',
        color: '#ffe9a8',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, 84, 'Choose who lives here — hero or villain.', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#b8c0d8',
      })
      .setOrigin(0.5);

    const gridW = COLS * CARD_W + (COLS - 1) * GAP;
    const startX = width / 2 - gridW / 2 + CARD_W / 2;
    const startY = 190;

    CHARACTER_CLASSES.forEach((cls, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = startX + col * (CARD_W + GAP);
      const y = startY + row * (CARD_H + GAP);
      this.createCard(cls, x, y);
    });

    this.startButton = this.createStartButton(width / 2, startY + 2 * (CARD_H + GAP) + 30);
    this.setStartEnabled(false);

    const save = loadGame();
    if (save) this.createContinueBanner(save);

    this.add
      .text(width / 2, this.scale.height - 10, 'Unofficial fan project — not affiliated with Shattered Pixel Dungeon', {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#5a6180',
      })
      .setOrigin(0.5, 1);
  }

  private createContinueBanner(save: SaveData): void {
    const cls = CHARACTER_CLASSES.find((c) => c.id === save.characterId);
    if (!cls) return;

    const w = 210;
    const h = 52;
    const x = this.scale.width - 16 - w / 2;
    const y = 16 + h / 2;
    const container = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, w, h, 0x14251a, 1).setStrokeStyle(2, 0x3ddc84);
    const label = this.add
      .text(0, -13, `Continue as ${cls.name}`, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#3ddc84',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    const sub = this.add
      .text(0, 11, `Day ${save.day} · ${formatClockString(save.hours)}`, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#9aa4c0',
      })
      .setOrigin(0.5);

    container.add([bg, label, sub]);
    container.setSize(w, h);
    container.setInteractive({ useHandCursor: true });
    container.on('pointerover', () => bg.setFillStyle(0x1e3a26, 1));
    container.on('pointerout', () => bg.setFillStyle(0x14251a, 1));
    container.on('pointerdown', () => {
      gameState.selectedCharacter = cls;
      gameState.resumeSave = save;
      this.scene.start('Town');
    });
  }

  private createCard(cls: CharacterClass, x: number, y: number): void {
    const container = this.add.container(x, y);

    const bg = this.add
      .rectangle(0, 0, CARD_W, CARD_H, 0x1b1f2e, 1)
      .setStrokeStyle(2, cls.alignment === 'villain' ? 0x7a2e2e : 0x2e4a7a);
    const border = this.add
      .rectangle(0, 0, CARD_W, CARD_H)
      .setStrokeStyle(3, 0xffe9a8, 0)
      .setFillStyle(0x000000, 0);
    this.cardBorders.set(cls.id, border);

    const tag = this.add
      .text(-CARD_W / 2 + 8, -CARD_H / 2 + 6, cls.alignment.toUpperCase(), {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: cls.alignment === 'villain' ? '#ff8f8f' : '#8fb8ff',
      })
      .setOrigin(0, 0);

    const sprite = this.add.image(0, -20, `char-${cls.id}`).setScale(3.4);

    const name = this.add
      .text(0, 38, cls.name, {
        fontFamily: 'monospace',
        fontSize: '17px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    const tagline = this.add
      .text(0, 58, cls.tagline, {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#9aa4c0',
        wordWrap: { width: CARD_W - 20 },
        align: 'center',
      })
      .setOrigin(0.5, 0);

    container.add([bg, border, tag, sprite, name, tagline]);
    container.setSize(CARD_W, CARD_H);
    container.setInteractive({ useHandCursor: true });

    container.on('pointerover', () => bg.setFillStyle(0x262b40, 1));
    container.on('pointerout', () => bg.setFillStyle(0x1b1f2e, 1));
    container.on('pointerdown', () => this.selectCharacter(cls.id));
  }

  private selectCharacter(id: string): void {
    this.selectedId = id;
    for (const [charId, border] of this.cardBorders) {
      border.setStrokeStyle(3, 0xffe9a8, charId === id ? 1 : 0);
    }
    this.setStartEnabled(true);
  }

  private createStartButton(x: number, y: number): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, 220, 52, 0x3ddc84, 1).setStrokeStyle(2, 0x1c8f4f);
    const label = this.add
      .text(0, 0, 'ENTER TOWN', {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#0b1a10',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    container.add([bg, label]);
    container.setSize(220, 52);
    container.setInteractive({ useHandCursor: true });
    container.on('pointerdown', () => {
      if (!this.selectedId) return;
      gameState.selectedCharacter =
        CHARACTER_CLASSES.find((c) => c.id === this.selectedId) ?? null;
      this.scene.start('Town');
    });
    return container;
  }

  private setStartEnabled(enabled: boolean): void {
    this.startButton.setAlpha(enabled ? 1 : 0.35);
    if (enabled) {
      this.startButton.input!.enabled = true;
    } else if (this.startButton.input) {
      this.startButton.input.enabled = false;
    }
  }
}
