/* ============================================================ planting beds
   Turns one planting bed from the plan into three.js objects. A bed is

     {type:"planting", x, y, rot, poly:[{x,y}…], smooth, mulch,
      plants:[{id, k, x, y, s?}]}

   `poly` is the outline in bed-local feet; with `smooth` the drawn edge is a
   curve through those points. Each plant is a catalog key `k` at a free
   position in the same bed-local feet (no grid), with an optional size
   factor `s`. Moving or turning the bed carries its plants along.

   Plants draw in one of two modes:
     "symbols"  flat plan symbols: coloured, inked, overlapping, tallest on top
     "plants"   the 3D models, in leaf, in flower or cut back for the date
   Either way each kind of plant in a bed is instanced: one or two draw calls
   however often it repeats. */
import * as THREE from "three";
import { plantByKey, plantPhase, phaseKey, symbolColor } from "./plants.js";
import { plantProto, symbolGeometry, seeded } from "./models.js";

export const MULCHES = {
  bark:   {label:"Shredded bark", color:0x6b4a34, simple:0x3b2d22},
  soil:   {label:"Bare soil",     color:0x8a745f, simple:0x30261d},
  gravel: {label:"Pea gravel",    color:0xcfc6b4, simple:0x55534c},
  none:   {label:"Lawn (no mulch)", color:null,   simple:null}
};
export const BED_Y = .05;       // mulch surface, just under the grid overlay
const SYMBOL_Y = .1;

/* the drawn outline, in bed-local feet */
export function bedOutline(bed){
  const poly = bed.poly || [];
  if(!bed.smooth || poly.length < 3) return poly;
  const curve = new THREE.CatmullRomCurve3(poly.map(q=>new THREE.Vector3(q.x, 0, q.y)), true, "centripetal");
  return curve.getPoints(poly.length*10).slice(0, -1).map(v=>({x:v.x, y:v.z}));
}
/* a kidney-shaped starter outline, w × h feet */
export function starterOutline(w, h){
  const pts = [[-.5,-.12],[-.3,-.46],[.12,-.5],[.46,-.3],[.5,.12],[.28,.46],[-.1,.36],[-.42,.3]];
  return pts.map(([x, y])=>({x:+(x*w).toFixed(2), y:+(y*h).toFixed(2)}));
}
export function plantRadius(pl){ return plantByKey(pl.k).w/2*(pl.s || 1); }

/* The plant under a point (bed-local feet). Where circles overlap, the one
   whose centre is relatively nearest wins, so a small plant inside a big
   one's circle can still be picked. */
export function plantAt(bed, x, y){
  let best = null, bd = 1;
  for(const pl of bed.plants || []){
    const d = Math.hypot(pl.x - x, pl.y - y)/Math.max(.35, plantRadius(pl));
    if(d <= bd){ bd = d; best = pl; }
  }
  return best;
}
/* changes whenever a date change would alter how this bed draws */
export function bedSeasonKey(bed, season){
  const seen = new Set();
  let key = "";
  for(const pl of bed.plants || []){
    if(seen.has(pl.k)) continue;
    seen.add(pl.k);
    key += pl.k+":"+phaseKey(plantPhase(plantByKey(pl.k), season))+";";
  }
  return key;
}

const matCache = new Map();
function cached(key, make){
  let m = matCache.get(key);
  if(!m){ m = make(); matCache.set(key, m); }
  return m;
}
const TAN = new THREE.Color(0xb39a6b), TWIG = new THREE.Color(0x5b4a3c), SEED = new THREE.Color(0x4a382a);
function foliageMaterial(p, ph){
  const c = new THREE.Color(p.foliage);
  if(ph.state === "standing") c.lerp(TAN, .82);
  else if(ph.state === "dormant") c.copy(TAN).multiplyScalar(.7);
  else if(ph.state === "bare") c.copy(TWIG);
  else if(ph.fall > 0 && p.fall != null) c.lerp(new THREE.Color(p.fall), ph.fall);
  return cached("f"+c.getHexString(), ()=>new THREE.MeshStandardMaterial({color:c, vertexColors:true,
    roughness:.88, metalness:0, side:THREE.DoubleSide}));
}
function flowerMaterial(color){
  return cached("b"+color.getHexString(), ()=>new THREE.MeshStandardMaterial({color, vertexColors:true,
    roughness:.7, metalness:0, side:THREE.DoubleSide}));
}
const symbolMaterial = new THREE.MeshBasicMaterial({vertexColors:true, transparent:true, depthWrite:false,
  side:THREE.DoubleSide, toneMapped:false});

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _Y = new THREE.Vector3(0,1,0);

/* ctx: {
     simple   schematic view: flat colours, symbols only
     mode     "symbols" | "plants"
     season   {md, growing, fall} for plantPhase
     tone     hex → linear [r,g,b] that survives the tone curve as that colour
     toneKey  changes when `tone` would answer differently (exposure)
     soilMap  THREE.Texture for the mulch, or null
   } */
