import * as THREE from 'three';

/*
 * Procedural foliage textures, one per species family. Each is a sprig drawn
 * on a transparent canvas with the twig base at the bottom edge, which is how
 * EZ-Tree's leaf cards map it (v = 0 at the branch).
 *
 * The tree shader recolours foliage by luminance, so these are drawn in
 * natural greens for detail and shading; `luma` (mean linear luminance of the
 * opaque texels) lets the shader land on the exact species colour.
 */

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

/* ------------------------------------------------------------ broadleaves */

// Maple: palmate radius function (angle 0 = tip).
const MAPLE_LOBES = [
  { a: 0, r: 1.0, w: 0.62 },
  { a: 1.0, r: 0.9, w: 0.55 },
  { a: -1.0, r: 0.9, w: 0.55 },
  { a: 1.95, r: 0.6, w: 0.5 },
  { a: -1.95, r: 0.6, w: 0.5 },
];
function mapleOutline(size, jag) {
  const pts = [];
  for (let i = 0; i < 240; i++) {
    const t = (i / 240) * Math.PI * 2 - Math.PI;
    let r = 0.52;
    for (const l of MAPLE_LOBES) {
      const d = Math.abs(Math.atan2(Math.sin(t - l.a), Math.cos(t - l.a)));
      const k = Math.max(0, 1 - d / l.w);
      r = Math.max(r, 0.52 + (l.r - 0.52) * k ** 1.4);
    }
    const teeth = 0.07 * Math.max(0, Math.sin(t * 15 + jag)) ** 2 + 0.02 * Math.sin(t * 37 + jag * 1.7);
    const back = Math.abs(t) > 2.55 ? 0.55 + (0.45 * (Math.PI - Math.abs(t))) / (Math.PI - 2.55) : 1;
    r *= (0.9 + teeth) * back;
    pts.push([Math.sin(t) * r * size, -Math.cos(t) * r * size]);
  }
  return pts;
}

/**
 * Pinnate-veined leaves from a half-width profile w(u), u = 0 at the base and
 * 1 at the tip; `teeth` adds serration along the margin.
 */
function profileOutline(size, w, { teeth = 0.04, toothCount = 26, skew = 0, jag = 0 }) {
  const pts = [];
  const N = 120;
  for (const side of [1, -1]) {
    for (let i = 0; i <= N; i++) {
      const u = side > 0 ? i / N : 1 - i / N;
      const tooth = teeth * Math.max(0, Math.sin(u * toothCount * Math.PI + jag)) ** 1.5 * Math.sin(Math.PI * u);
      const half = w(u) * (1 + (side > 0 ? skew : -skew) * (1 - u)) + tooth;
      pts.push([side * half * size, -u * size]);
    }
  }
  return pts;
}

