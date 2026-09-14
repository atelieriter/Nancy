import * as THREE from "three";
import { OrbitControls } from "../vendor/OrbitControls.js";
import { makeNightUniform, snowUniform, snowTintUniform } from "./materials.js";
import { buildCity, LANDMARKS } from "./city.js";
import { createLighting, sampleDay, applyDay } from "./lighting.js";
import { createPrecip, updatePrecip } from "./weather.js";
import { updateLife, createCelestial, applyCelestial } from "./life.js";
import { toXZ, plateauRect } from "./geo.js";

const canvas = document.getElementById("c");
const loader = document.getElementById("loader");
const bar = document.querySelector("#bar > i");
const hourEl = document.getElementById("hour");
const clockEl = document.getElementById("clock");
const periodEl = document.getElementById("period");
const wxSun = document.getElementById("wx-sun");
const wxSnow = document.getElementById("wx-snow");
const placesEl = document.getElementById("places");
const placeCountEl = document.getElementById("place-count");
const explorerEl = document.getElementById("explorer");
const explorerToggle = document.getElementById("explorer-toggle");
const dockEl = document.getElementById("dock");
const dockToggle = document.getElementById("dock-toggle");

const isMobile = () => window.matchMedia("(max-width: 780px)").matches;

function setPanel(el, btn, open) {
  el?.classList.toggle("open", open);
  btn?.setAttribute("aria-expanded", open ? "true" : "false");
}

function syncPanels() {
  const mobile = isMobile();
  setPanel(explorerEl, explorerToggle, !mobile);
  setPanel(dockEl, dockToggle, !mobile);
}

let lastMobile = isMobile();
syncPanels();
window.addEventListener("resize", () => {
  const mobile = isMobile();
  if (mobile === lastMobile) return;
  lastMobile = mobile;
  syncPanels();
});

explorerToggle?.addEventListener("click", () => {
  if (!isMobile()) return;
  setPanel(explorerEl, explorerToggle, !explorerEl.classList.contains("open"));
});
dockToggle?.addEventListener("click", () => {
  if (!isMobile()) return;
  setPanel(dockEl, dockToggle, !dockEl.classList.contains("open"));
});

const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile(), powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile() ? 1.2 : 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = !isMobile();
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2("#c8d6c0", 0.00075);

const plate = plateauRect();
const camera = new THREE.PerspectiveCamera(46, window.innerWidth / window.innerHeight, 2.4, 9000);
camera.position.set(plate.cx - 380, 780, plate.cz + 1860);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = true;
controls.screenSpacePanning = true;
controls.panSpeed = 1.35;
controls.rotateSpeed = 0.72;
controls.minDistance = 50;
controls.maxDistance = 3200;
controls.minPolarAngle = 0.12;
controls.maxPolarAngle = Math.PI * 0.495;
controls.target.set(plate.cx, 2, plate.cz);
controls.autoRotate = false;
controls.touches.ONE = THREE.TOUCH.PAN;
controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;

const celestial = createCelestial();
scene.add(celestial.group);
scene.add(celestial.world);

const nightUniform = makeNightUniform();
const lighting = createLighting(scene);
const precip = createPrecip(scene);

let city = null;
let hour = 14.5;
let weather = "sun";
let fly = null;

function fail(err) {
  const p = loader?.querySelector("p");
  if (p) p.textContent = err?.message || String(err);
  console.error(err);
}

function setProgress(t, label) {
  if (bar) bar.style.width = `${Math.round(t * 100)}%`;
  const p = loader?.querySelector("p");
  if (label && p) p.textContent = label;
}

