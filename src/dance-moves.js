// Maps the choreo names in level-data.js to a base animation clip plus procedural body effects.
// The placeholder robot only ships a handful of clips, so variety comes from layering effects
// on the whole character. When a richer character/clip set is dropped in, only this table changes.
//
//   clip  : animation clip name inside the model file
//   beats : nominal loop length; not used for timing any more (the dancer sets clip speed so the clip's
//           steps land on the song's beats)
//   fx    : procedural motion layered on the character root, all locked to the beat
//     spin   – full turns around the vertical axis over the first `spinBeats` beats
//     flip   – full turns around the sideways axis (front/back flips), one-shot
//     hop    – one-shot jump height
//     bounce – continuous per-beat hop height
//     sway   – side-to-side travel (world units), one cycle per `swayBeats`
//     swing  – yaw wobble amplitude in radians, one cycle per 2 beats
//     lean   – roll amplitude in radians, one cycle per 2 beats
//     pulse  – scale pump per beat
//     shiver – fast jitter amplitude (pop-lock / krump feel)
//     freeze – hold still after a short pop (pose moves)

export const MOVES = {
  // Level 1
  'Step Touch': { clip: 'Dance',    beats: 4, fx: { sway: 0.35, swayBeats: 4, bounce: 0.05 } },
  'Star Pose':  { clip: 'ThumbsUp', beats: 4, fx: { hop: 0.3, pulse: 0.05 } },
  'Side Slide': { clip: 'Dance',    beats: 4, fx: { sway: 0.7, swayBeats: 4, lean: 0.12 } },
  'Turn':       { clip: 'Dance',    beats: 4, fx: { spin: 1, spinBeats: 2, bounce: 0.05 } },
  'Clap Beat':  { clip: 'Wave',     beats: 2, fx: { bounce: 0.09, pulse: 0.03 } },
  'Moonwalk':   { clip: 'Walking',  beats: 2, fx: { sway: -0.9, swayBeats: 8, lean: 0.1 } },
  'Point Up':   { clip: 'Punch',    beats: 2, fx: { hop: 0.15, lean: 0.1 } },
  'Finale':     { clip: 'Dance',    beats: 4, fx: { spin: 2, spinBeats: 3, hop: 0.5, pulse: 0.08 } },

  // Level 2
  'Bounce':     { clip: 'Dance',    beats: 4, fx: { bounce: 0.14 } },
  'Cross Step': { clip: 'Walking',  beats: 2, fx: { sway: 0.5, swayBeats: 4, swing: 0.4 } },
  'Spin':       { clip: 'Dance',    beats: 4, fx: { spin: 2, spinBeats: 2, bounce: 0.06 } },
  'Power Pose': { clip: 'Punch',    beats: 2, fx: { hop: 0.25, pulse: 0.09, freeze: true } },
  'Kick':       { clip: 'Punch',    beats: 1, fx: { bounce: 0.1, lean: 0.18 } },
  'Wave':       { clip: 'Wave',     beats: 4, fx: { sway: 0.25, swayBeats: 4, swing: 0.2 } },
  'Slide':      { clip: 'Walking',  beats: 2, fx: { sway: 0.8, swayBeats: 4 } },
  'Jump':       { clip: 'Jump',     beats: 4, fx: { hop: 0.45, pulse: 0.04 } },
  'Snap':       { clip: 'Yes',      beats: 1, fx: { bounce: 0.06, pulse: 0.06 } },
  'Groove':     { clip: 'Dance',    beats: 4, fx: { swing: 0.35, lean: 0.1, bounce: 0.07 } },

  // Level 3
  'Pop Lock':   { clip: 'Dance',    beats: 2, fx: { shiver: 0.04, pulse: 0.07 } },
  'Roll Out':   { clip: 'Dance',    beats: 4, fx: { spin: 1, spinBeats: 1, sway: 0.6, swayBeats: 4, lean: 0.2 } },
  'Flare':      { clip: 'Jump',     beats: 4, fx: { spin: 2, spinBeats: 2, hop: 0.35, lean: 0.25 } },
  'Konami':     { clip: 'Dance',    beats: 2, fx: { bounce: 0.1, swing: 0.5, pulse: 0.05 } },
  'Freeze':     { clip: 'Punch',    beats: 4, fx: { hop: 0.3, lean: 0.35, freeze: true } },
  'Spin Out':   { clip: 'Dance',    beats: 4, fx: { spin: 3, spinBeats: 3, bounce: 0.05 } },
  'Cypher':     { clip: 'Dance',    beats: 4, fx: { sway: 0.5, swayBeats: 2, swing: 0.45, bounce: 0.08 } },
  'Windmill':   { clip: 'Jump',     beats: 4, fx: { spin: 4, spinBeats: 3, lean: 0.35, hop: 0.2 } },
  'Head Spin':  { clip: 'Jump',     beats: 4, fx: { flip: 1, spin: 3, spinBeats: 3, hop: 0.4 } },
  'Six Step':   { clip: 'Walking',  beats: 1, fx: { spin: 1, spinBeats: 4, bounce: 0.09, sway: 0.3, swayBeats: 2 } },
  'Krump':      { clip: 'Punch',    beats: 1, fx: { shiver: 0.06, bounce: 0.12, pulse: 0.09 } },
};

export const DEFAULT_MOVE = { clip: 'Dance', beats: 4, fx: { bounce: 0.06, swing: 0.2 } };

// Played on a MISS and held until the player lands a BAD or better. Uses the character's 'No' clip if it has one;
// otherwise a hand-authored staggering stumble (see procedural-clips.js).
export const STUMBLE_MOVE = { clip: 'No', beats: 2, stumble: true, fx: { sway: 0.1, swayBeats: 2 } };
export const IDLE_CLIP = 'Idle';

export function moveFor(name) {
  return MOVES[name] || DEFAULT_MOVE;
}
