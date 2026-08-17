# Pixel Palace

A life-sim set in the world *around* the dungeon — same universe as
Pixel Dungeon / Shattered Pixel Dungeon in spirit, but you're not the one
delving. Pick a hero or a villain archetype and live in the town outside
the gate: Sims-style needs, a day/night clock, buildings to visit. This is
step one of a longer-term plan toward a VR version of the same world.

## v0 (current)

- **Character select** — 4 hero archetypes (Warrior, Mage, Rogue,
  Huntress) and 4 villain archetypes (Plague Doctor, Bandit Lord,
  Necromancer, Corrupted Duelist), each with original flavor text.
- **Town** — walk around with WASD/arrow keys, camera follows the
  player, buildings block movement.
- **Needs system** — hunger, energy, and social meters decay over time
  and are restored by visiting the right building (tavern, cottage,
  guild hall, market).
- **Day/night cycle** — an in-game clock (dawn/day/dusk/night) with a
  screen tint that shifts accordingly.
- **Interactions** — walk up to a building and press `E` to enter; each
  has flavor text and restores relevant needs.

All art is placeholder pixel art generated procedurally at runtime (no
external asset files) — swap in real sprites later without touching the
game logic.

## Stack

Vite + TypeScript + [Phaser 3](https://phaser.io/).

## Running it

```bash
npm install
npm run dev      # local dev server
npm run build    # production build to dist/
```

## Roadmap

- Real pixel art (characters, tiles, buildings)
- More buildings / a bigger town, NPCs with schedules
- Villain-specific mechanics (heroes and villains play differently)
- Save/load, day-to-day progression
- Eventually: a VR build of the same world (WebXR or a dedicated engine)
