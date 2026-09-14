import * as THREE from "three";
import { plateauRect } from "./geo.js";
import { AXIS_YAW, SQUARE } from "./stanislas.js";

export function updateLife(city, dt, night, hour = 12) {
  if (city.wheel?.userData.spin) {
    city.wheel.userData.spin.rotation.z -= dt * 0.35;
    const cabins = city.wheel.userData.cabins || [];
    for (const cabin of cabins) cabin.rotation.z = -city.wheel.userData.spin.rotation.z;
  }

  if (city.canalCurve && city.barges) {
    for (const b of city.barges) {
      b.t = (b.t + dt * b.speed) % 1;
      const p = city.canalCurve.getPointAt(b.t);
      const look = city.canalCurve.getPointAt((b.t + 0.012) % 1);
      b.mesh.position.copy(p);
      b.mesh.lookAt(look);
    }
  }

  if (city.railCurve && city.trains) {
    for (const tr of city.trains) {
      tr.t += dt * tr.speed * tr.dir;
      if (tr.t > 0.98) {
        tr.t = 0.98;
        tr.dir = -1;
      }
      if (tr.t < 0.02) {
        tr.t = 0.02;
        tr.dir = 1;
      }
      const p = city.railCurve.getPointAt(tr.t);
      const lookT = THREE.MathUtils.clamp(tr.t + 0.012 * tr.dir, 0.001, 0.999);
      const look = city.railCurve.getPointAt(lookT);
      tr.mesh.position.copy(p);
      tr.mesh.lookAt(look);
    }
  }

  updateStars(city.stars, city.debris, night);
  updateRockets(city.rockets, dt, night);
  updateSatellites(city.satellites, dt, night, hour);
  updateFlyers(city.flyers, dt, night, hour);
  updateLoop(city.loop, dt, hour);
}

