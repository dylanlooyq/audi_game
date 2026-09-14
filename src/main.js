import { LEVELS } from './level-data.js';
import { TIMING, REVERSE_MAX, REVERSE_MULT_GROWTH, rankFor } from './config.js';
import { ScoreState } from './scoring.js';
import { ChoreographyController } from './choreography.js';
import { sfx, primeAudio, isMuted, toggleMute } from './sfx.js';

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

class AuditionGame {
  constructor(level) {
    this.level = level;
    this.score = new ScoreState();
    const beatMs = 60000 / level.bpm;
    this.effectiveLeadIn = Math.max(level.leadIn, 3200);
    this.reverseCount = reverseCount;
    let cursor = this.effectiveLeadIn;
    this.sequences = level.sequences.map((seq, index) => {
      const beats = Math.max(4, seq.arrows.length + 1);
      const duration = beats * beatMs;
      const reverses = generateReverses(seq.arrows.length, this.reverseCount);
      const entry = { ...seq, index, startTime: cursor, commitTime: cursor + duration, reverses };
      cursor = entry.commitTime + duration;
      return entry;
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
    this.frame = this.frame.bind(this);
    this.onKey = this.onKey.bind(this);
    document.addEventListener('keydown', this.onKey);
    this.renderRest();
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
    if (judgment === 'MISS' || judgment === 'BAD') this.choreo.idle(judgment);
    else this.choreo.perform(seq.choreo);
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
      this.finished = true;
      setTimeout(() => results(this.level, this.score), 800);
      return;
    }
    this.mode = 'rest';
    this.renderRest();
  }

  frame() {
    if (this.finished || this.paused) return;
    const seq = this.currentSeq();
    if (seq) {
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
    let phase = null;
    if (this.currentIndex === 0) {
      if (t < L * 0.3) phase = 'title';
      else if (t < L * 0.525) phase = 'count-3';
      else if (t < L * 0.75) phase = 'count-2';
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
      'title': { text: `${this.level.name} · ${this.level.difficulty}`, cls: 'intro title' },
      'count-3': { text: '3', cls: 'intro count' },
      'count-2': { text: '2', cls: 'intro count' },
      'count-1': { text: '1', cls: 'intro count' },
      'go': { text: 'GO!', cls: 'intro go' },
    }[phase];
    el.className = spec.cls;
    el.textContent = spec.text;
    el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
    if (phase.startsWith('count-')) sfx.count();
    else if (phase === 'go') sfx.go();
  }

  updateBeatBar(seq) {
    const fill = document.querySelector('.beat-fill');
    const bar = document.querySelector('.beat-bar');
    if (!fill || !bar) return;
    const t = this.now();
    if (t < seq.startTime) { fill.style.width = '0%'; bar.classList.remove('armed'); return; }
    const progress = Math.min(1, (t - seq.startTime) / (seq.commitTime - seq.startTime));
    fill.style.width = `${progress * 100}%`;
    const nearTarget = Math.abs(t - seq.commitTime) <= TIMING.bad;
    bar.classList.toggle('armed', nearTarget || progress >= 1);
  }

  renderRest() {
    const seq = this.currentSeq();
    const container = document.querySelector('.sequence');
    const counter = document.querySelector('#seq-counter');
    if (counter) counter.textContent = `${Math.min(this.currentIndex + 1, this.sequences.length)} / ${this.sequences.length}`;
    if (!container || !seq) return;
    container.innerHTML = this.currentIndex === 0 ? '' : `<span class="rest-label">GET READY</span>`;
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
        <div class="beat-bar"><div class="beat-fill"></div><div class="perfect-marker" title="PERFECT"></div></div>
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
