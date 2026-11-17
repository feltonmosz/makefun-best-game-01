// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between six screens: title, play, paused,
// level-up, game over and victory.
//
// ?seed=N fixes the spawn pattern. ?shot=title|play|levelup|victory (with
// &seed=N) stages that scene instead of running the loop, paints it twice and
// sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BOSS, EVENT_HIT, EVENT_LEVELUP, EVENT_OVER, EVENT_WAVE, EVENT_WIN } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createEffects } from './particles.js';
import {
  createRenderer,
  SCREEN_LEVELUP,
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_WIN,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const effects = createEffects();
const audio = createAudio();
const world = createWorld(createRandom(seed), effects, audio);
const renderer = createRenderer(canvas, effects);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  // The title scene's attract score is not a best score: show only a saved one.
  const best = scene.screen === SCREEN_TITLE ? readBest() : Math.max(readBest(), world.state.score);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, best, {
      offered: scene.offered ?? [],
      mouse: { x: -1, y: -1 },
      muted: audio.isMuted(),
    });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let offered = [];
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    audio.click();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    audio.startMusic();
    announce('Playing. Survive 10 waves and slay the Gloomwarden.');
  }

  function finishRun(won) {
    screen = won ? SCREEN_WIN : SCREEN_OVER;
    audio.stopMusic();
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(
      won
        ? `Victory. Score ${world.state.score}. Best ${best}.`
        : `Game over. Score ${world.state.score}. Best ${best}.`,
    );
  }

  function enterLevelUp() {
    offered = world.offerUpgrades();
    screen = SCREEN_LEVELUP;
    announce(`Level ${world.state.player.level}. Choose a power: ${offered.map((u) => u.name).join(', ')}.`);
  }

  function pickUpgrade(index) {
    const card = offered[index];
    if (!card) return;
    audio.click();
    world.applyUpgrade(card.id);
    if (world.state.levelUpsPending > 0) {
      enterLevelUp();
    } else {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      audio.toggleMute();
      announce(audio.isMuted() ? 'Sound off.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_WIN) {
      if (actions & ACTION_CONFIRM) startGame();
      return;
    }
    if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (screen === SCREEN_LEVELUP) {
      const pick = input.takePick();
      if (pick >= 1 && pick <= offered.length) pickUpgrade(pick - 1);
      const click = input.takeClick();
      if (click) {
        const rects = renderer.cardRects();
        for (let i = 0; i < rects.length; i += 1) {
          const r = rects[i];
          if (click.x >= r.x && click.x <= r.x + r.w && click.y >= r.y && click.y <= r.y + r.h) {
            pickUpgrade(i);
            break;
          }
        }
      }
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      // Attract mode: the grove lives behind the title, the warden unkillable.
      const t = world.state.time;
      const drift = { x: Math.cos(t * 0.4), y: Math.sin(t * 0.4) };
      const events = world.step(STEP, drift, true);
      if (events & EVENT_LEVELUP) {
        const cards = world.offerUpgrades();
        if (cards.length > 0) world.applyUpgrade(cards[0].id);
      }
      return;
    }
    const events = world.step(STEP, input.move(), false);
    if (events & EVENT_WIN) finishRun(true);
    else if (events & EVENT_OVER) finishRun(false);
    else if (events & EVENT_LEVELUP) enterLevelUp();
    else if (events & EVENT_BOSS) announce('The Gloomwarden wakes.');
    else if (events & EVENT_WAVE) announce(`Wave ${world.state.wave}.`);
    else if (events & EVENT_HIT && world.state.player.hp > 0) {
      announce(`Hit. ${Math.ceil(world.state.player.hp)} health left.`);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    effects.update(dt);
    // Hit-stop freezes the world for a beat after a big kill; the frame still paints.
    if (effects.hitStopLeft() > 0) {
      accumulator = 0;
    } else if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      accumulator += dt;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, {
      offered,
      mouse: input.mouse(),
      muted: audio.isMuted(),
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Emberfall. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
