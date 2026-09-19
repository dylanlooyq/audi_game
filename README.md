# Dance Game

A dependency-free Audition-style rhythm/dance game prototype. Serve the folder over any static HTTP server (or run the packaged Electron app) and play.

## How to play

1. Each sequence shows a row of arrows to enter in order (`←` `↑` `↓` `→`).
2. Type them left-to-right. Wrong key locks the sequence as a miss.
3. When the beat bar fills up, press `SPACE` to commit. Timing vs the bar's end sets your judgment (Perfect ±100ms, Great ±200ms, Good ±350ms, Miss beyond 450ms).

## Project layout

- `src/level-data.js` — level metadata plus arrow sequences and per-sequence dance moves
- `src/config.js` — timing windows, scores, rank thresholds
- `src/music.js` — music playback
- `src/scoring.js` — score/combo/accuracy state
- `src/choreography.js` — dance-move controller, decoupled from input
- `src/main.js` — screen flow and Audition-style runtime
- `electron-main.cjs` — Electron entry (packaging only)

Music: a level can set `music` in `src/level-data.js` to a file under `src/assets/music/`. The song plays from the start of the level, and the first arrows appear at `firstBeat` (ms into the song) so they line up with the first full beat. Tune `bpm` and `firstBeat` in that file.

## Running the game

- Desktop app: `npm install` (first time only), then `npm start`.
- Browser: serve the folder with any static server, e.g. `npx serve .` or `python -m http.server`, then open the URL it prints. Opening `index.html` directly won't work because the game uses ES modules.
