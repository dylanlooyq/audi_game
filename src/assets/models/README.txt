Michelle.glb (current dancer)
  Mixamo character "Michelle" with a SambaDance clip, as shipped in the three.js examples.
  Mixamo content is free to use in a game but not to redistribute as standalone assets;
  check Adobe's Mixamo terms before any public release. Fine for local prototyping.

RobotExpressive.glb (alternate)
  "Robot Expressive" by Tomas Laulhe, modified by Don McCurdy. CC0 1.0 (public domain).
  Has extra clips (Jump, Punch, Wave, No...) that the move table uses when present.

To switch or add a character: put a rigged .glb here, point MODEL_URL in src/dancer3d.js at it, and
make the clip names in src/dance-moves.js match the animations inside the file. Any move whose
clip is missing falls back to the character's main clip.
