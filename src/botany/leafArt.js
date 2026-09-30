import * as THREE from 'three';
import { LEAF } from './species.js';
import { leafTexture } from '../trees/leafTextures.js';

/*
 * One true-to-species leaf per texture, drawn from the outlines in the
 * fact sheets: the petiole enters at the bottom edge (v = 0) and the blade
 * runs to its tip at the top. Leaves are instanced individually, so this is
 * what you see up close: lobes, sinuses, teeth and veins.
 *
 * Drawn in natural greens for shading detail; the leaf shader recolours by
 * luminance so each variety lands on its own colour (red for Crimson King,
 * blue-green for spruce, and so on). `luma` is the mean linear luminance of
 * the opaque texels, which the shader uses to normalise.
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

/* ------------------------------------------------------------ outlines */
/* Blade units: base at (0, 0), tip at (0, -1); x is the half width. Each
   returns a closed polygon. */

function sides(w, n = 90, toothFn = () => 0) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    pts.push([w(u, 1) + toothFn(u), -u]);
  }
  for (let i = n; i >= 0; i--) {
    const u = i / n;
    pts.push([-(w(u, -1) + toothFn(u + 0.013)), -u]);
  }
  return pts;
}
function teeth(kind, count, amp) {
  if (kind === 'entire') return () => 0;
  if (kind === 'crenate') return (u) => amp * Math.abs(Math.sin(u * count * Math.PI)) * Math.sin(Math.PI * u);
  if (kind === 'double')
    return (u) => (amp * Math.max(0, Math.sin(u * count * Math.PI)) ** 1.4 + amp * 0.45 * Math.max(0, Math.sin(u * count * 3 * Math.PI))) * Math.sin(Math.PI * Math.min(1, u * 1.2));
  return (u) => amp * Math.max(0, Math.sin(u * count * Math.PI)) ** 1.6 * Math.sin(Math.PI * u);
}

function palmate(spec) {
  // Lobes radiate from the petiole junction; depth sets the sinuses.
  const n = spec.lobes;
  const spread = n === 7 ? 2.35 : 2.05; // outer lobes reach farther round
  const lobes = [];
  for (let k = 0; k < n; k++) {
    const t = n === 1 ? 0 : (k / (n - 1)) * 2 - 1;
    // Star leaves (sweetgum) have lobes of nearly equal length.
    lobes.push({ a: t * spread, r: spec.even ? 1 - 0.1 * Math.abs(t) : 1 - 0.42 * Math.abs(t) ** 1.6, w: (spread * 2) / (n - 1) * 0.5 });
  }
  const inner = 1 - spec.depth;
  const pts = [];
  const cy = -0.42;
  for (let i = 0; i <= 260; i++) {
    const th = (i / 260) * Math.PI * 2 - Math.PI;
    let rr = inner * 0.62;
    for (const l of lobes) {
      const d = Math.abs(Math.atan2(Math.sin(th - l.a), Math.cos(th - l.a)));
      const k = Math.max(0, 1 - d / l.w);
      rr = Math.max(rr, inner * 0.62 + (l.r * 0.62 - inner * 0.62) * k ** (spec.depth > 0.5 ? 1.8 : 1.1));
    }
    // Pointed lobe tips and teeth along the lobe margins.
    const tooth = spec.margin === 'toothed' ? 0.025 * Math.max(0, Math.sin(th * 22)) ** 2 : 0.006 * Math.sin(th * 18);
    rr += tooth;
    // Notch where the petiole joins (the back of the leaf).
    const back = Math.abs(th) > 2.7 ? 0.6 + (0.4 * (Math.PI - Math.abs(th))) / (Math.PI - 2.7) : 1;
    rr *= back;
    pts.push([Math.sin(th) * rr, cy - Math.cos(th) * rr * 1.05]);
  }
  return pts;
}