const BROADLEAVES = {
  maple: { outline: mapleOutline, veins: 'palmate', petiole: '#7a3e2c', arrangement: 'opposite', pairs: 4, size: 0.145, hue: 104 },
  linden: {
    // Heart-shaped with a drawn-out tip and fine teeth.
    outline: (s, jag) => profileOutline(s, (u) => 0.48 * Math.sin(Math.PI * u) ** 0.6 * (1 - 0.3 * u) + (u < 0.15 ? 0.12 * (1 - u / 0.15) : 0), { teeth: 0.014, toothCount: 30, skew: 0.08, jag }),
    veins: 'pinnate', petiole: '#5c5a2e', arrangement: 'alternate', pairs: 5, size: 0.16, hue: 100,
  },
  alder: {
    // Oval, blunt tip, doubly serrate, strong parallel veins.
    outline: (s, jag) => profileOutline(s, (u) => 0.4 * Math.sin(Math.PI * u) ** 0.62, { teeth: 0.018, toothCount: 20, jag }),
    veins: 'parallel', petiole: '#4f4a2a', arrangement: 'alternate', pairs: 5, size: 0.15, hue: 108,
  },
  elm: {
    // Ovate, lopsided base, coarse double teeth.
    outline: (s, jag) => profileOutline(s, (u) => 0.33 * Math.sin(Math.PI * u ** 0.85) ** 0.8, { teeth: 0.02, toothCount: 22, skew: 0.18, jag }),
    veins: 'parallel', petiole: '#4f4a2a', arrangement: 'alternate', pairs: 6, size: 0.14, hue: 100,
  },
  oak: {
    // Swamp white oak: obovate with shallow rounded lobes.
    outline: (s, jag) => profileOutline(s, (u) => 0.34 * u ** 0.55 * (1 - u) ** 0.28 * (1 + 0.22 * Math.sin(u * Math.PI * 6 + 0.6)), { teeth: 0.006, toothCount: 8, jag }),
    veins: 'pinnate', petiole: '#5a4a2a', arrangement: 'alternate', pairs: 5, size: 0.21, hue: 96,
  },
  birch: {
    // Small, triangular-ovate, long drawn-out tip, doubly serrate.
    outline: (s, jag) => profileOutline(s, (u) => 0.4 * (1 - u) ** 0.9 * Math.sin(Math.PI * Math.min(1, u * 1.6)) ** 0.5, { teeth: 0.022, toothCount: 24, jag }),
    veins: 'parallel', petiole: '#5a3a2a', arrangement: 'alternate', pairs: 5, size: 0.12, hue: 100,
  },
  aspen: {
    // Near-round with a short point and fine rounded teeth; flutters pale-side up.
    outline: (s, jag) => profileOutline(s, (u) => 0.46 * Math.sin(Math.PI * u ** 0.8) ** 0.5 * (1 - 0.25 * u ** 3), { teeth: 0.012, toothCount: 18, jag }),
    veins: 'pinnate', petiole: '#6a6a3a', arrangement: 'alternate', pairs: 5, size: 0.12, hue: 92, pale: 0.35,
  },
  poplar: {
    // Deltoid (cottonwood): broad flat base, straight sides to a point, coarse teeth.
    outline: (s, jag) => profileOutline(s, (u) => 0.5 * (1 - u) ** 1.05 * Math.min(1, u * 7) ** 0.5, { teeth: 0.018, toothCount: 16, jag }),
    veins: 'pinnate', petiole: '#6a6a3a', arrangement: 'alternate', pairs: 5, size: 0.15, hue: 98, pale: 0.25,
  },
  hackberry: {
    // Ovate, lopsided base, long tapering tip, toothed above the base.
    outline: (s, jag) => profileOutline(s, (u) => 0.36 * Math.sin(Math.PI * u ** 0.75) ** 0.7 * (1 - 0.35 * u), { teeth: 0.014, toothCount: 20, skew: 0.22, jag }),
    veins: 'parallel', petiole: '#4f4a2a', arrangement: 'alternate', pairs: 5, size: 0.14, hue: 96,
  },
  buroak: {
    // Fiddle-shaped: small lobes low down, a deep sinus near the middle, a broad wavy crown.
    outline: (s, jag) => profileOutline(s, (u) => {
      const lower = 0.2 * Math.sin(Math.PI * u * 4.5) ** 2 * Math.min(1, u * 4);
      const sinus = Math.exp(-(((u - 0.5) / 0.07) ** 2)) * 0.24;
      const upper = u > 0.5 ? 0.42 * Math.sin(Math.PI * (u - 0.5) / 0.5) ** 0.45 * (1 + 0.12 * Math.sin(u * 50 + jag)) : 0;
      return Math.max(0.03, Math.max(lower + 0.08 * Math.min(1, u * 5), upper) - sinus) * (u > 0.97 ? (1 - u) / 0.03 : 1);
    }, { teeth: 0, toothCount: 1, jag }),
    veins: 'pinnate', petiole: '#5a4a2a', arrangement: 'alternate', pairs: 5, size: 0.2, hue: 94,
  },
  whiteoak: {
    // English/white oak: 5-7 pairs of rounded lobes with fairly deep sinuses.
    outline: (s, jag) => profileOutline(s, (u) => 0.32 * Math.sin(Math.PI * u) ** 0.55 * (0.62 + 0.38 * Math.abs(Math.sin(u * Math.PI * 5.5))) * Math.min(1, u * 5), { teeth: 0, toothCount: 1, jag }),
    veins: 'pinnate', petiole: '#5a4a2a', arrangement: 'alternate', pairs: 5, size: 0.16, hue: 96,
  },
  willow: {
    // Long, narrow, finely toothed blades.
    outline: (s, jag) => profileOutline(s, (u) => 0.1 * Math.sin(Math.PI * u) ** 0.7, { teeth: 0.004, toothCount: 40, jag }),
    veins: 'pinnate', petiole: '#7a7a3a', arrangement: 'alternate', pairs: 8, size: 0.2, hue: 84, pale: 0.2,
  },
  crabapple: {
    // Small, glossy, ovate, finely serrate.
    outline: (s, jag) => profileOutline(s, (u) => 0.34 * Math.sin(Math.PI * u) ** 0.7 * (1 - 0.2 * u), { teeth: 0.01, toothCount: 26, jag }),
    veins: 'pinnate', petiole: '#6a3a2a', arrangement: 'alternate', pairs: 5, size: 0.12, hue: 100,
  },
  hydrangea: {
    // Panicle hydrangea: elliptic, pointed, toothed, in opposite pairs or whorls of three.
    outline: (s, jag) => profileOutline(s, (u) => 0.3 * Math.sin(Math.PI * u) ** 0.8, { teeth: 0.012, toothCount: 26, jag }),
    veins: 'parallel', petiole: '#6a5a2a', arrangement: 'opposite', pairs: 4, size: 0.16, hue: 104,
  },
  broadleaf: {
    outline: (s, jag) => profileOutline(s, (u) => 0.36 * Math.sin(Math.PI * u) ** 0.75 * (1 - 0.2 * u), { teeth: 0.012, toothCount: 28, jag }),
    veins: 'pinnate', petiole: '#566030', arrangement: 'alternate', pairs: 5, size: 0.15, hue: 102,
  },
};

