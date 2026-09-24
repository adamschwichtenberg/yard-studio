import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sun, minutesInZone, zonedTimeToDate } from './scene/sun.js';
import { SkyEnvironment } from './scene/environment.js';
import { buildYard, isLawn, LAYOUT } from './scene/yard.js';
import { Grass } from './scene/grass.js';
import { TreeLibrary, SPECIES } from './trees/trees.js';
import { heightAtAge } from './trees/species.js';
import { createPost } from './post.js';
import { createUI } from './ui.js';

export const LOCATIONS = [
  { name: 'Fargo, ND', lat: 46.877, lon: -96.79, tz: 'America/Chicago' },
  { name: 'Minneapolis, MN', lat: 44.98, lon: -93.27, tz: 'America/Chicago' },
  { name: 'Sioux Falls, SD', lat: 43.545, lon: -96.731, tz: 'America/Chicago' },
  { name: 'Denver, CO', lat: 39.739, lon: -104.99, tz: 'America/Denver' },
  { name: 'Custom', lat: null, lon: null, tz: Intl.DateTimeFormat().resolvedOptions().timeZone },
];

const EXAMPLE_PLANTING = [
  { species: 'autumnBlazeMaple', x: -8.5, z: -2.5 },
  { species: 'redmondLinden', x: 6.5, z: 5.5 },
  { species: 'prairieHorizonAlder', x: 10.2, z: -5 },
  { species: 'tannenbaumMugo', x: 3.6, z: -8.2 },
  { species: 'columnarNorwaySpruce', x: -11.6, z: 11.6 },
  { species: 'columnarNorwaySpruce', x: 11.6, z: 11.6 },
  { species: 'moonglowJuniper', x: -2.5, z: 11.4 },
  { species: 'moonglowJuniper', x: 1.5, z: 11.4 },
];

const STORAGE_KEY = 'yard-studio:v1';

function todayIn(tz) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date());
  return parts; // en-CA formats as YYYY-MM-DD
}

function loadState() {
  const defaults = {
    location: 0,
    lat: LOCATIONS[0].lat,
    lon: LOCATIONS[0].lon,
    date: todayIn(LOCATIONS[0].tz),
    minutes: 17 * 60,
    years: 10,
    trees: EXAMPLE_PLANTING.map((t, i) => ({ ...t, rot: i * 1.7 })),
    sky: 'hdri',
    grass: 90,
    shadow: 4096,
    ao: true,
    exposure: 1,
  };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return saved ? { ...defaults, ...saved } : defaults;
  } catch {
    return defaults;
  }
}

const state = loadState();
const saveState = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable: session-only */
  }
};

// ---------------------------------------------------------------------------
// Renderer, scene, camera
// ---------------------------------------------------------------------------
const canvas = document.getElementById('viewport');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false, // SMAA in post; MSAA doesn't combine with SSAO
  stencil: false,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping; // tone mapping happens in post
renderer.toneMappingExposure = state.exposure;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false; // re-rendered only when sun or trees change
renderer.info.autoReset = false; // the composer renders several passes per frame

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 3000);
camera.position.set(17, 8.5, 21);

const controls = new OrbitControls(camera, canvas);
controls.target.set(-1, 1.5, -3);
controls.enableDamping = true;
controls.maxPolarAngle = Math.PI * 0.495;
controls.minDistance = 1.5;
controls.maxDistance = 140;
controls.update();

const post = createPost(renderer, scene, camera);
post.setAO(state.ao);

const sun = new Sun(scene, { yardRadius: 34, shadowMapSize: state.shadow });
const sky = new SkyEnvironment(renderer, scene);
const yard = buildYard(scene);
const grass = new Grass(scene, { isLawn, bounds: LAYOUT.lot, density: state.grass });
grass.mesh.visible = state.grass > 0;
const library = new TreeLibrary();

const treeRoot = new THREE.Group();
treeRoot.name = 'Trees';
scene.add(treeRoot);

let shadowsDirty = true;
const markShadows = () => (shadowsDirty = true);

// ---------------------------------------------------------------------------
// Time / sun
// ---------------------------------------------------------------------------
const location = () => {
  const loc = LOCATIONS[state.location];
  return { lat: state.lat, lon: state.lon, tz: loc.tz };
};

function currentDate() {
  const [y, m, d] = state.date.split('-').map(Number);
  return zonedTimeToDate(y, m, d, state.minutes, location().tz);
}

function dayOfYear() {
  const [y, m, d] = state.date.split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86400000);
}

