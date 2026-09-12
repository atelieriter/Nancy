/** Projection locale centrée sur la Place Stanislas. X = est, Z = sud. */
export const ORIGIN = { lat: 48.69361, lon: 6.18306 };
export const M_LAT = 111320;
export const M_LON = 111320 * Math.cos((ORIGIN.lat * Math.PI) / 180);

/** Emprise OSM du centre — le rectangle couvert par la maquette. */
export const OSM_BBOX = { south: 48.6865, west: 6.168, north: 48.7015, east: 6.1975 };

export function plateauRect(bbox = OSM_BBOX) {
  const sw = toXZ(bbox.west, bbox.south);
  const ne = toXZ(bbox.east, bbox.north);
  const minX = Math.min(sw.x, ne.x);
  const maxX = Math.max(sw.x, ne.x);
  const minZ = Math.min(sw.z, ne.z);
  const maxZ = Math.max(sw.z, ne.z);
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    w: maxX - minX,
    d: maxZ - minZ,
    cx: (minX + maxX) * 0.5,
    cz: (minZ + maxZ) * 0.5,
  };
}

export function toXZ(lon, lat) {
  return {
    x: (lon - ORIGIN.lon) * M_LON,
    z: -(lat - ORIGIN.lat) * M_LAT,
  };
}

export function fromLonLat(lon, lat, y = 0) {
  const { x, z } = toXZ(lon, lat);
  return { x, y, z };
}

export function hash01(n) {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

export function polyAreaM2(coords) {
  if (!coords || coords.length < 3) return 0;
  let a = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    a += coords[i][0] * coords[i + 1][1] - coords[i + 1][0] * coords[i][1];
  }
  return Math.abs(a) * 0.5 * M_LON * M_LAT;
}

export function centroid(coords) {
  if (!coords?.length) return [ORIGIN.lon, ORIGIN.lat];
  let x = 0;
  let y = 0;
  for (const c of coords) {
    x += c[0];
    y += c[1];
  }
  return [x / coords.length, y / coords.length];
}

export function closedRing(coords) {
  if (!coords?.length) return [];
  const out = coords.map((c) => [c[0], c[1]]);
  const a = out[0];
  const b = out[out.length - 1];
  if (a[0] !== b[0] || a[1] !== b[1]) out.push([a[0], a[1]]);
  return out;
}

export function simplify(coords, minM = 1.6) {
  if (!coords || coords.length < 4) return coords;
  const min2 = minM * minM;
  const out = [coords[0]];
  for (let i = 1; i < coords.length - 1; i++) {
    const p = out[out.length - 1];
    const dx = (coords[i][0] - p[0]) * M_LON;
    const dz = (coords[i][1] - p[1]) * M_LAT;
    if (dx * dx + dz * dz >= min2) out.push(coords[i]);
  }
  out.push(coords[coords.length - 1]);
  return out;
}

export function pointInRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const hit =
      yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

export function inVieuxNancy(lon, lat) {
  return lat > 48.69435 && lat < 48.6996 && lon > 6.1764 && lon < 6.1854;
}

/** Médiane d'un nuage de points [lon,lat], binned selon un axe, pour extraire un tracé. */
export function binnedPath(points, axis = "lat", precision = 4) {
  const bins = new Map();
  for (const [lon, lat] of points) {
    const key = axis === "lat" ? lat.toFixed(precision) : lon.toFixed(precision);
    if (!bins.has(key)) bins.set(key, []);
    bins.get(key).push([lon, lat]);
  }
  const keys = [...bins.keys()].sort((a, b) => Number(a) - Number(b));
  return keys.map((k) => {
    const arr = bins.get(k);
    arr.sort((p, q) => (axis === "lat" ? p[0] - q[0] : p[1] - q[1]));
    return arr[Math.floor(arr.length / 2)];
  });
}
