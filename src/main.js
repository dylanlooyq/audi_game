import { LEVELS, ARROWS } from './level-data.js';
import { TIMING, NOTE_TRAVEL_MS, rankFor } from './config.js';
import { ScoreState } from './scoring.js';
import { ChoreographyController } from './choreography.js';

const app = document.querySelector('#app');
let activeGame = null;
const directionFromKey = { ArrowLeft:'left', ArrowUp:'up', ArrowRight:'right', ArrowDown:'down' };
const button = (text, className='primary') => `<button class="${className}">${text}</button>`;
function mount(html) { if(activeGame) activeGame.destroy(); activeGame=null; app.innerHTML=html; }

function menu() { mount(`<section class="screen menu"><p class="eyebrow">Visual rhythm prototype</p><h1>Dance<br>Game</h1><p class="subhead">Follow the incoming arrows, land on the beat, and keep your dancer moving.</p>${button('START GAME')}</section>`); app.querySelector('button').onclick=map; }
function map() { mount(`<section class="screen"><header class="map-head"><div><p class="eyebrow">Choose your stage</p><h2>Overworld</h2></div>${button('MAIN MENU','secondary')}</header><div class="map"><button class="node one" data-level="level-1">LEVEL 1<small>Easy</small></button><button class="node two" data-level="level-2">LEVEL 2<small>Normal</small></button><p class="legend"><span>●</span> All stages unlocked</p></div></section>`); const [back,...nodes]=app.querySelectorAll('button'); back.onclick=menu; nodes.forEach(n=>n.onclick=()=>play(LEVELS.find(l=>l.id===n.dataset.level))); }

class RhythmGame {
  constructor(level) { this.level=level; this.score=new ScoreState(); this.notes=level.pattern.map((direction,index)=>({ direction,index,target:level.leadIn+index*(60000/level.bpm), status:'pending' })); this.startedAt=performance.now(); this.finished=false; this.frame=this.frame.bind(this); this.onKey=this.onKey.bind(this); document.addEventListener('keydown',this.onKey); requestAnimationFrame(this.frame); }
  now() { return performance.now()-this.startedAt; }
  onKey(event) { const direction=directionFromKey[event.key]; if(!direction || this.finished) return; event.preventDefault(); const note=this.notes.find(n=>n.status==='pending'); if(!note || note.direction!==direction) return this.resolve(note,'MISS'); const diff=Math.abs(this.now()-note.target); const judgment=diff<=TIMING.perfect?'PERFECT':diff<=TIMING.great?'GREAT':diff<=TIMING.good?'GOOD':'MISS'; this.resolve(note,judgment); }
  resolve(note, judgment) { if(!note || note.status!=='pending') return; note.status=judgment; this.score.apply(judgment); const dancer=document.querySelector('.dancer'); if(judgment==='MISS') this.choreo.idle(); else this.choreo.performNext(); this.showJudge(judgment); this.updateHud(); }
  showJudge(judgment) { const old=document.querySelector('.judge'); if(old) old.remove(); const el=document.createElement('div'); el.className=`judge ${judgment.toLowerCase()}`; el.textContent=judgment+'!'; document.querySelector('.stage').append(el); }
  updateHud() { document.querySelector('#combo').textContent=this.score.combo; document.querySelector('#score').textContent=this.score.score.toLocaleString(); }
  frame() { if(this.finished) return; const now=this.now(); for(const note of this.notes) { if(note.status==='pending' && now > note.target+TIMING.miss) this.resolve(note,'MISS'); }
    this.notes.forEach(note=>{ const el=document.querySelector(`[data-note="${note.index}"]`); if(!el) return; const progress=(now-(note.target-NOTE_TRAVEL_MS))/NOTE_TRAVEL_MS; el.style.bottom=`${Math.max(70, Math.min(105, 70+(1-progress)*35))}%`; el.style.opacity=(progress<-.15 || note.status!=='pending')?'0':'1'; });
    if(this.notes.every(n=>n.status!=='pending')) { this.finished=true; setTimeout(()=>results(this.level,this.score),650); return; } requestAnimationFrame(this.frame); }
  destroy() { this.finished=true; document.removeEventListener('keydown',this.onKey); }
}
function play(level) { const targets=['left','up','down','right'].map(d=>`<div class="target" data-target="${d}">${ARROWS[d]}</div>`).join(''); const notes=level.pattern.map((d,i)=>`<div class="note" data-note="${i}">${ARROWS[d]}</div>`).join(''); mount(`<section class="screen game"><header class="game-head"><div><p class="eyebrow">${level.difficulty} · ${level.bpm} BPM</p><h2>${level.name}</h2></div><div class="stat"><strong id="score">0</strong><span>SCORE</span></div><div class="stat"><strong id="combo">0</strong><span>COMBO</span></div></header><div class="stage"><div class="beat-lines"></div><div class="dancer idle"><span class="dance-label">GET READY</span></div>${notes}<div class="target-row">${targets}</div></div><p class="help">Use <kbd>←</kbd> <kbd>↑</kbd> <kbd>↓</kbd> <kbd>→</kbd> when notes reach the targets.</p></section>`); const game=new RhythmGame(level); game.choreo=new ChoreographyController(level.choreography,document.querySelector('.dancer')); activeGame=game; }
function results(level, score) { const rank=rankFor(score.accuracy); mount(`<section class="screen results"><p class="eyebrow">Stage complete</p><h2>${level.name}</h2><div class="rank">${rank}</div><p class="score">${score.score.toLocaleString()} <small>pts</small></p><div class="results-grid"><div><strong>${score.accuracy.toFixed(1)}%</strong><span>ACCURACY</span></div><div><strong>${score.maxCombo}</strong><span>MAX COMBO</span></div><div><strong>${score.counts.PERFECT}</strong><span>PERFECT</span></div><div><strong>${score.counts.GREAT}</strong><span>GREAT</span></div><div><strong>${score.counts.GOOD}</strong><span>GOOD</span></div><div><strong>${score.counts.MISS}</strong><span>MISS</span></div></div><div class="actions">${button('RETRY')} ${button('BACK TO MAP','secondary')}</div></section>`); const [retry,back]=app.querySelectorAll('button'); retry.onclick=()=>play(level); back.onclick=map; }
menu();
