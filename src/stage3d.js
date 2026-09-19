import * as THREE from 'three';

// The 3D stage: lights, floor, platform, light towers, speakers, an equaliser wall and drifting sparkles.
// Everything is driven from one update(beat, dt, hit) call so it moves with the music.

const PINK = 0xff4f9a;
const CYAN = 0x4ff0e8;
const VIOLET = 0x8a5cff;
const FLOOR_Y = -0.26;
const LED_COUNT = 72;
const BAR_COUNT = 33;

const frac = (v) => ((v % 1) + 1) % 1;
const tmpColor = new THREE.Color();

function canvasTexture(size, draw, { repeat = null, colorSpace = THREE.SRGBColorSpace } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = colorSpace;
  tex.anisotropy = 8;
  if (repeat) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(repeat, repeat); }
  return tex;
}

// Top of the platform: rings, spokes and a star in glowing lines on deep violet.
function platformTexture() {
  return canvasTexture(1024, (g, s) => {
    const c = s / 2;
    const bg = g.createRadialGradient(c, c, 0, c, c, c);
    bg.addColorStop(0, '#5443c4'); bg.addColorStop(0.6, '#33279a'); bg.addColorStop(1, '#1f1666');
    g.fillStyle = bg; g.fillRect(0, 0, s, s);

    const ring = (r, color, w, dash = null) => {
      g.save(); g.strokeStyle = color; g.lineWidth = w; if (dash) g.setLineDash(dash);
      g.beginPath(); g.arc(c, c, r * c, 0, Math.PI * 2); g.stroke(); g.restore();
    };
    ring(0.97, '#4ff0e8', 10);
    ring(0.90, '#ff4f9a', 4, [26, 14]);
    ring(0.78, '#8a5cff', 6);
    ring(0.60, '#4ff0e8', 3, [4, 12]);
    ring(0.52, '#ff4f9a', 6);
    ring(0.26, '#4ff0e8', 8);

    // spokes between the inner and outer rings
    g.strokeStyle = 'rgba(160,130,255,0.55)'; g.lineWidth = 3;
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      const r0 = i % 2 ? 0.30 : 0.52, r1 = i % 2 ? 0.50 : 0.76;
      g.beginPath(); g.moveTo(c + Math.cos(a) * r0 * c, c + Math.sin(a) * r0 * c); g.lineTo(c + Math.cos(a) * r1 * c, c + Math.sin(a) * r1 * c); g.stroke();
    }
    // a ring of dots
    g.fillStyle = '#ffd166';
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      g.beginPath(); g.arc(c + Math.cos(a) * 0.69 * c, c + Math.sin(a) * 0.69 * c, 5, 0, Math.PI * 2); g.fill();
    }
    // centre star
    g.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 - Math.PI / 2, r = (i % 2 ? 0.10 : 0.23) * c;
      g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
    }
    g.closePath(); g.fillStyle = 'rgba(255,209,102,0.18)'; g.fill();
    g.strokeStyle = '#ffd166'; g.lineWidth = 4; g.stroke();
  });
}

// Faint glowing grid for the floor beyond the platform.
function gridTexture() {
  return canvasTexture(512, (g, s) => {
    g.fillStyle = '#100b30'; g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(138,92,255,0.55)'; g.lineWidth = 3;
    g.strokeRect(0, 0, s, s);
    g.strokeStyle = 'rgba(79,240,232,0.18)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(s / 2, 0); g.lineTo(s / 2, s); g.moveTo(0, s / 2); g.lineTo(s, s / 2); g.stroke();
  }, { repeat: 22 });
}

// Soft round fade to transparent, used to feather the floor's edge.
function radialFadeTexture() {
  return canvasTexture(256, (g, s) => {
    const grad = g.createRadialGradient(s / 2, s / 2, s * 0.18, s / 2, s / 2, s / 2);
    grad.addColorStop(0, '#fff'); grad.addColorStop(1, '#000');
    g.fillStyle = grad; g.fillRect(0, 0, s, s);
  }, { colorSpace: THREE.NoColorSpace });
}

