Mixamo animation files (.fbx) for the dancer go here.

Download from https://www.mixamo.com (Adobe login) with:
  Format: FBX Binary (.fbx)   Skin: Without Skin   Frames per second: 30   Keyframe Reduction: none
  Tick "In Place" for dances so she stays on the platform.

Then list each file in ANIMATION_FILES in src/dance-moves.js, e.g.
  Idle: { file: 'Breathing Idle.fbx', free: true },     // waiting before the song
  No:   { file: 'Crying.fbx', free: true },              // MISS reaction, held until the next hit
  HipHop: { file: 'Hip Hop Dancing.fbx' },              // a dance: fitted to each song's BPM automatically
and use the clip name (Idle, No, HipHop...) as `clip` in the MOVES table.

Files are retargeted onto the character at load (see src/animation-library.js), so any Mixamo character's
animations work on Michelle. Mixamo content may be used in your game but not redistributed as standalone assets.
