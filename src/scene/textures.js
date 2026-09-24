import * as THREE from 'three';

// Small procedural texture kit so the scene has no hard asset dependencies.
// Swap any of these for scanned Poly Haven / ambientCG sets later.

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tileable value noise, octaves summed, returns Float32Array in [0,1]. */
function fbm(size, seed, octaves = 5, baseCells = 4) {
  const out = new Float32Array(size * size);
  const rand = rng(seed);
  let amp = 1;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    const cells = baseCells << o;
    const grid = new Float32Array(cells * cells).map(() => rand());
    for (let y = 0; y < size; y++) {
      const gy = (y / size) * cells;
      const y0 = Math.floor(gy);
      const fy = gy - y0;
      const sy = fy * fy * (3 - 2 * fy);
      for (let x = 0; x < size; x++) {
        const gx = (x / size) * cells;
        const x0 = Math.floor(gx);
        const fx = gx - x0;
        const sx = fx * fx * (3 - 2 * fx);
        const i00 = grid[(y0 % cells) * cells + (x0 % cells)];
        const i10 = grid[(y0 % cells) * cells + ((x0 + 1) % cells)];
        const i01 = grid[((y0 + 1) % cells) * cells + (x0 % cells)];
        const i11 = grid[((y0 + 1) % cells) * cells + ((x0 + 1) % cells)];
        const v = (i00 * (1 - sx) + i10 * sx) * (1 - sy) + (i01 * (1 - sx) + i11 * sx) * sy;
        out[y * size + x] += v * amp;
      }
    }
    total += amp;
    amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

function canvasTexture(size, paint, { srgb = true, repeat = 1 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  paint(img.data, size);
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 8;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Height field → tangent-space normal map. */
function normalFromHeight(height, size, strength) {
  return (d) => {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const h = (xx, yy) => height[((yy + size) % size) * size + ((xx + size) % size)];
        const dx = (h(x + 1, y) - h(x - 1, y)) * strength;
        const dy = (h(x, y + 1) - h(x, y - 1)) * strength;
        const len = Math.hypot(dx, dy, 1);
        const i = (y * size + x) * 4;
        d[i] = (-dx / len * 0.5 + 0.5) * 255;
        d[i + 1] = (dy / len * 0.5 + 0.5) * 255;
        d[i + 2] = (1 / len * 0.5 + 0.5) * 255;
        d[i + 3] = 255;
      }
    }
  };
}

/**
 * Mown lawn seen from standing height: thousands of short blade strokes over
 * mottled turf, with a matching normal map. Tileable; one tile ≈ 6.5 ft.
 */
export function lawnTextures(repeat) {
  const N = 1024;
  const rand = rng(11);
  const n = fbm(N, 11, 5, 6);
  const color = document.createElement('canvas');
  const bump = document.createElement('canvas');
  color.width = color.height = bump.width = bump.height = N;
  const g = color.getContext('2d');
  const h = bump.getContext('2d');

  // Mottled base: living turf with a little thatch showing through.
  const img = g.createImageData(N, N);
  for (let i = 0; i < N * N; i++) {
    const t = THREE.MathUtils.smoothstep(n[i], 0.3, 0.7);
    img.data[i * 4] = 44 + 12 * (1 - t);
    img.data[i * 4 + 1] = 64 + 12 * t;
    img.data[i * 4 + 2] = 30 + 4 * t;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  h.fillStyle = '#5a5a5a';
  h.fillRect(0, 0, N, N);

  // Blades, drawn three times near the edges so the tile wraps seamlessly.
  const blade = (x, y) => {
    const len = 9 + rand() * 16;
    const ang = -Math.PI / 2 + (rand() - 0.5) * 1.4;
    const x2 = x + Math.cos(ang) * len;
    const y2 = y + Math.sin(ang) * len;
    const v = rand();
    const light = 22 + v * 20;
    const col = `hsl(${92 + rand() * 18}, ${34 + rand() * 16}%, ${light}%)`;
    const w = 1.2 + rand() * 1.3;
    for (const [dx, dy] of [[0, 0], [N, 0], [-N, 0], [0, N], [0, -N]]) {
      if (dx && Math.min(x, N - x) > 30) continue;
      if (dy && Math.min(y, N - y) > 30) continue;
      g.strokeStyle = col;
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(x + dx, y + dy);
      g.lineTo(x2 + dx, y2 + dy);
      g.stroke();
      h.strokeStyle = `rgba(255,255,255,${0.25 + v * 0.35})`;
      h.lineWidth = w;
      h.beginPath();
      h.moveTo(x + dx, y + dy);
      h.lineTo(x2 + dx, y2 + dy);
      h.stroke();
    }
  };
  g.lineCap = h.lineCap = 'round';
  for (let i = 0; i < 60000; i++) blade(rand() * N, rand() * N);

  const hd = h.getImageData(0, 0, N, N).data;
  const height = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) height[i] = hd[i * 4] / 255;

  const map = new THREE.CanvasTexture(color);
  map.colorSpace = THREE.SRGBColorSpace;
  const normalMap = canvasTexture(N, normalFromHeight(height, N, 3), { srgb: false });
  for (const t of [map, normalMap]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    t.repeat.set(repeat, repeat);
  }
  return { map, normalMap };
}

/** Tileable broom-finished concrete with a saw-cut joint on one tile edge. */
export function concreteTile() {
  const t = concreteTextures(1, 1, 1);
  for (const x of [t.map, t.roughnessMap, t.normalMap]) x.wrapS = x.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Concrete pavers, running bond. One tile = 4 × 4 courses. */
export function paverTextures() {
  const size = 512;
  const grain = fbm(size, 61, 3, 64);
  const rand = rng(62);
  const tones = Array.from({ length: 64 }, () => rand());
  const height = new Float32Array(size * size);
  const tone = new Float32Array(size * size);
  const rows = 8;
  const cols = 4;
  for (let y = 0; y < size; y++) {
    const row = Math.floor((y * rows) / size);
    const fy = ((y * rows) % size) / size;
    for (let x = 0; x < size; x++) {
      const tx = (x / size) * cols + (row % 2 ? 0.5 : 0);
      const col = Math.floor(tx);
      const fx = tx - col;
      const gap = fy < 0.04 || fx < 0.02;
      const i = y * size + x;
      height[i] = gap ? 0 : 0.8 + grain[i] * 0.2;
      tone[i] = tones[(row * cols + (col % cols)) % 64];
    }
  }
  const map = canvasTexture(size, (d) => {
    for (let i = 0; i < size * size; i++) {
      const gap = height[i] === 0;
      const v = gap ? 70 : 150 + tone[i] * 40 + (grain[i] - 0.5) * 40;
      d[i * 4] = v;
      d[i * 4 + 1] = v * 0.96;
      d[i * 4 + 2] = v * 0.9;
      d[i * 4 + 3] = 255;
    }
  });
  const normalMap = canvasTexture(size, normalFromHeight(height, size, 3), { srgb: false });
  return { map, normalMap };
}

/** Broom-finished concrete slab with saw-cut control joints every `jointEvery` metres. */
export function concreteTextures(widthM, depthM, jointEvery = 1.5) {
  const size = 1024;
  const n = fbm(size, 21, 6, 6);
  const grain = fbm(size, 22, 2, 256);
  const stain = fbm(size, 23, 4, 3);
  const jointsX = Math.max(1, Math.round(widthM / jointEvery));
  const jointsY = Math.max(1, Math.round(depthM / jointEvery));
  const jointPx = 2;

  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const jx = (x * jointsX) % size < jointPx;
      const jy = (y * jointsY) % size < jointPx;
      height[i] = grain[i] * 0.6 + n[i] * 0.4 - (jx || jy ? 1.5 : 0);
    }
  }

  const map = canvasTexture(size, (d) => {
    for (let i = 0; i < size * size; i++) {
      const joint = height[i] < -0.5;
      const base = 168 + (n[i] - 0.5) * 40 + (grain[i] - 0.5) * 30 - (stain[i] > 0.62 ? 18 : 0);
      const v = joint ? base * 0.45 : base;
      d[i * 4] = v;
      d[i * 4 + 1] = v * 0.985;
      d[i * 4 + 2] = v * 0.95;
      d[i * 4 + 3] = 255;
    }
  });
  const roughnessMap = canvasTexture(
    size,
    (d) => {
      for (let i = 0; i < size * size; i++) {
        const v = 205 + (grain[i] - 0.5) * 60;
        d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
        d[i * 4 + 3] = 255;
      }
    },
    { srgb: false },
  );
  const normalMap = canvasTexture(size, normalFromHeight(height, size, 2.5), { srgb: false });
  for (const t of [map, roughnessMap, normalMap]) t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return { map, roughnessMap, normalMap };
}

