// Level-up choices: the pool of upgrades, what each one does, and how the game
// offers three of them. Every upgrade stacks to its cap; the offer never repeats
// a maxed-out one, and the choice is the game's main decision.
export const UPGRADES = [
  {
    id: 'damage',
    name: 'Kindled Bolts',
    icon: '▲',
    desc: '+25% bolt damage',
    max: 5,
    apply(p) {
      p.boltDamage *= 1.25;
    },
  },
  {
    id: 'rapid',
    name: 'Rapid Embers',
    icon: '≋',
    desc: '+18% fire rate',
    max: 5,
    apply(p) {
      p.fireInterval *= 0.82;
    },
  },
  {
    id: 'split',
    name: 'Split Shot',
    icon: '✦',
    desc: '+1 bolt per volley',
    max: 3,
    apply(p) {
      p.projectiles += 1;
    },
  },
  {
    id: 'speed',
    name: 'Swift Boots',
    icon: '➤',
    desc: '+12% move speed',
    max: 4,
    apply(p) {
      p.speed *= 1.12;
    },
  },
  {
    id: 'vitality',
    name: 'Vital Ember',
    icon: '♥',
    desc: '+25 max HP and heal 25',
    max: 5,
    apply(p) {
      p.maxHp += 25;
      p.hp = Math.min(p.maxHp, p.hp + 25);
    },
  },
  {
    id: 'magnet',
    name: 'Ember Magnet',
    icon: '◉',
    desc: '+40% shard pickup range',
    max: 3,
    apply(p) {
      p.magnet *= 1.4;
    },
  },
  {
    id: 'nova',
    name: 'Nova Ring',
    icon: '◎',
    desc: 'Unlock or empower the nova blast',
    max: 4,
    apply(p) {
      p.novaLevel += 1;
    },
  },
  {
    id: 'orbiter',
    name: 'Flame Orbiter',
    icon: '●',
    desc: '+1 orbiting flame orb',
    max: 3,
    apply(p) {
      p.orbiters += 1;
    },
  },
  {
    id: 'regen',
    name: 'Grove Heart',
    icon: '✚',
    desc: 'Regenerate +0.8 HP/s',
    max: 3,
    apply(p) {
      p.regen += 0.8;
    },
  },
  {
    id: 'greed',
    name: 'Shard Charm',
    icon: '◆',
    desc: '+25% XP from shards',
    max: 3,
    apply(p) {
      p.xpGain *= 1.25;
    },
  },
];

/** Three distinct upgrades the player may pick, never one already at its cap. */
export function offerUpgrades(rng, owned) {
  const available = UPGRADES.filter((u) => (owned[u.id] ?? 0) < u.max);
  const pool = available.slice();
  const offered = [];
  while (offered.length < 3 && pool.length > 0) {
    const index = Math.floor(rng.next() * pool.length);
    offered.push(pool.splice(index, 1)[0]);
  }
  // Every upgrade maxed (a long run): fall back to a heal, so the level is never wasted.
  while (offered.length < 3) {
    offered.push({
      id: 'heal',
      name: 'Warm Light',
      icon: '♥',
      desc: 'Heal 40 HP now',
      max: 99,
      apply(p) {
        p.hp = Math.min(p.maxHp, p.hp + 40);
      },
    });
  }
  return offered;
}
