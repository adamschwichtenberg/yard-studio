import * as THREE from 'three';
import { Tree as EzTree } from '@dgreenheck/ez-tree';
import { SPECIES, canopyState, heightAtAge } from './species.js';

// Mean luminance of each EZ-Tree leaf texture's opaque pixels, so recoloured
// leaves land on the species colour on average.
const LEAF_TEX_LUMA = { oak: 0.17, ash: 0.155, aspen: 0.34, pine: 0.14 };

/**
 * Generates one EZ-Tree per species (lazily), rebuilds its geometry in metres,
 * and hands out lightweight instances that share geometry and materials.
 */
export class TreeLibrary {
  constructor() {
    this.templates = new Map();
    this.uniforms = { uTime: { value: 0 }, uWind: { value: 0.5 } };
  }

  template(key) {
    if (!this.templates.has(key)) this.templates.set(key, this.#build(key));
    return this.templates.get(key);
  }

  #build(key) {
    const sp = SPECIES[key];
    const ez = new EzTree();
    ez.loadPreset(sp.preset);
    ez.options.copy(structuredClone(sp.options));
    ez.generate();

    // --- Branch geometry (Uint32 indices; EZ-Tree uses Uint16) ---
    const bark = new THREE.BufferGeometry();
    bark.setAttribute('position', new THREE.Float32BufferAttribute(ez.branches.verts, 3));
    bark.setAttribute('normal', new THREE.Float32BufferAttribute(ez.branches.normals, 3));
    bark.setAttribute('uv', new THREE.Float32BufferAttribute(ez.branches.uvs, 2));
    bark.setIndex(new THREE.Uint32BufferAttribute(ez.branches.indices, 1));

    // --- Leaf geometry: shuffle quads so a draw range = random subset ---
    const lv = ez.leaves.verts;
    const quadCount = lv.length / 12;
    const order = Array.from({ length: quadCount }, (_, i) => i);
    let s = sp.options.seed || 1;
    const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
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

    // --- Rescale to real-world size ---
    const box = new THREE.Box3().setFromBufferAttribute(bark.getAttribute('position'));
    box.union(new THREE.Box3().setFromBufferAttribute(leaves.getAttribute('position')));
    const size = box.getSize(new THREE.Vector3());
    const sy = sp.matureHeight / Math.max(size.y, 1e-3);
    const spread = Math.max(size.x, size.z) * sy;
    // Nudge the crown width toward the species spread, within natural limits.
    const sxz = sy * THREE.MathUtils.clamp(sp.matureSpread / spread, 0.6, 1.5);
    const m = new THREE.Matrix4().makeScale(sxz, sy, sxz);
    m.premultiply(new THREE.Matrix4().makeTranslation(0, -box.min.y * sy, 0));
    bark.applyMatrix4(m);
    leaves.applyMatrix4(m);

    // Foliage normals point out from the crown centre so the canopy shades as a
    // volume instead of a mess of randomly oriented cards.
    leaves.computeBoundingBox();
    const centre = leaves.boundingBox.getCenter(new THREE.Vector3());
    const half = leaves.boundingBox.getSize(new THREE.Vector3()).multiplyScalar(0.5);
    const nrm = new Float32Array(pos.length);
    const p = leaves.getAttribute('position');
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).sub(centre);
      v.set(v.x / half.x, (v.y / half.y) * 0.8 + 0.35, v.z / half.z).normalize();
      nrm.set([v.x, v.y, v.z], i * 3);
    }
    leaves.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    bark.computeBoundingSphere();
    leaves.computeBoundingSphere();

    // --- Materials (PBR so they pick up the HDRI) ---
    const src = ez.branchesMesh.material;
    const barkMat = new THREE.MeshStandardMaterial({
      name: `${key}-bark`,
      map: src.map,
      normalMap: src.normalMap,
      roughnessMap: src.roughnessMap,
      aoMap: src.aoMap,
      color: new THREE.Color(sp.options.bark?.tint ?? 0xffffff),
      roughness: 1,
    });

    const leafType = sp.options.leaves.type;
    const leafMat = new THREE.MeshStandardMaterial({
      name: `${key}-leaves`,
      map: ez.leavesMesh.material.map,
      alphaTest: sp.options.leaves.alphaTest ?? 0.5,
      side: THREE.DoubleSide,
      roughness: 0.75,
    });
    const leafUniforms = {
      uLeafColor: { value: new THREE.Color(sp.leafColor) },
      uFallColor: { value: new THREE.Color(sp.fallColor ?? sp.leafColor) },
      uFall: { value: 0 },
      uLumaNorm: { value: 1 / LEAF_TEX_LUMA[leafType] },
    };
    leafMat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms, leafUniforms);
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
          float sway = position.y * 0.012 * uWind;
          float ph = aRand * 6.2831 + origin.x * 0.3 + origin.z * 0.2;
          transformed.x += sway * (sin(uTime * 1.1 + ph) + 0.4 * sin(uTime * 2.7 + ph * 1.7));
          transformed.z += sway * 0.7 * cos(uTime * 0.9 + ph * 1.3);
          transformed.y += sway * 0.3 * sin(uTime * 3.1 + ph);`,
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
          // Texture supplies shape + detail; species colour supplies hue.
          // Clamp: mip levels bleed the texture's white matte into leaf edges.
          float l = min(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)) * uLumaNorm, 1.5);
          float turned = smoothstep(vRand * 0.6, vRand * 0.6 + 0.4, uFall);
          vec3 hue = mix(uLeafColor, uFallColor, turned);
          hue *= 0.82 + 0.36 * vRand;
          diffuseColor.rgb = hue * l;`,
        )
        // Keep crown-normals facing out on both sides of each card.
        .replace(
          '#include <normal_fragment_begin>',
          THREE.ShaderChunk.normal_fragment_begin.replace('gl_FrontFacing ? 1.0 : - 1.0', '1.0'),
        );
    };

    return {
      key,
      species: sp,
      bark,
      leaves,
      barkMat,
      leafMat,
      leafUniforms,
      leafIndexCount: idx.length,
      triangles: (ez.branches.indices.length + idx.length) / 3,
    };
  }

  /** A placeable tree. Height set by age; canopy by date via `applySeason`. */
  create(key, { years = 10 } = {}) {
    const t = this.template(key);
    const g = new THREE.Group();
    g.name = t.species.name;
    g.userData = { species: key, tree: true };
    const bark = new THREE.Mesh(t.bark, t.barkMat);
    const leaves = new THREE.Mesh(t.leaves, t.leafMat);
    bark.name = 'bark';
    leaves.name = 'leaves';
    for (const mesh of [bark, leaves]) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
    g.add(bark, leaves);
    g.rotation.y = Math.random() * Math.PI * 2;
    this.setAge(g, years);
    return g;
  }

  setAge(tree, years) {
    const sp = SPECIES[tree.userData.species];
    tree.userData.years = years;
    tree.scale.setScalar(heightAtAge(sp, years) / sp.matureHeight);
  }

  /** Updates leaf density + colour on every species for a day of year. */
  applySeason(dayOfYear) {
    for (const t of this.templates.values()) {
      const { density, fall } = canopyState(t.species, dayOfYear);
      const quads = Math.floor((t.leafIndexCount / 6) * density);
      t.leaves.setDrawRange(0, quads * 6);
      t.leafUniforms.uFall.value = fall;
    }
  }

  update(time) {
    this.uniforms.uTime.value = time;
  }
}

export { SPECIES };
