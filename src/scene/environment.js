import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { Sky } from 'three/addons/objects/Sky.js';

// Tried in order. The first two are high-res Poly Haven skies (CC0): a local
// copy pulled by `npm run fetch-assets`, then the Poly Haven CDN directly.
// The bundled 1k quarry HDRI keeps the app working offline.
export const HDRI_SOURCES = [
  { label: 'Partly cloudy sky (local 4k)', url: `${import.meta.env.BASE_URL}hdri/kloofendal_48d_partly_cloudy_puresky_4k.hdr` },
  {
    label: 'Partly cloudy sky (Poly Haven 2k)',
    url: 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/2k/kloofendal_48d_partly_cloudy_puresky_2k.hdr',
  },
  { label: 'Quarry (bundled 1k)', url: `${import.meta.env.BASE_URL}hdri/quarry_01_1k.hdr` },
  // Same file base64-wrapped, for static hosts that won't serve .hdr.
  { label: 'Quarry (bundled 1k)', url: `${import.meta.env.BASE_URL}hdri/quarry_01_1k.hdr.b64.txt` },
];

// Target sky radiance after normalisation. The directional sun delivers ~3.2
// units at normal incidence; a clear sky adds ~π·0.13 ≈ 0.4 on a horizontal
// surface, giving the ~7:1 sun/shade contrast of a clear summer day.
const SKY_RADIANCE = 0.13;

const { fromHalfFloat, toHalfFloat } = THREE.DataUtils;

/**
 * Image-based lighting that stays consistent with the simulated sun.
 *
 * HDRI mode: the raw equirect goes to `scene.background` (sharp), while
 * `scene.environment` gets a copy with the photographed sun clamped out, since
 * the DirectionalLight supplies direct sun. Both are rotated so the HDRI's sun
 * sits at the simulated azimuth.
 *
 * Sky mode: three's physical Sky shader, re-baked into a PMREM as the sun moves.
 */
export class SkyEnvironment {
  constructor(renderer, scene, { fogDensity = 0.0026 } = {}) {
    this.renderer = renderer;
    this.scene = scene;
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.mode = 'hdri';
    this.hdri = null; // { background, environment, sunAzimuth, scale, label }

    this.sky = new Sky();
    this.sky.scale.setScalar(4000);
    const u = this.sky.material.uniforms;
    u.turbidity.value = 4;
    u.rayleigh.value = 1.2;
    u.mieCoefficient.value = 0.004;
    u.mieDirectionalG.value = 0.8;

    this.skyScene = new THREE.Scene();
    this.skyForBake = new Sky();
    this.skyForBake.scale.setScalar(100);
    this.skyForBake.material = this.sky.material;
    this.skyScene.add(this.skyForBake);
    this.skyTarget = null;
    this.lastBakeDir = new THREE.Vector3(0, -1, 0);

    // Distance haze so the ground plane melts into the horizon.
    scene.fog = new THREE.FogExp2(0xffffff, fogDensity);
  }

  async loadHDRI(onStatus = () => {}) {
    const loader = new HDRLoader();
    // The standalone single-file build carries the bundled sky inline, since a
    // page opened from disk can't fetch files next to it.
    const sources = globalThis.__YARD_HDRI_B64
      ? [HDRI_SOURCES[1], { label: 'Quarry (bundled 1k)', url: 'embedded:quarry_01_1k' }]
      : HDRI_SOURCES;
    for (const src of sources) {
      try {
        onStatus(`Loading ${src.label}…`);
        const tex = await loadHDR(loader, src.url);
        this.hdri = prepareHDRI(tex, src.label);
        return src.label;
      } catch (err) {
        console.info(`[sky] ${src.label} unavailable (${src.url})`);
      }
    }
    this.mode = 'sky';
    return null;
  }

  setMode(mode) {
    this.mode = mode === 'hdri' && this.hdri ? 'hdri' : 'sky';
    this.lastBakeDir.set(0, -1, 0);
  }

  /** Takes the sky out of the scene (used by the schematic view). */
  hide() {
    if (this.sky.parent) this.scene.remove(this.sky);
    this.scene.environment = null;
    this.scene.backgroundRotation.set(0, 0, 0);
    this.scene.environmentRotation.set(0, 0, 0);
  }

  /** Call whenever the sun moves. */
  update(sunDir, daylight) {
    const scene = this.scene;
    const dim = Math.max(daylight, 0.015);

    if (this.mode === 'hdri') {
      if (this.sky.parent) scene.remove(this.sky);
      const h = this.hdri;
      scene.background = h.background;
      scene.environment = h.environment;
      // Rotate the photographed sun onto the simulated sun's azimuth.
      const rot = Math.atan2(sunDir.x, sunDir.z) - h.sunAzimuth;
      scene.backgroundRotation.set(0, rot, 0);
      scene.environmentRotation.set(0, rot, 0);
      scene.backgroundIntensity = h.scale * dim;
      scene.environmentIntensity = h.scale * dim;
      scene.fog.color.copy(h.horizon).multiplyScalar(h.scale * dim);
      return;
    }

    if (!this.sky.parent) scene.add(this.sky);
    scene.background = null;
    scene.backgroundRotation.set(0, 0, 0);
    scene.environmentRotation.set(0, 0, 0);
    this.sky.material.uniforms.sunPosition.value.copy(sunDir);
    scene.backgroundIntensity = 1;
    scene.environmentIntensity = 0.16 * dim;
    scene.fog.color.setRGB(0.5, 0.58, 0.68).multiplyScalar(dim);

    // Re-bake only when the sun has moved noticeably (~1°).
    if (this.lastBakeDir.dot(sunDir) < 0.99985) {
      this.lastBakeDir.copy(sunDir);
      this.skyTarget?.dispose();
      this.skyTarget = this.pmrem.fromScene(this.skyScene, 0, 0.1, 1000);
      scene.environment = this.skyTarget.texture;
    } else if (this.skyTarget) {
      scene.environment = this.skyTarget.texture;
    }
  }
}

