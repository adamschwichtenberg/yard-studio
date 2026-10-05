import * as THREE from 'three';
import { Tree as EzTree } from '@dgreenheck/ez-tree';
import { SPECIES, LEAF, SHOOT, BARK, speciesFor } from './species.js';
import { growBroadleaf, growConifer } from './grow.js';
import { leafCard, shootCard, flowerCard, bractCard } from './leafArt.js';
import { barkMaps } from './barkMaps.js';
import { leafLitter } from '../scene/ground.js';

/*
 * Botanical trees for the planner. Each tree is grown from its species
 * profile (grow.js), then dressed with:
 *   - bark: tapered tubes along every branch chain, scanned bark textures
 *   - leaves: one instance per leaf, true to the species' shape and size,
 *     lit from both sides (pale undersides, light glowing through)
 *   - conifer shoots: needle or scale sprays along the branchlets
 *   - ornaments: blossoms, panicles, bracts, catkins, fruit, acorns, pods, cones
 *
 * Seasons change instance scales, not geometry: leaves expand after leaf-out,
 * turn from the outside in, and fall a few at a time; flowers open and drop;
 * fruit hangs on into winter. Shadows follow because the shadow pass renders
 * the same instances.
 */

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/* One sun for every leaf material: world direction toward the sun and its colour. */
export const SUN = { uSunDir: { value: new THREE.Vector3(0.3, 0.8, 0.2).normalize() }, uSunColor: { value: new THREE.Color(1, 0.96, 0.9) } };

/* ------------------------------------------------------------ geometry helpers */

class Buf {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.uv = [];
    this.idx = [];
  }
  get count() {
    return this.pos.length / 3;
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.count > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}

/** Tapered tube through pts with per-point radii; UVs in world units so bark texel density is even. */
function tube(B, pts, rs, texSize, flare = 0) {
  if (pts.length < 2) return;
  const rMax = Math.max(...rs);
  const segs = rMax > 0.6 ? 14 : rMax > 0.25 ? 10 : rMax > 0.08 ? 6 : rMax > 0.035 ? 4 : 3;
  const base = B.count;
  let normal = null;
  let v = 0;
  const wraps = Math.max(1, Math.round((Math.PI * 2 * rMax) / texSize));
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const T = V().subVectors(b, a).normalize();
    if (!normal) {
      const ref = Math.abs(T.y) < 0.95 ? V(0, 1, 0) : V(1, 0, 0);
      normal = V().crossVectors(T, ref).normalize();
    } else normal.sub(T.clone().multiplyScalar(normal.dot(T))).normalize();
    const bin = V().crossVectors(T, normal);
    if (i > 0) v += p.distanceTo(pts[i - 1]) / texSize;
    let r = rs[i];
    // Root flare: the base swells into the ground.
    if (flare && p.y < flare) r *= 1 + 0.55 * (1 - p.y / flare) ** 2;
    for (let s = 0; s <= segs; s++) {
      const th = (s / segs) * Math.PI * 2;
      const ox = normal.x * Math.cos(th) + bin.x * Math.sin(th);
      const oy = normal.y * Math.cos(th) + bin.y * Math.sin(th);
      const oz = normal.z * Math.cos(th) + bin.z * Math.sin(th);
      B.pos.push(p.x + ox * r, p.y + oy * r, p.z + oz * r);
      B.nor.push(ox, oy, oz);
      B.uv.push((s / segs) * wraps, v);
    }
  }
  const row = segs + 1;
  for (let i = 0; i < pts.length - 1; i++)
    for (let s = 0; s < segs; s++) {
      const a = base + i * row + s;
      const b = a + row;
      B.idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
}

