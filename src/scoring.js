import { SCORES, PERFECT_BONUS_BASE, PERFECT_BONUS_GROWTH } from './config.js';

export class ScoreState {
  constructor() {
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.perfectStreak = 0;
    this.maxPerfectStreak = 0;
    this.lastStreakBonus = 0;
    this.counts = { PERFECT: 0, GREAT: 0, GOOD: 0, MISS: 0 };
  }

  apply(judgment) {
    this.counts[judgment]++;
    if (judgment === 'MISS') {
      this.combo = 0;
      this.perfectStreak = 0;
      this.lastStreakBonus = 0;
      return;
    }
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    let bonus = Math.min(this.combo - 1, 20) * 20;
    if (judgment === 'PERFECT') {
      this.perfectStreak++;
      this.maxPerfectStreak = Math.max(this.maxPerfectStreak, this.perfectStreak);
      const streakBonus = Math.floor(PERFECT_BONUS_BASE * Math.pow(PERFECT_BONUS_GROWTH, this.perfectStreak - 1));
      bonus += streakBonus;
      this.lastStreakBonus = streakBonus;
    } else {
      this.perfectStreak = 0;
      this.lastStreakBonus = 0;
    }
    this.score += SCORES[judgment] + bonus;
  }

  get accuracy() {
    const total = Object.values(this.counts).reduce((a, b) => a + b, 0);
    return total ? ((this.counts.PERFECT + this.counts.GREAT * 0.7 + this.counts.GOOD * 0.4) / total * 100) : 0;
  }
}