export function createSkyDome() {
  const geo = new THREE.SphereGeometry(2800, 32, 24);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uTop: { value: new THREE.Color("#9ec9e8") },
      uHorizon: { value: new THREE.Color("#dbeaf4") },
      uNight: { value: 0 },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform float uNight;
      varying vec3 vPos;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      float starLayer(vec2 uv, float scale, float thresh, float radius) {
        vec2 p = uv * scale;
        vec2 id = floor(p);
        vec2 f = fract(p) - 0.5;
        float rnd = hash(id);
        float disc = smoothstep(radius, 0.0, length(f));
        float bright = 0.45 + pow(rnd, 3.2) * 2.2;
        return step(thresh, rnd) * disc * bright;
      }

      float cluster(vec3 dir, vec3 c, float tight, float amp) {
        float d = 1.0 - max(dot(dir, normalize(c)), 0.0);
        return amp * exp(-d * d * tight);
      }

      void main() {
        vec3 dir = normalize(vPos);
        float h = clamp(dir.y * 0.5 + 0.5, 0.0, 1.0);
        float k = smoothstep(0.4, 0.66, h);
        vec3 col = mix(uHorizon, uTop, k);

        float n = uNight;
        float cl =
          cluster(dir, vec3(0.42, 0.62, -0.28), 28.0, 1.15) +
          cluster(dir, vec3(-0.55, 0.48, 0.52), 32.0, 1.05) +
          cluster(dir, vec3(0.12, -0.22, 0.92), 40.0, 0.9) +
          cluster(dir, vec3(-0.72, 0.18, -0.48), 30.0, 1.0) +
          cluster(dir, vec3(0.68, -0.38, 0.22), 36.0, 0.85) +
          cluster(dir, vec3(-0.18, 0.78, 0.38), 44.0, 0.8) +
          cluster(dir, vec3(0.33, -0.55, -0.62), 32.0, 0.95) +
          cluster(dir, vec3(-0.4, -0.7, 0.15), 38.0, 0.75) +
          cluster(dir, vec3(0.85, 0.12, -0.35), 42.0, 0.7);

        vec2 uv = vec2(atan(dir.z, dir.x) * 0.15915 + 0.5, acos(clamp(dir.y, -1.0, 1.0)) * 0.31831);
        float field = 0.38 + cl;
        float stars = 0.0;
        stars += starLayer(uv, 520.0, 1.0 - field * 0.28, 0.09);
        stars += starLayer(uv + 0.13, 780.0, 0.955, 0.07) * (0.7 + cl * 0.5);
        stars += starLayer(uv + 0.29, 1100.0, 0.968, 0.055) * (0.55 + cl);
        stars += starLayer(uv + 0.47, 340.0, 0.978, 0.11) * (0.5 + cl * 0.7);
        stars += starLayer(uv + 0.61, 1450.0, 0.972, 0.05) * 0.65;
        col += vec3(1.0, 0.97, 0.92) * stars * n * 1.65;

        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -20;
  mesh.frustumCulled = false;
  return mesh;
}

function makeDisc(radius, opacity, renderOrder) {
  const mat = new THREE.MeshBasicMaterial({
    color: "#ffffff",
    transparent: true,
    opacity,
    depthTest: true,
    depthWrite: false,
    fog: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(radius, 64), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = renderOrder;
  mesh.frustumCulled = false;
  return mesh;
}

function makeSkyOrb(radius) {
  const g = new THREE.Group();
  const halo = makeDisc(radius * 1.07, 0.14, -13);
  const core = makeDisc(radius, 1, -12);
  g.add(halo, core);
  g.userData.core = core;
  g.userData.halo = halo;
  g.renderOrder = -12;
  g.frustumCulled = false;
  return g;
}

function fillSphere(n, rMin, rMax, full = true) {
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = full ? Math.acos(2 * Math.random() - 1) : Math.acos(0.02 + Math.random() * 0.98);
    const r = rMin + Math.random() * (rMax - rMin);
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.cos(phi);
    pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    const w = 0.55 + Math.random() * 0.45;
    col[i * 3] = w;
    col[i * 3 + 1] = w * (0.9 + Math.random() * 0.1);
    col[i * 3 + 2] = w * (0.82 + Math.random() * 0.18);
  }
  return { pos, col };
}

/** Étoiles lointaines, petites, sphère complète (y compris sous le plan). */
export function createStars() {
  const n = 2200;
  const { pos, col } = fillSphere(n, 4300, 4900, true);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 1.1,
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthTest: true,
    depthWrite: false,
    sizeAttenuation: false,
    blending: THREE.AdditiveBlending,
    fog: false,
    toneMapped: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = -18;
  return points;
}

/** Coquille proche : débris / objets en orbite basse, pas des étoiles. */
export function createDebris() {
  const n = 2400;
  const { pos, col } = fillSphere(n, 3400, 4000, true);
  for (let i = 0; i < n; i++) {
    const g = 0.42 + Math.random() * 0.38;
    col[i * 3] = g;
    col[i * 3 + 1] = g * 0.96;
    col[i * 3 + 2] = g * 0.9;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 1.35,
    vertexColors: true,
    transparent: true,
    opacity: 0.2,
    depthTest: true,
    depthWrite: false,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = -16;
  return points;
}

function updateStars(stars, debris, night) {
  if (stars) {
    stars.material.opacity = THREE.MathUtils.clamp(night * 0.9, 0, 0.9);
    stars.visible = night > 0.08;
  }
  if (debris) {
    debris.material.opacity = 0.14 + THREE.MathUtils.clamp(night, 0, 1) * 0.55;
    debris.visible = true;
  }
}

/** Ciel + étoiles lointaines (suivent la caméra). Soleil / lune / débris restent au monde. */
export function createCelestial() {
  const group = new THREE.Group();
  group.name = "celestial";
  group.frustumCulled = false;
  const sky = createSkyDome();
  const debris = createDebris();
  group.add(sky, debris);

  const world = new THREE.Group();
  world.name = "horizon";
  const sun = makeSkyOrb(720);
  const moon = makeSkyOrb(680);
  world.add(sun, moon);

  return { group, world, sky, stars: null, sun, moon, debris };
}

export function applyCelestial(celestial, state) {
  if (!celestial) return;
  const plate = plateauRect();
  const az = state.az;
  const dist = Math.hypot(plate.w, plate.d) * 0.5 + 820;
  const y = 6;
  const dx = Math.cos(az) * dist;
  const dz = Math.sin(az) * dist;
  celestial.sun.position.set(plate.cx + dx, y, plate.cz + dz);
  celestial.moon.position.set(plate.cx - dx, y, plate.cz - dz);

  const sunAmt = THREE.MathUtils.clamp(1 - state.night * 1.35, 0, 1);
  const moonAmt = THREE.MathUtils.clamp(state.night * 1.2 - 0.08, 0, 1);
  celestial.sun.visible = sunAmt > 0.02;
  celestial.moon.visible = moonAmt > 0.02;
  celestial.sun.userData.core.material.opacity = sunAmt;
  celestial.moon.userData.core.material.opacity = moonAmt;

  const h = state.hour;
  let sunCol = "#fff6e4";
  if (h >= 5 && h < 8.2) sunCol = "#f4b4c8";
  else if (h >= 16.2 && h < 20.5) sunCol = "#ff4e2c";
  celestial.sun.userData.core.material.color.set(sunCol);
  if (celestial.sun.userData.halo) {
    celestial.sun.userData.halo.material.color.set(sunCol);
    celestial.sun.userData.halo.material.opacity = 0.1 + sunAmt * 0.06;
  }
  celestial.moon.userData.core.material.color.set("#fffaf2");
  if (celestial.moon.userData.halo) {
    celestial.moon.userData.halo.material.color.set("#fff6e4");
    celestial.moon.userData.halo.material.opacity = 0.1 + moonAmt * 0.06;
  }

  const u = celestial.sky.material.uniforms;
  u.uTop.value.copy(state.sky);
  u.uHorizon.value.copy(state.horizon);
  u.uNight.value = state.night;
  updateStars(celestial.stars, celestial.debris, state.night);
}

function makeRocketMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.7, 6.2, 8),
    new THREE.MeshStandardMaterial({ color: "#e8e2d6", metalness: 0.45, roughness: 0.35 })
  );
  body.position.y = 3.4;
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.72, 0.72, 0.35, 8),
    new THREE.MeshStandardMaterial({ color: "#E8284A", metalness: 0.2, roughness: 0.45 })
  );
  band.position.y = 4.2;
  const nose = new THREE.Mesh(
    new THREE.ConeGeometry(0.55, 1.8, 8),
    new THREE.MeshStandardMaterial({ color: "#E8284A", metalness: 0.25, roughness: 0.4 })
  );
  nose.position.y = 7.4;
  for (const ang of [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]) {
    const fin = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 1.6, 1.15),
      new THREE.MeshStandardMaterial({ color: "#c8c2b6", metalness: 0.3, roughness: 0.5 })
    );
    fin.position.set(Math.cos(ang) * 0.75, 1.2, Math.sin(ang) * 0.75);
    fin.rotation.y = -ang;
    g.add(fin);
  }
  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.42, 2.4, 6),
    new THREE.MeshBasicMaterial({ color: "#ffb060", transparent: true, opacity: 0 })
  );
  flame.rotation.x = Math.PI;
  flame.position.y = 0.15;
  g.add(body, band, nose, flame);
  g.userData.flame = flame;
  return g;
}

