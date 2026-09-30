import * as THREE from 'three';
import soilD from '../assets/textures/excavated_soil_wall_diff.jpg';
import soilN from '../assets/textures/excavated_soil_wall_nor.jpg';

/*
 * Diorama staging, after museum models and 3D showrooms: the lot is cut out
 * of the earth as a slab, so its edge shows turf over a soil profile
 * (scanned excavation wall, CC0 from Poly Haven), and it sits on a dark,
 * soft-edged plinth on a studio floor. The sky still lights everything; only
 * the backdrop changes.
 *
 * Yard coordinates are feet, with plan (x, y) at world (x, 0, y).
 */

const loader = new THREE.TextureLoader();
function tex(url, srgb) {
  const t = loader.load(url);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Screen-space studio backdrop: a soft pool of light over deep green-black. */
export function studioBackdrop() {
  const W = 512;
  const H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const lin = g.createLinearGradient(0, 0, 0, H);
  lin.addColorStop(0, '#1c2521');
  lin.addColorStop(0.55, '#121815');
  lin.addColorStop(1, '#0a0e0c');
  g.fillStyle = lin;
  g.fillRect(0, 0, W, H);
  const rad = g.createRadialGradient(W * 0.5, H * 0.42, 10, W * 0.5, H * 0.46, W * 0.7);
  rad.addColorStop(0, 'rgba(92,110,96,.35)');
  rad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rad;
  g.fillRect(0, 0, W, H);
  // A whisper of grain so the gradient never bands.
  const img = g.getImageData(0, 0, W, H);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 3;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function signedArea(p) {
  let a = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j].x + p[i].x) * (p[j].y - p[i].y);
  return a / 2;
}

/** Outward offset of a simple polygon (miter, clamped), for the plinth. */
function offsetPoly(p, d) {
  const out = [];
  const s = signedArea(p) > 0 ? 1 : -1;
  for (let i = 0; i < p.length; i++) {
    const a = p[(i + p.length - 1) % p.length];
    const b = p[i];
    const c = p[(i + 1) % p.length];
    const n1 = new THREE.Vector2(b.y - a.y, -(b.x - a.x)).normalize().multiplyScalar(-s);
    const n2 = new THREE.Vector2(c.y - b.y, -(c.x - b.x)).normalize().multiplyScalar(-s);
    const m = n1.clone().add(n2).normalize();
    const k = Math.min(3, 1 / Math.max(0.2, m.dot(n1)));
    out.push({ x: b.x + m.x * d * k, y: b.y + m.y * d * k });
  }
  return out;
}

export class Diorama {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'diorama';
    scene.add(this.group);
    this.depth = 5;
    this.plateH = 1.4;

    const soilMap = tex(soilD, true);
    const soilNor = tex(soilN, false);
    this.soilMat = new THREE.MeshStandardMaterial({ map: soilMap, normalMap: soilNor, roughness: 0.95, color: 0xd8c8b0 });
    this.soilMat.normalScale.set(1.3, 1.3);
    // Turf band: grass and its root mat along the top of the cut face.
    this.soilMat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWorldP;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWorldP = (modelMatrix * vec4(position, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWorldP;')
        .replace('#include <map_fragment>', `#include <map_fragment>
          float edge = -0.42 + 0.08 * sin(vWorldP.x * 3.1 + vWorldP.z * 2.3) * sin(vWorldP.x * 1.7 - vWorldP.z * 2.9);
          float turf = smoothstep(edge - 0.05, edge + 0.05, vWorldP.y);
          float roots = smoothstep(edge - 0.9, edge, vWorldP.y) * (1.0 - turf);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.55, 0.45, 0.36), roots * 0.7);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.09, 0.16, 0.05), turf);
          // Deeper soil is a little cooler and darker.
          diffuseColor.rgb *= mix(0.72, 1.0, smoothstep(-6.0, -0.5, vWorldP.y));`);
    };
    this.plateMat = new THREE.MeshStandardMaterial({ color: 0x1b221f, roughness: 0.55, metalness: 0.05 });
    this.floorCenter = { value: new THREE.Vector3() };
    this.floorReach = { value: 200 };
    this.floorMat = this.#floorMaterial();
  }

