import * as THREE from "three";
import { mergeGeometries } from "../vendor/BufferGeometryUtils.js";
import {
  centroid,
  closedRing,
  hash01,
  inVieuxNancy,
  polyAreaM2,
  simplify,
  toXZ,
  pointInRing,
  binnedPath,
  plateauRect,
} from "./geo.js";
import {
  PALETTE,
  earthSideMaterial,
  facadeMaterial,
  roofMaterial,
  goldMaterial,
  pitchedRoofGeometry,
  shapeFromCoords,
  extrudeShape,
  slabShape,
  decalMaterial,
  ribbonGeometry,
} from "./materials.js";
import {
  inStanislasCore,
  inPalaisFootprint,
  makeStanislasEnsemble,
  makePalaisGouverneur,
  scatterLamps,
  AXIS_YAW,
  SQUARE,
} from "./stanislas.js";
import { createStars, createRockets, createSatellites, makeVehicle } from "./life.js";
import { dressPepiniere, dressCarriere } from "./parks.js";

export const LANDMARKS = [
  { id: "stanislas", name: "Place Stanislas", sub: "Patrimoine mondial", lon: 6.18306, lat: 48.69361 },
  { id: "mairie", name: "Hôtel de Ville", sub: "Façade de Héré", lon: 6.18327, lat: 48.69282 },
  { id: "carriere", name: "Place de la Carrière", sub: "Axe ducal", lon: 6.18176, lat: 48.69574 },
  { id: "gouverneur", name: "Palais du Gouverneur", sub: "Ancien palais", lon: 6.18089, lat: 48.697 },
  { id: "pepiniere", name: "Parc de la Pépinière", sub: "Jardin public", lon: 6.1848, lat: 48.6974 },
  { id: "epvre", name: "Basilique Saint-Epvre", sub: "Flèche néogothique", lon: 6.17994, lat: 48.69586 },
  { id: "cathedrale", name: "Cathédrale", sub: "Tours jumelles", lon: 6.18608, lat: 48.69125 },
  { id: "sebastien", name: "Église Saint-Sébastien", sub: "Place du marché", lon: 6.18081, lat: 48.68898 },
  { id: "marche", name: "Marché Central", sub: "Halles", lon: 6.18285, lat: 48.68939 },
  { id: "gare", name: "Gare de Nancy-Ville", sub: "TGV & Urban Loop", lon: 6.17462, lat: 48.68954 },
  { id: "carnot", name: "Place Carnot", sub: "Porte de la Cité", lon: 6.1774, lat: 48.69335 },
  { id: "craffe", name: "Porte de la Craffe", sub: "Remparts", lon: 6.17779, lat: 48.69891 },
  { id: "desilles", name: "Porte Désilles", sub: "Arc de triomphe", lon: 6.17416, lat: 48.69796 },
  { id: "stgeorges", name: "Porte Saint-Georges", sub: "Faubourg", lon: 6.18841, lat: 48.69231 },
  { id: "canal", name: "Canal de la Marne au Rhin", sub: "Péniches", lon: 6.1944, lat: 48.6935 },
  { id: "tour-mairie", name: "Tour Stanislas", sub: "2030 · verre", lon: 6.18335, lat: 48.69238 },
  { id: "tour-gare", name: "Tour Gare", sub: "Hub ferroviaire", lon: 6.17315, lat: 48.68925 },
  { id: "tour-canal", name: "Tour Canal", sub: "Hub fluvial", lon: 6.1947, lat: 48.69325 },
];

/** Tours 2030 hors centre, pads de décollage. */
export const MODERN_SITES = [
  { lon: 6.1729, lat: 48.68915, h: 72, r: 22 },
  { lon: 6.1941, lat: 48.69155, h: 64, r: 20 },
  { lon: 6.1758, lat: 48.6872, h: 58, r: 20 },
  { lon: 6.1894, lat: 48.68755, h: 62, r: 20 },
  { lon: 6.1706, lat: 48.69685, h: 68, r: 20 },
];

export const LOOP_HUBS = [
  { id: "tour-mairie", lon: 6.18335, lat: 48.69238, h: 108, r: 36, w: 34, d: 26 },
  { id: "tour-gare", lon: 6.17315, lat: 48.68925, h: 118, r: 38, w: 36, d: 28 },
  { id: "tour-canal", lon: 6.1947, lat: 48.69325, h: 102, r: 34, w: 32, d: 24 },
];

const DOCK_Y = 42;

export function inModernFootprint(lon, lat) {
  const { x, z } = toXZ(lon, lat);
  for (const s of [...MODERN_SITES, ...LOOP_HUBS]) {
    const p = toXZ(s.lon, s.lat);
    if (Math.hypot(x - p.x, z - p.z) < s.r) return true;
  }
  return false;
}

function nameOf(obj) {
  return (obj?.name || "").toLowerCase();
}

