import * as THREE from "three";
import { hash01, pointInRing, toXZ } from "./geo.js";
import { PALETTE, goldMaterial, snowCoverMaterial } from "./materials.js";
import { AXIS_YAW } from "./stanislas.js";

function rotXZ(lx, lz) {
  const c = Math.cos(AXIS_YAW);
  const s = Math.sin(AXIS_YAW);
  return { x: lx * c + lz * s, z: -lx * s + lz * c };
}

function makeKiosk(nightUniform) {
  const g = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: "#e6d8c4", roughness: 0.55 });
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(6.4, 3.6, 8),
    snowCoverMaterial(new THREE.MeshStandardMaterial({ color: PALETTE.roofSlate, roughness: 0.5 }))
  );
  roof.position.y = 8.4;
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(5.6, 5.8, 0.35, 8), stone);
  floor.position.y = 0.2;
  const gold = goldMaterial(nightUniform);
  gold.emissiveIntensity = 0.05;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 6.4, 8), stone);
    col.position.set(Math.cos(a) * 4.6, 3.4, Math.sin(a) * 4.6);
    g.add(col);
  }
  const rail = new THREE.Mesh(new THREE.TorusGeometry(4.7, 0.08, 6, 8), gold);
  rail.rotation.x = Math.PI / 2;
  rail.position.y = 3.2;
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), gold);
  finial.position.y = 10.4;
  g.add(roof, floor, rail, finial);
  return g;
}

function makeParkBasin(nightUniform) {
  const g = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: "#ddd2c0", roughness: 0.6 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(5.2, 0.28, 6, 24), stone);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.35;
  const water = new THREE.Mesh(
    new THREE.CylinderGeometry(5.0, 5.0, 0.16, 24),
    new THREE.MeshStandardMaterial({
      color: "#5e8a92",
      roughness: 0.12,
      metalness: 0.35,
      transparent: true,
      opacity: 0.75,
    })
  );
  water.position.y = 0.22;
  g.add(rim, water);
  return g;
}

export function dressPepiniere(root, rings, nightUniform) {
  const ring = rings[0];
  if (!ring) return;

  const treeGeo = new THREE.SphereGeometry(2.8, 7, 5);
  const pineGeo = new THREE.ConeGeometry(3.1, 8.5, 6);
  const trunkGeo = new THREE.CylinderGeometry(0.32, 0.42, 2.1, 5);
  const leafA = new THREE.MeshStandardMaterial({ color: PALETTE.tree, roughness: 0.85 });
  const leafB = new THREE.MeshStandardMaterial({ color: "#6a8a52", roughness: 0.82 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: PALETTE.trunk, roughness: 0.9 });
  const dummy = new THREE.Object3D();
  const spots = [];
  let guard = 0;
  while (spots.length < 240 && guard < 5000) {
    guard++;
    const lon = 6.1804 + Math.random() * 0.0085;
    const lat = 48.6952 + Math.random() * 0.0054;
    if (pointInRing(lon, lat, ring)) spots.push([lon, lat]);
  }
  const round = spots.filter((_, i) => hash01(i) > 0.38);
  const pine = spots.filter((_, i) => hash01(i) <= 0.38);
  const addInst = (geo, mat, list, yMul) => {
    if (!list.length) return;
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, list.length);
    list.forEach(([lon, lat], i) => {
      const p = toXZ(lon, lat);
      const s = 0.75 + hash01(i + 9) * 0.65;
      dummy.position.set(p.x, yMul * s, p.z);
      dummy.scale.set(s, s, s);
      dummy.rotation.y = hash01(i) * 6;
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      dummy.position.set(p.x, 1.05, p.z);
      dummy.scale.set(s, 1, s);
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);
    });
    mesh.castShadow = true;
    root.add(mesh, trunks);
  };
  addInst(treeGeo, leafA, round, 4.4);
  addInst(pineGeo, leafB, pine, 5.8);

  const kiosk = makeKiosk(nightUniform);
  const kp = toXZ(6.18515, 48.69705);
  kiosk.position.set(kp.x, 0, kp.z);
  root.add(kiosk);

  const basin = makeParkBasin(nightUniform);
  const bp = toXZ(6.1842, 48.69655);
  basin.position.set(bp.x, 0, bp.z);
  root.add(basin);

  const rose = new THREE.Mesh(
    new THREE.BoxGeometry(18, 0.18, 12),
    new THREE.MeshStandardMaterial({ color: "#7a3a42", roughness: 0.7 })
  );
  const rp = toXZ(6.1856, 48.6964);
  rose.position.set(rp.x, 0.12, rp.z);
  rose.rotation.y = AXIS_YAW;
  root.add(rose);
}

export function dressCarriere(root, nightUniform) {
  const origin = toXZ(6.18176, 48.69574);
  const gold = goldMaterial(nightUniform);
  gold.emissiveIntensity = 0.04;
  const gravel = new THREE.Mesh(
    new THREE.BoxGeometry(28, 0.1, 210),
    new THREE.MeshStandardMaterial({ color: PALETTE.carriere, roughness: 0.78 })
  );
  gravel.position.set(origin.x, 0.09, origin.z);
  gravel.rotation.y = AXIS_YAW;
  gravel.receiveShadow = true;
  root.add(gravel);

  const leaf = new THREE.MeshStandardMaterial({ color: "#5c7a48", roughness: 0.84 });
  const trunkMat = new THREE.MeshStandardMaterial({ color: PALETTE.trunk, roughness: 0.9 });
  const canopy = new THREE.SphereGeometry(3.2, 7, 5);
  const trunk = new THREE.CylinderGeometry(0.28, 0.38, 2.4, 5);
  for (const side of [-16, 16]) {
    for (let i = -7; i <= 8; i++) {
      const loc = rotXZ(side, i * 12);
      const x = origin.x + loc.x;
      const z = origin.z + loc.z;
      const c = new THREE.Mesh(canopy, leaf);
      c.position.set(x, 5.1, z);
      c.castShadow = true;
      const t = new THREE.Mesh(trunk, trunkMat);
      t.position.set(x, 1.2, z);
      root.add(c, t);
    }
  }

  for (const side of [-14.2, 14.2]) {
    const fence = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.15, 196), gold);
    const loc = rotXZ(side, 0);
    fence.position.set(origin.x + loc.x, 0.7, origin.z + loc.z);
    fence.rotation.y = AXIS_YAW;
    root.add(fence);
  }

  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 2.6, 3.2),
    new THREE.MeshStandardMaterial({ color: "#d8cbb6", roughness: 0.55 })
  );
  const mid = rotXZ(0, 8);
  plinth.position.set(origin.x + mid.x, 1.3, origin.z + mid.z);
  plinth.rotation.y = AXIS_YAW;
  root.add(plinth);
}
