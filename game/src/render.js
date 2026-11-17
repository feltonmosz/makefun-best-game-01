// Everything the player sees: the grove, the warden, the foes, the HUD and the
// screens. The renderer never changes the world; it paints what is there, plus
// the camera, the shake and the overlays for the current screen.
import { BOSS_WAVE, TOTAL_WAVES, WORLD } from './config.js';
import { createRandom } from './random.js';
import { xpNeeded } from './player.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_LEVELUP = 'levelup';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const FONT = 'ui-sans-serif, system-ui, sans-serif';

// Decor placed once from a fixed seed, so the grove looks the same every run.
function buildDecor() {
  const rng = createRandom(1337);
  const trees = [];
  const rocks = [];
  const speckles = [];
  const stars = [];
  for (let i = 0; i < 110; i += 1) {
    trees.push({ x: rng.range(30, WORLD.width - 30), y: rng.range(30, WORLD.height - 30), s: rng.range(0.7, 1.5), hue: rng.range(-8, 8) });
  }
  for (let i = 0; i < 70; i += 1) {
    rocks.push({ x: rng.range(20, WORLD.width - 20), y: rng.range(20, WORLD.height - 20), r: rng.range(4, 12) });
  }
  for (let i = 0; i < 260; i += 1) {
    speckles.push({ x: rng.range(0, WORLD.width), y: rng.range(0, WORLD.height), r: rng.range(1, 2.6) });
  }
  for (let i = 0; i < 130; i += 1) {
    stars.push({ x: rng.range(0, WORLD.width), y: rng.range(0, WORLD.height), r: rng.range(0.6, 1.8), tw: rng.range(0, Math.PI * 2) });
  }
  return { trees, rocks, speckles, stars };
}