/** A leaf blade: petiole at the origin, tip at +Y, folded along the midrib and drooping at the tip. */
function leafGeometry(aspect, fold = 0.22, droop = 0.12) {
  const w = aspect / 2;
  const P = [
    [-w, 0, fold * w], [0, 0, 0], [w, 0, fold * w],
    [-w, 1, fold * w - droop], [0, 1, -droop], [w, 1, fold * w - droop],
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P.flat(), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0.5, 0, 1, 0, 0, 1, 0.5, 1, 1, 1], 2));
  g.setIndex([0, 1, 4, 0, 4, 3, 1, 2, 5, 1, 5, 4]);
  g.computeVertexNormals();
  return g;
}
/** Two crossed quads, base at origin, running up +Y: shoots and flowers read from every side. */
function crossGeometry(aspect = 1) {
  const w = aspect / 2;
  const g = new THREE.BufferGeometry();
  const pos = [-w, 0, 0, w, 0, 0, w, 1, 0, -w, 1, 0, 0, 0, -w, 0, 0, w, 0, 1, w, 0, 1, -w];
  const nor = [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0];
  const uv = [0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1];
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  return g;
}
function podGeometry() {
  // Honeylocust pod: a long, flat, twisting strap.
  const B = [];
  const U = [];
  const I = [];
  const n = 12;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const tw = t * Math.PI * 1.3;
    const w = 0.09 * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.05));
    B.push(Math.cos(tw) * w, -t, Math.sin(tw) * w, -Math.cos(tw) * w, -t, -Math.sin(tw) * w);
    U.push(0, t, 1, t);
    if (i) I.push(2 * i - 2, 2 * i - 1, 2 * i, 2 * i - 1, 2 * i + 1, 2 * i);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(B, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.setIndex(I);
  g.computeVertexNormals();
  return g;
}
function coneGeometry() {
  // Spindle: hangs down from its stalk (origin at the top).
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    pts.push(new THREE.Vector2(0.22 * Math.sin(Math.PI * Math.min(1, t * 1.05)) ** 0.8 + 0.01, -t));
  }
  return new THREE.LatheGeometry(pts, 8);
}
function acornGeometry() {
  const nut = new THREE.SphereGeometry(0.5, 8, 6);
  nut.scale(0.85, 1.1, 0.85);
  nut.translate(0, -0.6, 0);
  return nut;
}
const GEOS = {};
function sharedGeo(name, make) {
  if (!GEOS[name]) {
    GEOS[name] = make();
    GEOS[name].userData.shared = true;
  }
  return GEOS[name];
}

/* ------------------------------------------------------------ materials */

function foliageMaterial({ map, luma, leaf, fall, under, translucency = 0.45, side = THREE.DoubleSide, shoot = false }) {
  const uniforms = {
    uLeafColor: { value: new THREE.Color(leaf) },
    uFallColor: { value: new THREE.Color(fall) },
    uUnder: { value: new THREE.Color(under) },
    uFall: { value: 0 },
    uLumaNorm: { value: 1 / luma },
    uTrans: { value: translucency },
    ...SUN,
  };
  const mat = new THREE.MeshStandardMaterial({ map, alphaTest: shoot ? 0.35 : 0.5, side, roughness: shoot ? 0.8 : 0.62, metalness: 0 });
  mat.userData.uniforms = uniforms;
  mat.customProgramCacheKey = () => (shoot ? 'yard-shoot2' : 'yard-leaf2');
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aRand;
        attribute float aAO;
        attribute float aOrder;
        varying float vRand;
        varying float vAO;
        varying float vOrder;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vRand = aRand; vAO = aAO; vOrder = aOrder;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 uLeafColor;
        uniform vec3 uFallColor;
        uniform vec3 uUnder;
        uniform float uFall;
        uniform float uLumaNorm;
        uniform float uTrans;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        varying float vRand;
        varying float vAO;
        varying float vOrder;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float l = min(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)) * uLumaNorm, 1.6);
        // Fall colour starts on the outer, sunlit leaves and works inward.
        float turned = smoothstep(vOrder * 0.75, vOrder * 0.75 + 0.35, uFall);
        vec3 hue = mix(uLeafColor, uFallColor * (0.85 + 0.3 * vRand), turned);
        // Leaf-to-leaf variation: a touch warmer or cooler, lighter or darker.
        hue *= mix(vec3(0.9, 0.96, 1.04), vec3(1.06, 1.03, 0.9), vRand) * (0.84 + 0.3 * fract(vRand * 7.31));
        // Undersides are paler (silver maple, aspen, willow).
        if (!gl_FrontFacing) hue = mix(hue, uUnder * (0.55 + 0.45 * l), 0.55 * (1.0 - turned));
        diffuseColor.rgb = hue * l;`)
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>
        float canopyAO = mix(0.28, 1.0, vAO);
        reflectedLight.indirectDiffuse *= canopyAO;
        reflectedLight.directDiffuse *= mix(0.55, 1.0, vAO);
        // Light through the leaf: back-lit blades glow warm green.
        vec3 sunV = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
        float back = max(0.0, dot(-normal, sunV)) * max(0.0, dot(sunV, normalize(vViewPosition) * -1.0) * 0.5 + 0.5);
        reflectedLight.directDiffuse += diffuseColor.rgb * uSunColor * back * uTrans * mix(0.4, 1.0, vAO);`);
  };
  return mat;
}