function sparkleTexture() {
  return canvasTexture(64, (g, s) => {
    const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.25, 'rgba(255,255,255,0.55)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(s / 2, 4); g.lineTo(s / 2, s - 4); g.moveTo(4, s / 2); g.lineTo(s - 4, s / 2); g.stroke();
  });
}

// A soft-edged cone of light that fades out along its length. Its apex is at the origin and it points along +z,
// so Object3D.lookAt() aims it and scale.z stretches it to reach the target.
function makeBeam(color, length = 6, radius = 0.85) {
  const geo = new THREE.ConeGeometry(radius, length, 40, 1, true);
  geo.translate(0, -length / 2, 0);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0.5 }, uLength: { value: length } },
    vertexShader: `
      varying float vT; varying vec3 vN; varying vec3 vV; uniform float uLength;
      void main() {
        vT = position.z / uLength;
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying float vT; varying vec3 vN; varying vec3 vV; uniform vec3 uColor; uniform float uOpacity;
      void main() {
        float edge = pow(abs(dot(normalize(vN), normalize(vV))), 1.4);
        float fade = pow(clamp(1.0 - vT, 0.0, 1.0), 1.25);
        gl_FragColor = vec4(uColor, uOpacity * edge * fade);
      }`,
  });
  const beam = new THREE.Mesh(geo, mat);
  beam.frustumCulled = false;
  beam.userData.length = length;
  return beam;
}

export class Stage {
  constructor(scene, { gradientMap }) {
    this.scene = scene;
    this.time = 0;
    this.hit = 0;                       // decaying pulse from PERFECT/GREAT/COOL hits
    this.textures = [];
    this.buildLights();
    this.buildFloor();
    this.buildPlatform(gradientMap);
    this.buildWall();
    this.buildTowers(gradientMap);
    this.buildSpeakers(gradientMap);
    this.buildSparkles();
  }

  buildLights() {
    const s = this.scene;
    s.add(new THREE.AmbientLight(0x6a6fbf, 0.5));
    s.add(new THREE.HemisphereLight(0x8b7bff, 0x1a1240, 0.4));

    // key light: warm, from the front, and it casts her shadow onto the platform
    this.key = new THREE.SpotLight(0xfff0dd, 105, 0, 0.5, 0.75, 2);
    this.key.position.set(2.6, 6, 5.5);
    this.key.target.position.set(0, 0.9, 0);
    this.key.castShadow = true;
    this.key.shadow.mapSize.set(1024, 1024);
    this.key.shadow.bias = -0.0004;
    this.key.shadow.normalBias = 0.02;
    this.key.shadow.radius = 5;
    s.add(this.key, this.key.target);

    // coloured rims from behind so the edges of her silhouette pick up the stage colours
    const rimL = new THREE.DirectionalLight(PINK, 1.5); rimL.position.set(-4, 3, -4);
    const rimR = new THREE.DirectionalLight(CYAN, 1.4); rimR.position.set(4, 3, -4);
    s.add(rimL, rimR);

    // footlights along the front edge of the platform
    this.foot = new THREE.PointLight(VIOLET, 6, 5, 2);
    this.foot.position.set(0, 0.15, 2.3);
    s.add(this.foot);

    this.flashLight = new THREE.PointLight(0xffe08a, 0, 12);
    this.flashLight.position.set(0, 2.5, 3);
    s.add(this.flashLight);

    // two roaming coloured spotlights: they leave moving pools of light on the floor and platform
    this.movers = [
      { side: -1, color: PINK },
      { side: 1, color: CYAN },
    ].map(({ side, color }, i) => {
      const light = new THREE.SpotLight(color, 220, 0, 0.3, 0.85, 2);
      light.position.set(side * 3.3, 2.5, -1.4);
      const target = new THREE.Object3D();
      s.add(light, target);
      light.target = target;
      const beam = makeBeam(color, 6, 0.7);
      beam.position.copy(light.position);
      s.add(beam);
      return { light, target, beam, side, phase: i * Math.PI };
    });

    // two fixed, slowly swinging back lights for depth
    this.backBeams = [
      { color: VIOLET, x: -1.6, phase: 0 }, { color: 0xffd166, x: 1.6, phase: Math.PI },
    ].map(({ color, x, phase }) => {
      const beam = makeBeam(color, 6.5, 0.6);
      beam.position.set(x, 3.4, -3.2);
      beam.material.uniforms.uOpacity.value = 0.32;
      s.add(beam);
      return { beam, x, phase };
    });
  }

