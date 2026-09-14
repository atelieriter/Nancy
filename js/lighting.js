import * as THREE from "three";

export function createLighting(scene) {
  const hemi = new THREE.HemisphereLight("#cfe4f5", "#8a7358", 0.7);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight("#fff4d6", 2.2);
  sun.position.set(180, 280, 80);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 900;
  sun.shadow.camera.left = -420;
  sun.shadow.camera.right = 420;
  sun.shadow.camera.top = 420;
  sun.shadow.camera.bottom = -420;
  sun.shadow.bias = -0.00015;
  scene.add(sun);
  scene.add(sun.target);

  const fill = new THREE.DirectionalLight("#9bb7d4", 0.25);
  fill.position.set(-120, 80, -90);
  scene.add(fill);

  const amb = new THREE.AmbientLight("#d8c6ab", 0.38);
  scene.add(amb);

  return { hemi, sun, fill, spots: [], amb };
}

/**
 * Ciel en dégradé selon l’heure.
 * Matin rose-bleu → jour blanc-bleu → jaune-bleu → orange-jaune
 * → rouge/rose-orange → bleu nuit / rose → anthracite → gris-rose.
 */
const SKY_KEYS = [
  { h: 0.0, zenith: "#0c1018", horizon: "#1a1c22", fog: "#14161c", sun: "#cdd6ea", sunI: 0.22, hemiI: 0.2, hemiSky: "#1a2030", hemiGnd: "#141210" },
  { h: 3.4, zenith: "#1c1824", horizon: "#8a6e78", fog: "#5a4a52", sun: "#e0c8d0", sunI: 0.24, hemiI: 0.22, hemiSky: "#4a3a48", hemiGnd: "#2a2220" },
  { h: 5.4, zenith: "#6a8cb8", horizon: "#f2b6c6", fog: "#e8c0c8", sun: "#ffb07a", sunI: 0.7, hemiI: 0.38, hemiSky: "#f0c6d4", hemiGnd: "#8a6a55" },
  { h: 7.6, zenith: "#7eb0d8", horizon: "#ffe8f0", fog: "#e8dce4", sun: "#ffd0a8", sunI: 1.0, hemiI: 0.58, hemiSky: "#f0d8e4", hemiGnd: "#8a7a62" },
  { h: 10.0, zenith: "#4a96c8", horizon: "#f2f6fb", fog: "#dce6ee", sun: "#fff1c8", sunI: 1.1, hemiI: 0.68, hemiSky: "#d0e4f4", hemiGnd: "#8a7a62" },
  { h: 13.5, zenith: "#3e8ec4", horizon: "#eef4f8", fog: "#d4dee6", sun: "#fff4d0", sunI: 1.12, hemiI: 0.7, hemiSky: "#c8dcec", hemiGnd: "#8a7a62" },
  { h: 16.0, zenith: "#4a88c0", horizon: "#ffe9a8", fog: "#eee0c0", sun: "#ffe08a", sunI: 1.15, hemiI: 0.72, hemiSky: "#f0e0b8", hemiGnd: "#9a7a58" },
  { h: 17.4, zenith: "#5a78b4", horizon: "#ffb45a", fog: "#f0c888", sun: "#ffb05a", sunI: 1.35, hemiI: 0.78, hemiSky: "#f0c898", hemiGnd: "#b08968" },
  { h: 18.5, zenith: "#8a4868", horizon: "#ff8a4a", fog: "#e8a878", sun: "#ff8a4a", sunI: 1.2, hemiI: 0.7, hemiSky: "#f0b0a0", hemiGnd: "#b08978" },
  { h: 19.6, zenith: "#1a2848", horizon: "#e87888", fog: "#c87888", sun: "#e8a0b0", sunI: 0.55, hemiI: 0.42, hemiSky: "#c9a0b4", hemiGnd: "#6a5048" },
  { h: 21.6, zenith: "#0e1424", horizon: "#2a1c28", fog: "#18141c", sun: "#c8b0c8", sunI: 0.28, hemiI: 0.22, hemiSky: "#1a2744", hemiGnd: "#1a1612" },
  { h: 24.0, zenith: "#0c1018", horizon: "#1a1c22", fog: "#14161c", sun: "#cdd6ea", sunI: 0.22, hemiI: 0.2, hemiSky: "#1a2030", hemiGnd: "#141210" },
];

