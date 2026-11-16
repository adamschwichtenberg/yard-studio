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
  bark:      {label:"Mulch, dark brown",  color:0x6b4a34, simple:0x3b2d22},
  barklight: {label:"Mulch, light brown", color:0xd9c7a4, simple:0x5a4634},
  limestone: {label:"Buff limestone rock", rock:"limestone", simple:0x6e6452},
  slate:     {label:"Slate rock (dark gray)", rock:"slate", simple:0x34373b},
  river:     {label:"River rock",          rock:"river", simple:0x5c5953},
  gravel:    {label:"Pea gravel",          color:0xcfc6b4, simple:0x55534c},
  soil:      {label:"Bare soil",           color:0x8a745f, simple:0x30261d},
  none:      {label:"Lawn (no mulch)",     color:null,   simple:null}
};
/* Rock surfaces: a tiling picture of stones, painted once at 1024 px, with a
   matching height picture so the sun picks out each stone. Crushed limestone
   and slate are angular chips with flat, differently lit faces; river rock is
   rounded cobbles. Small stones go down first and the big ones lie on them. */
const ROCKS = {
  limestone: {base:"#5e4e36", tones:["#d9c39a", "#cdb488", "#e2d2b0", "#bfa174", "#d2b98a", "#c4aa82", "#e6d8b8", "#b89868"], round:false, size:.062, feet:3, facet:.2, grain:.1, rough:.95},
  slate:     {base:"#101214", tones:["#4a4f56", "#3b4047", "#5a6068", "#33373d", "#444a52", "#2c3036", "#52565c"], round:false, size:.075, feet:3.4, facet:.34, grain:.05, rough:.6, rust:.1},
  river:     {base:"#2e2a26", tones:["#b9b2a4", "#8f8a80", "#c9b89a", "#6f6c68", "#a89480", "#d6d0c4", "#7c6a5a", "#9aa0a2", "#b0a090", "#5e5a58"], round:true, size:.072, feet:3.4, facet:0, grain:.07, rough:.8}
};
const rockCache = new Map();
function rockTextures(kind){
  let t = rockCache.get(kind);
  if(t) return t;
  const K = ROCKS[kind], N = 1024, r = seeded(kind.length*977 + 5);
  const mk = ()=>{ const c = document.createElement("canvas"); c.width = c.height = N; return c; };
  const cc = mk(), hc = mk(), g = cc.getContext("2d"), h = hc.getContext("2d");
  g.fillStyle = K.base; g.fillRect(0, 0, N, N);
  h.fillStyle = "#000"; h.fillRect(0, 0, N, N);
  const grey = v=>{ const k = Math.round(255*Math.max(0, Math.min(1, v))); return `rgb(${k},${k},${k})`; };
  const shadeHex = (hex, k)=>{ const n = parseInt(hex.slice(1), 16); return `rgb(${[n>>16 & 255, n>>8 & 255, n & 255].map(v=>Math.round(Math.max(0, Math.min(255, v*k)))).join(",")})`; };
  const stone = (x, y, s, lift)=>{
    const rot = r()*Math.PI*2, col = K.tones[Math.floor(r()*K.tones.length)], sx = .78 + .5*r(), sy = .62 + .3*r();
    const nv = K.round ? 14 : 5 + Math.floor(r()*4), vs = [];
    for(let k = 0; k < nv; k++){
      const a = k/nv*Math.PI*2 + (K.round ? 0 : (r() - .5)*.5), rad = K.round ? .9 + .1*r() : .62 + .38*r();
      vs.push([Math.cos(a)*s*.56*rad*sx, Math.sin(a)*s*.56*rad*sy]);
    }
    const cx0 = (r() - .5)*s*.22, cy0 = (r() - .5)*s*.18;            // the high point: off-centre, so the faces differ
    const shades = vs.map((v, k)=>{
      /* each face is lit by how it tilts toward the light, upper left */
      const w = vs[(k + 1)%nv], mx = (v[0] + w[0])/2 - cx0, my = (v[1] + w[1])/2 - cy0, m = Math.hypot(mx, my) || 1;
      const ca = Math.cos(rot), sa = Math.sin(rot), wx = (mx*ca - my*sa)/m, wy = (mx*sa + my*ca)/m;
      return 1 + K.facet*(-wx*.7 - wy*.7) + (r() - .5)*.08;
    });
    const speck = [];
    for(let k = 0; k < 26; k++) speck.push([(r() - .5)*s, (r() - .5)*s*.8, s*(.012 + r()*.03), r() > .5, r()]);
    const rusty = K.rust && r() < K.rust, rx = (r() - .5)*s*.4, ry = (r() - .5)*s*.3;
    for(const ox of [-N, 0, N]) for(const oy of [-N, 0, N]){
      if(x + ox < -s || x + ox > N + s || y + oy < -s || y + oy > N + s) continue;
      const path = c=>{
        c.beginPath();
        if(K.round){
          for(let k = 0; k <= nv; k++){ const a = vs[k%nv], b = vs[(k + 1)%nv], mx = (a[0] + b[0])/2, my = (a[1] + b[1])/2; if(!k) c.moveTo(mx, my); else c.quadraticCurveTo(a[0], a[1], mx, my); }
        } else vs.forEach((v, k)=>c[k ? "lineTo" : "moveTo"](v[0], v[1]));
        c.closePath();
      };
      for(const c of [g, h]){ c.save(); c.translate(x + ox, y + oy); c.rotate(rot); }
      /* the stone and the shadow it drops on those beneath */
      g.save(); g.shadowColor = "rgba(0,0,0,.7)"; g.shadowBlur = s*.22; g.shadowOffsetX = s*.07; g.shadowOffsetY = s*.09;
      path(g); g.fillStyle = col; g.fill(); g.restore();
      g.save(); path(g); g.clip();
      if(K.round){
        const gr = g.createRadialGradient(-s*.14, -s*.14, s*.04, 0, 0, s*.6);
        gr.addColorStop(0, shadeHex(col, 1.2)); gr.addColorStop(.55, col); gr.addColorStop(1, shadeHex(col, .55));
        g.fillStyle = gr; g.fillRect(-s, -s, s*2, s*2);
      } else vs.forEach((v, k)=>{
        const w = vs[(k + 1)%nv];
        g.fillStyle = g.strokeStyle = shadeHex(col, shades[k]); g.lineWidth = 1;
        g.beginPath(); g.moveTo(cx0, cy0); g.lineTo(v[0], v[1]); g.lineTo(w[0], w[1]); g.closePath(); g.fill(); g.stroke();
      });
      for(const [px, py, pr, lite, a] of speck){ g.fillStyle = lite ? `rgba(255,255,255,${K.grain*(.5 + a)})` : `rgba(0,0,0,${K.grain*(.6 + a)})`; g.beginPath(); g.arc(px, py, pr, 0, Math.PI*2); g.fill(); }
      if(rusty){ const gr = g.createRadialGradient(rx, ry, 0, rx, ry, s*.22); gr.addColorStop(0, "rgba(190,110,40,.75)"); gr.addColorStop(1, "rgba(190,110,40,0)"); g.fillStyle = gr; g.fillRect(-s, -s, s*2, s*2); }
      g.restore();
      path(g); g.strokeStyle = "rgba(0,0,0,.38)"; g.lineWidth = Math.max(1, s*.025); g.stroke();
      /* height: a dome for a cobble, a low peak for a chip */
      path(h);
      const hg = h.createRadialGradient(cx0, cy0, 0, 0, 0, s*.6);
      hg.addColorStop(0, grey(lift)); hg.addColorStop(K.round ? .7 : .85, grey(lift*(K.round ? .72 : .86))); hg.addColorStop(1, grey(lift*.35));
      h.fillStyle = hg; h.fill();
      g.restore(); h.restore();
    }
  };
  /* three sizes: grit in the gaps, small stones, then the stones you see */
  for(const [k, share, lift] of [[.3, 1.3, .35], [.6, 1.1, .65], [1, 1.25, 1]]){
    const s0 = N*K.size*k, n = Math.round(share/(K.size*K.size*k*k));
    for(let i = 0; i < n; i++) stone(r()*N, r()*N, s0*(.7 + .6*r()), lift*(.8 + .2*r()));
  }
  const tex = (c, srgb)=>{
    const m = new THREE.CanvasTexture(c);
    if(srgb) m.colorSpace = THREE.SRGBColorSpace;
    m.wrapS = m.wrapT = THREE.RepeatWrapping;
    m.repeat.set(1/K.feet, 1/K.feet);          // shape UVs are in feet
    m.anisotropy = 16;
    return m;
  };
  t = {map:tex(cc, true), bump:tex(hc, false), rough:K.rough};
  rockCache.set(kind, t);
  return t;
}
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
    else if(mulch.color == null && !mulch.rock) mat = cached("mnone", ()=>new THREE.MeshBasicMaterial({transparent:true, opacity:0, depthWrite:false}));
    else if(mulch.rock) mat = cached("mr"+mulch.rock, ()=>{
      const t = rockTextures(mulch.rock);
      return new THREE.MeshStandardMaterial({map:t.map, bumpMap:t.bump, bumpScale:1.6, color:0xc4c4c4, roughness:t.rough, metalness:0});
    });
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
