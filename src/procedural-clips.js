import * as THREE from 'three';

// Hand-authored skeleton animations for characters that only ship one dance clip.
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

// Reaching, side bends, a forward fold and shoulder rolls - a loose warm-up while she waits for the song.
function stretchKeys() {
  // Legs are children of the hips, so they must swing forward by as much as the hips tip to stay vertical.
  const FOLD = {
    Hips: [32, 0, 0], Spine: [14, 0, 0], Spine1: [14, 0, 0], Spine2: [10, 0, 0], Neck: [8, 0, 0], Head: [8, 0, 0],
    LeftUpLeg: [32, 0, 0], RightUpLeg: [32, 0, 0], LeftLeg: [-10, 0, 0], RightLeg: [-10, 0, 0],
    LeftArm: [76, 0, -50], RightArm: [76, 0, 50],
  };
  const reachUp = { LeftArm: [-112, 0, 4], RightArm: [-112, 0, -4], LeftForeArm: [0, 0, -6], RightForeArm: [0, 0, 6] };
  return [
    { t: 0.00, pose: {} },
    // both arms overhead, gentle backbend, looking up
    { t: 0.14, pose: { ...reachUp, Spine: [-6, 0, 0], Spine1: [-6, 0, 0], Spine2: [-6, 0, 0], Neck: [-8, 0, 0], Head: [-10, 0, 0] } },
    // side bend to her left
    { t: 0.27, pose: { ...reachUp, Hips: [0, 0, 4], Spine: [0, 0, -12], Spine1: [0, 0, -12], Spine2: [0, 0, -10], Head: [0, 0, 8], LeftUpLeg: [0, 0, 4] } },
    // side bend to her right
    { t: 0.43, pose: { ...reachUp, Hips: [0, 0, -4], Spine: [0, 0, 12], Spine1: [0, 0, 12], Spine2: [0, 0, 10], Head: [0, 0, -8], RightUpLeg: [0, 0, -4] } },
    // back to centre, arms up
    { t: 0.52, pose: { ...reachUp, Head: [-6, 0, 0] } },
    // forward fold, arms hanging, knees soft
    { t: 0.68, pose: FOLD },
    { t: 0.76, pose: FOLD },
    // roll the shoulders
    { t: 0.87, pose: { LeftShoulder: [0, 0, -14], RightShoulder: [0, 0, 14], Head: [0, 0, 6] } },
    { t: 0.94, pose: { LeftShoulder: [0, 0, 12], RightShoulder: [0, 0, -12], Head: [0, 0, -6] } },
    { t: 1.00, pose: {} },
  ];
}

// Off balance: staggering from foot to foot, arms flailing, head hanging.
function stumbleKeys() {
  const hunch = { Spine: [22, 0, 0], Spine1: [14, 0, 0], Spine2: [8, 0, 0], Neck: [12, 0, 0], Head: [22, 0, 0] };
  const stagger = (s) => ({ // s = +1: weight on her right leg, left leg kicked out; s = -1 mirrored
    ...hunch,
    Hips: [0, 0, 5 * s],
    HipsDrop: 0.05,
    Spine: [22, 0, -10 * s], Spine1: [14, 0, -8 * s],
    Head: [22, 0, 12 * s],
    ...(s > 0
      ? { LeftArm: [30, 0, 58], LeftForeArm: [0, 0, 34], RightArm: [88, 0, 30],
          LeftUpLeg: [40, 0, 10], LeftLeg: [-58, 0, 0], RightUpLeg: [-8, 0, 0], RightLeg: [-12, 0, 0] }
      : { RightArm: [30, 0, -58], RightForeArm: [0, 0, -34], LeftArm: [88, 0, -30],
          RightUpLeg: [40, 0, -10], RightLeg: [-58, 0, 0], LeftUpLeg: [-8, 0, 0], LeftLeg: [-12, 0, 0] }),
  });
  const flail = { // catching balance: both arms thrown out and up
    ...hunch, Spine: [12, 0, 0], Head: [8, 0, 0], HipsDrop: 0.08,
    LeftArm: [-10, 0, 40], RightArm: [-10, 0, -40], LeftForeArm: [0, 0, 20], RightForeArm: [0, 0, -20],
    LeftUpLeg: [10, 0, 6], RightUpLeg: [10, 0, -6], LeftLeg: [-30, 0, 0], RightLeg: [-30, 0, 0],
  };
  return [
    { t: 0.00, pose: stagger(1) },
    { t: 0.25, pose: flail },
    { t: 0.50, pose: stagger(-1) },
    { t: 0.75, pose: flail },
    { t: 1.00, pose: stagger(1) },
  ];
}

export function buildProceduralClips(model) {
  let hasRig = false;
  model.traverse((o) => { if (o.isBone && o.name === `${PREFIX}Hips`) hasRig = true; });
  if (!hasRig) return {};
  return {
    stretch: buildClip('Stretch', 9, stretchKeys(), model),
    stumble: buildClip('Stumble', 1.6, stumbleKeys(), model),
  };
}