function fmtHour(h) {
  const hh = Math.floor(h) % 24;
  const mm = Math.round((h - Math.floor(h)) * 60) % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function periodOf(h) {
  if (h >= 5 && h < 8) return "L’aube";
  if (h >= 8 && h < 12) return "Le matin";
  if (h >= 12 && h < 18) return "L’après-midi";
  if (h >= 18 && h < 22) return "Le soir";
  return "La nuit";
}

function applyHour() {
  const state = sampleDay(hour);
  snowUniform.value = weather === "snow" ? 1 : 0;
  snowTintUniform.value.copy(state.sunColor);
  applyDay(state, lighting, scene, nightUniform, weather);
  applyCelestial(celestial, state, camera);
  if (clockEl) clockEl.textContent = fmtHour(hour);
  if (periodEl) periodEl.textContent = periodOf(hour);
  document.body.classList.toggle("is-night", state.night > 0.48);
}

if (hourEl) {
  hourEl.value = String(hour);
  hourEl.addEventListener("input", () => {
    hour = parseFloat(hourEl.value);
    applyHour();
  });
}
function setWeather(mode) {
  weather = mode;
  wxSun?.classList.toggle("on", mode === "sun");
  wxSnow?.classList.toggle("on", mode === "snow");
  wxSun?.setAttribute("aria-pressed", mode === "sun" ? "true" : "false");
  wxSnow?.setAttribute("aria-pressed", mode === "snow" ? "true" : "false");
  applyHour();
}
wxSun?.addEventListener("click", () => setWeather("sun"));
wxSnow?.addEventListener("click", () => setWeather("snow"));

if (placeCountEl) placeCountEl.textContent = String(LANDMARKS.length).padStart(2, "0");

LANDMARKS.forEach((lm, i) => {
  const btn = document.createElement("button");
  btn.innerHTML = `<span class="n">${String(i + 1).padStart(2, "0")}</span><span class="t">${lm.name}</span><span class="s">${lm.sub || ""}</span>`;
  btn.addEventListener("click", () => {
    const p = toXZ(lm.lon, lm.lat);
    const offsets = {
      gare: { dx: -30, dy: 48, dz: 55 },
      canal: { dx: -140, dy: 95, dz: 30 },
      craffe: { dx: -35, dy: 45, dz: 70 },
      pepiniere: { dx: -60, dy: 90, dz: 120 },
      "tour-mairie": { dx: -40, dy: 62, dz: -155 },
      "tour-gare": { dx: -50, dy: 90, dz: 80 },
      "tour-canal": { dx: -170, dy: 95, dz: 35 },
    };
    const o = offsets[lm.id] || { dx: -85, dy: 78, dz: 105 };
    fly = {
      fromCam: camera.position.clone(),
      fromTgt: controls.target.clone(),
      toTgt: new THREE.Vector3(p.x, 8, p.z),
      toCam: new THREE.Vector3(p.x + o.dx, o.dy, p.z + o.dz),
      t: 0,
    };
    if (isMobile()) setPanel(explorerEl, explorerToggle, false);
  });
  placesEl?.appendChild(btn);
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let lastT = performance.now();

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min((now - lastT) / 1000, 0.05);
  lastT = now;
  if (city) updateLife(city, dt, nightUniform.value, hour);
  updatePrecip(precip, dt, weather);
  if (fly) {
    fly.t = Math.min(1, fly.t + dt * 0.7);
    const k = 1 - Math.pow(1 - fly.t, 3);
    camera.position.lerpVectors(fly.fromCam, fly.toCam, k);
    controls.target.lerpVectors(fly.fromTgt, fly.toTgt, k);
    if (fly.t >= 1) fly = null;
  }
  controls.update();
  celestial.group.position.copy(camera.position);
  applyCelestial(celestial, sampleDay(hour), camera);
  renderer.render(scene, camera);
}

async function start() {
  setProgress(0.04, "Chargement des traces OSM…");
  const res = await fetch("./data/nancy.json");
  if (!res.ok) throw new Error("Cache OSM introuvable. Relancez ./run.sh");
  const data = await res.json();
  setProgress(0.12, `${data.counts?.buildings ?? "—"} bâtiments · extrusion…`);
  city = await buildCity(scene, data, nightUniform, (t) => setProgress(t, "Pierre de Jaumont, toits d’ardoise…"));
  city.stars = celestial.stars;
  city.debris = celestial.debris;
  lighting.spots = city.lampLights || [];
  lighting.lanternMat = city.lampMats?.lantern;
  lighting.poolMat = city.lampMats?.pool;
  applyHour();
  setProgress(1, "Cité des Ducs");
  await new Promise((r) => setTimeout(r, 280));
  loader.classList.add("hidden");
}

animate();
start().catch(fail);
window.addEventListener("unhandledrejection", (e) => fail(e.reason));
window.addEventListener("error", (e) => fail(e.error || e.message));