  #floorMaterial() {
    // Large soft checker, like a showroom floor, fading into the backdrop.
    const mat = new THREE.MeshStandardMaterial({ color: 0x151b18, roughness: 0.85, metalness: 0 });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uCenter = this.floorCenter;
      sh.uniforms.uReach = this.floorReach;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWorldP;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWorldP = (modelMatrix * vec4(position, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWorldP;\nuniform vec3 uCenter;\nuniform float uReach;')
        .replace('#include <map_fragment>', `#include <map_fragment>
          vec2 q = floor((vWorldP.xz - uCenter.xz) / 16.0);
          float chk = mod(q.x + q.y, 2.0);
          diffuseColor.rgb *= mix(0.82, 1.08, chk);`)
        .replace('#include <dithering_fragment>', `#include <dithering_fragment>
          float d = length(vWorldP.xz - uCenter.xz) / uReach;
          gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.043, 0.055, 0.048), smoothstep(0.35, 1.0, d));`);
    };
    return mat;
  }

  /** Rebuild around the lot outline (plan coordinates, feet). */
  build(boundary) {
    for (const c of [...this.group.children]) {
      this.group.remove(c);
      c.geometry?.dispose();
    }
    if (!boundary || boundary.length < 3) return;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const q of boundary) {
      x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x);
      y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y);
    }
    const span = Math.max(x1 - x0, y1 - y0);
    this.depth = THREE.MathUtils.clamp(span * 0.05, 3.5, 8);
    const D = this.depth;
    const s = signedArea(boundary) > 0 ? 1 : -1;

    // Cut faces of the slab, one quad per lot side.
    const pos = [];
    const nor = [];
    const uv = [];
    let run = 0;
    for (let i = 0; i < boundary.length; i++) {
      const a = boundary[i];
      const b = boundary[(i + 1) % boundary.length];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      if (len < 1e-3) continue;
      const nx = ((b.y - a.y) / len) * -s;
      const nz = (-(b.x - a.x) / len) * -s;
      const T = 7; // texture tile, feet
      const u0 = run / T;
      const u1 = (run + len) / T;
      run += len;
      const quad = [
        [a.x, 0, a.y, u0, 1], [b.x, 0, b.y, u1, 1], [b.x, -D, b.y, u1, 1 - D / T],
        [a.x, 0, a.y, u0, 1], [b.x, -D, b.y, u1, 1 - D / T], [a.x, -D, a.y, u0, 1 - D / T],
      ];
      // Wind so the face points outward (the quad above is outward for s < 0).
      if (s > 0) quad.reverse();
      for (const [x, y, z, u, v] of quad) {
        pos.push(x + nx * 0.02, y - 0.02, z + nz * 0.02);
        nor.push(nx, 0, nz);
        uv.push(u, v);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const faces = new THREE.Mesh(g, this.soilMat);
    faces.receiveShadow = true;
    faces.castShadow = true;
    faces.raycast = () => {};
    this.group.add(faces);

    // Plinth: a soft-edged dark plate a little wider than the lot.
    const off = offsetPoly(boundary, Math.max(1.2, span * 0.018));
    const shape = new THREE.Shape(off.map((q) => new THREE.Vector2(q.x, -q.y)));
    const plateGeo = new THREE.ExtrudeGeometry(shape, { depth: this.plateH, bevelEnabled: true, bevelThickness: 0.35, bevelSize: 0.5, bevelSegments: 4, curveSegments: 4 });
    plateGeo.rotateX(-Math.PI / 2);
    plateGeo.translate(0, -D - this.plateH - 0.35, 0);
    const plate = new THREE.Mesh(plateGeo, this.plateMat);
    plate.receiveShadow = plate.castShadow = true;
    plate.raycast = () => {};
    this.group.add(plate);

    // Studio floor.
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), this.floorMat);
    floor.rotateX(-Math.PI / 2);
    floor.position.y = -D - this.plateH - 0.7;
    floor.receiveShadow = true;
    floor.raycast = () => {};
    this.group.add(floor);
    this.floorY = floor.position.y;
    const cx = (x0 + x1) / 2;
    const cz = (y0 + y1) / 2;
    this.floorCenter.value.set(cx, 0, cz);
    this.floorReach.value = span * 2.2;
    this.center = new THREE.Vector3(cx, 0, cz);
    this.span = span;
  }

  setVisible(on) {
    this.group.visible = !!on;
  }
}
