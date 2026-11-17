// The game state and its rules: the wave director, combat, collisions, gems,
// hearts, levelling and the win/loss conditions. One fixed step at a time;
// the renderer only ever reads this state, never changes it.
import {
  BOSS_WAVE,
  GEM_MAGNET_SPEED,
  HEART_DROP_CHANCE,
  HEART_HEAL,
  MAX_ENEMIES,
  PLAYER,
  SPAWN_MARGIN,
  SPAWN_MIN_DIST,
  TOTAL_WAVES,
  WAVE_BREATHER_SECONDS,
  WAVE_SPAWN_SECONDS,
  WAVES,
  WORLD,
} from './config.js';
import { createEnemy, separate, updateEnemy } from './enemies.js';
import { createPlayer, fireWeapons, hurtPlayer, movePlayer, xpNeeded } from './player.js';
import { offerUpgrades as drawOffer } from './upgrades.js';

export const EVENT_HIT = 1;
export const EVENT_OVER = 2;
export const EVENT_WIN = 4;
export const EVENT_LEVELUP = 8;
export const EVENT_WAVE = 16;
export const EVENT_BOSS = 32;

export function createWorld(rng, effects, audio) {
  const world = {
    state: null,
    reset,
    step,
    offerUpgrades,
    applyUpgrade,
    stageBossFight,
  };
  reset();
  return world;

  function freshState() {
    return {
      player: createPlayer(),
      enemies: [],
      shots: [],
      foeShots: [],
      gems: [],
      hearts: [],
      wave: 1,
      wavePhase: 'spawning',
      waveTime: 0,
      spawnLeft: WAVES[0].count,
      spawnTimer: 0.5,
      time: 0,
      kills: 0,
      score: 0,
      levelUpsPending: 0,
      offered: [],
      owned: {},
      boss: null,
      bossSpawned: false,
      over: false,
      won: false,
      banner: '',
      bannerTime: 0,
      emberTimer: 0,
    };
  }

  function reset() {
    world.state = freshState();
    world.state.banner = 'Wave 1 — the gloom stirs';
    world.state.bannerTime = 2.2;
  }

  function offerUpgrades() {
    const s = world.state;
    s.offered = drawOffer(rng, s.owned);
    return s.offered;
  }

  function applyUpgrade(id) {
    const s = world.state;
    const upgrade = s.offered.find((u) => u.id === id) ?? s.offered[0];
    if (!upgrade) return;
    upgrade.apply(s.player);
    if (upgrade.id !== 'heal') s.owned[upgrade.id] = (s.owned[upgrade.id] ?? 0) + 1;
    s.levelUpsPending = Math.max(0, s.levelUpsPending - 1);
    s.offered = [];
  }

  /**
   * Stage a wave-10 boss fight for the victory screenshot: the warden boss at
   * low health with a couple of wisps still up. The kill itself still happens
   * through the real combat rules.
   */
  function stageBossFight() {
    const s = world.state;
    s.wave = BOSS_WAVE;
    s.wavePhase = 'spawning';
    s.spawnLeft = 2;
    s.waveTime = 0;
    s.banner = '';
    if (!s.bossSpawned) {
      s.bossSpawned = true;
      const pos = spawnPosition();
      s.boss = createEnemy('warden', pos.x, pos.y, BOSS_WAVE, rng, false);
      s.boss.hp = Math.round(s.boss.maxHp * 0.06);
      s.enemies.push(s.boss);
    }
  }

  function spawnPosition() {
    const s = world.state;
    for (let tries = 0; tries < 8; tries += 1) {
      const a = rng.angle();
      const d = rng.range(SPAWN_MIN_DIST, SPAWN_MIN_DIST + SPAWN_MARGIN);
      const x = s.player.x + Math.cos(a) * d;
      const y = s.player.y + Math.sin(a) * d;
      if (x > 20 && x < WORLD.width - 20 && y > 20 && y < WORLD.height - 20) return { x, y };
    }
    return { x: rng.range(40, WORLD.width - 40), y: rng.range(40, WORLD.height - 40) };
  }

  function spawnEnemy(kind, elite) {
    const s = world.state;
    if (s.enemies.length >= MAX_ENEMIES) return null;
    const pos = spawnPosition();
    const enemy = createEnemy(kind, pos.x, pos.y, s.wave, rng, elite);
    s.enemies.push(enemy);
    return enemy;
  }

  function startWave(n) {
    const s = world.state;
    const def = WAVES[n - 1];
    s.wave = n;
    s.wavePhase = 'spawning';
    s.waveTime = 0;
    s.spawnLeft = def.count;
    s.spawnTimer = 0.4;
    if (def.boss && !s.bossSpawned) {
      s.bossSpawned = true;
      const pos = spawnPosition();
      s.boss = createEnemy('warden', pos.x, pos.y, n, rng, false);
      s.enemies.push(s.boss);
      s.banner = 'The Gloomwarden wakes';
      s.bannerTime = 2.6;
      audio.bossRoar();
      return EVENT_BOSS;
    }
    s.banner = n === 1 ? 'Wave 1 — the gloom stirs' : `Wave ${n}`;
    s.bannerTime = 2.2;
    audio.waveHorn();
    return EVENT_WAVE;
  }

  function killEnemy(enemy, index) {
    const s = world.state;
    s.enemies.splice(index, 1);
    s.kills += 1;
    s.score += enemy.score;
    const isBoss = enemy.kind === 'warden';
    if (isBoss) {
      s.boss = null;
      effects.burst(enemy.x, enemy.y, '#f472b6', 60, 320);
      effects.ring(enemy.x, enemy.y, '#f9a8d4', 260);
      effects.shake(0.7);
      effects.freeze(0.25);
      audio.eliteDie();
    } else if (enemy.elite) {
      effects.burst(enemy.x, enemy.y, enemy.color, 26, 240);
      effects.shake(0.3);
      audio.eliteDie();
      s.hearts.push({ x: enemy.x, y: enemy.y, vx: 0, vy: 0 });
    } else {
      effects.burst(enemy.x, enemy.y, enemy.color, 10, 170);
      audio.enemyDie();
      if (rng.chance(HEART_DROP_CHANCE)) s.hearts.push({ x: enemy.x, y: enemy.y, vx: 0, vy: 0 });
    }
    // Experience falls as shards worth 1–3 each, scattered around the kill.
    let xpLeft = enemy.xp;
    while (xpLeft > 0) {
      const value = Math.min(xpLeft, rng.int(1, 3));
      xpLeft -= value;
      const a = rng.angle();
      const d = rng.range(4, 26);
      s.gems.push({ x: enemy.x + Math.cos(a) * d, y: enemy.y + Math.sin(a) * d, value });
    }
    return isBoss;
  }

  function step(dt, move, attract) {
    const s = world.state;
    let events = 0;
    if (s.over || s.won) return events;
    s.time += dt;
    s.bannerTime = Math.max(0, s.bannerTime - dt);
    const player = s.player;

    movePlayer(player, move, dt);
    if (fireWeapons(player, s.enemies, s.shots, dt, effects)) audio.nova();

    // Ambient embers drifting off the warden's flame.
    s.emberTimer -= dt;
    if (s.emberTimer <= 0) {
      s.emberTimer = 0.28;
      effects.embers(player.x, player.y - 6, 1);
    }

    // --- Wave director ---
    const def = WAVES[s.wave - 1];
    if (s.wavePhase === 'spawning') {
      s.waveTime += dt;
      s.spawnTimer -= dt;
      if (s.spawnLeft > 0 && s.spawnTimer <= 0) {
        s.spawnTimer = def.interval * rng.range(0.8, 1.2);
        s.spawnLeft -= 1;
        const kind = rng.pick(def.kinds);
        const elite = (def.elites ?? 0) > 0 && rng.chance(def.elites) && kind !== 'warden';
        spawnEnemy(kind, elite);
      }
      if ((s.spawnLeft <= 0 && s.waveTime > WAVE_SPAWN_SECONDS * 0.4) || s.waveTime >= WAVE_SPAWN_SECONDS) {
        s.wavePhase = 'clearing';
      }
    } else if (s.wavePhase === 'clearing') {
      if (s.enemies.length === 0) {
        if (s.wave >= TOTAL_WAVES) {
          s.won = true;
          return events | EVENT_WIN;
        }
        s.score += 100 * s.wave;
        s.wavePhase = 'breather';
        s.waveTime = 0;
        s.banner = `Wave ${s.wave} cleared  +${100 * s.wave}`;
        s.bannerTime = 2;
      }
    } else if (s.wavePhase === 'breather') {
      s.waveTime += dt;
      if (s.waveTime >= WAVE_BREATHER_SECONDS) events |= startWave(s.wave + 1);
    }

    // --- Enemies ---
    for (let i = s.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = s.enemies[i];
      enemy.orbHit = Math.max(0, (enemy.orbHit ?? 0) - dt);
      const fired = updateEnemy(enemy, dt, player, rng, (kind, count) => {
        for (let n = 0; n < count; n += 1) spawnEnemy(kind, false);
      });
      for (const shot of fired) s.foeShots.push({ ...shot, life: 4 });
      if (enemy.teleported) {
        enemy.teleported = false;
        effects.burst(enemy.x, enemy.y, '#67e8f9', 8, 120);
      }
      // Touch damage.
      enemy.touchCooldown = Math.max(0, enemy.touchCooldown - dt);
      const d = Math.hypot(enemy.x - player.x, enemy.y - player.y);
      if (d < enemy.radius + player.radius && enemy.touchCooldown <= 0) {
        enemy.touchCooldown = 0.8;
        if (!attract && hurtPlayer(player, enemy.damage, enemy.x, enemy.y)) {
          events |= EVENT_HIT;
          audio.hurt();
          effects.shake(0.35);
          effects.burst(player.x, player.y, '#ff5d5d', 8, 150);
        }
      }
    }
    separate(s.enemies, dt);

    // --- Player bolts ---
    for (let i = s.shots.length - 1; i >= 0; i -= 1) {
      const shot = s.shots[i];
      shot.life -= dt;
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      let dead = shot.life <= 0 || shot.x < 0 || shot.x > WORLD.width || shot.y < 0 || shot.y > WORLD.height;
      if (!dead) {
        for (let j = s.enemies.length - 1; j >= 0; j -= 1) {
          const enemy = s.enemies[j];
          const d = Math.hypot(enemy.x - shot.x, enemy.y - shot.y);
          if (d < enemy.radius + shot.radius) {
            enemy.hp -= shot.damage;
            enemy.flash = 0.1;
            enemy.knockX += (shot.vx / 540) * 60;
            enemy.knockY += (shot.vy / 540) * 60;
            effects.text(enemy.x, enemy.y - enemy.radius, Math.round(shot.damage), '#ffe08a', 12);
            effects.burst(shot.x, shot.y, '#ffb347', 3, 90);
            audio.hit();
            dead = true;
            if (enemy.hp <= 0) {
              if (killEnemy(enemy, j) && s.wave >= BOSS_WAVE) {
                s.won = true;
                return events | EVENT_WIN;
              }
            }
            break;
          }
        }
      }
      if (dead) s.shots.splice(i, 1);
    }

    // Nova and orbiters can kill without a bolt: sweep the dead.
    for (let i = s.enemies.length - 1; i >= 0; i -= 1) {
      if (s.enemies[i].hp <= 0) {
        if (killEnemy(s.enemies[i], i) && s.wave >= BOSS_WAVE) {
          s.won = true;
          return events | EVENT_WIN;
        }
      }
    }

    // --- Foe shots ---
    for (let i = s.foeShots.length - 1; i >= 0; i -= 1) {
      const shot = s.foeShots[i];
      shot.life -= dt;
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      let dead = shot.life <= 0 || shot.x < 0 || shot.x > WORLD.width || shot.y < 0 || shot.y > WORLD.height;
      if (!dead) {
        const d = Math.hypot(player.x - shot.x, player.y - shot.y);
        if (d < player.radius + shot.radius) {
          dead = true;
          if (!attract && hurtPlayer(player, shot.damage, shot.x, shot.y)) {
            events |= EVENT_HIT;
            audio.hurt();
            effects.shake(0.3);
          }
        }
      }
      if (dead) s.foeShots.splice(i, 1);
    }

    // --- Shards and hearts drift to the warden ---
    const magnet = player.magnet;
    for (let i = s.gems.length - 1; i >= 0; i -= 1) {
      const gem = s.gems[i];
      const d = Math.hypot(player.x - gem.x, player.y - gem.y);
      if (d < magnet) {
        const pull = GEM_MAGNET_SPEED * (1.6 - d / (magnet * 1.6));
        gem.x += ((player.x - gem.x) / (d || 1)) * pull * dt;
        gem.y += ((player.y - gem.y) / (d || 1)) * pull * dt;
      }
      if (d < PLAYER.pickupRadius) {
        s.gems.splice(i, 1);
        player.xp += gem.value * player.xpGain;
        audio.pickup();
        effects.burst(player.x, player.y, '#7df9ff', 2, 60);
        while (player.xp >= xpNeeded(player)) {
          player.xp -= xpNeeded(player);
          player.level += 1;
          s.levelUpsPending += 1;
          events |= EVENT_LEVELUP;
          audio.levelUp();
          effects.ring(player.x, player.y, '#ffd166', 90);
        }
      }
    }
    for (let i = s.hearts.length - 1; i >= 0; i -= 1) {
      const heart = s.hearts[i];
      const d = Math.hypot(player.x - heart.x, player.y - heart.y);
      if (d < magnet * 0.8) {
        heart.x += ((player.x - heart.x) / (d || 1)) * GEM_MAGNET_SPEED * 0.8 * dt;
        heart.y += ((player.y - heart.y) / (d || 1)) * GEM_MAGNET_SPEED * 0.8 * dt;
      }
      if (d < PLAYER.pickupRadius + 6) {
        s.hearts.splice(i, 1);
        player.hp = Math.min(player.maxHp, player.hp + HEART_HEAL);
        audio.heart();
        effects.text(player.x, player.y - 24, `+${HEART_HEAL}`, '#7dff9a', 15);
      }
    }

    if (!attract && player.hp <= 0) {
      player.hp = 0;
      s.over = true;
      events |= EVENT_OVER;
      audio.gameOver();
      effects.burst(player.x, player.y, '#ffb347', 40, 260);
    }
    if (attract) player.hp = Math.max(1, player.hp);
    return events;
  }
}