function flowerMaterial(map, luma, colors) {
  const uniforms = {
    uC0: { value: new THREE.Color(colors[0]) },
    uC1: { value: new THREE.Color(colors[1]) },
    uC2: { value: new THREE.Color(colors[2] ?? colors[1]) },
    uPhase: { value: 0 },
    uLumaNorm: { value: 1 / luma },
  };
  const mat = new THREE.MeshStandardMaterial({ map, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8 });
  mat.userData.uniforms = uniforms;
  mat.customProgramCacheKey = () => 'yard-bloom2';
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute float aRand;
        varying float vRand;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vRand = aRand;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 uC0; uniform vec3 uC1; uniform vec3 uC2; uniform float uPhase; uniform float uLumaNorm;
        varying float vRand;`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        float l = min(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)) * uLumaNorm, 1.5);
        float ph = clamp(uPhase + (vRand - 0.5) * 0.25, 0.0, 1.0);
        vec3 hue = ph < 0.5 ? mix(uC0, uC1, ph * 2.0) : mix(uC1, uC2, ph * 2.0 - 1.0);
        diffuseColor.rgb = hue * l;`)
      // Thin petals pass light: a little glow keeps blossoms reading as
      // white or pink inside a shaded crown instead of going grey.
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * 0.22;`);
  };
  return mat;
}

/* ------------------------------------------------------------ seasons */

/** Is day d (days after leaf-out, any sign) inside [from, to], wrapping round the year? */
function windowPhase(d, from, to) {
  const len = to - from;
  let x = (((d - from) % 365) + 365) % 365;
  if (x > len) return -1;
  return x / Math.max(1, len);
}

/** Day of the year for "MM-DD". */
function mdDayOf(md) {
  const [m, d] = md.split('-').map(Number);
  return Date.UTC(2001, m - 1, d) / 86400000 - Date.UTC(2001, 0, 1) / 86400000;
}

/* ------------------------------------------------------------ library */

const DEFAULT_LEAF = 0x46702c;
const DEFAULT_FALL = 0xb5782a;
const DEFAULT_NEEDLE = { spruce: 0x2c4a2e, bluespruce: 0x7092a8, norway: 0x284a26, pine: 0x2e4d22, redpine: 0x2e4d22, arborvitae: 0x3f6a2e, juniper: 0x5f7a6c,
  weepingspruce: 0x3a5a4a, fir: 0x2a4a2e, whitepine: 0x3a6048, scotchpine: 0x4a6a5a, tamarack: 0x6a9a4a };
const DEFAULT_BLOOM = { blossom: [0xb0305a, 0xe89ab4, 0xf2d6de], panicle: [0xc8dc8a, 0xf1f1e2, 0xd8a4a4] };

export class TreeLibrary {
  constructor() {
    this.cache = new Map();
    this.high = false;
    this.bark = {};
  }

  setHighDetail(on) {
    if (this.high === !!on) return false;
    this.high = !!on;
    this.cache.clear();
    return true;
  }

  #barkMaterial(kind) {
    if (this.bark[kind]) return this.bark[kind];
    const spec = BARK[kind] || BARK.maple;
    const got = barkMaps(kind);
    const maps = got ? { map: got.map, normalMap: got.normalMap } : this.#scanned(spec.scan || 'oak');
    const color = got?.color || new THREE.Color(got?.tinted ? 0xffffff : spec.tint);
    const mat = new THREE.MeshStandardMaterial({ ...maps, color, roughness: 0.92 });
    if (maps.normalMap) mat.normalScale.set(1.2, 1.2);
    maps.texSize = got?.texSize;
    mat.userData.texSize = maps.texSize || 2.2;
    this.bark[kind] = mat;
    return mat;
  }
  #scanned(type) {
    const ez = new EzTree();
    ez.options.bark.type = type;
    ez.options.branch.levels = 0;
    ez.options.leaves.count = 0;
    ez.generate();
    const src = ez.branchesMesh.material;
    const maps = {};
    for (const k of ['map', 'normalMap']) {
      if (!src[k]) continue;
      const t = src[k].clone();
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.needsUpdate = true;
      maps[k] = t;
    }
    return maps;
  }

  #target(sp, shell, dens) {
    // Enough shoots that each card stays near life size (a big card reads as a feather up close).
    if (sp.conifer) return Math.round(THREE.MathUtils.clamp(shell * (this.high ? 8 : 5) * (0.55 + 0.5 * dens), 800, this.high ? 40000 : 24000));
    // Base leaves on the shoots; the coverage pass adds what it takes to close the crown.
    return Math.round(THREE.MathUtils.clamp(shell * (this.high ? 18 : 9) * (0.5 + 0.6 * dens), 1500, this.high ? 70000 : 32000));
  }

  #grow(t, key, profile, crownBase, draft) {
    const sp = SPECIES[key];
    const H = Math.max(2, t.height);
    const R = Math.max(0.5, t.spread / 2);
    const dens = Math.round(THREE.MathUtils.clamp(t.density ?? 0.85, 0.1, 1) * 20) / 20;
    const variant = (t.id ?? 0) % 4;
    const ck = [key, t.shape, H.toFixed(1), R.toFixed(1), dens, crownBase.toFixed(3), this.high, variant, !!draft].join('|');
    let g = this.cache.get(ck);
    if (g) return g;
    const cb = H * crownBase;
    const crownH = Math.max(0.5, H - cb);
    let shell = 0;
    for (let i = 0; i < 16; i++) shell += 2 * Math.PI * Math.max(0.3, R * profile(THREE.MathUtils.clamp((i + 0.5) / 16, 0, 1)));
    shell = (shell * crownH) / 16;
    // Drafts (while a slider is moving) grow a fifth of the leaves and skip the coverage pass.
    const target = Math.round(this.#target(sp, shell, dens) * (draft ? 0.2 : 1));
    const p = { key, H, R, cb, fn: profile, dens, sp, shape: t.shape, variant, target, noFill: !!draft };
    if (sp.conifer) {
      const shoot = SHOOT[sp.shoot];
      const area = shoot.length * shoot.length * 0.55;
      p.shoot = shoot;
      // Junipers: more, smaller sprays so their fine texture reads.
      if (sp.shootBoost) p.target = target * sp.shootBoost;
      p.shootScale = THREE.MathUtils.clamp(Math.sqrt((shell * 3.6) / (p.target * area)), 1.3, sp.shootMax ?? 3.4);
      g = { conifer: true, ...growConifer(p) };
    } else {
      p.leaf = LEAF[sp.leaf];
      p.leafArea = leafCard(sp.leaf, this.high).area;
      g = { conifer: false, ...growBroadleaf(p) };
    }
    // Bark mesh, built once per growth.
    const B = new Buf();
    const texSize = this.#barkMaterial(barkKey(t, key)).userData.texSize;
    g.chains.forEach((c, i) => tube(B, c.pts, c.rs, texSize, i === 0 ? Math.min(2.5, H * 0.08) : 0));
    g.barkGeo = B.geometry();
    g.barkGeo.userData.shared = true;
    if (g.core) {
      g.coreGeo = new THREE.LatheGeometry(g.core, 10);
      g.coreGeo.userData.shared = true;
    }
    this.cache.set(ck, g);
    if (this.cache.size > 60) this.cache.delete(this.cache.keys().next().value);
    return g;
  }

  /**
   * A tree group for plan tree `t`. profile(u) is the crown radius fraction at
   * height fraction u; crownBase the fraction of height where the crown starts.
   * season: { grow, fall, drop, day } — see app.js seasonNow().
   */
  build(t, { bare = false, draft = false, season = {}, crownBase = 0.25, profile = (u) => Math.sin(Math.PI * u) } = {}) {
    const key = speciesFor(t);
    const sp = SPECIES[key];
    const g = this.#grow(t, key, profile, crownBase, draft);
    const grp = new THREE.Group();
    const inner = new THREE.Group();
    inner.rotation.y = ((t.id ?? 0) * 2.399963) % (Math.PI * 2);
    grp.add(inner);

    const bark = new THREE.Mesh(g.barkGeo, this.#barkMaterial(barkKey(t, key)));
    bark.castShadow = bark.receiveShadow = true;
    bark.raycast = () => {};
    inner.add(bark);

    const leafColor = t.leaf ?? (sp.conifer ? DEFAULT_NEEDLE[key] : DEFAULT_LEAF);
    const fallColor = t.fall ?? (sp.conifer ? leafColor : DEFAULT_FALL);

    if (sp.conifer && sp.deciduous && bare) {
      // A tamarack in winter: bare twigs only.
    } else if (sp.conifer) {
      const tex = shootCard(key, this.high);
      const mat = foliageMaterial({ map: tex.map, luma: tex.luma, leaf: leafColor, fall: sp.deciduous ? fallColor : leafColor, under: new THREE.Color(leafColor).multiplyScalar(1.15), translucency: sp.deciduous ? 0.4 : 0.2, shoot: true });
      const mesh = instanced(crossGeometry(0.85), mat, g.shoots.length, (i, m, pos, q, s) => {
        const sh = g.shoots[i];
        const x = V().crossVectors(sh.axis, sh.face).normalize();
        m.makeBasis(x, sh.axis, V().crossVectors(x, sh.axis));
        q.setFromRotationMatrix(m);
        pos.copy(sh.pos).addScaledVector(sh.axis, -sh.s * 0.15);
        s.setScalar(sh.s);
      });
      if (sp.deciduous) {
        // Needles that colour and fall like leaves: hand the shoots to the leaf writer.
        const n = g.shoots.length;
        const lv = { count: n, pos: new Float32Array(n * 3), quat: new Float32Array(n * 4), scale: new Float32Array(n), rand: new Float32Array(n), ao: new Float32Array(n), order: new Float32Array(n) };
        const m4 = new THREE.Matrix4();
        const p3 = V(), s3 = V(), q4 = new THREE.Quaternion();
        for (let i = 0; i < n; i++) {
          mesh.getMatrixAt(i, m4);
          m4.decompose(p3, q4, s3);
          p3.toArray(lv.pos, i * 3);
          q4.toArray(lv.quat, i * 4);
          lv.scale[i] = s3.x;
          lv.rand[i] = g.shoots[i].rand;
          lv.ao[i] = g.shoots[i].ao;
          lv.order[i] = THREE.MathUtils.clamp(0.6 * (1 - g.shoots[i].ao) + 0.4 * g.shoots[i].rand, 0, 1);
        }
        fillAttrs(mesh.geometry, lv.rand, lv.ao, lv.order);
        mesh.userData.leafData = lv;
        mesh.userData.foliage = { kind: 'leaves', evergreen: false };
        writeLeaves(mesh, season);
      } else {
        fillAttrs(mesh.geometry, g.shoots.map((s) => s.rand), g.shoots.map((s) => s.ao), g.shoots.map(() => 0));
        mesh.userData.foliage = { kind: 'shoots', evergreen: true };
      }
      inner.add(mesh);
      // Dense conifers get a dark inner mass; open pines and tamarack show daylight through.
      if (g.coreGeo && !sp.deciduous && !sp.open) {
        const cm = new THREE.MeshStandardMaterial({ color: new THREE.Color(leafColor).multiplyScalar(0.3), roughness: 1 });
        const core = new THREE.Mesh(g.coreGeo, cm);
        core.castShadow = core.receiveShadow = true;
        core.raycast = () => {};
        inner.add(core);
      }
    } else if (!bare && g.leaves.count) {
      const L = LEAF[sp.leaf];
      const tex = leafCard(sp.leaf, this.high);
      const under = new THREE.Color(L.underside);
      const mat = foliageMaterial({ map: tex.map, luma: tex.luma, leaf: leafColor, fall: fallColor, under });
      const lv = g.leaves;
      const mesh = new THREE.InstancedMesh(leafGeometry(tex.aspect), mat, lv.count);
      fillAttrs(mesh.geometry, lv.rand, lv.ao, lv.order);
      // Ginkgo turns together and drops within a day or two: squeeze the drop order.
      mesh.userData.leafData = sp.syncDrop ? { ...lv, order: lv.order.map((o) => 0.86 + 0.06 * o) } : lv;
      mesh.userData.foliage = { kind: 'leaves', evergreen: !!t.evergreen };
      // Canada Red chokecherry: leaves open green and turn purple by midsummer.
      if (sp.shift && t.leaf2 != null) mesh.userData.foliage.shift = { ...sp.shift, c0: new THREE.Color(leafColor), c1: new THREE.Color(t.leaf2) };
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.raycast = () => {};
      inner.add(mesh);
      writeLeaves(mesh, season);
    }

    // Ornaments: flowers, fruit, catkins, cones.
    for (const orn of g.ornaments || []) {
      if (!orn.list.length) continue;
      const mesh = this.#ornamentMesh(t, orn);
      if (!mesh) continue;
      mesh.userData.orn = orn;
      inner.add(mesh);
      writeOrnament(mesh, season);
    }

    for (const m of inner.children) {
      if (m.userData.foliage) m.userData.foliage.uniforms = m.material.userData.uniforms;
    }
    this.setSeason(grp, season);

    // Ground under the tree: leaf litter in fall only (lawn runs right up to the trunk otherwise).
    if (!t.evergreen) {
      const litter = leafLitter(Math.max(2.5, t.spread * 0.58), fallColor);
      grp.add(litter);
      writeLitter(litter, season);
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

  #ornamentMesh(t, orn) {
    const n = orn.list.length;
    let mesh;
    if (orn.type === 'blossom' || orn.type === 'panicle') {
      const tex = flowerCard(orn.type, this.high);
      const colors = t.bloom || DEFAULT_BLOOM[orn.type];
      mesh = new THREE.InstancedMesh(crossGeometry(orn.type === 'panicle' ? 0.75 : 1), flowerMaterial(tex.map, tex.luma, colors), n);
      fillAttrs(mesh.geometry, orn.list.map((o) => o.rand), null, null);
    } else if (orn.type === 'bract') {
      const tex = bractCard();
      const mat = new THREE.MeshStandardMaterial({ map: tex.map, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8 });
      mesh = new THREE.InstancedMesh(crossGeometry(tex.aspect), mat, n);
    } else {
      const geo = orn.type === 'pod' ? sharedGeo('pod', podGeometry)
        : orn.type === 'cone' || orn.type === 'strobile' || orn.type === 'catkin' ? sharedGeo('cone', coneGeometry)
        : orn.type === 'acorn' ? sharedGeo('acorn', acornGeometry)
        : sharedGeo('berry', () => new THREE.IcosahedronGeometry(0.5, 1));
      const mat = new THREE.MeshStandardMaterial({ roughness: orn.type === 'berry' || orn.type === 'pome' ? 0.45 : 0.85 });
      mesh = new THREE.InstancedMesh(geo, mat, n);
      // A variety's own fruit colour (Snowdrift's orange-red crabs) wins over the species'.
      const fc = orn.type === 'pome' && t.fruit ? t.fruit : orn.color || [0x888888, 0x888888];
      const c0 = new THREE.Color(fc[0]);
      const c1 = new THREE.Color(fc[1] ?? fc[0]);
      const c = new THREE.Color();
      for (let i = 0; i < n; i++) mesh.setColorAt(i, c.copy(c0).lerp(c1, orn.list[i].rand));
    }
    mesh.castShadow = orn.type === 'panicle' || orn.type === 'pod';
    mesh.receiveShadow = true;
    mesh.raycast = () => {};
    return mesh;
  }

  /** Apply a season to every tree under root: leaf growth, fall colour and drop, ornaments. */
  setSeason(root, season = {}) {
    root.traverse((o) => {
      const f = o.userData.foliage;
      if (f && f.kind === 'leaves') {
        f.uniforms.uFall.value = f.evergreen ? 0 : season.fall || 0;
        if (f.shift) {
          const k = THREE.MathUtils.smoothstep(season.day ?? 60, f.shift.from, f.shift.to);
          f.uniforms.uLeafColor.value.copy(f.shift.c0).lerp(f.shift.c1, k);
        }
        writeLeaves(o, season);
      }
      if (o.userData.orn) writeOrnament(o, season);
      if (o.userData.litter) writeLitter(o, season);
    });
  }
  /** v1 compatibility. */
  setFall(root, fall) {
    this.setSeason(root, { fall, grow: 1 });
  }
}

/* Litter builds as leaves drop, lies for about three weeks, then is raked or blown away. */
function writeLitter(mesh, season) {
  const since = season.sinceDrop ?? -99;
  let a = 0;
  if (since < 0) a = season.drop ? Math.min(1, season.drop * 1.1) : 0;
  else a = since < 22 ? 1 : Math.max(0, 1 - (since - 22) / 20);
  mesh.material.opacity = 0.92 * a;
  mesh.visible = a > 0.01;
}

function barkKey(t, key) {
  const sp = SPECIES[key];
  if (key === 'riverbirch') return 'riverbirch';
  return sp.bark || 'maple';
}

function fillAttrs(geo, rand, ao, order) {
  const n = rand.length;
  geo.setAttribute('aRand', new THREE.InstancedBufferAttribute(rand instanceof Float32Array ? rand : new Float32Array(rand), 1));
  geo.setAttribute('aAO', new THREE.InstancedBufferAttribute(ao ? (ao instanceof Float32Array ? ao : new Float32Array(ao)) : new Float32Array(n).fill(1), 1));
  geo.setAttribute('aOrder', new THREE.InstancedBufferAttribute(order ? (order instanceof Float32Array ? order : new Float32Array(order)) : new Float32Array(n), 1));
}

function instanced(geo, mat, n, set) {
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = V();
  const s = V();
  for (let i = 0; i < n; i++) {
    set(i, m, pos, q, s);
    m.compose(pos, q, s);
    mesh.setMatrixAt(i, m);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.raycast = () => {};
  mesh.computeBoundingSphere();
  return mesh;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

/* Leaves expand over the fortnight after leaf-out and fall a few at a time before leaf drop. */
function writeLeaves(mesh, season) {
  const lv = mesh.userData.leafData;
  const grow = season.grow ?? 1;
  const drop = season.drop ?? 0;
  const key = `${grow.toFixed(3)}|${drop.toFixed(3)}`;
  if (mesh.userData.seasonKey === key) return;
  mesh.userData.seasonKey = key;
  let live = 0;
  for (let i = 0; i < lv.count; i++) {
    // Early leaves open first; the latest-opening lag about a week.
    const g = THREE.MathUtils.clamp((grow - lv.rand[i] * 0.35) / 0.65, 0, 1);
    const k = drop > lv.order[i] ? 0 : 0.2 + 0.8 * g;
    _p.fromArray(lv.pos, i * 3);
    _q.fromArray(lv.quat, i * 4);
    _s.setScalar(lv.scale[i] * k);
    _m.compose(_p, _q, _s);
    mesh.setMatrixAt(i, _m);
    if (k > 0) live++;
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.visible = live > 0;
  mesh.computeBoundingSphere();
}

/* Ornaments appear and go inside their window; flowers open and drop a few at a time. */
const ORN_SIZE = { blossom: 0.42, panicle: 0.95, bract: 0.45, catkin: 0.28, strobile: 0.12, acorn: 0.14, drupe: 0.06, pome: 0.1, berry: 0.06, pod: 1.2, cone: 0.35 };
function writeOrnament(mesh, season) {
  const orn = mesh.userData.orn;
  const day = season.day ?? 60;
  let amount = 1;
  let phase = 0.5;
  if (orn.md) {
    // calendar dates rather than days after leaf-out
    const ph = season.md ? windowPhase(mdDayOf(season.md), mdDayOf(orn.md[0]), mdDayOf(orn.md[1])) : -1;
    if (ph < 0) amount = 0;
    else {
      phase = ph;
      amount = THREE.MathUtils.clamp(Math.min(ph / (orn.open ?? 0.15), (1 - ph) / (orn.fade ?? 0.12)), 0, 1);
    }
  } else if (orn.from != null) {
    const ph = windowPhase(day, orn.from, orn.to);
    if (ph < 0) amount = 0;
    else {
      phase = ph;
      amount = THREE.MathUtils.clamp(Math.min(ph / 0.15, (1 - ph) / 0.12), 0, 1);
      if (orn.winter) amount = Math.min(1, ph / 0.1);
    }
  }
  if (orn.bloom && mesh.material.userData.uniforms) mesh.material.userData.uniforms.uPhase.value = phase;
  const key = amount.toFixed(3);
  if (mesh.userData.seasonKey === key) return;
  mesh.userData.seasonKey = key;
  mesh.visible = amount > 0.001;
  if (!mesh.visible) return;
  const base = (ORN_SIZE[orn.type] || 0.2) * (orn.size ? orn.size / (orn.type === 'cone' ? 4 : 1) : 1);
  for (let i = 0; i < orn.list.length; i++) {
    const o = orn.list[i];
    const k = o.rand < amount ? 1 : 0;
    const up = orn.type === 'blossom' || orn.type === 'panicle' || orn.type === 'bract' ? 1 : -1;
    const dir = o.dir.clone();
    if (up < 0) dir.set(dir.x * 0.3, -1, dir.z * 0.3).normalize();
    const x = Math.abs(dir.y) < 0.95 ? V().crossVectors(dir, V(0, 1, 0)).normalize() : V(1, 0, 0);
    _m.makeBasis(x, up > 0 ? dir : dir.clone().negate(), V().crossVectors(x, up > 0 ? dir : dir.clone().negate()));
    _q.setFromRotationMatrix(_m);
    _s.setScalar(base * (0.8 + 0.4 * o.rand) * k);
    _m.compose(o.pos, _q, _s);
    mesh.setMatrixAt(i, _m);
  }
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingSphere();
}
