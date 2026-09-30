import * as THREE from 'three';

/*
 * Grows a tree skeleton in feet.
 *
 * Broadleaves use space colonization (Runions, Lane & Prusinkiewicz 2007):
 * the crown envelope is seeded with attraction points, and branches grow
 * step by step toward the points nearest them until the crown is filled.
 * Each species' profile steers it: a leader or a fork, the angle scaffold
 * limbs leave the trunk, how strongly shoots reach up or hang down.
 * Branch thickness follows the pipe model (da Vinci's rule): a limb's cross
 * section carries all the twigs beyond it.
 *
 * Conifers grow the way they do in life: a leader with a whorl of branches
 * each year, secondary branchlets in the branch plane (or hanging, for
 * Norway spruce), and foliage shoots along them.
 *
 * Output is plain data: branch chains for the bark mesh, and placements for
 * leaves, shoots and ornaments (flowers, fruit, cones), each with a position,
 * a frame and a few per-instance numbers the shaders and seasons use.
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0);
const GOLDEN = 2.399963;

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash(str) {
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
/** Any unit vector perpendicular to d. */
function perp(d) {
  const ref = Math.abs(d.y) < 0.9 ? UP : V(1, 0, 0);
  return V().crossVectors(d, ref).normalize();
}

/* ------------------------------------------------------------ node store */

class Nodes {
  constructor() {
    this.pos = [];
    this.parent = [];
    this.kids = [];
    this.grow = []; // may sprout new shoots
    this.axis = []; // trunk / leader / scaffold
  }
  add(p, parent, { grow = true, axis = false } = {}) {
    const i = this.pos.length;
    this.pos.push(p);
    this.parent.push(parent);
    this.kids.push([]);
    this.grow.push(grow);
    this.axis.push(axis);
    if (parent >= 0) this.kids[parent].push(i);
    return i;
  }
  get length() {
    return this.pos.length;
  }
}

/** Uniform grid over node positions for nearest-node lookups. */
class Grid {
  constructor(cell) {
    this.cell = cell;
    this.map = new Map();
  }
  // Numeric keys: cells are small integers well inside ±512.
  static k(cx, cy, cz) {
    return ((cx + 512) * 1024 + (cy + 512)) * 1024 + (cz + 512);
  }
  add(i, p) {
    const k = Grid.k(Math.floor(p.x / this.cell), Math.floor(p.y / this.cell), Math.floor(p.z / this.cell));
    let b = this.map.get(k);
    if (!b) this.map.set(k, (b = []));
    b.push(i);
  }
  near(p, fn) {
    const cx = Math.floor(p.x / this.cell);
    const cy = Math.floor(p.y / this.cell);
    const cz = Math.floor(p.z / this.cell);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++) {
          const b = this.map.get(Grid.k(cx + dx, cy + dy, cz + dz));
          if (b) for (let j = 0; j < b.length; j++) fn(b[j]);
        }
  }
}

/** Crown radius at height y, from a 512-entry table of the profile (it's called a lot). */
function envelopeLUT(fn, R, cb, crownH) {
  const n = 512;
  const t = new Float32Array(n + 1);
  for (let i = 0; i <= n; i++) t[i] = R * fn(i / n);
  return (y) => {
    const u = (y - cb) / crownH;
    if (u <= 0) return t[0];
    if (u >= 1) return t[n];
    const f = u * n;
    const i = f | 0;
    return t[i] + (t[i + 1] - t[i]) * (f - i);
  };
}

/* ------------------------------------------------------------ broadleaves */

/**
 * p: { H, R, cb, fn(u)→radius fraction, dens, sp (species profile), shape, variant, detail }
 */