async function loadHDR(loader, url) {
  let b64;
  if (url.startsWith('embedded:')) b64 = globalThis.__YARD_HDRI_B64;
  else if (url.endsWith('.b64.txt')) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    b64 = await res.text();
  } else return loader.loadAsync(url);
  const bin = Uint8Array.from(atob(b64.trim()), (c) => c.charCodeAt(0));
  const d = loader.parse(bin.buffer);
  const tex = new THREE.DataTexture(d.data, d.width, d.height, THREE.RGBAFormat, d.type);
  Object.assign(tex, {
    colorSpace: d.colorSpace,
    minFilter: d.minFilter,
    magFilter: d.magFilter,
    generateMipmaps: d.generateMipmaps,
    flipY: d.flipY,
  });
  tex.needsUpdate = true;
  return tex;
}

/**
 * Finds the photographed sun, builds a sun-free copy for lighting, and picks an
 * intensity scale so the sky's brightness matches the simulated sun.
 */
function prepareHDRI(tex, label) {
  const { width: w, height: h, data } = tex.image;
  const isHalf = data instanceof Uint16Array;
  const read = isHalf ? fromHalfFloat : (v) => v;
  const lum = (i) => 0.2126 * read(data[i]) + 0.7152 * read(data[i + 1]) + 0.0722 * read(data[i + 2]);

  // 1. Brightest pixel in the upper hemisphere = the sun. Rows are top-down.
  let best = -1;
  let bestX = 0;
  let bestY = 0;
  const samples = [];
  for (let y = 0; y < h / 2; y++) {
    for (let x = 0; x < w; x++) {
      const l = lum((y * w + x) * 4);
      if (l > best) {
        best = l;
        bestX = x;
        bestY = y;
      }
      if ((x & 7) === 0 && (y & 7) === 0) samples.push(l);
    }
  }
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)] || 1;

  // three's equirect lookup: u = atan(dir.z, dir.x) / 2π + 0.5
  const phi = ((bestX + 0.5) / w - 0.5) * Math.PI * 2;
  const sunAzimuth = Math.atan2(Math.cos(phi), Math.sin(phi)); // atan2(x, z)
  const sunElevation = (0.5 - (bestY + 0.5) / h) * Math.PI;

  // Average colour just above the horizon, for matching distance fog.
  const horizon = new THREE.Color(0, 0, 0);
  const rows = Math.max(1, Math.round(h / 36)); // ~5°
  for (let y = Math.floor(h / 2) - rows; y < h / 2; y++) {
    for (let x = 0; x < w; x += 4) {
      const i = (y * w + x) * 4;
      horizon.r += read(data[i]);
      horizon.g += read(data[i + 1]);
      horizon.b += read(data[i + 2]);
    }
  }
  horizon.multiplyScalar(1 / (rows * Math.ceil(w / 4)));

  // 2. Clamp the sun out of the lighting copy.
  const clamp = median * 12;
  const env = new Uint16Array(data.length);
  for (let i = 0; i < data.length; i += 4) {
    let r = read(data[i]);
    let g = read(data[i + 1]);
    let b = read(data[i + 2]);
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    if (l > clamp) {
      const k = clamp / l;
      r *= k;
      g *= k;
      b *= k;
    }
    env[i] = toHalfFloat(r);
    env[i + 1] = toHalfFloat(g);
    env[i + 2] = toHalfFloat(b);
    env[i + 3] = toHalfFloat(1);
  }

  const envTex = new THREE.DataTexture(env, w, h, THREE.RGBAFormat, THREE.HalfFloatType);
  envTex.mapping = THREE.EquirectangularReflectionMapping;
  envTex.colorSpace = tex.colorSpace;
  envTex.flipY = tex.flipY;
  envTex.minFilter = THREE.LinearFilter;
  envTex.magFilter = THREE.LinearFilter;
  envTex.generateMipmaps = false;
  envTex.needsUpdate = true;

  tex.mapping = THREE.EquirectangularReflectionMapping;

  console.info(
    `[sky] ${label}: ${w}×${h}, sun at az ${THREE.MathUtils.radToDeg(sunAzimuth).toFixed(0)}° ` +
      `el ${THREE.MathUtils.radToDeg(sunElevation).toFixed(0)}°, sky median ${median.toFixed(3)}`,
  );

  return {
    label,
    background: tex,
    environment: envTex,
    sunAzimuth,
    sunElevation,
    horizon,
    scale: SKY_RADIANCE / median,
  };
}
