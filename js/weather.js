import * as THREE from "three";

export function createPrecip(scene) {
  const count = 14000;
  const positions = new Float32Array(count * 3);
  const speeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 900;
    positions[i * 3 + 1] = Math.random() * 220;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 900;
    speeds[i] = 10 + Math.random() * 16;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: "#f4f7fb",
    size: 1.8,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  points.visible = false;
  points.frustumCulled = false;
  scene.add(points);
  return { points, speeds, count };
}

export function updatePrecip(wx, dt, mode) {
  const on = mode === "snow";
  wx.points.visible = on;
  if (!on) return;
  const pos = wx.points.geometry.attributes.position.array;
  for (let i = 0; i < wx.count; i++) {
    pos[i * 3 + 1] -= wx.speeds[i] * dt;
    pos[i * 3] += dt * 2.2;
    if (pos[i * 3 + 1] < 0) {
      pos[i * 3 + 1] = 140 + Math.random() * 50;
      pos[i * 3] = (Math.random() - 0.5) * 900;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 900;
    }
  }
  wx.points.geometry.attributes.position.needsUpdate = true;
}
