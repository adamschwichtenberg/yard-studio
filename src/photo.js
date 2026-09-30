import * as THREE from 'three';
import { WebGLPathTracer } from 'three-gpu-pathtracer';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

/*
 * Photo mode: a path-traced still of the current view, refining sample by
 * sample (three-gpu-pathtracer). Light bounces for real: skylight under the
 * canopy, sun through gaps in the leaves, the warm fill off a sunlit wall.
 *
 * The path tracer only understands plain materials and whole meshes, so the
 * live scene is copied into a photo scene: every leaf, shoot, flower and
 * fruit instance is baked into geometry, and materials that are coloured in
 * shaders (leaves by species colour, flowers by bloom phase) get textures
 * pre-coloured to match what's on screen.
 */

const V = new THREE.Vector3();

/* ------------------------------------------------------------ recolouring */

const recolorCache = new Map();
/** Canvas copy of a luminance-drawn texture, coloured to `color` (linear) with brightness normalised by `norm`. */
function recolor(tex, color, norm) {
  const key = `${tex.uuid}|${color.getHexString()}|${norm.toFixed(3)}`;
  if (recolorCache.has(key)) return recolorCache.get(key);
  const img = tex.image;
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height);
  const px = d.data;
  const lin = (u) => {
    u /= 255;
    return u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4;
  };
  const enc = (l) => 255 * (l <= 0.0031308 ? l * 12.92 : 1.055 * Math.pow(Math.min(1, l), 1 / 2.4) - 0.055);
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue;
    const l = Math.min(1.6, (0.2126 * lin(px[i]) + 0.7152 * lin(px[i + 1]) + 0.0722 * lin(px[i + 2])) * norm);
    px[i] = enc(color.r * l);
    px[i + 1] = enc(color.g * l);
    px[i + 2] = enc(color.b * l);
  }
  g.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = tex.flipY;
  recolorCache.set(key, t);
  return t;
}

let radialAlpha = null;
function discAlpha() {
  if (radialAlpha) return radialAlpha;
  const N = 128;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(N / 2, N / 2, N * 0.3, N / 2, N / 2, N / 2);
  r.addColorStop(0, '#fff');
  r.addColorStop(1, '#000');
  g.fillStyle = r;
  g.fillRect(0, 0, N, N);
  radialAlpha = new THREE.CanvasTexture(c);
  return radialAlpha;
}

/** A plain material the path tracer understands, matching what the live material shows. */
function photoMaterial(mat, mesh) {
  const u = mat.userData?.uniforms;
  if (u?.uLeafColor) {
    const col = u.uLeafColor.value.clone().lerp(u.uFallColor.value, Math.min(1, (u.uFall?.value || 0) * 1.1));
    return new THREE.MeshStandardMaterial({ map: recolor(mat.map, col, u.uLumaNorm.value), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.65 });
  }
  if (u?.uC0) {
    const ph = u.uPhase.value;
    const col = ph < 0.5 ? u.uC0.value.clone().lerp(u.uC1.value, ph * 2) : u.uC1.value.clone().lerp(u.uC2.value, ph * 2 - 1);
    return new THREE.MeshStandardMaterial({ map: recolor(mat.map, col, u.uLumaNorm.value), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8 });
  }
  if (mat.transparent && mat.map && mesh.geometry.type === 'CircleGeometry') {
    // Mulch rings and leaf litter: world-tiled texture with a soft edge.
    const r = mesh.geometry.parameters.radius;
    const map = mat.map.clone();
    map.repeat.set((r * 2) / 5, (r * 2) / 5);
    map.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map, color: mat.color, alphaMap: discAlpha(), transparent: true, opacity: mat.opacity, roughness: 0.95, depthWrite: false });
  }
  if (mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial) return mat;
  return null;
}

/* ------------------------------------------------------------ baking */

function bakeInstanced(mesh) {
  const src = mesh.geometry;
  const pos = src.attributes.position;
  const nor = src.attributes.normal;
  const uv = src.attributes.uv;
  const idx = src.index;
  const m = new THREE.Matrix4();
  const nm = new THREE.Matrix3();
  const live = [];
  for (let i = 0; i < mesh.count; i++) {
    mesh.getMatrixAt(i, m);
    if (Math.abs(m.determinant()) > 1e-12) live.push(i);
  }
  const vN = pos.count;
  const iN = idx ? idx.count : vN;
  const P = new Float32Array(live.length * vN * 3);
  const N = new Float32Array(live.length * vN * 3);
  const U = new Float32Array(live.length * vN * 2);
  const I = new Uint32Array(live.length * iN);
  const C = mesh.instanceColor ? new Float32Array(live.length * vN * 3) : null;
  const col = new THREE.Color();
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  let k = 0;
  for (const i of live) {
    mesh.getMatrixAt(i, m);
    m.premultiply(mesh.matrixWorld);
    nm.getNormalMatrix(m);
    if (C) mesh.getColorAt(i, col);
    for (let v = 0; v < vN; v++) {
      p.fromBufferAttribute(pos, v).applyMatrix4(m);
      P.set([p.x, p.y, p.z], (k * vN + v) * 3);
      if (nor) {
        n.fromBufferAttribute(nor, v).applyMatrix3(nm).normalize();
        N.set([n.x, n.y, n.z], (k * vN + v) * 3);
      }
      if (uv) U.set([uv.getX(v), uv.getY(v)], (k * vN + v) * 2);
      if (C) C.set([col.r, col.g, col.b], (k * vN + v) * 3);
    }
    for (let j = 0; j < iN; j++) I[k * iN + j] = k * vN + (idx ? idx.getX(j) : j);
    k++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(U, 2));
  if (C) g.setAttribute('color', new THREE.BufferAttribute(C, 3));
  g.setIndex(new THREE.BufferAttribute(I, 1));
  return g;
}

