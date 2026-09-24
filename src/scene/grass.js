import * as THREE from 'three';

/**
 * Instanced turf. Each instance is a clump of 3 curved blades, built in units
 * of blade height so the same geometry works in feet or metres. A patched
 * MeshStandardMaterial adds wind but keeps shadows and image-based lighting.
 */

function bladeClumpGeometry() {
  const SEGS = 4;
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  // Offsets, widths and lean are fractions of blade height.
  const blades = [
    { x: 0, z: 0, rot: 0, h: 1, lean: 0.35 },
    { x: 0.2, z: 0.13, rot: 2.1, h: 0.82, lean: 0.45 },
    { x: -0.17, z: 0.18, rot: 4.2, h: 0.9, lean: 0.4 },
  ];
  for (const b of blades) {
    const base = positions.length / 3;
    const c = Math.cos(b.rot);
    const s = Math.sin(b.rot);
    for (let i = 0; i <= SEGS; i++) {
      const t = i / SEGS;
      const width = 0.07 * (1 - t * 0.85);
      const y = t * b.h;
      const lz = b.lean * t * t * b.h;
      for (const side of [-1, 1]) {
        const lx = side * width;
        positions.push(b.x + lx * c + lz * s, y, b.z - lx * s + lz * c);
        // Mostly-up normals: turf reads as a soft surface, not facets.
        normals.push(s * 0.15, 1, c * 0.15);
        uvs.push(side < 0 ? 0 : 1, t);
      }
    }
    for (let i = 0; i < SEGS; i++) {
      const a = base + i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.normalizeNormals();
  return g;
}

export class Grass {
  /** `height` is the mean blade height in scene units. */
  constructor(parent, { height = 0.3 } = {}) {
    this.parent = parent;
    this.height = height;
    this.uniforms = { uTime: { value: 0 }, uWind: { value: 1 } };
    this.geometry = bladeClumpGeometry();
    this.material = new THREE.MeshStandardMaterial({ roughness: 0.95, side: THREE.DoubleSide });
    this.material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform float uTime;
          uniform float uWind;
          varying float vHeight;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vHeight = uv.y;
          vec2 wp = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
          float gust = sin(wp.x * 0.11 + uTime * 1.3) * 0.5 + sin(wp.y * 0.08 + uTime * 0.9 + wp.x * 0.03) * 0.5;
          float flutter = sin(uTime * 4.0 + wp.x * 2.1 + wp.y * 1.5) * 0.15;
          float k = uv.y * uv.y * uWind;
          transformed.x += (gust * 0.3 + flutter * 0.12) * k;
          transformed.z += gust * 0.18 * k;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vHeight;')
        // Blades are double-sided with up-facing normals; don't flip them.
        .replace(
          '#include <normal_fragment_begin>',
          THREE.ShaderChunk.normal_fragment_begin.replace('gl_FrontFacing ? 1.0 : - 1.0', '1.0'),
        )
        // Darker blade bases: self-shadowing down in the thatch.
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          diffuseColor.rgb *= mix(0.5, 1.0, smoothstep(0.0, 0.8, vHeight));`,
        );
    };
    this.mesh = null;
  }

  /**
   * Scatters clumps over `bounds` ({x0,x1,y0,y1} in plan coordinates, plan y =
   * scene z) wherever `isLawn(x, y)` holds. `density` = clumps per square unit.
   */
  rebuild({ bounds, isLawn, density }) {
    this.dispose();
    if (!(density > 0)) return;
    const area = (bounds.x1 - bounds.x0) * (bounds.y1 - bounds.y0);
    const target = Math.min(400000, Math.floor(area * density));
    if (target <= 0) return;
    const mesh = new THREE.InstancedMesh(this.geometry, this.material, target);
    mesh.name = 'grass';
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.frustumCulled = false;
    mesh.raycast = () => {};

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const col = new THREE.Color();
    // Bluegrass / fescue mix: blue-green with a few yellower blades.
    const base = new THREE.Color(0x4f7a2c);
    const yellow = new THREE.Color(0x8a8f3a);
    const blue = new THREE.Color(0x3d6e3b);

    let n = 0;
    for (let i = 0; i < target; i++) {
      const x = bounds.x0 + Math.random() * (bounds.x1 - bounds.x0);
      const y = bounds.y0 + Math.random() * (bounds.y1 - bounds.y0);
      if (!isLawn(x, y)) continue;
      pos.set(x, 0, y);
      q.setFromAxisAngle(up, Math.random() * Math.PI * 2);
      const h = this.height * (0.65 + Math.random() * 0.7);
      scl.set(h * (1 + Math.random() * 0.6), h, h * (1 + Math.random() * 0.6));
      m.compose(pos, q, scl);
      mesh.setMatrixAt(n, m);
      // Broad patches of colour, the way a real lawn varies.
      const patch = 0.5 + 0.5 * Math.sin(x * 0.12 + Math.sin(y * 0.09) * 2) * Math.cos(y * 0.1 - x * 0.03);
      col.copy(base).lerp(blue, patch * 0.6).lerp(yellow, Math.random() * 0.1);
      col.multiplyScalar(0.9 + Math.random() * 0.2);
      mesh.setColorAt(n, col);
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.mesh = mesh;
    this.parent.add(mesh);
  }

  dispose() {
    if (!this.mesh) return;
    this.parent.remove(this.mesh);
    this.mesh.dispose();
    this.mesh = null;
  }

  update(time, wind) {
    this.uniforms.uTime.value = time;
    this.uniforms.uWind.value = wind;
  }
}
