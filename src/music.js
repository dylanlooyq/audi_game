import { isMuted } from './sfx.js';

let track = null;

export function playMusic(src) {
  stopMusic();
  const audio = new Audio(src);
  track = audio;
  audio.volume = 0.6;
  audio.muted = isMuted();
  // If the browser refuses to play, drop the track so the game falls back to its own clock.
  audio.play().catch(() => { if (track === audio) track = null; });
}

// Playback position in ms, or null when no music is loaded. The game clock follows this, so the
// beat grid stays locked to what is actually being played (no startup or drift offset).
export function musicPositionMs() { return track ? track.currentTime * 1000 : null; }

// True once the song has played to the end (the game shows results then).
export function musicEnded() { return !!track && track.ended; }

export function pauseMusic() { if (track) track.pause(); }
export function resumeMusic() { if (track) track.play().catch(() => {}); }
export function syncMusicMute() { if (track) track.muted = isMuted(); }

export function stopMusic() {
  if (!track) return;
  track.pause();
  track = null;
}