export function createRockets() {
  const group = new THREE.Group();
  const trailN = 80;
  const trailPos = new Float32Array(trailN * 3);
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPos, 3));
  const trail = new THREE.Points(
    trailGeo,
    new THREE.PointsMaterial({
      color: "#f0c878",
      size: 1.8,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  trail.frustumCulled = false;
  group.add(trail);
  const hw = SQUARE.width / 2 - 14;
  const hd = SQUARE.depth / 2 - 14;
  const c = Math.cos(AXIS_YAW);
  const s = Math.sin(AXIS_YAW);
  const pads = [];
  for (const [lx, lz] of [
    [-hw, -hd],
    [hw, -hd],
    [-hw, hd],
    [hw, hd],
  ]) {
    pads.push(new THREE.Vector3(lx * c + lz * s, 0.22, -lx * s + lz * c));
  }
  const waiting = [];
  for (const p of pads) {
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.4, 0.28, 10),
      new THREE.MeshStandardMaterial({ color: "#4a453c", metalness: 0.4, roughness: 0.55 })
    );
    pad.position.copy(p);
    pad.position.y = p.y + 0.14;
    group.add(pad);
    const mesh = makeRocketMesh();
    mesh.position.copy(p);
    group.add(mesh);
    waiting.push({ mesh, home: p.clone(), busy: false });
  }
  return {
    group,
    waiting,
    flying: [],
    trail,
    trailPos,
    trailN,
    acc: 0.4,
    origin: new THREE.Vector3(0, 0, 0),
  };
}

