const STORAGE_KEY = 'audi-game:audio';
let ctx = null;
let enabled = true;
let muted = false;

function loadPrefs() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    muted = !!raw.muted;
  } catch {}
}
function savePrefs() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ muted })); } catch {}
}
loadPrefs();

function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { enabled = false; return null; }
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function primeAudio() { audio(); }
export function isMuted() { return muted; }
export function setMuted(v) { muted = !!v; savePrefs(); }
export function toggleMute() { muted = !muted; savePrefs(); return muted; }

function tone({ freq, type = 'sine', duration = 0.08, gain = 0.06, sweep = null, delay = 0 }) {
  if (muted || !enabled) return;
  const c = audio();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (sweep) osc.frequency.exponentialRampToValueAtTime(Math.max(30, sweep), t0 + duration);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

export const sfx = {
  tick() { tone({ freq: 880, type: 'triangle', duration: 0.05, gain: 0.03 }); },
  wrong() { tone({ freq: 200, type: 'square', duration: 0.2, gain: 0.06, sweep: 90 }); },
  perfect() {
    tone({ freq: 880, type: 'triangle', duration: 0.11, gain: 0.07 });
    tone({ freq: 1320, type: 'triangle', duration: 0.14, gain: 0.06, delay: 0.05 });
    tone({ freq: 1760, type: 'triangle', duration: 0.18, gain: 0.05, delay: 0.1 });
  },
  great() {
    tone({ freq: 660, type: 'triangle', duration: 0.1, gain: 0.06 });
    tone({ freq: 990, type: 'triangle', duration: 0.14, gain: 0.05, delay: 0.05 });
  },
  cool() { tone({ freq: 440, type: 'triangle', duration: 0.12, gain: 0.05 }); },
  bad() { tone({ freq: 310, type: 'triangle', duration: 0.16, gain: 0.05, sweep: 220 }); },
  miss() { tone({ freq: 240, type: 'sawtooth', duration: 0.28, gain: 0.06, sweep: 110 }); },
  count() { tone({ freq: 660, type: 'triangle', duration: 0.14, gain: 0.07 }); },
  go() {
    tone({ freq: 880, type: 'triangle', duration: 0.15, gain: 0.09 });
    tone({ freq: 1320, type: 'triangle', duration: 0.2, gain: 0.07, delay: 0.05 });
  },
  unlock() {
    tone({ freq: 523, type: 'triangle', duration: 0.15, gain: 0.06 });
    tone({ freq: 784, type: 'triangle', duration: 0.15, gain: 0.06, delay: 0.1 });
    tone({ freq: 1047, type: 'triangle', duration: 0.25, gain: 0.06, delay: 0.2 });
  }
};
