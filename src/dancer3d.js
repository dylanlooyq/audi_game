import * as THREE from 'three';
import { GLTFLoader } from './vendor/three/addons/loaders/GLTFLoader.js';
import { toCreasedNormals } from './vendor/three/addons/utils/BufferGeometryUtils.js';
import { buildProceduralClips } from './procedural-clips.js';
import { moveFor, STUMBLE_MOVE, IDLE_CLIP } from './dance-moves.js';

// Swap this (and the clip names in dance-moves.js) to change character.
// (RobotExpressive.glb is also in that folder if you want the robot back.)
const MODEL_URL = new URL('./assets/models/Michelle.glb', import.meta.url).href;

const CHARACTER_HEIGHT = 2;      // world units the loaded model is normalised to
const OUTLINE_WIDTH = 0.018;      // world units
const OUTLINE_COLOR = 0x140c2b;
const FLOOR_FRAC = 0.68;         // where the stage floor sits (matches the CSS backdrop split)
const FOV = 32;
const CAM_DIST = 5.6;
const FADE = 0.18;               // seconds of crossfade between clips
const CLIP_BPM = 108;            // step tempo of the character's dance clip(s) as authored (measured for Michelle's samba)
const IDLE_MOVE = { clip: IDLE_CLIP, beats: 0, fx: {} };

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeInOut = (u) => u * u * (3 - 2 * u);

function makeGradientMap() {
  // Three hard light bands = the classic cel-shaded look.
  const data = new Uint8Array([70, 150, 255]);
  const tex = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

function makeOutlineMaterial(width) {
  // Inverted hull: back faces pushed out along their (smoothed) normals and drawn flat dark.
  // `width` is in the mesh's own geometry units, so it is scaled per mesh to stay a constant screen width.
  const mat = new THREE.MeshBasicMaterial({ color: OUTLINE_COLOR, side: THREE.BackSide });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed += normalize(normal) * OUTLINE_W;')
      .replace(/^/, `#define OUTLINE_W ${width.toFixed(6)}\n`);
  };
  return mat;
}

// Hard-edged meshes have split normals, which tears the hull apart; smooth them on a private copy.
function makeOutlineGeometry(geometry) {
  const geo = geometry.clone();
  geo.morphAttributes = {};
  return toCreasedNormals(geo, Math.PI);
}

// How many world units one geometry unit ends up as (bone/node scale included).
function geometryToWorldScale(mesh) {
  const world = new THREE.Box3().setFromObject(mesh).getSize(new THREE.Vector3()).length();
  if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
  const local = mesh.geometry.boundingBox.getSize(new THREE.Vector3()).length();
  return local > 0 && world > 0 ? world / local : 1;
}

export class Dancer3D {
  constructor(container, { bpm = 120, clock = null, isPaused = () => false } = {}) {
    this.container = container;
    this.beatSec = 60 / bpm;
    this.clockFn = clock;
    this.isPaused = isPaused;
    this.t0 = performance.now();
    this.ready = false;
    this.destroyed = false;
    this.pending = null;
    this.state = { move: IDLE_MOVE, startBeat: 0 };
    this.actions = {};
    this.current = null;
    this.smooth = { x: 0, roll: 0, sy: 1 };
    this.fallback = null;
    this.kick = 0;
    this.flash = 0;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'dancer-canvas';
    container.prepend(this.canvas);

    this.scene = new THREE.Scene();
    const t = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    this.camY = (2 * FLOOR_FRAC - 1) * CAM_DIST * t;
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 50);
    this.camera.position.set(0, this.camY, CAM_DIST);
    this.camera.lookAt(0, this.camY, 0);

    this.buildLights();
    this.buildStage();

    // rig: yaw + travel + hop | tilt: roll/flip/squash around the body centre | model
    this.rig = new THREE.Group();
    this.tilt = new THREE.Group();
    this.tilt.position.y = CHARACTER_HEIGHT / 2;
    this.rig.add(this.tilt);
    this.scene.add(this.rig);

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();

    this.clock = new THREE.Clock();
    this.tick = this.tick.bind(this);
    this.raf = requestAnimationFrame(this.tick);

