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
   Either way each kind of plant in a bed is instanced: a few draw calls
   however often it repeats. */
import * as THREE from "three";
import { plantByKey, plantPhase, phaseKey, symbolColor, flowerColors } from "./plants.js";
import { plantProto, symbolGeometry, seeded } from "./models.js";
import { plantTexture } from "./plantTextures.js";

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
    const p = plantByKey(pl.k);
    key += pl.k+":"+phaseKey(p, plantPhase(p, season))+";";
  }
  return key;
}

/* ---------- materials ---------- */
const matCache = new Map();
function cached(key, make){
  let m = matCache.get(key);
  if(!m){ m = make(); matCache.set(key, m); }
  return m;
}
const hex = c=>c.getHexString();
/* A textured plant layer. The texture gives shape and shading (R), and says
   which of two colours each texel takes (G); the plant supplies the colours.
   `mix` lets single flowers swap the first colour for another, per flower. */
function texturedMaterial(kind, a, b, mix, vary){
  const key = ["t", kind, hex(a), hex(b), mix ? mix.map(hex).join("") : "", vary].join("|");
  return cached(key, ()=>{
    const tex = plantTexture(kind);
    const uniforms = {
      uColA:{value:a.clone()}, uColB:{value:b.clone()},
      uMix1:{value:(mix?.[0] || a).clone()}, uMix2:{value:(mix?.[1] || mix?.[0] || a).clone()}, uMix3:{value:(mix?.[2] || mix?.[0] || a).clone()},
      uMixOn:{value:mix ? 1 : 0}, uLumaNorm:{value:1/tex.luma}, uVary:{value:vary}
    };
    const mat = new THREE.MeshStandardMaterial({map:tex.map, alphaTest:tex.opaque ? 0 : .28, side:THREE.DoubleSide, roughness:.72, metalness:0});
    mat.userData.plantUniforms = uniforms;
    mat.customProgramCacheKey = ()=>"yard-plant";
    mat.onBeforeCompile = shader=>{
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>
          attribute float aRand;
          attribute float aAO;
          varying float vRand;
          varying float vAO;`)
        .replace("#include <begin_vertex>", `#include <begin_vertex>
          vRand = aRand;
          vAO = aAO;`);
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>
          uniform vec3 uColA;
          uniform vec3 uColB;
          uniform vec3 uMix1;
          uniform vec3 uMix2;
          uniform vec3 uMix3;
          uniform float uMixOn;
          uniform float uLumaNorm;
          uniform float uVary;
          varying float vRand;
          varying float vAO;`)
        .replace("#include <map_fragment>", `
          vec4 plantTexel = texture2D(map, vMapUv);
          float plantL = min(plantTexel.r * uLumaNorm, 1.5);
          vec3 first = uColA;
          if(uMixOn > .5){
            float pick = fract(vRand * 7.31);
            first = pick < .25 ? uColA : pick < .5 ? uMix1 : pick < .75 ? uMix2 : uMix3;
          }
          vec3 hue = mix(first, uColB, plantTexel.g);
          // outer, sunlit growth runs warmer and lighter; the inside cooler
          hue *= mix(vec3(1.0), mix(vec3(.8, .88, .98), vec3(1.08, 1.05, .93), vAO) * (.86 + .28 * vRand), uVary);
          diffuseColor = vec4(hue * plantL, plantTexel.a);`)
        .replace("#include <aomap_fragment>", `#include <aomap_fragment>
          reflectedLight.indirectDiffuse *= mix(.38, 1.0, vAO);
          reflectedLight.directDiffuse *= mix(.62, 1.0, vAO);`)
        .replace("#include <normal_fragment_begin>",
          THREE.ShaderChunk.normal_fragment_begin.replace("gl_FrontFacing ? 1.0 : - 1.0", "1.0"));
    };
    return mat;
  });
}
function plainMaterial(color, rough = .9){
  return cached("p|"+hex(color)+rough, ()=>new THREE.MeshStandardMaterial({color:color.clone(), roughness:rough, metalness:0, side:THREE.DoubleSide}));
}
const symbolMaterial = new THREE.MeshBasicMaterial({vertexColors:true, transparent:true, depthWrite:false, side:THREE.DoubleSide});

const C = h=>new THREE.Color(h);
const TAN = C(0xb89e6e), STRAW = C(0xcdb98a), SEED = C(0x5a4636), DRIED = C(0xb8a07c), TWIG = C(0x6a5a48), BARK = C(0x7a6450);

/* The meshes of one kind of plant on a given day: [{geometry, material,
   scale:[xz, y], shadow}], ready to instance. Shared by the beds and by the
   library thumbnails. */
