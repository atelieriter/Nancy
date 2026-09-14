import * as THREE from "three";
import { toXZ } from "./geo.js";
import { PALETTE, facadeMaterial, roofMaterial, goldMaterial, boxRoofGeometry } from "./materials.js";

/** Rectangle classique : 106 m × 124 m. Axe Héré : mairie → arche → Carrière. */
export const SQUARE = { width: 106, depth: 124 };
/** Rotation Y pour aligner le −Z local sur l’Arc Héré / Place de la Carrière. */
export const AXIS_YAW = Math.atan2(33.8, 89.1);

export function inStanislasCore(lon, lat) {
  const { x, z } = toXZ(lon, lat);
  const c = Math.cos(-AXIS_YAW);
  const s = Math.sin(-AXIS_YAW);
  const lx = x * c + z * s;
  const lz = -x * s + z * c;
  const onPlaza = lx > -54 && lx < 54 && lz > -64 && lz < 64;
  const onMairie = lx > -52 && lx < 52 && lz > 64 && lz < 88;
  const onOpera = lx > 54 && lx < 78 && lz > -48 && lz < 26;
  const onMusee = lx > -78 && lx < -54 && lz > -48 && lz < 26;
  const onNorth = lx > -54 && lx < 54 && lz > -88 && lz < -64;
  const sw = lx > -96 && lx < -48 && lz > 28 && lz < 74;
  const se = lx > 48 && lx < 96 && lz > 28 && lz < 74;
  return onPlaza || onMairie || onOpera || onMusee || onNorth || sw || se;
}

export function inPalaisFootprint(lon, lat) {
  const { x, z } = toXZ(lon, lat);
  return x > -190 && x < -125 && z > -410 && z < -345;
}

function stone(nightUniform, hex, rough = 0.62) {
  return facadeMaterial(new THREE.Color(hex), nightUniform, { roughness: rough, warm: 1.05 });
}

export function makeLampPost(nightUniform, opts = {}) {
  const g = new THREE.Group();
  const iron = new THREE.MeshStandardMaterial({
    color: "#2a241c",
    metalness: 0.45,
    roughness: 0.42,
  });
  const gold = goldMaterial(nightUniform);
  gold.emissiveIntensity = 0.04;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.16, 5.4, 8), gold);
  pole.position.y = 2.7;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.45, 8), iron);
  base.position.y = 0.22;
  const arm = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.05, 5, 10, Math.PI), gold);
  arm.rotation.z = Math.PI;
  arm.position.set(0, 5.35, 0);
  const lantern = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.7, 0.42),
    new THREE.MeshStandardMaterial({
      color: "#f3e2b0",
      emissive: "#ffe7b0",
      emissiveIntensity: 0.25,
      transparent: true,
      opacity: 0.94,
    })
  );
  lantern.position.y = 5.85;
  lantern.userData.illuminate = "lamp";
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.28, 4), gold);
  hat.position.y = 6.32;
  hat.rotation.y = Math.PI / 4;
  const pool = new THREE.Mesh(
    new THREE.CircleGeometry(7.6, 22),
    new THREE.MeshBasicMaterial({
      color: "#ffe08a",
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
  );
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.2;
  pool.userData.illuminate = "lamp-ground";
  g.add(pole, base, arm, lantern, hat, pool);

  if (opts.withLight !== false) {
    const light = new THREE.PointLight("#ffe7b4", 0, 26, 1.55);
    light.position.y = 5.7;
    g.add(light);
    g.userData.light = light;
  }
  g.userData.globe = lantern;
  return g;
}

function placeLamp(parent, lights, nightUniform, x, z) {
  const lamp = makeLampPost(nightUniform);
  lamp.position.set(x, 0, z);
  parent.add(lamp);
  lights.push(lamp.userData.light);
}

function makePediment(w, d, nightUniform) {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(w / 2, 0);
  shape.lineTo(0, 4.2);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false, steps: 1 });
  geo.translate(0, 0, -d / 2);
  return new THREE.Mesh(geo, stone(nightUniform, "#efe3cf", 0.5));
}