    this.loaded = new Promise((resolve, reject) => {
      new GLTFLoader().load(MODEL_URL, (gltf) => { this.onModel(gltf); resolve(); }, undefined, reject);
    });
    this.loaded.catch((err) => console.error('Dancer3D: model failed to load', err));
  }

  buildLights() {
    this.scene.add(new THREE.AmbientLight(0xb4b8ff, 0.9));
    const key = new THREE.DirectionalLight(0xfff1e0, 2.6);
    key.position.set(3, 5, 5);
    const rim = new THREE.DirectionalLight(0x7f9bff, 2.2);
    rim.position.set(-4, 3, -4);
    this.flashLight = new THREE.PointLight(0xffe08a, 0, 12);
    this.flashLight.position.set(0, 2.5, 3);
    this.scene.add(key, rim, this.flashLight);
  }

  buildStage() {
    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(1.8, 1.9, 0.14, 56),
      new THREE.MeshToonMaterial({ color: 0x3a2f80, gradientMap: makeGradientMap() })
    );
    platform.position.y = -0.07;
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0x73f0e7, transparent: true });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.72, 0.04, 8, 72), this.ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.005;

    this.beams = [];
    [[-1, 0xff739e], [1, 0x73f0e7]].forEach(([side, color]) => {
      const beam = new THREE.Mesh(
        new THREE.ConeGeometry(1.1, 6, 28, 1, true),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.09, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })
      );
      beam.position.set(side * 2.6, 3, -1.6);
      beam.userData.side = side;
      this.beams.push(beam);
      this.scene.add(beam);
    });
    this.scene.add(platform, ring);
  }

  onModel(gltf) {
    if (this.destroyed) return;
    const model = gltf.scene;
    const gradientMap = makeGradientMap();
    const meshes = [];
    model.traverse((o) => { if (o.isMesh) meshes.push(o); });

    for (const mesh of meshes) {
      const old = mesh.material;
      mesh.material = new THREE.MeshToonMaterial({
        color: old.color, map: old.map, vertexColors: old.vertexColors, gradientMap,
        emissive: old.emissive, emissiveMap: old.emissiveMap, emissiveIntensity: old.emissiveIntensity,
        transparent: old.transparent, opacity: old.opacity, alphaTest: old.alphaTest,
      });
      old.dispose?.();
    }

    // Normalise size and put the feet on the floor at the centre of the platform.
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const s = CHARACTER_HEIGHT / size.y;
    model.scale.multiplyScalar(s);
    box.setFromObject(model);
    const c = box.getCenter(new THREE.Vector3());
    model.position.x -= c.x;
    model.position.z -= c.z;
    model.position.y -= box.min.y + CHARACTER_HEIGHT / 2; // tilt group sits at body centre

    // Outlines: one inverted-hull copy per mesh, sharing the skeleton so it animates with the model.
    model.updateMatrixWorld(true);
    for (const mesh of meshes) {
      const material = makeOutlineMaterial(OUTLINE_WIDTH / geometryToWorldScale(mesh));
      const geometry = makeOutlineGeometry(mesh.geometry);
      const outline = mesh.isSkinnedMesh ? new THREE.SkinnedMesh(geometry, material) : new THREE.Mesh(geometry, material);
      if (mesh.isSkinnedMesh) outline.bind(mesh.skeleton, mesh.bindMatrix);
      outline.frustumCulled = false;
      mesh.frustumCulled = false;
      mesh.add(outline);
    }

    this.tilt.add(model);
    this.mixer = new THREE.AnimationMixer(model);
    for (const clip of gltf.animations) this.actions[clip.name] = this.mixer.clipAction(clip);
    // Characters with a single dance clip reuse it for every move; the T-pose reference clip is never played.
    this.fallback = this.actions[IDLE_CLIP] || Object.values(this.actions).find((a) => !/t-?pose/i.test(a.getClip().name));
    // Characters without an idle or a stumble clip get hand-authored ones (a stretch routine, a staggering stumble).
    // They run in real time rather than being fitted to the song's tempo.
    const extra = buildProceduralClips(model);
    for (const [name, clip] of [[IDLE_CLIP, extra.stretch], [STUMBLE_MOVE.clip, extra.stumble]]) {
      if (!clip || this.actions[name]) continue;
      this.actions[name] = this.mixer.clipAction(clip);
      this.actions[name].freeRun = true;
    }

    this.ready = true;
    this.play(IDLE_CLIP, true);
    if (this.pending) { this.startMove(this.pending); this.pending = null; }
  }

  // ---- public API ----------------------------------------------------------

  perform(moveName, judgment) {
    this.accent(judgment);
    this.startMove(moveFor(moveName));
  }

  // Stays in the stumble until the next perform() (i.e. the player lands a BAD or better).
  stumble() {
    if (this.state.move === STUMBLE_MOVE) return;
    this.startMove(STUMBLE_MOVE);
  }

  accent(judgment) {
    if (judgment === 'PERFECT') { this.kick = 1; this.flash = 1; }
    else if (judgment === 'GREAT') { this.kick = 0.6; this.flash = 0.6; }
    else if (judgment === 'COOL') { this.flash = 0.3; }
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.scene.traverse((o) => {
      o.geometry?.dispose?.();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => m?.dispose?.());
    });
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }

  // ---- internals -----------------------------------------------------------

  beatPos() {
    const ms = this.clockFn ? this.clockFn() : performance.now() - this.t0;
    return ms / 1000 / this.beatSec;
  }

  startMove(move) {
    if (!this.ready) { this.pending = move; return; }
    this.state = { move, startBeat: this.beatPos() };
    this.play(move.clip, !!move.stumble || move.clip === IDLE_CLIP);
  }

  // Fits the clip to the song: speed it up or slow it down so its steps land on the song's beats
  // (dropping to half-time when the song is much faster than the clip), then round its loop to a whole
  // number of beats so the loop point stays on the beat grid.
  play(clipName, slow = false) {
    const action = this.actions[clipName] || this.fallback;
    if (!action) return;
    const dur = action.getClip().duration;
    if (action.freeRun) {
      this.loopBeats = 0;
      if (action === this.current) return;
      action.reset();
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.timeScale = 1;
      if (this.current) action.crossFadeFrom(this.current, FADE, false);
      action.play();
      this.current = action;
      return;
    }
    let speed = (60 / this.beatSec) / CLIP_BPM;
    if (speed > 1.4) speed /= 2; else if (speed < 0.7) speed *= 2;
    if (slow) speed /= 2;
    this.loopBeats = Math.max(2, Math.round(dur / speed / this.beatSec / 2) * 2);
    action.timeScale = dur / (this.loopBeats * this.beatSec);
    if (action === this.current) return;
    action.reset();
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.timeScale = dur / (this.loopBeats * this.beatSec);
    if (this.current) action.crossFadeFrom(this.current, FADE, false);
    action.play();
    this.current = action;
  }

  // Keeps the clip's phase tied to the beat clock so it can't drift away from the music.
  lockPhase(dt) {
    const a = this.current;
    if (!a || !a.timeScale || a.freeRun) return;
    const phase = (((this.beatPos() / this.loopBeats) % 1) + 1) % 1;
    a.time = phase * a.getClip().duration - dt * a.timeScale; // mixer.update adds dt back
  }

  resize() {
    const w = Math.max(1, this.container.clientWidth);
    const h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  tick() {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.tick);
    const dt = Math.min(this.clock.getDelta(), 0.1);
    if (!this.isPaused()) {
      this.lockPhase(dt);
      this.mixer?.update(dt);
      this.applyMotion(dt);
      this.animateStage(dt);
    }
    this.renderer.render(this.scene, this.camera);
  }

  applyMotion(dt) {
    const beat = this.beatPos();
    const { move, startBeat } = this.state;
    const fx = move.fx;
    const t = Math.max(0, beat - startBeat);
    const beatAbs = Math.abs(Math.sin(beat * Math.PI));

    if (fx.freeze && this.current) this.current.timeScale = t >= 1 ? 0 : this.current.timeScale;

    const standing = move === IDLE_MOVE;
    let y = standing ? 0.008 * Math.sin(performance.now() * 0.002) : 0.03 * beatAbs; // breathing when waiting, groove when dancing
    let yaw = 0, pitch = 0, roll = 0, x = 0, pulse = 0;

    if (fx.bounce) y += fx.bounce * beatAbs;
    if (fx.hop) { const u = clamp01(t / 2); y += fx.hop * 4 * u * (1 - u); }
    if (fx.spin) yaw += fx.spin * Math.PI * 2 * easeInOut(clamp01(t / (fx.spinBeats || 2)));
    if (fx.flip) pitch -= fx.flip * Math.PI * 2 * easeInOut(clamp01(t / 2));
    if (fx.swing) yaw += fx.swing * Math.sin(Math.PI * t);
    if (fx.lean) roll += fx.lean * Math.sin(Math.PI * t);
    if (fx.sway) x += fx.sway * Math.sin((Math.PI * 2 * t) / (fx.swayBeats || 4));
    if (fx.pulse) pulse += fx.pulse * Math.pow(1 - (((beat % 1) + 1) % 1), 2);
    if (fx.shiver) {
      const env = 1 - (((beat % 1) + 1) % 1);
      x += fx.shiver * Math.sin(performance.now() * 0.09) * env;
      roll += fx.shiver * 2 * Math.sin(performance.now() * 0.13) * env;
    }
    if (fx.flip && t < 2) y += 0.25 * Math.sin(Math.PI * clamp01(t / 2));

    // Ease the sideways/roll/scale channels so switching moves never snaps; yaw stays exact.
    const k = 1 - Math.exp(-dt * 14);
    this.smooth.x += (x - this.smooth.x) * k;
    this.smooth.roll += (roll - this.smooth.roll) * k;
    this.smooth.sy += ((1 + pulse) - this.smooth.sy) * k;

    this.rig.position.set(this.smooth.x, y, 0);
    this.rig.rotation.y = yaw;
    this.tilt.rotation.set(pitch, 0, this.smooth.roll);
    const squash = 1 / Math.sqrt(this.smooth.sy);
    this.tilt.scale.set(squash, this.smooth.sy, squash);
  }

  animateStage(dt) {
    const beat = this.beatPos();
    this.kick = Math.max(0, this.kick - dt * 3.5);
    this.flash = Math.max(0, this.flash - dt * 3);
    this.camera.position.x = 0.18 * Math.sin((Math.PI * beat) / 4);
    this.camera.position.z = CAM_DIST - 0.45 * this.kick;
    this.camera.position.y = this.camY;
    this.camera.lookAt(0, this.camY, 0);
    this.flashLight.intensity = 14 * this.flash;
    this.ringMat.opacity = 0.55 + 0.45 * Math.pow(1 - (((beat % 1) + 1) % 1), 2);
    for (const beam of this.beams) {
      beam.rotation.z = -beam.userData.side * (0.42 + 0.12 * Math.sin((Math.PI * beat) / 2 + beam.userData.side));
    }
  }
}