function drawBroadleaf(g, spec, x, y, size, angle, rand, darken = 0) {
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  const pts = spec.outline(size, rand() * 6);
  g.beginPath();
  pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
  g.closePath();
  const shade = rand();
  const L = 28 + shade * 12;
  const grd = g.createLinearGradient(-size * 0.4, 0, size * 0.4, -size);
  grd.addColorStop(0, `hsl(${spec.hue - 4 + rand() * 6}, 46%, ${L - 5}%)`);
  grd.addColorStop(0.55, `hsl(${spec.hue + rand() * 6}, 48%, ${L + 2}%)`);
  grd.addColorStop(1, `hsl(${spec.hue + 4 + rand() * 6}, 50%, ${L + 8}%)`);
  g.fillStyle = grd;
  g.fill();
  if (spec.pale && rand() < spec.pale) {
    // Some leaves show their pale underside (aspen, poplar, willow).
    g.fillStyle = 'rgba(200,210,190,.35)';
    g.fill();
  }
  if (darken > 0) {
    g.fillStyle = `rgba(8,18,6,${darken})`;
    g.fill();
  }
  // A darker fold along the midrib gives each blade some relief.
  g.save();
  g.clip();
  g.fillStyle = 'rgba(0,0,0,.10)';
  g.fillRect(-size, -size * 1.2, size, size * 1.3);
  // Veins stay inside the blade.

  g.strokeStyle = `hsla(80, 30%, ${L + 22}%, .6)`;
  g.lineCap = 'round';
  if (spec.veins === 'palmate') {
    g.lineWidth = Math.max(1, size * 0.018);
    for (const l of MAPLE_LOBES) {
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(Math.sin(l.a) * l.r * size * 0.86, -Math.cos(l.a) * l.r * size * 0.86);
      g.stroke();
    }
  } else {
    g.lineWidth = Math.max(1, size * 0.02);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(0, -size * 0.96);
    g.stroke();
    g.lineWidth = Math.max(0.8, size * 0.009);
    const n = spec.veins === 'parallel' ? 9 : 6;
    for (let i = 1; i <= n; i++) {
      const u = i / (n + 1);
      const reach = size * 0.3 * Math.sin(Math.PI * u) + size * 0.05;
      for (const side of [-1, 1]) {
        g.beginPath();
        g.moveTo(0, -u * size);
        g.lineTo(side * reach, -u * size - reach * (spec.veins === 'parallel' ? 0.75 : 0.55));
        g.stroke();
      }
    }
  }
  g.restore();
  g.restore();
}