function addBalustrade(parent, width, z, y, nightUniform) {
  const mat = stone(nightUniform, "#efe6d4", 0.55);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(width, 0.22, 0.32), mat);
  rail.position.set(0, y, z);
  parent.add(rail);
  const n = Math.max(8, Math.round(width / 2.4));
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.85, 0.18), mat);
    post.position.set(-width / 2 + t * width, y - 0.5, z);
    parent.add(post);
  }
}

/** Hôtel de Ville : façade classique 98 m, fronton + horloge, pas de beffroi. */
function makeMairie(nightUniform) {
  const g = new THREE.Group();
  const bodyMat = stone(nightUniform, "#eee4d4", 0.58);
  const rustMat = stone(nightUniform, "#dccab0", 0.7);
  const body = new THREE.Mesh(new THREE.BoxGeometry(98, 16.8, 20), bodyMat);
  body.position.y = 8.4;
  body.castShadow = true;
  const rust = new THREE.Mesh(new THREE.BoxGeometry(98.4, 4.8, 20.6), rustMat);
  rust.position.y = 2.4;
  const avant = new THREE.Mesh(new THREE.BoxGeometry(22, 18.5, 5.5), bodyMat);
  avant.position.set(0, 10.2, -10.2);
  const wings = [];
  for (const dx of [-46, 46]) {
    const w = new THREE.Mesh(new THREE.BoxGeometry(8, 17.2, 22), bodyMat);
    w.position.set(dx, 9.5, 0);
    wings.push(w);
  }
  const roof = new THREE.Mesh(boxRoofGeometry(98, 20, 16.85, 3.4), roofMaterial(PALETTE.roofSlate));
  roof.castShadow = true;
  const ped = makePediment(20, 2.2, nightUniform);
  ped.position.set(0, 18.6, -12.2);
  const clock = new THREE.Mesh(
    new THREE.CircleGeometry(1.05, 20),
    new THREE.MeshStandardMaterial({ color: "#f4efe4", roughness: 0.35 })
  );
  clock.position.set(0, 20.4, -13.4);
  clock.rotation.y = Math.PI;
  const gold = goldMaterial(nightUniform);
  gold.emissiveIntensity = 0.06;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.12, 0.06, 6, 20), gold);
  ring.position.copy(clock.position);
  addBalustrade(g, 96, -10.2, 18.55, nightUniform);
  addBalustrade(g, 96, 10.2, 18.55, nightUniform);
  for (const dx of [-12, 12]) {
    const col = new THREE.Mesh(new THREE.BoxGeometry(0.7, 11.5, 0.7), stone(nightUniform, "#f0e6d2", 0.48));
    col.position.set(dx / 2, 11.2, -12.4);
    g.add(col);
  }
  g.add(body, rust, avant, ...wings, roof, ped, clock, ring);
  g.position.set(0, 0, SQUARE.depth / 2 + 10);
  return g;
}

function makePalaceRange(nightUniform, w, d, h) {
  const g = new THREE.Group();
  // Corps sans plateau supérieur : le toit se raccorde bord à bord
  const shape = new THREE.Shape([
    new THREE.Vector2(-w / 2, -d / 2),
    new THREE.Vector2(w / 2, -d / 2),
    new THREE.Vector2(w / 2, d / 2),
    new THREE.Vector2(-w / 2, d / 2),
  ]);
  const bodyGeo = new THREE.ExtrudeGeometry(shape, {
    depth: h,
    bevelEnabled: false,
    steps: 1,
  });
  bodyGeo.rotateX(-Math.PI / 2);
  // Enlever le dessus
  {
    const pos = bodyGeo.getAttribute("position");
    const src = bodyGeo.index;
    const keep = [];
    const yCut = h - 0.03;
    const faceCount = src ? src.count / 3 : pos.count / 3;
    for (let f = 0; f < faceCount; f++) {
      const i0 = src ? src.getX(f * 3) : f * 3;
      const i1 = src ? src.getX(f * 3 + 1) : f * 3 + 1;
      const i2 = src ? src.getX(f * 3 + 2) : f * 3 + 2;
      if (pos.getY(i0) >= yCut && pos.getY(i1) >= yCut && pos.getY(i2) >= yCut) continue;
      keep.push(i0, i1, i2);
    }
    bodyGeo.setIndex(keep);
    bodyGeo.computeVertexNormals();
  }
  const body = new THREE.Mesh(bodyGeo, stone(nightUniform, "#eee4d4", 0.6));
  body.castShadow = true;
  const rust = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.35, 3.6, d + 0.35),
    stone(nightUniform, "#dccab0", 0.72)
  );
  rust.position.y = 1.8;
  const peak = Math.min(w, d) * 0.18;
  const roof = new THREE.Mesh(boxRoofGeometry(w, d, h, peak), roofMaterial(PALETTE.roofSlate));
  roof.castShadow = true;
  addBalustrade(g, Math.max(w, d) - 2, d >= w ? -d / 2 + 0.15 : 0, h + 0.12, nightUniform);
  g.add(body, rust, roof);
  return g;
}