function launchRocket(sys) {
  const idle = sys.waiting.find((w) => !w.busy);
  const src = idle ? idle.home.clone() : sys.origin.clone();
  const mesh = makeRocketMesh();
  mesh.position.copy(src);
  sys.group.add(mesh);
  if (idle) {
    idle.busy = true;
    idle.mesh.visible = false;
  }
  sys.flying.push({
    mesh,
    pad: idle || null,
    vel: new THREE.Vector3((Math.random() - 0.5) * 4.2, 16 + Math.random() * 8, (Math.random() - 0.5) * 4.2),
    age: 0,
  });
}

function updateRockets(sys, dt, night) {
  if (!sys) return;
  const on = night > 0.5;
  if (!on) {
    for (const f of sys.flying) sys.group.remove(f.mesh);
    sys.flying.length = 0;
    sys.trail.material.opacity = 0;
    for (const w of sys.waiting) {
      w.busy = false;
      w.mesh.visible = true;
      w.mesh.position.copy(w.home);
      w.mesh.userData.flame.material.opacity = 0;
    }
    return;
  }
  for (const w of sys.waiting) w.mesh.visible = !w.busy;
  sys.acc += dt;
  if (sys.acc > 1.65 && sys.flying.length < 6) {
    sys.acc = Math.random() * 0.55;
    launchRocket(sys);
  }
  const tp = sys.trailPos;
  for (let i = sys.flying.length - 1; i >= 0; i--) {
    const r = sys.flying[i];
    r.age += dt;
    r.vel.y += 22 * dt;
    r.mesh.position.addScaledVector(r.vel, dt);
    r.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), r.vel.clone().normalize());
    r.mesh.userData.flame.material.opacity = 0.85;
    r.mesh.userData.flame.scale.setScalar(0.85 + Math.random() * 0.4);
    for (let k = tp.length - 1; k >= 3; k--) tp[k] = tp[k - 3];
    tp[0] = r.mesh.position.x;
    tp[1] = r.mesh.position.y;
    tp[2] = r.mesh.position.z;
    if (r.mesh.position.y > 420 || r.age > 18) {
      sys.group.remove(r.mesh);
      if (r.pad) {
        r.pad.busy = false;
        r.pad.mesh.visible = true;
        r.pad.mesh.userData.flame.material.opacity = 0;
      }
      sys.flying.splice(i, 1);
    }
  }
  sys.trail.geometry.attributes.position.needsUpdate = true;
  sys.trail.material.opacity = sys.flying.length ? 0.7 : 0;
}

export function createSatellites() {
  const group = new THREE.Group();
  const sats = [];
  for (let i = 0; i < 7; i++) {
    const bodyMat = new THREE.MeshStandardMaterial({
      color: "#2a2c32",
      metalness: 0.9,
      roughness: 0.28,
      emissive: "#fff2c8",
      emissiveIntensity: 0,
    });
    const wingMat = new THREE.MeshStandardMaterial({
      color: "#14181f",
      metalness: 0.82,
      roughness: 0.18,
      emissive: "#ffe9a8",
      emissiveIntensity: 0,
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(8.5, 2.2, 2.2), bodyMat);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.25, 6.5, 14), wingMat);
    const g = new THREE.Group();
    g.add(body, wing);
    const trailGeo = new THREE.BufferGeometry();
    const trailPos = new Float32Array(18);
    trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPos, 3));
    const trail = new THREE.Line(
      trailGeo,
      new THREE.LineBasicMaterial({ color: "#3a424c", transparent: true, opacity: 0.28 })
    );
    g.add(trail);
    group.add(g);
    sats.push({
      mesh: g,
      body,
      wing,
      trail,
      trailPos,
      yaw: Math.random() * Math.PI * 2,
      pitch: 0.22 + Math.random() * 0.35,
      speed: 0.045 + Math.random() * 0.035,
      radius: 240 + Math.random() * 220,
      t: Math.random() * Math.PI * 2,
      phase: Math.random() * Math.PI * 2,
    });
  }
  return { group, sats };
}