function lerpKey(a, b, t) {
  const mix = (ha, hb) => new THREE.Color(ha).lerp(new THREE.Color(hb), t);
  return {
    zenith: mix(a.zenith, b.zenith),
    horizon: mix(a.horizon, b.horizon),
    fog: mix(a.fog, b.fog),
    sun: mix(a.sun, b.sun),
    sunI: a.sunI + (b.sunI - a.sunI) * t,
    hemiI: a.hemiI + (b.hemiI - a.hemiI) * t,
    hemiSky: mix(a.hemiSky, b.hemiSky),
    hemiGnd: mix(a.hemiGnd, b.hemiGnd),
  };
}

function sampleSky(hour) {
  const h = ((hour % 24) + 24) % 24;
  for (let i = 0; i < SKY_KEYS.length - 1; i++) {
    const a = SKY_KEYS[i];
    const b = SKY_KEYS[i + 1];
    if (h >= a.h && h <= b.h) {
      const t = (h - a.h) / (b.h - a.h || 1);
      const s = t * t * (3 - 2 * t);
      return lerpKey(a, b, s);
    }
  }
  return lerpKey(SKY_KEYS[0], SKY_KEYS[1], 0);
}

/** hour in [0, 24). Returns visual state. */
export function sampleDay(hour) {
  const h = ((hour % 24) + 24) % 24;
  const dusk = smoothstep(17.0, 19.2, h) * (1 - smoothstep(20.2, 22.0, h));
  const nightAmt = THREE.MathUtils.clamp(
    1 - smoothstep(5.0, 7.6, h) + smoothstep(18.3, 20.6, h),
    0,
    1
  );

  const sunAngle = ((h - 6) / 12) * Math.PI;
  const elev = Math.sin(sunAngle);
  const az = (h / 24) * Math.PI * 2 - Math.PI / 2;
  const sky = sampleSky(h);

  return {
    hour: h,
    night: nightAmt,
    elev,
    az,
    sky: sky.zenith,
    horizon: sky.horizon,
    fog: sky.fog,
    sunColor: sky.sun,
    sunInt: Math.max(0.12, sky.sunI),
    hemiInt: sky.hemiI,
    hemiSky: sky.hemiSky,
    hemiGround: sky.hemiGnd,
    goldBoost: THREE.MathUtils.clamp(nightAmt * 0.85 + dusk * 0.25, 0, 1.1),
  };
}

export function applyDay(state, lighting, scene, nightUniform, weather = "sun") {
  const snowOn = weather === "snow";
  nightUniform.value = state.night;
  const bg = snowOn && state.night < 0.45 ? new THREE.Color("#d4dde6") : state.horizon.clone();
  scene.background = bg;
  scene.fog.color.copy(snowOn ? new THREE.Color("#d8dee6") : state.fog);
  scene.fog.density = snowOn ? 0.0007 : 0.00004 + state.night * 0.00018;

  lighting.hemi.intensity = state.hemiInt;
  lighting.hemi.color.copy(state.hemiSky);
  lighting.hemi.groundColor.copy(state.hemiGround);
  if (lighting.amb) lighting.amb.intensity = 0.22 + (1 - state.night) * 0.28;

  const r = 420;
  const y = Math.max(18, state.elev * 340);
  lighting.sun.position.set(Math.cos(state.az) * r, y, Math.sin(state.az) * r);
  lighting.sun.color.copy(state.sunColor);
  lighting.sun.intensity = state.sunInt * (snowOn ? 0.48 : 1);
  lighting.sun.target.position.set(0, 0, 0);

  const lampI = (0.22 + state.night * 6.4 + state.goldBoost * 0.8) * (snowOn ? 0.8 : 1);
  for (const s of lighting.spots || []) s.intensity = lampI;

  if (lighting.lanternMat) {
    lighting.lanternMat.emissiveIntensity = 0.28 + state.night * 1.85;
  }
  if (lighting.poolMat) lighting.poolMat.opacity = state.night * 0.78;
}

function smoothstep(a, b, x) {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