export function growBroadleaf(p) {
  const { H, R, cb, fn, sp, shape, variant } = p;
  const r = rng(hash(`${shape}|${p.key}|${H.toFixed(1)}|${R.toFixed(1)}|${cb.toFixed(2)}|${variant}`));
  const crownH = Math.max(0.5, H - cb);
  const envelope = envelopeLUT(fn, R, cb, crownH);
  const D = THREE.MathUtils.clamp(Math.max(H, R * 1.4) / 42, 0.3, 1.15);
  const nodes = new Nodes();

  // 1. Attraction points in the crown, biased toward its surface where the
  //    light is, the way real crowns carry most twigs in their outer shell.
  const volume = (() => {
    let v = 0;
    for (let i = 0; i < 24; i++) v += Math.PI * envelope(cb + ((i + 0.5) / 24) * crownH) ** 2;
    return (v * crownH) / 24;
  })();
  const na = Math.round(THREE.MathUtils.clamp((volume / (D * D * D * 14)) * (0.7 + 0.6 * sp.twiggy), 220, 1700));
  const attr = [];
  const hollow = sp.vase ? 0.5 : sp.weeping ? 0.25 : 0.12;
  let guard = 0;
  while (attr.length < na && guard++ < na * 40) {
    const u = r();
    const y = cb + u * crownH;
    const env = envelope(y);
    if (r() > (env / R) ** 2 + 0.02) continue; // more points where the crown is wide
    // Pagoda dogwood: twigs only in flat layers, open air between them.
    if (sp.tiers && Math.abs(((u * sp.tiers + 0.35) % 1) - 0.5) > 0.12) continue;
    // Vase and weeping crowns are open inside, but their top still closes
    // over in a dome of twigs, so the hollow fades out through the upper crown.
    const h = hollow * (1 - THREE.MathUtils.smoothstep(u, 0.55, 0.85));
    const k = h + (1 - h) * Math.pow(r(), 0.38);
    const a = r() * Math.PI * 2;
    attr.push({ p: V(Math.cos(a) * env * k, y, Math.sin(a) * env * k), alive: true });
  }
  // The crown's top is narrow, so area-weighted sampling leaves it thin; a
  // cap of extra points gives it the twig dome real crowns carry up there.
  const cap = sp.tiers ? 0 : Math.round(na * (sp.vase ? 0.16 : 0.1));
  for (let i = 0; i < cap; i++) {
    const u = 0.72 + 0.27 * Math.sqrt(r());
    const y = cb + u * crownH;
    const k = Math.sqrt(r()) * (0.5 + 0.5 * r());
    const a = r() * Math.PI * 2;
    const env = envelope(y);
    attr.push({ p: V(Math.cos(a) * env * k, y, Math.sin(a) * env * k), alive: true });
  }

  // 2. The starting frame: trunk, leader or scaffold limbs.
  const lean = V((r() - 0.5) * 0.06, 1, (r() - 0.5) * 0.06).normalize();
  const stems = sp.stems && H > 12 ? sp.stems : 1;
  const trunkTop = sp.leader ? cb + crownH * 0.9 : sp.vase ? cb * 0.78 : cb;
  const axisStep = D * 1.2;
  let lastAxis = [];
  for (let s = 0; s < stems; s++) {
    const a = (s / stems) * Math.PI * 2 + r();
    const tilt = stems > 1 ? V(Math.cos(a) * 0.22, 1, Math.sin(a) * 0.22).normalize() : lean;
    let prev = s === 0 ? -1 : 0;
    let pt = s === 0 ? V(0, 0, 0) : nodes.pos[0].clone();
    if (s === 0) prev = nodes.add(pt.clone(), -1, { grow: false, axis: true });
    const n = Math.max(2, Math.ceil(trunkTop / axisStep));
    for (let i = 1; i <= n; i++) {
      const y = (i / n) * trunkTop;
      const wob = V((r() - 0.5) * D * 0.12, 0, (r() - 0.5) * D * 0.12);
      pt = V(tilt.x * y, y, tilt.z * y).add(wob);
      // Laterals only from the crown; the clear trunk below stays clean.
      prev = nodes.add(pt, prev, { grow: y >= cb * 0.92, axis: true });
    }
    lastAxis.push(prev);
  }
  // Forking crowns: scaffold limbs leave the trunk top at the species' angle.
  if (!sp.leader) {
    const K = (sp.scaffolds || 4) + (variant % 2) - (variant === 2 ? 1 : 0);
    const ang = THREE.MathUtils.degToRad(sp.angle);
    const top = lastAxis[0];
    const limbLen = sp.vase ? crownH * 0.62 : Math.min(R * 0.55, crownH * 0.55);
    for (let k = 0; k < K; k++) {
      const az = (k / K) * Math.PI * 2 + (r() - 0.5) * 0.6 + variant;
      const a = ang * (0.85 + 0.3 * r());
      const dir = V(Math.cos(az) * Math.sin(a), Math.cos(a), Math.sin(az) * Math.sin(a));
      let prev = top;
      const steps = Math.max(2, Math.round((limbLen * (0.8 + 0.35 * r())) / axisStep));
      const pt = nodes.pos[top].clone();
      for (let i = 0; i < steps; i++) {
        // Elms climb steeply and arch out near the top; oaks sweep outward.
        const t = i / steps;
        const d = dir.clone();
        if (sp.vase) d.lerp(V(dir.x * 1.6, 0.2, dir.z * 1.6).normalize(), t * t * (sp.arch || 0.4));
        else d.y -= t * 0.25 * (sp.gnarl ? 1 : 0.4);
        pt.addScaledVector(d.normalize(), axisStep);
        prev = nodes.add(pt.clone(), prev, { grow: true, axis: true });
      }
    }
  }

  // 3. Space colonization.
  const di = D * 8.5;
  const dk = D * 2.1;
  const grid = new Grid(di);
  for (let i = 0; i < nodes.length; i++) grid.add(i, nodes.pos[i]);
  const attrGrid = new Grid(dk);
  attr.forEach((a, i) => attrGrid.add(i, a.p));
  const tropism = V(0, sp.tropism * 0.45, 0);
  let idle = 0;
  for (let it = 0; it < 140 && idle < 3; it++) {
    const pull = new Map();
    for (const a of attr) {
      if (!a.alive) continue;
      let best = -1;
      let bd = di * di;
      grid.near(a.p, (i) => {
        if (!nodes.grow[i]) return;
        const d2 = nodes.pos[i].distanceToSquared(a.p);
        if (d2 < bd) {
          bd = d2;
          best = i;
        }
      });
      if (best < 0) continue;
      let v = pull.get(best);
      if (!v) pull.set(best, (v = V()));
      v.add(V().subVectors(a.p, nodes.pos[best]).normalize());
    }
    if (!pull.size) {
      idle++;
      continue;
    }
    idle = 0;
    const fresh = [];
    for (const [i, v] of pull) {
      const dir = v.normalize().add(tropism).addScaledVector(randUnit(r), 0.12).normalize();
      // Don't sprout a twin of an existing shoot.
      if (nodes.kids[i].some((k) => V().subVectors(nodes.pos[k], nodes.pos[i]).normalize().dot(dir) > 0.97)) continue;
      const q = nodes.pos[i].clone().addScaledVector(dir, D);
      const j = nodes.add(q, i);
      grid.add(j, q);
      fresh.push(j);
    }
    // Attractors reached by a new shoot are used up.
    for (const j of fresh) {
      const q = nodes.pos[j];
      attrGrid.near(q, (i) => {
        const a = attr[i];
        if (a.alive && q.distanceToSquared(a.p) < dk * dk) a.alive = false;
      });
    }
  }

  // 4. Gnarl: bur oak limbs kink and wander.
  if (sp.gnarl) {
    for (let i = 0; i < nodes.length; i++) {
      if (nodes.pos[i].y < cb) continue;
      nodes.pos[i].addScaledVector(randUnit(r), D * sp.gnarl * 0.35);
    }
  }

  // 5. Weeping: long streamers hang from the outer branch tips.
  const streamers = [];
  if (sp.weeping) {
    const tips = [];
    for (let i = 0; i < nodes.length; i++) if (!nodes.kids[i].length) tips.push(i);
    for (const i of tips) {
      const p0 = nodes.pos[i];
      if (p0.y < cb + crownH * 0.25) continue;
      const out = V(p0.x, 0, p0.z).normalize();
      const drop = (p0.y - cb * (0.35 + 0.4 * r())) * (0.55 + 0.45 * r());
      const n = Math.max(3, Math.round(drop / D));
      let prev = i;
      const q = p0.clone();
      for (let k = 1; k <= n; k++) {
        q.addScaledVector(V(out.x * 0.12, -1, out.z * 0.12).normalize(), drop / n);
        q.addScaledVector(randUnit(r), D * 0.05);
        prev = nodes.add(q.clone(), prev, { grow: false });
      }
      streamers.push(prev);
    }
  }

  // 6. Fine twigs: each branch end fans into this year's and last year's
  //    shoots, alternating left and right and reaching toward the light.
  //    This is the texture you see in a winter crown, and what leaves hang on.
  {
    const ends = [];
    for (let i = 0; i < nodes.length; i++) if (!nodes.kids[i].length && nodes.pos[i].y > cb * 0.9 && !streamers.includes(i)) ends.push(i);
    const perEnd = Math.max(2, Math.round(2 + 4 * sp.twiggy));
    const twig = (from, dir, len, order) => {
      const q = nodes.pos[from].clone().addScaledVector(dir, len);
      const j = nodes.add(q, from, { grow: false });
      if (order > 0) {
        const n2 = 1 + Math.round(r() * 1.4);
        for (let k = 0; k < n2; k++) {
          const side = perp(dir).applyAxisAngle(dir, r() * Math.PI * 2);
          const d2 = dir.clone().multiplyScalar(0.7).addScaledVector(side, 0.55 + 0.3 * r()).add(V(0, sp.tropism * 0.3 + (sp.weeping ? -0.4 : 0), 0)).normalize();
          twig(j, d2, len * (0.6 + 0.2 * r()), order - 1);
        }
      }
      return j;
    };
    for (const i of ends) {
      const par = nodes.parent[i];
      const dir = par >= 0 ? V().subVectors(nodes.pos[i], nodes.pos[par]).normalize() : UP.clone();
      const phase = r() * Math.PI * 2;
      for (let k = 0; k < perEnd; k++) {
        const side = perp(dir).applyAxisAngle(dir, phase + k * GOLDEN);
        const d = dir.clone().multiplyScalar(0.65).addScaledVector(side, 0.6 + 0.25 * r()).add(V(0, sp.tropism * 0.35, 0)).normalize();
        twig(i, d, D * (0.55 + 0.35 * r()), 1);
      }
      // The leader shoot continues straight on.
      twig(i, dir.clone().add(V(0, sp.tropism * 0.2, 0)).normalize(), D * 0.7, 1);
    }
  }

  // 7. Pipe-model radii, scaled so the trunk lands on a believable diameter.
  const N = nodes.length;
  const tipsCount = nodes.kids.filter((k) => !k.length).length || 1;
  const trunkR = Math.max(0.12, 0.019 * H + 0.011 * R) * (stems > 1 ? 0.7 : 1);
  const e = 2.3;
  const r0 = THREE.MathUtils.clamp(trunkR / Math.pow(tipsCount / stems, 1 / e), 0.012, 0.06);
  const rad = new Float32Array(N);
  const depth = new Int32Array(N); // steps to the farthest tip
  for (let i = N - 1; i >= 0; i--) {
    const ks = nodes.kids[i];
    if (!ks.length) {
      rad[i] = r0;
      depth[i] = 0;
      continue;
    }
    let s = 0;
    let dmax = 0;
    for (const k of ks) {
      s += Math.pow(rad[k], e);
      dmax = Math.max(dmax, depth[k] + 1);
    }
    rad[i] = Math.pow(s, 1 / e);
    depth[i] = dmax;
  }
  // Children are always added after parents, so reverse order is a valid post-order.
  // The pipe model runs thin at the base of big trees; swell the scaffold and
  // trunk toward the target while leaving the twigs as they are.
  const kTrunk = trunkR / Math.max(1e-3, rad[0]);
  if (kTrunk > 1) for (let i = 0; i < N; i++) rad[i] *= 1 + (kTrunk - 1) * Math.sqrt(rad[i] / rad[0]);

  const chains = buildChains(nodes, rad);
  const leaves = placeLeaves(nodes, rad, depth, { ...p, envelope, crownH, D, r, streamers, chains });
  const ornaments = placeOrnaments(nodes, depth, { ...p, envelope, crownH, D, r, leafLen: leaves.length || D });
  return { chains, leaves, ornaments, trunkR, D };
}

