// Timing windows in ms, measured either side of the beat: a Space press within `perfect` of the beat is PERFECT,
// within `great` is GREAT, and so on. Past `bad` it scores MISS, and `miss` is how long after the beat the move
// expires. The beat bar's coloured sections are drawn from these, so editing them changes the bar too.
export const TIMING = { perfect: 130, great: 220, cool: 320, bad: 440, miss: 540 };

// Beat bar section colours, matching the judgment icons. MISS also covers "too early to score".
export const JUDGE_COLORS = { PERFECT: '#b968ff', GREAT: '#5fe35c', COOL: '#4aa3ff', BAD: '#ff5a4d', MISS: '#4a4f75' };
export const SCORES = { PERFECT: 1000, GREAT: 700, COOL: 400, BAD: 100, MISS: 0 };

// Move layout. A move's scoring beat always lands on the first beat of a bar (a "downbeat"), so it stays in
// step with the music's phrasing. Each move gets whole bars from the previous one, and never less than
// MIN_REST_BEATS of rest between the last move's beat and the point where the next move's arrows appear.
export const BEATS_PER_BAR = 4;
export const MIN_REST_BEATS = 3;

export const PERFECT_BONUS_BASE = 50;
export const PERFECT_BONUS_GROWTH = 1.6;

export const REVERSE_MAX = 6;
export const REVERSE_MULT_GROWTH = 1.5;

export function rankFor(accuracy) { return accuracy >= 95 ? 'S' : accuracy >= 85 ? 'A' : accuracy >= 70 ? 'B' : accuracy >= 50 ? 'C' : 'D'; }