export function buildPlantingBed(bed, ctx){
  const grp = new THREE.Group();
  const outline = bedOutline(bed);
  const mulch = MULCHES[bed.mulch] || MULCHES.bark;

  if(outline.length > 2){
    const shape = new THREE.Shape();
    outline.forEach((q, i)=> i ? shape.lineTo(q.x, -q.y) : shape.moveTo(q.x, -q.y));
    shape.closePath();
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI/2);
    let mat;
    if(ctx.simple) mat = cached("ms"+bed.mulch, ()=>new THREE.MeshStandardMaterial({color:mulch.simple ?? 0x25301f, roughness:1, metalness:0}));
    else if(mulch.color == null) mat = cached("mnone", ()=>new THREE.MeshBasicMaterial({transparent:true, opacity:0, depthWrite:false}));
    else mat = cached("m"+bed.mulch+(ctx.soilMap ? ctx.soilMap.uuid : ""), ()=>{
      const m = new THREE.MeshStandardMaterial({color:mulch.color, roughness:1, metalness:0});
      if(ctx.soilMap){
        m.map = ctx.soilMap.clone(); m.map.needsUpdate = true;
        m.map.repeat.set(1/5, 1/5);          // shape UVs are in feet
        m.color.multiplyScalar(3.4);         // the soil texture is dark; let the mulch colour through
      }
      return m;
    });
    const ground = new THREE.Mesh(geo, mat);
    ground.position.y = BED_Y;
    ground.receiveShadow = true;
    grp.add(ground);

    const pts = [];
    for(const q of outline) pts.push(q.x, BED_Y + .012, q.y);
    const lg = new THREE.BufferGeometry();
    lg.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const edge = new THREE.LineLoop(lg, cached("edge"+(ctx.simple ? 1 : 0), ()=>new THREE.LineBasicMaterial(
      ctx.simple ? {color:0xd9b48a, transparent:true, opacity:.85, depthWrite:false} : {color:0x2a2018, transparent:true, opacity:.7})));
    edge.renderOrder = 3;
    edge.raycast = ()=>{};
    grp.add(edge);
  }

  /* group the bed's plants by kind */
  const kinds = new Map();
  for(const pl of bed.plants || []){
    let list = kinds.get(pl.k);
    if(!list){ list = []; kinds.set(pl.k, list); }
    list.push(pl);
  }
  const symbols = ctx.simple || ctx.mode === "symbols";
  /* shorter kinds draw first so taller ones overlap them, as on a planting plan */
  const order = [...kinds.keys()].sort((a, b)=>plantByKey(a).h - plantByKey(b).h);
  order.forEach((k, rank)=>{
    const p = plantByKey(k), list = kinds.get(k), n = list.length;
    const place = (mesh, each)=>{
      list.forEach((pl, i)=>{
        const rnd = seeded(pl.id*7919 + 13), turn = rnd()*Math.PI*2, vary = .92 + rnd()*.16;
        each(pl, turn, vary);
        mesh.setMatrixAt(i, _m.compose(_p, _q.setFromAxisAngle(_Y, turn), _s));
      });
      mesh.instanceMatrix.needsUpdate = true;
      grp.add(mesh);
    };
    if(symbols){
      const fill = ctx.tone(symbolColor(p)), ink = ctx.tone(0x1c1a17);
      const mesh = new THREE.InstancedMesh(symbolGeometry(p.habit, fill, ink, symbolColor(p)+"|"+ctx.toneKey), symbolMaterial, n);
      mesh.renderOrder = 2.2 + rank*.002;
      place(mesh, pl=>{ const r = plantRadius(pl); _p.set(pl.x, SYMBOL_Y, pl.y); _s.set(r, 1, r); });
      return;
    }
    const ph = plantPhase(p, ctx.season), proto = plantProto(p);
    /* cut back for winter: a low stubble where the plant will return */
    const squat = ph.state === "dormant" ? [.45, .1] : ph.state === "bare" ? [.9, .92] : [1, 1];
    const leaves = new THREE.InstancedMesh(proto.foliage, foliageMaterial(p, ph), n);
    leaves.castShadow = leaves.receiveShadow = true;
    place(leaves, (pl, turn, vary)=>{ const s = (pl.s || 1)*vary; _p.set(pl.x, BED_Y, pl.y); _s.set(s*squat[0], s*squat[1], s*squat[0]); });
    const heads = ph.bloom ? new THREE.Color(p.bloom.color) : ph.state === "standing" && proto.flowers ? SEED : null;
    if(heads && proto.flowers){
      const fl = new THREE.InstancedMesh(proto.flowers, flowerMaterial(heads), n);
      fl.castShadow = true;
      place(fl, (pl, turn, vary)=>{ const s = (pl.s || 1)*vary; _p.set(pl.x, BED_Y, pl.y); _s.set(s, s, s); });
    }
  });
  grp.userData.seasonKey = bedSeasonKey(bed, ctx.season);
  return grp;
}
