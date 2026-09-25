import * as THREE from 'three';
import { Tree as EzTree } from '@dgreenheck/ez-tree';
import { leafTexture } from './leafTextures.js';

/*
 * Procedural trees for the planner, built in feet from each plan tree's own
 * numbers: crown shape (the same profile the shade engine uses), height,
 * spread, density and evergreen.
 *
 * Deciduous trees: the crown envelope is filled with foliage clumps first,
 * then a symmetric skeleton (trunk, evenly spaced scaffold limbs or a central
 * leader, secondary branches, fine twigs) grows out to reach every clump.
 * Conifers grow from a central leader in whorls with per-species habits:
 * spruce (drooping tiers of flat sprays), juniper (dense ascending scale
 * foliage), pine and mugo (needle tufts at branch tips, mugo multi-stemmed).
 *
 * EZ-Tree is only used for its scanned bark textures.
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const GOLDEN = 2.399963;

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
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}
const randUnit = (r) => {
  const z = r() * 2 - 1;
  const a = r() * Math.PI * 2;
  const s = Math.sqrt(1 - z * z);
  return V(Math.cos(a) * s, z, Math.sin(a) * s);
};

/* ------------------------------------------------------------ species */

/** Foliage texture family for a plan tree: by name where we can tell, else by shape. */
export function leafKindFor(t) {
  const n = (t.name || '').toLowerCase();
  if (t.evergreen) {
    if (/juniper|cedar|arborvitae|yew/.test(n)) return 'juniper';
    if (/pine|mugo/.test(n)) return 'pine';
    return 'spruce';
  }
  if (/maple/.test(n)) return 'maple';
  if (/linden|basswood/.test(n)) return 'linden';
  if (/alder|birch/.test(n)) return 'alder';
  if (/elm/.test(n)) return 'elm';
  if (/oak/.test(n)) return 'oak';
  return { round: 'maple', spreading: 'oak', vase: 'elm' }[t.shape] || 'broadleaf';
}
const BARK = { maple: 'oak', linden: 'oak', elm: 'oak', oak: 'oak', broadleaf: 'oak', alder: 'birch', spruce: 'pine', juniper: 'willow', pine: 'pine' };
const BARK_TINT = { maple: 0xb4ada2, linden: 0xa39d92, elm: 0x9a9388, oak: 0x9e958a, broadleaf: 0xa8a196, alder: 0x8f877c, spruce: 0x8c7f70, juniper: 0x8a6e5a, pine: 0x9a7a5e };

/* ------------------------------------------------------------ geometry buffers */

class Buf {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.uv = [];
    this.idx = [];
    this.rand = [];
    this.ao = [];
  }
  get count() {
    return this.pos.length / 3;
  }
  geometry(extra = false) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    if (extra) {
      g.setAttribute('aRand', new THREE.Float32BufferAttribute(this.rand, 1));
      g.setAttribute('aAO', new THREE.Float32BufferAttribute(this.ao, 1));
    }
    g.setIndex(new THREE.Uint32BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}

/** Quadratic Bézier sampled into n+1 points. */
function curve(a, c, b, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const k0 = (1 - t) * (1 - t);
    const k1 = 2 * (1 - t) * t;
    const k2 = t * t;
    pts.push(V(a.x * k0 + c.x * k1 + b.x * k2, a.y * k0 + c.y * k1 + b.y * k2, a.z * k0 + c.z * k1 + b.z * k2));
  }
  return pts;
}