const OUTLINES = {
  palmate,
  cordate: (s) => sides((u, side) => {
    // Body of the blade, with the rounded basal lobes of a heart blended in.
    const body = 0.5 * Math.pow(Math.max(0, Math.sin(Math.PI * Math.min(1, (u - 0.02) * 1.02))), 0.55) * (1 - 0.38 * u);
    const heart = Math.max(body, 0.36 * Math.exp(-(((u - 0.1) / 0.16) ** 2)));
    return heart * (side > 0 ? 1.04 : 0.96);
  }, 100, teeth(s.margin, 34, 0.014)),
  deltoid: (s) => sides((u) => 0.5 * Math.pow(1 - u, 1.05) * Math.min(1, u * 6 + 0.25) ** 0.5, 90, teeth(s.margin, 22, 0.018)),
  oval: (s) => sides((u) => 0.46 * Math.pow(Math.sin(Math.PI * u), 0.62), 90, teeth(s.margin, 22, 0.02)),
  round: (s) => sides((u) => 0.5 * Math.pow(Math.sin(Math.PI * u ** 0.8), 0.5) * (1 - 0.3 * u ** 3), 90, teeth(s.margin, 20, 0.012)),
  ovate: (s) => sides((u, side) => 0.42 * Math.pow(Math.sin(Math.PI * u ** 0.75), 0.72) * (1 - 0.3 * u) * (1 + side * (s.skew || 0) * (1 - u) ** 2), 90, teeth(s.margin, 26, 0.016)),
  elliptic: (s) => sides((u) => 0.4 * Math.pow(Math.sin(Math.PI * u), 0.8), 90, teeth(s.margin, 30, 0.012)),
  lance: (s) => sides((u) => 0.46 * Math.pow(Math.sin(Math.PI * u), 0.7), 90, teeth(s.margin, 40, 0.01)),
  fiddle: () => sides((u) => {
    const lower = 0.24 * Math.sin(Math.PI * u * 4.5) ** 2 * Math.min(1, u * 4) + 0.08 * Math.min(1, u * 5);
    const sinus = Math.exp(-(((u - 0.48) / 0.07) ** 2)) * 0.26;
    const upper = u > 0.48 ? 0.5 * Math.sin((Math.PI * (u - 0.48)) / 0.52) ** 0.42 * (1 + 0.1 * Math.sin(u * 44)) : 0;
    return Math.max(0.03, Math.max(lower, upper) - sinus) * (u > 0.96 ? (1 - u) / 0.04 : 1);
  }, 140),
  lobed: (s) => sides((u) => {
    const body = 0.5 * Math.pow(Math.sin(Math.PI * u), 0.55) * Math.min(1, u * 5);
    if (s.pointed) {
      // Red-oak group: sharp, bristle-tipped lobes over rounded sinuses.
      const x = (u * (s.lobes - 0.5)) % 1;
      const tri = 1 - Math.abs(x * 2 - 1);
      const bristle = 0.06 * Math.max(0, tri - 0.93) / 0.07;
      return body * (1 - s.depth + s.depth * tri ** 1.7) + bristle * (u > 0.12 ? 1 : 0);
    }
    const lob = 1 - s.depth + s.depth * Math.abs(Math.sin(u * Math.PI * (s.lobes - 0.5)));
    return body * lob;
  }, 200),
  // Ginkgo: a wedge widening from the stalk to a broad, wavy outer edge.
  fan: () => sides((u) => {
    if (u < 0.86) return 0.56 * Math.pow(u / 0.86, 1.25) * (1 + 0.02 * Math.sin(u * 30));
    const t = (u - 0.86) / 0.14;
    return 0.56 * Math.sqrt(Math.max(0, 1 - t * t)) * (1 + 0.03 * Math.sin(t * 9));
  }, 120),
  // Tulip tree: two broad lower lobes, a waist, two short upper lobes, a square tip.
  tulip: () => sides((u) => {
    const w = 0.24 + 0.3 * Math.exp(-(((u - 0.3) / 0.2) ** 2)) + 0.16 * Math.exp(-(((u - 0.84) / 0.1) ** 2)) - 0.04 * Math.exp(-(((u - 0.62) / 0.08) ** 2));
    // The tip is cut square with a shallow notch.
    const notch = u > 0.96 ? (u - 0.96) / 0.04 : 0;
    return w * Math.min(1, u * 5 + 0.2) ** 0.5 * (1 - 0.5 * notch);
  }, 140),
};

/* ------------------------------------------------------------ painting */

