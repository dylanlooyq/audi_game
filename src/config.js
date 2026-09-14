export const TIMING = { perfect: 100, great: 200, good: 350, miss: 450 };
export const SCORES = { PERFECT: 1000, GREAT: 700, GOOD: 400, MISS: 0 };
export const NOTE_TRAVEL_MS = 1800;

export function rankFor(accuracy) { return accuracy >= 95 ? 'S' : accuracy >= 85 ? 'A' : accuracy >= 70 ? 'B' : accuracy >= 50 ? 'C' : 'D'; }
