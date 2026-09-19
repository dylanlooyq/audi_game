import * as THREE from 'three';
import { FBXLoader } from './vendor/three/addons/loaders/FBXLoader.js';
import { MIXAMO_REST } from './mixamo-rest.js';

// Loads Mixamo animation files (.fbx, "Without Skin" is fine) from src/assets/animations/ and retargets them
// onto the dancer's Mixamo-rigged model. Drop a file in that folder and list it in ANIMATION_FILES
// (src/dance-moves.js) to use it.

const PREFIX = 'mixamorig';
const HIPS = 'mixamorigHips';
const MAX_TRAVEL_CM = 50;       // dances that walk or slide are eased so she stays near the middle of the platform
const MIXAMO_HIPS_HEIGHT = 100; // hip height, in cm, of the standard Mixamo skeleton the FBX files are authored for

const animationUrl = (file) => new URL(`./assets/animations/${file}`, import.meta.url).href;

// Mixamo files use a Y-up frame in centimetres, with every bone oriented the way Mixamo's own skeleton is.
// A model that went through a DCC tool (Blender re-rolls bones on import) has the same skeleton with different bone
// axes, and its hips hang off a root node that can be rotated (e.g. an armature turned 90 degrees).
//   bone offset K_b = (Mixamo rest orientation)^-1 * (this model's rest orientation)
//   non-hip bone:  q_model = K_parent^-1 * q_file * K_b
//   hips:          q_model = P^-1 * q_file * K_hips, with P the hips parent's orientation
// Must be created while the model is still in its rest pose (i.e. at load, before any animation plays).
export function createRetargeter(model) {
  const hips = model.getObjectByName(HIPS);
  if (!hips) return null;

  model.updateWorldMatrix(true, true);
  const rootInv = model.getWorldQuaternion(new THREE.Quaternion()).invert();
  const K = {};
  const bones = new Set();
  model.traverse((o) => {
    if (!o.isBone) return;
    bones.add(o.name);
    const std = MIXAMO_REST[o.name.replace(PREFIX, '')];
    if (!std) return;
    const restModel = rootInv.clone().multiply(o.getWorldQuaternion(new THREE.Quaternion()));
    K[o.name] = new THREE.Quaternion().fromArray(std).invert().multiply(restModel);
  });
  const parentInv = {};
  for (const name of bones) {
    const parent = model.getObjectByName(name).parent;
    parentInv[name] = parent && parent.isBone && K[parent.name]
      ? K[parent.name].clone().invert()
      : rootInv.clone().multiply(parent.getWorldQuaternion(new THREE.Quaternion())).invert(); // P^-1
  }
  const scale = hips.position.length() / MIXAMO_HIPS_HEIGHT;
  const toParent = parentInv[HIPS];

  return function retarget(clip, name) {
    const tracks = [];
    for (const t of clip.tracks) {
      const [node, prop] = t.name.split('.');
      if (!bones.has(node) || !K[node]) continue;
      if (prop === 'quaternion') {
        const n = t.times.length;
        const out = new Float32Array(t.values.length);
        const q = new THREE.Quaternion();
        for (let i = 0; i < n; i++) {
          q.fromArray(t.values, i * 4).multiply(K[node]).premultiply(parentInv[node]).toArray(out, i * 4);
        }
        tracks.push(new THREE.QuaternionKeyframeTrack(t.name, t.times, out));
      } else if (prop === 'position' && node === HIPS) {
        // Centre the horizontal travel and ease big excursions so root motion can't walk her off the platform;
        // the vertical bounce is kept as is.
        const n = t.times.length;
        let mx = 0, mz = 0;
        for (let i = 0; i < n; i++) { mx += t.values[i * 3]; mz += t.values[i * 3 + 2]; }
        mx /= n; mz /= n;
        const out = new Float32Array(t.values.length);
        const v = new THREE.Vector3();
        for (let i = 0; i < n; i++) {
          let x = t.values[i * 3] - mx, z = t.values[i * 3 + 2] - mz;
          const r = Math.hypot(x, z);
          if (r > 1e-6) { const k = MAX_TRAVEL_CM * Math.tanh(r / MAX_TRAVEL_CM) / r; x *= k; z *= k; } // ~unchanged for small sways
          v.set(x, t.values[i * 3 + 1], z).multiplyScalar(scale);
          v.applyQuaternion(toParent).toArray(out, i * 3);
        }
        tracks.push(new THREE.VectorKeyframeTrack(t.name, t.times, out));
      }
    }
    return new THREE.AnimationClip(name, clip.duration, tracks);
  };
}

// Step tempo of a dance clip, found from how fast the hips bounce (dominant 1.0-2.6 Hz component).
export function estimateClipBpm(clip) {
  const track = clip.tracks.find((t) => t.name === `${HIPS}.position`);
  if (!track || track.times.length < 8) return null;
  const n = track.times.length;
  const dt = clip.duration / (n - 1);
  // vertical hip motion: strip the slow drift with a 1s moving average, then scan frequencies
  const raw = [];
  for (let i = 0; i < n; i++) raw.push(track.values[i * 3 + 1]);
  const w = Math.max(1, Math.round(1 / dt));
  const y = raw.map((v, i) => {
    let a = 0, c = 0;
    for (let k = Math.max(0, i - w); k <= Math.min(n - 1, i + w); k++) { a += raw[k]; c++; }
    return v - a / c;
  });
  let best = 0, bestF = 0;
  for (let f = 1.0; f <= 2.6; f += 0.02) {
    let re = 0, im = 0;
    for (let i = 0; i < n; i++) { const ang = 2 * Math.PI * f * i * dt; re += y[i] * Math.cos(ang); im += y[i] * Math.sin(ang); }
    const mag = Math.hypot(re, im);
    if (mag > best) { best = mag; bestF = f; }
  }
  // a peak pinned to either end of the search range means there is no clear bounce to measure
  return bestF > 1.06 && bestF < 2.54 ? bestF * 60 : null;
}

// Loads every file in the manifest ({ clipName: { file, free? } }); calls onClip(name, clip, entry, measuredBpm) as each arrives.
// `retarget` comes from createRetargeter(model), made while the model was still in its rest pose.
export function loadAnimationLibrary(retarget, manifest, onClip) {
  return Promise.all(Object.entries(manifest).map(async ([name, entry]) => {
    try {
      const fbx = await new FBXLoader().loadAsync(animationUrl(entry.file));
      const source = fbx.animations[0];
      if (source) onClip(name, retarget(source, name), entry, estimateClipBpm(source)); // measured before retargeting: hips-up is +y there
    } catch (err) {
      console.warn(`Animation "${entry.file}" could not be loaded`, err);
    }
  }));
}
