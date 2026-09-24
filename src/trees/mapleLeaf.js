import * as THREE from 'three';

/*
 * A procedural maple sprig: palmate, five-lobed leaves with serrated margins,
 * palmate veins and long petioles, fanned off a twig. EZ-Tree's leaf cards
 * map the texture with the twig base at the bottom edge (v = 0).
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

// Lobes of a Freeman / red maple leaf: angle from the tip (rad), reach and
// half-width (rad). Broad blade, shallow sinuses, pointed lobe tips.
const LOBES = [
  { a: 0, r: 1.0, w: 0.62 },
  { a: 1.0, r: 0.9, w: 0.55 },
  { a: -1.0, r: 0.9, w: 0.55 },
  { a: 1.95, r: 0.6, w: 0.5 },
  { a: -1.95, r: 0.6, w: 0.5 },
];
const SINUS = 0.52;

/** Leaf outline radius at angle `t` (0 = toward the tip). */
function leafRadius(t, jag) {
  let r = SINUS;
  for (const l of LOBES) {
    const d = Math.abs(Math.atan2(Math.sin(t - l.a), Math.cos(t - l.a)));
    const k = Math.max(0, 1 - d / l.w);
    r = Math.max(r, SINUS + (l.r - SINUS) * k ** 1.4);
  }
  // Coarse, irregular teeth along the margin.
  const teeth = 0.07 * Math.max(0, Math.sin(t * 15 + jag)) ** 2 + 0.02 * Math.sin(t * 37 + jag * 1.7);
  // Heart-shaped notch where the petiole joins.
  const back = Math.abs(t) > 2.55 ? 0.55 + 0.45 * (Math.PI - Math.abs(t)) / (Math.PI - 2.55) : 1;
  return r * (0.9 + teeth) * back;
}

function drawLeaf(g, x, y, size, angle, rand, shade) {
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  const jag = rand() * 6;
  const pts = [];
  for (let i = 0; i < 220; i++) {
    const t = (i / 220) * Math.PI * 2 - Math.PI;
    // Base of the blade sits at the petiole; the tip points along -y.
    const r = leafRadius(t, jag) * size;
    pts.push([Math.sin(t) * r, -Math.cos(t) * r]);
  }
  g.beginPath();
  g.moveTo(0, size * 0.06);
  for (const [px, py] of pts) g.lineTo(px, py);
  g.closePath();
  const L = 30 + shade * 14;
  const grd = g.createRadialGradient(0, 0, size * 0.05, 0, -size * 0.2, size);
  grd.addColorStop(0, `hsl(${102 + rand() * 8}, 44%, ${L - 4}%)`);
  grd.addColorStop(1, `hsl(${96 + rand() * 10}, 48%, ${L + 6}%)`);
  g.fillStyle = grd;
  g.fill();
  // Palmate veins from the petiole to each lobe tip.
  g.strokeStyle = `hsla(90, 35%, ${L + 18}%, .55)`;
  g.lineWidth = Math.max(1, size * 0.018);
  for (const l of LOBES) {
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(Math.sin(l.a) * l.r * size * 0.86, -Math.cos(l.a) * l.r * size * 0.86);
    g.stroke();
  }
  g.restore();
}

let cached = null;

/** { map, luma } — `luma` is the mean linear luminance of opaque texels. */
export function mapleLeafTexture() {
  if (cached) return cached;
  const N = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  const rand = rng(8127);
  g.lineCap = 'round';

  // Twig from the bottom centre, curving up.
  const twig = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    twig.push([N * (0.5 + 0.05 * Math.sin(t * 3)), N * (0.98 - t * 0.6)]);
  }
  g.strokeStyle = '#5b3f2a';
  g.lineWidth = 9;
  g.beginPath();
  twig.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.stroke();

  // Leaves in opposite pairs up the twig plus a terminal cluster, back to front.
  const leaves = [];
  const pairs = 4;
  for (let p = 0; p < pairs; p++) {
    const t = 0.2 + (p / pairs) * 0.75;
    const [tx, ty] = twig[Math.round(t * 20)];
    for (const side of [-1, 1]) {
      const ang = side * (0.9 - p * 0.12) + (rand() - 0.5) * 0.3;
      const pet = N * (0.13 + rand() * 0.04);
      const lx = tx + Math.sin(ang) * pet;
      const ly = ty - Math.cos(ang) * pet;
      leaves.push({ tx, ty, lx, ly, size: N * (0.14 + rand() * 0.04), ang: ang * 0.8, shade: rand() });
    }
  }
  const [ex, ey] = twig[20];
  for (const a of [-0.35, 0.35, 0]) {
    leaves.push({ tx: ex, ty: ey, lx: ex + Math.sin(a) * N * 0.12, ly: ey - Math.cos(a) * N * 0.12, size: N * 0.15, ang: a, shade: rand() });
  }
  g.strokeStyle = '#7a3e2c'; // red maple petioles
  g.lineWidth = 4;
  for (const l of leaves) {
    g.beginPath();
    g.moveTo(l.tx, l.ty);
    g.lineTo(l.lx, l.ly);
    g.stroke();
  }
  for (const l of leaves) drawLeaf(g, l.lx, l.ly, l.size, l.ang, rand, l.shade);

  // Mean luminance of opaque texels, in linear space, for recolouring.
  const px = g.getImageData(0, 0, N, N).data;
  const lin = (u) => {
    u /= 255;
    return u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4;
  };
  let sum = 0;
  let n = 0;
  for (let i = 0; i < px.length; i += 16) {
    if (px[i + 3] < 128) continue;
    sum += 0.2126 * lin(px[i]) + 0.7152 * lin(px[i + 1]) + 0.0722 * lin(px[i + 2]);
    n++;
  }

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  cached = { map, luma: n ? sum / n : 0.15 };
  return cached;
}
