import * as THREE from 'three';
import { Tree as EzTree } from '@dgreenheck/ez-tree';

/*
 * Realistic trees for the planner.
 *
 * Every plan tree is parametric: crown shape, height, spread, density, evergreen.
 * The shade engine works from those numbers, so the visual tree must match them.
 * We grow one EZ-Tree per (shape × leaf type × variant), normalise it to a unit
 * crown (height 1, crown diameter 1, trunk at the origin), then scale each plan
 * tree to its exact height and spread. Density picks how many leaf cards draw.
 */

// Mean luminance of each EZ-Tree leaf texture's opaque pixels, so recoloured
// leaves land on the requested colour on average.
const LEAF_TEX_LUMA = { oak: 0.17, ash: 0.155, aspen: 0.34, pine: 0.14 };
const VARIANTS = 3;

// EZ-Tree recipes per crown shape (EZ-Tree's own units; rescaled afterwards).
const RECIPES = {
  round: {
    preset: 'Oak Medium',
    options: {
      bark: { type: 'oak', tint: 0xb4ada2, textureScale: { x: 1, y: 6 } },
      branch: {
        levels: 3,
        angle: { 1: 46, 2: 48, 3: 40 },
        children: { 0: 9, 1: 5, 2: 4 },
        force: { direction: { x: 0, y: 1, z: 0 }, strength: 0.008 },
        gnarliness: { 0: 0.03, 1: 0.1, 2: 0.14, 3: 0.08 },
        length: { 0: 32, 1: 16, 2: 9, 3: 5 },
        radius: { 0: 1.4, 1: 0.65, 2: 0.6, 3: 0.8 },
        taper: { 0: 0.75, 1: 0.6, 2: 0.7, 3: 0.7 },
      },
      leaves: { billboard: 'double', angle: 40, count: 16, start: 0.1, size: 2.7, sizeVariance: 0.5, alphaTest: 0.5 },
    },
  },
  oval: {
    preset: 'Ash Medium',
    options: {
      bark: { type: 'oak', tint: 0xa39d92, textureScale: { x: 1, y: 6 } },
      branch: {
        levels: 3,
        angle: { 1: 30, 2: 40, 3: 40 },
        children: { 0: 12, 1: 4, 2: 4 },
        force: { direction: { x: 0, y: 1, z: 0 }, strength: 0.018 },
        gnarliness: { 0: 0.02, 1: 0.07, 2: 0.1, 3: 0.08 },
        length: { 0: 36, 1: 13, 2: 6, 3: 4 },
        radius: { 0: 1.1, 1: 0.6, 2: 0.6, 3: 0.8 },
        taper: { 0: 0.8, 1: 0.6, 2: 0.7, 3: 0.7 },
      },
      leaves: { billboard: 'double', angle: 35, count: 16, start: 0.1, size: 2.4, sizeVariance: 0.4, alphaTest: 0.5 },
    },
  },
  pyramidal: {
    // Central leader, shorter limbs higher up: EZ-Tree's "evergreen" skeleton.
    preset: 'Pine Medium',
    options: {
      type: 'evergreen',
      bark: { type: 'oak', tint: 0xa39d92, textureScale: { x: 1, y: 6 } },
      branch: {
        levels: 2,
        angle: { 1: 68, 2: 42 },
        children: { 0: 46, 1: 8 },
        force: { direction: { x: 0, y: 1, z: 0 }, strength: 0.01 },
        gnarliness: { 0: 0.02, 1: 0.1, 2: 0.2 },
        length: { 0: 42, 1: 21, 2: 6 },
        radius: { 0: 1.3, 1: 0.35, 2: 0.6 },
        sections: { 0: 14, 1: 8, 2: 4 },
        segments: { 0: 8, 1: 5, 2: 3 },
        taper: { 0: 0.7, 1: 0.7, 2: 0.7 },
      },
      leaves: { billboard: 'double', angle: 35, count: 12, start: 0.05, size: 3.0, sizeVariance: 0.4, alphaTest: 0.5 },
    },
  },
  columnar: {
    preset: 'Ash Medium',
    options: {
      bark: { type: 'oak', tint: 0xa39d92, textureScale: { x: 1, y: 6 } },
      branch: {
        levels: 3,
        angle: { 1: 16, 2: 30, 3: 35 },
        children: { 0: 16, 1: 4, 2: 3 },
        force: { direction: { x: 0, y: 1, z: 0 }, strength: 0.03 },
        gnarliness: { 0: 0.01, 1: 0.05, 2: 0.08, 3: 0.08 },
        length: { 0: 40, 1: 9, 2: 4, 3: 3 },
        radius: { 0: 0.9, 1: 0.5, 2: 0.5, 3: 0.7 },
        taper: { 0: 0.8, 1: 0.6, 2: 0.7, 3: 0.7 },
      },
      leaves: { billboard: 'double', angle: 30, count: 16, start: 0.05, size: 2.2, sizeVariance: 0.4, alphaTest: 0.5 },
    },
  },
  spreading: {
    preset: 'Oak Large',
    options: {
      bark: { type: 'oak', tint: 0x9e958a, textureScale: { x: 1, y: 6 } },
      branch: {
        levels: 3,
        angle: { 1: 62, 2: 52, 3: 42 },
        children: { 0: 8, 1: 5, 2: 4 },
        force: { direction: { x: 0, y: 1, z: 0 }, strength: 0.002 },
        gnarliness: { 0: 0.05, 1: 0.18, 2: 0.2, 3: 0.1 },
        length: { 0: 30, 1: 22, 2: 10, 3: 5 },
        radius: { 0: 1.8, 1: 0.7, 2: 0.6, 3: 0.8 },
        taper: { 0: 0.7, 1: 0.6, 2: 0.7, 3: 0.7 },
      },
      leaves: { billboard: 'double', angle: 40, count: 14, start: 0.15, size: 2.7, sizeVariance: 0.5, alphaTest: 0.5 },
    },
  },
  vase: {
    preset: 'Ash Large',
    options: {
      bark: { type: 'oak', tint: 0x9a9388, textureScale: { x: 1, y: 6 } },
      branch: {
        levels: 3,
        angle: { 1: 26, 2: 36, 3: 40 },
        children: { 0: 7, 1: 5, 2: 4 },
        force: { direction: { x: 0, y: 1, z: 0 }, strength: 0.02 },
        gnarliness: { 0: 0.02, 1: 0.08, 2: 0.12, 3: 0.1 },
        length: { 0: 22, 1: 26, 2: 10, 3: 5 },
        radius: { 0: 1.5, 1: 0.8, 2: 0.6, 3: 0.8 },
        taper: { 0: 0.7, 1: 0.6, 2: 0.7, 3: 0.7 },
      },
      leaves: { billboard: 'double', angle: 40, count: 14, start: 0.2, size: 2.4, sizeVariance: 0.5, alphaTest: 0.5 },
    },
  },
  weeping: {
    preset: 'Aspen Medium',
    options: {
      bark: { type: 'birch', tint: 0xc9c2b6, textureScale: { x: 1, y: 6 } },
      branch: {
        levels: 3,
        angle: { 1: 48, 2: 50, 3: 45 },
        children: { 0: 10, 1: 5, 2: 4 },
        force: { direction: { x: 0, y: 1, z: 0 }, strength: -0.035 },
        gnarliness: { 0: 0.04, 1: 0.12, 2: 0.18, 3: 0.1 },
        length: { 0: 32, 1: 16, 2: 10, 3: 6 },
        radius: { 0: 1.2, 1: 0.6, 2: 0.5, 3: 0.7 },
        taper: { 0: 0.75, 1: 0.6, 2: 0.7, 3: 0.7 },
      },
      leaves: { billboard: 'double', angle: 25, count: 20, start: 0.1, size: 2.2, sizeVariance: 0.4, alphaTest: 0.5 },
    },
  },
  // Conifers
  conifer: {
    preset: 'Pine Medium',
    options: {
      type: 'evergreen',
      bark: { type: 'pine', tint: 0x8c7f70 },
      branch: {
        levels: 2,
        angle: { 1: 78, 2: 45 },
        children: { 0: 96, 1: 5 },
        gnarliness: { 0: 0.02, 1: 0.1, 2: 0.15 },
        length: { 0: 44, 1: 20, 2: 5 },
        radius: { 0: 1.0, 1: 0.3, 2: 0.5 },
        sections: { 0: 18, 1: 6, 2: 3 },
        segments: { 0: 7, 1: 4, 2: 3 },
      },
      leaves: { type: 'pine', billboard: 'double', angle: 28, count: 10, start: 0.0, size: 2.3, sizeVariance: 0.3, alphaTest: 0.35 },
    },
  },
  coniferColumn: {
    preset: 'Pine Medium',
    options: {
      type: 'evergreen',
      bark: { type: 'pine', tint: 0x7d6f62 },
      branch: {
        levels: 2,
        angle: { 1: 50, 2: 45 },
        children: { 0: 110, 1: 5 },
        gnarliness: { 0: 0.01, 1: 0.1, 2: 0.15 },
        length: { 0: 44, 1: 9, 2: 3 },
        radius: { 0: 0.8, 1: 0.3, 2: 0.5 },
        sections: { 0: 18, 1: 5, 2: 3 },
        segments: { 0: 7, 1: 4, 2: 3 },
      },
      leaves: { type: 'pine', billboard: 'double', angle: 28, count: 10, start: 0.0, size: 2.1, sizeVariance: 0.3, alphaTest: 0.35 },
    },
  },
};