export function plantLayers(p, season){
  const ph = plantPhase(p, season), proto = plantProto(p), out = [];
  const st = ph.state, leafy = st === "growing" || st === "evergreen";
  const fol = C(p.foliage), fol2 = C(p.foliage2 ?? p.foliage);
  if(leafy && ph.fall > 0 && p.fall != null){ fol.lerp(C(p.fall), ph.fall); fol2.lerp(C(p.fall), ph.fall*.6); }
  if(st === "evergreen" && !season.growing && p.winterFoliage != null){ fol.set(p.winterFoliage); fol2.copy(fol); }
  if(st === "standing"){ fol.lerp(p.cat === "grass" ? STRAW : TAN, .85); fol2.copy(fol); }
  if(st === "dormant"){ fol.copy(TAN).multiplyScalar(.75); fol2.copy(fol); }
  const showLeaf = leafy || st === "standing" || st === "dormant";
  /* cut back for winter: a low stubble where the plant will return */
  const squat = st === "dormant" ? [.5, .1] : [1, 1];
  const fc = ph.bloom ? flowerColors(p, ph.phase) : null;
  for(const L of proto.layers){
    if(L.role === "leaf"){
      if(!showLeaf) continue;
      out.push({geometry:L.geometry, material:texturedMaterial(L.tex, fol, fol2, null, 1), scale:squat, shadow:true});
    } else if(L.role === "flower"){
      if(st === "dormant") continue;
      if(fc){
        out.push({geometry:L.geometry, material:texturedMaterial(L.tex, C(fc[0]), C(fc[1]), p.mix ? p.mix.map(C) : null, .45), scale:[1, 1], shadow:true});
      } else if(ph.spent){
        const dry = p.cat === "grass" ? STRAW : winterKeepsColour(p) ? DRIED : SEED;
        out.push({geometry:L.geometry, material:texturedMaterial(L.tex, dry, dry.clone().multiplyScalar(.8), null, .6), scale:[1, 1], shadow:true});
      }
    } else if(L.role === "stem"){
      if(st === "dormant") continue;
      const col = st === "standing" ? TAN.clone().multiplyScalar(.8)
        : p.stem != null ? C(p.stem) : p.cat === "shrub" || p.cat === "evergreen" ? TWIG.clone() : C(p.foliage).lerp(C(0x6f8a3a), .5);
      out.push({geometry:L.geometry, material:plainMaterial(col), scale:[1, 1], shadow:true});
    } else if(L.role === "wood"){
      out.push({geometry:L.geometry, material:plainMaterial(BARK), scale:[1, 1], shadow:true});
    } else if(L.role === "mass"){
      if(!leafy) continue;
      out.push({geometry:L.geometry, material:plainMaterial(fol.clone().multiplyScalar(.6), 1), scale:[1, 1], shadow:true});
    }
  }
  return out;
}
const winterKeepsColour = p=>p.winter === "heads";

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
        each(pl, vary);
        mesh.setMatrixAt(i, _m.compose(_p, _q.setFromAxisAngle(_Y, turn), _s));
      });
      mesh.instanceMatrix.needsUpdate = true;
      grp.add(mesh);
    };
    if(symbols){
      const fill = ctx.tone(symbolColor(p)), ink = ctx.tone(0x1c1a17);
      const mesh = new THREE.InstancedMesh(symbolGeometry(p, fill, ink, symbolColor(p)+"|"+ctx.toneKey), symbolMaterial, n);
      mesh.renderOrder = 2.2 + rank*.002;
      place(mesh, pl=>{ const r = plantRadius(pl); _p.set(pl.x, SYMBOL_Y, pl.y); _s.set(r, 1, r); });
      return;
    }
    for(const L of plantLayers(p, ctx.season)){
      const mesh = new THREE.InstancedMesh(L.geometry, L.material, n);
      mesh.castShadow = L.shadow; mesh.receiveShadow = true;
      place(mesh, (pl, vary)=>{ const s = (pl.s || 1)*vary; _p.set(pl.x, BED_Y, pl.y); _s.set(s*L.scale[0], s*L.scale[1], s*L.scale[0]); });
    }
  });
  grp.userData.seasonKey = bedSeasonKey(bed, ctx.season);
  return grp;
}
/* one plant on its own, for the library thumbnails */
export function plantPreview(p, season){
  const grp = new THREE.Group();
  for(const L of plantLayers(p, season)){
    const mesh = new THREE.Mesh(L.geometry, L.material);
    mesh.scale.set(L.scale[0], L.scale[1], L.scale[0]);
    grp.add(mesh);
  }
  return grp;
}
