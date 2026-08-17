import Phaser from 'phaser';
import { TILE_SIZE } from '../gfx/constants';
import { gameState } from '../state/gameState';
import { NeedsSystem, type NeedKey } from '../systems/NeedsSystem';
import { DayNightCycle } from '../systems/DayNightCycle';
import { CHARACTER_CLASSES } from '../data/characters';

const MAP_COLS = 40;
const MAP_ROWS = 28;
const MOVE_SPEED = 120;

interface Building {
  name: string;
  x: number; // top-left, world px
  y: number;
  w: number;
  h: number;
  flavor: string;
  restores: Partial<Record<NeedKey, number>>;
  sprite?: Phaser.GameObjects.Image;
  zone?: Phaser.GameObjects.Zone;
}

const PATH_RECTS = [
  { x: 8, y: 0, w: 2, h: MAP_ROWS },
  { x: 0, y: 13, w: MAP_COLS, h: 2 },
  { x: 24, y: 0, w: 2, h: MAP_ROWS },
];

export class TownScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private eKey!: Phaser.Input.Keyboard.Key;
  private needs = new NeedsSystem();
  private clock = new DayNightCycle();
  private buildings: Building[] = [];
  private nearBuilding: Building | null = null;
  private overlay!: Phaser.GameObjects.Rectangle;
  private promptText!: Phaser.GameObjects.Text;
  private dialogContainer?: Phaser.GameObjects.Container;
  private clockText!: Phaser.GameObjects.Text;
  private needBars: Record<NeedKey, { bar: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }> = {} as never;
  private readonly needColors: Record<NeedKey, number> = { hunger: 0xe07a3f, energy: 0x3ddc84, social: 0x6fa8ff };
  private uiCamera!: Phaser.Cameras.Scene2D.Camera;

  constructor() {
    super('Town');
  }

  create(): void {
    if (!gameState.selectedCharacter) {
      gameState.selectedCharacter = CHARACTER_CLASSES[0];
    }
    const cls = gameState.selectedCharacter;

    const worldW = MAP_COLS * TILE_SIZE;
    const worldH = MAP_ROWS * TILE_SIZE;
    this.physics.world.setBounds(0, 0, worldW, worldH);

    this.drawGround();
    this.setupBuildings();

    this.player = this.physics.add.sprite(worldW / 2, worldH / 2 + 40, `char-${cls.id}`);
    this.player.setCollideWorldBounds(true);
    this.player.body!.setSize(10, 8).setOffset(3, 15);

    this.buildings.forEach((b) => {
      if (b.sprite) this.physics.add.collider(this.player, b.sprite);
    });

    this.cameras.main.setBounds(0, 0, worldW, worldH);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setZoom(2);

    // The main camera is zoomed in on the world; scrollFactor(0) alone doesn't
    // stop zoom from also scaling/misplacing "fixed" HUD elements, so HUD lives
    // on its own unzoomed camera that ignores world objects (and vice versa).
    this.uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.uiCamera.ignore(this.children.list);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as never;
    this.eKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    this.overlay = this.addUI(
      this.add
        .rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width * 2, this.scale.height * 2, 0x000000, 0)
        .setDepth(90),
    );

    this.buildHud(cls.name, cls.alignment);
  }

  private addUI<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.cameras.main.ignore(obj);
    return obj;
  }

  private drawGround(): void {
    for (let ty = 0; ty < MAP_ROWS; ty++) {
      for (let tx = 0; tx < MAP_COLS; tx++) {
        const onPath = PATH_RECTS.some(
          (r) => tx >= r.x && tx < r.x + r.w && ty >= r.y && ty < r.y + r.h,
        );
        this.add.image(tx * TILE_SIZE, ty * TILE_SIZE, onPath ? 'tile-path' : 'tile-grass').setOrigin(0);
      }
    }
  }

  private setupBuildings(): void {
    const defs: Omit<Building, 'sprite' | 'zone'>[] = [
      {
        name: 'The Sleepy Slime Tavern',
        x: 40,
        y: 40,
        w: 96,
        h: 80,
        flavor:
          'The bartender pours something fizzy and blue. "On the house — you look like you crawled out of a dungeon." Hunger and mood restored.',
        restores: { hunger: 45, social: 30 },
      },
      {
        name: 'Market Row',
        x: 200,
        y: 40,
        w: 96,
        h: 72,
        flavor:
          'Stalls of dried mushrooms, cured meats, and suspiciously glowing potions. You grab a quick bite.',
        restores: { hunger: 35 },
      },
      {
        name: 'Your Cottage',
        x: 40,
        y: 300,
        w: 88,
        h: 76,
        flavor: 'Home. You collapse into bed for a while and feel your energy return.',
        restores: { energy: 55 },
      },
      {
        name: "Adventurers' Guild Hall",
        x: 200,
        y: 300,
        w: 100,
        h: 84,
        flavor:
          'Old dungeon maps line the walls. A few familiar faces trade stories about the depths below town. Good company.',
        restores: { social: 40 },
      },
      {
        name: 'Sealed Dungeon Gate',
        x: 460,
        y: 170,
        w: 90,
        h: 90,
        flavor:
          'A heavy iron gate, chained shut, humming faintly. A sign reads: "Closed for renovation — VR wing coming soon."',
        restores: {},
      },
    ];

    defs.forEach((def, i) => {
      const key = `bld-${i}`;
      const sprite = this.physics.add.staticImage(def.x + def.w / 2, def.y + def.h / 2, key);
      sprite.setSize(def.w, def.h * 0.72).setOffset(0, def.h * 0.28);
      sprite.refreshBody();

      this.add
        .text(def.x + def.w / 2, def.y - 10, def.name, {
          fontFamily: 'monospace',
          fontSize: '10px',
          color: '#ffe9a8',
          backgroundColor: '#00000088',
          padding: { x: 3, y: 2 },
        })
        .setOrigin(0.5, 1);

      const zone = this.add.zone(def.x + def.w / 2, def.y + def.h + 10, def.w * 0.8, 24);
      this.physics.add.existing(zone, true);

      this.buildings.push({ ...def, sprite, zone });
    });
  }

  private buildHud(className: string, alignment: string): void {
    this.addUI(
      this.add
        .text(10, 8, `${className} (${alignment})`, {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: '#ffffff',
          backgroundColor: '#00000066',
          padding: { x: 4, y: 2 },
        })
        .setDepth(100),
    );

    const needKeys: NeedKey[] = ['hunger', 'energy', 'social'];
    needKeys.forEach((key, i) => {
      const y = 34 + i * 20;
      this.addUI(
        this.add.rectangle(10, y, 120, 12, 0x1a1a1a, 0.6).setOrigin(0, 0.5).setDepth(100),
      );
      const bar = this.addUI(
        this.add.rectangle(11, y, 118, 10, this.needColors[key], 1).setOrigin(0, 0.5).setDepth(101),
      );
      const labelText = this.addUI(
        this.add
          .text(135, y, key, { fontFamily: 'monospace', fontSize: '11px', color: '#cfd6ea' })
          .setOrigin(0, 0.5)
          .setDepth(101),
      );
      this.needBars[key] = { bar, label: labelText };
    });

    this.clockText = this.addUI(
      this.add
        .text(this.scale.width - 10, 10, '', {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#ffe9a8',
          backgroundColor: '#00000066',
          padding: { x: 4, y: 2 },
        })
        .setOrigin(1, 0)
        .setDepth(100),
    );

    this.promptText = this.addUI(
      this.add
        .text(this.scale.width / 2, this.scale.height - 30, '', {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: '#0b1a10',
          backgroundColor: '#ffe9a8',
          padding: { x: 8, y: 4 },
        })
        .setOrigin(0.5)
        .setDepth(100)
        .setVisible(false),
    );
  }

  update(_time: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    this.needs.update(dt);
    this.clock.update(dt);

    this.handleMovement();
    this.updateNearBuilding();
    this.updateHud();

    const ePressed = Phaser.Input.Keyboard.JustDown(this.eKey);
    if (ePressed) {
      if (this.dialogContainer) {
        this.dialogContainer.destroy();
        this.dialogContainer = undefined;
      } else if (this.nearBuilding) {
        this.enterBuilding(this.nearBuilding);
      }
    }
  }

  private handleMovement(): void {
    if (this.dialogContainer) {
      this.player.setVelocity(0, 0);
      return;
    }
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    let vx = 0;
    let vy = 0;
    if (this.cursors.left?.isDown || this.wasd.A.isDown) vx -= 1;
    if (this.cursors.right?.isDown || this.wasd.D.isDown) vx += 1;
    if (this.cursors.up?.isDown || this.wasd.W.isDown) vy -= 1;
    if (this.cursors.down?.isDown || this.wasd.S.isDown) vy += 1;

    const len = Math.hypot(vx, vy) || 1;
    body.setVelocity((vx / len) * MOVE_SPEED, (vy / len) * MOVE_SPEED);
  }

  private updateNearBuilding(): void {
    let found: Building | null = null;
    for (const b of this.buildings) {
      if (!b.zone) continue;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, b.zone.x, b.zone.y);
      if (dist < 40) {
        found = b;
        break;
      }
    }
    this.nearBuilding = found;
    if (found && !this.dialogContainer) {
      this.promptText.setText(`Press E to enter ${found.name}`).setVisible(true);
    } else if (!this.dialogContainer) {
      this.promptText.setVisible(false);
    }
  }

  private enterBuilding(b: Building): void {
    for (const [key, amount] of Object.entries(b.restores) as [NeedKey, number][]) {
      this.needs.restore(key, amount);
    }
    this.promptText.setVisible(false);
    this.showDialog(b.name, b.flavor);
  }

  private showDialog(title: string, body: string): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const container = this.addUI(this.add.container(w / 2, h / 2).setDepth(200));
    const bg = this.add.rectangle(0, 0, Math.min(w - 60, 480), 180, 0x14141c, 0.96).setStrokeStyle(2, 0xffe9a8);
    const titleText = this.add
      .text(0, -70, title, { fontFamily: 'monospace', fontSize: '16px', color: '#ffe9a8', fontStyle: 'bold' })
      .setOrigin(0.5);
    const bodyText = this.add
      .text(0, -10, body, {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#dfe4f2',
        wordWrap: { width: Math.min(w - 100, 420) },
        align: 'center',
      })
      .setOrigin(0.5);
    const hint = this.add
      .text(0, 70, 'Press E to continue', { fontFamily: 'monospace', fontSize: '11px', color: '#9aa4c0' })
      .setOrigin(0.5);
    container.add([bg, titleText, bodyText, hint]);
    this.dialogContainer = container;
  }

  private updateHud(): void {
    (Object.keys(this.needBars) as NeedKey[]).forEach((key) => {
      const pct = this.needs.get(key) / 100;
      const { bar } = this.needBars[key];
      bar.width = 118 * pct;
      bar.fillColor = this.needs.isCritical(key) ? 0xff4d4d : this.needColors[key];
    });

    this.clockText.setText(`${this.clock.getClockString()} · ${this.clock.getPhase()}`);
    const { color, alpha } = this.clock.getOverlay();
    this.overlay.setFillStyle(color, alpha);
  }
}