/** Horizontal lap siding. */
export function sidingTextures(repeatX, repeatY) {
  const size = 512;
  const n = fbm(size, 31, 4, 4);
  const boards = 8;
  const height = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const f = ((y * boards) % size) / size; // 0..1 within a board, top → bottom
    for (let x = 0; x < size; x++) height[y * size + x] = f * 0.8 + n[y * size + x] * 0.1;
  }
  const map = canvasTexture(
    size,
    (d) => {
      for (let y = 0; y < size; y++) {
        const f = ((y * boards) % size) / size;
        const shadow = f > 0.93 ? 0.72 : 1;
        for (let x = 0; x < size; x++) {
          const i = y * size + x;
          const v = (0.92 + n[i] * 0.08) * shadow;
          d[i * 4] = 222 * v;
          d[i * 4 + 1] = 216 * v;
          d[i * 4 + 2] = 200 * v;
          d[i * 4 + 3] = 255;
        }
      }
    },
    { repeat: 1 },
  );
  const normalMap = canvasTexture(size, normalFromHeight(height, size, 8), { srgb: false });
  for (const t of [map, normalMap]) t.repeat.set(repeatX, repeatY);
  return { map, normalMap };
}

/** Asphalt shingles: staggered tabs with granule noise. */
export function shingleTextures(repeatX, repeatY) {
  const size = 512;
  const grain = fbm(size, 41, 2, 128);
  const n = fbm(size, 42, 4, 8);
  const rows = 8;
  const tabs = 6;
  const height = new Float32Array(size * size);
  const tone = new Float32Array(size * size);
  const rand = rng(43);
  const tabTone = Array.from({ length: rows * tabs * 2 }, () => rand());
  for (let y = 0; y < size; y++) {
    const row = Math.floor((y * rows) / size);
    const fy = ((y * rows) % size) / size;
    for (let x = 0; x < size; x++) {
      const shift = row % 2 ? 0.5 : 0;
      const tx = (x / size) * tabs + shift;
      const tab = Math.floor(tx);
      const fx = tx - tab;
      const gap = fx < 0.015 || fx > 0.985;
      const i = y * size + x;
      height[i] = fy * 0.7 + grain[i] * 0.3 - (gap ? 0.6 : 0);
      tone[i] = tabTone[(row * tabs * 2 + tab) % tabTone.length];
    }
  }
  const map = canvasTexture(size, (d) => {
    for (let i = 0; i < size * size; i++) {
      const v = 58 + tone[i] * 18 + (grain[i] - 0.5) * 50 + (n[i] - 0.5) * 20;
      d[i * 4] = v;
      d[i * 4 + 1] = v * 0.97;
      d[i * 4 + 2] = v * 0.94;
      d[i * 4 + 3] = 255;
    }
  });
  const normalMap = canvasTexture(size, normalFromHeight(height, size, 5), { srgb: false });
  for (const t of [map, normalMap]) t.repeat.set(repeatX, repeatY);
  return { map, normalMap };
}

/** Weathered cedar fence boards (vertical). */
export function fenceTextures(repeatX) {
  const size = 256;
  const grain = fbm(size, 51, 5, 4);
  const boards = 4;
  const map = canvasTexture(size, (d) => {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const i = y * size + x;
        const bx = ((x * boards) % size) / size;
        const gap = bx < 0.03;
        // stretched grain along Y
        const g = grain[(Math.floor(y / 8) * size + x) % grain.length];
        const v = gap ? 0.35 : 0.75 + g * 0.35;
        d[i * 4] = 150 * v;
        d[i * 4 + 1] = 128 * v;
        d[i * 4 + 2] = 104 * v;
        d[i * 4 + 3] = 255;
      }
    }
  });
  map.repeat.set(repeatX, 1);
  return { map };
}