/** Leaf texture for a plan tree: by name where we can tell, else by shape. */
function leafTypeFor(t) {
  if (t.evergreen) return 'pine';
  const n = (t.name || '').toLowerCase();
  if (/maple|oak/.test(n)) return 'oak';
  if (/linden|alder|crab|hydrangea|birch|aspen|poplar|serviceberry/.test(n)) return 'aspen';
  if (/elm|ash|locust|honey|willow/.test(n)) return 'ash';
  return { round: 'oak', spreading: 'oak', vase: 'ash', weeping: 'ash' }[t.shape] || 'aspen';
}

function recipeFor(t) {
  if (t.evergreen) return t.shape === 'columnar' ? 'coniferColumn' : 'conifer';
  return RECIPES[t.shape] ? t.shape : 'round';
}

const DEFAULT_LEAF = 0x46702c;
const DEFAULT_FALL = 0xb5782a;
const DEFAULT_NEEDLE = 0x2c4a26;

export class TreeLibrary {
  constructor() {
    this.templates = new Map();
    this.uniforms = { uTime: { value: 0 }, uWind: { value: 1 } };
  }

  /** Normalised template: trunk at origin, height 1, crown diameter 1. */
  template(recipeKey, leafType, variant, crownBase) {
    const key = `${recipeKey}|${leafType}|${variant}|${crownBase.toFixed(2)}`;
    let t = this.templates.get(key);
    if (!t) {
      t = this.#grow(recipeKey, leafType, variant, crownBase);
      this.templates.set(key, t);
    }
    return t;
  }

