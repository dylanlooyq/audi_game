import { LEVELS } from './level-data.js';
import { TIMING, JUDGE_COLORS, BEATS_PER_BAR, MIN_REST_BEATS, REVERSE_MAX, REVERSE_MULT_GROWTH, rankFor } from './config.js';
import { ScoreState } from './scoring.js';
import { ChoreographyController } from './choreography.js';
import { sfx, primeAudio, isMuted, toggleMute } from './sfx.js';
import { playMusic, pauseMusic, resumeMusic, stopMusic, syncMusicMute, musicPositionMs, musicEnded } from './music.js';

const app = document.querySelector('#app');
let activeGame = null;
const directionFromKey = { ArrowLeft: 'left', ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down' };
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };
const button = (text, className = 'primary') => `<button class="${className}">${text}</button>`;
function mount(html) { if (activeGame) activeGame.destroy(); activeGame = null; cleanupMapListener(); app.innerHTML = html; }

const REVERSE_KEY = 'audi-game:reverse';
function loadReverseCount() {
  try {
    const n = parseInt(localStorage.getItem(REVERSE_KEY) || '0', 10);
    if (isNaN(n)) return 0;
    return Math.max(0, Math.min(REVERSE_MAX, n));
  } catch { return 0; }
}
function saveReverseCount(n) {
  try { localStorage.setItem(REVERSE_KEY, String(n)); } catch {}
}
let reverseCount = loadReverseCount();

function generateReverses(len, count) {
  const reverses = new Array(len).fill(false);
  const positions = Array.from({ length: len }, (_, i) => i);
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  const actual = Math.min(count, len);
  for (let i = 0; i < actual; i++) reverses[positions[i]] = true;
  return reverses;
}

const PROGRESS_KEY = 'audi-game:progress';
function loadProgress() {
  try {
    const raw = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
    const unlocked = Array.isArray(raw.unlocked) && raw.unlocked.length ? raw.unlocked : ['level-1'];
    return { unlocked: new Set(unlocked), best: raw.best && typeof raw.best === 'object' ? raw.best : {} };
  } catch { return { unlocked: new Set(['level-1']), best: {} }; }
}
function saveProgress(progress) {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify({ unlocked: [...progress.unlocked], best: progress.best })); } catch {}
}
function unlockNextAfter(levelId) {
  const idx = LEVELS.findIndex(l => l.id === levelId);
  const next = LEVELS[idx + 1];
  if (!next) return null;
  const p = loadProgress();
  if (p.unlocked.has(next.id)) return null;
  p.unlocked.add(next.id);
  saveProgress(p);
  return next;
}
const RANK_ORDER = ['D', 'C', 'B', 'A', 'S'];
function updateBest(levelId, rank, score) {
  const p = loadProgress();
  const prev = p.best[levelId];
  const rankUp = !prev || RANK_ORDER.indexOf(rank) > RANK_ORDER.indexOf(prev.rank);
  const scoreUp = !prev || score > prev.score;
  if (!prev || rankUp || scoreUp) {
    p.best[levelId] = {
      rank: prev && !rankUp ? prev.rank : rank,
      score: prev && !scoreUp ? prev.score : score
    };
    saveProgress(p);
    return { rankUp: rankUp && (!prev || rank !== prev.rank), scoreUp };
  }
  return { rankUp: false, scoreUp: false };
}

function menu() {
  mount(`<section class="screen menu">
    <p class="eyebrow">Audition-style rhythm prototype</p>
    <h1>Dance<br>Game</h1>
    <p class="subhead">Type the arrow sequence, then slam <kbd>SPACE</kbd> on the beat. Perfect timing lands the biggest move.</p>
    ${button('START GAME')}
    <button class="reset-progress" data-act="reset">Reset progress</button>
  </section>`);
  app.querySelector('.primary').onclick = () => { primeAudio(); map(); };
  app.querySelector('.reset-progress').onclick = resetProgress;
}

