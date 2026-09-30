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
  key(x, y, z) {
    return `${Math.floor(x / this.cell)},${Math.floor(y / this.cell)},${Math.floor(z / this.cell)}`;
  }
  add(i, p) {
    const k = this.key(p.x, p.y, p.z);
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
          const b = this.map.get(`${cx + dx},${cy + dy},${cz + dz}`);
          if (b) for (const i of b) fn(i);
        }
  }
}

/* ------------------------------------------------------------ broadleaves */

/**
 * p: { H, R, cb, fn(u)→radius fraction, dens, sp (species profile), shape, variant, detail }
 */
export function growBroadleaf(p) {
  const { H, R, cb, fn, sp, shape, variant } = p;
  const r = rng(hash(`${shape}|${p.key}|${H.toFixed(1)}|${R.toFixed(1)}|${cb.toFixed(2)}|${variant}`));
  const crownH = Math.max(0.5, H - cb);
  const envelope = (y) => R * fn(THREE.MathUtils.clamp((y - cb) / crownH, 0, 1));
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
    const k = hollow + (1 - hollow) * Math.pow(r(), 0.38);
    const a = r() * Math.PI * 2;
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
    for (const a of attr) {
      if (!a.alive) continue;
      for (const j of fresh)
        if (nodes.pos[j].distanceToSquared(a.p) < dk * dk) {
          a.alive = false;
          break;
        }
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
  const leaves = placeLeaves(nodes, rad, depth, { ...p, envelope, crownH, D, r, streamers });
  const ornaments = placeOrnaments(nodes, depth, { ...p, envelope, crownH, D, r });
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
 */
function placeLeaves(nodes, rad, depth, p) {
  const { sp, leaf, H, cb, envelope, crownH, r, D, target, streamers } = p;
  const shoots = [];
  for (let i = 0; i < nodes.length; i++) {
    if (depth[i] > 1 || nodes.pos[i].y < cb * 0.85) continue;
    const par = nodes.parent[i];
    if (par < 0) continue;
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
    for (const i of streamerSet) if (!shoots.includes(i)) shoots.push(i);
  }
  if (!shoots.length) return emptyLeaves();

  // Leaf scale: real size, enlarged just enough that the target count still
  // clothes the crown (the fact sheet size at High detail with more leaves).
  const shell = (() => {
    let a = 0;
    for (let i = 0; i < 24; i++) a += 2 * Math.PI * Math.max(0.3, envelope(cb + ((i + 0.5) / 24) * crownH));
    return (a * crownH) / 24;
  })();
  const len = leaf.length + leaf.petiole;
  const area1 = leaf.length * leaf.length * leaf.width * 0.6;
  const coverage = 2.0 * (0.55 + 0.6 * p.dens);
  const count = Math.round(THREE.MathUtils.clamp(target, 800, 90000));
  const scale = THREE.MathUtils.clamp(Math.sqrt((shell * coverage) / (count * area1)), 1, 2.6);
  const perShoot = Math.max(1, Math.round(count / shoots.length));

  const n = shoots.length * perShoot;
  const out = {
    count: 0,
    pos: new Float32Array(n * 3),
    quat: new Float32Array(n * 4),
    scale: new Float32Array(n),
    rand: new Float32Array(n),
    ao: new Float32Array(n),
    order: new Float32Array(n),
    length: len * scale,
  };
  const q = new THREE.Quaternion();
  const m = new THREE.Matrix4();
  const crownMid = cb + crownH * 0.5;
  for (const i of shoots) {
    const a = nodes.pos[nodes.parent[i]];
    const b = nodes.pos[i];
    const dir = V().subVectors(b, a).normalize();
    const hanging = streamerSet.has(i);
    const shootLen = D * (hanging ? 1 : 0.9);
    const outward = V(b.x, 0, b.z);
    const radial = outward.length();
    outward.normalize();
    const env = Math.max(0.3, envelope(b.y));
    const outer = THREE.MathUtils.clamp(radial / env, 0, 1);
    const height = THREE.MathUtils.clamp((b.y - cb) / crownH, 0, 1);
    const ao = THREE.MathUtils.clamp(0.2 + 0.6 * outer * outer + 0.2 * height, 0, 1);
    let side = perp(dir);
    const phase = r() * Math.PI * 2;
    for (let k = 0; k < perShoot; k++) {
      const t = (k + 0.5) / perShoot;
      const base = a.clone().lerp(b, 0.25).addScaledVector(dir, t * shootLen);
      let az;
      if (sp.arrange === 'opposite') az = phase + Math.floor(k / 2) * (Math.PI / 2) + (k % 2) * Math.PI;
      else az = phase + k * GOLDEN;
      const around = side.clone().applyAxisAngle(dir, az);
      // Petiole angle: leaves stand out from the twig at 40–70°.
      const pet = THREE.MathUtils.degToRad(hanging ? 25 : 45 + 25 * r());
      const tip = dir.clone().multiplyScalar(Math.cos(pet)).addScaledVector(around, Math.sin(pet));
      if (hanging) tip.lerp(V(0, -1, 0), 0.5);
      // Sun leaves hold their blades flat to the light; shade leaves less so.
      tip.y -= 0.25 * r();
      tip.normalize();
      const face = UP.clone().multiplyScalar(0.9).addScaledVector(outward, 0.45 + 0.4 * outer).addScaledVector(randUnit(r), 0.55);
      face.addScaledVector(tip, -face.dot(tip)).normalize();
      if (face.lengthSq() < 1e-4) face.copy(perp(tip));
      const x = V().crossVectors(tip, face).normalize();
      m.makeBasis(x, tip, face);
      q.setFromRotationMatrix(m);
      const o = out.count++;
      out.pos[o * 3] = base.x + around.x * 0.02;
      out.pos[o * 3 + 1] = base.y + around.y * 0.02;
      out.pos[o * 3 + 2] = base.z + around.z * 0.02;
      q.toArray(out.quat, o * 4);
      out.scale[o] = len * scale * (0.75 + 0.45 * r()) * (hanging ? 0.9 : 1);
      out.rand[o] = r();
      out.ao[o] = ao;
      // Fall: outer, sunlit and upper leaves turn and drop first.
      out.order[o] = THREE.MathUtils.clamp(0.55 * (1 - outer) + 0.25 * (1 - height) + 0.3 * r(), 0, 1);
    }
  }
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
    for (let i = 0; i < nodes.length; i++) {
      if (depth[i] !== 0 || nodes.pos[i].y < cb) continue;
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
      const reps = orn.type === 'blossom' ? 3 : orn.type === 'pome' ? 2 : 1;
      for (let k = 0; k < reps; k++) {
        const pos = b.clone().addScaledVector(randUnit(r), reps > 1 ? 0.18 : 0.02);
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
  const envelope = (y) => R * fn(THREE.MathUtils.clamp((y - cb) / crownH, 0, 1));
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
  const ascend = { spruce: -0.12, bluespruce: -0.06, norway: 0.05 }[p.key] ?? (p.key === 'arborvitae' || p.key === 'juniper' ? 0.9 : 0.35);
  const flat = p.key === 'arborvitae' || p.key === 'juniper';
  const shootCount = Math.max(1, p.target);
  const branches = [];
  for (let j = 0; j < nWhorls; j++) {
    const u = (j + 0.5) / nWhorls;
    const y = cb + u * crownH;
    const L = Math.max(0.25, envelope(y));
    const n = THREE.MathUtils.clamp(Math.round(4 + L * 0.8 + (r() - 0.5) * 2), 4, 9);
    for (let k = 0; k < n; k++) {
      if (r() < 0.07) continue;
      const a = (k / n) * Math.PI * 2 + j * GOLDEN + (r() - 0.5) * 0.4;
      const dir = V(Math.cos(a), 0, Math.sin(a));
      const len = L * (0.85 + 0.25 * r()) * (flat ? 0.9 : 1);
      const start = V(0, y - (flat ? len * 0.4 : 0), 0);
      // Spruce: out and slightly down, tips lifting. Pines and cedars ascend.
      const end = start.clone().addScaledVector(dir, len).addScaledVector(UP, len * ascend + (p.key === 'norway' ? len * 0.12 : 0));
      const mid = start.clone().addScaledVector(dir, len * 0.55).addScaledVector(UP, len * (ascend - (flat ? 0 : 0.16)));
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
  const pendulous = !!sp.pendulous;
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
      const lenSec = (b.len * 0.45 * (1 - t * 0.7) + scaleSeg * 0.6) * (0.8 + 0.4 * r());
      let dir2;
      if (s === nSec) dir2 = along.clone();
      else if (pendulous && t > 0.25) dir2 = V(along.x * 0.15, -1, along.z * 0.15).addScaledVector(side, sign * 0.1).normalize();
      else dir2 = along.clone().multiplyScalar(0.55).addScaledVector(side, sign * 0.8).addScaledVector(UP, flat ? 0.5 : 0.05).normalize();
      const end = at.clone().addScaledVector(dir2, lenSec);
      if (lenSec > 0.4 && s !== nSec) chains.push({ pts: [at, end], rs: [0.022, 0.01] });
      for (let q = 0; q < perSec; q++) {
        const tt = (q + 0.5) / perSec;
        const pos = V().lerpVectors(at, end, tt).addScaledVector(randUnit(r), 0.05);
        // Shoot axis: along the branchlet, with a little splay.
        const axis = dir2.clone().addScaledVector(randUnit(r), flat ? 0.35 : 0.3).normalize();
        const face = flat ? V().crossVectors(axis, V().crossVectors(UP, axis).normalize()).normalize()
          : UP.clone().addScaledVector(randUnit(r), 0.5).addScaledVector(axis, -UP.dot(axis)).normalize();
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
  const core = [];
  for (let i = 0; i <= 12; i++) {
    const y = cb + (i / 12) * crownH;
    core.push(new THREE.Vector2(Math.max(0.05, envelope(y) * (flat ? 0.55 : 0.4) * (0.6 + 0.4 * dens)), y));
  }
  core.push(new THREE.Vector2(0.01, H * 0.97));
  const ornaments = (sp.ornaments || []).map((o) => ({ ...o, list: o.type === 'berry' ? shoots.filter((_, i) => i % 23 === 0).map((s) => ({ pos: s.pos, dir: V(0, -1, 0), rand: s.rand, outer: 1 })) : cones }));
  return { chains, shoots, core, ornaments, trunkR };
}
