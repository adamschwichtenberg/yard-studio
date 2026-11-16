/* ============================================================ plant thumbnails
   Small studio renders of single plants, for the plant library and the QA
   gallery. One hidden WebGL canvas is reused for every picture. */
import * as THREE from "three";
import { plantPreview } from "./beds.js";

let R = null;
function studio(){
  if(R) return R;
  const canvas = document.createElement("canvas");
  const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true, preserveDrawingBuffer:true});
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xcfe0f2, 0x5a5a48, 1.5));
  const sun = new THREE.DirectionalLight(0xfff2dc, 3.1);
  sun.position.set(-3, 6, 4);
  scene.add(sun);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshStandardMaterial({color:0x4a3a2c, roughness:1}));
  ground.rotation.x = -Math.PI/2;
  scene.add(ground);
  const camera = new THREE.PerspectiveCamera(26, 4/3, .1, 400);
  R = {renderer, scene, camera, ground, holder:new THREE.Group()};
  scene.add(R.holder);
  return R;
}
/* the day a plant looks its best: part-way into its bloom, else midsummer */
export function showSeason(p){
  if(!p.bloom) return {md:"07-10", growing:true, fall:0};
  const d = s=>Date.UTC(2001, +s.slice(0,2)-1, +s.slice(3))/86400000;
  const day = new Date((d(p.bloom.from) + (d(p.bloom.to) - d(p.bloom.from))*.4)*86400000);
  return {md:String(day.getUTCMonth()+1).padStart(2,"0")+"-"+String(day.getUTCDate()).padStart(2,"0"), growing:true, fall:0};
}
const cache = new Map();
/* a data URL of plant `p`; `season` defaults to its best day */
export function plantThumb(p, {season, width = 320, height = 240, turn = .6} = {}){
  const key = [p.k, p.custom ? [p.h, p.w, p.foliage, p.flower] : "", season ? JSON.stringify(season) : "", width, height].join("|");
  let url = cache.get(key);
  if(url) return url;
  const {renderer, scene, camera, ground, holder} = studio();
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  holder.clear();
  const plant = plantPreview(p, season || showSeason(p));
  plant.rotation.y = turn;
  holder.add(plant);
  const H = Math.max(.35, p.h), W = Math.max(.5, p.w);
  ground.scale.setScalar(W*.62);
  camera.aspect = width/height;
  /* seen from a little above, the footprint adds to the height on screen */
  const el = .3, tall = H*Math.cos(el) + W*Math.sin(el);
  const fit = Math.max(tall*1.16, W*1.12/camera.aspect);
  const dist = fit/(2*Math.tan(camera.fov*Math.PI/360));
  camera.position.set(0, H*.5 + Math.sin(el)*dist, Math.cos(el)*dist);
  camera.lookAt(0, H*.5, 0);
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  url = renderer.domElement.toDataURL("image/png");
  cache.set(key, url);
  return url;
}