  #grow(recipeKey, leafType, variant, crownBase) {
    const recipe = RECIPES[recipeKey];
    const ez = new EzTree();
    ez.loadPreset(recipe.preset);
    const opts = structuredClone(recipe.options);
    opts.seed = 1009 + variant * 7919 + recipeKey.length * 131;
    opts.leaves = { ...opts.leaves, type: leafType };
    // Where limbs start up the trunk tracks the plan's crown-base fraction.
    opts.branch.start = { ...(opts.branch.start || {}), 1: Math.min(0.6, Math.max(0.02, crownBase)) };
    ez.options.copy(opts);
    ez.generate();

    const bark = new THREE.BufferGeometry();
    bark.setAttribute('position', new THREE.Float32BufferAttribute(ez.branches.verts, 3));
    bark.setAttribute('normal', new THREE.Float32BufferAttribute(ez.branches.normals, 3));
    bark.setAttribute('uv', new THREE.Float32BufferAttribute(ez.branches.uvs, 2));
    bark.setIndex(new THREE.Uint32BufferAttribute(ez.branches.indices, 1));

    // Leaf quads in random order, so a draw range is a random subset.
    const lv = ez.leaves.verts;
    const quadCount = lv.length / 12;
    const order = Array.from({ length: quadCount }, (_, i) => i);
    let s = opts.seed;
    const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = quadCount - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const pos = new Float32Array(quadCount * 12);
    const uv = new Float32Array(quadCount * 8);
    const rnd = new Float32Array(quadCount * 4);
    const idx = new Uint32Array(quadCount * 6);
    order.forEach((q, n) => {
      pos.set(lv.slice(q * 12, q * 12 + 12), n * 12);
      uv.set(ez.leaves.uvs.slice(q * 8, q * 8 + 8), n * 8);
      rnd.fill(rand(), n * 4, n * 4 + 4);
      const b = n * 4;
      idx.set([b, b + 1, b + 2, b, b + 2, b + 3], n * 6);
    });
    const leaves = new THREE.BufferGeometry();
    leaves.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    leaves.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    leaves.setAttribute('aRand', new THREE.BufferAttribute(rnd, 1));
    leaves.setIndex(new THREE.BufferAttribute(idx, 1));