function drawBlade(g, spec, pts, sc, ox, oy, rand) {
  g.save();
  g.translate(ox, oy);
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x * sc, y * sc) : g.moveTo(x * sc, y * sc)));
  g.closePath();
  const grd = g.createLinearGradient(-sc * 0.5, 0, sc * 0.5, -sc);
  grd.addColorStop(0, 'hsl(96, 44%, 27%)');
  grd.addColorStop(0.5, 'hsl(100, 48%, 33%)');
  grd.addColorStop(1, 'hsl(104, 50%, 38%)');
  g.fillStyle = grd;
  g.fill();
  g.save();
  g.clip();
  // Mottling, then a darker half along the midrib fold.
  for (let i = 0; i < 90; i++) {
    g.fillStyle = `rgba(${rand() < 0.5 ? '255,255,220' : '0,20,0'},${0.02 + rand() * 0.04})`;
    g.beginPath();
    g.arc((rand() - 0.5) * sc, -rand() * sc, sc * (0.02 + rand() * 0.06), 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = 'rgba(0,0,0,.09)';
  g.fillRect(-sc, -sc * 1.3, sc, sc * 1.4);
  // Veins.
  g.lineCap = 'round';
  g.strokeStyle = 'rgba(214,230,170,.5)';
  if (spec.outline === 'palmate') {
    const n = spec.lobes;
    const spread = n === 7 ? 2.35 : 2.05;
    for (let k = 0; k < n; k++) {
      const a = ((k / (n - 1)) * 2 - 1) * spread;
      const tk = Math.abs((k / (n - 1)) * 2 - 1);
      const L = (spec.even ? 1 - 0.1 * tk : 1 - 0.42 * tk ** 1.6) * 0.6 * sc;
      g.lineWidth = Math.max(1, sc * 0.012);
      g.beginPath();
      g.moveTo(0, -0.42 * sc + 0.4 * sc * 0.62);
      g.lineTo(Math.sin(a) * L, -0.42 * sc - Math.cos(a) * L);
      g.stroke();
      g.lineWidth = Math.max(0.6, sc * 0.005);
      for (let j = 1; j <= 3; j++) {
        const t = j / 4;
        const px = Math.sin(a) * L * t;
        const py = -0.42 * sc + 0.25 * sc * (1 - t) - Math.cos(a) * L * t;
        for (const s of [-1, 1]) {
          g.beginPath();
          g.moveTo(px, py);
          g.lineTo(px + Math.sin(a + s * 0.8) * L * 0.22, py - Math.cos(a + s * 0.8) * L * 0.22);
          g.stroke();
        }
      }
    }
  } else if (spec.outline === 'fan') {
    // Ginkgo: fine veins fanning and forking from the stalk.
    g.lineWidth = Math.max(0.6, sc * 0.005);
    for (let k = 0; k < 26; k++) {
      const a = ((k / 25) * 2 - 1) * 0.62;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(Math.sin(a) * sc * 1.05, -Math.cos(a) * sc * 0.98);
      g.stroke();
    }
  } else {
    g.lineWidth = Math.max(1, sc * 0.014);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(0, -sc * 0.97);
    g.stroke();
    g.lineWidth = Math.max(0.6, sc * 0.006);
    const n = spec.veins === 'parallel' ? 10 : spec.outline === 'lance' ? 12 : 7;
    for (let i = 1; i <= n; i++) {
      const u = i / (n + 1);
      const reach = sc * 0.55;
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(0, -u * sc);
        g.quadraticCurveTo(s * reach * 0.4, -u * sc - reach * 0.25, s * reach, -u * sc - reach * (spec.veins === 'parallel' ? 0.6 : 0.45));
        g.stroke();
      }
    }
  }
  g.restore();
  // A thin darker rim reads as the leaf's edge.
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x * sc, y * sc) : g.moveTo(x * sc, y * sc)));
  g.closePath();
  g.strokeStyle = 'rgba(20,40,10,.35)';
  g.lineWidth = Math.max(0.6, sc * 0.006);
  g.stroke();
  g.restore();
}

