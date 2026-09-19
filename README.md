# Dance Game

A dependency-free Audition-style rhythm/dance game prototype. Serve the folder over any static HTTP server (or run the packaged Electron app) and play.

## How to play

1. Each sequence shows a row of arrows to enter in order (`←` `↑` `↓` `→`).
2. Type them left-to-right. Wrong key locks the sequence as a miss.
3. Press `SPACE` as the bar reaches the white beat line. The colour of the bar section under the playhead is the rating you'll get (Perfect / Great / Cool / Bad, or Miss when too early or late). The windows are set in `src/config.js`.
4. After the last move the dancer keeps performing until the song ends, then the results screen appears.

## Project layout

- `src/level-data.js` — level metadata plus arrow sequences and per-sequence dance moves
- `src/config.js` — timing windows, scores, rank thresholds
- `src/music.js` — music playback
- `src/scoring.js` — score/combo/accuracy state
- `src/choreography.js` — dance-move controller, decoupled from input (falls back to a CSS placeholder if WebGL is unavailable)
- `src/dancer3d.js` — Three.js cel-shaded 3D dancer: toon materials, inverted-hull outlines, stage, beat-synced animation
- `src/stage3d.js` — the 3D stage: key light with shadows, roaming coloured spotlights and beams, patterned platform with a beat-chasing LED rim, equaliser wall, light towers, speakers, sparkles
- `src/dance-moves.js` — maps each choreo name in level data to a base clip plus procedural effects (spin, hop, sway…)
- `src/procedural-clips.js` — stand-in hand-posed animations (waiting idle, MISS slump), used only until real Mixamo files are provided
- `src/animation-library.js` — loads Mixamo `.fbx` animation files from `src/assets/animations/` and retargets them onto the character (`src/mixamo-rest.js` holds the standard Mixamo bone orientations it needs)
- `src/vendor/three/` — vendored Three.js (r170) + GLTFLoader, loaded through the import map in `index.html`
- `src/assets/models/` — the dancer's `.glb` (placeholder robot, CC0). See the README there to swap the character
- `src/main.js` — screen flow and Audition-style runtime
- `electron-main.cjs` — Electron entry (packaging only)

Music: a level can set `music` in `src/level-data.js` to a file under `src/assets/music/`. The song plays from the start of the level, and the first arrows appear at `firstBeat` (ms into the song) so they line up with the first full beat. Tune `bpm` and `firstBeat` in that file.

## Running the game

- Desktop app: `npm install` (first time only), then `npm start`.
- Browser: serve the folder with any static server, e.g. `npx serve .` or `python -m http.server`, then open the URL it prints. Opening `index.html` directly won't work because the game uses ES modules.