/** Branch chains for tube meshes: follow the thickest child, start a new chain at each fork. */
function buildChains(nodes, rad) {
  const chains = [];
  const N = nodes.length;
  const start = [0];
  // Extra roots (multi-stem trunks share node 0).
  while (start.length) {
    const s = start.pop();
    const pts = [];
    const rs = [];
    const par = nodes.parent[s];
    if (par >= 0) {
      pts.push(nodes.pos[par]);
      rs.push(rad[s] * 1.05);
    }
    let i = s;
    for (;;) {
      pts.push(nodes.pos[i]);
      rs.push(rad[i]);
      const ks = nodes.kids[i];
      if (!ks.length) break;
      let main = ks[0];
      for (const k of ks) if (rad[k] > rad[main]) main = k;
      for (const k of ks) if (k !== main) start.push(k);
      i = main;
    }
    if (pts.length >= 2) chains.push({ pts, rs });
  }
  return chains.length ? chains : [{ pts: [nodes.pos[0], nodes.pos[Math.min(1, N - 1)]], rs: [0.1, 0.05] }];
}

/*
 * Leaves on every current-year shoot: the last couple of steps before each
 * twig tip. Each shoot carries the species' leaf count in its arrangement
 * (opposite pairs turned 90° each node, or alternate on a 2/5 spiral), on
 * petioles angled out from the twig, blades turned toward the light.
 *
 * Then a coverage pass: the crown is projected straight down, from three
 * 40° and three 15° sun angles, and wherever the leaves leave a gap, a short twig carries a
 * small leaf cluster into it, until the crown blocks about as much light as
 * the tree's density says (a mature maple or linden casts near-solid shade;
 * a honeylocust stays dappled).
 */