function classifyBuilding(b) {
  const n = nameOf(b);
  const amenity = b.amenity || "";
  const building = b.building || "";
  if (n.includes("cathédrale") || n.includes("cathedrale") || building === "cathedral")
    return "cathedrale";
  if (n.includes("epvre") || n.includes("épvre")) return "epvre";
  if (n.includes("sébastien") || n.includes("sebastien")) return "sebastien";
  if (n.includes("marché central") || n.includes("marche central") || amenity === "marketplace")
    return "marche";
  if (n.includes("gare de nancy") || building === "train_station") return "gare";
  if (n.includes("palais du gouvernement")) return "skip-palais";
  if (n.includes("porte héré") || n.includes("porte here")) return "skip-stan";
  if (n.includes("porte de la craffe")) return "craffe";
  if (n.includes("porte désilles") || n.includes("porte desilles")) return "desilles";
  if (n.includes("porte saint-georges")) return "stgeorges";
  if (n.startsWith("porte")) return "porte";
  if (building === "church" || amenity === "place_of_worship" || building === "chapel")
    return "church";
  const [lon, lat] = b.centroid || centroid(b.coords);
  if (inStanislasCore(lon, lat)) return "skip-stan";
  if (inPalaisFootprint(lon, lat)) return "skip-palais";
  if (inModernFootprint(lon, lat)) return "skip-modern";
  if (inVieuxNancy(lon, lat)) return "vieux";
  return "city";
}

function buildingHeight(b, kind) {
  if (kind === "cathedrale") return 24;
  if (kind === "epvre") return 22;
  if (kind === "sebastien") return 18;
  if (kind === "gouverneur") return 16;
  if (kind === "craffe" || kind === "desilles" || kind === "stgeorges" || kind === "porte")
    return 15;
  if (kind === "gare") return 16;
  if (kind === "marche") return 13;
  if (kind === "church") return 16;
  const levels = parseFloat(b.levels);
  if (!Number.isNaN(levels) && levels > 1) return Math.min(Math.max(levels * 3.05, 13.5), 17);
  if (typeof b.height === "number" && b.height > 8 && b.height < 28) {
    return Math.min(Math.max(b.height, 13.5), 17);
  }
  if (kind === "vieux") return 14.4 + hash01(b.id || 1) * 1.6;
  return 15.0 + hash01(b.id || 2) * 1.8;
}

function roadWidth(hw, name) {
  const n = (name || "").toLowerCase();
  if (n === "place stanislas" || n.startsWith("place stanislas ")) return 0;
  if (
    n.includes("rue stanislas") ||
    n.includes("rue héré") ||
    n.includes("rue here") ||
    n.includes("rue des dominicains") ||
    n.includes("rue sainte-catherine")
  ) {
    return hw === "path" || hw === "service" ? 4.2 : 7.4;
  }
  switch (hw) {
    case "primary":
    case "primary_link":
      return 9;
    case "secondary":
    case "secondary_link":
      return 7.5;
    case "tertiary":
      return 6.4;
    case "residential":
    case "unclassified":
      return 5.4;
    case "pedestrian":
    case "living_street":
      return 5.5;
    case "service":
      return 3.2;
    case "path":
    case "cycleway":
      return 2.3;
    default:
      return 0;
  }
}

function pushGeo(buckets, key, geo) {
  if (!geo) return;
  if (!buckets[key]) buckets[key] = [];
  buckets[key].push(geo);
}

function mergeBucket(list) {
  if (!list?.length) return null;
  const ok = list.filter(Boolean);
  if (!ok.length) return null;
  const chunkSize = 250;
  try {
    const chunks = [];
    for (let i = 0; i < ok.length; i += chunkSize) {
      const slice = ok.slice(i, i + chunkSize);
      const merged = mergeGeometries(slice, false);
      slice.forEach((g) => g.dispose());
      chunks.push(merged);
    }
    if (chunks.length === 1) return chunks[0];
    const all = mergeGeometries(chunks, false);
    chunks.forEach((g) => g.dispose());
    return all;
  } catch (err) {
    console.warn("mergeBucket", err);
    return ok[0];
  }
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function labelSprite(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, 640, 96);
  ctx.font = "500 26px Inter, Outfit, sans-serif";
  const padX = 28;
  const w = Math.min(600, Math.ceil(ctx.measureText(text).width + padX * 2));
  const h = 44;
  const x = (640 - w) * 0.5;
  const y = (96 - h) * 0.5;
  ctx.shadowColor = "rgba(24, 20, 16, 0.16)";
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, x, y, w, h, 22);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = "#1c1a17";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 320, 49);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  const spr = new THREE.Sprite(mat);
  spr.scale.set(40, 6, 1);
  spr.renderOrder = 20;
  return spr;
}

