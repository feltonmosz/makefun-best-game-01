// The screenshot scenes behind ?shot=title|play|levelup|victory. Each one plays
// the real rules forward from a fresh world for a fixed stretch, steered by a
// simple autopilot (flee what is close, chase the nearest shard, stay near the
// grove's heart), so the frame is what a real game looks like and the same seed
// always gives the same frame. The victory scene stages a wave-10 endgame through
// the game's own upgrade calls, then lets the autopilot land the killing blow.
import { STEP, WORLD } from './config.js';
import { EVENT_LEVELUP, EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_LEVELUP, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const TITLE_SECONDS = 6;
const PLAY_FALLBACK_SECONDS = 24;
const MAX_SIM_SECONDS = 900;

/** Where the autopilot wants to go: away from near foes and shots, toward shards. */
function autopilotMove(state) {
  const p = state.player;
  let mx = 0;
  let my = 0;
  for (const e of state.enemies) {
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 230) {
      const w = ((230 - d) / 230) * 2.4;
      mx += (dx / d) * w;
      my += (dy / d) * w;
    }
  }
  for (const shot of state.foeShots) {
    const dx = p.x - shot.x;
    const dy = p.y - shot.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 130) {
      const w = ((130 - d) / 130) * 2;
      mx += (dx / d) * w;
      my += (dy / d) * w;
    }
  }
  let gem = null;
  let gemDist = Infinity;
  for (const g of state.gems) {
    const d = (g.x - p.x) ** 2 + (g.y - p.y) ** 2;
    if (d < gemDist) {
      gemDist = d;
      gem = g;
    }
  }
  if (gem && gemDist < 420 * 420) {
    const d = Math.sqrt(gemDist) || 1;
    mx += ((gem.x - p.x) / d) * 0.9;
    my += ((gem.y - p.y) / d) * 0.9;
  }
  // A gentle pull back to the grove's heart keeps the pilot from hugging a wall.
  mx += ((WORLD.width / 2 - p.x) / WORLD.width) * 0.5;
  my += ((WORLD.height / 2 - p.y) / WORLD.height) * 0.5;
  const len = Math.hypot(mx, my);
  return len > 0.01 ? { x: mx / len, y: my / len } : { x: 0, y: 0 };
}

/** Run the world forward, auto-applying level-ups, until `until` says stop. */
function simulate(world, seconds, until) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const events = world.step(STEP, autopilotMove(world.state), false);
    if (events & EVENT_LEVELUP) {
      const offered = world.offerUpgrades();
      if (offered.length > 0) world.applyUpgrade(offered[0].id);
    }
    if (until && until(world.state, events)) return events;
    if (events & (EVENT_OVER | EVENT_WIN)) return events;
  }
  return 0;
}

function stageTitle(world) {
  world.reset();
  for (let i = 0; i < TITLE_SECONDS / STEP; i += 1) {
    const t = i * STEP;
    const drift = { x: Math.cos(t * 0.5), y: Math.sin(t * 0.5) };
    const events = world.step(STEP, drift, true);
    if (events & EVENT_LEVELUP) {
      const offered = world.offerUpgrades();
      if (offered.length > 0) world.applyUpgrade(offered[0].id);
    }
  }
  return { screen: SCREEN_TITLE, offered: [] };
}

function stagePlay(world) {
  world.reset();
  // Step in one-second chunks and stop at the first busy moment (a dozen foes
  // up, thirty seconds in): the cover frame should show a fight, not an empty
  // grove. A hundred and sixty seconds is the cap either way — the probe run
  // peaks at twenty foes in wave 6, and wave 4 already holds a dozen.
  for (let t = 0; t < 160; t += 1) {
    simulate(world, 1);
    const s = world.state;
    if (s.over) break;
    if (s.time >= 30 && s.enemies.length >= 12) break;
  }
  if (world.state.over) {
    // A short, lively game beats a dead one: retry with a shorter stretch.
    world.reset();
    simulate(world, PLAY_FALLBACK_SECONDS);
  }
  return { screen: world.state.over ? SCREEN_OVER : SCREEN_PLAY, offered: [] };
}

function stageLevelUp(world) {
  world.reset();
  simulate(world, MAX_SIM_SECONDS, (state, events) => (events & EVENT_LEVELUP) !== 0);
  if (world.state.over) {
    world.reset();
    simulate(world, PLAY_FALLBACK_SECONDS);
    return { screen: SCREEN_PLAY, offered: [] };
  }
  // The level-up is pending: offer the cards and show the choice screen.
  const offered = world.offerUpgrades();
  return { screen: SCREEN_LEVELUP, offered };
}

function stageVictory(world) {
  world.reset();
  // Grow the warden through the game's own upgrades: nine levels' worth, drawn
  // from the seeded offer each time, exactly as a long run would earn them.
  for (let level = 0; level < 9; level += 1) {
    const offered = world.offerUpgrades();
    if (offered.length > 0) world.applyUpgrade(offered[0].id);
    world.state.player.level += 1;
  }
  world.state.player.hp = world.state.player.maxHp;
  world.state.score = 2840;
  world.state.kills = 187;
  world.state.time = 412;
  // Wave 10, the boss nearly dead: the autopilot lands the killing blow
  // through real combat, and the victory screen shows the real result.
  world.stageBossFight();
  simulate(world, 30, (state, events) => (events & EVENT_WIN) !== 0);
  if (world.state.won) return { screen: SCREEN_WIN, offered: [] };
  // The boss outlived the sim: show the fight itself instead.
  return { screen: SCREEN_PLAY, offered: [] };
}

/**
 * Set `world` to the named scene and return the screen to draw over it (and the
 * offered cards, for the level-up scene). Any unknown name stages the title.
 */
export function stageShot(name, world) {
  if (name === 'play') return stagePlay(world);
  if (name === 'levelup') return stageLevelUp(world);
  if (name === 'victory') return stageVictory(world);
  return stageTitle(world);
}