function leaflet(g, L, lw, rand, toothed) {
  // One leaflet pointing up from the origin, with a midrib.
  g.fillStyle = `hsl(${90 + rand() * 12}, ${44 + rand() * 10}%, ${30 + rand() * 12}%)`;
  g.beginPath();
  const n = 28;
  for (let i = 0; i <= n * 2; i++) {
    const up = i <= n;
    const u = up ? i / n : 2 - i / n;
    let w = L * lw * Math.pow(Math.sin(Math.PI * u), 0.8);
    if (toothed) w += L * 0.018 * Math.max(0, Math.sin(u * 40)) * Math.sin(Math.PI * u);
    const x = up ? w : -w;
    if (i) g.lineTo(x, -u * L);
    else g.moveTo(x, 0);
  }
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(214,230,170,.45)';
  g.lineWidth = Math.max(0.6, L * 0.015);
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(0, -L * 0.95);
  g.stroke();
}
function paintPinna(g, W, H, spec, rand) {
  // A rachis with paired leaflets (honeylocust shows one pinna; ash, mountain
  // ash and boxelder the whole leaf, with its end leaflet).
  const cx = W / 2;
  const pairs = spec.pairs ?? 11;
  const lw = spec.lw ?? 0.22;
  const toothed = spec.margin === 'serrate' || spec.margin === 'crenate';
  g.strokeStyle = spec.petioleColor || '#6a6a36';
  g.lineWidth = Math.max(1, W * 0.02);
  g.beginPath();
  g.moveTo(cx, H);
  g.lineTo(cx, H * (spec.terminal ? spec.terminalAt ?? 0.3 : 0.03));
  g.stroke();
  const top = spec.terminal ? spec.terminalAt ?? 0.3 : 0.06;
  for (let i = 0; i < pairs; i++) {
    const y = H * (0.9 - (i / Math.max(1, pairs - (spec.terminal ? 0 : 1))) * (0.9 - top));
    const rot = Math.PI / 2 - (spec.spread ?? 0.35);
    const L = Math.min((W * 0.48) / Math.sin(rot), H * 0.45) * (1 - 0.25 * (i / pairs));
    for (const s of [-1, 1]) {
      g.save();
      g.translate(cx + s * W * 0.02, y);
      g.rotate(s * rot);
      leaflet(g, L, lw, rand, toothed);
      g.restore();
    }
  }
  if (spec.terminal) {
    g.save();
    g.translate(cx, H * top);
    leaflet(g, H * top * 0.96, lw * 0.9, rand, toothed);
    g.restore();
  }
}
function paintPalmCompound(g, W, H, spec, rand) {
  // Buckeye: five leaflets radiating from the end of a long stalk.
  const cx = W / 2;
  const hub = H * 0.62;
  g.strokeStyle = spec.petioleColor;
  g.lineWidth = Math.max(1.2, W * 0.022);
  g.beginPath();
  g.moveTo(cx, H);
  g.lineTo(cx, hub);
  g.stroke();
  const n = spec.leaflets || 5;
  for (let k = 0; k < n; k++) {
    const t = (k / (n - 1)) * 2 - 1;
    g.save();
    g.translate(cx, hub);
    g.rotate(t * 1.25);
    leaflet(g, hub * 0.98 * (1 - 0.3 * t * t), 0.16, rand, true);
    g.restore();
  }
}

function lumaOf(g, W, H) {
  const px = g.getImageData(0, 0, W, H).data;
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
  return n ? sum / n : 0.15;
}

const cache = new Map();

/** { map, aspect, luma } for one leaf of LEAF[key]. aspect = width / height of the card. */
export function leafCard(key, high = false) {
  const ck = key + (high ? '@hi' : '');
  if (cache.has(ck)) return cache.get(ck);
  const spec = LEAF[key] || LEAF.linden;
  const rand = rng(key.length * 7919 + key.charCodeAt(0));
  const pet = spec.petiole / spec.length; // petiole length in blade units
  let pts;
  let bx0 = -0.5, bx1 = 0.5, by0 = -1, by1 = 0;
  const painted = spec.outline === 'pinnate' || spec.outline === 'palmcompound';
  if (!painted) {
    pts = OUTLINES[spec.outline](spec);
    // Narrower or broader than the outline family's default blade.
    if (spec.wx) pts = pts.map(([x, y]) => [x * spec.wx, y]);
    bx0 = Math.min(...pts.map((p) => p[0]));
    bx1 = Math.max(...pts.map((p) => p[0]));
    by0 = Math.min(...pts.map((p) => p[1]));
    by1 = Math.max(0, ...pts.map((p) => p[1]));
  }
  const half = Math.max(-bx0, bx1) * 1.04;
  const hBlade = by1 - by0;
  const total = hBlade + pet;
  const aspect = spec.outline === 'pinnate' ? spec.aspect ?? 0.55 : spec.outline === 'palmcompound' ? 1.05 : (2 * half) / total;
  const H = high ? 512 : 256;
  const W = Math.max(16, Math.round(H * aspect));
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  if (spec.outline === 'pinnate') paintPinna(g, W, H, spec, rand);
  else if (spec.outline === 'palmcompound') paintPalmCompound(g, W, H, spec, rand);
  else {
    const sc = H / total;
    const baseY = H - pet * sc; // where the blade meets the petiole
    g.strokeStyle = spec.petioleColor;
    g.lineWidth = Math.max(1.2, W * 0.028);
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(W / 2, H);
    g.lineTo(W / 2, baseY - by1 * sc * 0.5);
    g.stroke();
    drawBlade(g, spec, pts, sc, W / 2, baseY - by1 * sc, rand);
  }
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  map.generateMipmaps = true;
  // Opaque share of the card, times its aspect: the leaf's real area per
  // length², which growth uses to decide how many leaves close the crown.
  const px = g.getImageData(0, 0, W, H).data;
  let solid = 0;
  for (let i = 3; i < px.length; i += 4) if (px[i] > 127) solid++;
  const out = { map, aspect, luma: lumaOf(g, W, H), area: (solid / (W * H)) * aspect };
  cache.set(ck, out);
  return out;
}