function addCoveragePlateau(root) {
  const { w, d, cx, cz } = plateauRect();
  const earthH = 96;
  const side = earthSideMaterial();
  const top = new THREE.MeshStandardMaterial({
    color: PALETTE.ground,
    roughness: 0.96,
    metalness: 0,
  });
  const bot = new THREE.MeshStandardMaterial({
    color: PALETTE.earthDeep,
    roughness: 1,
    metalness: 0,
  });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(w, earthH, d), [side, side, top, bot, side, side]);
  slab.position.set(cx, -earthH * 0.5, cz);
  slab.receiveShadow = true;
  slab.castShadow = false;
  root.add(slab);

  const rimMat = new THREE.MeshStandardMaterial({
    color: "#f4f1ea",
    roughness: 0.62,
    metalness: 0.02,
  });
  const bw = 14;
  const bh = 4;
  const y = 0.85;
  const north = new THREE.Mesh(new THREE.BoxGeometry(w + bw * 2, bh, bw), rimMat);
  north.position.set(cx, y, cz - d * 0.5 - bw * 0.5);
  const south = new THREE.Mesh(new THREE.BoxGeometry(w + bw * 2, bh, bw), rimMat);
  south.position.set(cx, y, cz + d * 0.5 + bw * 0.5);
  const west = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, d), rimMat);
  west.position.set(cx - w * 0.5 - bw * 0.5, y, cz);
  const east = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, d), rimMat);
  east.position.set(cx + w * 0.5 + bw * 0.5, y, cz);
  for (const m of [north, south, west, east]) {
    m.castShadow = true;
    m.receiveShadow = true;
    root.add(m);
  }

  const stroke = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(w + bw * 2, 0.15, d + bw * 2)),
    new THREE.LineBasicMaterial({ color: "#1f1d19" })
  );
  stroke.position.set(cx, y + bh * 0.5, cz);
  root.add(stroke);

  const cliff = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(w, earthH, d)),
    new THREE.LineBasicMaterial({ color: "#2a2118" })
  );
  cliff.position.copy(slab.position);
  root.add(cliff);
}

function addSpire(parent, lon, lat, baseY, height, color) {
  const { x, z } = toXZ(lon, lat);
  const geo = new THREE.ConeGeometry(2.4, height, 8);
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.08 })
  );
  mesh.position.set(x, baseY + height * 0.5, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function addCathedralTowers(parent, lon, lat, baseY, nightUniform) {
  const { x, z } = toXZ(lon, lat);
  const stone = facadeMaterial(PALETTE.church, nightUniform, { roughness: 0.55 });
  const capMat =     new THREE.MeshStandardMaterial({
      color: PALETTE.roofSlate,
      metalness: 0.08,
      roughness: 0.55,
    });
  for (const dx of [-7.5, 7.5]) {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(7.2, 16, 7.2), stone);
    tower.position.set(x + dx, baseY + 8, z);
    tower.castShadow = true;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(3.4, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
    dome.position.set(x + dx, baseY + 16, z);
    const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 3.2, 8), capMat);
    lantern.position.set(x + dx, baseY + 18.4, z);
    parent.add(tower, dome, lantern);
  }
}

function makeFerrisWheel(nightUniform) {
  const g = new THREE.Group();
  const gold = goldMaterial(nightUniform);
  const iron = new THREE.MeshStandardMaterial({
    color: "#3a332c",
    metalness: 0.55,
    roughness: 0.38,
  });
  const radius = 18;
  const rotor = new THREE.Group();
  rotor.add(new THREE.Mesh(new THREE.TorusGeometry(radius, 0.38, 8, 48), gold));
  rotor.add(new THREE.Mesh(new THREE.TorusGeometry(radius * 0.72, 0.22, 6, 40), iron));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, radius * 2, 5), iron);
    spoke.rotation.z = a;
    rotor.add(spoke);
  }
  const cabinMat = new THREE.MeshStandardMaterial({
    color: "#7a2e2a",
    roughness: 0.45,
    emissive: "#c45a40",
    emissiveIntensity: 0.12,
  });
  const cabinMeshes = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.4, 1.6), cabinMat);
    cabin.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0);
    rotor.add(cabin);
    cabinMeshes.push(cabin);
  }
  g.add(rotor);
  const legGeo = new THREE.CylinderGeometry(0.45, 0.7, 22, 6);
  for (const [sx, sz] of [
    [-5, 5],
    [5, 5],
    [-5, -5],
    [5, -5],
  ]) {
    const leg = new THREE.Mesh(legGeo, iron);
    leg.position.set(sx * 0.15, -10, sz);
    leg.rotation.x = sz > 0 ? 0.42 : -0.42;
    g.add(leg);
  }
  g.add(new THREE.Mesh(new THREE.SphereGeometry(1.3, 12, 10), gold));
  g.userData.spin = rotor;
  g.userData.cabins = cabinMeshes;
  return g;
}

function makeBarge() {
  const g = new THREE.Group();
  const hull = new THREE.Mesh(
    new THREE.BoxGeometry(4.4, 2.2, 18),
    new THREE.MeshStandardMaterial({ color: "#3b342c", roughness: 0.7 })
  );
  hull.position.y = 0.4;
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(3.6, 2.4, 6),
    new THREE.MeshStandardMaterial({ color: "#c9b496", roughness: 0.55 })
  );
  cabin.position.set(0, 2.4, 3);
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(3.8, 0.3, 6.2),
    new THREE.MeshStandardMaterial({ color: "#5a6570" })
  );
  roof.position.set(0, 3.7, 3);
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(4.5, 0.25, 18.1),
    new THREE.MeshStandardMaterial({ color: "#7a2e2a" })
  );
  stripe.position.y = 1.3;
  g.add(hull, cabin, roof, stripe);
  return g;
}

