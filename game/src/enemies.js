// Enemy kinds and their behaviour: what each foe is, how it moves, and what it
// does when it reaches the warden. Spawning and waves live in world.js; this file
// only knows one enemy at a time.
import { ELITE, ENEMY_HP_PER_WAVE, ENEMY_KINDS, SPITTER, WARDEN, WRAITH } from './config.js';

let nextId = 1;

export function createEnemy(kind, x, y, wave, rng, elite = false) {
  const def = ENEMY_KINDS[kind];
  const hpScale = 1 + ENEMY_HP_PER_WAVE * (wave - 1);
  const hp = Math.round(def.hp * hpScale * (elite ? ELITE.hpMul : 1));
  return {
    id: nextId,
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    hp,
    maxHp: hp,
    speed: def.speed * (elite ? ELITE.speedMul : 1) * rng.range(0.92, 1.08),
    damage: def.damage,
    radius: def.radius * (elite ? ELITE.radiusMul : 1),
    xp: def.xp * (elite ? ELITE.xpMul : 1),
    score: def.score * (elite ? ELITE.scoreMul : 1),
    color: def.color,
    core: def.core,
    elite,
    flash: 0,
    touchCooldown: 0,
    shotTimer: rng.range(0.5, SPITTER.shotInterval),
    teleportTimer: rng.range(2, WRAITH.teleportInterval),
    summonTimer: WARDEN.summonInterval,
    radialTimer: WARDEN.radialInterval,
    wobble: rng.range(0, Math.PI * 2),
    knockX: 0,
    knockY: 0,
  };
}

/**
 * Steer one enemy for a step. Returns enemy shots it fires this step (spitter
 * bolts, the warden's radial bursts), as plain {x, y, vx, vy, damage, radius}.
 * `spawn` lets the warden ask the world for new wisps.
 */
export function updateEnemy(enemy, dt, player, rng, spawn) {
  const shots = [];
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = dx / dist;
  const ny = dy / dist;
  enemy.flash = Math.max(0, enemy.flash - dt);
  enemy.touchCooldown = Math.max(0, enemy.touchCooldown - dt);
  enemy.wobble += dt * 3;

  let mx = nx;
  let my = ny;
  if (enemy.kind === 'spitter') {
    // Keep its distance: close in past its range, back off when crowded.
    if (dist > SPITTER.range) {
      mx = nx;
      my = ny;
    } else if (dist < SPITTER.range * 0.55) {
      mx = -nx;
      my = -ny;
    } else {
      // Strafe sideways so it never sits still.
      mx = -ny * Math.sin(enemy.wobble);
      my = nx * Math.sin(enemy.wobble);
    }
    enemy.shotTimer -= dt;
    if (enemy.shotTimer <= 0 && dist < SPITTER.range * 1.25) {
      enemy.shotTimer = SPITTER.shotInterval;
      shots.push({
        x: enemy.x,
        y: enemy.y,
        vx: nx * SPITTER.shotSpeed,
        vy: ny * SPITTER.shotSpeed,
        damage: SPITTER.shotDamage,
        radius: SPITTER.shotRadius,
        color: '#a7f3c8',
      });
    }
  } else if (enemy.kind === 'wraith') {
    enemy.teleportTimer -= dt;
    if (enemy.teleportTimer <= 0) {
      enemy.teleportTimer = WRAITH.teleportInterval * rng.range(0.85, 1.15);
      const angle = rng.angle();
      const jump = rng.range(120, WRAITH.teleportRange);
      enemy.x = clamp(enemy.x + Math.cos(angle) * jump, 30, 2370);
      enemy.y = clamp(enemy.y + Math.sin(angle) * jump, 30, 1570);
      enemy.teleported = true;
    }
  } else if (enemy.kind === 'warden') {
    enemy.summonTimer -= dt;
    if (enemy.summonTimer <= 0) {
      enemy.summonTimer = WARDEN.summonInterval;
      spawn('wisp', 3);
    }
    enemy.radialTimer -= dt;
    if (enemy.radialTimer <= 0) {
      enemy.radialTimer = WARDEN.radialInterval;
      for (let i = 0; i < WARDEN.radialCount; i += 1) {
        const a = (i / WARDEN.radialCount) * Math.PI * 2 + enemy.wobble;
        shots.push({
          x: enemy.x,
          y: enemy.y,
          vx: Math.cos(a) * WARDEN.radialSpeed,
          vy: Math.sin(a) * WARDEN.radialSpeed,
          damage: WARDEN.radialDamage,
          radius: 7,
          color: '#f9a8d4',
        });
      }
    }
  } else if (enemy.kind === 'wisp') {
    // Wisps drift in a slow sine, so a pack never moves as one block.
    const side = Math.sin(enemy.wobble) * 0.45;
    mx = nx - ny * side;
    my = ny + nx * side;
    const len = Math.hypot(mx, my) || 1;
    mx /= len;
    my /= len;
  }

  // Knockback decays fast; the enemy's own steering resumes under it.
  const knockDecay = Math.max(0, 1 - 6 * dt);
  enemy.knockX *= knockDecay;
  enemy.knockY *= knockDecay;
  enemy.vx = mx * enemy.speed + enemy.knockX;
  enemy.vy = my * enemy.speed + enemy.knockY;
  enemy.x += enemy.vx * dt;
  enemy.y += enemy.vy * dt;
  return shots;
}

/** Push overlapping enemies apart so packs spread instead of stacking on one pixel. */
export function separate(enemies, dt) {
  for (let i = 0; i < enemies.length; i += 1) {
    const a = enemies[i];
    for (let j = i + 1; j < enemies.length; j += 1) {
      const b = enemies[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy);
      const min = a.radius + b.radius;
      if (dist > 0 && dist < min) {
        const push = ((min - dist) / dist) * 30 * dt;
        const px = dx * push;
        const py = dy * push;
        a.x -= px;
        a.y -= py;
        b.x += px;
        b.y += py;
      }
    }
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