function placeLeaves(nodes, rad, depth, p) {
  const { sp, leaf, cb, envelope, crownH, r, D, target, streamers, chains } = p;
  const leafArea = p.leafArea || 0.3; // opaque area of one leaf card, per length²
  const shoots = [];
  for (let i = 0; i < nodes.length; i++) {
    if (depth[i] > 1 || nodes.pos[i].y < cb * 0.85) continue;
    if (nodes.parent[i] < 0) continue;
    shoots.push(i);
  }
  const streamerSet = new Set();
  if (streamers.length) {
    for (const t of streamers) {
      let i = t;
      for (let k = 0; k < 60 && i >= 0 && nodes.kids[i].length <= 1; k++) {
        streamerSet.add(i);
        i = nodes.parent[i];
      }
    }
    const inShoots = new Set(shoots);
    for (const i of streamerSet) if (!inShoots.has(i)) shoots.push(i);
  }
  if (!shoots.length) return emptyLeaves();

  // Leaf scale: real size, enlarged only as far as the leaf budget needs to
  // clothe the crown, using the leaf's measured opaque area.
  const shell = (() => {
    let a = 0;
    for (let i = 0; i < 24; i++) a += 2 * Math.PI * Math.max(0.3, envelope(cb + ((i + 0.5) / 24) * crownH));
    return (a * crownH) / 24;
  })();
  const len = leaf.length + leaf.petiole;
  const count = Math.round(THREE.MathUtils.clamp(target, 800, 120000));
  const want = 2.4 * (0.5 + 0.6 * p.dens);
  // Very small leaves (Siberian elm, 2 in) may grow until each blocks about
  // 0.12 sq ft: at yard scale that reads the same, and keeps the count affordable.
  const scale = THREE.MathUtils.clamp(Math.sqrt((shell * want) / (count * len * len * leafArea)), 1, Math.max(2.2, Math.sqrt(0.12 / (len * len * leafArea))));
  const perShoot = Math.max(1, Math.round((count * 0.75) / shoots.length));

  const P = [];
  const Q = [];
  const S = [];
  const RND = [];
  const AO = [];
  const ORD = [];
  const q = new THREE.Quaternion();
  const m = new THREE.Matrix4();
  const aoAt = (b) => {
    const env = Math.max(0.3, envelope(b.y));
    const outer = THREE.MathUtils.clamp(Math.hypot(b.x, b.z) / env, 0, 1);
    const height = THREE.MathUtils.clamp((b.y - cb) / crownH, 0, 1);
    return { outer, height, ao: THREE.MathUtils.clamp(0.2 + 0.6 * outer * outer + 0.2 * height, 0, 1) };
  };
  const push = (base, tip, face, sz, info) => {
    const x = V().crossVectors(tip, face).normalize();
    m.makeBasis(x, tip, face);
    q.setFromRotationMatrix(m);
    P.push(base.x, base.y, base.z);
    Q.push(q.x, q.y, q.z, q.w);
    S.push(sz);
    RND.push(r());
    AO.push(info.ao);
    // Fall: outer, sunlit and upper leaves turn and drop first.
    ORD.push(THREE.MathUtils.clamp(0.55 * (1 - info.outer) + 0.25 * (1 - info.height) + 0.3 * r(), 0, 1));
  };
  const orientFace = (tip, outward, outer) => {
    // Sun leaves hold their blades flat to the light; shade leaves less so.
    const face = UP.clone().multiplyScalar(0.9).addScaledVector(outward, 0.45 + 0.4 * outer).addScaledVector(randUnit(r), 0.55);
    face.addScaledVector(tip, -face.dot(tip)).normalize();
    if (face.lengthSq() < 1e-4) face.copy(perp(tip));
    return face;
  };

  for (const i of shoots) {
    const a = nodes.pos[nodes.parent[i]];
    const b = nodes.pos[i];
    const dir = V().subVectors(b, a).normalize();
    const hanging = streamerSet.has(i);
    const shootLen = D * (hanging ? 1 : 0.9);
    const outward = V(b.x, 0, b.z).normalize();
    const info = aoAt(b);
    const side = perp(dir);
    const phase = r() * Math.PI * 2;
    for (let k = 0; k < perShoot; k++) {
      const t = (k + 0.5) / perShoot;
      const base = a.clone().lerp(b, 0.25).addScaledVector(dir, t * shootLen);
      const az = sp.arrange === 'opposite' ? phase + Math.floor(k / 2) * (Math.PI / 2) + (k % 2) * Math.PI : phase + k * GOLDEN;
      const around = side.clone().applyAxisAngle(dir, az);
      const pet = THREE.MathUtils.degToRad(hanging ? 25 : 45 + 25 * r());
      const tip = dir.clone().multiplyScalar(Math.cos(pet)).addScaledVector(around, Math.sin(pet));
      if (hanging) tip.lerp(V(0, -1, 0), 0.5);
      tip.y -= 0.25 * r();
      tip.normalize();
      base.addScaledVector(around, 0.02);
      push(base, tip, orientFace(tip, outward, info.outer), len * scale * (0.75 + 0.45 * r()) * (hanging ? 0.9 : 1), info);
    }
  }

  // ---- coverage pass
  const goal = THREE.MathUtils.clamp(0.3 + 0.68 * p.dens, 0.5, 0.97);
  const foot = Math.sqrt(leafArea / Math.PI); // footprint radius per unit leaf length
  const meanLen = len * scale;
  const cell = THREE.MathUtils.clamp(meanLen * foot * 0.5, 0.05, 0.4);
  // Enough fill to cover the crown's surface about twice over, which small
  // leaves on a narrow crown (birches) need far more of than their shoots carry.
  const budget = Math.round(THREE.MathUtils.clamp((2.2 * shell) / (meanLen * meanLen * leafArea), S.length * 1.1, S.length * 3));
  let added = 0;
  const twigGrid = new Grid(D * 4);
  shoots.forEach((i, k) => twigGrid.add(k, nodes.pos[i]));
  const twigNodes = shoots.map((i) => nodes.pos[i]);
  const dirs = [V(0, -1, 0)];
  const el = THREE.MathUtils.degToRad(40);
  for (let k = 0; k < 3; k++) {
    const az = (k / 3) * Math.PI * 2 + 0.4;
    dirs.push(V(Math.cos(az) * Math.cos(el), -Math.sin(el), Math.sin(az) * Math.cos(el)).normalize());
  }
  // Low sun (and the side view that matters most for a narrow column).
  const lo = THREE.MathUtils.degToRad(15);
  for (let k = 0; k < 3; k++) {
    const az = (k / 3) * Math.PI * 2 + 1.45;
    dirs.push(V(Math.cos(az) * Math.cos(lo), -Math.sin(lo), Math.sin(az) * Math.cos(lo)).normalize());
  }
  // Fill only near real twigs, so the crown keeps its clumps and scalloped
  // edge instead of rounding out to the smooth envelope. A voxel grid marks
  // everything within reach of a shoot.
  const reach = D * 1.3 + meanLen * 0.9;
  const vs = reach / 1.5;
  let vx0 = Infinity, vy0 = Infinity, vz0 = Infinity, vx1 = -Infinity, vy1 = -Infinity, vz1 = -Infinity;
  for (const t of twigNodes) {
    vx0 = Math.min(vx0, t.x); vy0 = Math.min(vy0, t.y); vz0 = Math.min(vz0, t.z);
    vx1 = Math.max(vx1, t.x); vy1 = Math.max(vy1, t.y); vz1 = Math.max(vz1, t.z);
  }
  vx0 -= reach; vy0 -= reach; vz0 -= reach;
  const VX = Math.ceil((vx1 + reach - vx0) / vs) + 1;
  const VY = Math.ceil((vy1 + reach - vy0) / vs) + 1;
  const VZ = Math.ceil((vz1 + reach - vz0) / vs) + 1;
  const vox = new Uint8Array(VX * VY * VZ);
  const vr = Math.ceil(reach / vs);
  for (const t of twigNodes) {
    const ix = Math.floor((t.x - vx0) / vs), iy = Math.floor((t.y - vy0) / vs), iz = Math.floor((t.z - vz0) / vs);
    for (let z = Math.max(0, iz - vr); z <= Math.min(VZ - 1, iz + vr); z++)
      for (let y = Math.max(0, iy - vr); y <= Math.min(VY - 1, iy + vr); y++)
        for (let x = Math.max(0, ix - vr); x <= Math.min(VX - 1, ix + vr); x++) {
          const dx = vx0 + (x + 0.5) * vs - t.x, dy = vy0 + (y + 0.5) * vs - t.y, dz = vz0 + (z + 0.5) * vs - t.z;
          if (dx * dx + dy * dy + dz * dz <= reach * reach) vox[(z * VY + y) * VX + x] = 1;
        }
  }
  const inside = (pt) => {
    const x = Math.floor((pt.x - vx0) / vs), y = Math.floor((pt.y - vy0) / vs), z = Math.floor((pt.z - vz0) / vs);
    if (x < 0 || y < 0 || z < 0 || x >= VX || y >= VY || z >= VZ) return false;
    return vox[(z * VY + y) * VX + x] === 1;
  };
  const tipV = V();
  const nV = V();
  const cV = V();
  // Drafts (slider drags) skip the pass; the full build follows shortly.
  for (const d of p.noFill ? [] : dirs) {
    const u = perp(d);
    const v = V().crossVectors(d, u).normalize();
    // Grid bounds from the crown volume's projection.
    const R = Math.max(...Array.from({ length: 16 }, (_, i) => envelope(cb + ((i + 0.5) / 16) * crownH)));
    const mid = V(0, cb + crownH / 2, 0);
    const ou = mid.dot(u);
    const ov = mid.dot(v);
    const ext = R + crownH * 0.6 + 2;
    const N = Math.min(1600, Math.ceil((2 * ext) / cell));
    const cs = (2 * ext) / N;
    const cov = new Uint8Array(N * N);
    const sil = new Uint8Array(N * N);
    const toCell = (pt) => [Math.floor((pt.dot(u) - ou + ext) / cs), Math.floor((pt.dot(v) - ov + ext) / cs)];
    // Silhouette: the twig-reach voxels projected on a 4× coarser grid (the
    // crown's outline doesn't need leaf resolution).
    const C = 4;
    const NC = Math.ceil(N / C);
    const silC = new Uint8Array(NC * NC);
    const csC = cs * C;
    const sr = (vs * 0.62) / csC;
    const vc = V();
    for (let z = 0; z < VZ; z++)
      for (let y = 0; y < VY; y++)
        for (let x = 0; x < VX; x++) {
          if (!vox[(z * VY + y) * VX + x]) continue;
          vc.set(vx0 + (x + 0.5) * vs, vy0 + (y + 0.5) * vs, vz0 + (z + 0.5) * vs);
          const fu = (vc.dot(u) - ou + ext) / csC;
          const fv = (vc.dot(v) - ov + ext) / csC;
          for (let j = Math.max(0, Math.floor(fv - sr)); j <= Math.min(NC - 1, Math.ceil(fv + sr)); j++)
            for (let i = Math.max(0, Math.floor(fu - sr)); i <= Math.min(NC - 1, Math.ceil(fu + sr)); i++)
              if ((i + 0.5 - fu) ** 2 + (j + 0.5 - fv) ** 2 <= sr * sr) silC[j * NC + i] = 1;
        }
    for (let y = 0; y < N; y++) {
      const row = Math.floor(y / C) * NC;
      for (let x = 0; x < N; x++) if (silC[row + Math.floor(x / C)]) sil[y * N + x] = 1;
    }
    const stamp = (i) => {
      q.fromArray(Q, i * 4);
      tipV.set(0, 1, 0).applyQuaternion(q);
      nV.set(0, 0, 1).applyQuaternion(q);
      cV.fromArray(P, i * 3).addScaledVector(tipV, S[i] * 0.6);
      const w = S[i] * foot * Math.max(0.3, Math.abs(nV.dot(d)));
      // Mark only cells whose centres the leaf's footprint actually covers.
      const fu = (cV.dot(u) - ou + ext) / cs;
      const fv = (cV.dot(v) - ov + ext) / cs;
      const wr = w / cs;
      let fresh = 0;
      for (let y = Math.floor(fv - wr); y <= Math.ceil(fv + wr); y++)
        for (let x = Math.floor(fu - wr); x <= Math.ceil(fu + wr); x++) {
          if ((x + 0.5 - fu) ** 2 + (y + 0.5 - fv) ** 2 > wr * wr) continue;
          if (x < 0 || y < 0 || x >= N || y >= N) continue;
          const k = y * N + x;
          if (!cov[k]) {
            cov[k] = 1;
            if (sil[k]) fresh++;
          }
        }
      return fresh;
    };
    for (let i = 0; i < S.length; i++) stamp(i);
    const gaps = [];
    let silN = 0;
    let covN = 0;
    for (let k = 0; k < N * N; k++) {
      if (!sil[k]) continue;
      silN++;
      if (cov[k]) covN++;
      else gaps.push(k);
    }
    // Shuffle so fills spread over the crown rather than sweeping it.
    for (let k = gaps.length - 1; k > 0; k--) {
      const j = Math.floor(r() * (k + 1));
      [gaps[k], gaps[j]] = [gaps[j], gaps[k]];
    }
    for (const gk of gaps) {
      if (covN / Math.max(1, silN) >= goal || added >= budget) break;
      if (cov[gk]) continue;
      // March along the light from outside the crown to where it enters.
      const ci = gk % N;
      const cj = Math.floor(gk / N);
      const origin = V().addScaledVector(u, (ci + 0.5) * cs - ext + ou).addScaledVector(v, (cj + 0.5) * cs - ext + ov);
      // origin lies on the plane through the crown centre; step back along -d.
      origin.add(d.clone().multiplyScalar(mid.dot(d)));
      const start = origin.clone().addScaledVector(d, -(R + crownH));
      let hit = null;
      const step = Math.max(0.35, meanLen * 0.4);
      const pt = V();
      for (let s2 = 0; s2 < ((R + crownH) * 2) / step; s2++) {
        pt.copy(start).addScaledVector(d, s2 * step);
        if (inside(pt)) {
          hit = pt.clone().addScaledVector(d, meanLen * 0.2);
          break;
        }
      }
      if (!hit) {
        cov[gk] = 1;
        continue;
      }
      // A short twig from the nearest shoot carries a small cluster into the gap.
      let best = twigNodes[0];
      let bd = Infinity;
      twigGrid.near(hit, (k) => {
        const dd = twigNodes[k].distanceToSquared(hit);
        if (dd < bd) {
          bd = dd;
          best = twigNodes[k];
        }
      });
      if (bd < (D * 4) ** 2 && chains) chains.push({ pts: [best, hit.clone()], rs: [0.03, 0.012] });
      const outward = V(hit.x, 0, hit.z).normalize();
      const info = aoAt(hit);
      const n = 3;
      for (let k = 0; k < n; k++) {
        const tip = randUnit(r).addScaledVector(d, -0.3);
        tip.addScaledVector(d, -tip.dot(d) * 0.6).normalize();
        const base = hit.clone().addScaledVector(randUnit(r), meanLen * 0.25);
        push(base, tip, orientFace(tip, outward, info.outer), len * scale * (0.8 + 0.4 * r()), info);
        covN += stamp(S.length - 1);
        added++;
      }
      if (!cov[gk]) {
        // The cluster landed beside this cell; count it covered so we move on.
        cov[gk] = 1;
        covN++;
      }
    }
  }

  const out = {
    count: S.length,
    pos: new Float32Array(P),
    quat: new Float32Array(Q),
    scale: new Float32Array(S),
    rand: new Float32Array(RND),
    ao: new Float32Array(AO),
    order: new Float32Array(ORD),
    length: len * scale,
    filled: added,
  };
  return out;
}
function emptyLeaves() {
  return { count: 0, pos: new Float32Array(0), quat: new Float32Array(0), scale: new Float32Array(0), rand: new Float32Array(0), ao: new Float32Array(0), order: new Float32Array(0), length: 0 };
}

