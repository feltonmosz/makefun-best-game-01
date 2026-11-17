[![make.fun](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01)
[![rank](https://make.fun/badge/best-game-01/feltonmosz/makefun-best-game-01/rank.svg)](https://make.fun/bounty/best-game-01)
[![reward](https://make.fun/badge/best-game-01/feltonmosz/makefun-best-game-01/reward.svg)](https://make.fun/bounty/best-game-01)

# Emberfall — Last Light of the Grove

An entry for [make.fun best-game-01](https://make.fun/bounty/best-game-01): a complete, original
arena-survival game in plain JavaScript and canvas, no library, no network at runtime.

You are the last ember warden of a dying grove. Shadow creatures pour in from the dark in ten
waves, and your flame bolts fire on their own — your job is to move, to survive, and to choose
well. Slain foes drop light shards; gather them to level up and pick one of three powers each
time. Five kinds of foe, elite versions of each, a boss on wave 10 — the Gloomwarden — and a
victory screen when it falls.

## How it plays

- **Move** with WASD or the arrow keys. Bolts auto-fire at the nearest foe.
- **Survive** 10 waves. Each wave is a little faster and a little thicker than the last.
- **Level up** by gathering shards, then choose one of three upgrade cards (keys 1–3 or click):
  damage, fire rate, split shots, speed, vitality, magnet, nova blasts, orbiting flames,
  regeneration, greed.
- **Foes:** wisps drift in, hounds charge, spitters shoot from range, brutes shrug off hits,
  wraiths blink behind you. Elites (gold-ringed) are tougher and worth more. The Gloomwarden
  summons wisps and fires radial bursts.
- **Hearts** sometimes drop and heal 25 HP. **P** pauses, **M** mutes, **Space** starts and
  restarts. Your best score is kept in the browser.

## Run it

```sh
node serve.ts        # then open http://localhost:8080
```

## Build the entry

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

That stages `game/` and `screenshots/` into `out/` and writes `out/dossier.json`.

## Screenshots

The four screenshots in `screenshots/` are real renders of the game, taken in headless Chromium
from the deterministic scenes in `shots.json` (`?shot=play|title|levelup|victory&seed=11`).

## Layout

- `game/index.html` — the page; `game/src/main.js` boots it.
- `game/src/world.js` — the rules: waves, combat, XP, win and loss.
- `game/src/player.js`, `game/src/enemies.js` — the warden and the foes.
- `game/src/render.js` — everything drawn: grove, HUD, screens.
- `game/src/upgrades.js` — the ten upgrade cards. `game/src/audio.js` — synthesized sound.
- `game/src/particles.js` — sparks, shake, hit-stop. `game/src/input.js`, `game/src/random.js`,
  `game/src/config.js` — input, the seeded RNG, the tuning.
- `game/src/shots.js` — the deterministic screenshot scenes and the autopilot that plays them.
- `main.ts` — the entrypoint. `serve.ts` — the local server. `vendor/makefun-game.ts` — the
  make.fun library, copied unchanged from the competition kit.

## License

MIT — see [LICENSE](LICENSE).
