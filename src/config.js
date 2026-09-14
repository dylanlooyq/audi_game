export const TIMING = { perfect: 100, great: 200, good: 350, miss: 450 };
export const SCORES = { PERFECT: 1000, GREAT: 700, GOOD: 400, MISS: 0 };
export const SEQUENCE_GAP_MS = 500;

export const PERFECT_BONUS_BASE = 50;
export const PERFECT_BONUS_GROWTH = 1.6;

export function rankFor(accuracy) { return accuracy >= 95 ? 'S' : accuracy >= 85 ? 'A' : accuracy >= 70 ? 'B' : accuracy >= 50 ? 'C' : 'D'; }
