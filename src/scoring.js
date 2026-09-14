import { SCORES, PERFECT_BONUS_BASE, PERFECT_BONUS_GROWTH } from './config.js';

export class ScoreState {
  constructor() {
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.lastStreakBonus = 0;
    this.counts = { PERFECT: 0, GREAT: 0, COOL: 0, BAD: 0, MISS: 0 };
  }

  apply(judgment, multiplier = 1) {
    this.counts[judgment]++;
    if (judgment !== 'PERFECT') {
      this.combo = 0;
      this.lastStreakBonus = 0;
      const base = SCORES[judgment] || 0;
      if (base > 0) this.score += Math.floor(base * multiplier);
      return;
    }
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    const positionBonus = Math.min(this.combo - 1, 20) * 20;
    const streakBonus = Math.floor(PERFECT_BONUS_BASE * Math.pow(PERFECT_BONUS_GROWTH, this.combo - 1));
    this.lastStreakBonus = streakBonus;
    this.score += Math.floor((SCORES.PERFECT + positionBonus + streakBonus) * multiplier);
  }

  get accuracy() {
    const total = Object.values(this.counts).reduce((a, b) => a + b, 0);
    return total
      ? ((this.counts.PERFECT + this.counts.GREAT * 0.75 + this.counts.COOL * 0.5 + this.counts.BAD * 0.2) / total * 100)
      : 0;
  }
}