    // Normalise: base at y=0, top at y=1, crown radius (95th percentile of
    // leaf distance from the trunk axis) = 0.5.
    let top = 0;
    const radii = [];
    for (let i = 0; i < pos.length; i += 3) {
      top = Math.max(top, pos[i + 1]);
      radii.push(Math.hypot(pos[i], pos[i + 2]));
    }
    const barkPos = bark.getAttribute('position');
    for (let i = 0; i < barkPos.count; i++) top = Math.max(top, barkPos.getY(i));
    radii.sort((a, b) => a - b);
    const crownR = radii[Math.floor(radii.length * 0.95)] || 1;
    const m = new THREE.Matrix4().makeScale(0.5 / crownR, 1 / top, 0.5 / crownR);
    bark.applyMatrix4(m);
    leaves.applyMatrix4(m);

    // Crown-centred normals: the canopy shades as one volume.
    leaves.computeBoundingBox();
    const centre = leaves.boundingBox.getCenter(new THREE.Vector3());
    const half = leaves.boundingBox.getSize(new THREE.Vector3()).multiplyScalar(0.5);
    const p = leaves.getAttribute('position');
    const nrm = new Float32Array(p.count * 3);
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).sub(centre);
      v.set(v.x / half.x, (v.y / half.y) * 0.8 + 0.35, v.z / half.z).normalize();
      nrm.set([v.x, v.y, v.z], i * 3);
    }
    leaves.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    bark.computeBoundingSphere();
    leaves.computeBoundingSphere();
    // Shared by every tree built from this template: never dispose per tree.
    bark.userData.shared = leaves.userData.shared = true;

    const src = ez.branchesMesh.material;
    const barkMat = new THREE.MeshStandardMaterial({
      map: src.map,
      normalMap: src.normalMap,
      roughnessMap: src.roughnessMap,
      aoMap: src.aoMap,
      color: new THREE.Color(recipe.options.bark?.tint ?? 0xffffff),
      roughness: 1,
    });

    return {
      bark,
      leaves,
      barkMat,
      leafMap: ez.leavesMesh.material.map,
      leafType,
      alphaTest: recipe.options.leaves.alphaTest ?? 0.5,
      quads: quadCount,
    };
  }

  #leafMaterial(t, leafColor, fallColor) {
    const uniforms = {
      uLeafColor: { value: new THREE.Color(leafColor) },
      uFallColor: { value: new THREE.Color(fallColor) },
      uFall: { value: 0 },
      uLumaNorm: { value: 1 / LEAF_TEX_LUMA[t.leafType] },
    };
    const mat = new THREE.MeshStandardMaterial({
      map: t.leafMap,
      alphaTest: t.alphaTest,
      side: THREE.DoubleSide,
      roughness: 0.75,
    });
    mat.userData.uniforms = uniforms;
    mat.customProgramCacheKey = () => 'ez-leaf';
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform float uTime;
          uniform float uWind;
          attribute float aRand;
          varying float vRand;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vRand = aRand;
          vec3 origin = modelMatrix[3].xyz;
          // Sway grows with height; the template is 1 unit tall.
          float sway = position.y * 0.012 * uWind;
          float ph = aRand * 6.2831 + origin.x * 0.1 + origin.z * 0.07;
          transformed.x += sway * (sin(uTime * 1.1 + ph) + 0.4 * sin(uTime * 2.7 + ph * 1.7));
          transformed.z += sway * 0.7 * cos(uTime * 0.9 + ph * 1.3);`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform vec3 uLeafColor;
          uniform vec3 uFallColor;
          uniform float uFall;
          uniform float uLumaNorm;
          varying float vRand;`,
        )
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
          // Texture gives shape and detail; the tree's colour gives hue.
          // Clamped because mip levels bleed the texture's white matte into edges.
          float l = min(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)) * uLumaNorm, 1.5);
          float turned = smoothstep(vRand * 0.6, vRand * 0.6 + 0.4, uFall);
          vec3 hue = mix(uLeafColor, uFallColor, turned) * (0.82 + 0.36 * vRand);
          diffuseColor.rgb = hue * l;`,
        )
        .replace(
          '#include <normal_fragment_begin>',
          THREE.ShaderChunk.normal_fragment_begin.replace('gl_FrontFacing ? 1.0 : - 1.0', '1.0'),
        );
    };
    return mat;
  }

  /**
   * A tree group for a plan tree `t` ({id, shape, height, spread, density,
   * evergreen, name, leaf?, fall?}). `crownBase` is the shape's base fraction.
   */
  build(t, { bare = false, fall = 0, crownBase = 0.25 } = {}) {
    const leafType = leafTypeFor(t);
    const tpl = this.template(recipeFor(t), leafType, t.id % VARIANTS, crownBase);
    const grp = new THREE.Group();
    const inner = new THREE.Group();
    inner.rotation.y = (t.id * 2.399) % (Math.PI * 2);
    inner.scale.set(t.spread, t.height, t.spread);
    grp.add(inner);

    const bark = new THREE.Mesh(tpl.bark, tpl.barkMat);
    bark.castShadow = bark.receiveShadow = true;
    bark.raycast = () => {};
    inner.add(bark);

    if (!bare) {
      // A view onto the template's buffers with its own draw range.
      const geo = new THREE.BufferGeometry();
      for (const [name, attr] of Object.entries(tpl.leaves.attributes)) geo.setAttribute(name, attr);
      geo.setIndex(tpl.leaves.index);
      geo.boundingSphere = tpl.leaves.boundingSphere;
      const dens = Math.min(1, Math.max(0.1, t.density ?? 0.85));
      geo.setDrawRange(0, Math.round(tpl.quads * (0.4 + 0.6 * dens)) * 6);
      const leafColor = t.leaf ?? (t.evergreen ? DEFAULT_NEEDLE : DEFAULT_LEAF);
      const mat = this.#leafMaterial(tpl, leafColor, t.fall ?? (t.evergreen ? leafColor : DEFAULT_FALL));
      mat.userData.uniforms.uFall.value = t.evergreen ? 0 : fall;
      const leaves = new THREE.Mesh(geo, mat);
      leaves.castShadow = leaves.receiveShadow = true;
      leaves.raycast = () => {};
      leaves.userData.leafUniforms = mat.userData.uniforms;
      leaves.userData.evergreen = !!t.evergreen;
      // Disposing this view would free the template's shared GPU buffers.
      geo.userData.shared = true;
      inner.add(leaves);
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
    });
  }

  update(time, wind) {
    this.uniforms.uTime.value = time;
    this.uniforms.uWind.value = wind;
  }
}