function updateSun() {
  const { lat, lon, tz } = location();
  const date = currentDate();
  sun.update(date, lat, lon);
  sky.update(sun.direction, sun.daylight);
  markShadows();

  const times = Sun.times(date, lat, lon);
  const fmt = (t) => {
    const mins = minutesInZone(t, tz);
    return mins == null ? '—' : `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
  };
  ui.setReadout({
    sunrise: fmt(times.sunrise),
    sunset: fmt(times.sunset),
    altitude: `${sun.altitude.toFixed(1)}°`,
    azimuth: `${sun.azimuth.toFixed(0)}°`,
  });
}

function updateSeason() {
  library.applySeason(dayOfYear());
  markShadows();
}

// ---------------------------------------------------------------------------
// Trees
// ---------------------------------------------------------------------------
function addTree({ species, x, z, rot }) {
  const tree = library.create(species, { years: state.years });
  tree.position.set(x, 0, z);
  if (rot != null) tree.rotation.y = rot;
  treeRoot.add(tree);
  return tree;
}

function syncTreesToState() {
  state.trees = treeRoot.children.map((t) => ({
    species: t.userData.species,
    x: +t.position.x.toFixed(2),
    z: +t.position.z.toFixed(2),
    rot: +t.rotation.y.toFixed(3),
  }));
  saveState();
  markShadows();
}

function rebuildTrees(list) {
  select(null);
  for (const t of [...treeRoot.children]) treeRoot.remove(t);
  list.forEach(addTree);
  library.applySeason(dayOfYear());
  syncTreesToState();
}

/** Crown radius in metres for a species at a given scale (1 = mature). */
function crownRadius(key, scale) {
  const s = library.template(key).leaves.boundingBox.getSize(new THREE.Vector3());
  return (Math.max(s.x, s.z) / 2) * scale;
}

// Selection ring + placement ghost
const ringMat = new THREE.MeshBasicMaterial({ color: 0xb9f07a, transparent: true, opacity: 0.85, depthWrite: false });
const ring = new THREE.Mesh(new THREE.RingGeometry(0.94, 1, 96), ringMat);
ring.rotation.x = -Math.PI / 2;
ring.position.y = 0.03;
ring.visible = false;
ring.renderOrder = 10;
scene.add(ring);

const ghostMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, depthWrite: false });
const ghost = new THREE.Mesh(new THREE.CircleGeometry(1, 64), ghostMat);
ghost.rotation.x = -Math.PI / 2;
ghost.position.y = 0.025;
ghost.visible = false;
scene.add(ghost);

let selected = null;
let placing = null; // species key while in placement mode

function select(tree) {
  selected = tree;
  ring.visible = !!tree;
  if (tree) {
    const r = crownRadius(tree.userData.species, tree.scale.x);
    ring.scale.setScalar(r);
    ring.position.set(tree.position.x, 0.03, tree.position.z);
  }
  ui.showSelection(tree ? describeTree(tree) : null);
}

function describeTree(tree) {
  const sp = SPECIES[tree.userData.species];
  const h = sp.matureHeight * tree.scale.x;
  return { name: sp.name, latin: sp.latin, size: `${h.toFixed(1)} m tall · ${(crownRadius(tree.userData.species, tree.scale.x) * 2).toFixed(1)} m wide now` };
}

function setPlacing(key) {
  placing = key;
  ghost.visible = false;
  if (key) {
    select(null);
    const sp = SPECIES[key];
    ghost.scale.setScalar(crownRadius(key, heightAtAge(sp, state.years) / sp.matureHeight));
  }
  ui.setPlacing(key);
  canvas.style.cursor = key ? 'crosshair' : '';
}

// ---------------------------------------------------------------------------
// Pointer interaction
// ---------------------------------------------------------------------------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const hit = new THREE.Vector3();
let down = null;
let dragging = false;

function setPointer(e) {
  const r = canvas.getBoundingClientRect();
  pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
}

function pickTree() {
  const hits = raycaster.intersectObjects(treeRoot.children, true);
  for (const h of hits) {
    let o = h.object;
    while (o && !o.userData.tree) o = o.parent;
    if (o) return o;
  }
  return null;
}

function groundPoint() {
  return raycaster.ray.intersectPlane(groundPlane, hit) ? hit : null;
}

const clampToLot = (p) => {
  const { lot } = LAYOUT;
  p.x = THREE.MathUtils.clamp(p.x, lot.x0 + 0.3, lot.x1 - 0.3);
  p.z = THREE.MathUtils.clamp(p.z, lot.z0 + 0.3, lot.z1 - 0.3);
  return p;
};

canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  down = { x: e.clientX, y: e.clientY };
  setPointer(e);
  if (!placing && selected && pickTree() === selected) {
    dragging = true;
    controls.enabled = false;
    canvas.setPointerCapture(e.pointerId);
  }
});

canvas.addEventListener('pointermove', (e) => {
  setPointer(e);
  if (placing) {
    const p = groundPoint();
    ghost.visible = !!p;
    if (p) ghost.position.set(clampToLot(p).x, 0.025, p.z);
  } else if (dragging && selected) {
    const p = groundPoint();
    if (p) {
      clampToLot(p);
      selected.position.set(p.x, 0, p.z);
      ring.position.set(p.x, 0.03, p.z);
      markShadows();
    }
  }
});

canvas.addEventListener('pointerup', (e) => {
  if (e.button !== 0 || !down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5;
  down = null;
  if (dragging) {
    dragging = false;
    controls.enabled = true;
    syncTreesToState();
    return;
  }
  if (moved) return; // orbit drag
  setPointer(e);
  if (placing) {
    const p = groundPoint();
    if (p) {
      clampToLot(p);
      const tree = addTree({ species: placing, x: p.x, z: p.z });
      library.applySeason(dayOfYear());
      syncTreesToState();
      if (!e.shiftKey) setPlacing(null);
      select(tree);
    }
    return;
  }
  select(pickTree());
});

window.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'Escape') {
    setPlacing(null);
    select(null);
  }
  if ((e.key === 'Delete' || e.key === 'Backspace') && selected) removeSelected();
});

function removeSelected() {
  if (!selected) return;
  treeRoot.remove(selected);
  select(null);
  syncTreesToState();
}

// ---------------------------------------------------------------------------
// UI wiring
// ---------------------------------------------------------------------------
const ui = createUI({
  state,
  locations: LOCATIONS,
  species: SPECIES,
  onLocation() {
    saveState();
    updateSun();
  },
  onDate() {
    saveState();
    updateSun();
    updateSeason();
  },
  onTime() {
    saveState();
    updateSun();
  },
  onAge() {
    for (const t of treeRoot.children) library.setAge(t, state.years);
    if (selected) select(selected);
    saveState();
    markShadows();
  },
  onPlace: (key) => setPlacing(placing === key ? null : key),
  onRemove: removeSelected,
  onResetTrees: () => rebuildTrees(EXAMPLE_PLANTING.map((t, i) => ({ ...t, rot: i * 1.7 }))),
  onSky() {
    sky.setMode(state.sky);
    ui.setSkySource(state.sky === 'hdri' && sky.hdri ? `Lighting: ${sky.hdri.label}` : 'Lighting: physical sky model');
    saveState();
    updateSun();
  },
  onGrass() {
    if (state.grass > 0) grass.setDensity(state.grass);
    grass.mesh.visible = state.grass > 0;
    saveState();
  },
  onShadow() {
    const s = state.shadow;
    sun.light.shadow.mapSize.set(s, s);
    sun.light.shadow.map?.dispose();
    sun.light.shadow.map = null;
    saveState();
    markShadows();
  },
  onAO() {
    post.setAO(state.ao);
    saveState();
  },
  onExposure() {
    renderer.toneMappingExposure = state.exposure;
    saveState();
  },
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
const loadingText = document.getElementById('loading-text');
const status = (t) => (loadingText.textContent = t);

async function boot() {
  status('Loading sky…');
  const label = await sky.loadHDRI(status);
  if (!label) state.sky = 'sky';
  sky.setMode(state.sky);
  ui.setSkySource(state.sky === 'hdri' && label ? `Lighting: ${label}` : 'Lighting: physical sky model');
  ui.sync();

  status('Growing trees…');
  await new Promise((r) => setTimeout(r, 0));
  for (const key of Object.keys(SPECIES)) {
    status(`Growing ${SPECIES[key].name}…`);
    await new Promise((r) => setTimeout(r, 0));
    library.template(key);
  }
  rebuildTrees(state.trees);
  updateSun();
  updateSeason();

  document.getElementById('loading').classList.add('done');
  window.__yard = { scene, camera, renderer, controls, state, sun, sky, library, treeRoot, rebuildTrees, updateSun, ready: true };
}

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------
const timer = new THREE.Timer();
timer.connect(document);
const statsEl = document.getElementById('stats');
let frames = 0;
let fpsTime = 0;

function frame() {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.1);
  const t = timer.getElapsed();

  if (ui.playing) {
    state.minutes = (state.minutes + dt * ui.speed) % 1440;
    ui.setTime(state.minutes);
    updateSun();
  }

  renderer.info.reset();
  controls.update();
  grass.update(t);
  library.update(t);

  if (shadowsDirty) {
    renderer.shadowMap.needsUpdate = true;
    shadowsDirty = false;
  }
  post.render(dt);

  frames++;
  fpsTime += dt;
  if (fpsTime > 0.5) {
    const tris = renderer.info.render.triangles;
    statsEl.textContent = `${Math.round(frames / fpsTime)} fps · ${(tris / 1e6).toFixed(2)}M tris`;
    frames = 0;
    fpsTime = 0;
  }
  requestAnimationFrame(frame);
}

window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  post.setSize(w, h);
});

boot().then(() => requestAnimationFrame(frame));
