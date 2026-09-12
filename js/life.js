import * as THREE from "three";
import { toXZ } from "./geo.js";

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

  updateStars(city.stars, night);
  updateRockets(city.rockets, dt, night);
  updateSatellites(city.satellites, dt, night);
  updateFlyers(city.flyers, dt, night, hour);
  updateLoop(city.loop, dt, hour);
}

export function createSkyDome() {
  const geo = new THREE.SphereGeometry(2800, 32, 20);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTop: { value: new THREE.Color("#9ec9e8") },
      uHorizon: { value: new THREE.Color("#dbeaf4") },
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
      varying vec3 vPos;
      void main() {
        float h = clamp(vPos.y / 2800.0 * 0.5 + 0.5, 0.0, 1.0);
        float k = smoothstep(0.4, 0.66, h);
        vec3 col = mix(uHorizon, uTop, k);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  return new THREE.Mesh(geo, mat);
}

export function createStars() {
  const n = 2800;
  const pos = new Float32Array(n * 3);
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(0.02 + Math.random() * 0.98);
    const r = 1260;
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.cos(phi);
    pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    const w = 0.75 + Math.random() * 0.25;
    col[i * 3] = w;
    col[i * 3 + 1] = w * (0.92 + Math.random() * 0.08);
    col[i * 3 + 2] = w * (0.85 + Math.random() * 0.2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 3.2,
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return points;
}

function updateStars(stars, night) {
  if (!stars) return;
  stars.material.opacity = THREE.MathUtils.clamp(night * 1.15, 0, 1);
  stars.visible = night > 0.12;
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
  const pads = [
    new THREE.Vector3(-14, 0, 10),
    new THREE.Vector3(16, 0, -8),
    new THREE.Vector3(8, 0, 18),
    new THREE.Vector3(-22, 0, -6),
  ];
  for (const [lon, lat, y] of [
    [6.18335, 48.69238, 110],
    [6.17315, 48.68925, 120],
    [6.1947, 48.69325, 104],
    [6.18235, 48.69555, 1],
  ]) {
    const p = toXZ(lon, lat);
    pads.push(new THREE.Vector3(p.x, y, p.z));
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
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(8.5, 2.2, 2.2),
      new THREE.MeshBasicMaterial({ color: "#f2f6ff" })
    );
    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 6.5, 14),
      new THREE.MeshBasicMaterial({ color: "#8ec0e8" })
    );
    const g = new THREE.Group();
    g.add(body, wing);
    const trailGeo = new THREE.BufferGeometry();
    const trailPos = new Float32Array(18);
    trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPos, 3));
    const trail = new THREE.Line(
      trailGeo,
      new THREE.LineBasicMaterial({ color: "#c8e4ff", transparent: true, opacity: 0.7 })
    );
    g.add(trail);
    group.add(g);
    sats.push({
      mesh: g,
      trail,
      trailPos,
      yaw: Math.random() * Math.PI * 2,
      pitch: 0.22 + Math.random() * 0.35,
      speed: 0.045 + Math.random() * 0.035,
      radius: 240 + Math.random() * 220,
      t: Math.random() * Math.PI * 2,
    });
  }
  return { group, sats };
}

function updateSatellites(satsys, dt, night) {
  if (!satsys) return;
  const on = night > 0.45;
  satsys.group.visible = on;
  if (!on) return;
  for (const s of satsys.sats) {
    s.t += dt * s.speed;
    const x = Math.cos(s.t) * s.radius;
    const y = 180 + Math.sin(s.t * 0.7 + s.pitch) * 90 + s.radius * 0.12;
    const z = Math.sin(s.t) * s.radius * 0.85;
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), s.yaw);
    const p = new THREE.Vector3(x, y, z).applyQuaternion(q);
    s.mesh.position.copy(p);
    const next = new THREE.Vector3(
      Math.cos(s.t + 0.08) * s.radius,
      y,
      Math.sin(s.t + 0.08) * s.radius * 0.85
    ).applyQuaternion(q);
    s.mesh.lookAt(next);
    const tp = s.trailPos;
    for (let k = 15; k >= 3; k--) {
      tp[k] = tp[k - 3];
    }
    tp[0] = p.x;
    tp[1] = p.y;
    tp[2] = p.z;
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

function lamp(color, w, h, d) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.15 })
  );
  mesh.userData.nightLamp = true;
  return mesh;
}