function visibleChain(o) {
  for (let p = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

/** Copy the visible, solid parts of `scene` into a scene the path tracer can take. */
function buildPhotoScene(scene, exclude) {
  const out = new THREE.Scene();
  out.background = scene.background;
  out.backgroundIntensity = scene.backgroundIntensity;
  out.backgroundRotation.copy(scene.backgroundRotation);
  out.environment = scene.environment;
  out.environmentIntensity = scene.environmentIntensity;
  out.environmentRotation.copy(scene.environmentRotation);
  scene.updateMatrixWorld(true);
  const owned = [];
  scene.traverse((o) => {
    if (exclude.some((e) => e === o || isInside(o, e))) return;
    if (!visibleChain(o)) return;
    if (o.isDirectionalLight && o.intensity > 0) {
      const l = new THREE.DirectionalLight(o.color, o.intensity);
      l.position.setFromMatrixPosition(o.matrixWorld);
      l.target.position.setFromMatrixPosition(o.target.matrixWorld);
      out.add(l, l.target);
      return;
    }
    if (!o.isMesh || o.isSprite) return;
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    if (!mat || mat.visible === false) return;
    const pm = photoMaterial(mat, o);
    if (!pm) return;
    let geo;
    if (o.isInstancedMesh) {
      geo = bakeInstanced(o);
      if (o.instanceColor && pm === mat) {
        const vc = mat.clone();
        vc.vertexColors = true;
        const m2 = new THREE.Mesh(geo, vc);
        out.add(m2);
        owned.push(geo);
        return;
      }
    } else {
      geo = o.geometry.clone();
      geo.applyMatrix4(o.matrixWorld);
    }
    owned.push(geo);
    out.add(new THREE.Mesh(geo, pm));
  });
  out.userData.owned = owned;
  return out;
}
function isInside(o, root) {
  for (let p = o.parent; p; p = p.parent) if (p === root) return true;
  return false;
}

/* ------------------------------------------------------------ mode */

export class PhotoMode {
  constructor(renderer) {
    this.renderer = renderer;
    this.pt = null;
    this.scene = null;
    this.active = false;
    this.quad = new FullScreenQuad(new THREE.MeshBasicMaterial({ toneMapped: true }));
  }

  /** Build the photo scene and start refining. onProgress(0..1) while the BVH builds. */
  async start(scene, camera, exclude, exposure, onProgress) {
    if (!this.pt) {
      this.pt = new WebGLPathTracer(this.renderer);
      this.pt.renderToCanvas = false;
      this.pt.rasterizeScene = false;
      this.pt.minSamples = 1;
      this.pt.renderDelay = 0;
      this.pt.fadeDuration = 0;
      this.pt.dynamicLowRes = false;
      this.pt.tiles.set(2, 2);
      this.pt.bounces = 5;
      this.pt.filterGlossyFactor = 0.5;
    }
    this.stop();
    this.exposure = exposure;
    this.scene = buildPhotoScene(scene, exclude);
    this.camera = camera;
    // Build the BVH on the main thread (a worker would complicate the
    // single-file build); the caller has already shown "Preparing".
    onProgress?.(0.5);
    await new Promise((r) => setTimeout(r, 16));
    this.pt.setScene(this.scene, camera);
    onProgress?.(1);
    this.active = true;
  }

  /** One refinement pass, displayed tone-mapped. Returns the sample count. */
  render() {
    if (!this.active) return 0;
    const r = this.renderer;
    this.pt.renderSample();
    const tm = r.toneMapping;
    const te = r.toneMappingExposure;
    r.toneMapping = THREE.AgXToneMapping;
    r.toneMappingExposure = this.exposure;
    this.quad.material.map = this.pt.target.texture;
    r.setRenderTarget(null);
    this.quad.render(r);
    r.toneMapping = tm;
    r.toneMappingExposure = te;
    return this.pt.samples;
  }

  get samples() {
    return this.pt ? this.pt.samples : 0;
  }

  stop() {
    this.active = false;
    if (this.scene) {
      for (const g of this.scene.userData.owned || []) g.dispose();
      this.scene = null;
    }
  }
}
