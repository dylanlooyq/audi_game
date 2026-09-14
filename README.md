# Dance Game

A dependency-free 2D rhythm/dance game prototype. Open `index.html` in a modern browser to play.

## Project layout

- `src/level-data.js` — extensible chart and choreography data
- `src/config.js` — configurable timing, score, rank, and note travel settings
- `src/scoring.js` — score/combo/accuracy state
- `src/choreography.js` — dance-move controller, deliberately separate from inputs
- `src/main.js` — screen flow and rhythm runtime

Use arrow keys as incoming notes meet the targets. Timing windows are Perfect ±100ms, Great ±200ms, Good ±350ms; unresolved notes miss after 450ms. There is no audio by design.
