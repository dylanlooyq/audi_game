// Maps the choreo names in level-data.js to a base animation clip plus optional procedural body effects.
// The clips are real Mixamo dances loaded from src/assets/animations/ (see ANIMATION_FILES below); the effects only
// add a little extra flair (a hop, a spin) on top. To change a move, edit this table.
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
  'Step Touch': { clip: 'Rumba',   beats: 4, fx: {} },
  'Star Pose':  { clip: 'Macarena', beats: 4, fx: {} },
  'Side Slide': { clip: 'Swing',   beats: 4, fx: {} },
  'Turn':       { clip: 'SoulSpin', beats: 4, fx: {} },
  'Clap Beat':  { clip: 'Chicken', beats: 4, fx: {} },
  'Moonwalk':   { clip: 'Snake',   beats: 4, fx: {} },
  'Point Up':   { clip: 'Jazz',    beats: 4, fx: {} },
  'Finale':     { clip: 'Thriller', beats: 4, fx: { pulse: 0.05 } },

  // Level 2
  'Bounce':     { clip: 'HipHop',  beats: 4, fx: {} },
  'Cross Step': { clip: 'Swing',   beats: 4, fx: {} },
  'Spin':       { clip: 'SoulSpin', beats: 4, fx: {} },
  'Power Pose': { clip: 'Gangnam', beats: 4, fx: { freeze: true } }, // holds the pose after a beat
  'Kick':       { clip: 'Bboy',    beats: 4, fx: {} },
  'Wave':       { clip: 'Wave',    beats: 4, fx: {} },
  'Slide':      { clip: 'Snake',   beats: 4, fx: {} },
  'Jump':       { clip: 'House',   beats: 4, fx: { hop: 0.1 } },
  'Snap':       { clip: 'Silly',   beats: 4, fx: {} },
  'Groove':     { clip: 'HipHop',  beats: 4, fx: {} },

  // Level 3
  'Pop Lock':   { clip: 'Robot',   beats: 4, fx: { pulse: 0.04 } },
  'Roll Out':   { clip: 'Bboy',    beats: 4, fx: {} },
  'Flare':      { clip: 'Gangnam', beats: 4, fx: {} },
  'Konami':     { clip: 'Robot',   beats: 4, fx: {} },
  'Freeze':     { clip: 'Jazz',    beats: 4, fx: { freeze: true } },
  'Spin Out':   { clip: 'SoulSpin', beats: 4, fx: { spin: 1, spinBeats: 2 } },
  'Cypher':     { clip: 'House',   beats: 4, fx: {} },
  'Windmill':   { clip: 'Bboy',    beats: 4, fx: { spin: 2, spinBeats: 3 } },
  'Head Spin':  { clip: 'Bboy',    beats: 4, fx: { spin: 2, spinBeats: 3, hop: 0.12 } },
  'Six Step':   { clip: 'House',   beats: 4, fx: {} },
  'Krump':      { clip: 'HipHop',  beats: 4, fx: { pulse: 0.06 } },
};

// Mixamo animation files to load from src/assets/animations/, keyed by the clip name the moves above use.
//   file : the .fbx in that folder (download from Mixamo with "Without Skin", 30 fps; tick "In Place" for dances)
//   free : true for idles and reactions, which play in real time; leave out for dances, which are fitted to the BPM
//   bpm  : optional step tempo of a dance; measured from the clip when left out
//   lift : how far the clip's feet hover above the floor, in world units (measured); subtracted so she stands on the stage
// A clip named here replaces the character's own (or hand-authored) clip of the same name, e.g. Idle and No.
export const ANIMATION_FILES = {
  // waiting before the song, and the MISS reaction (held until the next hit)
  Idle: { file: 'Breathing Idle.fbx', free: true, lift: 0.039 },
  No: { file: 'Crying.fbx', free: true, lift: 0.039 },

  // dances (fitted to each song's BPM)
  HipHop: { file: 'Hip Hop Dancing.fbx', lift: 0.02 },
  Silly: { file: 'Silly Dancing.fbx', lift: -0.001 },
  SoulSpin: { file: 'Northern Soul Spin.fbx', lift: 0.021 },
  Robot: { file: 'Robot Hip Hop Dance.fbx', lift: 0.013 },
  Rumba: { file: 'Rumba Dancing.fbx', lift: 0.028 },
  Swing: { file: 'Swing Dancing.fbx', lift: 0.017 },
  Snake: { file: 'Snake Hip Hop Dance.fbx', lift: -0.008 },
  Wave: { file: 'Wave Hip Hop Dance.fbx', lift: 0.031 },
  Chicken: { file: 'Chicken Dance.fbx', lift: -0.008 },
  Jazz: { file: 'Jazz Dancing.fbx', lift: 0.044 },
  House: { file: 'House Dancing.fbx', lift: -0.013 },
  Macarena: { file: 'Macarena Dance.fbx', lift: -0.012 },
  Thriller: { file: 'Thriller Part 2.fbx', lift: 0.005 },
  Gangnam: { file: 'Gangnam Style.fbx', lift: 0.027 },
  Bboy: { file: 'Bboy Hip Hop Move.fbx', lift: 0.016 },
  // spare, not used: Defeated.fbx (slumped, head down), Breakdance Freezes.fbx (floor work: her arms are shorter than the
  // Mixamo bot's, so her hands hover above the floor and the flips leave the ground)
};

export const DEFAULT_MOVE = { clip: 'Dance', beats: 4, fx: { bounce: 0.06, swing: 0.2 } };

// Played on a MISS and held until the player lands a BAD or better. Uses the character's 'No' clip if it has one;
// otherwise a hand-authored face-in-hands slump (see procedural-clips.js).
export const STUMBLE_MOVE = { clip: 'No', beats: 2, stumble: true, fx: {} };
export const IDLE_CLIP = 'Idle';

export function moveFor(name) {
  return MOVES[name] || DEFAULT_MOVE;
}