export function makeVehicle(kind = "car") {
  const g = new THREE.Group();
  const hullC = flyerPaint();
  const glass = new THREE.MeshStandardMaterial({
    color: "#8ec4e8",
    transparent: true,
    opacity: 0.5,
    metalness: 0.2,
    roughness: 0.15,
    emissive: new THREE.Color("#c8e8ff"),
    emissiveIntensity: 0,
  });
  const metal = new THREE.MeshStandardMaterial({
    color: hullC,
    metalness: 0.55,
    roughness: 0.28,
    emissive: new THREE.Color("#3a2a18"),
    emissiveIntensity: 0,
  });
  const lamps = [];
  if (kind === "scooter") {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.28, 0.95), metal);
    const stem = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.35, 0.22), metal);
    stem.position.set(1.05, 0.75, 0);
    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.12, 0.6),
      new THREE.MeshBasicMaterial({ color: "#ffe08a", transparent: true, opacity: 0.2 })
    );
    glow.position.y = -0.28;
    glow.userData.nightLamp = true;
    const head = lamp("#fff4c8", 0.18, 0.18, 0.18);
    head.position.set(1.55, 0.55, 0);
    const tail = lamp("#ff4a3a", 0.16, 0.16, 0.16);
    tail.position.set(-1.5, 0.22, 0);
    g.add(deck, stem, glow, head, tail);
    lamps.push(glow, head, tail);
  } else if (kind === "pod") {
    const body = new THREE.Mesh(new THREE.SphereGeometry(1.45, 8, 6), metal);
    body.scale.set(1.2, 0.75, 1);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.72, 8, 5), glass);
    cap.position.y = 0.45;
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(1.0, 8),
      new THREE.MeshBasicMaterial({ color: "#ffe08a", side: THREE.DoubleSide, transparent: true, opacity: 0.2 })
    );
    glow.rotation.x = Math.PI / 2;
    glow.position.y = -0.7;
    glow.userData.nightLamp = true;
    const head = lamp("#fff4c8", 0.28, 0.2, 0.22);
    head.position.set(1.5, 0.05, 0);
    const tail = lamp("#ff3a32", 0.24, 0.18, 0.2);
    tail.position.set(-1.45, 0.05, 0);
    g.add(body, cap, glow, head, tail);
    lamps.push(glow, head, tail);
  } else {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(7.6, 1.55, 3.1), metal);
    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(0.95, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2),
      glass
    );
    canopy.position.set(0.7, 0.62, 0);
    const glow = new THREE.Mesh(
      new THREE.BoxGeometry(5.2, 0.14, 1.8),
      new THREE.MeshBasicMaterial({ color: "#ffe08a", transparent: true, opacity: 0.2 })
    );
    glow.position.y = -0.78;
    glow.userData.nightLamp = true;
    const hl = lamp("#fff6d0", 0.22, 0.22, 0.28);
    const hr = lamp("#fff6d0", 0.22, 0.22, 0.28);
    hl.position.set(3.7, 0.15, 1.05);
    hr.position.set(3.7, 0.15, -1.05);
    const tl = lamp("#ff2e28", 0.2, 0.2, 0.22);
    const tr = lamp("#ff2e28", 0.2, 0.2, 0.22);
    tl.position.set(-3.7, 0.2, 1.05);
    tr.position.set(-3.7, 0.2, -1.05);
    g.add(hull, canopy, glow, hl, hr, tl, tr);
    lamps.push(glow, hl, hr, tl, tr);
  }
  g.userData.nightLamps = lamps;
  g.userData.hull = metal;
  g.userData.glass = glass;
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

export function updateFlyers(flyers, dt, night, hour) {
  if (!flyers?.length) return;
  const level = trafficLevel(hour);
  const lit = night > 0.22;
  for (const f of flyers) {
    const on = level >= (f.threshold ?? 0.22);
    f.mesh.visible = on;
    if (f.mesh.userData.hull) f.mesh.userData.hull.emissiveIntensity = lit ? 0.22 : 0;
    if (f.mesh.userData.glass) f.mesh.userData.glass.emissiveIntensity = lit ? 0.55 : 0;
    for (const lamp of f.mesh.userData.nightLamps || []) {
      lamp.visible = on;
      if (lamp.material) lamp.material.opacity = lit ? 0.95 : 0.12;
    }
    if (!on || !f.curve) continue;
    f.t = (f.t + dt * f.speed * (0.65 + level * 0.9)) % 1;
    const p = f.curve.getPointAt(f.t);
    const look = f.curve.getPointAt((f.t + 0.012) % 1);
    p.y += Math.sin(f.t * Math.PI * 8 + f.bob) * 0.55;
    f.mesh.position.copy(p);
    f.mesh.lookAt(look);
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