function makeArcHere(nightUniform) {
  const g = new THREE.Group();
  const mat = stone(nightUniform, "#eee3cd", 0.5);
  const gold = goldMaterial(nightUniform);
  gold.emissiveIntensity = 0.05;
  const left = new THREE.Mesh(new THREE.BoxGeometry(4.4, 12.2, 5.4), mat);
  left.position.set(-5.8, 6.1, 0);
  const right = left.clone();
  right.position.x = 5.8;
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(16.2, 4.2, 5.4), mat);
  lintel.position.y = 14.1;
  const arch = new THREE.Mesh(new THREE.TorusGeometry(3.7, 1.05, 8, 18, Math.PI), mat);
  arch.position.y = 11.4;
  const attic = new THREE.Mesh(new THREE.BoxGeometry(16.8, 2.8, 5.8), mat);
  attic.position.y = 17.4;
  const ped = makePediment(12, 1.8, nightUniform);
  ped.position.set(0, 18.8, 0);
  const medal = new THREE.Mesh(new THREE.CircleGeometry(0.85, 16), gold);
  medal.position.set(0, 16.2, 3.0);
  for (const dx of [-4.6, 0, 4.6]) {
    const fig = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.6, 0.55), gold);
    fig.position.set(dx, 19.8, 0.2);
    g.add(fig);
  }
  g.add(left, right, lintel, arch, attic, ped, medal);
  g.position.set(0, 0, -SQUARE.depth / 2 - 3);
  return g;
}

function makeGoldenGate(nightUniform) {
  const g = new THREE.Group();
  const gold = goldMaterial(nightUniform);
  gold.emissiveIntensity = 0.06;
  for (const dx of [-4.1, 4.1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.42, 7.2, 0.42), gold);
    post.position.set(dx, 3.6, 0);
    g.add(post);
    const urn = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), gold);
    urn.position.set(dx, 7.5, 0);
    g.add(urn);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.32, 0.32), gold);
  lintel.position.y = 6.85;
  const arch = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.1, 6, 14, Math.PI), gold);
  arch.position.y = 5.1;
  g.add(lintel, arch);
  for (let i = 0; i < 9; i++) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 6.2, 5), gold);
    bar.position.set(-3.6 + i * 0.9, 3.2, 0);
    g.add(bar);
  }
  for (let i = 0; i < 5; i++) {
    const cross = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 8.1, 5), gold);
    cross.rotation.z = Math.PI / 2;
    cross.position.set(0, 1.2 + i * 1.15, 0);
    g.add(cross);
  }
  return g;
}

function makeFountain(nightUniform) {
  const g = new THREE.Group();
  const stoneMat = stone(nightUniform, "#e5d8c2", 0.55);
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.8, 0.7, 16), stoneMat);
  basin.position.y = 0.4;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 2.4, 8), stoneMat);
  stem.position.y = 1.7;
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.6, 0.4, 12), stoneMat);
  bowl.position.y = 2.9;
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(3.1, 3.1, 0.12, 16),
    new THREE.MeshStandardMaterial({
      color: "#6a9aaa",
      roughness: 0.15,
      metalness: 0.3,
      transparent: true,
      opacity: 0.7,
    })
  );
  water.position.y = 0.7;
  const jet = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.05, 2.8, 6),
    new THREE.MeshStandardMaterial({
      color: "#9ec8d4",
      transparent: true,
      opacity: 0.45,
      roughness: 0.1,
    })
  );
  jet.position.y = 4.2;
  g.add(basin, stem, bowl, water, jet);
  return g;
}

