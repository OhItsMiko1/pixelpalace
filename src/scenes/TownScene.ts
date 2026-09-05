import Phaser from 'phaser';
import { TILE_SIZE } from '../gfx/constants';
import { gameState } from '../state/gameState';
import { NeedsSystem, type NeedKey } from '../systems/NeedsSystem';
import { DayNightCycle, type Phase } from '../systems/DayNightCycle';
import { ReputationSystem } from '../systems/ReputationSystem';
import { CurrencySystem } from '../systems/CurrencySystem';
import { JobSystem } from '../systems/JobSystem';
import { JOBS } from '../data/jobs';
import { QuestSystem } from '../systems/QuestSystem';
import type { Quest } from '../data/quests';
import { CHARACTER_CLASSES, type Alignment } from '../data/characters';
import { NPC_SPECS, getScheduleTarget, type NpcSpec } from '../data/npcs';
import { same, type ByAlignment } from '../data/alignment';
import { saveGame } from '../systems/SaveSystem';
import { soundSystem } from '../systems/SoundSystem';

interface InteractionContext {
  alignment: Alignment;
  phase: Phase;
}

/** Static per-alignment content, or a resolver for content that also depends on time of day. */
type Resolvable<T> = ByAlignment<T> | ((ctx: InteractionContext) => T);

function resolve<T>(value: Resolvable<T>, ctx: InteractionContext): T {
  return typeof value === 'function' ? (value as (ctx: InteractionContext) => T)(ctx) : value[ctx.alignment];
}

const AUTOSAVE_INTERVAL_SECONDS = 10;

interface ShopItem {
  name: string;
  cost: number;
  needs: Partial<Record<NeedKey, number>>;
}

const SHOP_ITEMS: ShopItem[] = [
  { name: 'Hot Meal', cost: 5, needs: { hunger: 30 } },
  { name: "Traveler's Tonic", cost: 8, needs: { energy: 30 } },
  { name: 'Charm Trinket', cost: 6, needs: { social: 25 } },
];

const MAP_COLS = 40;
const MAP_ROWS = 28;
const MOVE_SPEED = 120;
const NPC_SPEED = 45;
const NPC_ARRIVE_DIST = 4;
const INTERACT_DIST = 40;

interface Building {
  /** Stable id for quest targeting — see data/quests.ts QuestStep.targetId. */
  id: string;
  name: string;
  x: number; // top-left, world px
  y: number;
  w: number;
  h: number;
  flavor: Resolvable<string>;
  restores: Resolvable<Partial<Record<NeedKey, number>>>;
  /** Opens the gold shop menu (SHOP_ITEMS) alongside the normal flavor dialog. */
  shop?: boolean;
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
  private qKey!: Phaser.Input.Keyboard.Key;
  private jKey!: Phaser.Input.Keyboard.Key;
  private mKey!: Phaser.Input.Keyboard.Key;
  private shopKeys: Phaser.Input.Keyboard.Key[] = [];
  private timeSkipKey?: Phaser.Input.Keyboard.Key;
  private isTouchDevice = false;
  private touchDpad: { up: boolean; down: boolean; left: boolean; right: boolean } = {
    up: false,
    down: false,
    left: false,
    right: false,
  };
  private needs = new NeedsSystem();
  private clock = new DayNightCycle();
  private reputation = new ReputationSystem();
  private currency = new CurrencySystem();
  private jobs = new JobSystem();
  private quests!: QuestSystem;
  private goldText!: Phaser.GameObjects.Text;
  private jobPromptText!: Phaser.GameObjects.Text;
  private activeShopBuilding?: Building;
  private wasCritical: Record<NeedKey, boolean> = { hunger: false, energy: false, social: false };
  private reputationText!: Phaser.GameObjects.Text;
  private questTrackerText!: Phaser.GameObjects.Text;
  private questLogContainer?: Phaser.GameObjects.Container;
  private toastText!: Phaser.GameObjects.Text;
  private toastTimer = 0;
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
  private saveTimer = 0;
  private footstepTimer = 0;
  private lastPhase: Phase | null = null;
  private readonly persistOnUnload = () => this.persist();

  constructor() {
    super('Town');
  }

