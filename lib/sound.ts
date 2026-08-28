'use client';

/**
 * Every sound in the app is synthesised here at play time. There are no audio
 * files to download, nothing to cache, and the whole kit costs about 2 KB.
 */

type Kit = {
  ctx: AudioContext | null;
  ac(): AudioContext | null;
  tone(freq: number, dur: number, type?: OscillatorType, vol?: number, slideTo?: number, delay?: number): void;
  noise(dur: number, freq: number, q?: number, vol?: number): void;
};

const kit: Kit = {
  ctx: null,
  ac() {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const C = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!C) return null;
      this.ctx = new C();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  },
  tone(freq, dur, type = 'sine', vol = 0.2, slideTo, delay = 0) {
    const c = this.ac();
    if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(c.destination);
    o.start(t);
    o.stop(t + dur + 0.03);
  },
  noise(dur, freq, q = 1, vol = 0.2) {
    const c = this.ac();
    if (!c) return;
    const n = Math.floor(c.sampleRate * dur);
    const b = c.createBuffer(1, n, c.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = c.createBufferSource();
    s.buffer = b;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.value = vol;
    s.connect(f);
    f.connect(g);
    g.connect(c.destination);
    s.start();
  },
};

let enabled = true;
export function setSound(on: boolean) {
  enabled = on;
  if (typeof localStorage !== 'undefined') localStorage.setItem('rl-sound', on ? '1' : '0');
}
export function soundOn() {
  if (typeof localStorage !== 'undefined') {
    const v = localStorage.getItem('rl-sound');
    if (v !== null) enabled = v === '1';
  }
  return enabled;
}

function guard(fn: () => void) {
  if (!soundOn()) return;
  try { fn(); } catch { /* audio is a nicety, never a failure */ }
}

/** Hollow wooden knock — the primary button. */
export const thunk = () => guard(() => {
  kit.tone(118, 0.16, 'sine', 0.36, 56);
  kit.noise(0.09, 900, 0.8, 0.17);
});

/** Rubber stamp hitting paper. */
export const stamp = () => guard(() => {
  kit.tone(72, 0.26, 'triangle', 0.46, 38);
  kit.noise(0.08, 1700, 1.1, 0.28);
});

/** Wax seal cracking apart. */
export const crack = () => guard(() => {
  kit.tone(60, 0.32, 'triangle', 0.46, 32);
  kit.noise(0.18, 2200, 0.7, 0.28);
});

/** Rising arpeggio — a mark claimed. */
export const chime = () => guard(() => {
  [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) =>
    kit.tone(f, 0.55, 'triangle', 0.17, undefined, i * 0.075));
});

/** Coin counter under the points tally. */
export const coin = () => guard(() => kit.tone(1240, 0.045, 'square', 0.055));

/** Paper tearing — buying a hint. */
export const tear = () => guard(() => {
  kit.noise(0.28, 3200, 0.5, 0.18);
  kit.tone(340, 0.11, 'sawtooth', 0.05, 180);
});

/** Coins leaving the purse. */
export const spend = () => guard(() => kit.tone(440, 0.18, 'triangle', 0.17, 180));

/** Two flat blasts — you are not there yet. */
export const nope = () => guard(() => {
  kit.tone(300, 0.12, 'square', 0.15, 190);
  kit.tone(220, 0.17, 'square', 0.13, 140, 0.1);
});

/** Page turning. */
export const page = () => guard(() => kit.noise(0.3, 2400, 0.5, 0.14));

/** Pin into cork. */
export const pin = () => guard(() => {
  kit.tone(260, 0.05, 'square', 0.07, 150);
  kit.noise(0.05, 2600, 1.4, 0.1);
});

export const tick = () => guard(() => kit.tone(1300, 0.03, 'square', 0.055));

/** Klaxon — everything stops. */
export const klaxon = () => guard(() => {
  kit.tone(190, 0.46, 'sawtooth', 0.16, 120);
  kit.tone(150, 0.4, 'sawtooth', 0.1, 100, 0.16);
});

/** Two-note all-clear — back under way. */
export const resume = () => guard(() => {
  kit.tone(300, 0.3, 'triangle', 0.15, 520);
  kit.tone(620, 0.28, 'triangle', 0.12, 880, 0.13);
});

export const hail = () => guard(() => {
  [392, 523.25, 659.25].forEach((f, i) => kit.tone(f, 0.3, 'triangle', 0.14, undefined, i * 0.1));
});

/** A short shudder in the hand, where the device supports it. */
export function buzz(pattern: number | number[] = 30) {
  try { navigator.vibrate?.(pattern); } catch { /* not supported */ }
}
