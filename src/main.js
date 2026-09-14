import { LEVELS, ARROWS } from './level-data.js';
import { TIMING, SEQUENCE_GAP_MS, rankFor } from './config.js';
import { ScoreState } from './scoring.js';
import { ChoreographyController } from './choreography.js';
import { sfx, primeAudio } from './sfx.js';

const app = document.querySelector('#app');
let activeGame = null;
const directionFromKey = { ArrowLeft: 'left', ArrowUp: 'up', ArrowRight: 'right', ArrowDown: 'down' };
const button = (text, className = 'primary') => `<button class="${className}">${text}</button>`;
function mount(html) { if (activeGame) activeGame.destroy(); activeGame = null; cleanupMapListener(); app.innerHTML = html; }

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
  </section>`);
  const btn = app.querySelector('button');
  btn.onclick = () => { primeAudio(); map(); };
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

class AuditionGame {
  constructor(level) {
    this.level = level;
    this.score = new ScoreState();
    const beatMs = 60000 / level.bpm;
    let cursor = level.leadIn;
    this.sequences = level.sequences.map((seq, index) => {
      const beats = Math.max(4, seq.arrows.length + 1);
      const duration = beats * beatMs;
      const entry = { ...seq, index, startTime: cursor, commitTime: cursor + duration };
      cursor = entry.commitTime + SEQUENCE_GAP_MS;
      return entry;
    });
    this.currentIndex = 0;
    this.entered = [];
    this.locked = false;
    this.finished = false;
    this.paused = false;
    this.pausedAt = 0;
    this.startedAt = performance.now();
    this.frame = this.frame.bind(this);
    this.onKey = this.onKey.bind(this);
    document.addEventListener('keydown', this.onKey);
    this.renderSequence();
    requestAnimationFrame(this.frame);
  }

  now() { return performance.now() - this.startedAt; }
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
    const expected = seq.arrows[this.entered.length];
    if (direction === expected) {
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
        : diff <= TIMING.good ? 'GOOD'
        : 'MISS';
    }
    this.applyJudgment(seq, judgment);
    this.advance();
  }

  applyJudgment(seq, judgment) {
    this.score.apply(judgment);
    if (judgment === 'MISS') this.choreo.idle('MISS');
    else this.choreo.perform(seq.choreo);
    this.showJudge(judgment);
    this.updateHud();
    this.playJudgeSfx(judgment);
    if (judgment !== 'MISS') this.burst(judgment);
    if (judgment === 'PERFECT') this.shake();
  }

  playJudgeSfx(judgment) {
    if (judgment === 'PERFECT') sfx.perfect();
    else if (judgment === 'GREAT') sfx.great();
    else if (judgment === 'GOOD') sfx.good();
    else sfx.miss();
  }

  advance() {
    this.currentIndex++;
    this.entered = [];
    this.locked = false;
    if (this.currentIndex >= this.sequences.length) {
      this.finished = true;
      setTimeout(() => results(this.level, this.score), 800);
      return;
    }
    this.renderSequence();
  }

  frame() {
    if (this.finished || this.paused) return;
    const seq = this.currentSeq();
    if (seq) {
      if (this.now() > seq.commitTime + TIMING.miss) {
        this.applyJudgment(seq, 'MISS');
        this.advance();
      } else {
        this.updateBeatBar(seq);
      }
    }
    if (!this.finished && !this.paused) requestAnimationFrame(this.frame);
  }

  updateBeatBar(seq) {
    const fill = document.querySelector('.beat-fill');
    const bar = document.querySelector('.beat-bar');
    if (!fill || !bar) return;
    const t = this.now();
    if (t < seq.startTime) { fill.style.width = '0%'; bar.classList.remove('armed'); return; }
    const progress = Math.min(1, (t - seq.startTime) / (seq.commitTime - seq.startTime));
    fill.style.width = `${progress * 100}%`;
    const nearTarget = Math.abs(t - seq.commitTime) <= TIMING.good;
    bar.classList.toggle('armed', nearTarget || progress >= 1);
  }

  renderSequence() {
    const seq = this.currentSeq();
    const container = document.querySelector('.sequence');
    const counter = document.querySelector('#seq-counter');
    if (counter) counter.textContent = `${Math.min(this.currentIndex + 1, this.sequences.length)} / ${this.sequences.length}`;
    if (!container || !seq) return;
    container.innerHTML = seq.arrows.map((dir, i) => {
      const filled = this.entered[i];
      let state = '';
      if (filled === 'WRONG' && i === this.entered.length - 1) state = 'wrong';
      else if (filled) state = 'done';
      else if (i === this.entered.length && !this.locked) state = 'next';
      return `<span class="arrow ${state}">${ARROWS[dir]}</span>`;
    }).join('');
  }

  showJudge(judgment) {
    const old = document.querySelector('.judge');
    if (old) old.remove();
    const el = document.createElement('div');
    el.className = `judge ${judgment.toLowerCase()}`;
    const streak = judgment === 'PERFECT' && this.score.perfectStreak > 1
      ? `<span class="streak">x${this.score.perfectStreak}</span>` : '';
    el.innerHTML = judgment + '!' + streak;
    document.querySelector('.stage').append(el);
  }

  burst(judgment) {
    const stage = document.querySelector('.stage');
    if (!stage) return;
    const colors = { PERFECT: '#ffeb78', GREAT: '#76f3e7', GOOD: '#aabaff' };
    const color = colors[judgment] || '#ffffff';
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

  shake() {
    const stage = document.querySelector('.stage');
    if (!stage) return;
    stage.classList.remove('shake');
    void stage.offsetWidth;
    stage.classList.add('shake');
  }

  updateHud() {
    const comboEl = document.querySelector('#combo');
    const scoreEl = document.querySelector('#score');
    if (!comboEl || !scoreEl) return;
    comboEl.textContent = this.score.combo;
    scoreEl.textContent = this.score.score.toLocaleString();
    comboEl.classList.remove('pop');
    void comboEl.offsetWidth;
    comboEl.classList.add('pop');
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
    this.renderPauseOverlay();
  }

  resume() {
    if (!this.paused) return;
    const overlay = document.querySelector('.pause-overlay');
    if (overlay) overlay.remove();
    this.startedAt += performance.now() - this.pausedAt;
    this.paused = false;
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
    document.removeEventListener('keydown', this.onKey);
  }
}

function play(level) {
  mount(`<section class="screen game">
    <header class="game-head">
      <div><p class="eyebrow">${level.difficulty} · ${level.bpm} BPM</p><h2>${level.name}</h2></div>
      <div class="stat"><strong id="seq-counter">0 / ${level.sequences.length}</strong><span>SEQUENCE</span></div>
      <div class="stat"><strong id="score">0</strong><span>SCORE</span></div>
      <div class="stat"><strong id="combo">0</strong><span>COMBO</span></div>
    </header>
    <div class="stage">
      <div class="dancer idle"><span class="dance-label">GET READY</span></div>
      <div class="sequence-panel">
        <div class="sequence"></div>
        <div class="beat-bar"><div class="beat-fill"></div></div>
      </div>
    </div>
    <p class="help">Type <kbd>←</kbd> <kbd>↑</kbd> <kbd>↓</kbd> <kbd>→</kbd> in order, then hit <kbd>SPACE</kbd> when the bar fills. <kbd>ESC</kbd> to pause.</p>
  </section>`);
  const game = new AuditionGame(level);
  game.choreo = new ChoreographyController(document.querySelector('.dancer'));
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
      <div><strong>${score.maxPerfectStreak}</strong><span>BEST STREAK</span></div>
      <div><strong>${score.counts.PERFECT}</strong><span>PERFECT</span></div>
      <div><strong>${score.counts.GREAT}</strong><span>GREAT</span></div>
      <div><strong>${score.counts.GOOD}</strong><span>GOOD</span></div>
      <div><strong>${score.counts.MISS}</strong><span>MISS</span></div>
    </div>
    <div class="actions">${button('RETRY')} ${button('BACK TO MAP', 'secondary')}</div>
  </section>`);
  const [retry, back] = app.querySelectorAll('button');
  retry.onclick = () => play(level);
  back.onclick = map;
}

menu();