/* Flowers, fruit, catkins, acorns, pods: hung from shoot tips. */
function placeOrnaments(nodes, depth, p) {
  const { sp, cb, crownH, envelope, r, H } = p;
  const out = [];
  for (const orn of sp.ornaments || []) {
    const list = [];
    // Trees that flower on bare wood (redbud, magnolia, plums) carry flowers
    // all along last year's twigs, not only at the tips: a cloud of colour.
    const bareWood = orn.type === 'blossom' && orn.to != null && orn.to <= 8;
    for (let i = 0; i < nodes.length; i++) {
      if (depth[i] > (bareWood ? 1 : 0) || nodes.pos[i].y < cb) continue;
      const b = nodes.pos[i];
      const a = nodes.pos[nodes.parent[i]] || b;
      const dir = V().subVectors(b, a).normalize();
      const outer = THREE.MathUtils.clamp(Math.hypot(b.x, b.z) / Math.max(0.3, envelope(b.y)), 0, 1);
      const height = (b.y - cb) / crownH;
      let chance = { blossom: 0.9, panicle: 0.65, bract: 0.35, catkin: 0.3, strobile: 0.25, acorn: 0.3, drupe: 0.4, pome: 0.55, pod: 0.25 }[orn.type] ?? 0.3;
      if (orn.type === 'panicle') chance *= height > 0.35 ? 1 : 0.3;
      if (r() > chance * (0.5 + 0.5 * outer)) continue;
      const hang = { blossom: false, panicle: false }[orn.type] === false ? false : true;
      const d = hang ? V(dir.x * 0.25, -1, dir.z * 0.25).addScaledVector(randUnit(r), 0.25).normalize()
        : dir.clone().lerp(UP, orn.type === 'panicle' ? 0.6 : 0.3).addScaledVector(randUnit(r), 0.4).normalize();
      const reps = orn.type === 'blossom' ? (bareWood ? 4 : 3) : orn.type === 'pome' ? 2 : 1;
      // The coverage pass clothes the crown out past the twig tips, so flowers
      // sit out at that leaf surface (fruit a little inside it) to be seen.
      // (Flowers that open on bare wood stay on the twigs.)
      const leafy = orn.to == null || orn.to > 8;
      const reach = leafy ? (p.D * 1.3 + (p.leafLen || p.D) * 0.9) * (hang ? 0.6 : 1.15) : 0;
      const out = V(b.x, 0, b.z).normalize().multiplyScalar(0.7).add(dir.clone().multiplyScalar(0.5)).add(V(0, hang ? 0 : 0.3, 0)).normalize();
      const at = b.clone().addScaledVector(out, reach);
      for (let k = 0; k < reps; k++) {
        const pos = (bareWood ? b.clone().lerp(a, r() * 0.8) : at.clone()).addScaledVector(randUnit(r), reps > 1 ? 0.18 : 0.02);
        list.push({ pos, dir: k ? d.clone().addScaledVector(randUnit(r), 0.35).normalize() : d, rand: r(), outer });
      }
    }
    out.push({ ...orn, list });
  }
  return out;
}

