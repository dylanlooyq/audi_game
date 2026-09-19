import { isMuted } from './sfx.js';

let track = null;

// onPlaying(ms) fires each time playback (re)starts, with the track position in ms,
// so the caller can lock its clock to the audio.
export function playMusic(src, onPlaying) {
  stopMusic();
  const audio = new Audio(src);
  track = audio;
  audio.loop = true;
  audio.volume = 0.6;
  audio.muted = isMuted();
  if (onPlaying) audio.addEventListener('playing', () => { if (track === audio) onPlaying(audio.currentTime * 1000); });
  audio.play().catch(() => {});
}

export function pauseMusic() { if (track) track.pause(); }
export function resumeMusic() { if (track) track.play().catch(() => {}); }
export function syncMusicMute() { if (track) track.muted = isMuted(); }

export function stopMusic() {
  if (!track) return;
  track.pause();
  track = null;
}