function paintBroadleafSprig(g, N, spec, rand) {
  const twig = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    twig.push([N * (0.5 + 0.04 * Math.sin(t * 3)), N * (0.98 - t * 0.6)]);
  }
  g.lineCap = 'round';
  g.strokeStyle = '#5b3f2a';
  g.lineWidth = N * 0.008;
  g.beginPath();
  twig.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.stroke();

  const leaves = [];
  const n = spec.pairs;
  for (let p = 0; p < n; p++) {
    const t = 0.18 + (p / n) * 0.78;
    const [tx, ty] = twig[Math.round(t * 20)];
    const sides = spec.arrangement === 'opposite' ? [-1, 1] : [p % 2 ? -1 : 1];
    for (const side of sides) {
      const ang = side * (0.95 - p * 0.1) + (rand() - 0.5) * 0.25;
      const pet = N * (spec.veins === 'palmate' ? 0.13 : 0.05) * (0.9 + rand() * 0.3);
      leaves.push({ tx, ty, lx: tx + Math.sin(ang) * pet, ly: ty - Math.cos(ang) * pet,
        size: N * spec.size * (0.9 + rand() * 0.25), ang: ang * 0.85 });
    }
  }
  const [ex, ey] = twig[20];
  for (const a of spec.arrangement === 'opposite' ? [-0.35, 0.35, 0] : [0]) {
    const pet = N * (spec.veins === 'palmate' ? 0.12 : 0.04);
    leaves.push({ tx: ex, ty: ey, lx: ex + Math.sin(a) * pet, ly: ey - Math.cos(a) * pet, size: N * spec.size, ang: a });
  }
  g.strokeStyle = spec.petiole;
  g.lineWidth = N * 0.004;
  for (const l of leaves) {
    g.beginPath();
    g.moveTo(l.tx, l.ty);
    g.lineTo(l.lx, l.ly);
    g.stroke();
  }
  for (const l of leaves) drawBroadleaf(g, spec, l.lx, l.ly, l.size, l.ang, rand);
}

/**
 * A leaf cluster: the species' leaves packed into a rough disc, radiating from
 * the centre, inner leaves shaded darker. Fills its card, so canopies read as
 * solid masses instead of confetti.
 */
function paintBroadleafCluster(g, N, spec, rand) {
  const cx = N / 2;
  const cy = N / 2;
  // Small-leaved species get more leaves so the cluster covers the same area.
  const M = Math.round((spec.veins === 'palmate' ? 34 : 46) * Math.min(1.8, Math.max(1, (0.14 / spec.size) ** 2)));
  const leaves = [];
  for (let i = 0; i < M; i++) {
    // Irregular scatter (not a rosette): random positions in a lumpy disc.
    const f = Math.sqrt(rand());
    const a = rand() * Math.PI * 2;
    const rr = f * N * (0.26 + 0.06 * Math.sin(a * 3 + 1.3));
    leaves.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr * 0.9, a, f });
  }
  // A few twigs under the leaves.
  g.lineCap = 'round';
  g.strokeStyle = '#4a3525';
  for (let k = 0; k < 5; k++) {
    const a = k * 1.256 + rand() * 0.3;
    g.lineWidth = N * 0.006;
    g.beginPath();
    g.moveTo(cx, cy + N * 0.08);
    g.lineTo(cx + Math.cos(a) * N * 0.28, cy + Math.sin(a) * N * 0.26);
    g.stroke();
  }
  // Inner leaves first (shaded), outer ones last so the rim stays crisp.
  leaves.sort((p, q) => p.f - q.f);
  for (const l of leaves) {
    // Smaller leaves, more of them: medium and small, a few large.
    const size = N * Math.min(spec.size, 0.15) * (0.7 + rand() ** 1.5 * 0.55);
    // Mostly hanging with the light, pointing any which way.
    const rot = (rand() < 0.6 ? l.a + Math.PI / 2 : rand() * Math.PI * 2) + (rand() - 0.5) * 1.6;
    // Shade toward the centre: this is what makes the card read as a volume.
    drawBroadleaf(g, spec, l.x, l.y, size, rot, rand, 0.42 * (1 - l.f));
  }
}