/* ------------------------------------------------------------ conifers */

/**
 * p: { H, R, cb, fn, dens, sp, shoot, shape, variant, target }
 */
export function growConifer(p) {
  const { H, R, cb, fn, sp, shoot, variant, dens } = p;
  const r = rng(hash(`con|${p.key}|${H.toFixed(1)}|${R.toFixed(1)}|${cb.toFixed(2)}|${variant}`));
  const crownH = Math.max(0.5, H - cb);
  const envelope = envelopeLUT(fn, R, cb, crownH);
  const chains = [];
  const shoots = [];
  const cones = [];
  const trunkR = Math.max(0.12, 0.018 * H + 0.01 * R);
  const mugo = p.key === 'pine' && H < 20 && p.shape !== 'columnar';
  const scaleSeg = shoot.length;

  // Stems: one leader, or for mugo a cluster of ascending stems.
  const stems = [];
  if (mugo) {
    stems.push({ base: V(0, 0, 0), top: V(0, H * 0.97, 0) });
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + r();
      stems.push({ base: V(0, 0, 0), top: V(Math.cos(a) * R * 0.45, H * 0.75, Math.sin(a) * R * 0.45) });
    }
  } else stems.push({ base: V(0, 0, 0), top: V((r() - 0.5) * 0.2, H, (r() - 0.5) * 0.2) });
  stems.forEach((s, k) => {
    const pts = [];
    const rs = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      pts.push(V().lerpVectors(s.base, s.top, t).add(V((r() - 0.5) * 0.06, 0, (r() - 0.5) * 0.06)));
      rs.push((k ? trunkR * 0.5 : trunkR) * (1 - t * 0.92));
    }
    chains.push({ pts, rs });
  });

  // Whorls: one a year up the leader, branches spaced by the golden angle.
  const whorl = Math.max(0.35, sp.whorl * Math.min(1, R / 5 + 0.35));
  const nWhorls = Math.max(5, Math.round(crownH / whorl));
  const ascend = sp.ascend ?? { spruce: -0.12, bluespruce: -0.06, norway: 0.05 }[p.key] ?? (p.key === 'arborvitae' || p.key === 'juniper' ? 0.9 : 0.35);
  const flat = p.key === 'arborvitae' || p.key === 'juniper';
  const shootCount = Math.max(1, p.target);
  const branches = [];
  for (let j = 0; j < nWhorls; j++) {
    const u = (j + 0.5) / nWhorls;
    const y = cb + u * crownH;
    const L = Math.max(0.25, envelope(y));
    const n = sp.perWhorl ? Math.max(3, sp.perWhorl + Math.round((r() - 0.5) * 2)) : THREE.MathUtils.clamp(Math.round(4 + L * 0.8 + (r() - 0.5) * 2), 4, 9);
    for (let k = 0; k < n; k++) {
      if (r() < 0.07) continue;
      const a = (k / n) * Math.PI * 2 + j * GOLDEN + (r() - 0.5) * 0.4;
      const dir = V(Math.cos(a), 0, Math.sin(a));
      let len = L * (0.85 + 0.25 * r()) * (flat ? 0.9 : 1);
      const start = V(0, y - (flat ? len * 0.4 : 0), 0);
      // Spruce: out and slightly down, tips lifting. Pines and cedars ascend.
      let end = start.clone().addScaledVector(dir, len).addScaledVector(UP, len * ascend + (p.key === 'norway' ? len * 0.12 : 0));
      let mid = start.clone().addScaledVector(dir, len * 0.55).addScaledVector(UP, len * (ascend - (flat ? 0 : 0.16)));
      if (sp.weep) {
        // Weeping spruce: a short limb that turns over and hangs against the trunk.
        const reach = L * (0.75 + 0.2 * r());
        const drop = Math.min(y - 0.4, 1.2 + reach * (1.6 + r()));
        mid = start.clone().addScaledVector(dir, reach * 1.15).addScaledVector(UP, reach * 0.15);
        end = start.clone().addScaledVector(dir, reach * 0.95).addScaledVector(UP, -drop);
        len = reach + drop * 0.8;
      }
      const pts = [];
      const rs = [];
      for (let i = 0; i <= 6; i++) {
        const t = i / 6;
        const q = V().copy(start).multiplyScalar((1 - t) * (1 - t)).addScaledVector(mid, 2 * (1 - t) * t).addScaledVector(end, t * t);
        pts.push(q);
        rs.push(Math.max(0.015, trunkR * 0.28 * (L / Math.max(R, 1)) * (1 - t * 0.85)));
      }
      chains.push({ pts, rs });
      branches.push({ pts, dir, len, u, a });
    }
  }
  // Mugo side stems carry their own short branches.
  if (mugo) {
    for (const s of stems.slice(1)) {
      for (let j = 0; j < 7; j++) {
        const t = 0.3 + (j / 7) * 0.65;
        const at = V().lerpVectors(s.base, s.top, t);
        const dir = V(s.top.x, 0, s.top.z).normalize().applyAxisAngle(UP, (j % 2 ? 1 : -1) * 0.9);
        const end = at.clone().addScaledVector(dir, R * 0.35).addScaledVector(UP, R * 0.25);
        const pts = [at, V().lerpVectors(at, end, 0.5), end];
        chains.push({ pts, rs: [0.05, 0.035, 0.02] });
        branches.push({ pts, dir, len: R * 0.4, u: t, a: Math.atan2(dir.z, dir.x) });
      }
    }
  }

  // Secondary branchlets and foliage shoots along them.
  const pend = sp.pendulous === true ? 0.6 : sp.pendulous || 0;
  const pendulous = pend > 0;
  let total = 0;
  const lens = branches.map((b) => b.len);
  const sumLen = lens.reduce((s, v) => s + v, 0) || 1;
  for (const b of branches) {
    const budget = (shootCount * b.len) / sumLen;
    const nSec = Math.max(1, Math.round(b.len / (scaleSeg * 1.3)));
    const perSec = Math.max(2, Math.round(budget / (nSec + 1)));
    const side = V().crossVectors(b.dir, UP).normalize();
    for (let s = 0; s <= nSec; s++) {
      const t = 0.15 + (s / nSec) * 0.85;
      const seg = t * (b.pts.length - 1);
      const k = Math.min(b.pts.length - 2, Math.floor(seg));
      const at = V().lerpVectors(b.pts[k], b.pts[k + 1], seg - k);
      const along = V().subVectors(b.pts[k + 1], b.pts[k]).normalize();
      const sign = s % 2 ? 1 : -1;
      const lenSec = (b.len * (sp.weep ? 0.12 : 0.45) * (1 - t * 0.7) + scaleSeg * 0.6) * (0.8 + 0.4 * r());
      let dir2;
      if (s === nSec) dir2 = along.clone();
      // Norway spruce: most branchlets hang in curtains, the rest lie flat
      // along the limb so the crown still closes over from above.
      else if (pend && t > 0.25 && r() < pend) dir2 = V(along.x * 0.15, -1, along.z * 0.15).addScaledVector(side, sign * 0.1).normalize();
      else dir2 = along.clone().multiplyScalar(0.55).addScaledVector(side, sign * 0.8).addScaledVector(UP, flat ? 0.5 : 0.05).normalize();
      const end = at.clone().addScaledVector(dir2, lenSec);
      if (lenSec > 0.4 && s !== nSec) chains.push({ pts: [at, end], rs: [0.022, 0.01] });
      for (let q = 0; q < perSec; q++) {
        const tt = (q + 0.5) / perSec;
        const pos = V().lerpVectors(at, end, tt).addScaledVector(randUnit(r), 0.05);
        // Shoot axis: along the branchlet, with a little splay.
        const axis = dir2.clone().addScaledVector(randUnit(r), flat ? 0.35 : 0.3).normalize();
        // Arborvitae holds flat, vertical fans; juniper cords point every which way.
        const face = p.key === 'arborvitae' ? V().crossVectors(axis, V().crossVectors(UP, axis).normalize()).normalize()
          : UP.clone().addScaledVector(randUnit(r), p.key === 'juniper' ? 1.4 : 0.5).addScaledVector(axis, -UP.dot(axis)).normalize();
        const outer = THREE.MathUtils.clamp(Math.hypot(pos.x, pos.z) / Math.max(0.3, envelope(pos.y)), 0, 1);
        shoots.push({ pos, axis, face, s: shoot.length * (0.75 + 0.5 * r()) * p.shootScale, rand: r(), ao: THREE.MathUtils.clamp(0.25 + 0.6 * outer + 0.15 * b.u, 0, 1) });
        total++;
      }
    }
    // Cones hang near the tips in the upper crown.
    if (sp.ornaments && b.u > 0.55 && r() < 0.35) {
      const tip = b.pts[b.pts.length - 1];
      cones.push({ pos: tip.clone().addScaledVector(b.dir, -0.2), dir: pendulous || p.key.includes('spruce') ? V(0, -1, 0) : b.dir.clone().lerp(UP, 0.4).normalize(), rand: r(), outer: 1 });
    }
  }
  // Dense conifer foliage hides a dark core so no daylight shows through the middle.
  // It starts a little above the lowest branches and swells in, so it never
  // shows below the foliage as a dark drum.
  const core = [new THREE.Vector2(0.02, cb + crownH * 0.04)];
  for (let i = 1; i <= 12; i++) {
    const t = i / 12;
    const y = cb + t * crownH;
    const swell = 0.25 + 0.75 * THREE.MathUtils.smoothstep(t, 0.04, 0.22);
    core.push(new THREE.Vector2(Math.max(0.05, envelope(y) * (flat ? 0.5 : 0.4) * (0.6 + 0.4 * dens) * swell), y));
  }
  core.push(new THREE.Vector2(0.01, H * 0.97));
  const ornaments = (sp.ornaments || []).map((o) => ({ ...o, list: o.type === 'berry' ? shoots.filter((_, i) => i % 23 === 0).map((s) => ({ pos: s.pos, dir: V(0, -1, 0), rand: s.rand, outer: 1 })) : cones }));
  return { chains, shoots, core, ornaments, trunkR };
}
