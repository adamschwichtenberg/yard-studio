/* ============================================================ plant models
   How a catalog plant is drawn, in both views of a planting bed:

     plan symbol   a flat coloured disc with an inked outline whose edge says
                   what kind of plant it is (scalloped mound, spiky grass…)
     3D model      a low-polygon plant built at its real size in feet

   Both come from two small registries, so new looks can be added without
   touching the bed renderer or the app:

     HABITS[key] = {
       label,
       outline(a)      plan symbol edge: radius 0…1 at angle a (radians)
       ring            ink line width as a share of the radius (optional)
       foliage(rnd)    BufferGeometry of the leafy body in a unit box:
                       x and z in −0.5…0.5, y in 0…1, origin at the ground
                       centre. It is stretched to the plant's spread and
                       height. A "color" attribute, if present, multiplies
                       the leaf colour (use it to darken the inside).
       crown           where flowers sit: {base, rise, reach, cap}. A dome
                       centred `base` up the plant, `rise` tall and `reach`
                       of the radius wide; `cap` is how far down its sides
                       flowers go, in radians from straight up.
     }
     FLOWERS[form] = {
       size            flower size in feet on a 2.5 ft plant
       density         flowers per square foot of crown
       build(s, rnd)   BufferGeometry of ONE flower, s feet big, pointing +y
                       from the origin. A "color" attribute multiplies the
                       bloom colour (e.g. a dark daisy centre).
     }

   plantProto(plant) merges these into two geometries per catalog entry,
   {foliage, flowers}, cached and instanced by beds.js: one draw call for all
   the leaves of a kind in a bed and one for all its flowers. Keep that
   contract and anything can replace the geometry: textured cards, denser
   meshes, per-species builders. */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export function seeded(a){
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hashKey(s){ let h = 2166136261; for(let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/* ---------- geometry helpers ---------- */
/* Every part is merged, so they must agree on attributes: position, normal, color. */
function finish(g, shade){
  if(g.index) g = g.toNonIndexed();
  g.deleteAttribute("uv");
  g.computeVertexNormals();
  const pos = g.attributes.position, col = new Float32Array(pos.count*3);
  for(let i=0;i<pos.count;i++){
    const v = shade ? shade(pos.getX(i), pos.getY(i), pos.getZ(i)) : 1;
    col[i*3] = col[i*3+1] = col[i*3+2] = v;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return g;
}
function tint(g, r, gr, b){
  const col = g.attributes.color;
  for(let i=0;i<col.count;i++) col.setXYZ(i, col.getX(i)*r, col.getY(i)*gr, col.getZ(i)*b);
  return g;
}
/* fit a merged body into the unit box: x, z in ±0.5 and y in 0…1 */
function toUnitBox(g){
  g.computeBoundingBox();
  const b = g.boundingBox, r = Math.max(b.max.x, -b.min.x, b.max.z, -b.min.z) || 1;
  g.translate(0, -b.min.y, 0);
  g.scale(.5/r, 1/Math.max(1e-6, b.max.y - b.min.y), .5/r);
  return g;
}
/* darker toward the ground and the middle, where leaves shade each other */
const depthShade = (x, y, z)=>.62 + .38*Math.min(1, y*.9 + Math.hypot(x, z)*.5);

function dome(lumps, lumpiness, rnd){
  const g = new THREE.SphereGeometry(.5, 14, 7, 0, Math.PI*2, 0, Math.PI/2);
  const pos = g.attributes.position, p1 = rnd()*6.28, p2 = rnd()*6.28;
  for(let i=0;i<pos.count;i++){
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const a = Math.atan2(z, x), v = y/.5;
    const k = 1 + lumpiness*(Math.sin(a*lumps + p1)*Math.sin(v*5 + p2)*.7 + Math.sin(a*(lumps*2-1) + p2)*.3);
    pos.setXYZ(i, x*k, y*2*(1 + lumpiness*.5*Math.sin(a*3 + p1)), z*k);
  }
  return toUnitBox(finish(g, depthShade));
}
/* a leaf or blade as a ribbon along a path; path(t) → [out, up], width(t) in unit space */
function ribbon(angle, path, width, segs, twist){
  const pts = [], ca = Math.cos(angle), sa = Math.sin(angle);
  for(let i=0;i<=segs;i++){
    const t = i/segs, [o, u] = path(t), w = width(t)/2, tw = (twist||0)*t;
    const px = -sa*Math.cos(tw)*w, pz = ca*Math.cos(tw)*w, py = Math.sin(tw)*w;
    pts.push([ca*o - px, u - py, sa*o - pz], [ca*o + px, u + py, sa*o + pz]);
  }
  const v = [];
  for(let i=0;i<segs;i++){
    const a = pts[i*2], b = pts[i*2+1], c = pts[i*2+2], d = pts[i*2+3];
    v.push(...a, ...b, ...c, ...b, ...d, ...c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  return g;
}

/* ---------- habits ---------- */
export const HABITS = {
  mound: {
    label:"Mound",
    outline:a=>.9 + .1*Math.abs(Math.cos(a*4.5)),
    foliage:rnd=>dome(5, .1, rnd),
    crown:{base:.42, rise:.56, reach:.86, cap:1.15}
  },
  upright: {
    label:"Upright stems",
    outline:a=>.8 + .2*Math.abs(Math.cos(a*7)),
    foliage(rnd){
      const parts = [], n = 30;
      for(let i=0;i<n;i++){
        const a = i*2.39996 + rnd()*.5, r = .2*Math.sqrt((i+.5)/n), len = .62 + rnd()*.2;
        const g = new THREE.ConeGeometry(.055, len, 5, 1);
        g.translate(0, len/2, 0);
        g.rotateZ(-(.05 + r*1.1 + rnd()*.08));
        g.rotateY(-a);
        g.translate(Math.cos(a)*r, 0, Math.sin(a)*r);
        parts.push(finish(g, depthShade));
      }
      return toUnitBoxKeepTop(mergeGeometries(parts), .8);
    },
    crown:{base:.5, rise:.3, reach:.72, cap:.95}
  },
  fountain: {
    label:"Arching clump",
    outline:a=>.72 + .28*Math.pow(Math.abs(Math.cos(a*9)), 1.6),
    ring:.04,
    foliage(rnd){
      const parts = [], n = 44;
      for(let i=0;i<n;i++){
        const a = i*2.39996 + rnd()*.4, reach = .22 + .28*rnd(), peak = .62 + .38*rnd();
        parts.push(ribbon(a, t=>[reach*Math.pow(t, 1.25), peak*(2.1*t - 1.2*t*t)/.92], t=>.05*(1 - t*.85), 4, .5));
      }
      return toUnitBox(finish(mergeGeometries(parts), depthShade));
    },
    crown:{base:.5, rise:.42, reach:.55, cap:.8}
  },
  mat: {
    label:"Ground-hugging mat",
    outline:a=>.9 + .06*Math.sin(a*3 + .6) + .04*Math.sin(a*7),
    ring:.045,
    foliage:rnd=>dome(8, .14, rnd),
    crown:{base:.2, rise:.8, reach:.9, cap:1.25}
  },
  rosette: {
    label:"Broad-leaved rosette",
    outline:a=>.78 + .22*Math.pow(Math.abs(Math.cos(a*3.5)), .7),
    foliage(rnd){
      const parts = [];
      for(const [n, reach, peak, off] of [[9, .5, .62, 0], [7, .36, .95, .35]]){
        for(let i=0;i<n;i++){
          const a = off + i/n*Math.PI*2 + rnd()*.2, R = reach*(.88 + rnd()*.12), P = peak*(.85 + rnd()*.15);
          parts.push(ribbon(a, t=>[R*Math.pow(t, .9), P*(1.9*t - 1.15*t*t)/.78], t=>.34*Math.sin(Math.PI*Math.pow(t, .8))*R + .01, 5, .25));
        }
      }
      return toUnitBox(finish(mergeGeometries(parts), depthShade));
    },
    crown:{base:.55, rise:.45, reach:.3, cap:.5}
  },
  shrub: {
    label:"Rounded shrub",
    outline:a=>.92 + .08*Math.cos(a*6),
    ring:.1,
    foliage(rnd){
      const parts = [], blob = (x, y, z, r)=>{
        const g = new THREE.IcosahedronGeometry(r, 1);
        g.scale(1, .9 + rnd()*.25, 1); g.rotateY(rnd()*6.28); g.translate(x, y, z);
        parts.push(finish(g));
      };
      blob(0, .5, 0, .4);
      for(let i=0;i<6;i++){
        const a = i/6*Math.PI*2 + rnd()*.5, r = .2 + rnd()*.07;
        blob(Math.cos(a)*r, .3 + rnd()*.34, Math.sin(a)*r, .25 + rnd()*.07);
      }
      const g = toUnitBox(mergeGeometries(parts));
      const pos = g.attributes.position, col = g.attributes.color;
      for(let i=0;i<pos.count;i++){ const s = depthShade(pos.getX(i), pos.getY(i), pos.getZ(i)); col.setXYZ(i, s, s, s); }
      return g;
    },
    crown:{base:.4, rise:.6, reach:.9, cap:1.25}
  },
  conifer: {
    label:"Evergreen globe",
    outline:a=>.9 + .1*Math.abs(Math.cos(a*12)),
    ring:.08,
    foliage(rnd){
      const g = new THREE.IcosahedronGeometry(.5, 2), pos = g.attributes.position, p = rnd()*6.28;
      for(let i=0;i<pos.count;i++){
        const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        const k = 1 + .05*Math.sin(Math.atan2(z, x)*9 + p)*Math.cos(y*14);
        pos.setXYZ(i, x*k, y, z*k);
      }
      return toUnitBox(finish(g, depthShade));
    },
    crown:{base:.4, rise:.6, reach:.9, cap:1.2}
  }
};
/* like toUnitBox, but the leaves stop at `top` so flower stems can rise above */
function toUnitBoxKeepTop(g, top){ toUnitBox(g); g.scale(1, top, 1); return g; }

/* ---------- flowers ---------- */
export const FLOWERS = {
  spike: {
    size:.55, density:3,
    build(s){ const g = new THREE.ConeGeometry(s*.085, s, 5, 1); g.translate(0, s*.42, 0); return finish(g); }
  },
  daisy: {
    size:.42, density:2.4,
    build(s){
      const stem = s*.5;
      const petals = new THREE.CircleGeometry(s/2, 9); petals.rotateX(-Math.PI/2); petals.translate(0, stem, 0);
      const eye = new THREE.SphereGeometry(s*.17, 6, 4, 0, Math.PI*2, 0, Math.PI/2); eye.translate(0, stem, 0);
      return mergeGeometries([finish(petals), tint(finish(eye), .28, .2, .12)]);
    }
  },
  cluster: {
    size:.4, density:2.2,
    build(s){ const g = new THREE.IcosahedronGeometry(s/2, 0); g.scale(1, .55, 1); g.translate(0, s*.1, 0); return finish(g); }
  },
  panicle: {
    size:.75, density:1.1,
    build(s){ const g = new THREE.ConeGeometry(s*.2, s, 6, 1); g.translate(0, s*.38, 0); return finish(g); }
  },
  bell: {
    size:.3, density:1.1,
    build(s){
      const stem = s*.9;
      const g = new THREE.ConeGeometry(s/2, s*.7, 6, 1, true); g.rotateX(Math.PI); g.translate(0, stem + s*.35, 0);
      return finish(g);
    }
  }
};

/* ---------- the two geometries of one catalog plant, at its real size ---------- */
const protoCache = new Map();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _up = new THREE.Vector3(0,1,0), _n = new THREE.Vector3(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1,1,1);
export function plantProto(p){
  let proto = protoCache.get(p.k);
  if(proto) return proto;
  const habit = HABITS[p.habit] || HABITS.mound, rnd = seeded(hashKey(p.k));
  const foliage = habit.foliage(rnd);
  foliage.scale(p.w, p.h, p.w);
  foliage.computeVertexNormals();
  foliage.userData.shared = true;
  let flowers = null;
  const form = p.bloom && FLOWERS[p.bloom.form];
  if(form){
    const c = habit.crown, R = p.w/2*c.reach;
    const size = form.size*Math.max(.5, Math.min(1.6, Math.max(p.h, p.w)/2.5));
    const n = Math.max(7, Math.min(70, Math.round(form.density*2*Math.PI*R*R)));
    const parts = [];
    for(let i=0;i<n;i++){
      /* even coverage of the crown dome: golden-angle spiral, equal area per flower */
      const phi = Math.acos(1 - (i+.5)/n*(1 - Math.cos(c.cap))), th = i*2.39996 + rnd()*.3;
      _n.set(Math.sin(phi)*Math.cos(th), Math.cos(phi), Math.sin(phi)*Math.sin(th));
      _p.set(_n.x*R, (c.base + c.rise*_n.y)*p.h, _n.z*R);
      /* lean out with the crown, but mostly reach for the light */
      _n.y += 1.4; _n.normalize();
      _q.setFromUnitVectors(_up, _n);
      const g = form.build(size*(.8 + rnd()*.4), rnd);
      g.applyMatrix4(_m.compose(_p, _q, _s));
      parts.push(g);
    }
    flowers = mergeGeometries(parts);
    flowers.computeVertexNormals();
    flowers.userData.shared = true;
  }
  proto = {foliage, flowers};
  protoCache.set(p.k, proto);
  return proto;
}

/* ---------- plan symbol ----------
   A unit-radius disc in the ground plane: translucent fill, an inked edge in
   the habit's outline and a centre dot. Colours are RGBA vertex colours so a
   whole kind of plant is one instanced draw. `fill` and `ink` are linear RGB
   triples, already compensated for the tone curve by the caller. */
const symbolCache = new Map();
export function symbolGeometry(habitKey, fill, ink, cacheKey){
  const key = habitKey+"|"+cacheKey;
  let g = symbolCache.get(key);
  if(g) return g;
  const habit = HABITS[habitKey] || HABITS.mound, N = 120, ring = habit.ring ?? .06;
  const pos = [], col = [];
  const push = (x, z, c, a)=>{ pos.push(x, 0, z); col.push(c[0], c[1], c[2], a); };
  const edge = [];
  let mx = 0;
  for(let i=0;i<N;i++){ const a = i/N*Math.PI*2, r = habit.outline(a); edge.push([Math.cos(a), Math.sin(a), r]); if(r > mx) mx = r; }
  for(const e of edge) e[2] /= mx;
  const lite = fill.map(v=>v*1.18 + .04);
  for(let i=0;i<N;i++){
    const a = edge[i], b = edge[(i+1)%N];
    push(0, 0, lite, .86); push(b[0]*b[2], b[1]*b[2], fill, .86); push(a[0]*a[2], a[1]*a[2], fill, .86);
  }
  const band = (r0, r1, c, alpha, shaped)=>{
    for(let i=0;i<N;i++){
      const a = edge[i], b = edge[(i+1)%N], ka = shaped ? a[2] : 1, kb = shaped ? b[2] : 1;
      const A0 = [a[0]*ka*r0, a[1]*ka*r0], A1 = [a[0]*ka*r1, a[1]*ka*r1], B0 = [b[0]*kb*r0, b[1]*kb*r0], B1 = [b[0]*kb*r1, b[1]*kb*r1];
      push(...A0, c, alpha); push(...B1, c, alpha); push(...A1, c, alpha);
      push(...A0, c, alpha); push(...B0, c, alpha); push(...B1, c, alpha);
    }
  };
  band(1 - ring, 1, ink, 1, true);
  if(habitKey === "shrub" || habitKey === "conifer") band(.56, .56 + ring*.5, ink, .55, false);
  band(0, .07, ink, .9, false);
  g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 4));
  g.userData.shared = true;
  symbolCache.set(key, g);
  return g;
}
/* the same outline as an SVG path, for palette swatches and the legend */
export function symbolPath(habitKey, cx, cy, r){
  const habit = HABITS[habitKey] || HABITS.mound, N = 72;
  let mx = 0, d = "";
  for(let i=0;i<N;i++) mx = Math.max(mx, habit.outline(i/N*Math.PI*2));
  for(let i=0;i<N;i++){
    const a = i/N*Math.PI*2, k = habit.outline(a)/mx*r;
    d += (i ? "L" : "M") + (cx + Math.cos(a)*k).toFixed(1) + " " + (cy + Math.sin(a)*k).toFixed(1);
  }
  return d + "Z";
}