function makeTGV() {
  const g = new THREE.Group();
  const silver = new THREE.MeshStandardMaterial({
    color: "#d8d4cc",
    metalness: 0.45,
    roughness: 0.28,
  });
  const orange = new THREE.MeshStandardMaterial({
    color: "#c45b12",
    metalness: 0.2,
    roughness: 0.4,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(3.1, 3.6, 42), silver);
  body.position.y = 2.2;
  const nose = new THREE.Mesh(new THREE.BoxGeometry(2.8, 3.2, 8), orange);
  nose.position.set(0, 2.1, -24);
  const band = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.5, 42.2), orange);
  band.position.y = 2.6;
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.25, 40), new THREE.MeshStandardMaterial({ color: "#888" }));
  roof.position.set(0, 4.1, 0);
  g.add(body, nose, band, roof);
  return g;
}

function makeModernTower(h) {
  const g = new THREE.Group();
  const w = 14 + (h % 7);
  const d = 11 + (h % 5);
  const glass = new THREE.MeshStandardMaterial({
    color: "#6a7684",
    metalness: 0.62,
    roughness: 0.22,
  });
  const frame = new THREE.MeshStandardMaterial({
    color: "#2c3036",
    metalness: 0.4,
    roughness: 0.45,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), glass);
  body.position.y = h / 2;
  body.castShadow = true;
  const core = new THREE.Mesh(new THREE.BoxGeometry(w * 0.22, h + 1.2, d * 0.22), frame);
  core.position.y = (h + 1.2) / 2;
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.15, 0.45, 0.18),
    new THREE.MeshStandardMaterial({ color: "#E8284A", roughness: 0.35 })
  );
  stripe.position.set(0, h * 0.72, d / 2 + 0.05);
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(w * 0.38, w * 0.4, 0.35, 12),
    new THREE.MeshStandardMaterial({ color: "#3a3e44", metalness: 0.5, roughness: 0.4 })
  );
  pad.position.y = h + 0.2;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(w * 0.32, 0.08, 6, 16),
    new THREE.MeshBasicMaterial({ color: "#e8c878" })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = h + 0.42;
  g.add(body, core, stripe, pad, ring);
  g.userData.padY = h + 1.2;
  g.userData.padR = w * 0.2;
  return g;
}

function makeMegaTower(spec) {
  const g = new THREE.Group();
  const { h, w, d } = spec;
  const glass = new THREE.MeshStandardMaterial({
    color: "#5a8aa0",
    metalness: 0.68,
    roughness: 0.14,
    transparent: true,
    opacity: 0.88,
  });
  const frame = new THREE.MeshStandardMaterial({
    color: "#1e242c",
    metalness: 0.5,
    roughness: 0.38,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), glass);
  body.position.y = h / 2;
  body.castShadow = true;
  const core = new THREE.Mesh(new THREE.BoxGeometry(w * 0.18, h + 4, d * 0.18), frame);
  core.position.y = (h + 4) / 2;
  const lobby = new THREE.Mesh(new THREE.BoxGeometry(w + 2.4, 7.2, d + 2.4), glass);
  lobby.position.y = DOCK_Y;
  const crown = new THREE.Mesh(new THREE.BoxGeometry(w * 0.72, 5, d * 0.72), frame);
  crown.position.y = h + 2.2;
  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.2, 0.7, 0.22),
    new THREE.MeshStandardMaterial({ color: "#E8284A", roughness: 0.32 })
  );
  stripe.position.set(0, h * 0.78, d / 2 + 0.08);
  const pad = new THREE.Mesh(
    new THREE.CylinderGeometry(w * 0.32, w * 0.34, 0.4, 14),
    new THREE.MeshStandardMaterial({ color: "#3a3e44", metalness: 0.55, roughness: 0.35 })
  );
  pad.position.y = h + 0.4;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(w * 0.28, 0.1, 6, 18),
    new THREE.MeshBasicMaterial({ color: "#e8c878" })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = h + 0.65;
  g.add(body, core, lobby, crown, stripe, pad, ring);
  g.userData.padY = h + 1.6;
  return g;
}

function makeLoopCar() {
  const g = new THREE.Group();
  const silver = new THREE.MeshStandardMaterial({
    color: "#d4d8de",
    metalness: 0.62,
    roughness: 0.22,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.3, 11.5), silver);
  const nose = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.8, 2.4), silver);
  nose.position.z = -6.6;
  const band = new THREE.Mesh(
    new THREE.BoxGeometry(2.7, 0.35, 11.6),
    new THREE.MeshStandardMaterial({ color: "#E8284A", roughness: 0.4 })
  );
  band.position.y = 0.35;
  const glow = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.12, 8),
    new THREE.MeshBasicMaterial({ color: "#9ee4ff" })
  );
  glow.position.y = -1.15;
  g.add(body, nose, band, glow);
  return g;
}