function resetProgress() {
  if (!confirm('Reset all progress? This clears your unlocks and best scores.')) return;
  try { localStorage.removeItem(PROGRESS_KEY); } catch {}
  menu();
}

let mapResizeHandler = null;
function cleanupMapListener() {
  if (mapResizeHandler) { window.removeEventListener('resize', mapResizeHandler); mapResizeHandler = null; }
}

function map() {
  const progress = loadProgress();
  const positions = ['one', 'two', 'three'];
  const nodes = LEVELS.map((level, i) => {
    const isLocked = !progress.unlocked.has(level.id);
    const sub = isLocked ? 'LOCKED' : level.difficulty;
    const best = progress.best[level.id];
    const bestHtml = !isLocked && best ? `<span class="best">★ ${best.rank} · ${best.score.toLocaleString()}</span>` : '';
    return `<button class="node ${positions[i]}${isLocked ? ' locked' : ''}" data-level="${level.id}"${isLocked ? ' disabled' : ''}>LEVEL ${i + 1}<small>${sub}</small>${bestHtml}</button>`;
  }).join('');
  const unlockedCount = LEVELS.filter(l => progress.unlocked.has(l.id)).length;
  mount(`<section class="screen">
    <header class="map-head">
      <div><p class="eyebrow">Choose your stage</p><h2>Overworld</h2></div>
      ${button('MAIN MENU', 'secondary')}
    </header>
    <div class="map">
      <svg class="map-paths" aria-hidden="true"></svg>
      ${nodes}
      <p class="legend"><span>●</span> ${unlockedCount} / ${LEVELS.length} stages unlocked · beat a stage to unlock the next</p>
    </div>
  </section>`);
  app.querySelector('.map-head button').onclick = menu;
  app.querySelectorAll('.node').forEach(n => {
    if (n.disabled) return;
    n.onclick = () => play(LEVELS.find(l => l.id === n.dataset.level));
  });

  const draw = () => {
    const mapEl = document.querySelector('.map');
    const svg = document.querySelector('.map-paths');
    if (!mapEl || !svg) { cleanupMapListener(); return; }
    const rect = mapEl.getBoundingClientRect();
    if (rect.width === 0) return;
    svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
    svg.setAttribute('width', rect.width);
    svg.setAttribute('height', rect.height);
    const nodeEls = [...mapEl.querySelectorAll('.node')];
    const centers = nodeEls.map(n => {
      const r = n.getBoundingClientRect();
      return {
        x: r.left - rect.left + r.width / 2,
        y: r.top - rect.top + r.height / 2,
        locked: n.classList.contains('locked')
      };
    });
    const lines = [];
    for (let i = 0; i < centers.length - 1; i++) {
      const a = centers[i], b = centers[i + 1];
      const cls = b.locked ? 'path-line locked' : 'path-line';
      lines.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="${cls}"/>`);
    }
    svg.innerHTML = lines.join('');
  };
  requestAnimationFrame(draw);
  cleanupMapListener();
  mapResizeHandler = draw;
  window.addEventListener('resize', mapResizeHandler);
}

// Colours the beat bar by what a Space press would score at each moment: MISS while it is too early, then
// BAD > COOL > GREAT > PERFECT up to the beat, and back down again after it, ending in MISS when the move expires.
function zoneGradient(start, commit, end) {
  const T = TIMING;
  const bands = [
    ['MISS', start, commit - T.bad], ['BAD', commit - T.bad, commit - T.cool], ['COOL', commit - T.cool, commit - T.great],
    ['GREAT', commit - T.great, commit - T.perfect], ['PERFECT', commit - T.perfect, commit + T.perfect],
    ['GREAT', commit + T.perfect, commit + T.great], ['COOL', commit + T.great, commit + T.cool],
    ['BAD', commit + T.cool, commit + T.bad], ['MISS', commit + T.bad, end],
  ];
  const pos = (ms) => ((ms - start) / (end - start) * 100).toFixed(2);
  return `linear-gradient(90deg, ${bands.map(([j, a, b]) => `${JUDGE_COLORS[j]} ${pos(a)}% ${pos(b)}%`).join(', ')})`;
}

class AuditionGame {
  constructor(level) {
    this.level = level;
    this.score = new ScoreState();
    const beatMs = 60000 / level.bpm;
    this.beatMs = beatMs;
    this.effectiveLeadIn = level.firstBeat ?? Math.max(level.leadIn, 3200);
    this.reverseCount = reverseCount;
    let prevCommit = null;
    this.sequences = level.sequences.map((seq, index) => {
      const beats = Math.max(4, seq.arrows.length + 1); // one beat per arrow plus one, at least a bar
      const duration = beats * beatMs;
      const reverses = generateReverses(seq.arrows.length, this.reverseCount);
      // Scoring beats sit on bar lines: whole bars after the previous one, leaving MIN_REST_BEATS of rest,
      // so the beat line stays in step with the music's phrasing instead of drifting a beat per move.
      const barsFor = (needed) => Math.ceil(needed / BEATS_PER_BAR) * BEATS_PER_BAR * beatMs;
      const commitTime = prevCommit === null
        ? this.effectiveLeadIn + barsFor(beats)
        : prevCommit + barsFor(beats + MIN_REST_BEATS);
      const startTime = commitTime - duration;
      const barEnd = commitTime + TIMING.miss; // the bar runs until the move expires
      prevCommit = commitTime;
      return {
        ...seq, index, startTime, commitTime, reverses, barSpan: barEnd - startTime,
        commitPos: (duration / (barEnd - startTime)) * 100, zones: zoneGradient(startTime, commitTime, barEnd),
      };
    });
    this.currentIndex = 0;
    this.entered = [];
    this.locked = false;
    this.finished = false;
    this.paused = false;
    this.pausedAt = 0;
    this.mode = 'rest';
    this.introPhase = null;
    this.startedAt = performance.now();
    // The song plays from t=0 and now() follows its playback position.
    if (level.music) playMusic(level.music);
    this.frame = this.frame.bind(this);
    this.onKey = this.onKey.bind(this);
    document.addEventListener('keydown', this.onKey);
    this.renderRest();
    requestAnimationFrame(this.frame);
  }

  now() {
    const music = musicPositionMs();
    return music !== null ? music : performance.now() - this.startedAt;
  }
  currentSeq() { return this.sequences[this.currentIndex]; }

  onKey(event) {
    if (this.finished) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.togglePause();
      return;
    }
    if (this.paused) return;
    const seq = this.currentSeq();
    if (!seq) return;
    if (this.now() < seq.startTime) return;

    if (event.code === 'Space' || event.key === ' ') {
      event.preventDefault();
      this.commit();
      return;
    }

    const direction = directionFromKey[event.key];
    if (!direction) return;
    event.preventDefault();
    if (this.locked) return;
    if (this.entered.length >= seq.arrows.length) return;
    const i = this.entered.length;
    const displayed = seq.arrows[i];
    const isReverse = seq.reverses[i];
    const required = isReverse ? OPPOSITE[displayed] : displayed;
    if (direction === required) {
      this.entered.push(direction);
      sfx.tick();
    } else {
      this.entered.push('WRONG');
      this.locked = true;
      sfx.wrong();
    }
    this.renderSequence();
  }

  commit() {
    if (this.finished) return;
    const seq = this.currentSeq();
    if (!seq) return;
    if (this.now() < seq.startTime) return;

    const complete = this.entered.length === seq.arrows.length && !this.locked;
    let judgment;
    if (!complete) {
      judgment = 'MISS';
    } else {
      const diff = Math.abs(this.now() - seq.commitTime);
      judgment = diff <= TIMING.perfect ? 'PERFECT'
        : diff <= TIMING.great ? 'GREAT'
        : diff <= TIMING.cool ? 'COOL'
        : diff <= TIMING.bad ? 'BAD'
        : 'MISS';
    }
    this.applyJudgment(seq, judgment);
    this.advance();
  }

  applyJudgment(seq, judgment) {
    const reverses = seq.reverses.filter(Boolean).length;
    const multiplier = Math.pow(REVERSE_MULT_GROWTH, reverses);
    this.score.apply(judgment, multiplier);
    if (judgment === 'MISS') this.choreo.idle(judgment); // stumble until the next hit (BAD or better)
    else this.choreo.perform(seq.choreo, judgment);
    this.showJudge(judgment, reverses);
    this.updateHud();
    this.playJudgeSfx(judgment);
    this.burst(judgment);
  }

  playJudgeSfx(judgment) {
    if (judgment === 'PERFECT') sfx.perfect();
    else if (judgment === 'GREAT') sfx.great();
    else if (judgment === 'COOL') sfx.cool();
    else if (judgment === 'BAD') sfx.bad();
    else sfx.miss();
  }

  advance() {
    this.currentIndex++;
    this.entered = [];
    this.locked = false;
    if (this.currentIndex >= this.sequences.length) {
      this.startOutro();
      return;
    }
    this.mode = 'rest';
    this.renderRest();
  }

  // After the last move there is nothing left to hit, so the dancer keeps performing until the song ends.
  startOutro() {
    this.mode = 'outro';
    this.outroIndex = 0;
    this.outroNextMove = this.sequences[this.sequences.length - 1].commitTime + 4 * this.beatMs;
    this.outroFallbackEnd = this.now() + 800; // used when there is no song to wait for
    const container = document.querySelector('.sequence');
    if (container) container.innerHTML = '';
    document.querySelector('.sequence-panel')?.classList.add('outro');
  }

  updateOutro() {
    const t = this.now();
    if (t >= this.outroNextMove) {
      const moves = this.level.sequences;
      this.choreo.perform(moves[this.outroIndex % moves.length].choreo, 'GREAT');
      this.outroIndex++;
      this.outroNextMove += 4 * this.beatMs; // a new move every 4 beats, on the beat grid
    }
    if (musicPositionMs() === null && t >= this.outroFallbackEnd) this.finish();
  }

  finish() {
    if (this.finished) return;
    this.finished = true;
    results(this.level, this.score);
  }

  frame() {
    if (this.finished || this.paused) return;
    if (musicEnded()) { this.finish(); return; }
    const seq = this.currentSeq();
    if (this.mode === 'outro') this.updateOutro();
    else if (seq) {
      this.updateIntroPhase();
      if (this.now() > seq.commitTime + TIMING.miss) {
        this.applyJudgment(seq, 'MISS');
        this.advance();
      } else {
        if (this.mode === 'rest' && this.now() >= seq.startTime) {
          this.mode = 'active';
          this.renderSequence();
        }
        this.updateBeatBar(seq);
      }
    }
    if (!this.finished && !this.paused) requestAnimationFrame(this.frame);
  }

  updateIntroPhase() {
    const t = this.now();
    const L = this.effectiveLeadIn;
    const b = this.beatMs;
    let phase = null;
    // Countdown ticks land on the three beats before the first sequence; GO is on the first beat.
    if (this.currentIndex === 0) {
      if (t < L - 3 * b) phase = 'ready';
      else if (t < L - 2 * b) phase = 'count-3';
      else if (t < L - b) phase = 'count-2';
      else if (t < L) phase = 'count-1';
      else if (t < L + 500) phase = 'go';
    }
    if (phase === this.introPhase) return;
    this.introPhase = phase;
    this.renderIntroPhase(phase);
  }

  renderIntroPhase(phase) {
    const stage = document.querySelector('.stage');
    if (!stage) return;
    let el = stage.querySelector('.intro');
    if (phase === null) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement('div');
      stage.append(el);
    }
    const spec = {
      'ready': { html: '<img src="src/assets/get_ready_intro.png" alt="Get Ready">', cls: 'intro ready' },
      'count-3': { html: '3', cls: 'intro count' },
      'count-2': { html: '2', cls: 'intro count' },
      'count-1': { html: '1', cls: 'intro count' },
      'go': { html: 'GO!', cls: 'intro go' },
    }[phase];
    el.className = spec.cls;
    el.innerHTML = spec.html;
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    if (phase.startsWith('count-')) sfx.count();
    else if (phase === 'go') sfx.go();
  }

  updateBeatBar(seq) {
    const fill = document.querySelector('.beat-fill');
    const bar = document.querySelector('.beat-bar');
    if (!fill || !bar) return;
    if (this.zonesFor !== seq.index) {
      bar.style.setProperty('--zones', seq.zones);
      bar.style.setProperty('--commit-pos', `${seq.commitPos}%`);
      this.zonesFor = seq.index;
    }
    const t = this.now();
    const reveal = (progress) => { fill.style.clipPath = `inset(0 ${(1 - progress) * 100}% 0 0)`; };
    if (t < seq.startTime) {
      // Resting: fill a muted bar from the previous move's beat to this move's start, so the
      // player can tell when the arrows are about to come back.
      const prev = this.sequences[seq.index - 1];
      reveal(prev ? Math.min(1, Math.max(0, (t - prev.commitTime) / (seq.startTime - prev.commitTime))) : 0);
      bar.classList.add('resting');
      bar.classList.remove('armed', 'perfect-armed');
      return;
    }
    bar.classList.remove('resting');
    reveal(Math.min(1, (t - seq.startTime) / seq.barSpan));
    const diff = Math.abs(t - seq.commitTime);
    bar.classList.toggle('armed', diff <= TIMING.bad);
    bar.classList.toggle('perfect-armed', diff <= TIMING.perfect);
  }

  renderRest() {
    const seq = this.currentSeq();
    const container = document.querySelector('.sequence');
    const counter = document.querySelector('#seq-counter');
    if (counter) counter.textContent = `${Math.min(this.currentIndex + 1, this.sequences.length)} / ${this.sequences.length}`;
    if (!container || !seq) return;
    container.innerHTML = this.currentIndex === 0 ? '' : `<img class="rest-img" src="src/assets/get_ready_mid.png" alt="Get Ready">`;
  }

  renderSequence() {
    const seq = this.currentSeq();
    const container = document.querySelector('.sequence');
    const counter = document.querySelector('#seq-counter');
    if (counter) counter.textContent = `${Math.min(this.currentIndex + 1, this.sequences.length)} / ${this.sequences.length}`;
    if (!container || !seq) return;
    container.innerHTML = seq.arrows.map((dir, i) => {
      const filled = this.entered[i];
      const isReverse = seq.reverses[i];
      const classes = ['arrow'];
      if (filled === 'WRONG' && i === this.entered.length - 1) classes.push('wrong');
      else if (filled) classes.push('done');
      else if (isReverse) classes.push('reverse');
      else classes.push('default');
      if (i === this.entered.length && !this.locked && !filled) classes.push('next');
      return `<span class="${classes.join(' ')}" data-dir="${dir}"></span>`;
    }).join('');
  }

  showJudge(judgment, reverses = 0) {
    const stage = document.querySelector('.stage');
    if (!stage) return;
    const old = stage.querySelector('.judge');
    if (old) old.remove();
    const iconFile = judgment.toLowerCase() + '.png';
    const streak = judgment === 'PERFECT' && this.score.combo > 1
      ? `<span class="streak">x${this.score.combo}</span>` : '';
    const multiplier = reverses > 0 && judgment !== 'MISS'
      ? `<span class="rev-mult">R${reverses} · ${Math.pow(REVERSE_MULT_GROWTH, reverses).toFixed(1)}x</span>` : '';
    const el = document.createElement('div');
    el.className = `judge ${judgment.toLowerCase()}`;
    el.innerHTML = `<img src="src/assets/judgments/${iconFile}" alt="${judgment}">${streak}${multiplier}`;
    stage.append(el);
    setTimeout(() => { if (el.parentNode) el.remove(); }, 900);
  }

  burst(judgment) {
    const stage = document.querySelector('.stage');
    if (!stage) return;
    const colors = { PERFECT: '#ffeb78', GREAT: '#76f3e7', COOL: '#aabaff' };
    const color = colors[judgment];
    if (!color) return;
    const count = judgment === 'PERFECT' ? 16 : 10;
    for (let i = 0; i < count; i++) {
      const p = document.createElement('span');
      p.className = 'particle';
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
      const dist = 60 + Math.random() * 60;
      p.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
      p.style.setProperty('--dy', `${Math.sin(angle) * dist}px`);
      p.style.background = color;
      stage.append(p);
      setTimeout(() => p.remove(), 700);
    }
  }

  updateHud() {
    const scoreEl = document.querySelector('#score');
    if (!scoreEl) return;
    scoreEl.textContent = this.score.score.toLocaleString();
    scoreEl.classList.remove('pop');
    void scoreEl.offsetWidth;
    scoreEl.classList.add('pop');
  }

  togglePause() {
    if (this.paused) this.resume();
    else this.pause();
  }

  pause() {
    if (this.paused || this.finished) return;
    this.paused = true;
    this.pausedAt = performance.now();
    pauseMusic();
    this.renderPauseOverlay();
  }

  resume() {
    if (!this.paused) return;
    const overlay = document.querySelector('.pause-overlay');
    if (overlay) overlay.remove();
    this.startedAt += performance.now() - this.pausedAt;
    this.paused = false;
    resumeMusic();
    requestAnimationFrame(this.frame);
  }

  restart() {
    const level = this.level;
    this.destroy();
    play(level);
  }

  backToMap() {
    this.destroy();
    map();
  }

  renderPauseOverlay() {
    const existing = document.querySelector('.pause-overlay');
    if (existing) existing.remove();
    const stage = document.querySelector('.stage');
    if (!stage) return;
    const overlay = document.createElement('div');
    overlay.className = 'pause-overlay';
    overlay.innerHTML = `
      <div class="pause-card">
        <p class="eyebrow">Paused</p>
        <h3>Take a breath</h3>
        <div class="pause-actions">
          <button class="primary" data-act="resume">RESUME</button>
          <button class="secondary" data-act="restart">RESTART</button>
          <button class="secondary" data-act="back">BACK TO MAP</button>
        </div>
        <p class="pause-hint">Press <kbd>ESC</kbd> to resume</p>
      </div>`;
    stage.append(overlay);
    overlay.querySelector('[data-act="resume"]').onclick = () => this.resume();
    overlay.querySelector('[data-act="restart"]').onclick = () => this.restart();
    overlay.querySelector('[data-act="back"]').onclick = () => this.backToMap();
  }

  destroy() {
    this.finished = true;
    this.paused = false;
    stopMusic();
    document.removeEventListener('keydown', this.onKey);
    this.choreo?.destroy();
  }
}

function play(level) {
  mount(`<section class="screen game">
    <header class="game-head">
      <div><p class="eyebrow">${level.difficulty} · ${level.bpm} BPM</p><h2>${level.name}</h2></div>
      <div class="stat"><strong id="seq-counter">0 / ${level.sequences.length}</strong><span>SEQUENCE</span></div>
      <div class="stat"><strong id="score">0</strong><span>SCORE</span></div>
    </header>
    <div class="stage">
      <div class="dancer idle"><span class="dance-label">GET READY</span></div>
      <div class="sequence-panel">
        <div class="sequence"></div>
        <div class="beat-bar"><div class="beat-zones"></div><div class="beat-fill"></div><div class="perfect-marker" title="On the beat"></div></div>
        <div class="zone-legend">${['PERFECT', 'GREAT', 'COOL', 'BAD'].map(j => `<span style="--c:${JUDGE_COLORS[j]}">${j}</span>`).join('')}</div>
      </div>
    </div>
    <p class="help">Type <kbd>←</kbd> <kbd>↑</kbd> <kbd>↓</kbd> <kbd>→</kbd> in order, then hit <kbd>SPACE</kbd> as the bar reaches the line — the colour under it is your rating. <kbd>ESC</kbd> to pause.</p>
  </section>`);
  const game = new AuditionGame(level);
  game.choreo = new ChoreographyController(document.querySelector('.dancer'), {
    bpm: level.bpm,
    clock: () => game.now() - game.effectiveLeadIn, // beat 0 = first sequence start
    isPaused: () => game.paused,
  });
  activeGame = game;
}

function results(level, score) {
  const rank = rankFor(score.accuracy);
  const newlyUnlocked = unlockNextAfter(level.id);
  const bestChange = updateBest(level.id, rank, score.score);
  if (newlyUnlocked) sfx.unlock();
  mount(`<section class="screen results">
    <p class="eyebrow">Stage complete</p>
    <h2>${level.name}</h2>
    <div class="rank">${rank}</div>
    <p class="score">${score.score.toLocaleString()} <small>pts</small></p>
    ${(bestChange.rankUp || bestChange.scoreUp) ? `<p class="best-note"><span>NEW BEST</span> ${bestChange.rankUp ? 'Rank up!' : 'High score!'}</p>` : ''}
    ${newlyUnlocked ? `<p class="unlock-note"><span>NEW</span> ${newlyUnlocked.name} unlocked</p>` : ''}
    <div class="results-grid">
      <div><strong>${score.accuracy.toFixed(1)}%</strong><span>ACCURACY</span></div>
      <div><strong>${score.maxCombo}</strong><span>MAX COMBO</span></div>
      <div><strong>${score.counts.PERFECT}</strong><span>PERFECT</span></div>
      <div><strong>${score.counts.GREAT}</strong><span>GREAT</span></div>
      <div><strong>${score.counts.COOL}</strong><span>COOL</span></div>
      <div><strong>${score.counts.BAD}</strong><span>BAD</span></div>
      <div><strong>${score.counts.MISS}</strong><span>MISS</span></div>
    </div>
    <div class="actions">${button('RETRY')} ${button('BACK TO MAP', 'secondary')}</div>
  </section>`);
  const [retry, back] = app.querySelectorAll('button');
  retry.onclick = () => play(level);
  back.onclick = map;
}

function updateMuteButton() {
  const btn = document.querySelector('#mute-btn');
  if (!btn) return;
  btn.classList.toggle('muted', isMuted());
  syncMusicMute();
}
function setupMuteButton() {
  const btn = document.querySelector('#mute-btn');
  if (!btn) return;
  updateMuteButton();
  btn.onclick = () => { primeAudio(); toggleMute(); updateMuteButton(); };
}
function updateReverseBadge() {
  const badge = document.querySelector('#reverse-badge');
  if (!badge) return;
  const countEl = badge.querySelector('.rev-count');
  const multEl = badge.querySelector('.rev-mult');
  if (countEl) countEl.textContent = reverseCount;
  if (multEl) multEl.textContent = reverseCount > 0 ? `${Math.pow(REVERSE_MULT_GROWTH, reverseCount).toFixed(1)}x` : '—';
  badge.classList.toggle('active', reverseCount > 0);
}
function bumpReverse(delta) {
  const next = Math.max(0, Math.min(REVERSE_MAX, reverseCount + delta));
  if (next === reverseCount) return;
  reverseCount = next;
  saveReverseCount(reverseCount);
  updateReverseBadge();
  sfx.tick();
}
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if ((e.key === 'm' || e.key === 'M') && !e.repeat) {
    primeAudio();
    toggleMute();
    updateMuteButton();
  } else if ((e.key === '>' || e.key === '.') && !e.repeat) {
    bumpReverse(+1);
  } else if ((e.key === '<' || e.key === ',') && !e.repeat) {
    bumpReverse(-1);
  }
});
setupMuteButton();
updateReverseBadge();

menu();
