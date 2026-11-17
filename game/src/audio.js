// Every sound is synthesised with WebAudio: no audio files, nothing to load.
// The context is created on the first player gesture (browsers demand it), and
// every call is guarded, so a headless run or a blocked context is silent, not an error.
import { MUTE_KEY } from './config.js';

function readMuted() {
  try {
    return window.localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function createAudio() {
  let context = null;
  let master = null;
  let musicNodes = null;
  let muted = readMuted();

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume().catch(() => {});
      return context;
    }
    try {
      const Ctor = window.AudioContext ?? window.webkitAudioContext;
      if (!Ctor) return null;
      context = new Ctor();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
    } catch {
      context = null;
    }
    return context;
  }

  /** Short tone: `type` waveform sliding from `from` Hz to `to` Hz over `dur` seconds. */
  function tone({ type = 'sine', from = 440, to = null, dur = 0.12, vol = 0.2, delay = 0 }) {
    const ctx = ensure();
    if (!ctx || !master || muted) return;
    try {
      const t0 = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(from, t0);
      if (to !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch {
      // Sound is garnish: never let it break the game.
    }
  }

  /** Filtered noise burst, for impacts and explosions. */
  function noise({ dur = 0.15, vol = 0.25, freq = 800, delay = 0 }) {
    const ctx = ensure();
    if (!ctx || !master || muted) return;
    try {
      const t0 = ctx.currentTime + delay;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start(t0);
    } catch {
      // Silent is fine.
    }
  }

  return {
    unlock() {
      ensure();
    },
    isMuted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      try {
        window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
      } catch {
        // Private windows: the toggle lasts this visit only.
      }
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    shoot() {
      tone({ type: 'square', from: 880, to: 520, dur: 0.07, vol: 0.05 });
    },
    hit() {
      noise({ dur: 0.08, vol: 0.12, freq: 1400 });
    },
    enemyDie() {
      tone({ type: 'triangle', from: 320, to: 90, dur: 0.16, vol: 0.14 });
      noise({ dur: 0.12, vol: 0.1, freq: 600 });
    },
    eliteDie() {
      tone({ type: 'sawtooth', from: 220, to: 55, dur: 0.35, vol: 0.2 });
      noise({ dur: 0.3, vol: 0.22, freq: 500 });
    },
    pickup() {
      tone({ type: 'sine', from: 1180, to: 1560, dur: 0.09, vol: 0.1 });
    },
    heart() {
      tone({ type: 'sine', from: 660, to: 990, dur: 0.14, vol: 0.16 });
      tone({ type: 'sine', from: 990, to: 1320, dur: 0.16, vol: 0.14, delay: 0.09 });
    },
    levelUp() {
      [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', from: f, dur: 0.22, vol: 0.16, delay: i * 0.09 }));
    },
    waveHorn() {
      tone({ type: 'sawtooth', from: 196, to: 196, dur: 0.5, vol: 0.12 });
      tone({ type: 'sawtooth', from: 294, to: 294, dur: 0.5, vol: 0.1, delay: 0.05 });
    },
    bossRoar() {
      tone({ type: 'sawtooth', from: 110, to: 55, dur: 0.8, vol: 0.25 });
      noise({ dur: 0.7, vol: 0.2, freq: 300 });
    },
    hurt() {
      tone({ type: 'sawtooth', from: 160, to: 70, dur: 0.18, vol: 0.2 });
    },
    nova() {
      tone({ type: 'sine', from: 220, to: 880, dur: 0.25, vol: 0.14 });
      noise({ dur: 0.2, vol: 0.12, freq: 900 });
    },
    click() {
      tone({ type: 'sine', from: 740, dur: 0.06, vol: 0.1 });
    },
    gameOver() {
      [392, 330, 262, 196].forEach((f, i) => tone({ type: 'triangle', from: f, dur: 0.35, vol: 0.16, delay: i * 0.22 }));
    },
    victory() {
      [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone({ type: 'triangle', from: f, dur: 0.3, vol: 0.16, delay: i * 0.13 }));
    },
    /** A low ambient drone under the game: two detuned triangles through a slow LFO. */
    startMusic() {
      const ctx = ensure();
      if (!ctx || !master || musicNodes) return;
      try {
        const gain = ctx.createGain();
        gain.gain.value = 0.045;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 420;
        const oscA = ctx.createOscillator();
        oscA.type = 'triangle';
        oscA.frequency.value = 110;
        const oscB = ctx.createOscillator();
        oscB.type = 'triangle';
        oscB.frequency.value = 110.6;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.07;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 140;
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);
        oscA.connect(filter);
        oscB.connect(filter);
        filter.connect(gain);
        gain.connect(master);
        oscA.start();
        oscB.start();
        lfo.start();
        musicNodes = { gain, oscA, oscB, lfo };
      } catch {
        musicNodes = null;
      }
    },
    stopMusic() {
      if (!musicNodes) return;
      try {
        musicNodes.oscA.stop();
        musicNodes.oscB.stop();
        musicNodes.lfo.stop();
      } catch {
        // Already stopped.
      }
      musicNodes = null;
    },
  };
}
