import * as THREE from 'three';
import grassD from '../assets/textures/leafy_grass_diff.jpg';
import grassN from '../assets/textures/leafy_grass_nor.jpg';
import mulchD from '../assets/textures/aerial_wood_snips_diff.jpg';
import mulchN from '../assets/textures/aerial_wood_snips_nor.jpg';
import litterD from '../assets/textures/dry_decay_leaves_diff.jpg';
import litterN from '../assets/textures/dry_decay_leaves_nor.jpg';

/*
 * Scanned ground (CC0, Poly Haven): lawn detail, hardwood mulch rings at the
 * foot of each tree, and fall leaf litter under deciduous trees. The rings
 * and litter are soft-edged discs laid a hair above the lawn.
 */

const loader = new THREE.TextureLoader();
const cache = new Map();
function tex(url, srgb) {
  if (cache.has(url)) return cache.get(url);
  const t = loader.load(url);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  cache.set(url, t);
  return t;
}

export function lawnDetail() {
  return { map: tex(grassD, true), normalMap: tex(grassN, false) };
}

/* A disc whose edge breaks up irregularly, textured in world space so rings don't look stamped. */
function discMaterial(mapUrl, norUrl, tint, { tile = 6, edge = 0.8, opacity = 1 } = {}) {
  const mat = new THREE.MeshStandardMaterial({
    map: tex(mapUrl, true),
    normalMap: tex(norUrl, false),
    color: new THREE.Color(tint),
    roughness: 0.95,
    transparent: true,
    opacity,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  mat.normalScale.set(1.4, 1.4);
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTile = { value: tile };
    sh.uniforms.uEdge = { value: edge };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldP;\nvarying vec2 vDisc;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvDisc = uv * 2.0 - 1.0;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWorldP = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldP;\nvarying vec2 vDisc;\nuniform float uTile;\nuniform float uEdge;')
      .replace('#include <map_fragment>', `
        vec2 wuv = vWorldP.xz / uTile;
        vec4 sampledDiffuseColor = texture2D(map, wuv);
        diffuseColor *= sampledDiffuseColor;
        float r = length(vDisc);
        float a = atan(vDisc.y, vDisc.x);
        float wob = 0.06 * sin(a * 5.0 + vWorldP.x) + 0.04 * sin(a * 11.0 + vWorldP.z * 0.7);
        diffuseColor.a *= 1.0 - smoothstep(uEdge + wob, 1.0 + wob * 0.5, r);`)
      .replace('#include <normal_fragment_maps>', `
        vec3 mapN = texture2D(normalMap, vWorldP.xz / uTile).xyz * 2.0 - 1.0;
        mapN.xy *= normalScale;
        normal = normalize(tbn * mapN);`);
  };
  return mat;
}

let mulchMat = null;
export function mulchRing(radius) {
  mulchMat ??= discMaterial(mulchD, mulchN, 0x7a5a44, { tile: 5, edge: 0.82 });
  const g = new THREE.CircleGeometry(radius, 40);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, mulchMat);
  m.position.y = 0.035;
  m.receiveShadow = true;
  m.raycast = () => {};
  m.renderOrder = 1;
  return m;
}

/** Leaf litter tinted toward the tree's fall colour; opacity set by the season. */
export function leafLitter(radius, fallColor) {
  const tint = new THREE.Color(0xc8b8a0).lerp(new THREE.Color(fallColor), 0.35);
  const mat = discMaterial(litterD, litterN, tint, { tile: 3.2, edge: 0.5, opacity: 0 });
  const g = new THREE.CircleGeometry(radius, 48);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, mat);
  m.position.y = 0.045;
  m.receiveShadow = true;
  m.raycast = () => {};
  m.renderOrder = 2;
  m.userData.litter = true;
  m.visible = false;
  return m;
}
