import * as THREE from 'three';

// Hand-authored skeleton animations (a waiting idle, a missed-move slump) for characters that only ship one dance clip.
// Works on Mixamo-style rigs (bones named "mixamorig<Name>"); returns nothing for any other skeleton.
//
// Poses are degrees added on top of each bone's rest (T-pose) rotation, in the bone's own axes. On these rigs:
//   spine / neck / head : +x bends forward,  +z side-bends toward her right,  +y twists
//   arms                : +x lowers the arm, -x raises it;  left arm +z swings forward, right arm -z swings forward
//   forearms            : left +z / right -z bends the elbow (hand comes forward)
//   legs                : upper leg +x swings forward;  left +z / right -z opens the leg outward
//   knees               : -x bends the knee
const D = Math.PI / 180;
const PREFIX = 'mixamorig';

// Relaxed standing pose (arms hanging by her sides). Every clip starts from this.
const BASE = {
  LeftArm: [74, 0, 6], RightArm: [74, 0, -6],
  LeftForeArm: [0, 0, 12], RightForeArm: [0, 0, -12],
  Head: [4, 0, 0],
};

function buildClip(name, duration, keys, model) {
  const bones = {};
  model.traverse((o) => { if (o.isBone) bones[o.name.slice(PREFIX.length)] = o; });

  // Every bone any key touches gets a track, using BASE (or rest) where a key doesn't mention it.
  const used = new Set(Object.keys(BASE));
  for (const k of keys) for (const b of Object.keys(k.pose)) if (b !== 'HipsDrop') used.add(b);

  const tracks = [];
  const times = keys.map((k) => k.t * duration);
  const e = new THREE.Euler();
  const q = new THREE.Quaternion();
  for (const bone of used) {
    const node = bones[bone];
    if (!node) continue;
    const values = [];
    for (const k of keys) {
      const deg = k.pose[bone] || BASE[bone] || [0, 0, 0];
      e.set(deg[0] * D, deg[1] * D, deg[2] * D);
      q.copy(node.quaternion).multiply(new THREE.Quaternion().setFromEuler(e));
      values.push(q.x, q.y, q.z, q.w);
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(`${node.name}.quaternion`, times, values));
  }

  // Optional pelvis drop, as a fraction of hip height (knees buckling / crouching).
  const hips = bones.Hips;
  if (hips) {
    const values = [];
    for (const k of keys) {
      const drop = k.pose.HipsDrop || 0;
      values.push(hips.position.x, hips.position.y * (1 - drop), hips.position.z);
    }
    tracks.push(new THREE.VectorKeyframeTrack(`${hips.name}.position`, times, values));
  }
  return new THREE.AnimationClip(name, duration, tracks);
}

// Waiting for the song to start: a relaxed stance, weight shifting from leg to leg, a little head look.
// Deliberately small movements - big stretches expose how stiff hand-posed animation is.
function idleKeys() {
  const shift = (s) => ({ // s = +1 weight on her right leg (left knee relaxes), s = -1 mirrored
    Spine: [2, 0, 5 * s], Spine1: [0, 0, 3 * s], Head: [4, 0, -6 * s],
    LeftArm: [74, 0, s > 0 ? 2 : 10], RightArm: [74, 0, s > 0 ? -10 : -2],
    ...(s > 0
      ? { LeftUpLeg: [10, 0, 8], LeftLeg: [-16, 0, 0] }
      : { RightUpLeg: [10, 0, -8], RightLeg: [-16, 0, 0] }),
    HipsDrop: 0.012,
  });
  return [
    { t: 0.00, pose: {} },
    { t: 0.22, pose: shift(1) },
    { t: 0.40, pose: { Head: [4, 14, 0] } },
    { t: 0.50, pose: {} },
    { t: 0.72, pose: shift(-1) },
    { t: 0.90, pose: { Head: [4, -14, 0] } },
    { t: 1.00, pose: {} },
  ];
}

// Missed: face in her hands, head down, shoulders slumped and shaking a little.
function stumbleKeys() {
  const faceInHands = (jolt) => ({
    Spine: [16 + jolt, 0, 0], Spine1: [12 + jolt, 0, 0], Spine2: [8, 0, 0], Neck: [14, 0, 0], Head: [30 + jolt, 0, 0],
    LeftShoulder: [0, 0, -6 - jolt], RightShoulder: [0, 0, 6 + jolt],
    LeftArm: [40, 0, 50], LeftForeArm: [0, 0, 120],
    RightArm: [40, 0, -50], RightForeArm: [0, 0, -120],
    LeftLeg: [-8, 0, 0], RightLeg: [-8, 0, 0],
    HipsDrop: 0.03,
  });
  return [
    { t: 0.00, pose: faceInHands(0) },
    { t: 0.25, pose: faceInHands(3) },
    { t: 0.50, pose: faceInHands(0) },
    { t: 0.75, pose: faceInHands(3) },
    { t: 1.00, pose: faceInHands(0) },
  ];
}

export function buildProceduralClips(model) {
  let hasRig = false;
  model.traverse((o) => { if (o.isBone && o.name === `${PREFIX}Hips`) hasRig = true; });
  if (!hasRig) return {};
  return {
    idle: buildClip('Idle', 5, idleKeys(), model),
    stumble: buildClip('Stumble', 1.4, stumbleKeys(), model),
  };
}
