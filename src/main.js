import { LEVELS, ARROWS } from './level-data.js';
import { TIMING, SEQUENCE_GAP_MS, rankFor } from './config.js';
import { ScoreState } from './scoring.js';
import { ChoreographyController } from './choreography.js';

const app = document.querySelector('#app');
let activeGame = null;
const directionFromKey = { ArrowLeft:'left', ArrowUp:'up', ArrowRight:'right', ArrowDown:'down' };
const button = (text, className='primary') => `<button class="${className}">${text}</button>`;
function mount(html) { if(activeGame) activeGame.destroy(); activeGame=null; app.innerHTML=html; }

const PROGRESS_KEY = 'audi-game:progress';
function loadUnlocked() {
  try {
    const raw = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
    const list = Array.isArray(raw.unlocked) && raw.unlocked.length ? raw.unlocked : ['level-1'];
    return new Set(list);
  } catch { return new Set(['level-1']); }
}
function saveUnlocked(set) {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify({ unlocked: [...set] })); } catch {}
}
function unlockNextAfter(levelId) {
  const idx = LEVELS.findIndex(l => l.id === levelId);
  const next = LEVELS[idx + 1];
  if (!next) return null;
  const unlocked = loadUnlocked();
  if (unlocked.has(next.id)) return null;
  unlocked.add(next.id);
  saveUnlocked(unlocked);
  return next;
}

function menu() {
  mount(`<section class="screen menu">
    <p class="eyebrow">Audition-style rhythm prototype</p>
    <h1>Dance<br>Game</h1>
    <p class="subhead">Type the arrow sequence, then slam <kbd>SPACE</kbd> on the beat. Perfect timing lands the biggest move.</p>
    ${button('START GAME')}
  </section>`);
  app.querySelector('button').onclick = map;
}

function map() {
  const unlocked = loadUnlocked();
  const positions = ['one', 'two', 'three'];
  const nodes = LEVELS.map((level, i) => {
    const isLocked = !unlocked.has(level.id);
    const sub = isLocked ? 'LOCKED' : level.difficulty;
    return `<button class="node ${positions[i]}${isLocked ? ' locked' : ''}" data-level="${level.id}"${isLocked ? ' disabled' : ''}>LEVEL ${i + 1}<small>${sub}</small></button>`;
  }).join('');
  const unlockedCount = LEVELS.filter(l => unlocked.has(l.id)).length;
  mount(`<section class="screen">
    <header class="map-head">
      <div><p class="eyebrow">Choose your stage</p><h2>Overworld</h2></div>
      ${button('MAIN MENU','secondary')}
    </header>
    <div class="map">
      ${nodes}
      <p class="legend"><span>●</span> ${unlockedCount} / ${LEVELS.length} stages unlocked · beat a stage to unlock the next</p>
    </div>
  </section>`);
  const back = app.querySelector('.map-head button');
  back.onclick = menu;
  app.querySelectorAll('.node').forEach(n => {
    if (n.disabled) return;
    n.onclick = () => play(LEVELS.find(l => l.id === n.dataset.level));
  });
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
    } else {
      this.entered.push('WRONG');
      this.locked = true;
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
    if (this.finished) return;
    const seq = this.currentSeq();
    if (seq) {
      if (this.now() > seq.commitTime + TIMING.miss) {
        this.applyJudgment(seq, 'MISS');
        this.advance();
      } else {
        this.updateBeatBar(seq);
      }
    }
    if (!this.finished) requestAnimationFrame(this.frame);
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
    el.textContent = judgment + '!';
    document.querySelector('.stage').append(el);
  }

  updateHud() {
    document.querySelector('#combo').textContent = this.score.combo;
    document.querySelector('#score').textContent = this.score.score.toLocaleString();
  }

  destroy() {
    this.finished = true;
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
    <p class="help">Type <kbd>←</kbd> <kbd>↑</kbd> <kbd>↓</kbd> <kbd>→</kbd> in order, then hit <kbd>SPACE</kbd> when the bar fills.</p>
  </section>`);
  const game = new AuditionGame(level);
  game.choreo = new ChoreographyController(document.querySelector('.dancer'));
  activeGame = game;
}

function results(level, score) {
  const rank = rankFor(score.accuracy);
  const newlyUnlocked = unlockNextAfter(level.id);
  mount(`<section class="screen results">
    <p class="eyebrow">Stage complete</p>
    <h2>${level.name}</h2>
    <div class="rank">${rank}</div>
    <p class="score">${score.score.toLocaleString()} <small>pts</small></p>
    ${newlyUnlocked ? `<p class="unlock-note"><span>NEW</span> ${newlyUnlocked.name} unlocked</p>` : ''}
    <div class="results-grid">
      <div><strong>${score.accuracy.toFixed(1)}%</strong><span>ACCURACY</span></div>
      <div><strong>${score.maxCombo}</strong><span>MAX COMBO</span></div>
      <div><strong>${score.counts.PERFECT}</strong><span>PERFECT</span></div>
      <div><strong>${score.counts.GREAT}</strong><span>GREAT</span></div>
      <div><strong>${score.counts.GOOD}</strong><span>GOOD</span></div>
      <div><strong>${score.counts.MISS}</strong><span>MISS</span></div>
    </div>
    <div class="actions">${button('RETRY')} ${button('BACK TO MAP','secondary')}</div>
  </section>`);
  const [retry, back] = app.querySelectorAll('button');
  retry.onclick = () => play(level);
  back.onclick = map;
}

menu();