/*
 * Conifer shoots. Needles are far thinner than a pixel from across the yard,
 * so each shoot is painted as a solid needle mass (what the eye reads at a
 * distance) with individual needles over it (what you see up close).
 *   bottlebrush – spruce: stiff 4-sided needles all round the twig
 *   tuft        – pine: long paired needles crowding toward the tip, pale candle
 * Arborvitae fans and juniper cords reuse the v1 painters.
 */
function paintBottlebrush(g, W, H, rand, needle) {
  const cx = W / 2;
  const L = H * 0.94;
  const rad = (t) => W * 0.44 * Math.pow(Math.sin(Math.PI * Math.min(1, 0.12 + t * 0.95)), 0.7) * (1 - 0.35 * t);
  // Mass: overlapping needles drawn thick and dark first.
  for (let pass = 0; pass < 2; pass++) {
    const n = pass ? 520 : 420;
    for (let i = 0; i < n; i++) {
      const t = Math.pow(rand(), 0.9);
      const y = H - t * L;
      const side = rand() < 0.5 ? -1 : 1;
      const len = rad(t) * (0.55 + 0.45 * rand());
      const ang = side * (0.55 + rand() * 0.75); // needles angle forward
      const x1 = cx + Math.sin(ang) * len;
      const y1 = y - Math.cos(ang) * len * 0.8;
      const L0 = pass ? 22 + rand() * 22 : 12 + rand() * 8;
      g.strokeStyle = `hsl(${120 + rand() * 20}, ${pass ? 30 + rand() * 20 : 35}%, ${L0}%)`;
      g.lineWidth = pass ? Math.max(1.2, W * 0.012) : Math.max(2, W * 0.03);
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(cx + (rand() - 0.5) * W * 0.03, y);
      g.lineTo(x1, y1);
      g.stroke();
    }
  }
  // Twig and a lighter new-growth tip.
  g.strokeStyle = '#6a4a32';
  g.lineWidth = Math.max(1.5, W * 0.02);
  g.beginPath();
  g.moveTo(cx, H);
  g.lineTo(cx, H - L * 0.9);
  g.stroke();
  for (let i = 0; i < 60; i++) {
    const t = 0.82 + rand() * 0.16;
    const y = H - t * L;
    const s = rand() < 0.5 ? -1 : 1;
    g.strokeStyle = `hsl(${105 + rand() * 20}, 40%, ${38 + rand() * 14}%)`;
    g.lineWidth = Math.max(1, W * 0.012);
    g.beginPath();
    g.moveTo(cx, y);
    g.lineTo(cx + s * rad(t) * 0.7 * rand(), y - rad(t) * 0.5);
    g.stroke();
  }
}
function paintTuft(g, W, H, rand, soft = false) {
  const cx = W / 2;
  // Needles spray from along the upper third of the shoot, arching outward.
  // White pine: longer, finer needles that droop softly.
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < (pass ? (soft ? 420 : 300) : 220); i++) {
      const t = 0.35 + 0.6 * Math.sqrt(rand());
      const y0 = H - t * H * 0.8;
      const ang = (rand() - 0.5) * (soft ? 2.8 : 2.2) * (1.1 - t * 0.6);
      const len = H * (soft ? 0.42 + rand() * 0.14 : 0.34 + rand() * 0.12);
      const x1 = cx + Math.sin(ang) * len;
      const y1 = y0 - Math.cos(ang) * len * 0.9;
      g.strokeStyle = `hsl(${118 + rand() * 20}, ${30 + rand() * 20}%, ${pass ? 20 + rand() * 20 : 12 + rand() * 6}%)`;
      g.lineWidth = pass ? Math.max(1, W * (soft ? 0.008 : 0.012)) : Math.max(1.8, W * (soft ? 0.02 : 0.026));
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(cx, y0);
      g.quadraticCurveTo(cx + Math.sin(ang) * len * 0.5, y0 - len * 0.55, x1, y1);
      g.stroke();
    }
  }
  g.strokeStyle = '#7a5a3a';
  g.lineWidth = Math.max(2, W * 0.03);
  g.beginPath();
  g.moveTo(cx, H);
  g.lineTo(cx, H * 0.2);
  g.stroke();
  // The pale bud (candle) at the tip.
  g.strokeStyle = '#d8c89a';
  g.lineWidth = Math.max(3, W * 0.05);
  g.beginPath();
  g.moveTo(cx, H * 0.24);
  g.lineTo(cx, H * 0.1);
  g.stroke();
}
function paintLarch(g, W, H, rand) {
  // Tamarack: a twig set with spur shoots, each a rosette of soft needles.
  const cx = W / 2;
  g.strokeStyle = '#7a5a3a';
  g.lineWidth = Math.max(1.5, W * 0.018);
  g.beginPath();
  g.moveTo(cx, H);
  g.lineTo(cx, H * 0.06);
  g.stroke();
  for (let pass = 0; pass < 2; pass++) {
    for (let k = 0; k < 11; k++) {
      const y = H * (0.9 - k * 0.078);
      const x = cx + (k % 2 ? 1 : -1) * W * 0.05;
      const n = pass ? 26 : 16;
      for (let i = 0; i < n; i++) {
        const a = (rand() - 0.5) * 2.6;
        const len = H * (0.1 + rand() * 0.06) * (1 - k * 0.03);
        g.strokeStyle = `hsl(${95 + rand() * 20}, ${35 + rand() * 20}%, ${pass ? 28 + rand() * 18 : 16 + rand() * 6}%)`;
        g.lineWidth = pass ? Math.max(1, W * 0.01) : Math.max(1.6, W * 0.022);
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + Math.sin(a) * len, y - Math.cos(a) * len);
        g.stroke();
      }
    }
  }
}
export function shootCard(kind, high = false) {
  const ck = 'shoot:' + kind + (high ? '@hi' : '');
  if (cache.has(ck)) return cache.get(ck);
  let out;
  if (kind === 'arborvitae' || kind === 'juniper') out = leafTexture(kind, high);
  else {
    const H = high ? 512 : 256;
    const W = H;
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    const rand = rng(kind.length * 131 + 7);
    if (kind === 'pine' || kind === 'redpine' || kind === 'scotchpine') paintTuft(g, W, H, rand);
    else if (kind === 'whitepine') paintTuft(g, W, H, rand, true);
    else if (kind === 'tamarack') paintLarch(g, W, H, rand);
    else paintBottlebrush(g, W, H, rand);
    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 8;
    out = { map, luma: lumaOf(g, W, H) };
  }
  cache.set(ck, out);
  return out;
}