/* ------------------------------------------------------------ conifers */

/* Needles along a shoot: short strokes on both sides, angled forward. */
function needles(g, N, x0, y0, x1, y1, len, step, spread, hueBase, rand, width) {
  const L = Math.hypot(x1 - x0, y1 - y0);
  const ang = Math.atan2(x1 - x0, -(y1 - y0));
  const n = Math.max(2, Math.round(L / step));
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const px = x0 + (x1 - x0) * t;
    const py = y0 + (y1 - y0) * t;
    for (const side of [-1, 1]) {
      const a = ang + side * (spread + rand() * 0.3);
      const nl = len * (0.8 + rand() * 0.4) * (1 - t * 0.3);
      g.strokeStyle = `hsl(${hueBase + rand() * 16}, ${32 + rand() * 18}%, ${14 + rand() * 20}%)`;
      g.lineWidth = width;
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(px + Math.sin(a) * nl, py - Math.cos(a) * nl);
      g.stroke();
    }
  }
}

/** Spruce: a flat fan of branchlets, every shoot clothed in short stiff needles. */
function paintSpruce(g, N, rand) {
  g.lineCap = 'round';
  const shoot = (x0, y0, ang, len, depth) => {
    const x1 = x0 + Math.sin(ang) * len;
    const y1 = y0 - Math.cos(ang) * len;
    if (depth > 0) {
      const k = depth > 1 ? 7 : 4;
      for (let i = 1; i <= k; i++) {
        const t = i / (k + 1);
        const side = i % 2 ? 1 : -1;
        shoot(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, ang + side * (0.85 - t * 0.2), len * (0.55 - t * 0.25), depth - 1);
      }
    }
    g.strokeStyle = '#5e4330';
    g.lineWidth = N * 0.004 * (depth + 1);
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
    needles(g, N, x0, y0, x1, y1, N * 0.03, N * 0.0045, 0.8, 128, rand, N * 0.0038);
  };
  shoot(N * 0.5, N * 0.97, 0, N * 0.86, 2);
}