function buildUrbanLoop(root) {
  const hubs = LOOP_HUBS.map((s) => {
    const p = toXZ(s.lon, s.lat);
    return { ...s, x: p.x, z: p.z };
  });
  const [mairie, gare, canal] = hubs;
  for (const hub of hubs) {
    const tower = makeMegaTower(hub);
    tower.position.set(hub.x, 0, hub.z);
    root.add(tower);
  }
  const H = DOCK_Y;
  const pts = [
    new THREE.Vector3(mairie.x, H, mairie.z),
    new THREE.Vector3(mairie.x - 90, H + 1, mairie.z + 50),
    new THREE.Vector3(-280, H + 2, 260),
    new THREE.Vector3(gare.x + 70, H + 1, gare.z - 30),
    new THREE.Vector3(gare.x, H, gare.z),
    new THREE.Vector3(gare.x + 90, H + 3, gare.z + 90),
    new THREE.Vector3(-60, H + 4, 430),
    new THREE.Vector3(380, H + 3, 300),
    new THREE.Vector3(canal.x - 80, H + 2, canal.z + 90),
    new THREE.Vector3(canal.x, H, canal.z),
    new THREE.Vector3(canal.x - 50, H + 2, canal.z + 150),
    new THREE.Vector3(160, H + 2, 210),
    new THREE.Vector3(mairie.x + 20, H, mairie.z + 40),
  ];
  const curve = new THREE.CatmullRomCurve3(pts, true, "catmullrom", 0.35);
  const tube = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 220, 3.4, 10, true),
    new THREE.MeshStandardMaterial({
      color: "#8ec8dc",
      metalness: 0.35,
      roughness: 0.18,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
    })
  );
  const rail = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 220, 0.55, 6, true),
    new THREE.MeshStandardMaterial({
      color: "#cfd6de",
      metalness: 0.7,
      roughness: 0.25,
    })
  );
  root.add(tube, rail);
  const cars = [];
  for (let i = 0; i < 3; i++) {
    const mesh = makeLoopCar();
    root.add(mesh);
    cars.push({ mesh, t: i / 3, speed: 0.018 });
  }
  return { curve, cars };
}