/** Tapered tube through `pts`, radius r0 → r1, with parallel-transported frames. */
function tube(B, pts, r0, r1, segs) {
  const base = B.count;
  let normal = null;
  let v = 0;
  const circ = Math.PI * 2 * Math.max(0.05, (r0 + r1) / 2);
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const T = V().subVectors(b, a).normalize();
    if (!normal) {
      const ref = Math.abs(T.y) < 0.95 ? UP : V(1, 0, 0);
      normal = V().crossVectors(T, ref).normalize();
    } else {
      normal.sub(T.clone().multiplyScalar(normal.dot(T))).normalize();
    }
    const bin = V().crossVectors(T, normal);
    if (i > 0) v += p.distanceTo(pts[i - 1]) / circ;
    const r = r0 + (r1 - r0) * (i / (pts.length - 1));
    for (let s = 0; s <= segs; s++) {
      const th = (s / segs) * Math.PI * 2;
      const ox = normal.x * Math.cos(th) + bin.x * Math.sin(th);
      const oy = normal.y * Math.cos(th) + bin.y * Math.sin(th);
      const oz = normal.z * Math.cos(th) + bin.z * Math.sin(th);
      B.pos.push(p.x + ox * r, p.y + oy * r, p.z + oz * r);
      B.nor.push(ox, oy, oz);
      B.uv.push(s / segs, v);
    }
  }
  const row = segs + 1;
  for (let i = 0; i < pts.length - 1; i++) {
    for (let s = 0; s < segs; s++) {
      const a = base + i * row + s;
      const b = a + row;
      B.idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
}

/** One foliage card: base at `base`, growing along `tip`, facing roughly `face`. */
function card(B, base, tip, face, size, rnd, normalFn, aoFn) {
  const side = V().crossVectors(face, tip).normalize();
  if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
  const w = side.multiplyScalar(size / 2);
  const h = tip.clone().multiplyScalar(size);
  const corners = [
    [base.clone().sub(w), 0, 0],
    [base.clone().add(w), 1, 0],
    [base.clone().add(w).add(h), 1, 1],
    [base.clone().sub(w).add(h), 0, 1],
  ];
  const i0 = B.count;
  for (const [p, u, v] of corners) {
    const n = normalFn(p);
    B.pos.push(p.x, p.y, p.z);
    B.nor.push(n.x, n.y, n.z);
    B.uv.push(u, v);
    B.rand.push(rnd);
    B.ao.push(aoFn(p));
  }
  B.idx.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
}

/* ------------------------------------------------------------ builders */

function crownGeometry(p) {
  const { H, R, cb, fn, dens, kind, shape, hi } = p;
  const r = rng(hash(`${shape}|${kind}|${H.toFixed(0)}|${R.toFixed(0)}`));
  const bark = new Buf();
  const leaves = new Buf();
  const mass = [];
  const crownH = Math.max(0.5, H - cb);
  const envelope = (y) => R * fn(THREE.MathUtils.clamp((y - cb) / crownH, 0, 1));

  // Foliage normals lean out of the crown; AO darkens the interior and the underside.
  const crownMid = cb + crownH * 0.45;
  const normalFn = (centre) => (q) => {
    const crown = V(q.x, (q.y - crownMid) * (R / crownH) * 0.8 + R * 0.35, q.z).normalize();
    const local = V().subVectors(q, centre).normalize();
    return crown.multiplyScalar(0.65).add(local.multiplyScalar(0.35)).normalize();
  };
  const aoFn = (centre, cr) => (q) => {
    const env = Math.max(0.3, envelope(q.y));
    const outer = THREE.MathUtils.clamp(Math.hypot(q.x, q.z) / env, 0, 1);
    const local = THREE.MathUtils.clamp(q.distanceTo(centre) / cr, 0, 1);
    const height = THREE.MathUtils.clamp((q.y - cb) / crownH, 0, 1);
    return THREE.MathUtils.clamp(0.25 + 0.5 * outer + 0.25 * local, 0, 1) * (0.78 + 0.22 * height);
  };
  const detail = hi ? 1.7 : 1;
  const trunkR = Math.max(0.12, 0.017 * H + 0.012 * R);
  const tipR = Math.max(0.03, 0.0035 * H);

  if (kind === 'spruce' || kind === 'juniper' || kind === 'pine') {
    conifer(p, r, bark, leaves, mass, { envelope, normalFn, aoFn, detail, trunkR, tipR });
  } else {
    broadleaf(p, r, bark, leaves, mass, { envelope, normalFn, aoFn, detail, trunkR, tipR, crownH });
  }
  return { bark: bark.geometry(), leaves: leaves.geometry(true), mass: massGeometry(mass, p) };
}

/* Inner foliage mass: low-poly blobs (broadleaf) or a solid core (conifer) that
   stop the canopy reading as see-through and give the shadow its density. */
function massGeometry(mass, p) {
  if (!mass.length) return null;
  const parts = [];
  for (const m of mass) {
    let g;
    if (m.core) {
      g = new THREE.LatheGeometry(m.core, 10);
    } else {
      g = new THREE.IcosahedronGeometry(m.r, 1);
      g.scale(1, 0.8, 1);
      g.translate(m.c.x, m.c.y, m.c.z);
    }
    parts.push(g.index ? g.toNonIndexed() : g);
  }
  let n = 0;
  for (const g of parts) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  let o = 0;
  for (const g of parts) {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    o += g.attributes.position.count;
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.computeBoundingSphere();
  return geo;
}

function broadleaf(p, r, bark, leaves, mass, ctx) {
  const { H, R, cb, dens, shape } = p;
  const { envelope, normalFn, aoFn, detail, trunkR, tipR, crownH } = ctx;

  // 1. Foliage clumps just inside the crown envelope, laid on one golden-angle
  //    spiral from the crown base to the top (weighted by girth, so wide parts
  //    of the crown get more clumps). Even coverage, no visible rows.
  const clumpR = THREE.MathUtils.clamp(R * 0.3, 1.2, 5.5);
  const samples = 64;
  const cdf = [0];
  for (let i = 1; i <= samples; i++) cdf.push(cdf[i - 1] + Math.max(0.05, envelope(cb + ((i - 0.5) / samples) * crownH)));
  const shellArea = cdf[samples] * (crownH / samples) * Math.PI * 2;
  const count = THREE.MathUtils.clamp(Math.round((shellArea / (Math.PI * clumpR * clumpR)) * 1.25), 8, 140);
  const clumps = [];
  for (let i = 0; i < count; i++) {
    const target = ((i + 0.5) / count) * cdf[samples];
    let k = 1;
    while (k < samples && cdf[k] < target) k++;
    const u = (k - 1 + (target - cdf[k - 1]) / Math.max(1e-6, cdf[k] - cdf[k - 1])) / samples;
    const y = cb + u * crownH;
    const pr = envelope(y);
    const a = i * GOLDEN;
    const rad = Math.max(0, pr - clumpR * (0.62 + 0.18 * r()));
    clumps.push({ c: V(Math.cos(a) * rad, y + (r() - 0.5) * clumpR * 0.3, Math.sin(a) * rad), a, outer: true });
  }
  // A sparse inner layer so you don't see daylight through the middle.
  const innerCount = Math.round(count * 0.18);
  for (let i = 0; i < innerCount; i++) {
    const u = 0.15 + 0.7 * ((i + 0.5) / innerCount);
    const y = cb + u * crownH;
    const a = i * GOLDEN + 1.1;
    const rad = envelope(y) * 0.4;
    clumps.push({ c: V(Math.cos(a) * rad, y, Math.sin(a) * rad), a, outer: false });
  }
  clumps.push({ c: V(0, H - clumpR * 0.7, 0), a: 0, outer: true });

  // 2. Skeleton. Leader shapes keep a central stem; the rest fork into scaffold limbs.
  const leader = shape === 'oval' || shape === 'pyramidal' || shape === 'columnar';
  const trunkTop = leader ? cb + crownH * 0.82 : cb;
  const K = { spreading: 5, vase: 6, weeping: 5 }[shape] || 5;
  const scaffold = [];
  if (!leader) {
    const reach = { spreading: 0.55, vase: 0.5, weeping: 0.35 }[shape] || 0.38;
    const rise = { spreading: 0.22, vase: 0.5, weeping: 0.45 }[shape] || 0.35;
    for (let k = 0; k < K; k++) {
      const a = (k / K) * Math.PI * 2;
      const end = V(Math.cos(a) * R * reach, cb + crownH * rise, Math.sin(a) * R * reach);
      scaffold.push({ a, end, tips: 0 });
    }
  }
  const angDist = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
  for (const cl of clumps) {
    if (leader) {
      const out = Math.hypot(cl.c.x, cl.c.z);
      cl.from = V(0, THREE.MathUtils.clamp(cl.c.y - out * 0.45, cb * 0.95, trunkTop), 0);
    } else {
      let best = scaffold[0];
      for (const s of scaffold) if (angDist(s.a, cl.a) < angDist(best.a, cl.a)) best = s;
      best.tips++;
      cl.from = best.end;
    }
  }
  const segs = hi(detail, 10, 14);
  tube(bark, curve(V(0, 0, 0), V(0, trunkTop * 0.5, 0), V(0, trunkTop, 0), 6), trunkR, leader ? tipR * 2 : trunkR * 0.72, segs);
  // A root flare where the trunk meets the ground.
  tube(bark, [V(0, -0.2, 0), V(0, 0.6, 0), V(0, 1.4, 0)], trunkR * 1.45, trunkR * 1.02, segs);
  for (const s of scaffold) {
    const ctrl = V(s.end.x * 0.3, cb + (s.end.y - cb) * 0.75, s.end.z * 0.3);
    const rs = Math.min(trunkR * 0.68, tipR * 1.4 * Math.sqrt(Math.max(1, s.tips)));
    tube(bark, curve(V(0, cb * 0.97, 0), ctrl, s.end, 6), rs, rs * 0.6, hi(detail, 7, 9));
  }
  for (const cl of clumps) {
    const A = cl.from;
    const P = cl.c;
    const span = A.distanceTo(P);
    const ctrl = V().lerpVectors(A, P, 0.5).addScaledVector(UP, span * (shape === 'weeping' ? 0.35 : 0.15));
    if (shape === 'weeping') P.y -= clumpR * 0.4;
    tube(bark, curve(A, ctrl, P, 4), tipR * 2.1, tipR * 0.9, hi(detail, 5, 6));
    // Fine twigs radiating from the clump: what you see in winter.
    const twigs = hi(detail, 6, 9);
    for (let t = 0; t < twigs; t++) {
      const zz = 1 - ((t + 0.5) / twigs) * 1.3;
      const rr = Math.sqrt(Math.max(0, 1 - zz * zz));
      const ta = t * GOLDEN + cl.a;
      const d = V(Math.cos(ta) * rr, zz, Math.sin(ta) * rr).normalize();
      if (shape === 'weeping') d.y -= 0.6;
      d.normalize();
      const a = P.clone().addScaledVector(d, -clumpR * 0.15);
      const b = P.clone().addScaledVector(d, clumpR * 0.95);
      tube(bark, [a, V().lerpVectors(a, b, 0.5).addScaledVector(UP, clumpR * 0.08), b], tipR * 0.8, 0.02, 3);
      const mid = V().lerpVectors(a, b, 0.55);
      for (const sgn of [-1, 1]) {
        const d2 = d.clone().applyAxisAngle(UP, sgn * 0.7).addScaledVector(UP, 0.2).normalize();
        tube(bark, [mid, mid.clone().addScaledVector(d2, clumpR * 0.45)], tipR * 0.4, 0.015, 3);
      }
    }
  }

  // 3. Leaves: leaf-cluster cards filling each clump, facing mostly outward.
  const size = THREE.MathUtils.clamp(clumpR * 0.95, 1.4, 4.2) / (detail > 1 ? 1.3 : 1);
  const perClump = Math.round((6 + 9 * dens) * (clumpR / size) ** 2 * (detail > 1 ? 1.4 : 1));
  for (const cl of clumps) {
    const P = cl.c;
    const nf = normalFn(P);
    const af = aoFn(P, clumpR);
    const out = V(P.x, 0, P.z).normalize();
    const n = cl.outer ? perClump : Math.round(perClump * 0.5);
    for (let i = 0; i < n; i++) {
      const d = randUnit(r);
      d.y = d.y * 0.75 + 0.2;
      d.normalize();
      const centre = P.clone().addScaledVector(d, clumpR * (0.2 + 0.75 * Math.sqrt(r())));
      // Face outward from the crown (and a little upward), with some tumble.
      const face = d.clone().multiplyScalar(0.55).addScaledVector(out, 0.35).addScaledVector(UP, 0.25)
        .addScaledVector(randUnit(r), 0.45).normalize();
      const tip = V().crossVectors(face, randUnit(r)).normalize();
      const s = size * (0.8 + 0.4 * r());
      card(leaves, centre.addScaledVector(tip, -s * 0.5), tip, face, s, r(), nf, af);
    }
  }
}

function conifer(p, r, bark, leaves, mass, ctx) {
  const { H, R, cb, dens, kind, shape } = p;
  const { envelope, normalFn, aoFn, detail, trunkR, tipR } = ctx;
  const crownH = Math.max(0.5, H - cb);
  const segs = hi(detail, 8, 12);
  const mugo = kind === 'pine' && H < 20 && shape !== 'columnar';

  // Stems: one central leader, or for mugo a handful of ascending stems.
  const stems = [];
  if (mugo) {
    stems.push({ base: V(0, 0, 0), top: V(0, H * 0.97, 0) });
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      stems.push({ base: V(0, 0, 0), top: V(Math.cos(a) * R * 0.45, H * 0.72, Math.sin(a) * R * 0.45) });
    }
  } else stems.push({ base: V(0, 0, 0), top: V(0, H, 0) });
  for (const s of stems) {
    const mid = V().lerpVectors(s.base, s.top, 0.5);
    tube(bark, curve(s.base, mid, s.top, 8), s === stems[0] ? trunkR : trunkR * 0.55, 0.03, segs);
  }

  // Whorls of branches, evenly spaced and rotated by the golden angle.
  const tier = Math.max(0.6, R * (kind === 'juniper' ? 0.18 : 0.26));
  const whorls = THREE.MathUtils.clamp(Math.round(crownH / tier), 6, 48);
  const size = kind === 'juniper'
    ? THREE.MathUtils.clamp(R * 0.42, 0.5, 1.8)
    : THREE.MathUtils.clamp(R * 0.3, 0.7, 2.4);
  const s0 = size / (detail > 1 ? 1.2 : 1);
  const branches = [];
  for (let j = 0; j < whorls; j++) {
    const u = (j + 0.5) / whorls;
    const y = cb + u * crownH;
    const L = Math.max(0.3, envelope(y));
    const n = THREE.MathUtils.clamp(Math.round(5 + L * 0.7), 5, 11);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + j * GOLDEN;
      const dir = V(Math.cos(a), 0, Math.sin(a));
      // Habit: spruce droops then lifts at the tip; juniper and pine ascend.
      const lift = kind === 'spruce' ? -0.18 : kind === 'juniper' ? 0.7 : 0.4;
      const len = kind === 'juniper' ? L * 0.95 : L;
      const start = V(0, y - (kind === 'juniper' ? len * 0.35 : 0), 0);
      const end = start.clone().addScaledVector(dir, len).addScaledVector(UP, len * lift);
      const ctrl = start.clone().addScaledVector(dir, len * 0.55).addScaledVector(UP, len * (kind === 'spruce' ? -0.28 : lift * 0.4));
      const pts = curve(start, ctrl, end, 4);
      tube(bark, pts, tipR * 1.6, 0.02, 4);
      branches.push({ pts, dir, len, a, u });
    }
  }
  if (mugo) {
    // Mugo side stems carry their own short branches.
    for (const s of stems.slice(1)) {
      for (let j = 0; j < 6; j++) {
        const t = 0.35 + (j / 6) * 0.6;
        const at = V().lerpVectors(s.base, s.top, t);
        const dir = V(s.top.x, 0, s.top.z).normalize().applyAxisAngle(UP, (j % 2 ? 1 : -1) * 0.9);
        const end = at.clone().addScaledVector(dir, R * 0.35).addScaledVector(UP, R * 0.25);
        const pts = curve(at, V().lerpVectors(at, end, 0.5), end, 3);
        tube(bark, pts, tipR * 1.4, 0.02, 4);
        branches.push({ pts, dir, len: R * 0.4, a: Math.atan2(dir.z, dir.x), u: t });
      }
    }
  }

  // Foliage: species-oriented sprays over the whole crown surface (golden
  // spiral, like the broadleaves), plus sprays along each branch for depth.
  const orient = (d, out) => {
    if (kind === 'spruce') {
      // Flat sprays spreading outward and drooping slightly: layered tiers.
      const tip = out.clone().addScaledVector(UP, -0.25).addScaledVector(randUnit(r), 0.35).normalize();
      const face = V(r() * 0.5 - 0.25, 1, r() * 0.5 - 0.25).addScaledVector(out, 0.35).normalize();
      return { tip, face };
    }
    if (kind === 'juniper') {
      const tip = UP.clone().multiplyScalar(0.8).addScaledVector(out, 0.4).addScaledVector(randUnit(r), 1.0).normalize();
      const face = out.clone().addScaledVector(d, 0.6).addScaledVector(randUnit(r), 0.8).normalize();
      return { tip, face };
    }
    const tip = out.clone().addScaledVector(UP, 0.7).addScaledVector(randUnit(r), 0.6).normalize();
    const face = out.clone().addScaledVector(d, 0.5).addScaledVector(randUnit(r), 0.5).normalize();
    return { tip, face };
  };
  const clumpR = THREE.MathUtils.clamp(R * (kind === 'juniper' ? 0.42 : 0.38), 0.7, 4);
  const cardS = THREE.MathUtils.clamp(clumpR * (kind === 'spruce' ? 1.5 : 1.25), 0.9, 5) / (detail > 1 ? 1.25 : 1);
  const samples = 64;
  const cdf = [0];
  for (let i = 1; i <= samples; i++) cdf.push(cdf[i - 1] + Math.max(0.05, envelope(cb + ((i - 0.5) / samples) * crownH)));
  const shellArea = cdf[samples] * (crownH / samples) * Math.PI * 2;
  const count = THREE.MathUtils.clamp(Math.round((shellArea / (Math.PI * clumpR * clumpR)) * 1.4), 10, 220);
  const per = Math.round((5 + 7 * dens) * (clumpR / cardS) ** 2 * 2.2 * (detail > 1 ? 1.4 : 1)) + 2;
  for (let i = 0; i < count; i++) {
    const target = ((i + 0.5) / count) * cdf[samples];
    let k = 1;
    while (k < samples && cdf[k] < target) k++;
    const u = (k - 1 + (target - cdf[k - 1]) / Math.max(1e-6, cdf[k] - cdf[k - 1])) / samples;
    const y = cb + u * crownH;
    const a = i * GOLDEN;
    const out = V(Math.cos(a), 0, Math.sin(a));
    const rad = Math.max(0, envelope(y) - clumpR * 0.55);
    const P = V(out.x * rad, y, out.z * rad);
    const nf = normalFn(P);
    const af = aoFn(P, clumpR);
    for (let q = 0; q < per; q++) {
      const d = randUnit(r);
      const centre = P.clone().addScaledVector(d, clumpR * 0.6 * Math.sqrt(r()));
      const { tip, face } = orient(d, out);
      const s = cardS * (0.8 + 0.4 * r());
      card(leaves, centre.addScaledVector(tip, -s * 0.35), tip, face, s, r(), nf, af);
    }
  }
  // Sprays along branches, inside the shell, so gaps show foliage, not daylight.
  for (const b of branches) {
    const tipPt = b.pts[b.pts.length - 1];
    const nf = normalFn(tipPt);
    const af = aoFn(V(0, tipPt.y, 0), Math.max(1, b.len));
    const steps = Math.max(1, Math.round((b.len / cardS) * 1.2));
    for (let i = 0; i < steps; i++) {
      const t = 0.35 + 0.6 * (i / steps);
      const seg = t * (b.pts.length - 1);
      const k = Math.min(b.pts.length - 2, Math.floor(seg));
      const at = V().lerpVectors(b.pts[k], b.pts[k + 1], seg - k);
      const { tip, face } = orient(randUnit(r), b.dir);
      const s = cardS * (0.7 + 0.3 * r());
      card(leaves, at.addScaledVector(tip, -s * 0.3), tip, face, s, r(), nf, af);
    }
  }
  // A slim dark core, hidden inside the foliage, so no daylight shows through.
  const core = [];
  for (let i = 0; i <= 12; i++) {
    const y = cb + (i / 12) * crownH;
    core.push(new THREE.Vector2(Math.max(0.05, envelope(y) * 0.4), y));
  }
  core.push(new THREE.Vector2(0.01, H * 0.97));
  mass.push({ core });
}