function makeStatue() {
  const g = new THREE.Group();
  const bronze = new THREE.MeshStandardMaterial({
    color: "#8a6a3a",
    metalness: 0.55,
    roughness: 0.4,
  });
  const stone = new THREE.MeshStandardMaterial({ color: "#d8cbb6", roughness: 0.55 });
  const base = new THREE.Mesh(new THREE.BoxGeometry(5.6, 1.1, 5.6), stone);
  base.position.y = 0.55;
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.4, 3.4), stone);
  plinth.position.y = 2.8;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.78, 2.6, 8), bronze);
  body.position.y = 5.8;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), bronze);
  head.position.y = 7.35;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 1.7), bronze);
  arm.position.set(0.2, 6.2, -0.75);
  arm.rotation.x = -0.45;
  g.add(base, plinth, body, head, arm);
  return g;
}

function paving() {
  const g = new THREE.Group();
  const ochre = new THREE.MeshStandardMaterial({
    color: PALETTE.stanislas,
    roughness: 0.72,
    metalness: 0.02,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: "#ddd4c4",
    roughness: 0.78,
  });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(SQUARE.width, 0.12, SQUARE.depth), ochre);
  slab.position.y = 0.06;
  slab.receiveShadow = true;
  const band = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.14, SQUARE.depth * 1.02), dark);
  band.position.y = 0.07;
  const band2 = band.clone();
  band2.rotation.y = Math.PI / 2;
  band2.scale.set(1, 1, SQUARE.width / SQUARE.depth);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(14, 0.55, 4, 32), dark);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.12;
  const star = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.08, 8), dark);
  star.position.y = 0.13;
  g.add(slab, band, band2, ring, star);
  return g;
}

export function makeStanislasEnsemble(nightUniform) {
  const root = new THREE.Group();
  const lights = [];
  root.add(paving());
  root.add(makeMairie(nightUniform));
  root.add(makeArcHere(nightUniform));

  const opera = makePalaceRange(nightUniform, 22, 68, 16.2);
  opera.position.set(SQUARE.width / 2 + 12, 0, -14);
  const musee = makePalaceRange(nightUniform, 22, 68, 16.2);
  musee.position.set(-SQUARE.width / 2 - 12, 0, -14);
  const ne = makePalaceRange(nightUniform, 40, 20, 15.4);
  ne.position.set(SQUARE.width / 2 - 22, 0, -SQUARE.depth / 2 - 11);
  const nw = makePalaceRange(nightUniform, 40, 20, 15.4);
  nw.position.set(-SQUARE.width / 2 + 22, 0, -SQUARE.depth / 2 - 11);
  root.add(opera, musee, nw, ne);

  const throatMat = new THREE.MeshStandardMaterial({
    color: PALETTE.stanislas,
    roughness: 0.74,
  });
  const sw = new THREE.Mesh(new THREE.BoxGeometry(52, 0.1, 18), throatMat);
  sw.position.set(-SQUARE.width / 2 - 20, 0.05, SQUARE.depth / 2 - 10);
  const se = sw.clone();
  se.position.set(SQUARE.width / 2 + 20, 0.05, SQUARE.depth / 2 - 10);
  root.add(sw, se);

  const corners = [
    [-SQUARE.width / 2 + 6, -SQUARE.depth / 2 + 6, 0.4],
    [SQUARE.width / 2 - 6, -SQUARE.depth / 2 + 6, -0.4],
    [-SQUARE.width / 2 + 6, SQUARE.depth / 2 - 6, 2.2],
    [SQUARE.width / 2 - 6, SQUARE.depth / 2 - 6, -2.2],
  ];
  for (const [x, z, rot] of corners) {
    const gate = makeGoldenGate(nightUniform);
    gate.position.set(x, 0, z);
    gate.rotation.y = rot;
    root.add(gate);
  }

  const neF = makeFountain(nightUniform);
  neF.position.set(SQUARE.width / 2 - 14, 0, -SQUARE.depth / 2 + 16);
  const nwF = makeFountain(nightUniform);
  nwF.position.set(-SQUARE.width / 2 + 14, 0, -SQUARE.depth / 2 + 16);
  root.add(neF, nwF);
  root.add(makeStatue());

  const hw = SQUARE.width / 2 - 8;
  const hd = SQUARE.depth / 2 - 8;
  for (const x of [-hw, hw]) {
    for (const z of [-hd * 0.6, -hd * 0.2, hd * 0.2, hd * 0.55]) {
      placeLamp(root, lights, nightUniform, x, z);
    }
  }
  placeLamp(root, lights, nightUniform, -18, hd - 2);
  placeLamp(root, lights, nightUniform, 18, hd - 2);
  placeLamp(root, lights, nightUniform, -16, -hd + 2);
  placeLamp(root, lights, nightUniform, 16, -hd + 2);

  root.rotation.y = AXIS_YAW;
  return { group: root, lights };
}