  create(): void {
    this.isTouchDevice = this.sys.game.device.input.touch;
    // create() only ever runs as a direct result of a click on the character
    // select screen, so this still counts as "inside a user gesture" for
    // browsers that block audio until one occurs.
    soundSystem.unlock();
    if (!gameState.selectedCharacter) {
      gameState.selectedCharacter = CHARACTER_CLASSES[0];
    }
    const cls = gameState.selectedCharacter;
    this.alignment = cls.alignment;

    const resume = gameState.resumeSave;
    gameState.resumeSave = null; // consume — only applies to this one entry
    let questProgress;
    if (resume && resume.characterId === cls.id) {
      Object.assign(this.needs.values, resume.needs);
      this.clock.restore(resume.hours, resume.day);
      // Older saves predate reputation/gold — default rather than resuming `undefined`.
      this.reputation.value = resume.reputation ?? this.reputation.value;
      this.currency.value = resume.gold ?? this.currency.value;
      this.jobs.lastWorkedDay = resume.lastWorkedDay ?? null;
      questProgress = resume.quests;
    }
    this.quests = new QuestSystem(this.alignment, questProgress);

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
    this.qKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    this.jKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.J);
    this.mKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M);
    this.shopKeys = [
      this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ONE),
      this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.TWO),
      this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.THREE),
    ];
    // Dev-only: a full in-game day takes 4 real minutes, which makes manually
    // testing time-gated content (villain night scavenging, hero day training)
    // tedious. Stripped from production builds by the import.meta.env.DEV guard.
    if (import.meta.env.DEV) {
      this.timeSkipKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.T);
    }

    if (this.isTouchDevice) {
      // Default pointer capacity is 1 touch beyond the primary — a held
      // D-pad button plus a simultaneous tap on Interact/Quest needs more.
      this.input.addPointer(2);
      this.setupTouchControls();
    }

    this.overlay = this.addUI(
      this.add
        .rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width * 2, this.scale.height * 2, 0x000000, 0)
        .setDepth(90),
    );

    this.buildHud(cls.name, cls.alignment);

    // Persist immediately so a fresh game is resumable right away rather than
    // only after the first autosave tick, and so a resumed game's timestamp
    // refreshes even if the player quits before the first tick.
    this.persist();
    window.addEventListener('beforeunload', this.persistOnUnload);
    this.events.once('shutdown', () => window.removeEventListener('beforeunload', this.persistOnUnload));
  }

  private persist(): void {
    saveGame({
      characterId: gameState.selectedCharacter!.id,
      needs: { ...this.needs.values },
      hours: this.clock.getHours(),
      day: this.clock.getDay(),
      reputation: this.reputation.value,
      quests: this.quests.serialize(),
      gold: this.currency.value,
      lastWorkedDay: this.jobs.lastWorkedDay,
      savedAt: Date.now(),
    });
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
        id: 'tavern',
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
        id: 'market',
        name: 'Market Row',
        x: 200,
        y: 40,
        w: 96,
        h: 72,
        flavor: {
          hero: 'Stalls of dried mushrooms, cured meats, and a locked case of unlabeled vials — the vendor swears one\'s a Potion of Strength. You grab a quick bite.',
          villain:
            'The vendor "loses count" of your change more than once, too busy eyeing a ring in the case marked Ring of Haggler — wasted on her, honestly. You don\'t correct her. You grab a quick bite.',
        },
        restores: same({ hunger: 35 }),
        shop: true,
      },
      {
        id: 'cottage',
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
        // Heroes get an exclusive bonus during the day: the guild trains them,
        // not just hosts them. Villains get the same cold reception regardless
        // of time — this is a hero-only mechanic, not a bigger number.
        id: 'guild',
        name: "Adventurers' Guild Hall",
        x: 200,
        y: 300,
        w: 100,
        h: 84,
        flavor: ({ alignment, phase }) => {
          if (alignment === 'villain') {
            return 'Conversation dips the moment you walk in. Nobody asks you to sit. You linger near the door anyway.';
          }
          return phase === 'day'
            ? 'Old dungeon maps line the walls, next to a bounty board — a rat nest past the outer wall, something skittish that might be a Bandit. A veteran waves you over to run a few drills before the stories start. Good company, and you leave sharper for it.'
            : 'Old dungeon maps line the walls, next to a bounty board half-buried in old flyers for rats and one stubborn Bandit nobody\'s caught yet. A few familiar faces trade stories about the depths below town. Good company.';
        },
        restores: ({ alignment, phase }) =>
          alignment === 'villain' ? { social: 12 } : { social: 40, ...(phase === 'day' ? { energy: 15 } : {}) },
      },
      {
        // Villains get an exclusive action heroes never see: scavenging the
        // gate after dark. Same building, same door — the mechanic itself is
        // alignment + time gated, not just flavor text.
        id: 'gate',
        name: 'Sealed Dungeon Gate',
        x: 460,
        y: 170,
        w: 90,
        h: 90,
        flavor: ({ alignment, phase }) => {
          if (alignment === 'villain' && phase === 'night') {
            return 'You press a palm to the humming metal. For a moment it feels like it *wants* you inside. Past the gap the air already smells like the Sewers everyone whispers about. You slip a hand through just wide enough to grab what\'s in reach.';
          }
          if (alignment === 'villain') {
            return 'A heavy iron gate, chained shut, humming faintly. Delvers who\'ve come back talk about rats, gnolls, something they just call "the Goo" — and one who swears an Eye blinked back at her from the dark. Too many eyes around right now — better after dark.';
          }
          return 'A heavy iron gate, chained shut, humming faintly. A sign reads: "Closed for renovation — VR wing coming soon." Somewhere below, the Sewers wait for whoever\'s next.';
        },
        restores: ({ alignment, phase }) =>
          alignment === 'villain' && phase === 'night' ? { hunger: 15, energy: 15 } : {},
      },
      {
        id: 'forge',
        name: 'The Rusty Anvil',
        x: 420,
        y: 300,
        w: 70,
        h: 78,
        flavor: same(
          'Old Finn hammers out a dent that wasn\'t there yesterday — looks like a dagger, maybe a short sword by the curve of it. "Sit, catch your breath a minute." The forge\'s warmth seeps into tired legs.',
        ),
        restores: same({ energy: 20, hunger: 10 }),
      },
      {
        id: 'study',
        name: "The Scrivener's Study",
        x: 550,
        y: 40,
        w: 76,
        h: 72,
        flavor: {
          hero: 'Mira barely looks up from a half-repaired scroll. "Careful with the ink — it still bites." The quiet here is its own kind of rest.',
          villain: 'Mira slides a ledger under a stack of books the second you walk in. "Just... browsing?" The quiet here is its own kind of rest.',
        },
        restores: same({ social: 15, energy: 15 }),
      },
      {
        id: 'well',
        name: 'The Old Well',
        x: 550,
        y: 300,
        w: 70,
        h: 70,
        flavor: {
          hero: "The well water is cold and clean. Somebody's left a tin cup on the rim for anyone who needs it.",
          villain: "The well water is cold and clean — and the loose stone at its base hides more than water, if you know where to look. Silas isn't the only one who's heard rumors of an old dwarf token down there.",
        },
        restores: same({ hunger: 10, energy: 10 }),
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

    this.reputationText = this.addUI(
      this.add
        .text(10, 96, '', {
          fontFamily: 'monospace',
          fontSize: '11px',
          color: '#c9b896',
          backgroundColor: '#00000066',
          padding: { x: 4, y: 2 },
        })
        .setDepth(100),
    );

    this.goldText = this.addUI(
      this.add
        .text(10, 118, '', {
          fontFamily: 'monospace',
          fontSize: '11px',
          color: '#ffd166',
          backgroundColor: '#00000066',
          padding: { x: 4, y: 2 },
        })
        .setDepth(100),
    );

    this.questTrackerText = this.addUI(
      this.add
        .text(10, 142, '', {
          fontFamily: 'monospace',
          fontSize: '11px',
          color: '#ffe9a8',
          backgroundColor: '#00000066',
          padding: { x: 4, y: 2 },
          wordWrap: { width: 220 },
        })
        .setDepth(100),
    );

    this.toastText = this.addUI(
      this.add
        .text(this.scale.width / 2, 60, '', {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: '#3ddc84',
          backgroundColor: '#00000088',
          padding: { x: 8, y: 4 },
          wordWrap: { width: Math.min(this.scale.width - 60, 500) },
          align: 'center',
        })
        .setOrigin(0.5)
        .setDepth(150)
        .setAlpha(0),
    );

    this.addUI(
      this.add
        .text(10, this.scale.height - 20, 'Q: Quest Log · M: Mute', {
          fontFamily: 'monospace',
          fontSize: '10px',
          color: '#9aa4c0',
          backgroundColor: '#00000066',
          padding: { x: 4, y: 2 },
        })
        .setDepth(100),
    );

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

    if (import.meta.env.DEV) {
      this.addUI(
        this.add
          .text(this.scale.width - 10, 34, 'dev: T = +3h', {
            fontFamily: 'monospace',
            fontSize: '10px',
            color: '#9aa4c0',
            backgroundColor: '#00000066',
            padding: { x: 4, y: 2 },
          })
          .setOrigin(1, 0)
          .setDepth(100),
      );
    }

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

    this.jobPromptText = this.addUI(
      this.add
        .text(this.scale.width / 2, this.scale.height - 54, '', {
          fontFamily: 'monospace',
          fontSize: '13px',
          color: '#0b1a10',
          backgroundColor: '#ffd166',
          padding: { x: 8, y: 4 },
        })
        .setOrigin(0.5)
        .setDepth(100)
        .setVisible(false),
    );

    if (this.isTouchDevice) {
      this.jobPromptText.setInteractive();
      this.jobPromptText.on('pointerdown', () => {
        if (this.jobPromptText.visible) this.tryWork();
      });
    }
  }

  /** Touch-only on-screen D-pad + Interact/Quest buttons, for devices with no keyboard. */
  private setupTouchControls(): void {
    const w = this.scale.width;
    const h = this.scale.height;

    const dpadX = 90;
    const dpadY = h - 110;
    const dpadR = 28;
    const dpadOffset = 46;

    const makeDpadButton = (dx: number, dy: number, label: string, key: keyof typeof this.touchDpad) => {
      const btn = this.addUI(
        this.add.circle(dpadX + dx, dpadY + dy, dpadR, 0xffffff, 0.15).setStrokeStyle(2, 0xffffff, 0.4).setDepth(120),
      );
      btn.setInteractive();
      btn.on('pointerdown', () => {
        this.touchDpad[key] = true;
      });
      btn.on('pointerup', () => {
        this.touchDpad[key] = false;
      });
      btn.on('pointerupoutside', () => {
        this.touchDpad[key] = false;
      });
      btn.on('pointerout', () => {
        this.touchDpad[key] = false;
      });
      this.addUI(
        this.add
          .text(dpadX + dx, dpadY + dy, label, { fontFamily: 'monospace', fontSize: '16px', color: '#ffffff' })
          .setOrigin(0.5)
          .setDepth(121),
      );
    };
    makeDpadButton(0, -dpadOffset, '▲', 'up');
    makeDpadButton(0, dpadOffset, '▼', 'down');
    makeDpadButton(-dpadOffset, 0, '◀', 'left');
    makeDpadButton(dpadOffset, 0, '▶', 'right');

    const interactBtn = this.addUI(
      this.add.circle(w - 70, h - 80, 36, 0xffe9a8, 0.28).setStrokeStyle(2, 0xffe9a8, 0.6).setDepth(120),
    );
    interactBtn.setInteractive();
    interactBtn.on('pointerdown', () => this.handleInteractPress());
    this.addUI(
      this.add
        .text(w - 70, h - 80, 'E', { fontFamily: 'monospace', fontSize: '20px', color: '#ffe9a8', fontStyle: 'bold' })
        .setOrigin(0.5)
        .setDepth(121),
    );

    const questBtn = this.addUI(
      this.add.circle(w - 150, h - 60, 24, 0xffffff, 0.15).setStrokeStyle(2, 0xffffff, 0.4).setDepth(120),
    );
    questBtn.setInteractive();
    questBtn.on('pointerdown', () => this.toggleQuestLog());
    this.addUI(
      this.add
        .text(w - 150, h - 60, 'Q', { fontFamily: 'monospace', fontSize: '16px', color: '#ffffff' })
        .setOrigin(0.5)
        .setDepth(121),
    );
  }

  update(_time: number, deltaMs: number): void {
    const dt = deltaMs / 1000;
    this.needs.update(dt);
    this.clock.update(dt);
    // Guarded on import.meta.env.DEV (not just the key being unset) so the
    // whole branch and skipTime() are constant-folded out of prod builds.
    if (import.meta.env.DEV && this.timeSkipKey && Phaser.Input.Keyboard.JustDown(this.timeSkipKey)) {
      this.skipTime(3);
    }
    this.updateReputationFromNeeds();

    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastText.setAlpha(0);
    }

    this.saveTimer += dt;
    if (this.saveTimer >= AUTOSAVE_INTERVAL_SECONDS) {
      this.saveTimer = 0;
      this.persist();
    }

    this.handleMovement();
    this.updateNpcs(dt);
    this.updateNearInteractables();
    this.updateJobPrompt();
    this.updateHud();
    this.updateFootsteps(dt);

    const phase = this.clock.getPhase();
    if (this.lastPhase !== null && phase !== this.lastPhase) soundSystem.phaseChime(phase);
    this.lastPhase = phase;

    if (Phaser.Input.Keyboard.JustDown(this.eKey)) this.handleInteractPress();

    if (this.activeShopBuilding) {
      this.shopKeys.forEach((key, i) => {
        if (Phaser.Input.Keyboard.JustDown(key)) this.tryPurchase(i);
      });
    }

    if (Phaser.Input.Keyboard.JustDown(this.qKey)) this.toggleQuestLog();

    const jPressed = Phaser.Input.Keyboard.JustDown(this.jKey);
    if (jPressed && !this.dialogContainer && !this.questLogContainer) {
      this.tryWork();
    }

    if (Phaser.Input.Keyboard.JustDown(this.mKey)) {
      const muted = soundSystem.toggleMuted();
      this.showToast(muted ? 'Sound muted (M to unmute)' : 'Sound on');
    }
  }

  private updateFootsteps(dt: number): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const moving = !this.dialogContainer && !this.questLogContainer && (body.velocity.x !== 0 || body.velocity.y !== 0);
    if (!moving) {
      this.footstepTimer = 0;
      return;
    }
    this.footstepTimer -= dt;
    if (this.footstepTimer <= 0) {
      this.footstepTimer = 0.28;
      soundSystem.footstep();
    }
  }

  /** Shared by the E key and the touch Interact button. */
  private handleInteractPress(): void {
    if (this.questLogContainer) return;
    if (this.dialogContainer) {
      soundSystem.menuMove();
      this.dialogContainer.destroy();
      this.dialogContainer = undefined;
      this.activeShopBuilding = undefined;
    } else if (this.nearNpc) {
      this.talkToNpc(this.nearNpc);
    } else if (this.nearBuilding) {
      this.enterBuilding(this.nearBuilding);
    }
  }

  /** Shared by the Q key and the touch Quest button. */
  private toggleQuestLog(): void {
    if (this.dialogContainer) return;
    soundSystem.menuMove();
    if (this.questLogContainer) {
      this.questLogContainer.destroy();
      this.questLogContainer = undefined;
    } else {
      this.showQuestLog();
    }
  }

  /** Dev-only time jump. Rolls the day counter over so skipping past midnight behaves like real elapsed time. */
  private skipTime(hours: number): void {
    const raw = this.clock.getHours() + hours;
    this.clock.restore(raw % 24, this.clock.getDay() + Math.floor(raw / 24));
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
    if (this.dialogContainer || this.questLogContainer) {
      this.player.setVelocity(0, 0);
      return;
    }
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    let vx = 0;
    let vy = 0;
    if (this.cursors.left?.isDown || this.wasd.A.isDown || this.touchDpad.left) vx -= 1;
    if (this.cursors.right?.isDown || this.wasd.D.isDown || this.touchDpad.right) vx += 1;
    if (this.cursors.up?.isDown || this.wasd.W.isDown || this.touchDpad.up) vy -= 1;
    if (this.cursors.down?.isDown || this.wasd.S.isDown || this.touchDpad.down) vy += 1;

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

  private updateJobPrompt(): void {
    if (this.dialogContainer || this.questLogContainer) {
      this.jobPromptText.setVisible(false);
      return;
    }
    const job = JOBS[this.alignment];
    const atJobBuilding = this.nearBuilding?.id === job.buildingId;
    const phaseOk = !job.requiresPhase || this.clock.getPhase() === job.requiresPhase;
    if (!atJobBuilding || !phaseOk) {
      this.jobPromptText.setVisible(false);
      return;
    }
    if (this.jobs.canWork(this.clock.getDay())) {
      this.jobPromptText.setText(`Press J: ${job.actionLabel} (+${job.gold}g)`).setVisible(true);
    } else {
      this.jobPromptText.setText('Already worked today').setVisible(true);
    }
  }

  private tryWork(): void {
    const job = JOBS[this.alignment];
    if (this.nearBuilding?.id !== job.buildingId) return;
    if (job.requiresPhase && this.clock.getPhase() !== job.requiresPhase) return;
    if (!this.jobs.canWork(this.clock.getDay())) {
      this.showToast('Already worked today.');
      soundSystem.error();
      return;
    }
    this.jobs.work(this.clock.getDay());
    this.currency.earn(job.gold);
    this.showToast(`${job.successText} +${job.gold} gold`);
    soundSystem.jobComplete();
  }

  private get interactionContext(): InteractionContext {
    return { alignment: this.alignment, phase: this.clock.getPhase() };
  }

  private applyRestores(restores: Partial<Record<NeedKey, number>>): void {
    const multiplier = this.reputation.getMultiplier();
    for (const [key, amount] of Object.entries(restores) as [NeedKey, number][]) {
      this.needs.restore(key, amount * multiplier);
    }
  }

  private enterBuilding(b: Building): void {
    soundSystem.interact();
    const ctx = this.interactionContext;
    this.applyRestores(resolve(b.restores, ctx));
    this.reputation.adjust(1);
    this.promptText.setVisible(false);
    if (b.shop) {
      this.activeShopBuilding = b;
      this.showShopDialog(b, resolve(b.flavor, ctx));
    } else {
      this.showDialog(b.name, resolve(b.flavor, ctx));
    }
    this.handleQuestResult(this.quests.notify('visit', b.id, ctx.phase));
  }

  private talkToNpc(npc: NpcRuntime): void {
    soundSystem.interact();
    this.applyRestores({ social: npc.spec.socialRestore[this.alignment] });
    this.reputation.adjust(1);
    this.promptText.setVisible(false);
    this.showDialog(npc.spec.name, npc.spec.flavor[this.alignment]);
    this.handleQuestResult(this.quests.notify('talk', npc.spec.id, this.clock.getPhase()));
  }

  private handleQuestResult(result: ReturnType<QuestSystem['notify']>): void {
    if (result.questCompleted) {
      const quest = result.questCompleted;
      this.reputation.adjust(quest.reward.reputation);
      if (quest.reward.needs) this.applyRestores(quest.reward.needs);
      if (quest.reward.gold) this.currency.earn(quest.reward.gold);
      const goldPart = quest.reward.gold ? `, +${quest.reward.gold} gold` : '';
      this.showToast(`Quest complete: ${quest.name}! +${quest.reward.reputation} reputation${goldPart}`);
      soundSystem.questComplete();
    } else if (result.stepAdvanced) {
      this.showToast('Objective complete!');
      soundSystem.questStep();
    }
  }

  private showToast(text: string): void {
    this.toastText.setText(text).setAlpha(1);
    this.toastTimer = 2.5;
  }

  private showQuestLog(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const boxW = Math.min(w - 80, 440);
    const questsList = this.quests.getAllQuests();
    const lineH = 20;
    const activeStep = this.quests.getActiveStep();
    const boxH = 90 + questsList.length * lineH + (activeStep ? 40 : 20);

    const container = this.addUI(this.add.container(w / 2, h / 2).setDepth(210));
    const bg = this.add.rectangle(0, 0, boxW, boxH, 0x14141c, 0.97).setStrokeStyle(2, 0xffe9a8);
    const title = this.add
      .text(0, -boxH / 2 + 20, 'Quest Log', { fontFamily: 'monospace', fontSize: '16px', color: '#ffe9a8', fontStyle: 'bold' })
      .setOrigin(0.5);

    const rows: Phaser.GameObjects.Text[] = [];
    questsList.forEach((quest: Quest, i) => {
      const completed = this.quests.isCompleted(quest.id);
      const active = this.quests.getActiveQuest()?.id === quest.id;
      const status = completed ? '✓' : active ? '▶' : '·';
      const color = completed ? '#3ddc84' : active ? '#ffe9a8' : '#5a6180';
      const row = this.add
        .text(-boxW / 2 + 20, -boxH / 2 + 48 + i * lineH, `${status} ${quest.name}`, {
          fontFamily: 'monospace',
          fontSize: '11px',
          color,
        })
        .setOrigin(0, 0);
      rows.push(row);
    });

    const objectiveText = this.add
      .text(
        0,
        boxH / 2 - (activeStep ? 40 : 26),
        activeStep ? `Objective: ${activeStep.text}` : 'All quests complete!',
        {
          fontFamily: 'monospace',
          fontSize: '11px',
          color: '#dfe4f2',
          wordWrap: { width: boxW - 40 },
          align: 'center',
        },
      )
      .setOrigin(0.5, 0);

    const hint = this.add
      .text(0, boxH / 2 - 14, 'Press Q to close', { fontFamily: 'monospace', fontSize: '10px', color: '#9aa4c0' })
      .setOrigin(0.5);

    container.add([bg, title, ...rows, objectiveText, hint]);
    this.questLogContainer = container;
  }

  private showShopDialog(b: Building, flavor: string): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const boxH = 130 + SHOP_ITEMS.length * 18;
    const container = this.addUI(this.add.container(w / 2, h / 2).setDepth(200));
    const bg = this.add.rectangle(0, 0, Math.min(w - 60, 480), boxH, 0x14141c, 0.96).setStrokeStyle(2, 0xffd166);
    const titleText = this.add
      .text(0, -boxH / 2 + 20, b.name, { fontFamily: 'monospace', fontSize: '16px', color: '#ffd166', fontStyle: 'bold' })
      .setOrigin(0.5);
    const flavorText = this.add
      .text(0, -boxH / 2 + 44, flavor, {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#dfe4f2',
        wordWrap: { width: Math.min(w - 100, 420) },
        align: 'center',
      })
      .setOrigin(0.5, 0);
    const goldLine = this.add
      .text(0, -boxH / 2 + 44 + flavorText.height + 10, `Gold: ${this.currency.value}`, {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#ffd166',
        fontStyle: 'bold',
      })
      .setOrigin(0.5, 0);
    const itemLines = SHOP_ITEMS.map((item, i) => {
      const line = this.add
        .text(0, goldLine.y + 20 + i * 18, `${i + 1}. ${item.name} — ${item.cost}g`, {
          fontFamily: 'monospace',
          fontSize: '11px',
          color: '#dfe4f2',
        })
        .setOrigin(0.5, 0);
      if (this.isTouchDevice) {
        line.setInteractive();
        line.on('pointerdown', () => this.tryPurchase(i));
      }
      return line;
    });
    const hint = this.add
      .text(0, boxH / 2 - 14, this.isTouchDevice ? 'Tap an item to buy · E to leave' : 'Press 1-3 to buy · E to leave', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#9aa4c0',
      })
      .setOrigin(0.5);
    container.add([bg, titleText, flavorText, goldLine, ...itemLines, hint]);
    this.dialogContainer = container;
  }

  private tryPurchase(index: number): void {
    const item = SHOP_ITEMS[index];
    if (!item || !this.activeShopBuilding) return;
    if (this.currency.spend(item.cost)) {
      this.applyRestores(item.needs);
      this.showToast(`Bought ${item.name}!`);
      soundSystem.purchase();
    } else {
      this.showToast('Not enough gold.');
      soundSystem.error();
    }
    // Redraw so the gold balance shown in the dialog stays current.
    this.dialogContainer?.destroy();
    this.showShopDialog(this.activeShopBuilding, resolve(this.activeShopBuilding.flavor, this.interactionContext));
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

  /** Letting a need run dry costs reputation — checked once per drop, not continuously while critical. */
  private updateReputationFromNeeds(): void {
    (Object.keys(this.wasCritical) as NeedKey[]).forEach((key) => {
      const isCritical = this.needs.isCritical(key);
      if (isCritical && !this.wasCritical[key]) {
        this.reputation.adjust(-2);
      }
      this.wasCritical[key] = isCritical;
    });
  }

  private updateHud(): void {
    (Object.keys(this.needBars) as NeedKey[]).forEach((key) => {
      const pct = this.needs.get(key) / 100;
      const { bar } = this.needBars[key];
      bar.width = 118 * pct;
      bar.fillColor = this.needs.isCritical(key) ? 0xff4d4d : this.needColors[key];
    });

    this.reputationText.setText(
      `Reputation: ${this.reputation.getLabel(this.alignment)} (${Math.round(this.reputation.value)})`,
    );

    this.goldText.setText(`Gold: ${this.currency.value}`);

    const activeQuest = this.quests.getActiveQuest();
    const activeStep = this.quests.getActiveStep();
    this.questTrackerText.setText(
      activeQuest && activeStep ? `Quest: ${activeQuest.name}\n${activeStep.text}` : 'All quests complete!',
    );

    this.clockText.setText(`Day ${this.clock.getDay()} · ${this.clock.getClockString()} · ${this.clock.getPhase()}`);
    const { color, alpha } = this.clock.getOverlay();
    this.overlay.setFillStyle(color, alpha);
  }
}
