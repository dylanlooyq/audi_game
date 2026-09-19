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

// Everything goes through a light compressor so layered sounds can be loud without clipping.
function outNode(c) {
  if (!c._sfxOut) {
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 10;
    comp.ratio.value = 6;
    comp.attack.value = 0.003;
    comp.release.value = 0.15;
    comp.connect(c.destination);
    c._sfxOut = comp;
  }
  return c._sfxOut;
}

function envelope(g, t0, gain, attack, duration) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
}

function tone({ freq, type = 'sine', duration = 0.08, gain = 0.06, sweep = null, delay = 0, attack = 0.004, lowpass = 0 }) {
  if (muted || !enabled) return;
  const c = audio();
  if (!c) return;
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (sweep) osc.frequency.exponentialRampToValueAtTime(Math.max(30, sweep), t0 + duration);
  envelope(g, t0, gain, attack, duration);
  let node = osc;
  if (lowpass) {
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = lowpass;
    node = osc.connect(f);
  }
  node.connect(g).connect(outNode(c));
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

// Filtered white noise: highpass = sparkle/shimmer, bandpass = click, lowpass = thud/rumble.
function noise({ duration = 0.1, gain = 0.1, delay = 0, filter = 'highpass', freq = 6000 }) {
  if (muted || !enabled) return;
  const c = audio();
  if (!c) return;
  if (!c._sfxNoise) {
    const buf = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    c._sfxNoise = buf;
  }
  const t0 = c.currentTime + delay;
  const src = c.createBufferSource();
  src.buffer = c._sfxNoise;
  const f = c.createBiquadFilter();
  f.type = filter;
  f.frequency.value = freq;
  const g = c.createGain();
  envelope(g, t0, gain, 0.003, duration);
  src.connect(f).connect(g).connect(outNode(c));
  src.start(t0);
  src.stop(t0 + duration + 0.02);
}

// A bell-ish note: a sine plus a quieter octave partial.
function bell(freq, { delay = 0, gain = 0.22, duration = 0.35 } = {}) {
  tone({ freq, type: 'sine', duration, gain, delay });
  tone({ freq: freq * 2, type: 'sine', duration: duration * 0.55, gain: gain * 0.35, delay });
}

export const sfx = {
  tick() { tone({ freq: 880, type: 'triangle', duration: 0.05, gain: 0.03 }); },
  wrong() { tone({ freq: 200, type: 'square', duration: 0.2, gain: 0.06, sweep: 90 }); },
  // Judgment sounds: brighter and more rewarding the better the hit; dull and buzzy when you miss.
  perfect() {
    tone({ freq: 150, sweep: 50, duration: 0.16, gain: 0.45 });                 // impact
    noise({ duration: 0.14, gain: 0.2, freq: 6000 });                            // sparkle
    [1046.5, 1318.5, 1568, 2093].forEach((f, i) => bell(f, { delay: i * 0.055, gain: 0.26 })); // rising C major arpeggio
    noise({ duration: 0.3, gain: 0.12, delay: 0.16, freq: 8000 });               // trailing shimmer
  },
  great() {
    tone({ freq: 130, sweep: 60, duration: 0.13, gain: 0.4 });
    noise({ duration: 0.09, gain: 0.15, freq: 6000 });
    bell(784, { gain: 0.33, duration: 0.3 });
    bell(1174.7, { delay: 0.07, gain: 0.33, duration: 0.32 });                   // two-note rising ding
  },
  cool() {
    noise({ duration: 0.04, gain: 0.3, filter: 'bandpass', freq: 3000 });        // soft click
    tone({ freq: 140, sweep: 90, duration: 0.1, gain: 0.3 });                    // light body
    bell(659.3, { gain: 0.7, duration: 0.3 });                                   // single mellow ding
  },
  bad() {
    tone({ freq: 260, type: 'triangle', sweep: 150, duration: 0.3, gain: 0.5, lowpass: 900 }); // deflating "womp"
    tone({ freq: 110, sweep: 60, duration: 0.16, gain: 0.5 });
    noise({ duration: 0.12, gain: 0.2, filter: 'lowpass', freq: 400 });
  },
  miss() {
    tone({ freq: 150, type: 'sawtooth', sweep: 60, duration: 0.42, gain: 0.36, lowpass: 1200 }); // harsh buzzer
    tone({ freq: 157, type: 'sawtooth', sweep: 64, duration: 0.42, gain: 0.28, lowpass: 1200 });
    tone({ freq: 90, sweep: 40, duration: 0.26, gain: 0.55 });
    noise({ duration: 0.15, gain: 0.15, filter: 'lowpass', freq: 800 });
  },
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
