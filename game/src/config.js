// Emberfall — tuning and constants. One place for every number the game plays by,
// so balance changes never touch the rules themselves.
export const STEP = 1 / 60;
export const BEST_KEY = 'emberfall.best';
export const MUTE_KEY = 'emberfall.muted';

// The grove the game plays in: bigger than any screen, the camera follows the warden.
export const WORLD = { width: 2400, height: 1600 };
export const TOTAL_WAVES = 10;
export const WAVE_SPAWN_SECONDS = 34;
export const WAVE_BREATHER_SECONDS = 3;
export const BOSS_WAVE = 10;

export const PLAYER = {
  radius: 14,
  speed: 235,
  maxHp: 100,
  // Invulnerable this long after any hit, so one touch is never two hits.
  hurtInvuln: 0.6,
  magnet: 95,
  pickupRadius: 22,
};

export const BOLT = {
  speed: 540,
  radius: 5,
  damage: 12,
  interval: 0.42,
  lifetime: 1.4,
};

export const NOVA = {
  cooldown: 6,
  radius: 135,
  damage: 26,
  knockback: 260,
};

export const ORBITER = {
  radius: 62,
  orbRadius: 9,
  damage: 11,
  angularSpeed: 3.4,
  // How often one orbiter may hurt the same foe.
  hitCooldown: 0.45,
};

// Experience to go from `level` to `level + 1`.
export function xpToNext(level) {
  return 8 + (level - 1) * 5;
}

// Enemy kinds. hp scales with the wave (see ENEMY_HP_PER_WAVE); the rest is fixed.
export const ENEMY_HP_PER_WAVE = 0.12;
export const ENEMY_KINDS = {
  wisp: { hp: 18, speed: 98, damage: 8, radius: 13, xp: 1, score: 10, color: '#9aa7ff', core: '#e6e9ff' },
  hound: { hp: 14, speed: 168, damage: 6, radius: 11, xp: 2, score: 15, color: '#ff5d5d', core: '#ffd6d6' },
  spitter: { hp: 24, speed: 72, damage: 6, radius: 13, xp: 2, score: 20, color: '#7dff9a', core: '#e2ffe8' },
  brute: { hp: 72, speed: 56, damage: 16, radius: 20, xp: 5, score: 40, color: '#c084fc', core: '#f3e8ff' },
  wraith: { hp: 30, speed: 122, damage: 10, radius: 12, xp: 3, score: 30, color: '#67e8f9', core: '#e0fbff' },
  warden: { hp: 950, speed: 66, damage: 20, radius: 34, xp: 50, score: 1000, color: '#f472b6', core: '#ffe4f1' },
};

// What each wave may spawn (kinds unlock as the game goes on), how fast they come,
// and how many the wave holds in total. The director paces them across the wave.
export const WAVES = [
  { kinds: ['wisp'], count: 14, interval: 1.5 },
  { kinds: ['wisp', 'hound'], count: 20, interval: 1.25 },
  { kinds: ['wisp', 'hound', 'spitter'], count: 26, interval: 1.05 },
  { kinds: ['wisp', 'hound', 'spitter', 'brute'], count: 32, interval: 0.9 },
  { kinds: ['wisp', 'hound', 'spitter', 'brute', 'wraith'], count: 38, interval: 0.8 },
  { kinds: ['wisp', 'hound', 'spitter', 'brute', 'wraith'], count: 46, interval: 0.7, elites: 0.08 },
  { kinds: ['hound', 'spitter', 'brute', 'wraith'], count: 48, interval: 0.62, elites: 0.12 },
  { kinds: ['hound', 'spitter', 'brute', 'wraith'], count: 54, interval: 0.55, elites: 0.16 },
  { kinds: ['spitter', 'brute', 'wraith', 'hound'], count: 60, interval: 0.48, elites: 0.2 },
  { kinds: ['wisp', 'hound'], count: 18, interval: 1.1, elites: 0.1, boss: true },
];

export const SPITTER = { shotInterval: 2.3, shotSpeed: 210, shotDamage: 8, shotRadius: 6, range: 420 };
export const WRAITH = { teleportInterval: 4.2, teleportRange: 260 };
export const WARDEN = { summonInterval: 7, radialInterval: 3.4, radialCount: 10, radialSpeed: 170, radialDamage: 10 };
export const ELITE = { hpMul: 3.2, speedMul: 0.9, radiusMul: 1.35, xpMul: 3, scoreMul: 3 };

// Hearts: an elite always drops one; a foe has a small chance to. A heart heals this much.
export const HEART_HEAL = 25;
export const HEART_DROP_CHANCE = 0.02;

export const GEM_MAGNET_SPEED = 520;
export const MAX_ENEMIES = 140;
export const SPAWN_MARGIN = 420;
export const SPAWN_MIN_DIST = 380;
