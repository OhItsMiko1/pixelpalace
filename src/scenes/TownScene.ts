import Phaser from 'phaser';
import { TILE_SIZE } from '../gfx/constants';
import { gameState } from '../state/gameState';
import { NeedsSystem, type NeedKey } from '../systems/NeedsSystem';
import { DayNightCycle } from '../systems/DayNightCycle';
import { CHARACTER_CLASSES, type Alignment } from '../data/characters';
import { NPC_SPECS, getScheduleTarget, type NpcSpec } from '../data/npcs';
import { same, type ByAlignment } from '../data/alignment';

const MAP_COLS = 40;
const MAP_ROWS = 28;
const MOVE_SPEED = 120;
const NPC_SPEED = 45;
const NPC_ARRIVE_DIST = 4;
const INTERACT_DIST = 40;

interface Building {
  name: string;
  x: number; // top-left, world px
  y: number;
  w: number;
  h: number;
  flavor: ByAlignment<string>;
  restores: ByAlignment<Partial<Record<NeedKey, number>>>;
  sprite?: Phaser.GameObjects.Image;
  zone?: Phaser.GameObjects.Zone;
}

interface NpcRuntime {
  spec: NpcSpec;
  sprite: Phaser.Physics.Arcade.Sprite;
  label: Phaser.GameObjects.Text;
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
  private buildingGroup!: Phaser.Physics.Arcade.StaticGroup;
  private npcs: NpcRuntime[] = [];
  private nearBuilding: Building | null = null;
  private nearNpc: NpcRuntime | null = null;
  private overlay!: Phaser.GameObjects.Rectangle;
  private promptText!: Phaser.GameObjects.Text;
  private dialogContainer?: Phaser.GameObjects.Container;
  private clockText!: Phaser.GameObjects.Text;
  private needBars: Record<NeedKey, { bar: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }> = {} as never;
  private readonly needColors: Record<NeedKey, number> = { hunger: 0xe07a3f, energy: 0x3ddc84, social: 0x6fa8ff };
  private uiCamera!: Phaser.Cameras.Scene2D.Camera;
  private alignment!: Alignment;

  constructor() {
    super('Town');
  }