/** Juniper: dense, upright sprays of scale leaves with a waxy blue bloom, and berries. */
function paintJuniper(g, N, rand) {
  const cord = (x0, y0, ang, len, w, depth) => {
    const steps = Math.max(4, Math.round(len / (w * 0.8)));
    let x = x0;
    let y = y0;
    let a = ang;
    for (let i = 0; i < steps; i++) {
      a += (rand() - 0.5) * 0.1;
      const nx = x + Math.sin(a) * (len / steps);
      const ny = y - Math.cos(a) * (len / steps);
      const tw = w * (1 - (i / steps) * 0.5);
      g.fillStyle = `hsl(${148 + rand() * 20}, ${16 + rand() * 14}%, ${22 + rand() * 16}%)`;
      g.beginPath();
      g.ellipse(nx, ny, tw * 0.7, tw, a, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = `hsla(170, 22%, ${60 + rand() * 12}%, .3)`;
      g.beginPath();
      g.ellipse(nx + Math.sin(a) * tw * 0.3, ny - Math.cos(a) * tw * 0.3, tw * 0.3, tw * 0.5, a, 0, Math.PI * 2);
      g.fill();
      if (depth > 0 && i > 1 && i % 2 === 0) {
        const side = (i / 2) % 2 ? 1 : -1;
        cord(nx, ny, a + side * (0.5 + rand() * 0.3), len * 0.5 * (1 - i / steps) + N * 0.04, tw * 0.85, depth - 1);
      }
      x = nx;
      y = ny;
    }
  };
  for (const [ang, len] of [[0, 0.7], [-0.4, 0.56], [0.4, 0.56], [-0.8, 0.4], [0.8, 0.4]]) {
    cord(N * 0.5, N * 0.97, ang, N * len, N * 0.024, 2);
  }
  for (let i = 0; i < 12; i++) {
    const x = N * (0.25 + rand() * 0.5);
    const y = N * (0.2 + rand() * 0.55);
    const r = N * (0.011 + rand() * 0.005);
    const grd = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    grd.addColorStop(0, '#cdd6de');
    grd.addColorStop(1, '#5d6f8a');
    g.fillStyle = grd;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
}

/** Mugo pine: a tuft of shoots, stiff paired needles crowding toward pale candle buds. */
function paintMugo(g, N, rand) {
  g.lineCap = 'round';
  for (const [ang, len] of [[0, 0.62], [-0.55, 0.5], [0.55, 0.5], [-1.05, 0.36], [1.05, 0.36]]) {
    const x0 = N * 0.5;
    const y0 = N * 0.97;
    const x1 = x0 + Math.sin(ang) * N * len;
    const y1 = y0 - Math.cos(ang) * N * len;
    g.strokeStyle = '#6e5238';
    g.lineWidth = N * 0.01;
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
    const n = 60;
    for (let i = 0; i < n; i++) {
      const t = 0.25 + 0.75 * Math.sqrt(i / n);
      const px = x0 + (x1 - x0) * t;
      const py = y0 + (y1 - y0) * t;
      const side = i % 2 ? 1 : -1;
      const spread = 0.3 + (1 - t) * 0.5 + rand() * 0.3;
      const nl = N * (0.1 + rand() * 0.04);
      for (const k of [0, 1]) {
        const a = ang + side * spread + (k ? 0.1 : -0.06);
        const bend = side * 0.3;
        g.strokeStyle = `hsl(${116 + rand() * 22}, ${30 + rand() * 18}%, ${13 + rand() * 18}%)`;
        g.lineWidth = N * 0.005;
        g.beginPath();
        g.moveTo(px, py);
        g.quadraticCurveTo(px + Math.sin(a) * nl * 0.5, py - Math.cos(a) * nl * 0.5, px + Math.sin(a + bend) * nl, py - Math.cos(a + bend) * nl);
        g.stroke();
      }
    }
    g.strokeStyle = '#cdbd92';
    g.lineWidth = N * 0.016;
    g.beginPath();
    g.moveTo(x1, y1);
    g.lineTo(x1 + Math.sin(ang) * N * 0.06, y1 - Math.cos(ang) * N * 0.06);
    g.stroke();
  }
}

/** Weeping willow: long hanging streamers of narrow leaves. The card's base
    (bottom edge) sits at the branch; the streamers run toward the top edge,
    and the tree hangs these cards tip-down. */
function paintWillow(g, N, rand) {
  const spec = BROADLEAVES.willow;
  g.lineCap = 'round';
  for (let k = 0; k < 9; k++) {
    const x0 = N * (0.18 + 0.64 * (k + rand() * 0.6) / 9);
    const len = N * (0.6 + rand() * 0.35);
    const sway = (rand() - 0.5) * N * 0.08;
    g.strokeStyle = '#7a6a38';
    g.lineWidth = N * 0.004;
    g.beginPath();
    g.moveTo(x0, N * 0.99);
    g.quadraticCurveTo(x0 + sway, N * 0.99 - len * 0.5, x0 + sway * 1.6, N * 0.99 - len);
    g.stroke();
    const n = 16;
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const x = x0 + sway * 1.6 * t * t;
      const y = N * 0.99 - len * t;
      for (const side of [-1, 1]) {
        if (rand() < 0.25) continue;
        const ang = side * (0.25 + rand() * 0.3);
        drawBroadleaf(g, spec, x, y, N * spec.size * 0.55 * (0.8 + rand() * 0.4) * (1 - 0.3 * t), ang, rand, 0.25 * rand());
      }
    }
  }
}

/** Honeylocust: overlapping pinnate fronds of tiny leaflets, lots of daylight between. */
function paintLocust(g, N, rand) {
  g.lineCap = 'round';
  for (let k = 0; k < 22; k++) {
    // Fronds scattered over the card at every angle, gently curved.
    const cx = N * (0.5 + (rand() - 0.5) * 0.4);
    const cy = N * (0.5 + (rand() - 0.5) * 0.4);
    const a = rand() * Math.PI * 2;
    const len = N * (0.16 + rand() * 0.16);
    const bend = (rand() - 0.5) * 0.6;
    g.strokeStyle = '#6a6a36';
    g.lineWidth = N * 0.0025;
    g.beginPath();
    g.moveTo(cx, cy);
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const aa = a + bend * t;
      const px = cx + Math.cos(aa) * len * t;
      const py = cy + Math.sin(aa) * len * t;
      pts.push([px, py, aa]);
      g.lineTo(px, py);
    }
    g.stroke();
    for (let i = 1; i <= 12; i++) {
      const [x, y, aa] = pts[i];
      for (const side of [-1, 1]) {
        if (rand() < 0.12) continue;
        const la = aa + side * (1.2 + (rand() - 0.5) * 0.3);
        const l = N * 0.016 * (0.8 + rand() * 0.4) * (1 - 0.3 * (i / 12));
        g.fillStyle = `hsl(${86 + rand() * 16}, ${42 + rand() * 14}%, ${28 + rand() * 16}%)`;
        g.beginPath();
        g.ellipse(x + Math.cos(la) * l, y + Math.sin(la) * l, l, l * 0.42, la, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
}

/** Arborvitae: flat, vertical fans of overlapping scale-leaf sprays, branching
    in one plane, a lighter tip on each fan. */
function paintArborvitae(g, N, rand) {
  const frond = (x0, y0, ang, len, w, depth) => {
    const steps = Math.max(3, Math.round(len / (w * 1.3)));
    let x = x0;
    let y = y0;
    let a = ang;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      a += (rand() - 0.5) * 0.08;
      const nx = x + Math.sin(a) * (len / steps);
      const ny = y - Math.cos(a) * (len / steps);
      const tw = w * (1 - t * 0.5);
      // Each segment is a flattened, overlapping scale spray.
      const L = 24 + t * 12 + rand() * 10;
      g.fillStyle = `hsl(${92 + rand() * 16}, ${38 + rand() * 12}%, ${L}%)`;
      g.beginPath();
      g.ellipse((x + nx) / 2, (y + ny) / 2, tw * 0.5, (len / steps) * 0.75, a, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = `hsla(90, 30%, ${L - 10}%, .8)`;
      g.lineWidth = Math.max(1, tw * 0.08);
      g.stroke();
      if (depth > 0 && t < 0.8) {
        const side = i % 2 ? 1 : -1;
        frond(nx, ny, a + side * (0.6 + rand() * 0.25), len * (depth > 1 ? 0.5 : 0.4) * (1 - t * 0.5), tw * 0.75, depth - 1);
      }
      x = nx;
      y = ny;
    }
  };
  for (const [ang, len] of [[0, 0.82], [-0.45, 0.55], [0.45, 0.55]]) frond(N * 0.5, N * 0.97, ang, N * len, N * 0.065, 2);
}

/* ------------------------------------------------------------ flowers */

/** Crabapple blossom clusters: five-petal flowers and fat buds, drawn pale so
    the shader can tint them to the variety's colour. */
function paintBlossoms(g, N, rand) {
  const cx = N / 2;
  const cy = N / 2;
  const M = 40;
  for (let i = 0; i < M; i++) {
    const f = Math.sqrt(rand());
    const a = rand() * Math.PI * 2;
    const x = cx + Math.cos(a) * f * N * 0.34;
    const y = cy + Math.sin(a) * f * N * 0.3;
    const r = N * (0.028 + rand() * 0.02);
    const L = 62 + rand() * 22;
    if (rand() < 0.25) {
      // bud
      g.fillStyle = `hsl(0, 0%, ${L - 22}%)`;
      g.beginPath();
      g.ellipse(x, y, r * 0.45, r * 0.6, rand() * 3, 0, Math.PI * 2);
      g.fill();
      continue;
    }
    const rot = rand() * Math.PI;
    for (let k = 0; k < 5; k++) {
      const pa = rot + (k / 5) * Math.PI * 2;
      g.fillStyle = `hsl(0, 0%, ${L - rand() * 8}%)`;
      g.beginPath();
      g.ellipse(x + Math.cos(pa) * r * 0.55, y + Math.sin(pa) * r * 0.55, r * 0.52, r * 0.4, pa, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = 'hsl(50, 60%, 70%)';
    g.beginPath();
    g.arc(x, y, r * 0.18, 0, Math.PI * 2);
    g.fill();
  }
}

/** Panicle hydrangea: a cone of tiny four-petal florets, point up (toward the card tip). */
function paintPanicle(g, N, rand) {
  const base = N * 0.95;
  const top = N * 0.1;
  g.strokeStyle = '#6a6a3a';
  g.lineWidth = N * 0.008;
  g.beginPath();
  g.moveTo(N / 2, N);
  g.lineTo(N / 2, top + N * 0.1);
  g.stroke();
  const M = 520;
  for (let i = 0; i < M; i++) {
    const t = rand();
    const y = base - (base - top) * t;
    // Broad rounded base, tapering to a blunt tip.
    const half = N * 0.36 * Math.pow(1 - t, 0.7) * Math.min(1, (1 - t) * 6) * Math.min(1, 0.55 + t * 3);
    const x = N / 2 + (rand() * 2 - 1) * half * Math.sqrt(rand());
    const r = N * (0.012 + rand() * 0.012);
    const L = 58 + rand() * 30 - (1 - Math.abs(x - N / 2) / (half + 1)) * 6;
    const rot = rand() * Math.PI;
    for (let k = 0; k < 4; k++) {
      const pa = rot + (k / 4) * Math.PI * 2;
      g.fillStyle = `hsl(0, 0%, ${L}%)`;
      g.beginPath();
      g.ellipse(x + Math.cos(pa) * r * 0.5, y + Math.sin(pa) * r * 0.5, r * 0.55, r * 0.42, pa, 0, Math.PI * 2);
      g.fill();
    }
  }
}

/* ------------------------------------------------------------ api */

const PAINTERS = {
  spruce: paintSpruce,
  norway: paintSpruce,
  juniper: paintJuniper,
  arborvitae: paintArborvitae,
  pine: paintMugo,
  willow: paintWillow,
  locust: paintLocust,
  'bloom:crabapple': paintBlossoms,
  'bloom:hydrangea': paintPanicle,
};

export const LEAF_KINDS = [...Object.keys(BROADLEAVES), ...Object.keys(PAINTERS)];

const cache = new Map();

/** { map, luma } for a foliage kind at standard (1024) or high (2048) resolution. */
export function leafTexture(kind, high = false) {
  const key = kind + (high ? '@hi' : '');
  if (cache.has(key)) return cache.get(key);
  const N = high ? 2048 : 1024;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  let seed = 8127;
  for (let i = 0; i < kind.length; i++) seed = Math.imul(seed ^ kind.charCodeAt(i), 16777619);
  const rand = rng(seed);
  if (BROADLEAVES[kind] && !PAINTERS[kind]) paintBroadleafCluster(g, N, BROADLEAVES[kind], rand);
  else (PAINTERS[kind] || paintSpruce)(g, N, rand);

  const px = g.getImageData(0, 0, N, N).data;
  const lin = (u) => {
    u /= 255;
    return u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4;
  };
  let sum = 0;
  let n = 0;
  for (let i = 0; i < px.length; i += 32) {
    if (px[i + 3] < 128) continue;
    sum += 0.2126 * lin(px[i]) + 0.7152 * lin(px[i + 1]) + 0.0722 * lin(px[i + 2]);
    n++;
  }
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = high ? 16 : 8;
  const out = { map, luma: n ? sum / n : 0.15 };
  cache.set(key, out);
  return out;
}
