// The warden: movement, health, and the three weapons — ember bolts that seek the
// nearest foe, the nova ring that bursts outward, and the flame orbiters that
// circle and burn what they touch. The world owns the player object; this file
// knows how it moves and fires.
import { BOLT, NOVA, ORBITER, PLAYER, WORLD, xpToNext } from './config.js';

export function createPlayer() {
  return {
    x: WORLD.width / 2,
    y: WORLD.height / 2,
    radius: PLAYER.radius,
    speed: PLAYER.speed,
    hp: PLAYER.maxHp,
    maxHp: PLAYER.maxHp,
    level: 1,
    xp: 0,
    magnet: PLAYER.magnet,
    regen: 0,
    xpGain: 1,
    // Weapon state.
    boltDamage: BOLT.damage,
    fireInterval: BOLT.interval,
    fireTimer: 0,
    projectiles: 1,
    novaLevel: 0,
    novaTimer: 0,
    orbiters: 0,
    orbitAngle: 0,
    invuln: 0,
    facing: 1,
    walkPhase: 0,
    moving: false,
  };
}

export function xpNeeded(player) {
  return xpToNext(player.level);
}

/** Move the player by the input vector, clamped to the grove. */
export function movePlayer(player, move, dt) {
  const len = Math.hypot(move.x, move.y);
  player.moving = len > 0.01;
  if (player.moving) {
    player.x += move.x * player.speed * dt;
    player.y += move.y * player.speed * dt;
    player.walkPhase += dt * 10;
    if (Math.abs(move.x) > 0.1) player.facing = move.x > 0 ? 1 : -1;
  }
  player.x = Math.min(WORLD.width - player.radius, Math.max(player.radius, player.x));
  player.y = Math.min(WORLD.height - player.radius, Math.max(player.radius, player.y));
  player.invuln = Math.max(0, player.invuln - dt);
  if (player.regen > 0 && player.hp > 0) {
    player.hp = Math.min(player.maxHp, player.hp + player.regen * dt);
  }
}

/** Nearest living foe, or null when the field is empty. */
export function nearestEnemy(player, enemies) {
  let best = null;
  let bestDist = Infinity;
  for (const enemy of enemies) {
    const d = (enemy.x - player.x) ** 2 + (enemy.y - player.y) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = enemy;
    }
  }
  return best;
}

/**
 * Fire the weapons for a step. Bolts and nova bursts are appended to `shots`
 * (the world's projectile list); the nova's ring effect is reported back so the
 * caller can show it. Returns true when the nova fired.
 */
export function fireWeapons(player, enemies, shots, dt, effects) {
  let novaFired = false;
  player.fireTimer -= dt;
  const target = nearestEnemy(player, enemies);
  if (target && player.fireTimer <= 0) {
    player.fireTimer = player.fireInterval;
    const base = Math.atan2(target.y - player.y, target.x - player.x);
    const count = player.projectiles;
    for (let i = 0; i < count; i += 1) {
      const spread = (i - (count - 1) / 2) * 0.16;
      const a = base + spread;
      shots.push({
        x: player.x,
        y: player.y,
        vx: Math.cos(a) * BOLT.speed,
        vy: Math.sin(a) * BOLT.speed,
        damage: player.boltDamage,
        radius: BOLT.radius,
        life: BOLT.lifetime,
        pierce: 0,
      });
    }
    effects.embers(player.x, player.y, 1);
  }

  if (player.novaLevel > 0) {
    player.novaTimer -= dt;
    if (player.novaTimer <= 0 && enemies.length > 0) {
      const cooldown = Math.max(2.2, NOVA.cooldown - (player.novaLevel - 1) * 0.8);
      const radius = NOVA.radius + (player.novaLevel - 1) * 18;
      const damage = NOVA.damage + (player.novaLevel - 1) * 10;
      player.novaTimer = cooldown;
      novaFired = true;
      for (const enemy of enemies) {
        const d = Math.hypot(enemy.x - player.x, enemy.y - player.y);
        if (d < radius + enemy.radius) {
          enemy.hp -= damage;
          enemy.flash = 0.12;
          const push = NOVA.knockback / Math.max(30, d);
          enemy.knockX += ((enemy.x - player.x) / Math.max(1, d)) * push * 30;
          enemy.knockY += ((enemy.y - player.y) / Math.max(1, d)) * push * 30;
          effects.text(enemy.x, enemy.y - enemy.radius, Math.round(damage), '#ffd166', 13);
        }
      }
      effects.ring(player.x, player.y, '#ffb347', radius);
      effects.shake(0.18);
    }
  }

  // Orbiters circle the warden and burn foes they touch.
  if (player.orbiters > 0) {
    player.orbitAngle += ORBITER.angularSpeed * dt;
    for (let i = 0; i < player.orbiters; i += 1) {
      const a = player.orbitAngle + (i / player.orbiters) * Math.PI * 2;
      const ox = player.x + Math.cos(a) * ORBITER.radius;
      const oy = player.y + Math.sin(a) * ORBITER.radius;
      for (const enemy of enemies) {
        if (enemy.orbHit && enemy.orbHit > 0) continue;
        const d = Math.hypot(enemy.x - ox, enemy.y - oy);
        if (d < ORBITER.orbRadius + enemy.radius) {
          enemy.hp -= ORBITER.damage;
          enemy.flash = 0.1;
          enemy.orbHit = ORBITER.hitCooldown;
          effects.text(enemy.x, enemy.y - enemy.radius, Math.round(ORBITER.damage), '#ff9f43', 12);
          effects.burst(ox, oy, '#ff9f43', 3, 90);
        }
      }
    }
  }
  return novaFired;
}

/** Hurt the player, honouring the post-hit invulnerability window. Returns true if it landed. */
export function hurtPlayer(player, damage, fromX, fromY) {
  if (player.invuln > 0 || player.hp <= 0) return false;
  player.hp -= damage;
  player.invuln = PLAYER.hurtInvuln;
  const d = Math.hypot(player.x - fromX, player.y - fromY) || 1;
  player.x += ((player.x - fromX) / d) * 14;
  player.y += ((player.y - fromY) / d) * 14;
  return true;
}
