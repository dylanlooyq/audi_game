import { SCORES } from './config.js';
export class ScoreState {
  constructor() { this.score=0; this.combo=0; this.maxCombo=0; this.counts={ PERFECT:0, GREAT:0, GOOD:0, MISS:0 }; }
  apply(judgment) { this.counts[judgment]++; if(judgment === 'MISS') { this.combo=0; return; } this.combo++; this.maxCombo=Math.max(this.maxCombo,this.combo); this.score += SCORES[judgment] + Math.min(this.combo - 1, 20) * 20; }
  get accuracy() { const total=Object.values(this.counts).reduce((a,b)=>a+b,0); return total ? ((this.counts.PERFECT + this.counts.GREAT*.7 + this.counts.GOOD*.4) / total * 100) : 0; }
}
