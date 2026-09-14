import * as THREE from "three";
import { toXZ } from "./geo.js";

export const PALETTE = {
  beigeA: new THREE.Color("#e4d6be"),
  beigeB: new THREE.Color("#eadcc6"),
  beigeC: new THREE.Color("#dccab0"),
  vieux: new THREE.Color("#e8d8c0"),
  pierre: new THREE.Color("#e6d8c4"),
  landmark: new THREE.Color("#eee4d4"),
  church: new THREE.Color("#e2d8c8"),
  gate: new THREE.Color("#d8ccb4"),
  roof: new THREE.Color("#b85c40"),
  roofWarm: new THREE.Color("#c46848"),
  roofDeep: new THREE.Color("#9a4434"),
  roofPale: new THREE.Color("#c87858"),
  roofSlate: new THREE.Color("#7a7670"),
  roofTile: new THREE.Color("#b0543c"),
  gold: new THREE.Color("#d4b24a"),
  goldBright: new THREE.Color("#f0d36a"),
  park: new THREE.Color("#7a9a5c"),
  grass: new THREE.Color("#8aaa68"),
  tree: new THREE.Color("#5a7a48"),
  trunk: new THREE.Color("#5a4030"),
  water: new THREE.Color("#3f6d78"),
  road: new THREE.Color("#9e9180"),
  pavement: new THREE.Color("#ddd4c4"),
  stanislas: new THREE.Color("#efe8dc"),
  carriere: new THREE.Color("#ebe3d6"),
  carnot: new THREE.Color("#e4d8c6"),
  ground: new THREE.Color("#d8ccb6"),
  earth: new THREE.Color("#7a5538"),
  earthDeep: new THREE.Color("#3a2418"),
};

