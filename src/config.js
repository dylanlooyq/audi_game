export const TIMING = { perfect: 130, great: 220, cool: 320, bad: 440, miss: 540 };
export const SCORES = { PERFECT: 1000, GREAT: 700, COOL: 400, BAD: 100, MISS: 0 };

export const PERFECT_BONUS_BASE = 50;
export const PERFECT_BONUS_GROWTH = 1.6;

export const REVERSE_MAX = 6;
export const REVERSE_MULT_GROWTH = 1.5;

export function rankFor(accuracy) { return accuracy >= 95 ? 'S' : accuracy >= 85 ? 'A' : accuracy >= 70 ? 'B' : accuracy >= 50 ? 'C' : 'D'; }
