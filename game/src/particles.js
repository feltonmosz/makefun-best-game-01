// Juice: particles, floating damage numbers, shockwave rings and screen shake.
// Everything here is cosmetic — the rules never read it — so a bug here can only
// look wrong, never play wrong.
const MAX_PARTICLES = 420;
const MAX_TEXTS = 48;

export function createEffects() {
  const particles = [];
  const texts = [];
  const rings = [];
  let trauma = 0;
  let hitStop = 0;

  function spawn(x, y, vx, vy, life, size, color, drag = 2.2, gravity = 0) {
    if (particles.length >= MAX_PARTICLES) particles.shift();
    particles.push({ x, y, vx, vy, life, maxLife: life, size, color, drag, gravity });
  }

  return {
    burst(x, y, color, count = 10, speed = 160) {
      for (let i = 0; i < count; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const s = speed * (0.3 + Math.random() * 0.9);
        spawn(x, y, Math.cos(a) * s, Math.sin(a) * s, 0.35 + Math.random() * 0.4, 2 + Math.random() * 3.5, color);
      }
    },
    embers(x, y, count = 3) {
      for (let i = 0; i < count; i += 1) {
        spawn(
          x + (Math.random() - 0.5) * 24,
          y + (Math.random() - 0.5) * 24,
          (Math.random() - 0.5) * 20,
          -30 - Math.random() * 40,
          0.6 + Math.random() * 0.6,
          1.5 + Math.random() * 2,
          Math.random() < 0.5 ? '#ffb347' : '#ff7a18',
          0.6,
          -30,
        );
      }
    },
    ring(x, y, color, maxRadius = 150) {
      rings.push({ x, y, color, radius: 8, maxRadius, life: 0.4, maxLife: 0.4 });
    },
    text(x, y, value, color = '#ffffff', size = 14) {
      if (texts.length >= MAX_TEXTS) texts.shift();
      texts.push({ x, y, value: String(value), color, size, life: 0.8, maxLife: 0.8 });
    },
    shake(amount) {
      trauma = Math.min(1, trauma + amount);
    },
    freeze(seconds) {
      hitStop = Math.max(hitStop, seconds);
    },
    /** Seconds of hit-stop left; the loop skips world steps while this is above 0. */
    hitStopLeft() {
      return hitStop;
    },
    update(dt) {
      hitStop = Math.max(0, hitStop - dt);
      trauma = Math.max(0, trauma - dt * 1.6);
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.life -= dt;
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        const drag = Math.max(0, 1 - p.drag * dt);
        p.vx *= drag;
        p.vy = p.vy * drag + p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      for (let i = texts.length - 1; i >= 0; i -= 1) {
        const t = texts[i];
        t.life -= dt;
        t.y -= 34 * dt;
        if (t.life <= 0) texts.splice(i, 1);
      }
      for (let i = rings.length - 1; i >= 0; i -= 1) {
        const r = rings[i];
        r.life -= dt;
        r.radius += (r.maxRadius - r.radius) * dt * 9;
        if (r.life <= 0) rings.splice(i, 1);
      }
    },
    /** Camera offset for this frame: trauma squared, so small shakes stay subtle. */
    shakeOffset() {
      const s = trauma * trauma * 14;
      return { x: (Math.random() * 2 - 1) * s, y: (Math.random() * 2 - 1) * s };
    },
    draw(ctx) {
      for (const r of rings) {
        const a = r.life / r.maxLife;
        ctx.save();
        ctx.globalAlpha = a * 0.8;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 3 + 3 * a;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      for (const p of particles) {
        const a = Math.max(0, p.life / p.maxLife);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.5 + 0.5 * a), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      for (const t of texts) {
        const a = Math.max(0, t.life / t.maxLife);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.font = `bold ${t.size}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        ctx.strokeText(t.value, t.x, t.y);
        ctx.fillStyle = t.color;
        ctx.fillText(t.value, t.x, t.y);
        ctx.restore();
      }
    },
  };
}