  buildFloor() {
    const grid = gridTexture();
    const fade = radialFadeTexture();
    this.textures.push(grid, fade);
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(14, 64),
      new THREE.MeshStandardMaterial({ map: grid, color: 0x9a8cff, roughness: 0.32, metalness: 0.35, transparent: true, alphaMap: fade })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = FLOOR_Y;
    floor.receiveShadow = true;
    this.scene.add(floor);
  }

  buildPlatform(gradientMap) {
    const top = platformTexture();
    this.textures.push(top);
    const side = new THREE.MeshToonMaterial({ color: 0x2c2280, gradientMap });
    const topMat = new THREE.MeshStandardMaterial({ map: top, emissiveMap: top, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.28, metalness: 0.25 });
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 1.95, 0.14, 72), [side, topMat, side]);
    upper.position.y = -0.07;
    upper.receiveShadow = true;

    const lower = new THREE.Mesh(
      new THREE.CylinderGeometry(2.15, 2.25, 0.12, 72),
      new THREE.MeshToonMaterial({ color: 0x1f1858, gradientMap })
    );
    lower.position.y = -0.2;
    lower.receiveShadow = true;

    this.ringMat = new THREE.MeshBasicMaterial({ color: CYAN, transparent: true });
    const lowerRing = new THREE.Mesh(new THREE.TorusGeometry(2.12, 0.03, 8, 96), this.ringMat);
    lowerRing.rotation.x = Math.PI / 2;
    lowerRing.position.y = -0.135;
    this.scene.add(upper, lower, lowerRing);

    // LED strip round the rim of the platform: a ring of little lights that chase round on the beat
    this.led = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.05, 0.07), new THREE.MeshBasicMaterial(), LED_COUNT);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < LED_COUNT; i++) {
      const a = (i / LED_COUNT) * Math.PI * 2;
      p.set(Math.cos(a) * 1.93, 0.012, Math.sin(a) * 1.93);
      q.setFromEuler(new THREE.Euler(0, -a + Math.PI / 2, 0));
      this.led.setMatrixAt(i, m.compose(p, q, one));
      this.led.setColorAt(i, tmpColor.set(CYAN));
    }
    this.scene.add(this.led);
  }

  // A curved wall of LED bars behind her that jumps with the beat like an equaliser.
  buildWall() {
    const geo = new THREE.BoxGeometry(0.3, 1, 0.1);
    geo.translate(0, 0.5, 0);
    this.bars = [0, 1].map((row) => {
      const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial(), BAR_COUNT);
      mesh.frustumCulled = false;
      mesh.userData = { row, radius: row ? 6.4 : 4.7 };
      this.scene.add(mesh);
      return mesh;
    });
    this._barM = new THREE.Matrix4(); this._barQ = new THREE.Quaternion(); this._barP = new THREE.Vector3(); this._barS = new THREE.Vector3();
  }

  // Lighting towers either side, each with a fixture head that the roaming beams shine from.
  buildTowers(gradientMap) {
    const metal = new THREE.MeshStandardMaterial({ color: 0x2a2450, roughness: 0.5, metalness: 0.7 });
    const glow = new THREE.MeshBasicMaterial({ color: VIOLET });
    for (const side of [-1, 1]) {
      const g = new THREE.Group();
      g.position.set(side * 3.3, FLOOR_Y, -1.4);
      const mast = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.9, 0.16), metal); mast.position.y = 1.45;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 0.14, 20), metal); base.position.y = 0.07;
      const cross = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.06), metal); cross.position.y = 2.6;
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 2.5, 0.03), glow); strip.position.set(0.1 * side, 1.4, 0.08);
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.1, 0.3, 16), metal);
      head.position.set(0, 2.76, 0);
      head.rotation.z = side * 0.9;
      g.add(mast, base, cross, strip, head);
      this.scene.add(g);
    }
  }

  buildSpeakers(gradientMap) {
    const cab = new THREE.MeshToonMaterial({ color: 0x17123f, gradientMap });
    const cone = new THREE.MeshToonMaterial({ color: 0x0c0928, gradientMap });
    this.woofers = [];
    this.wooferMat = new THREE.MeshBasicMaterial({ color: CYAN });
    for (const side of [-1, 1]) {
      const g = new THREE.Group();
      g.position.set(side * 3.05, FLOOR_Y, -0.9);
      g.rotation.y = -side * 0.4;
      g.scale.setScalar(0.85);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.55, 0.6), cab); body.position.y = 0.775;
      g.add(body);
      for (const [y, r] of [[1.15, 0.2], [0.5, 0.29]]) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.92, 0.06, 28), cone);
        w.rotation.x = Math.PI / 2; w.position.set(0, y, 0.31);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(r + 0.02, 0.018, 8, 32), this.wooferMat);
        rim.position.set(0, y, 0.335);
        g.add(w, rim);
        this.woofers.push(w, rim);
      }
      this.scene.add(g);
    }
  }

  buildSparkles(count = 140) {
    this.sparkleCount = count;
    const pos = new Float32Array(count * 3), col = new Float32Array(count * 3);
    this.sparkleSeed = new Float32Array(count * 2); // speed, phase
    const palette = [PINK, CYAN, 0xffffff, 0xffd166];
    for (let i = 0; i < count; i++) {
      pos.set([(Math.random() - 0.5) * 9, FLOOR_Y + Math.random() * 3.6, -3 + Math.random() * 5], i * 3);
      tmpColor.set(palette[i % palette.length]).toArray(col, i * 3);
      this.sparkleSeed[i * 2] = 0.12 + Math.random() * 0.3;
      this.sparkleSeed[i * 2 + 1] = Math.random() * 6.28;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.sparkleBase = col.slice();
    const map = sparkleTexture();
    this.textures.push(map);
    this.sparkles = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.16, map, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
    }));
    this.sparkles.frustumCulled = false;
    this.scene.add(this.sparkles);
  }

  // Called when the player lands a hit: 1 for PERFECT, less for lower judgments.
  accent(level) { this.hit = Math.max(this.hit, level); }

  update(beat, dt, flash = 0) {
    this.time += dt;
    this.hit = Math.max(0, this.hit - dt * 2.4);
    const f = frac(beat);
    const thump = Math.pow(1 - f, 2.2);        // sharp on the beat, then falls away
    const energy = 0.55 + 0.45 * thump + this.hit;

    // key light and flash
    this.key.intensity = 105 + 45 * this.hit;
    this.flashLight.intensity = 14 * flash;
    this.foot.intensity = 5 + 6 * thump + 8 * this.hit;

    // roaming spots sweep round the platform; the beams follow and stretch to the floor
    for (const m of this.movers) {
      const a = beat * 0.5 * m.side + m.phase;
      m.target.position.set(Math.cos(a) * 1.5, 0, Math.sin(a) * 1.2 - 0.1);
      m.light.intensity = 200 + 90 * thump + 160 * this.hit;
      m.beam.lookAt(m.target.position);
      m.beam.scale.z = m.beam.position.distanceTo(m.target.position) / m.beam.userData.length;
      m.beam.material.uniforms.uOpacity.value = 0.42 + 0.3 * thump + 0.4 * this.hit;
    }
    for (const b of this.backBeams) {
      const sway = Math.sin(beat * 0.5 + b.phase) * 1.4;
      b.beam.lookAt(b.x + sway, FLOOR_Y, 0.3);
      b.beam.scale.z = b.beam.position.distanceTo(new THREE.Vector3(b.x + sway, FLOOR_Y, 0.3)) / b.beam.userData.length;
      b.beam.material.uniforms.uOpacity.value = 0.24 + 0.16 * thump + 0.25 * this.hit;
    }

    // rings and LED strip
    this.ringMat.opacity = 0.5 + 0.5 * thump;
    for (let i = 0; i < LED_COUNT; i++) {
      const k = frac(i / LED_COUNT - beat * 0.25);
      const chase = Math.pow(1 - k, 4);
      const c = tmpColor.setHSL(0.5 + 0.45 * (0.5 + 0.5 * Math.sin(i / LED_COUNT * 6.28 * 2 + this.time * 0.6)), 0.85, 0.2 + 0.32 * chase + 0.3 * this.hit);
      this.led.setColorAt(i, c);
    }
    this.led.instanceColor.needsUpdate = true;

    // equaliser wall
    for (const mesh of this.bars) {
      const { row, radius } = mesh.userData;
      for (let i = 0; i < BAR_COUNT; i++) {
        const a = ((i / (BAR_COUNT - 1)) - 0.5) * Math.PI * 1.25;
        const wave = 0.5 + 0.5 * Math.sin(beat * Math.PI * (row ? 0.5 : 1) + i * (row ? 0.42 : 0.7));
        const h = (row ? 0.7 : 0.6) + wave * (row ? 1.3 : 1.7) * (0.5 + 0.5 * thump) + this.hit * 0.9 + 0.25 * Math.sin(i * 1.9 + this.time * 2.2);
        this._barP.set(Math.sin(a) * radius, FLOOR_Y, -Math.cos(a) * radius + 0.4);
        this._barQ.setFromEuler(new THREE.Euler(0, -a, 0));
        this._barS.set(row ? 1.25 : 1, Math.max(0.2, h), 1);
        mesh.setMatrixAt(i, this._barM.compose(this._barP, this._barQ, this._barS));
        const hue = frac(0.93 - (i / (BAR_COUNT - 1)) * 0.5 + (row ? 0.04 : 0));
        mesh.setColorAt(i, tmpColor.setHSL(hue, 0.9, (row ? 0.16 : 0.3) + 0.22 * energy * (0.4 + wave * 0.6)));
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
    }

    // speaker woofers pump
    const pump = 1 + 0.1 * thump + 0.12 * this.hit;
    for (const w of this.woofers) w.scale.set(pump, w.scale.y, pump);
    this.wooferMat.color.setHex(this.hit > 0.3 ? 0xffd166 : CYAN);

    // sparkles drift up, wrap round and twinkle
    const pos = this.sparkles.geometry.attributes.position, col = this.sparkles.geometry.attributes.color;
    for (let i = 0; i < this.sparkleCount; i++) {
      let y = pos.getY(i) + this.sparkleSeed[i * 2] * dt;
      if (y > FLOOR_Y + 3.8) y = FLOOR_Y;
      pos.setY(i, y);
      const tw = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(this.time * 2.2 + this.sparkleSeed[i * 2 + 1]));
      for (let k = 0; k < 3; k++) col.array[i * 3 + k] = this.sparkleBase[i * 3 + k] * tw;
    }
    pos.needsUpdate = true; col.needsUpdate = true;
  }

  dispose() {
    for (const t of this.textures) t.dispose();
  }
}