export function makePalaisGouverneur(nightUniform) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(58, 15, 16),
    stone(nightUniform, "#ead9bf", 0.56)
  );
  body.position.y = 7.5;
  body.castShadow = true;
  const rust = new THREE.Mesh(
    new THREE.BoxGeometry(58.4, 4.2, 16.5),
    stone(nightUniform, "#d5c2a4", 0.7)
  );
  rust.position.y = 2.1;
  const avant = new THREE.Mesh(
    new THREE.BoxGeometry(18, 16.5, 4),
    stone(nightUniform, "#efe3cd", 0.5)
  );
  avant.position.set(0, 8.4, 8.5);
  const ped = makePediment(18, 1.8, nightUniform);
  ped.position.set(0, 16.6, 10.2);
  const roof = new THREE.Mesh(boxRoofGeometry(58, 16, 14.95, 2.4), roofMaterial(PALETTE.roofSlate));
  for (let i = -4; i <= 4; i++) {
    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.5, 9.5, 8),
      stone(nightUniform, "#f2e8d6", 0.45)
    );
    col.position.set(i * 2.6, 9.2, 10.4);
    g.add(col);
  }
  addBalustrade(g, 56, 8.2, 16.4, nightUniform);
  g.add(body, rust, avant, ped, roof);
  const p = toXZ(6.18089, 48.697);
  g.position.set(p.x, 0, p.z);
  g.rotation.y = AXIS_YAW + 0.06;
  return g;
}

export function scatterLamps(parent, lights, nightUniform, spots) {
  for (const [lon, lat] of spots) {
    const p = toXZ(lon, lat);
    placeLamp(parent, lights, nightUniform, p.x, p.z);
  }
}

/** Lampadaires le long des rues, un tous les ~10 m. Peu de PointLights (budget GPU). */
export function lampsAlongRoads(parent, lights, nightUniform, roads, opts = {}) {
  const spacing = opts.spacing ?? 10;
  const maxMesh = opts.maxMesh ?? 360;
  const maxLights = opts.maxLights ?? 32;
  let meshes = 0;
  let lit = 0;
  for (const r of roads || []) {
    if (!["primary", "secondary", "tertiary", "residential", "pedestrian"].includes(r.highway)) continue;
    const coords = r.coords || [];
    if (coords.length < 2) continue;
    let acc = spacing * 0.5;
    let prev = toXZ(coords[0][0], coords[0][1]);
    if (Math.hypot(prev.x, prev.z) > 720) continue;
    for (let i = 1; i < coords.length; i++) {
      const cur = toXZ(coords[i][0], coords[i][1]);
      let dx = cur.x - prev.x;
      let dz = cur.z - prev.z;
      let seg = Math.hypot(dx, dz);
      if (seg < 0.4) {
        prev = cur;
        continue;
      }
      let t = 0;
      while (acc + (seg - t) >= spacing && meshes < maxMesh) {
        const need = spacing - acc;
        t += need;
        const k = t / seg;
        const x = prev.x + dx * k;
        const z = prev.z + dz * k;
        const withLight = lit < maxLights && meshes % 7 === 0;
        const lamp = makeLampPost(nightUniform, { withLight });
        lamp.position.set(x, 0, z);
        parent.add(lamp);
        if (withLight && lamp.userData.light) {
          lights.push(lamp.userData.light);
          lit += 1;
        }
        meshes += 1;
        acc = 0;
      }
      acc += seg - t;
      prev = cur;
      if (meshes >= maxMesh) return;
    }
  }
}
