import * as THREE from 'three';

/**
 * Instanced turf. Each instance is a small clump of 3 curved blades so volume
 * builds up without one draw per blade. Uses MeshStandardMaterial (patched for
 * wind) so the grass receives tree shadows and HDRI lighting like everything else.
 */

function bladeClumpGeometry() {
  const SEGS = 4;
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const blades = [
    { x: 0, z: 0, rot: 0, h: 1, lean: 0.25 },
    { x: 0.018, z: 0.012, rot: 2.1, h: 0.82, lean: 0.35 },
    { x: -0.015, z: 0.016, rot: 4.2, h: 0.9, lean: 0.3 },
  ];
  for (const b of blades) {
    const base = positions.length / 3;
    const c = Math.cos(b.rot);
    const s = Math.sin(b.rot);
    for (let i = 0; i <= SEGS; i++) {
      const t = i / SEGS;
      const width = 0.009 * (1 - t * 0.85);
      const y = t * b.h;
      const bend = b.lean * t * t; // curve forward
      for (const side of [-1, 1]) {
        const lx = side * width;
        const lz = bend * b.h;
        positions.push(b.x + lx * c + lz * s, y, b.z - lx * s + lz * c);
        // Normals mostly up: turf reads as a soft surface rather than facets.
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
  constructor(scene, { isLawn, bounds, density = 90, height = 0.09 }) {
    this.scene = scene;
    this.isLawn = isLawn;
    this.bounds = bounds;
    this.height = height;
    this.uniforms = { uTime: { value: 0 }, uWind: { value: 0.6 } };

    this.geometry = bladeClumpGeometry();
    this.material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.95,
      side: THREE.DoubleSide,
    });
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
          #ifdef USE_INSTANCING
            vec2 wp = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
          #else
            vec2 wp = vec2(0.0);
          #endif
          float gust = sin(wp.x * 0.35 + uTime * 1.3) * 0.5 + sin(wp.y * 0.27 + uTime * 0.9 + wp.x * 0.1) * 0.5;
          float flutter = sin(uTime * 4.0 + wp.x * 7.0 + wp.y * 5.0) * 0.15;
          float k = uv.y * uv.y * uWind;
          transformed.x += (gust * 0.07 + flutter * 0.03) * k;
          transformed.z += (gust * 0.04) * k;`,
        );
      // Darken blade bases: self-shadowing down in the thatch.
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vHeight;')
        // Blades are double-sided but their normals point up; don't let the
        // back face flip them toward the ground.
        .replace(
          '#include <normal_fragment_begin>',
          THREE.ShaderChunk.normal_fragment_begin.replace('gl_FrontFacing ? 1.0 : - 1.0', '1.0'),
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          diffuseColor.rgb *= mix(0.5, 1.0, smoothstep(0.0, 0.8, vHeight));`,
        );
    };

    this.mesh = null;
    this.setDensity(density);
  }

  /** Rebuilds the instance buffer. `density` = clumps per m². */
  setDensity(density) {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.dispose();
    }
    const { x0, x1, z0, z1 } = this.bounds;
    const area = (x1 - x0) * (z1 - z0);
    const target = Math.floor(area * density);
    const mesh = new THREE.InstancedMesh(this.geometry, this.material, target);
    mesh.name = 'Grass';
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.frustumCulled = false;

    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const col = new THREE.Color();
    // Kentucky bluegrass / fescue mix: blue-green with some yellower blades.
    const base = new THREE.Color(0x4f7a2c);
    const yellow = new THREE.Color(0x8a8f3a);
    const blue = new THREE.Color(0x3d6e3b);

    let n = 0;
    for (let i = 0; i < target; i++) {
      const x = x0 + Math.random() * (x1 - x0);
      const z = z0 + Math.random() * (z1 - z0);
      if (!this.isLawn(x, z)) continue;
      pos.set(x, 0, z);
      q.setFromAxisAngle(up, Math.random() * Math.PI * 2);
      const h = this.height * (0.65 + Math.random() * 0.7);
      scl.set(1 + Math.random() * 0.6, h, 1 + Math.random() * 0.6);
      m.compose(pos, q, scl);
      mesh.setMatrixAt(n, m);
      // Low-frequency patches of colour variation, like a real lawn.
      const patch = 0.5 + 0.5 * Math.sin(x * 0.4 + Math.sin(z * 0.3) * 2) * Math.cos(z * 0.35 - x * 0.1);
      col.copy(base).lerp(blue, patch * 0.6).lerp(yellow, Math.random() * 0.1);
      col.multiplyScalar(0.9 + Math.random() * 0.2);
      mesh.setColorAt(n, col);
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    this.mesh = mesh;
    this.scene.add(mesh);
  }

  update(time) {
    this.uniforms.uTime.value = time;
  }
}