export function createRenderer(canvas, effects) {
  const ctx = canvas.getContext('2d');
  const decor = buildDecor();
  let width = 0;
  let height = 0;
  let dpr = 1;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    width = canvas.clientWidth || window.innerWidth;
    height = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  resize();
  window.addEventListener('resize', resize);

  function cameraFor(player) {
    const shake = effects.shakeOffset();
    const x = Math.min(Math.max(player.x - width / 2, 0), Math.max(0, WORLD.width - width)) + shake.x;
    const y = Math.min(Math.max(player.y - height / 2, 0), Math.max(0, WORLD.height - height)) + shake.y;
    return { x, y };
  }

  function inView(x, y, cam, margin = 60) {
    return x > cam.x - margin && x < cam.x + width + margin && y > cam.y - margin && y < cam.y + height + margin;
  }

  function drawBackground(cam, time) {
    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#0a0d1f');
    grad.addColorStop(0.55, '#10142c');
    grad.addColorStop(1, '#0b1024');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    // Stars drift with the camera at half speed, so the sky feels far away.
    for (const star of decor.stars) {
      const sx = star.x - cam.x * 0.5;
      const sy = star.y - cam.y * 0.5;
      if (sx < -4 || sx > width + 4 || sy < -4 || sy > height + 4) continue;
      ctx.globalAlpha = 0.35 + 0.3 * Math.sin(time * 1.4 + star.tw);
      ctx.fillStyle = '#cdd6ff';
      ctx.beginPath();
      ctx.arc(sx, sy, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Grove floor.
    ctx.fillStyle = '#131a33';
    ctx.fillRect(-cam.x, -cam.y, WORLD.width, WORLD.height);
    for (const sp of decor.speckles) {
      if (!inView(sp.x, sp.y, cam, 10)) continue;
      ctx.fillStyle = 'rgba(120,140,255,0.10)';
      ctx.beginPath();
      ctx.arc(sp.x - cam.x, sp.y - cam.y, sp.r, 0, Math.PI * 2);
      ctx.fill();
    }
    // The grove's edge: a soft glowing boundary the warden never crosses.
    ctx.save();
    ctx.strokeStyle = 'rgba(255,179,71,0.35)';
    ctx.lineWidth = 3;
    ctx.setLineDash([18, 12]);
    ctx.strokeRect(-cam.x + 6, -cam.y + 6, WORLD.width - 12, WORLD.height - 12);
    ctx.restore();
  }

  function drawHeartTree(cam, time) {
    const x = WORLD.width / 2 - cam.x;
    const y = WORLD.height / 2 - cam.y;
    if (x < -160 || x > width + 160 || y < -200 || y > height + 200) return;
    const glow = ctx.createRadialGradient(x, y - 40, 10, x, y - 40, 190);
    glow.addColorStop(0, 'rgba(255,179,71,0.20)');
    glow.addColorStop(1, 'rgba(255,179,71,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 190, y - 230, 380, 380);
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(x - 9, y - 10, 18, 34);
    ctx.fillStyle = '#1d4a2c';
    for (let i = 0; i < 3; i += 1) {
      const w = 86 - i * 22;
      const ty = y - 18 - i * 34;
      ctx.beginPath();
      ctx.moveTo(x - w / 2, ty);
      ctx.lineTo(x, ty - 52);
      ctx.lineTo(x + w / 2, ty);
      ctx.closePath();
      ctx.fill();
    }
    // Its embers rise forever.
    for (let i = 0; i < 7; i += 1) {
      const t = (time * 0.25 + i / 7) % 1;
      ctx.globalAlpha = 0.75 * (1 - t);
      ctx.fillStyle = '#ffb347';
      ctx.beginPath();
      ctx.arc(x + Math.sin(i * 2.3 + time) * 26, y - 30 - t * 130, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawTree(t, cam) {
    const x = t.x - cam.x;
    const y = t.y - cam.y;
    ctx.fillStyle = '#2c2116';
    ctx.fillRect(x - 3 * t.s, y - 4 * t.s, 6 * t.s, 12 * t.s);
    ctx.fillStyle = `hsl(${140 + t.hue}, 38%, 20%)`;
    ctx.beginPath();
    ctx.moveTo(x - 15 * t.s, y);
    ctx.lineTo(x, y - 34 * t.s);
    ctx.lineTo(x + 15 * t.s, y);
    ctx.closePath();
    ctx.fill();
  }

  function drawEnemy(e, cam) {
    const x = e.x - cam.x;
    const y = e.y - cam.y;
    const r = e.radius;
    ctx.save();
    ctx.shadowColor = e.color;
    ctx.shadowBlur = e.elite ? 22 : 12;
    ctx.fillStyle = e.color;
    if (e.kind === 'wisp') {
      ctx.beginPath();
      ctx.arc(x, y, r * 0.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = e.core;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.38, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === 'hound') {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.lineTo(x - r * 0.6, y - r * 0.8);
      ctx.lineTo(x - r, y);
      ctx.lineTo(x - r * 0.6, y + r * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x + r * 0.3, y - r * 0.25, 2.4, 0, Math.PI * 2);
      ctx.arc(x + r * 0.3, y + r * 0.25, 2.4, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === 'spitter') {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#0b1024';
      ctx.beginPath();
      ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = e.core;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === 'brute') {
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        const px = x + Math.cos(a) * r;
        const py = y + Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.5, y - r * 0.2);
      ctx.lineTo(x, y + r * 0.3);
      ctx.lineTo(x + r * 0.5, y - r * 0.1);
      ctx.stroke();
    } else if (e.kind === 'wraith') {
      ctx.beginPath();
      ctx.moveTo(x, y - r * 1.2);
      ctx.lineTo(x + r * 0.9, y + r * 0.7);
      ctx.lineTo(x - r * 0.9, y + r * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#0b1024';
      ctx.beginPath();
      ctx.arc(x - r * 0.3, y - r * 0.1, 2.6, 0, Math.PI * 2);
      ctx.arc(x + r * 0.3, y - r * 0.1, 2.6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // The Gloomwarden: a crowned shade, bigger than everything else.
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffd166';
      for (let i = -1; i <= 1; i += 1) {
        ctx.beginPath();
        ctx.moveTo(x + i * r * 0.5 - 6, y - r * 0.8);
        ctx.lineTo(x + i * r * 0.5, y - r * 1.35);
        ctx.lineTo(x + i * r * 0.5 + 6, y - r * 0.8);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(x - r * 0.3, y - r * 0.1, 4, 0, Math.PI * 2);
      ctx.arc(x + r * 0.3, y - r * 0.1, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (e.flash > 0) {
      ctx.globalAlpha = Math.min(1, e.flash * 8);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (e.elite) {
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x, y, r + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    if (e.hp < e.maxHp && e.kind !== 'warden') {
      const w = r * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x - w / 2, y - r - 9, w, 4);
      ctx.fillStyle = '#7dff9a';
      ctx.fillRect(x - w / 2, y - r - 9, w * Math.max(0, e.hp / e.maxHp), 4);
    }
  }

  function drawPlayer(p, cam, time) {
    const x = p.x - cam.x;
    const y = p.y - cam.y;
    const bob = Math.sin(time * 3) * 2;
    const flicker = 1 + Math.sin(time * 11) * 0.06 + Math.sin(time * 23) * 0.04;
    ctx.save();
    if (p.invuln > 0 && Math.floor(time * 14) % 2 === 0) ctx.globalAlpha = 0.45;
    // Warm light around the warden.
    const glow = ctx.createRadialGradient(x, y + bob, 4, x, y + bob, 70);
    glow.addColorStop(0, 'rgba(255,179,71,0.28)');
    glow.addColorStop(1, 'rgba(255,179,71,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 70, y + bob - 70, 140, 140);
    // Flame body.
    ctx.shadowColor = '#ff7a18';
    ctx.shadowBlur = 18;
    ctx.fillStyle = '#ff7a18';
    ctx.beginPath();
    ctx.moveTo(x, y + bob - 20 * flicker);
    ctx.bezierCurveTo(x + 13, y + bob - 6, x + 11, y + bob + 10, x, y + bob + 13);
    ctx.bezierCurveTo(x - 11, y + bob + 10, x - 13, y + bob - 6, x, y + bob - 20 * flicker);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.moveTo(x, y + bob - 11 * flicker);
    ctx.bezierCurveTo(x + 7, y + bob - 2, x + 6, y + bob + 8, x, y + bob + 10);
    ctx.bezierCurveTo(x - 6, y + bob + 8, x - 7, y + bob - 2, x, y + bob - 11 * flicker);
    ctx.fill();
    // Eyes, looking the way the warden faces.
    ctx.fillStyle = '#1a1206';
    ctx.beginPath();
    ctx.arc(x - 4 + p.facing * 2, y + bob - 1, 2.2, 0, Math.PI * 2);
    ctx.arc(x + 4 + p.facing * 2, y + bob - 1, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Orbiting flames.
    for (let i = 0; i < p.orbiters; i += 1) {
      const a = p.orbitAngle + (i / p.orbiters) * Math.PI * 2;
      const ox = x + Math.cos(a) * 62;
      const oy = y + bob + Math.sin(a) * 62;
      ctx.save();
      ctx.shadowColor = '#ff9f43';
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#ff9f43';
      ctx.beginPath();
      ctx.arc(ox, oy, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffe08a';
      ctx.beginPath();
      ctx.arc(ox, oy, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function bar(x, y, w, h, frac, fill, back = 'rgba(0,0,0,0.55)') {
    ctx.fillStyle = back;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
  }

  function drawHud(state, best) {
    const p = state.player;
    ctx.save();
    ctx.font = `600 13px ${FONT}`;
    // Top-left: health, level, experience.
    ctx.fillStyle = 'rgba(5,8,20,0.62)';
    ctx.fillRect(14, 12, 250, 64);
    ctx.fillStyle = '#fff';
    ctx.fillText(`HP ${Math.ceil(p.hp)} / ${p.maxHp}`, 24, 30);
    bar(24, 36, 150, 9, p.hp / p.maxHp, p.hp / p.maxHp < 0.3 ? '#ff5d5d' : '#7dff9a');
    ctx.fillStyle = '#ffd166';
    ctx.fillText(`Lv ${p.level}`, 186, 30);
    ctx.fillStyle = '#7df9ff';
    ctx.fillText(`XP ${Math.floor(p.xp)} / ${xpNeeded(p)}`, 24, 66);
    bar(24, 56, 230, 5, p.xp / xpNeeded(p), '#7df9ff');
    // Top-centre: wave and time.
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(5,8,20,0.62)';
    ctx.fillRect(width / 2 - 110, 12, 220, 44);
    ctx.fillStyle = '#fff';
    ctx.font = `700 17px ${FONT}`;
    ctx.fillText(state.wave >= BOSS_WAVE ? 'FINAL WAVE' : `WAVE ${state.wave} / ${TOTAL_WAVES}`, width / 2, 33);
    ctx.font = `600 12px ${FONT}`;
    ctx.fillStyle = '#aab4e8';
    const mins = Math.floor(state.time / 60);
    const secs = Math.floor(state.time % 60);
    ctx.fillText(`${mins}:${String(secs).padStart(2, '0')}`, width / 2, 49);
    // Top-right: score, kills, best.
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(5,8,20,0.62)';
    ctx.fillRect(width - 204, 12, 190, 64);
    ctx.fillStyle = '#ffd166';
    ctx.font = `700 17px ${FONT}`;
    ctx.fillText(`${state.score}`, width - 24, 33);
    ctx.font = `600 12px ${FONT}`;
    ctx.fillStyle = '#aab4e8';
    ctx.fillText(`${state.kills} slain   ·   best ${best}`, width - 24, 52);
    ctx.fillStyle = '#7dff9a';
    ctx.fillText(state.boss ? 'The Gloomwarden' : `${state.enemies.length} foes near`, width - 24, 68);
    ctx.textAlign = 'left';
    // Boss bar.
    if (state.boss) {
      const bw = Math.min(520, width - 80);
      const bx = (width - bw) / 2;
      const by = height - 34;
      ctx.fillStyle = 'rgba(5,8,20,0.7)';
      ctx.fillRect(bx - 8, by - 18, bw + 16, 28);
      ctx.fillStyle = '#f9a8d4';
      ctx.font = `700 12px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('THE GLOOMWARDEN', width / 2, by - 6);
      bar(bx, by + 2, bw, 8, state.boss.hp / state.boss.maxHp, '#f472b6');
      ctx.textAlign = 'left';
    }
    // Low-health vignette.
    if (p.hp / p.maxHp < 0.3 && p.hp > 0) {
      const pulse = 0.22 + 0.12 * Math.sin(state.time * 5);
      const vg = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.35, width / 2, height / 2, Math.max(width, height) * 0.75);
      vg.addColorStop(0, 'rgba(255,40,40,0)');
      vg.addColorStop(1, `rgba(255,40,40,${pulse})`);
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, width, height);
    }
    ctx.restore();
  }

  function drawBanner(state) {
    if (state.bannerTime <= 0 || !state.banner) return;
    const a = Math.min(1, state.bannerTime);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.font = `800 34px ${FONT}`;
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.strokeText(state.banner, width / 2, 120);
    ctx.fillStyle = '#ffd166';
    ctx.fillText(state.banner, width / 2, 120);
    ctx.restore();
  }

  function dim(alpha = 0.62) {
    ctx.fillStyle = `rgba(4,6,16,${alpha})`;
    ctx.fillRect(0, 0, width, height);
  }

  function centreText(lines, y0, gap = 34) {
    ctx.textAlign = 'center';
    lines.forEach((line, i) => {
      ctx.font = line.font;
      ctx.fillStyle = line.color;
      ctx.fillText(line.text, width / 2, y0 + i * gap);
    });
    ctx.textAlign = 'left';
  }

  function drawTitle(state, best) {
    dim(0.55);
    centreText(
      [
        { text: 'EMBERFALL', font: `900 72px ${FONT}`, color: '#ffb347' },
        { text: 'Last light of the grove', font: `600 22px ${FONT}`, color: '#e6e9ff' },
        { text: 'Survive 10 waves. Slay the Gloomwarden. Keep the flame alive.', font: `500 16px ${FONT}`, color: '#aab4e8' },
      ],
      height / 2 - 96,
      44,
    );
    centreText(
      [
        { text: 'WASD / arrows to move  ·  bolts fire on their own', font: `600 16px ${FONT}`, color: '#fff' },
        { text: 'Gather shards, level up, choose your power  ·  P pause  ·  M mute', font: `500 14px ${FONT}`, color: '#aab4e8' },
      ],
      height / 2 + 52,
      26,
    );
    const pulse = 0.65 + 0.35 * Math.sin(state.time * 3);
    ctx.save();
    ctx.globalAlpha = pulse;
    centreText([{ text: '—  PRESS SPACE OR CLICK TO BEGIN  —', font: `800 19px ${FONT}`, color: '#ffd166' }], height / 2 + 132, 0);
    ctx.restore();
    if (best > 0) {
      centreText([{ text: `Best score: ${best}`, font: `600 15px ${FONT}`, color: '#7dff9a' }], height / 2 + 168, 0);
    }
  }

  function drawPaused() {
    dim(0.6);
    centreText(
      [
        { text: 'PAUSED', font: `900 54px ${FONT}`, color: '#fff' },
        { text: 'Press P or Space to carry on', font: `500 17px ${FONT}`, color: '#aab4e8' },
      ],
      height / 2 - 30,
      40,
    );
  }

  function statLines(state, best) {
    const mins = Math.floor(state.time / 60);
    const secs = Math.floor(state.time % 60);
    return [
      `Score  ${state.score}`,
      `Best  ${Math.max(best, state.score)}`,
      `Wave reached  ${state.wave} / ${TOTAL_WAVES}`,
      `Foes slain  ${state.kills}`,
      `Level  ${state.player.level}`,
      `Time survived  ${mins}:${String(secs).padStart(2, '0')}`,
    ];
  }

  function drawOver(state, best) {
    dim(0.72);
    centreText(
      [
        { text: 'THE LIGHT FADES', font: `900 54px ${FONT}`, color: '#ff5d5d' },
        { text: 'The grove falls dark — but embers always return.', font: `500 17px ${FONT}`, color: '#aab4e8' },
      ],
      height / 2 - 140,
      40,
    );
    const lines = statLines(state, best).map((text) => ({ text, font: `600 18px ${FONT}`, color: '#fff' }));
    centreText(lines, height / 2 - 34, 30);
    const pulse = 0.65 + 0.35 * Math.sin(state.time * 3);
    ctx.save();
    ctx.globalAlpha = pulse;
    centreText([{ text: '—  PRESS SPACE OR CLICK TO TRY AGAIN  —', font: `800 18px ${FONT}`, color: '#ffd166' }], height / 2 + 168, 0);
    ctx.restore();
  }

  function drawWin(state, best) {
    dim(0.6);
    centreText(
      [
        { text: 'THE GROVE IS SAFE', font: `900 54px ${FONT}`, color: '#ffd166' },
        { text: 'The Gloomwarden is ash. Dawn breaks over the embers.', font: `500 17px ${FONT}`, color: '#aab4e8' },
      ],
      height / 2 - 140,
      40,
    );
    const lines = statLines(state, best).map((text) => ({ text, font: `600 18px ${FONT}`, color: '#fff' }));
    centreText(lines, height / 2 - 34, 30);
    const pulse = 0.65 + 0.35 * Math.sin(state.time * 3);
    ctx.save();
    ctx.globalAlpha = pulse;
    centreText([{ text: '—  PRESS SPACE OR CLICK TO PLAY AGAIN  —', font: `800 18px ${FONT}`, color: '#7dff9a' }], height / 2 + 168, 0);
    ctx.restore();
  }

  // Card rectangles for the level-up screen, in CSS pixels; main.js reads them for clicks.
  let cardRects = [];
  function drawLevelUp(state, offered, mouse) {
    dim(0.66);
    centreText(
      [
        { text: 'LEVEL UP', font: `900 44px ${FONT}`, color: '#ffd166' },
        { text: `The warden reaches level ${state.player.level} — choose a power`, font: `500 17px ${FONT}`, color: '#e6e9ff' },
      ],
      height / 2 - 150,
      36,
    );
    const cardW = 210;
    const cardH = 240;
    const gap = 24;
    const total = offered.length * cardW + (offered.length - 1) * gap;
    const y = height / 2 - cardH / 2 + 10;
    cardRects = [];
    offered.forEach((card, i) => {
      const x = width / 2 - total / 2 + i * (cardW + gap);
      cardRects.push({ x, y, w: cardW, h: cardH });
      const hover = mouse.x >= x && mouse.x <= x + cardW && mouse.y >= y && mouse.y <= y + cardH;
      ctx.save();
      ctx.fillStyle = hover ? 'rgba(255,179,71,0.22)' : 'rgba(10,14,32,0.9)';
      ctx.strokeStyle = hover ? '#ffb347' : 'rgba(255,255,255,0.25)';
      ctx.lineWidth = hover ? 3 : 1.5;
      ctx.beginPath();
      ctx.roundRect(x, y, cardW, cardH, 14);
      ctx.fill();
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffb347';
      ctx.font = '44px ui-sans-serif, system-ui, sans-serif';
      ctx.fillText(card.icon, x + cardW / 2, y + 66);
      ctx.fillStyle = '#fff';
      ctx.font = `800 19px ${FONT}`;
      ctx.fillText(card.name, x + cardW / 2, y + 108);
      ctx.fillStyle = '#aab4e8';
      ctx.font = `500 14px ${FONT}`;
      wrapText(card.desc, x + 16, y + 140, cardW - 32, 20);
      ctx.fillStyle = '#ffd166';
      ctx.font = `700 13px ${FONT}`;
      ctx.fillText(`[${i + 1}]`, x + cardW / 2, y + cardH - 18);
      ctx.restore();
    });
    ctx.textAlign = 'left';
  }

  function wrapText(text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let ly = y;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x + maxWidth / 2, ly);
        line = word;
        ly += lineHeight;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x + maxWidth / 2, ly);
  }

  return {
    get width() {
      return width;
    },
    get height() {
      return height;
    },
    cardRects() {
      return cardRects;
    },
    draw(state, screen, best, ui = {}) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const cam = cameraFor(state.player);
      const time = state.time;
      drawBackground(cam, time);
      for (const tree of decor.trees) {
        if (inView(tree.x, tree.y, cam, 40)) drawTree(tree, cam);
      }
      for (const rock of decor.rocks) {
        if (!inView(rock.x, rock.y, cam, 16)) continue;
        ctx.fillStyle = '#2a3352';
        ctx.beginPath();
        ctx.arc(rock.x - cam.x, rock.y - cam.y, rock.r, 0, Math.PI * 2);
        ctx.fill();
      }
      drawHeartTree(cam, time);
      // Shards.
      for (const gem of state.gems) {
        if (!inView(gem.x, gem.y, cam, 10)) continue;
        const gx = gem.x - cam.x;
        const gy = gem.y - cam.y + Math.sin(time * 4 + gem.x) * 2;
        ctx.save();
        ctx.shadowColor = '#7df9ff';
        ctx.shadowBlur = 8;
        ctx.fillStyle = '#7df9ff';
        ctx.beginPath();
        ctx.moveTo(gx, gy - 6);
        ctx.lineTo(gx + 4.5, gy);
        ctx.lineTo(gx, gy + 6);
        ctx.lineTo(gx - 4.5, gy);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
      // Hearts.
      for (const heart of state.hearts) {
        if (!inView(heart.x, heart.y, cam, 10)) continue;
        const hx = heart.x - cam.x;
        const hy = heart.y - cam.y;
        ctx.save();
        ctx.shadowColor = '#ff6b9d';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#ff6b9d';
        ctx.font = '20px ui-sans-serif, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('♥', hx, hy + 7);
        ctx.restore();
      }
      for (const enemy of state.enemies) {
        if (inView(enemy.x, enemy.y, cam, 50)) drawEnemy(enemy, cam);
      }
      if (!state.over) drawPlayer(state.player, cam, time);
      // Bolts.
      for (const shot of state.shots) {
        if (!inView(shot.x, shot.y, cam, 10)) continue;
        ctx.save();
        ctx.shadowColor = '#ffb347';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#ffd166';
        ctx.beginPath();
        ctx.arc(shot.x - cam.x, shot.y - cam.y, shot.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      // Foe shots.
      for (const shot of state.foeShots) {
        if (!inView(shot.x, shot.y, cam, 10)) continue;
        ctx.save();
        ctx.shadowColor = shot.color;
        ctx.shadowBlur = 10;
        ctx.fillStyle = shot.color;
        ctx.beginPath();
        ctx.arc(shot.x - cam.x, shot.y - cam.y, shot.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.save();
      ctx.translate(-cam.x, -cam.y);
      effects.draw(ctx);
      ctx.restore();

      if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED || screen === SCREEN_LEVELUP) {
        drawHud(state, best);
        drawBanner(state);
      }
      if (screen === SCREEN_TITLE) drawTitle(state, best);
      else if (screen === SCREEN_PAUSED) drawPaused();
      else if (screen === SCREEN_LEVELUP) drawLevelUp(state, ui.offered ?? [], ui.mouse ?? { x: -1, y: -1 });
      else if (screen === SCREEN_OVER) drawOver(state, best);
      else if (screen === SCREEN_WIN) drawWin(state, best);

      // Mute state, bottom-right, always visible.
      ctx.save();
      ctx.font = `600 12px ${FONT}`;
      ctx.fillStyle = 'rgba(170,180,232,0.8)';
      ctx.textAlign = 'right';
      ctx.fillText(ui.muted ? 'M — sound off' : 'M — mute', width - 14, height - 12);
      ctx.restore();
    },
  };
}