/** Tranches de terre sur les flancs du plateau (strates horizontales). */
export function earthSideMaterial() {
  const mat = new THREE.MeshStandardMaterial({
    color: PALETTE.earth,
    roughness: 0.98,
    metalness: 0,
    emissive: new THREE.Color("#4a321c"),
    emissiveIntensity: 0.28,
  });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vWPos;`
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vWPos;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }`
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float y = vWPos.y;
        float n0 = hash(floor(vWPos.xz * 0.045));
        float layer = floor((-y + n0 * 3.2) * 0.2);
        float n = hash(vec2(layer, 2.7));
        vec3 deep = vec3(0.26, 0.16, 0.10);
        vec3 mid  = vec3(0.50, 0.34, 0.20);
        vec3 pale = vec3(0.70, 0.54, 0.36);
        vec3 clay = vec3(0.58, 0.38, 0.24);
        vec3 soil = mix(deep, mid, n);
        if (mod(layer, 5.0) < 1.0) soil = mix(soil, pale, 0.62);
        if (mod(layer, 7.0) < 1.0) soil = mix(soil, clay, 0.45);
        soil = mix(soil, deep, smoothstep(-8.0, -90.0, y));
        vec3 sod = vec3(0.46, 0.50, 0.34);
        soil = mix(soil, sod, smoothstep(-3.4, -0.15, y) * 0.42);
        diffuseColor.rgb = soil;`
      );
  };
  return mat;
}

export function makeNightUniform() {
  return { value: 0 };
}

/**
 * Grille de fenêtres en world-space + lueur nocturne.
 * Détail « cité des ducs » : ritme vertical des baies nancéiennes.
 */
export function facadeMaterial(color, nightUniform, opts = {}) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.72,
    metalness: opts.metalness ?? 0.04,
    emissive: new THREE.Color("#000000"),
    emissiveIntensity: 0,
  });
  mat.userData.night = nightUniform;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = nightUniform;
    shader.uniforms.uWarm = { value: opts.warm ?? 1 };
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vWPos;
        varying vec3 vWNrm;`
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vec4 wp = modelMatrix * vec4(transformed, 1.0);
        vWPos = wp.xyz;
        vWNrm = normalize(mat3(modelMatrix) * objectNormal);`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        uniform float uNight;
        uniform float uWarm;
        varying vec3 vWPos;
        varying vec3 vWNrm;
        float hash(vec2 p){
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }`
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float wall = 1.0 - abs(vWNrm.y);
        float wx = abs(vWNrm.z) > 0.55 ? vWPos.x : vWPos.z;
        float wy = vWPos.y;
        float col = fract(wx * 0.28);
        float row = fract(wy * 0.33);
        float win = step(0.18, col) * step(col, 0.78) * step(0.22, row) * step(row, 0.86);
        win *= wall * step(2.1, wy);
        float stoneLine = step(0.96, fract(wy * 0.33)) * wall * 0.12;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.78, stoneLine);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.30, 0.26, 0.22), win * 0.52 * (1.0 - uNight * 0.28));
        float id = hash(floor(vec2(wx * 0.34, wy * 0.38)));
        float lit = win * uNight * step(0.36, id);
        vec3 glow = vec3(1.05, 0.82, 0.46) * lit * 2.15 * uWarm;
        float hot = step(0.86, id);
        glow += vec3(1.2, 0.94, 0.58) * lit * hot * 2.6;
        diffuseColor.rgb += glow;
        `
      );
  };
  return mat;
}

export function roofMaterial(color = PALETTE.roof) {
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.88,
    metalness: 0.02,
  });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vRoofPos;
        varying vec3 vRoofNrm;`
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
        vec4 wp = modelMatrix * vec4(transformed, 1.0);
        vRoofPos = wp.xyz;
        vRoofNrm = normalize(mat3(modelMatrix) * objectNormal);`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
        varying vec3 vRoofPos;
        varying vec3 vRoofNrm;`
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float tile = fract(vRoofPos.x * 0.48 + vRoofPos.z * 0.16);
        float row = fract(vRoofPos.y * 1.25 + vRoofPos.z * 0.52);
        float grout = step(0.86, tile) + step(0.9, row);
        diffuseColor.rgb *= 1.0 - clamp(grout, 0.0, 1.0) * 0.16;
        float slope = mix(0.82, 1.06, clamp(vRoofNrm.y * 1.35, 0.0, 1.0));
        diffuseColor.rgb *= slope;
        `
      );
  };
  return mat;
}

function ringPointsXZ(ring) {
  const pts = [];
  const n = ring.length;
  const closed =
    Math.abs(ring[0][0] - ring[n - 1][0]) < 1e-8 &&
    Math.abs(ring[0][1] - ring[n - 1][1]) < 1e-8;
  const last = closed ? n - 1 : n;
  for (let i = 0; i < last; i++) {
    const { x, z } = toXZ(ring[i][0], ring[i][1]);
    pts.push({ x, z });
  }
  return pts;
}

function ensureCcwXZ(pts) {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i].x * pts[j].z - pts[j].x * pts[i].z;
  }
  if (area < 0) pts.reverse();
  return pts;
}

function pcaXZ(pts) {
  let cx = 0;
  let cz = 0;
  for (const p of pts) {
    cx += p.x;
    cz += p.z;
  }
  cx /= pts.length;
  cz /= pts.length;
  let xx = 0;
  let zz = 0;
  let xz = 0;
  for (const p of pts) {
    const dx = p.x - cx;
    const dz = p.z - cz;
    xx += dx * dx;
    zz += dz * dz;
    xz += dx * dz;
  }
  const trace = xx + zz;
  const disc = Math.sqrt(Math.max(0, (trace * trace) / 4 - (xx * zz - xz * xz)));
  const l1 = trace / 2 + disc;
  let axisX;
  let axisZ;
  if (Math.abs(xz) > 1e-8) {
    axisX = l1 - zz;
    axisZ = xz;
  } else if (xx >= zz) {
    axisX = 1;
    axisZ = 0;
  } else {
    axisX = 0;
    axisZ = 1;
  }
  const inv = 1 / (Math.hypot(axisX, axisZ) || 1);
  axisX *= inv;
  axisZ *= inv;
  let minP = Infinity;
  let maxP = -Infinity;
  let minQ = Infinity;
  let maxQ = -Infinity;
  for (const p of pts) {
    const pr = (p.x - cx) * axisX + (p.z - cz) * axisZ;
    const q = -(p.x - cx) * axisZ + (p.z - cz) * axisX;
    minP = Math.min(minP, pr);
    maxP = Math.max(maxP, pr);
    minQ = Math.min(minQ, q);
    maxQ = Math.max(maxQ, q);
  }
  return { cx, cz, axisX, axisZ, len: maxP - minP, width: maxQ - minQ };
}

function finishRoof(pos, uv) {
  if (pos.length < 9) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  return geo;
}

function areaXZ(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    a += pts[i].x * pts[j].z - pts[j].x * pts[i].z;
  }
  return Math.abs(a) * 0.5;
}

function isConvexXZ(pts) {
  let sign = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const c = pts[(i + 2) % n];
    const cross = (b.x - a.x) * (c.z - b.z) - (b.z - a.z) * (c.x - b.x);
    if (Math.abs(cross) < 1e-6) continue;
    const s = Math.sign(cross);
    if (!sign) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

function lidRoofGeometry(pts, y) {
  const v2 = pts.map((p) => new THREE.Vector2(p.x, -p.z));
  let a = 0;
  for (let i = 0; i < v2.length; i++) {
    const j = (i + 1) % v2.length;
    a += v2[i].x * v2[j].y - v2[j].x * v2[i].y;
  }
  if (a < 0) v2.reverse();
  if (v2.length < 3) return null;
  let geo = flatShape(new THREE.Shape(v2), y + 0.06);
  if (!geo) return null;
  if (geo.index) geo = geo.toNonIndexed();
  if (!geo.getAttribute("uv")) {
    const n = geo.getAttribute("position").count;
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  }
  return geo;
}

function obbGableRoof(pca, y) {
  const peak = THREE.MathUtils.clamp(pca.width * 0.3, 2.1, 4.2);
  const geo = boxRoofGeometry(pca.len, pca.width, y, peak);
  if (!geo) return null;
  geo.rotateY(Math.atan2(-pca.axisZ, pca.axisX));
  geo.translate(pca.cx, 0, pca.cz);
  return geo;
}

function hipToCentroid(pts, y, peak) {
  let a = 0;
  let cx = 0;
  let cz = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    const cross = pts[i].x * pts[j].z - pts[j].x * pts[i].z;
    a += cross;
    cx += (pts[i].x + pts[j].x) * cross;
    cz += (pts[i].z + pts[j].z) * cross;
  }
  if (Math.abs(a) < 1e-8) return null;
  cx /= 3 * a;
  cz /= 3 * a;
  const eaveY = y + 0.02;
  const yp = eaveY + peak;
  const pos = [];
  const uv = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    pos.push(p.x, eaveY, p.z, q.x, eaveY, q.z, cx, yp, cz);
    uv.push(0, 0, 1, 0, 0.5, 1);
  }
  return finishRoof(pos, uv);
}

/**
 * Toit d’immeuble : deux pentes si le plan est assez rectangulaire,
 * croupe si petit et convexe, sinon couvercle plat (pas de tente cassée).
 */
export function pitchedRoofGeometry(ring, y) {
  if (!ring || ring.length < 3) return null;
  const pts = ensureCcwXZ(ringPointsXZ(ring));
  if (pts.length < 3) return null;
  const pca = pcaXZ(pts);
  const area = areaXZ(pts);
  if (pca.width < 2.2 || pca.len < 2.2 || area < 8) return null;
  const fill = area / Math.max(pca.len * pca.width, 1);

  if (area > 1400 || pca.len > 68 || pca.width > 26 || fill < 0.64) {
    return lidRoofGeometry(pts, y);
  }
  if (fill >= 0.7 && pca.width <= 22 && pca.len <= 56) {
    return obbGableRoof(pca, y);
  }
  if (isConvexXZ(pts) && area < 420 && pca.len < 30) {
    return hipToCentroid(pts, y, THREE.MathUtils.clamp(pca.width * 0.28, 1.8, 3.6));
  }
  return lidRoofGeometry(pts, y);
}

export function hipRoofGeometry(ring, y) {
  return pitchedRoofGeometry(ring, y);
}

/** Toit à deux pentes sur un pavé : egouts = périmètre exact, faîtage au centre. */
export function boxRoofGeometry(w, d, y, peakH) {
  const x0 = -w / 2;
  const x1 = w / 2;
  const z0 = -d / 2;
  const z1 = d / 2;
  const ye = y;
  const yp = y + Math.max(peakH, 0.5);
  const pos = [];
  const uv = [];
  const tri = (ax, ay, az, bx, by, bz, cx, cy, cz) => {
    pos.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    uv.push(0, 0, 1, 0, 0.5, 1);
  };
  if (w >= d) {
    // Faîtage // X (z = 0)
    tri(x0, ye, z1, x1, ye, z1, x1, yp, 0);
    tri(x0, ye, z1, x1, yp, 0, x0, yp, 0);
    tri(x1, ye, z0, x0, ye, z0, x0, yp, 0);
    tri(x1, ye, z0, x0, yp, 0, x1, yp, 0);
    tri(x0, ye, z0, x0, ye, z1, x0, yp, 0);
    tri(x1, ye, z1, x1, ye, z0, x1, yp, 0);
  } else {
    // Faîtage // Z (x = 0) — cas Opéra / longs pavés
    tri(x0, ye, z0, x0, ye, z1, 0, yp, z1);
    tri(x0, ye, z0, 0, yp, z1, 0, yp, z0);
    tri(x1, ye, z1, x1, ye, z0, 0, yp, z0);
    tri(x1, ye, z1, 0, yp, z0, 0, yp, z1);
    tri(x0, ye, z0, x1, ye, z0, 0, yp, z0);
    tri(x1, ye, z1, x0, ye, z1, 0, yp, z1);
  }
  return finishRoof(pos, uv);
}

export function goldMaterial(nightUniform) {
  const mat = new THREE.MeshStandardMaterial({
    color: PALETTE.gold,
    roughness: 0.16,
    metalness: 0.72,
    emissive: PALETTE.goldBright,
    emissiveIntensity: 0.04,
  });
  mat.userData.night = nightUniform;
  return mat;
}

export function shapeFromCoords(coords) {
  const pts = [];
  const n = coords.length;
  const closed =
    n > 1 &&
    Math.abs(coords[0][0] - coords[n - 1][0]) < 1e-9 &&
    Math.abs(coords[0][1] - coords[n - 1][1]) < 1e-9;
  const last = closed ? n - 1 : n;
  for (let i = 0; i < last; i++) {
    const { x, z } = toXZ(coords[i][0], coords[i][1]);
    pts.push(new THREE.Vector2(x, -z));
  }
  if (pts.length < 3) return null;
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  if (area < 0) pts.reverse();
  return new THREE.Shape(pts);
}

export function extrudeShape(shape, height) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 1,
  });
  geo.rotateX(-Math.PI / 2);
  stripTopCap(geo, height - 0.02);
  geo.computeVertexNormals();
  return geo;
}

/** Enlève le dessus du cube : le toit se raccorde aux murs. */
function stripTopCap(geo, yMin) {
  const pos = geo.getAttribute("position");
  if (!pos) return;
  const src = geo.index;
  const keep = [];
  const faceCount = src ? src.count / 3 : pos.count / 3;
  for (let f = 0; f < faceCount; f++) {
    const i0 = src ? src.getX(f * 3) : f * 3;
    const i1 = src ? src.getX(f * 3 + 1) : f * 3 + 1;
    const i2 = src ? src.getX(f * 3 + 2) : f * 3 + 2;
    if (pos.getY(i0) >= yMin && pos.getY(i1) >= yMin && pos.getY(i2) >= yMin) continue;
    keep.push(i0, i1, i2);
  }
  geo.setIndex(keep);
}

export function flatShape(shape, y) {
  const geo = new THREE.ShapeGeometry(shape, 2);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, y, 0);
  geo.computeVertexNormals();
  return geo;
}

/** Aplat avec une vraie épaisseur — évite le z-fighting au dézoom. */
export function slabShape(shape, height = 0.42, y0 = 0) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
    steps: 1,
    curveSegments: 2,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, y0, 0);
  geo.computeVertexNormals();
  return geo;
}

export function decalMaterial(color, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: opts.roughness ?? 0.88,
    metalness: opts.metalness ?? 0,
    emissive: opts.emissive ?? new THREE.Color("#000000"),
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    polygonOffset: true,
    polygonOffsetFactor: opts.factor ?? -2,
    polygonOffsetUnits: opts.units ?? -4,
    depthWrite: true,
    transparent: false,
  });
}

export function ribbonGeometry(coords, width) {
  const pts = [];
  for (const [lon, lat] of coords) {
    const { x, z } = toXZ(lon, lat);
    pts.push(new THREE.Vector3(x, 0.2, z));
  }
  if (pts.length < 2) return null;
  const pos = [];
  const nrm = [];
  const half = width * 0.5;
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    const dir = new THREE.Vector3().subVectors(next, prev);
    dir.y = 0;
    if (dir.lengthSq() < 1e-6) dir.set(1, 0, 0);
    dir.normalize();
    const side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(half);
    const a = pts[i].clone().add(side);
    const b = pts[i].clone().sub(side);
    pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
    nrm.push(0, 1, 0, 0, 1, 0);
  }
  const idx = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const i0 = i * 2;
    idx.push(i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  geo.setIndex(idx);
  return geo;
}