const _satQ = new THREE.Quaternion();
const _satAxis = new THREE.Vector3(0, 1, 0);
const _satP = new THREE.Vector3();
const _satN = new THREE.Vector3();
const _satSun = new THREE.Vector3();
const _satFwd = new THREE.Vector3();

function updateSatellites(satsys, dt, night, hour = 12) {
  if (!satsys) return;
  const on = night > 0.45;
  satsys.group.visible = on;
  if (!on) return;
  const az = (hour / 24) * Math.PI * 2 - Math.PI / 2;
  _satSun.set(Math.cos(az), 0.12, Math.sin(az)).normalize();
  for (const s of satsys.sats) {
    s.t += dt * s.speed;
    const x = Math.cos(s.t) * s.radius;
    const y = 180 + Math.sin(s.t * 0.7 + s.pitch) * 90 + s.radius * 0.12;
    const z = Math.sin(s.t) * s.radius * 0.85;
    _satQ.setFromAxisAngle(_satAxis, s.yaw);
    _satP.set(x, y, z).applyQuaternion(_satQ);
    s.mesh.position.copy(_satP);
    _satN.set(Math.cos(s.t + 0.08) * s.radius, y, Math.sin(s.t + 0.08) * s.radius * 0.85).applyQuaternion(_satQ);
    s.mesh.lookAt(_satN);
    _satFwd.subVectors(_satN, _satP).normalize();
    const flash = Math.pow(Math.max(0, _satFwd.dot(_satSun)), 28);
    const panel = Math.pow(Math.max(0, Math.abs(_satFwd.dot(_satSun)) * Math.sin(s.t * 3.1 + s.phase)), 10);
    if (s.body.material) s.body.material.emissiveIntensity = 0.015 + flash * 2.1;
    if (s.wing.material) s.wing.material.emissiveIntensity = 0.01 + panel * 2.6;
    const tp = s.trailPos;
    for (let k = 15; k >= 3; k--) {
      tp[k] = tp[k - 3];
    }
    tp[0] = _satP.x;
    tp[1] = _satP.y;
    tp[2] = _satP.z;
    s.trail.geometry.attributes.position.needsUpdate = true;
  }
}

function flyerPaint() {
  const hulls = ["#c8c2b6", "#d8d2c8", "#8a9098", "#2a2c30", "#e8e4dc"];
  return hulls[(Math.random() * hulls.length) | 0];
}

export function makeFlyer() {
  return makeVehicle("car");
}

const VEH = { hull: [], n: 0 };

function vehicleMats() {
  if (VEH.glass) return VEH;
  const hulls = ["#c8c2b6", "#d8d2c8", "#8a9098", "#2a2c30", "#e8e4dc"];
  VEH.hull = hulls.map((c) => new THREE.MeshLambertMaterial({ color: c }));
  VEH.glass = new THREE.MeshLambertMaterial({
    color: "#8ec4e8",
    transparent: true,
    opacity: 0.48,
  });
  VEH.glow = new THREE.MeshBasicMaterial({ color: "#ffe08a", transparent: true, opacity: 0.18 });
  VEH.head = new THREE.MeshBasicMaterial({ color: "#fff4c8", transparent: true, opacity: 0.14 });
  VEH.tail = new THREE.MeshBasicMaterial({ color: "#ff4a3a", transparent: true, opacity: 0.14 });
  return VEH;
}

function lamp(mat, w, h, d) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.userData.nightLamp = true;
  return mesh;
}