/** Flower textures for blossoms and panicles. */
export function flowerCard(type, high = false) {
  return leafTexture(type === 'panicle' ? 'bloom:hydrangea' : 'bloom:crabapple', high);
}

/** Linden bract with its hanging flower cluster. */
let bractTex = null;
export function bractCard() {
  if (bractTex) return bractTex;
  const W = 128;
  const H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  // The strap-shaped bract, pale yellow-green, stalk along its midline.
  g.fillStyle = 'hsl(64, 40%, 70%)';
  g.beginPath();
  g.ellipse(W * 0.42, H * 0.42, W * 0.16, H * 0.36, 0.08, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'hsl(70, 30%, 55%)';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(W * 0.5, H);
  g.lineTo(W * 0.45, H * 0.1);
  g.stroke();
  // Flowers dangling below the bract.
  const rand = rng(77);
  for (let i = 0; i < 9; i++) {
    const x = W * (0.55 + rand() * 0.3);
    const y = H * (0.62 + rand() * 0.3);
    g.fillStyle = `hsl(55, 60%, ${72 + rand() * 12}%)`;
    g.beginPath();
    g.arc(x, y, 5 + rand() * 3, 0, Math.PI * 2);
    g.fill();
  }
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  bractTex = { map, aspect: W / H, luma: lumaOf(g, W, H) };
  return bractTex;
}
