import * as THREE from 'three';
import { concreteTextures, fenceTextures, lawnTextures, shingleTextures, sidingTextures } from './textures.js';

/**
 * Default lot: 26 m (E–W) × 34 m (N–S) backyard with the house on the north
 * edge and a concrete patio off the back door. All dimensions in metres.
 * Rectangles are { x0, x1, z0, z1 } with -Z = north.
 */
export const LAYOUT = {
  lot: { x0: -13, x1: 13, z0: -21, z1: 13 },
  house: { x0: -8, x1: 6, z0: -21, z1: -11, wall: 3.0, ridge: 6.2 },
  patio: { x0: -5, x1: 2, z0: -11, z1: -6.5 },
  fenceHeight: 1.8,
};

const inRect = (r, x, z, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;

/** True where turf should grow. */
export function isLawn(x, z) {
  return (
    inRect(LAYOUT.lot, x, z, -0.15) &&
    !inRect(LAYOUT.house, x, z, 0.3) &&
    !inRect(LAYOUT.patio, x, z, 0.02)
  );
}

export function buildYard(scene) {
  const group = new THREE.Group();
  group.name = 'Yard';
  const shadowCasters = [];

  // Ground: one large plane carries the lawn base texture out to the horizon.
  const lawn = lawnTextures(200);
  const groundMat = new THREE.MeshStandardMaterial({
    map: lawn.map,
    normalMap: lawn.normalMap,
    normalScale: new THREE.Vector2(0.6, 0.6),
    roughness: 0.95,
  });
  // Low-frequency world-space tint breaks up the 2 m texture repeat.
  groundMat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vGroundXZ;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGroundXZ = (modelMatrix * vec4(position, 1.0)).xz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vGroundXZ;')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        vec2 gp = vGroundXZ;
        float macro = sin(gp.x * 0.071 + sin(gp.y * 0.053) * 2.0) * sin(gp.y * 0.067 + sin(gp.x * 0.041) * 2.0);
        float micro = sin(gp.x * 0.37 + gp.y * 0.21) * sin(gp.y * 0.31 - gp.x * 0.17);
        diffuseColor.rgb *= 0.9 + 0.12 * macro + 0.05 * micro;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.08, 1.0, 0.8), 0.5 + 0.5 * macro);`,
      );
  };
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 800), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.name = 'Ground';
  group.add(ground);

  // Patio slab, 10 cm proud of grade.
  const p = LAYOUT.patio;
  const pw = p.x1 - p.x0;
  const pd = p.z1 - p.z0;
  const concrete = concreteTextures(pw, pd);
  const slabMats = new THREE.MeshStandardMaterial({ ...concrete, roughness: 1 });
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0x9d9a92, roughness: 0.9 });
  const patio = new THREE.Mesh(new THREE.BoxGeometry(pw, 0.1, pd), [
    edgeMat,
    edgeMat,
    slabMats,
    edgeMat,
    edgeMat,
    edgeMat,
  ]);
  patio.position.set((p.x0 + p.x1) / 2, 0.05, (p.z0 + p.z1) / 2);
  patio.receiveShadow = true;
  patio.castShadow = true;
  patio.name = 'Patio';
  group.add(patio);

  group.add(buildHouse(shadowCasters));
  group.add(buildFence(shadowCasters));

  scene.add(group);
  return { group, ground, patio, shadowCasters };
}

function buildHouse(casters) {
  const h = LAYOUT.house;
  const w = h.x1 - h.x0;
  const d = h.z1 - h.z0;
  const house = new THREE.Group();
  house.name = 'House';
  house.position.set((h.x0 + h.x1) / 2, 0, (h.z0 + h.z1) / 2);

  const siding = sidingTextures(w / 2, h.wall / 1.6);
  const wallMat = new THREE.MeshStandardMaterial({ ...siding, roughness: 0.75 });
  const walls = new THREE.Mesh(new THREE.BoxGeometry(w, h.wall, d), wallMat);
  walls.position.y = h.wall / 2;
  house.add(walls);

  // Foundation band
  const found = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.04, 0.45, d + 0.04),
    new THREE.MeshStandardMaterial({ color: 0x8a867d, roughness: 0.95 }),
  );
  found.position.y = 0.2;
  house.add(found);

  // Gable roof, ridge running east–west, 40 cm overhangs.
  const over = 0.4;
  const rise = h.ridge - h.wall;
  const pitch = Math.atan2(rise, d / 2);
  const eaveZ = d / 2 + over;
  const eaveY = h.wall - over * Math.tan(pitch);
  const slopeLen = Math.hypot(eaveZ, h.ridge - eaveY);
  const shingles = shingleTextures((w + 2 * over) / 3, slopeLen / 3);
  const roofMat = new THREE.MeshStandardMaterial({ ...shingles, roughness: 0.92 });
  for (const side of [-1, 1]) {
    // Box spans eave → ridge; rotating +pitch about X tips +Z downward.
    const plane = new THREE.Mesh(new THREE.BoxGeometry(w + 2 * over, 0.08, slopeLen), roofMat);
    plane.rotation.x = side * pitch;
    plane.position.set(0, (eaveY + h.ridge) / 2 + 0.04, (side * eaveZ) / 2);
    house.add(plane);
  }

  // Gable end triangles
  const tri = new THREE.Shape();
  tri.moveTo(-d / 2, 0);
  tri.lineTo(d / 2, 0);
  tri.lineTo(0, rise);
  tri.closePath();
  const gableGeo = new THREE.ShapeGeometry(tri);
  for (const side of [-1, 1]) {
    const g = new THREE.Mesh(gableGeo, wallMat);
    g.rotation.y = (side * Math.PI) / 2;
    g.position.set((side * w) / 2, h.wall, 0);
    house.add(g);
  }

  // Back door + windows on the south (yard-facing) wall.
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.6 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x1b2430, roughness: 0.05, metalness: 0.0 });
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x3d4a57, roughness: 0.5 });
  const face = d / 2 + 0.01;
  const addOpening = (x, y, ow, oh, mat) => {
    const trim = new THREE.Mesh(new THREE.BoxGeometry(ow + 0.16, oh + 0.16, 0.04), trimMat);
    trim.position.set(x, y, face);
    const pane = new THREE.Mesh(new THREE.BoxGeometry(ow, oh, 0.05), mat);
    pane.position.set(x, y, face + 0.005);
    house.add(trim, pane);
  };
  addOpening(-1.5, 1.05, 0.95, 2.05, doorMat); // door over the patio
  addOpening(1.2, 1.55, 1.8, 1.2, glassMat);
  addOpening(-4.6, 1.55, 1.4, 1.2, glassMat);
  addOpening(4.6, 1.55, 1.4, 1.2, glassMat);

  house.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      casters.push(o);
    }
  });
  return house;
}

function buildFence(casters) {
  const { lot, house, fenceHeight: fh } = LAYOUT;
  const group = new THREE.Group();
  group.name = 'Fence';
  const postMat = new THREE.MeshStandardMaterial({ color: 0x7b6750, roughness: 0.9 });

  // Runs: west, south, east sides, plus short returns to the house corners.
  const runs = [
    [lot.x0, house.z1 - 1, lot.x0, lot.z1],
    [lot.x0, lot.z1, lot.x1, lot.z1],
    [lot.x1, lot.z1, lot.x1, house.z1 - 1],
    [lot.x0, house.z1 - 1, house.x0, house.z1 - 1],
    [house.x1, house.z1 - 1, lot.x1, house.z1 - 1],
  ];
  for (const [x0, z0, x1, z1] of runs) {
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 0.1) continue;
    const { map } = fenceTextures(len / 0.6);
    const mat = new THREE.MeshStandardMaterial({ map, roughness: 0.85 });
    const panel = new THREE.Mesh(new THREE.BoxGeometry(len, fh, 0.03), mat);
    panel.position.set((x0 + x1) / 2, fh / 2 + 0.05, (z0 + z1) / 2);
    panel.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
    group.add(panel);

    const posts = Math.ceil(len / 2.4);
    for (let i = 0; i <= posts; i++) {
      const t = i / posts;
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, fh + 0.1, 0.09), postMat);
      post.position.set(x0 + (x1 - x0) * t, (fh + 0.1) / 2, z0 + (z1 - z0) * t);
      group.add(post);
    }
  }
  group.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      casters.push(o);
    }
  });
  return group;
}