  create(): void {
    if (!gameState.selectedCharacter) {
      gameState.selectedCharacter = CHARACTER_CLASSES[0];
    }
    const cls = gameState.selectedCharacter;
    this.alignment = cls.alignment;

    const worldW = MAP_COLS * TILE_SIZE;
    const worldH = MAP_ROWS * TILE_SIZE;
    this.physics.world.setBounds(0, 0, worldW, worldH);

    this.buildingGroup = this.physics.add.staticGroup();
    this.drawGround();
    this.setupBuildings();
    this.setupNpcs();

    this.player = this.physics.add.sprite(worldW / 2, worldH / 2 + 40, `char-${cls.id}`);
    this.player.setCollideWorldBounds(true);
    this.player.body!.setSize(10, 8).setOffset(3, 15);

    this.physics.add.collider(this.player, this.buildingGroup);
    // NPCs collide with buildings (so they don't clip through walls while
    // walking their schedule) but not with the player: a solid collider here
    // would fight the player for space right at a door-zone target — an NPC
    // stationed there gets shoved just far enough to miss the interact-range
    // check the instant the player closes in, making them un-talkable.
    this.npcs.forEach((npc) => {
      this.physics.add.collider(npc.sprite, this.buildingGroup);
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
        flavor: {
          hero: 'The bartender pours something fizzy and blue. "On the house — you look like you crawled out of a dungeon." Hunger and mood restored.',
          villain:
            'The bartender pours without meeting your eyes. Fast service, no small talk, no questions. Hunger and mood restored.',
        },
        restores: same({ hunger: 45, social: 30 }),
      },
      {
        name: 'Market Row',
        x: 200,
        y: 40,
        w: 96,
        h: 72,
        flavor: {
          hero: 'Stalls of dried mushrooms, cured meats, and suspiciously glowing potions. You grab a quick bite.',
          villain:
            'The vendor "loses count" of your change more than once. You don\'t correct her. You grab a quick bite.',
        },
        restores: same({ hunger: 35 }),
      },
      {
        name: 'Your Cottage',
        x: 40,
        y: 300,
        w: 88,
        h: 76,
        flavor: {
          hero: 'Home. You collapse into bed for a while and feel your energy return.',
          villain: 'Home — for now. You bar the door out of habit and feel your energy return.',
        },
        restores: same({ energy: 55 }),
      },
      {
        name: "Adventurers' Guild Hall",
        x: 200,
        y: 300,
        w: 100,
        h: 84,
        flavor: {
          hero: 'Old dungeon maps line the walls. A few familiar faces trade stories about the depths below town. Good company.',
          villain: 'Conversation dips the moment you walk in. Nobody asks you to sit. You linger near the door anyway.',
        },
        restores: { hero: { social: 40 }, villain: { social: 12 } },
      },
      {
        name: 'Sealed Dungeon Gate',
        x: 460,
        y: 170,
        w: 90,
        h: 90,
        flavor: {
          hero: 'A heavy iron gate, chained shut, humming faintly. A sign reads: "Closed for renovation — VR wing coming soon."',
          villain:
            'A heavy iron gate, chained shut, humming faintly. Something about the hum feels almost... familiar. A sign reads: "Closed for renovation — VR wing coming soon."',
        },
        restores: same({}),
      },
    ];

    defs.forEach((def, i) => {
      const key = `bld-${i}`;
      const sprite = this.physics.add.staticImage(def.x + def.w / 2, def.y + def.h / 2, key);
      sprite.setSize(def.w, def.h * 0.72).setOffset(0, def.h * 0.28);
      sprite.refreshBody();
      this.buildingGroup.add(sprite);

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

  private setupNpcs(): void {
    NPC_SPECS.forEach((spec) => {
      const start = getScheduleTarget(spec.schedule, this.clock.getHours());
      const sprite = this.physics.add.sprite(start.x, start.y, `npc-${spec.id}`);
      sprite.body!.setSize(10, 8).setOffset(3, 15);
      const label = this.add
        .text(start.x, start.y - 18, spec.name, {
          fontFamily: 'monospace',
          fontSize: '9px',
          color: '#dfe4f2',
          backgroundColor: '#00000088',
          padding: { x: 2, y: 1 },
        })
        .setOrigin(0.5, 1);
      this.npcs.push({ spec, sprite, label });
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
    this.updateNpcs(dt);
    this.updateNearInteractables();
    this.updateHud();

    const ePressed = Phaser.Input.Keyboard.JustDown(this.eKey);
    if (ePressed) {
      if (this.dialogContainer) {
        this.dialogContainer.destroy();
        this.dialogContainer = undefined;
      } else if (this.nearNpc) {
        this.talkToNpc(this.nearNpc);
      } else if (this.nearBuilding) {
        this.enterBuilding(this.nearBuilding);
      }
    }
  }

  private updateNpcs(_dt: number): void {
    for (const npc of this.npcs) {
      const target = getScheduleTarget(npc.spec.schedule, this.clock.getHours());
      const dx = target.x - npc.sprite.x;
      const dy = target.y - npc.sprite.y;
      const dist = Math.hypot(dx, dy);
      const body = npc.sprite.body as Phaser.Physics.Arcade.Body;
      if (dist > NPC_ARRIVE_DIST) {
        body.setVelocity((dx / dist) * NPC_SPEED, (dy / dist) * NPC_SPEED);
      } else {
        body.setVelocity(0, 0);
      }
      npc.label.setPosition(npc.sprite.x, npc.sprite.y - 18);
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

  private updateNearInteractables(): void {
    let nearestBuilding: Building | null = null;
    let nearestBuildingDist = Infinity;
    for (const b of this.buildings) {
      if (!b.zone) continue;
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, b.zone.x, b.zone.y);
      if (dist < INTERACT_DIST && dist < nearestBuildingDist) {
        nearestBuilding = b;
        nearestBuildingDist = dist;
      }
    }

    let nearestNpc: NpcRuntime | null = null;
    let nearestNpcDist = Infinity;
    for (const npc of this.npcs) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, npc.sprite.x, npc.sprite.y);
      if (dist < INTERACT_DIST && dist < nearestNpcDist) {
        nearestNpc = npc;
        nearestNpcDist = dist;
      }
    }

    // An NPC standing at a building's door zone can be nearer than the zone
    // itself — prefer talking to them over entering the building they're at.
    if (nearestNpc && nearestNpcDist <= nearestBuildingDist) {
      this.nearBuilding = null;
      this.nearNpc = nearestNpc;
    } else {
      this.nearNpc = null;
      this.nearBuilding = nearestBuilding;
    }

    if (this.dialogContainer) return;
    if (this.nearNpc) {
      this.promptText.setText(`Press E to talk to ${this.nearNpc.spec.name}`).setVisible(true);
    } else if (this.nearBuilding) {
      this.promptText.setText(`Press E to enter ${this.nearBuilding.name}`).setVisible(true);
    } else {
      this.promptText.setVisible(false);
    }
  }

  private enterBuilding(b: Building): void {
    const restores = b.restores[this.alignment];
    for (const [key, amount] of Object.entries(restores) as [NeedKey, number][]) {
      this.needs.restore(key, amount);
    }
    this.promptText.setVisible(false);
    this.showDialog(b.name, b.flavor[this.alignment]);
  }

  private talkToNpc(npc: NpcRuntime): void {
    this.needs.restore('social', npc.spec.socialRestore[this.alignment]);
    this.promptText.setVisible(false);
    this.showDialog(npc.spec.name, npc.spec.flavor[this.alignment]);
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