export async function buildCity(scene, data, nightUniform, onProgress) {
  const root = new THREE.Group();
  scene.add(root);

  addCoveragePlateau(root);

  const buckets = {
    city: [],
    vieux: [],
    church: [],
    landmark: [],
    gate: [],
    roofs: [],
    roofDeep: [],
    roofPale: [],
    roofSlate: [],
  };

  const special = [];
  const buildings = data.buildings || [];
  const total = buildings.length;
  for (let i = 0; i < total; i++) {
    if (i % 400 === 0) {
      onProgress?.(0.1 + (i / total) * 0.55);
      await new Promise((r) => requestAnimationFrame(r));
    }
    const b = buildings[i];
    const area = polyAreaM2(b.coords);
    if (area < 28) continue;
    const kind = classifyBuilding(b);
    if (kind === "skip-mairie" || kind === "skip-stan" || kind === "skip-palais" || kind === "skip-modern")
      continue;
    const ring = simplify(closedRing(b.coords), 1.8);
    const shape = shapeFromCoords(ring);
    if (!shape) continue;
    const h = buildingHeight(b, kind);
    let geo;
    try {
      geo = extrudeShape(shape, h);
    } catch {
      continue;
    }
    const bucket =
      kind === "vieux"
        ? "vieux"
        : kind === "church" || kind === "cathedrale" || kind === "epvre" || kind === "sebastien"
          ? "church"
          : kind === "craffe" ||
              kind === "desilles" ||
              kind === "stgeorges" ||
              kind === "porte"
            ? "gate"
            : kind === "gouverneur" || kind === "gare" || kind === "marche"
              ? "landmark"
              : "city";
    pushGeo(buckets, bucket, geo);

    if (h > 8) {
      try {
        const roof = pitchedRoofGeometry(ring, h);
        if (roof) {
          const slate = kind === "church" || kind === "cathedrale" || kind === "epvre" || kind === "sebastien";
          const roll = hash01(b.id || area);
          const tone = slate ? "roofSlate" : roll > 0.68 ? "roofDeep" : roll > 0.38 ? "roofPale" : "roofs";
          pushGeo(buckets, tone, roof);
        }
      } catch {
        /* ignore */
      }
    }

    if (["cathedrale", "epvre", "sebastien", "gouverneur", "craffe", "desilles", "stgeorges", "gare", "marche", "porte"].includes(kind)) {
      special.push({ kind, b, h });
    }
  }

  const mats = {
    city: facadeMaterial(PALETTE.beigeA, nightUniform),
    vieux: facadeMaterial(PALETTE.vieux, nightUniform, { roughness: 0.64, warm: 1.15 }),
    church: facadeMaterial(PALETTE.church, nightUniform, { roughness: 0.6 }),
    landmark: facadeMaterial(PALETTE.landmark, nightUniform, { roughness: 0.55 }),
    gate: facadeMaterial(PALETTE.gate, nightUniform, { roughness: 0.5 }),
    roofs: roofMaterial(PALETTE.roofWarm),
    roofDeep: roofMaterial(PALETTE.roofDeep),
    roofPale: roofMaterial(PALETTE.roofPale),
    roofSlate: roofMaterial(PALETTE.roofSlate),
  };

  for (const key of Object.keys(buckets)) {
    const merged = mergeBucket(buckets[key]);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mats[key]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    root.add(mesh);
  }

  onProgress?.(0.72);

  const parkGeos = [];
  const pepiniereRings = [];
  for (const p of data.parks || []) {
    if ((p.coords || []).length < 4) continue;
    const shape = shapeFromCoords(simplify(closedRing(p.coords), 3));
    if (!shape) continue;
    try {
      parkGeos.push(slabShape(shape, 0.48, 0));
    } catch {
      continue;
    }
    if (nameOf(p).includes("pépinière") || nameOf(p).includes("pepiniere")) {
      pepiniereRings.push(closedRing(p.coords));
    }
  }
  const parkMerged = mergeBucket(parkGeos);
  if (parkMerged) {
    root.add(new THREE.Mesh(parkMerged, decalMaterial(PALETTE.park, { roughness: 0.92, factor: -3 })));
  }

  const squareGeos = { stanislas: [], carriere: [], other: [] };
  for (const s of data.squares || []) {
    const n = nameOf(s);
    const shape = shapeFromCoords(simplify(closedRing(s.coords), 1.2));
    if (!shape) continue;
    try {
      const geo = slabShape(shape, 0.28, 0);
      if (n.includes("stanislas")) continue;
      else if (n.includes("carrière") || n.includes("carriere")) squareGeos.carriere.push(geo);
      else squareGeos.other.push(geo);
    } catch {
      /* ignore */
    }
  }
  const carr = mergeBucket(squareGeos.carriere);
  if (carr) {
    root.add(new THREE.Mesh(carr, decalMaterial(PALETTE.carriere, { roughness: 0.72, factor: -2 })));
  }
  const oth = mergeBucket(squareGeos.other);
  if (oth) {
    root.add(new THREE.Mesh(oth, decalMaterial(PALETTE.pavement, { roughness: 0.75, factor: -2 })));
  }

  const carnotPts = [];
  for (const r of data.roads || []) {
    if ((r.name || "") === "Place Carnot") carnotPts.push(...r.coords);
  }
  if (carnotPts.length) {
    const lons = carnotPts.map((p) => p[0]);
    const lats = carnotPts.map((p) => p[1]);
    const rect = [
      [Math.min(...lons) - 0.00015, Math.min(...lats) - 0.0001],
      [Math.max(...lons) + 0.00015, Math.min(...lats) - 0.0001],
      [Math.max(...lons) + 0.00015, Math.max(...lats) + 0.0001],
      [Math.min(...lons) - 0.00015, Math.max(...lats) + 0.0001],
      [Math.min(...lons) - 0.00015, Math.min(...lats) - 0.0001],
    ];
    const sh = shapeFromCoords(rect);
    if (sh) {
      const m = new THREE.Mesh(slabShape(sh, 0.26, 0), decalMaterial(PALETTE.carnot, { roughness: 0.7 }));
      root.add(m);
    }
  }

  const roadGeos = [];
  for (const r of data.roads || []) {
    const w = roadWidth(r.highway, r.name);
    if (!w || (r.coords || []).length < 2) continue;
    const geo = ribbonGeometry(simplify(r.coords, 1.8), w);
    if (geo) roadGeos.push(geo);
  }
  const roadsM = mergeBucket(roadGeos);
  if (roadsM) {
    root.add(new THREE.Mesh(roadsM, decalMaterial(PALETTE.road, { roughness: 0.88, factor: -1 })));
  }

  const waterMat = decalMaterial(PALETTE.water, {
    roughness: 0.18,
    metalness: 0.42,
    emissive: new THREE.Color("#1c4a58"),
    emissiveIntensity: 0.28,
    factor: -4,
  });
  const canalPaths = [];
  for (const w of [...(data.canals || []), ...(data.water || [])]) {
    const coords = w.coords || [];
    if (coords.length < 3) continue;
    const closed =
      Math.abs(coords[0][0] - coords[coords.length - 1][0]) < 1e-8 &&
      Math.abs(coords[0][1] - coords[coords.length - 1][1]) < 1e-8;
    if (closed && coords.length > 8) {
      const sh = shapeFromCoords(simplify(coords, 4));
      if (sh) {
        try {
          const mesh = new THREE.Mesh(slabShape(sh, 0.36, 0), waterMat);
          mesh.userData.water = true;
          root.add(mesh);
        } catch {
          /* ignore */
        }
      }
      if ((w.name || "").toLowerCase().includes("canal") || w.water === "canal" || w.waterway === "canal") {
        const clipped = coords.filter(
          ([lon, lat]) => lon > 6.168 && lon < 6.198 && lat > 48.686 && lat < 48.702
        );
        if (clipped.length > 8) canalPaths.push(clipped);
      }
    } else if ((w.waterway === "canal" || (w.name || "").toLowerCase().includes("canal")) && coords.length > 3) {
      const geo = ribbonGeometry(coords, 18);
      if (geo) {
        geo.translate(0, -0.02, 0);
        root.add(new THREE.Mesh(geo, waterMat));
      }
      canalPaths.push(coords);
    }
  }

  const railGeos = [];
  const railPts = [];
  for (const r of data.rails || []) {
    if (r.kind !== "rail" || (r.coords || []).length < 2) continue;
    const geo = ribbonGeometry(r.coords, 4.2);
    if (geo) railGeos.push(geo);
    for (const c of r.coords) {
      if (c[0] > 6.169 && c[0] < 6.179 && c[1] > 48.6865 && c[1] < 48.701) railPts.push(c);
    }
  }
  const railsM = mergeBucket(railGeos);
  if (railsM) {
    root.add(
      new THREE.Mesh(
        railsM,
        decalMaterial("#6a645c", { roughness: 0.45, metalness: 0.4, factor: -1 })
      )
    );
  }

  const lampLights = [];
  const ensemble = makeStanislasEnsemble(nightUniform);
  root.add(ensemble.group);
  lampLights.push(...ensemble.lights);
  root.add(makePalaisGouverneur(nightUniform));
  scatterLamps(root, lampLights, nightUniform, [
    [6.18176, 48.6952],
    [6.18176, 48.6957],
    [6.1819, 48.6962],
    [6.1815, 48.6966],
    [6.1774, 48.6931],
    [6.1776, 48.6935],
    [6.1772, 48.6937],
    [6.18608, 48.69125],
    [6.17994, 48.69586],
    [6.17779, 48.69891],
    [6.17416, 48.69796],
    [6.18841, 48.69231],
  ]);

  for (const s of special) {
    const [lon, lat] = s.b.centroid || centroid(s.b.coords);
    if (s.kind === "epvre") addSpire(root, lon, lat, s.h, 48, PALETTE.pierre);
    if (s.kind === "cathedrale") addCathedralTowers(root, lon, lat, s.h, nightUniform);
    if (s.kind === "sebastien") addSpire(root, lon, lat, s.h, 10, PALETTE.roofTile);
    if (s.kind === "craffe") {
      const p = toXZ(lon, lat);
      for (const dx of [-5, 5]) {
        const t = new THREE.Mesh(
          new THREE.CylinderGeometry(3.2, 3.6, 22, 10),
          facadeMaterial(PALETTE.gate, nightUniform)
        );
        t.position.set(p.x + dx, 11, p.z);
        root.add(t);
        const cap = new THREE.Mesh(new THREE.ConeGeometry(3.4, 5, 8), roofMaterial(PALETTE.roofSlate));
        cap.position.set(p.x + dx, 24.5, p.z);
        root.add(cap);
      }
    }
  }

  dressPepiniere(root, pepiniereRings, nightUniform);
  dressCarriere(root, nightUniform);

  const { x: fx, z: fz } = toXZ(6.18235, 48.69555);
  const wheel = makeFerrisWheel(nightUniform);
  wheel.position.set(fx, 22, fz);
  root.add(wheel);

  for (const lm of LANDMARKS) {
    const p = toXZ(lm.lon, lm.lat);
    const spr = labelSprite(lm.name);
    spr.position.set(p.x, 28, p.z);
    spr.userData.label = true;
    root.add(spr);
  }

  let canalCurve = null;
  if (canalPaths.length) {
    const longest = canalPaths.reduce((a, b) => (a.length > b.length ? a : b));
    const bins = binnedPath(
      longest.filter(([lon, lat]) => lon > 6.168 && lon < 6.198 && lat > 48.686 && lat < 48.702),
      "lat",
      4
    );
    if (bins.length > 3) {
      canalCurve = new THREE.CatmullRomCurve3(
        bins.map(([lon, lat]) => {
          const p = toXZ(lon, lat);
          return new THREE.Vector3(p.x, 0.9, p.z);
        })
      );
      const waterPath = new THREE.CatmullRomCurve3(
        bins.map(([lon, lat]) => {
          const p = toXZ(lon, lat);
          return new THREE.Vector3(p.x, 0.12, p.z);
        })
      );
      root.add(new THREE.Mesh(new THREE.TubeGeometry(waterPath, 160, 11, 6, false), waterMat));
    }
  }

  let railCurve = null;
  if (railPts.length > 8) {
    const bins = binnedPath(railPts, "lat", 4);
    if (bins.length > 4) {
      railCurve = new THREE.CatmullRomCurve3(
        bins.map(([lon, lat]) => {
          const p = toXZ(lon, lat);
          return new THREE.Vector3(p.x, 1.4, p.z);
        })
      );
    }
  }

  const barges = [];
  if (canalCurve) {
    for (let i = 0; i < 3; i++) {
      const boat = makeBarge();
      root.add(boat);
      barges.push({ mesh: boat, t: i / 3, speed: 0.012 + i * 0.002 });
    }
  }

  const trains = [];
  if (railCurve) {
    for (let i = 0; i < 2; i++) {
      const tgv = makeTGV();
      root.add(tgv);
      trains.push({ mesh: tgv, t: i * 0.5, speed: 0.045, dir: i === 0 ? 1 : -1 });
    }
  }

  const stars = createStars();
  scene.add(stars);
  const rockets = createRockets();
  scene.add(rockets.group);
  const satellites = createSatellites();
  scene.add(satellites.group);

  const loop = buildUrbanLoop(root);

  const modernPads = [];
  for (const s of MODERN_SITES) {
    const tower = makeModernTower(s.h);
    const p = toXZ(s.lon, s.lat);
    tower.position.set(p.x, 0, p.z);
    tower.rotation.y = (s.lon * 40) % 1.2;
    root.add(tower);
    modernPads.push({ x: p.x, y: s.h + 1.4, z: p.z });
  }
  for (const s of LOOP_HUBS) {
    const p = toXZ(s.lon, s.lat);
    modernPads.push({ x: p.x, y: s.h + 1.8, z: p.z });
  }

  const flyers = [];
  const kinds = ["car", "car", "scooter", "pod", "car", "scooter"];
  const spawn = (curve, kind, speed, threshold, t0, bob) => {
    const mesh = makeVehicle(kind);
    scene.add(mesh);
    flyers.push({ mesh, curve, t: t0, speed, bob, threshold });
  };

  const routes = [];
  for (const r of data.roads || []) {
    if (!["primary", "secondary", "tertiary", "residential", "pedestrian"].includes(r.highway))
      continue;
    if ((r.coords || []).length < 5) continue;
    const mid = r.coords[Math.floor(r.coords.length / 2)];
    const p = toXZ(mid[0], mid[1]);
    if (Math.hypot(p.x, p.z) > 640) continue;
    routes.push(r);
  }
  routes.sort((a, b) => b.coords.length - a.coords.length);

  for (let lane = 0; lane < 3; lane++) {
    const orbit = [];
    const ry = 9 + lane * 7;
    const rx = 88 + lane * 18;
    const rz = 64 + lane * 14;
    for (let a = 0; a <= 18; a++) {
      const ang = (a / 18) * Math.PI * 2;
      const lx = Math.cos(ang) * rx;
      const lz = Math.sin(ang) * rz;
      const x = lx * Math.cos(AXIS_YAW) + lz * Math.sin(AXIS_YAW);
      const z = -lx * Math.sin(AXIS_YAW) + lz * Math.cos(AXIS_YAW);
      orbit.push(new THREE.Vector3(x, ry, z));
    }
    const orbitCurve = new THREE.CatmullRomCurve3(orbit, true);
    const n = 5;
    for (let i = 0; i < n; i++) {
      spawn(orbitCurve, kinds[(lane + i) % kinds.length], 0.014 + lane * 0.004, 0.06 + i * 0.08, i / n, i + lane);
    }
  }

  const axis = [];
  for (let i = -8; i <= 8; i++) {
    const lx = i * 22;
    const lz = SQUARE.depth / 2 - 10;
    const x = lx * Math.cos(AXIS_YAW) + lz * Math.sin(AXIS_YAW);
    const z = -lx * Math.sin(AXIS_YAW) + lz * Math.cos(AXIS_YAW);
    axis.push(new THREE.Vector3(x, 7.5, z));
  }
  const axisCurve = new THREE.CatmullRomCurve3(axis);
  spawn(axisCurve, "car", 0.022, 0.08, 0.05, 0.4);
  spawn(axisCurve, "scooter", 0.028, 0.12, 0.35, 1.1);
  spawn(axisCurve, "car", 0.02, 0.1, 0.7, 2.2);
  const cross = [];
  for (let i = -6; i <= 6; i++) {
    const lx = 0;
    const lz = i * 22;
    const x = lx * Math.cos(AXIS_YAW) + lz * Math.sin(AXIS_YAW);
    const z = -lx * Math.sin(AXIS_YAW) + lz * Math.cos(AXIS_YAW);
    cross.push(new THREE.Vector3(x, 12, z));
  }
  const crossCurve = new THREE.CatmullRomCurve3(cross);
  spawn(crossCurve, "pod", 0.024, 0.08, 0.2, 0.6);
  spawn(crossCurve, "car", 0.02, 0.1, 0.65, 1.8);

  const used = Math.min(36, routes.length);
  for (let i = 0; i < used; i++) {
    const alt = 6 + (i % 5) * 4.2;
    const pts = routes[i].coords.map(([lon, lat]) => {
      const q = toXZ(lon, lat);
      return new THREE.Vector3(q.x, alt, q.z);
    });
    if (pts.length < 2) continue;
    const curve = new THREE.CatmullRomCurve3(pts);
    const copies = i < 14 ? 3 : 2;
    for (let k = 0; k < copies; k++) {
      spawn(
        curve,
        kinds[(i + k) % kinds.length],
        0.012 + (i % 5) * 0.003,
        0.05 + ((i * 0.04 + k * 0.08) % 0.35),
        (k * 0.37 + i * 0.11) % 1,
        i * 0.8 + k
      );
    }
  }

  for (const pad of modernPads) {
    const dest = routes[Math.floor(Math.random() * Math.min(8, routes.length))];
    const end = dest
      ? toXZ(dest.coords[dest.coords.length - 1][0], dest.coords[dest.coords.length - 1][1])
      : { x: 0, z: 0 };
    const loop = [
      new THREE.Vector3(pad.x, pad.y, pad.z),
      new THREE.Vector3(pad.x + 2, pad.y + 16, pad.z + 4),
      new THREE.Vector3((pad.x + end.x) * 0.5, 22, (pad.z + end.z) * 0.5),
      new THREE.Vector3(end.x, 14, end.z),
      new THREE.Vector3((pad.x + end.x) * 0.45, 26, (pad.z + end.z) * 0.55),
      new THREE.Vector3(pad.x - 3, pad.y + 14, pad.z - 2),
      new THREE.Vector3(pad.x, pad.y, pad.z),
    ];
    const curve = new THREE.CatmullRomCurve3(loop, true);
    spawn(curve, "car", 0.01, 0.16, Math.random(), 2);
    spawn(curve, "pod", 0.013, 0.28, 0.5, 3);
  }

  onProgress?.(0.92);

  return {
    root,
    wheel,
    barges,
    trains,
    canalCurve,
    railCurve,
    lampLights,
    stars,
    rockets,
    satellites,
    flyers,
    loop,
  };
}