const hi = (detail, a, b) => (detail > 1 ? b : a);

/* ------------------------------------------------------------ library */

const DEFAULT_LEAF = 0x46702c;
const DEFAULT_FALL = 0xb5782a;
const DEFAULT_NEEDLE = { spruce: 0x2c4a2e, juniper: 0x5f7a6c, pine: 0x2e4d22 };

export class TreeLibrary {
  constructor() {
    this.cache = new Map();
    this.high = false;
    this.bark = {};
  }

  /** High detail: 2048 px foliage textures and roughly twice the foliage cards. */
  setHighDetail(on) {
    if (this.high === !!on) return false;
    this.high = !!on;
    for (const g of this.cache.values()) for (const x of Object.values(g)) x?.dispose();
    this.cache.clear();
    return true;
  }

  #barkMaterial(kind) {
    const type = BARK[kind] || 'oak';
    if (!this.bark[kind]) {
      // Borrow EZ-Tree's scanned bark maps by growing a bare trunk once.
      const ez = new EzTree();
      ez.options.bark.type = type;
      ez.options.branch.levels = 0;
      ez.options.leaves.count = 0;
      ez.generate();
      const src = ez.branchesMesh.material;
      const maps = {};
      for (const k of ['map', 'normalMap', 'roughnessMap', 'aoMap']) {
        if (!src[k]) continue;
        const t = src[k].clone();
        t.wrapS = t.wrapT = THREE.RepeatWrapping;
        t.repeat.set(2, 1);
        t.needsUpdate = true;
        maps[k] = t;
      }
      this.bark[kind] = new THREE.MeshStandardMaterial({ ...maps, color: new THREE.Color(BARK_TINT[kind] ?? 0xa8a196), roughness: 1 });
    }
    return this.bark[kind];
  }

  #geometry(t, kind, profile, crownBase) {
    const H = Math.max(2, t.height);
    const R = Math.max(0.5, t.spread / 2);
    const dens = Math.round(THREE.MathUtils.clamp(t.density ?? 0.85, 0.1, 1) * 20) / 20;
    const key = [t.shape, kind, H.toFixed(1), R.toFixed(1), dens, crownBase.toFixed(2), this.high].join('|');
    let g = this.cache.get(key);
    if (!g) {
      g = crownGeometry({ H, R, cb: H * crownBase, fn: profile, dens, kind, shape: t.shape, hi: this.high });
      for (const x of Object.values(g)) if (x) x.userData.shared = true;
      this.cache.set(key, g);
      if (this.cache.size > 80) {
        // Drop the oldest unused entry; live meshes keep their own references.
        const first = this.cache.keys().next().value;
        this.cache.delete(first);
      }
    }
    return g;
  }

  #leafMaterial(kind, leafColor, fallColor) {
    const tex = leafTexture(kind, this.high);
    const uniforms = {
      uLeafColor: { value: new THREE.Color(leafColor) },
      uFallColor: { value: new THREE.Color(fallColor) },
      uFall: { value: 0 },
      uLumaNorm: { value: 1 / tex.luma },
    };
    const mat = new THREE.MeshStandardMaterial({ map: tex.map, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.68 });
    mat.userData.uniforms = uniforms;
    mat.customProgramCacheKey = () => 'yard-leaf';
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>
          attribute float aRand;
          attribute float aAO;
          varying float vRand;
          varying float vAO;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vRand = aRand;
          vAO = aAO;`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          uniform vec3 uLeafColor;
          uniform vec3 uFallColor;
          uniform float uFall;
          uniform float uLumaNorm;
          varying float vRand;
          varying float vAO;`)
        .replace('#include <map_fragment>', `#include <map_fragment>
          // Texture gives shape and detail; the tree's colour gives hue.
          float l = min(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)) * uLumaNorm, 1.6);
          // Sun-side, outer leaves turn first; interior leaves lag behind.
          float lead = vRand * 0.35 + (1.0 - vAO) * 0.45;
          float turned = 0.9 * smoothstep(lead, lead + 0.5, uFall);
          vec3 hue = mix(uLeafColor, uFallColor, turned);
          // Sun-side leaves run a touch warmer and lighter, inner leaves cooler.
          hue *= mix(vec3(0.82, 0.9, 1.0), vec3(1.08, 1.05, 0.92), vAO) * (0.86 + 0.28 * vRand);
          diffuseColor.rgb = hue * l;`)
        .replace('#include <aomap_fragment>', `#include <aomap_fragment>
          float canopyAO = mix(0.32, 1.0, vAO);
          reflectedLight.indirectDiffuse *= canopyAO;
          reflectedLight.directDiffuse *= mix(0.6, 1.0, vAO);`)
        .replace('#include <normal_fragment_begin>',
          THREE.ShaderChunk.normal_fragment_begin.replace('gl_FrontFacing ? 1.0 : - 1.0', '1.0'));
    };
    return mat;
  }

  /**
   * A tree group for plan tree `t`. `profile(u)` is the crown radius fraction
   * at height fraction u (the shade engine's SHAPES[shape].r); `crownBase` is
   * the fraction of height where the crown starts.
   */
  build(t, { bare = false, fall = 0, crownBase = 0.25, profile = (u) => Math.sin(Math.PI * u) } = {}) {
    const kind = leafKindFor(t);
    const geo = this.#geometry(t, kind, profile, crownBase);
    const grp = new THREE.Group();
    const inner = new THREE.Group();
    inner.rotation.y = (t.id * GOLDEN) % (Math.PI * 2);
    grp.add(inner);

    const bark = new THREE.Mesh(geo.bark, this.#barkMaterial(kind));
    bark.castShadow = bark.receiveShadow = true;
    bark.raycast = () => {};
    inner.add(bark);

    if (!bare) {
      const leafColor = t.leaf ?? (t.evergreen ? DEFAULT_NEEDLE[kind] : DEFAULT_LEAF);
      const fallColor = t.fall ?? (t.evergreen ? leafColor : DEFAULT_FALL);
      const mat = this.#leafMaterial(kind, leafColor, fallColor);
      mat.userData.uniforms.uFall.value = t.evergreen ? 0 : fall;
      const leaves = new THREE.Mesh(geo.leaves, mat);
      leaves.castShadow = leaves.receiveShadow = true;
      leaves.raycast = () => {};
      leaves.userData.leafUniforms = mat.userData.uniforms;
      leaves.userData.evergreen = !!t.evergreen;
      inner.add(leaves);
      if (geo.mass) {
        const massMat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });
        massMat.userData.uniforms = mat.userData.uniforms;
        massMat.userData.base = [new THREE.Color(leafColor), new THREE.Color(fallColor)];
        massMat.color.copy(massMat.userData.base[0]).lerp(massMat.userData.base[1], t.evergreen ? 0 : fall).multiplyScalar(0.35);
        const mass = new THREE.Mesh(geo.mass, massMat);
        mass.castShadow = mass.receiveShadow = true;
        mass.raycast = () => {};
        mass.userData.massOf = leaves;
        inner.add(mass);
      }
    }

    // Cheap invisible pick target covering trunk and crown.
    const proxy = new THREE.Mesh(
      new THREE.CylinderGeometry(t.spread * 0.42, t.spread * 0.3, t.height * 0.96, 10),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    proxy.position.y = t.height * 0.48;
    grp.add(proxy);
    return grp;
  }

  /** Updates fall colour on every built tree under `root`. */
  setFall(root, fall) {
    root.traverse((o) => {
      if (o.userData.leafUniforms && !o.userData.evergreen) o.userData.leafUniforms.uFall.value = fall;
      if (o.userData.massOf && !o.userData.massOf.userData.evergreen) {
        const [a, b] = o.material.userData.base;
        o.material.color.copy(a).lerp(b, fall).multiplyScalar(0.35);
      }
    });
  }
}