export function makeVehicle(kind = "car") {
  const M = vehicleMats();
  const g = new THREE.Group();
  const metal = M.hull[VEH.n++ % M.hull.length];
  const lamps = [];
  if (kind === "scooter") {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.28, 0.95), metal);
    const stem = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.35, 0.22), metal);
    stem.position.set(1.05, 0.75, 0);
    const glow = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.6), M.glow);
    glow.position.y = -0.28;
    const head = lamp(M.head, 0.18, 0.18, 0.18);
    head.position.set(1.55, 0.55, 0);
    const tail = lamp(M.tail, 0.16, 0.16, 0.16);
    tail.position.set(-1.5, 0.22, 0);
    g.add(deck, stem, glow, head, tail);
    lamps.push(glow, head, tail);
  } else if (kind === "pod") {
    const body = new THREE.Mesh(new THREE.SphereGeometry(1.45, 6, 5), metal);
    body.scale.set(1.2, 0.75, 1);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.72, 6, 4), M.glass);
    cap.position.y = 0.45;
    const glow = new THREE.Mesh(new THREE.CircleGeometry(1.0, 8), M.glow);
    glow.rotation.x = Math.PI / 2;
    glow.position.y = -0.7;
    const head = lamp(M.head, 0.28, 0.2, 0.22);
    head.position.set(1.5, 0.05, 0);
    const tail = lamp(M.tail, 0.24, 0.18, 0.2);
    tail.position.set(-1.45, 0.05, 0);
    g.add(body, cap, glow, head, tail);
    lamps.push(glow, head, tail);
  } else {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(7.6, 1.55, 3.1), metal);
    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(0.95, 6, 4, 0, Math.PI * 2, 0, Math.PI / 2),
      M.glass
    );
    canopy.position.set(0.7, 0.62, 0);
    const glow = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.14, 1.8), M.glow);
    glow.position.y = -0.78;
    const hl = lamp(M.head, 0.22, 0.22, 0.28);
    const hr = lamp(M.head, 0.22, 0.22, 0.28);
    hl.position.set(3.7, 0.15, 1.05);
    hr.position.set(3.7, 0.15, -1.05);
    const tl = lamp(M.tail, 0.2, 0.2, 0.22);
    const tr = lamp(M.tail, 0.2, 0.2, 0.22);
    tl.position.set(-3.7, 0.2, 1.05);
    tr.position.set(-3.7, 0.2, -1.05);
    g.add(hull, canopy, glow, hl, hr, tl, tr);
    lamps.push(glow, hl, hr, tl, tr);
  }
  g.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = false;
      o.receiveShadow = false;
    }
  });
  g.userData.nightLamps = lamps;
  return g;
}

function smoothstep(a, b, x) {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}

export function trafficLevel(hour) {
  const h = ((hour % 24) + 24) % 24;
  const day = smoothstep(7.1, 7.9, h) * (1 - smoothstep(20.2, 21.6, h));
  const rush = Math.max(
    smoothstep(7.5, 8.2, h) * (1 - smoothstep(9.4, 10.4, h)),
    smoothstep(16.5, 17.3, h) * (1 - smoothstep(18.9, 20.2, h))
  );
  return THREE.MathUtils.clamp(0.28 + day * 0.62 + rush * 0.18, 0.28, 1);
}

const _fp = new THREE.Vector3();
const _fl = new THREE.Vector3();
let flyerLit = -1;

export function updateFlyers(flyers, dt, night, hour) {
  if (!flyers?.length) return;
  const level = trafficLevel(hour);
  const lit = night > 0.22 ? 1 : 0;
  if (flyerLit !== lit) {
    flyerLit = lit;
    const M = vehicleMats();
    M.glow.opacity = lit ? 0.9 : 0.12;
    M.head.opacity = lit ? 0.95 : 0.12;
    M.tail.opacity = lit ? 0.95 : 0.12;
  }
  for (const f of flyers) {
    const on = level >= (f.threshold ?? 0.22);
    f.mesh.visible = on;
    if (!on || (!f.curve && !f.a)) continue;
    f.t = (f.t + dt * f.speed * (0.65 + level * 0.9)) % 1;
    if (f.a && f.b) {
      _fp.lerpVectors(f.a, f.b, f.t);
      _fl.lerpVectors(f.a, f.b, Math.min(0.999, f.t + 0.012));
    } else {
      f.curve.getPointAt(f.t, _fp);
      f.curve.getPointAt((f.t + 0.012) % 1, _fl);
    }
    _fp.y += Math.sin(f.t * Math.PI * 8 + f.bob) * 0.55;
    f.mesh.position.copy(_fp);
    f.mesh.lookAt(_fl);
  }
}

export function updateLoop(loop, dt, hour) {
  if (!loop?.cars?.length || !loop.curve) return;
  const level = trafficLevel(hour);
  const boost = 0.55 + level * 0.7;
  for (const car of loop.cars) {
    car.t = (car.t + dt * car.speed * boost) % 1;
    const p = loop.curve.getPointAt(car.t);
    const look = loop.curve.getPointAt((car.t + 0.012) % 1);
    car.mesh.position.copy(p);
    car.mesh.lookAt(look);
  }
}
