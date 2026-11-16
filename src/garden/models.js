/* ============================================================ plant models
   The 3D plant library for planting beds: 24 parametric growth forms (14
   perennial, 10 shrub) plus a standard-trunk add-on. A catalog entry in
   plants.js is a preset on one of them: a model key, a size in feet, colours
   and a few model options. No variety has its own mesh.

   Built the way the trees are: alpha-tested cards carrying procedural leaf
   and flower textures (plantTextures.js), tubes for stems and twigs. Shrubs
   are dense because foliage sits at every depth, not because of a solid
   core. Each plant comes out as a few merged geometries, one per layer:

     role "leaf"    textured foliage, takes the plant's foliage colours
     role "flower"  textured blooms, takes its flower colours; drawn only in
                    its bloom window (or as dried heads afterwards)
     role "stem"    plain tubes in the stem colour: green stalks, red dogwood
                    canes. What is left of a shrub in winter.
     role "wood"    plain tubes in bark brown: the trunk of a patio tree

   beds.js gives every layer a material for the date and instances it, so a
   kind of plant costs a handful of draw calls however often it repeats.

   To add a growth form: write a function (P, p, o) that calls the generators
   below (rosette, tuft, dome, stalks, bush, canes) and register it in MODELS
   with a label and a plan symbol. `P` is the plant being built, `p` the
   catalog entry and `o` its `opt` object. */
import * as THREE from "three";

export function seeded(a){
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hashKey(s){ let h = 2166136261; for(let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const V = (x = 0, y = 0, z = 0)=>new THREE.Vector3(x, y, z);
const UP = V(0, 1, 0), GOLD = 2.399963, TAU = Math.PI*2;
const clamp = (v, a, b)=>Math.max(a, Math.min(b, v));
const lerp = (a, b, t)=>a + (b - a)*t;
function perp(d){
  const s = V().crossVectors(d, Math.abs(d.y) < .95 ? UP : V(1, 0, 0));
  return s.normalize();
}
const polar = (a, r, y = 0)=>V(Math.cos(a)*r, y, Math.sin(a)*r);

/* ---------- geometry buffer ---------- */
class Buf {
  constructor(){ this.pos = []; this.nor = []; this.uv = []; this.idx = []; this.rand = []; this.ao = []; }
  get count(){ return this.pos.length/3; }
  vert(p, n, u, v, rnd, ao){
    this.pos.push(p.x, p.y, p.z); this.nor.push(n.x, n.y, n.z); this.uv.push(u, v); this.rand.push(rnd); this.ao.push(ao);
    return this.count - 1;
  }
  geometry(){
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute("aRand", new THREE.Float32BufferAttribute(this.rand, 1));
    g.setAttribute("aAO", new THREE.Float32BufferAttribute(this.ao, 1));
    g.setIndex(this.idx);
    g.computeBoundingSphere(); g.computeBoundingBox();
    g.userData.shared = true;
    return g;
  }
}

/* ---------- one plant under construction ---------- */
class Plant {
  constructor(p){
    this.p = p; this.H = p.h; this.W = p.w; this.R = p.w/2;
    this.rnd = seeded(hashKey(p.base || p.k));
    this.layers = new Map();
    /* foliage normals lean out of the plant as a whole, so it shades as one soft
       form; AO darkens the middle and the base */
    this.nrm = q=>V(q.x, (q.y - this.H*.3)*(this.R/Math.max(.3, this.H)) + this.R*.5, q.z).normalize();
    this.ao = q=>clamp(.22 + .5*Math.hypot(q.x, q.z)/Math.max(.2, this.R) + .4*q.y/Math.max(.2, this.H), .15, 1);
  }
  buf(role, tex = ""){
    const key = role+"|"+tex;
    let L = this.layers.get(key);
    if(!L){ L = {role, tex, buf:new Buf()}; this.layers.set(key, L); }
    return L.buf;
  }
  /* a flat card growing from `base` along `dir`, facing `face` */
  card(role, tex, base, dir, face, w, h, o = {}){
    const B = this.buf(role, tex), rnd = o.rnd ?? this.rnd();
    let side = V().crossVectors(face, dir);
    if(side.lengthSq() < 1e-6) side = perp(dir);
    side.normalize().multiplyScalar(w/2);
    const up = dir.clone().multiplyScalar(h);
    const nf = o.normal ? ()=>o.normal : this.nrm, ao = o.ao;
    const c = [base.clone().sub(side), base.clone().add(side), base.clone().add(side).add(up), base.clone().sub(side).add(up)];
    const i0 = B.count, uv = [[0,0],[1,0],[1,1],[0,1]];
    c.forEach((q, i)=>B.vert(q, nf(q), uv[i][0], uv[i][1], rnd, ao ?? this.ao(q)));
    B.idx.push(i0, i0+1, i0+2, i0, i0+2, i0+3);
  }
  /* n cards crossed around `dir`, so the shape reads from every side */
  cross(role, tex, base, dir, w, h, n = 2, o = {}){
    const a = perp(dir), b = V().crossVectors(dir, a), turn = this.rnd()*Math.PI, rnd = this.rnd();
    for(let k = 0; k < n; k++){
      const t = turn + k*Math.PI/n;
      this.card(role, tex, base, dir, a.clone().multiplyScalar(Math.cos(t)).addScaledVector(b, Math.sin(t)), w, h, {...o, rnd});
    }
  }
  /* a strip along `pts`, `width` wide, lying across `side`: an arching leaf */
  ribbon(role, tex, pts, width, side, o = {}){
    const B = this.buf(role, tex), rnd = this.rnd(), i0 = B.count, n = pts.length - 1;
    for(let i = 0; i <= n; i++){
      const q = pts[i], w = (typeof width === "function" ? width(i/n) : width)/2;
      const a = q.clone().addScaledVector(side, -w), b = q.clone().addScaledVector(side, w);
      /* cup the leaf a little: its edges sit higher than its midrib */
      a.y += w*(o.cup ?? .25); b.y += w*(o.cup ?? .25);
      B.vert(a, this.nrm(a), 0, i/n, rnd, o.ao ?? this.ao(a));
      B.vert(b, this.nrm(b), 1, i/n, rnd, o.ao ?? this.ao(b));
    }
    for(let i = 0; i < n; i++){ const k = i0 + i*2; B.idx.push(k, k+1, k+3, k, k+3, k+2); }
  }
  /* a round flower seen face-on: a shallow cone of `seg` wedges. droop > 0 lets
     the rim hang back (coneflower), droop < 0 cups it forward (trumpet). */
  fan(role, tex, c, axis, radius, droop = 0, o = {}){
    const B = this.buf(role, tex), rnd = this.rnd(), seg = o.seg || 8;
    const a = perp(axis), b = V().crossVectors(axis, a), turn = this.rnd()*TAU;
    const nf = q=>axis.clone().multiplyScalar(.75).addScaledVector(UP, .45).normalize();
    const ao = o.ao ?? clamp(this.ao(c) + .25, 0, 1);
    const i0 = B.vert(c, nf(c), .5, .5, rnd, ao);
    for(let i = 0; i <= seg; i++){
      const t = turn + i/seg*TAU, cx = Math.cos(t), sx = Math.sin(t);
      const q = c.clone().addScaledVector(a, cx*radius*Math.cos(droop)).addScaledVector(b, sx*radius*Math.cos(droop)).addScaledVector(axis, -radius*Math.sin(droop));
      B.vert(q, nf(q), .5 + .5*Math.cos(i/seg*TAU), .5 + .5*Math.sin(i/seg*TAU), rnd, ao);
    }
    for(let i = 0; i < seg; i++) B.idx.push(i0, i0+1+i, i0+2+i);
  }
  /* a ball wrapped in an opaque floret texture. `uv` pins every vertex to one
     texel instead (a daisy's cone takes the texture's centre colour). */
  ball(role, tex, c, r, sy = 1, o = {}){
    const B = this.buf(role, tex), rnd = this.rnd(), rings = 5, seg = 8, i0 = B.count, tile = o.tile ?? 2;
    const ao = o.ao ?? clamp(this.ao(c) + .2, 0, 1), spin = this.rnd();
    for(let j = 0; j <= rings; j++){
      const ph = j/rings*Math.PI, y = -Math.cos(ph), rr = Math.sin(ph);
      for(let i = 0; i <= seg; i++){
        const th = i/seg*TAU, n = V(Math.cos(th)*rr, y, Math.sin(th)*rr);
        const q = V(c.x + n.x*r, c.y + n.y*r*sy, c.z + n.z*r);
        const nn = n.clone().multiplyScalar(.7).addScaledVector(UP, .4).normalize();
        B.vert(q, nn, o.uv ? o.uv[0] : spin + i/seg*tile, o.uv ? o.uv[1] : j/rings, rnd, ao*(.72 + .28*(y*.5 + .5)));
      }
    }
    const row = seg + 1;
    for(let j = 0; j < rings; j++) for(let i = 0; i < seg; i++){
      const a = i0 + j*row + i, b = a + row;
      B.idx.push(a, b, a+1, a+1, b, b+1);
    }
  }
  /* a panicle: a fat spindle along `dir`, wrapped in florets */
  spindle(role, tex, base, dir, r, len, o = {}){
    const B = this.buf(role, tex), rnd = this.rnd(), seg = 7, i0 = B.count, spin = this.rnd();
    const a = perp(dir), b = V().crossVectors(dir, a);
    const prof = o.profile || [[0, .5], [.14, .86], [.32, 1], [.55, .84], [.78, .52], [1, .06]];
    const ao = o.ao ?? clamp(this.ao(base) + .25, 0, 1);
    prof.forEach(([t, k])=>{
      for(let i = 0; i <= seg; i++){
        const th = i/seg*TAU, out = a.clone().multiplyScalar(Math.cos(th)).addScaledVector(b, Math.sin(th));
        const q = base.clone().addScaledVector(dir, len*t).addScaledVector(out, r*k);
        B.vert(q, out.clone().multiplyScalar(.7).addScaledVector(UP, .4).normalize(), spin + i/seg*2, t, rnd, ao*(.78 + .22*t));
      }
    });
    const row = seg + 1;
    for(let j = 0; j < prof.length - 1; j++) for(let i = 0; i < seg; i++){
      const p0 = i0 + j*row + i, p1 = p0 + row;
      B.idx.push(p0, p1, p0+1, p0+1, p1, p1+1);
    }
  }
  /* a tapered tube through `pts` */
  tube(role, pts, r0, r1, segs = 5){
    const B = this.buf(role), base = B.count;
    let normal = null;
    for(let i = 0; i < pts.length; i++){
      const q = pts[i], T = V().subVectors(pts[Math.min(pts.length-1, i+1)], pts[Math.max(0, i-1)]).normalize();
      if(!normal) normal = perp(T); else normal.addScaledVector(T, -normal.dot(T)).normalize();
      const bin = V().crossVectors(T, normal), r = lerp(r0, r1, i/(pts.length-1)), ao = this.ao(q);
      for(let s = 0; s <= segs; s++){
        const th = s/segs*TAU, o = normal.clone().multiplyScalar(Math.cos(th)).addScaledVector(bin, Math.sin(th));
        B.vert(V(q.x + o.x*r, q.y + o.y*r, q.z + o.z*r), o, s/segs, i/(pts.length-1), .5, ao);
      }
    }
    const row = segs + 1;
    for(let i = 0; i < pts.length-1; i++) for(let s = 0; s < segs; s++){
      const a = base + i*row + s, b = a + row;
      B.idx.push(a, b, a+1, a+1, b, b+1);
    }
  }
  /* a solid of revolution: the inner mass of a shrub. profile = [[y, r]…] */
  lathe(role, profile, seg = 9){
    const B = this.buf(role), i0 = B.count;
    profile.forEach(([y, r])=>{
      for(let i = 0; i <= seg; i++){
        const th = i/seg*TAU, n = V(Math.cos(th), .3, Math.sin(th)).normalize();
        B.vert(V(Math.cos(th)*r, y, Math.sin(th)*r), n, i/seg, 0, .5, .3);
      }
    });
    const row = seg + 1;
    for(let j = 0; j < profile.length-1; j++) for(let i = 0; i < seg; i++){
      const a = i0 + j*row + i, b = a + row;
      B.idx.push(a, b, a+1, a+1, b, b+1);
    }
  }

  /* Clusters of florets standing on a flower head: small cards facing outward,
     so a panicle or mophead has a broken, petalled outline instead of a
     smooth one. Round a ball (len 0) or up a cone of radius prof(t). */
  florets(c, axis, n, prof, size, cap = 0, sy = 1, len = 0){
    const a = perp(axis), b = V().crossVectors(axis, a), turn = this.rnd()*TAU;
    for(let i = 0; i < n; i++){
      const th = turn + i*GOLD + (this.rnd() - .5)*.5;
      let q, nr, age, k = 1;
      const t = (i + .5)/n;
      if(len){
        /* bigger clusters low on the cone, small ones crowding the tip */
        const rad = prof(t), ring = a.clone().multiplyScalar(Math.cos(th)).addScaledVector(b, Math.sin(th));
        q = c.clone().addScaledVector(axis, len*(.04 + .9*t)).addScaledVector(ring, rad*(.72 + .16*this.rnd()));
        nr = ring.addScaledVector(axis, .35 + 1.1*t*t).normalize();
        age = 1 - t; k = 1.12 - .5*t;
      } else {
        /* over the ball, leaving out the cap where the stalk comes in */
        const ph = Math.acos(1 - t*(2 - cap*.35)), sn = Math.sin(ph);
        nr = axis.clone().multiplyScalar(Math.cos(ph)).addScaledVector(a, sn*Math.cos(th)).addScaledVector(b, sn*Math.sin(th)).normalize();
        const rad = prof(t);
        q = V(c.x + nr.x*rad, c.y + nr.y*rad*sy, c.z + nr.z*rad);
        age = .5 - .5*nr.dot(axis);
      }
      const s = size*k*(.8 + .4*this.rnd());
      let up = axis.clone().addScaledVector(nr, -nr.dot(axis));
      if(up.lengthSq() < .02) up = perp(nr);
      up.normalize().applyAxisAngle(nr, this.rnd()*TAU);
      /* young florets take the first colour, old ones the second */
      const tex = "flower:cluster-" + (age < .34 ? "a" : age < .67 ? "m" : "b");
      this.card("flower", tex, q.clone().addScaledVector(up, -s/2), up, nr, s, s, {normal:nr.clone().lerp(UP, .35).normalize(), ao:clamp(this.ao(q) + .25, 0, 1)});
    }
  }

  /* ---------- flower heads ---------- */
  head(type, pos, dir, size, o = {}){
    const F = "flower";
    switch(type){
      case "daisy": {
        const tex = o.tex || "flower:daisy";
        this.fan(F, tex, pos, dir, size/2, o.droop ?? .1);
        if(o.cone) this.ball(F, tex, pos.clone().addScaledVector(dir, size*.06), size*.14, 1.15, {uv:[.5, .5]});
        break;
      }
      case "single": this.fan(F, o.tex || "flower:single", pos, dir, size/2, o.droop ?? -.2, {seg:6}); break;
      case "trumpet":
        this.fan(F, o.tex || "flower:trumpet", pos.clone().addScaledVector(dir, size*.3), dir, size/2, -.55);
        break;
      case "shag":
        this.fan(F, "flower:shag", pos, dir, size/2, .3);
        this.fan(F, "flower:shag", pos.clone().addScaledVector(dir, size*.08), dir, size*.36, -.35);
        break;
      case "spike": this.cross(F, o.tex || "flower:spike", pos, dir, size*(o.wide ?? .36), size, 2, {normal:dir.clone().lerp(UP, .5).normalize()}); break;
      case "plume": this.cross(F, o.tex || "flower:plume", pos, dir, size*(o.wide ?? .5), size, 2, {normal:dir.clone().lerp(UP, .5).normalize()}); break;
      case "wand":  this.cross(F, o.tex || "flower:bells", pos, dir, size*(o.wide ?? .5), size, 2, {normal:UP}); break;
      case "flag":  this.cross(F, "flower:flag", pos.clone().addScaledVector(dir, -size*.45), dir, size, size, 2, {normal:UP}); break;
      case "dome":  this.cross(F, "flower:dome", pos.clone().addScaledVector(dir, -size*.1), dir, size, size*.8, 3, {normal:UP}); break;
      case "flat":
        this.fan(F, o.tex || "flower:umbel", pos, dir, size/2, .42);
        this.fan(F, o.tex || "flower:umbel", pos.clone().addScaledVector(dir, -size*.1), dir, size*.56, .1);
        break;
      case "globe": {
        const c = pos.clone().addScaledVector(dir, size*.5);
        this.cross(F, "flower:globe", pos, dir, size, size, 3, {normal:UP});
        this.fan(F, "flower:globe", c, UP, size/2, 0);
        break;
      }
      case "mop": {
        /* a domed ball of sterile florets: a floret-wrapped core with clusters
           standing proud of it all over, so the outline is petalled. No flat
           profile cards: on a ball they show as a cross. */
        const c = pos.clone().addScaledVector(dir, size*.3), rad = size*.47;
        this.ball(F, o.fine ? "flower:florets-fine" : "flower:florets", c, rad*.86, .82);
        this.florets(c, dir, o.fine ? 22 : 34, ()=>rad*(.95 + .1*this.rnd()), size*(o.fine ? .32 : .38), 1.1, .82);
        break;
      }
      case "panicle": {
        /* A cone of florets in tiers up a stalk, each cluster tipped out like a
           small umbrella. The tip is youngest; the base ages first. */
        const base = pos.clone().addScaledVector(dir, -size*.04), fat = size*(o.fat ?? .3);
        this.spindle(F, "flower:florets", base, dir, fat*.62, size*.9);
        const prof = t=>fat*(.38 + 1.02*Math.sin(Math.PI*Math.pow(t, .6))*(1 - .52*t));
        this.cross(F, "flower:panicle", base.clone().addScaledVector(dir, -size*.03), dir, fat*2.5, size*1.06, 2, {normal:dir.clone().lerp(UP, .5).normalize()});
        this.florets(base, dir, 30, prof, size*.36, 0, 1, size);
        break;
      }
      case "lilac": this.cross(F, "flower:lilac", pos.clone().addScaledVector(dir, -size*.1), dir, size*.55, size, 3, {normal:dir.clone().lerp(UP, .5).normalize()}); break;
      case "peony": {
        const c = pos.clone().addScaledVector(dir, size*.22);
        this.fan(F, "flower:single", pos.clone().addScaledVector(dir, size*.1), dir, size*.6, -.25);
        this.ball(F, "flower:ruffles", c, size*.42, .72);
        break;
      }
      case "berries": this.fan(F, "flower:berries", pos, dir, size/2, .3); break;
      case "button":
        /* a domed cluster of tiny flowers (ninebark): three crossed domes, seen from any side */
        this.cross(F, "flower:dome", pos.clone().addScaledVector(dir, -size*.15), dir, size, size*.75, 3, {normal:dir.clone().lerp(UP, .5).normalize()});
        break;
      case "smoke":
        /* a billow of fine hairs: three crossed puffs, so the haze has depth from any side */
        this.cross(F, "flower:smoke", pos.clone().addScaledVector(dir, -size*.25), dir, size, size, 3, {normal:dir.clone().lerp(UP, .5).normalize()});
        break;
      default: this.cross(F, o.tex || "flower:spike", pos, dir, size*.4, size, 2);
    }
  }

  /* ---------- generators ---------- */
  /* leaves arching out from the crown: hosta, daylily, grass, iris.
     len: leaf length (ft); lift: angle at the base above the ground (rad);
     arch: how far it curls back down over its length (rad) */
  rosette({tex, n, len, lift = 1, arch = 1, width, r0 = .04, jitter = .25, fanned = false, segs = 5, role = "leaf", cup}){
    const r = this.rnd;
    for(let i = 0; i < n; i++){
      const az = fanned ? (i%2 ? 0 : Math.PI) + (r() - .5)*.5 : i*GOLD + r()*.4;
      const L = len*(1 - jitter*r()), e0 = lift*(1 - .25*r()) + (fanned ? 0 : (i/n - .5)*.2), ar = arch*(.8 + .4*r());
      const out = V(Math.cos(az), 0, Math.sin(az)), side = V(-out.z, 0, out.x);
      const start = fanned ? ((i - n/2)/n)*this.W*.3 : 0;
      let q = out.clone().multiplyScalar(r0*(1 + r())).addScaledVector(side, start);
      const pts = [q.clone()];
      for(let s = 1; s <= segs; s++){
        const th = e0 - ar*(s - .5)/segs;
        q = q.clone().addScaledVector(out, Math.cos(th)*L/segs).addScaledVector(UP, Math.sin(th)*L/segs);
        if(q.y < .02) q.y = .02;
        pts.push(q);
      }
      this.ribbon(role, tex, pts, width, side, {cup});
    }
  }
  /* shoots standing in a clump and leaning outward: leafy stems, grass tufts */
  tuft({tex, n, w, h, ring, lean = .5, crossed = false, y = 0}){
    const r = this.rnd;
    for(let i = 0; i < n; i++){
      const az = i*GOLD + r()*.5, d = ring*Math.sqrt((i + .3)/n), tilt = lean*(d/Math.max(.01, ring))*(.6 + .6*r());
      const out = V(Math.cos(az), 0, Math.sin(az));
      const dir = V(out.x*Math.sin(tilt), Math.cos(tilt), out.z*Math.sin(tilt)).normalize();
      const base = out.clone().multiplyScalar(d).setY(y), hh = h*(.75 + .25*r()), ww = w*(.8 + .4*r());
      if(crossed) this.cross("leaf", tex, base, dir, ww, hh, 2);
      else this.card("leaf", tex, base, dir, out.clone().applyAxisAngle(UP, (r() - .5)*1.4), ww, hh);
    }
  }
  /* sprigs covering a dome: cushions, mounds, mats */
  dome({tex, n, size, rx, ry, y0 = 0, cap = 1.45, sink = .5, role = "leaf", lift = .35}){
    const r = this.rnd;
    for(let i = 0; i < n; i++){
      const ph = Math.acos(1 - (i + .5)/n*(1 - Math.cos(cap))), th = i*GOLD + r()*.3;
      const nrm = V(Math.sin(ph)*Math.cos(th), Math.cos(ph), Math.sin(ph)*Math.sin(th));
      const s = size*(.8 + .4*r());
      const dir = nrm.clone().multiplyScalar(1 - lift).addScaledVector(UP, lift).normalize();
      const surf = V(nrm.x*rx, y0 + nrm.y*ry, nrm.z*rx);
      const base = surf.addScaledVector(dir, -s*sink);
      if(base.y < 0) base.y = 0;
      this.card(role, tex, base, dir, V(-nrm.z, .2, nrm.x).applyAxisAngle(nrm, r()*TAU), s, s);
    }
  }
  /* small flowers dotted over a dome */
  dots({n, size, rx, ry, y0 = 0, cap = 1.3, type = "single", tex, droop}){
    const r = this.rnd;
    for(let i = 0; i < n; i++){
      const ph = Math.acos(1 - (i + .5)/n*(1 - Math.cos(cap))), th = .9 + i*GOLD + r()*.5;
      const nrm = V(Math.sin(ph)*Math.cos(th), Math.cos(ph), Math.sin(ph)*Math.sin(th));
      const pos = V(nrm.x*rx*1.02, y0 + nrm.y*ry*1.03 + size*.1, nrm.z*rx*1.02);
      this.head(type, pos, nrm.lerp(UP, .35).normalize(), size*(.8 + .4*r()), {tex, droop});
    }
  }
  /* flowering stems rising from the clump */
  stalks({n, h, ring, spread, thick = .012, bend = .25, leaves, head, heads = 1, nod = 0, role = "stem"}){
    const r = this.rnd, tips = [];
    for(let i = 0; i < n; i++){
      const az = i*GOLD + r()*.6, f = Math.sqrt((i + .4)/n), hh = lerp(h[0], h[1], 1 - f*.6 + (r() - .5)*.3);
      const out = V(Math.cos(az), 0, Math.sin(az));
      const a = out.clone().multiplyScalar(ring*f), b = out.clone().multiplyScalar(spread*f*(.8 + .4*r())).setY(clamp(hh, h[0], h[1]));
      const mid = a.clone().lerp(b, .5).addScaledVector(out, -bend*spread*f*.5).setY(b.y*.55);
      const pts = [];
      for(let k = 0; k <= 4; k++){ const t = k/4; pts.push(V(a.x*(1-t)*(1-t) + mid.x*2*(1-t)*t + b.x*t*t, a.y*(1-t)*(1-t) + mid.y*2*(1-t)*t + b.y*t*t, a.z*(1-t)*(1-t) + mid.z*2*(1-t)*t + b.z*t*t)); }
      this.tube(role, pts, thick, thick*.6, 4);
      const tipDir = V().subVectors(pts[4], pts[3]).normalize();
      if(leaves){
        for(let k = 0; k < leaves.n; k++){
          const t = lerp(leaves.from ?? .15, leaves.to ?? .8, (k + .5)/leaves.n), q = pts[0].clone().lerp(pts[4], t).lerp(mid, 2*t*(1-t)*.6);
          const la = az + (k%2 ? 1 : -1)*1.3 + k*1.1, lo = V(Math.cos(la), .55, Math.sin(la)).normalize();
          this.card("leaf", leaves.tex, q, lo, UP, leaves.size*(1 - t*.35), leaves.size*(1 - t*.35));
        }
      }
      if(head){
        for(let k = 0; k < heads; k++){
          const d = k ? tipDir.clone().applyAxisAngle(UP, k*GOLD).lerp(V(Math.cos(az + k*2.1), .5, Math.sin(az + k*2.1)), .55).normalize() : tipDir.clone().lerp(out, nod).normalize();
          const q = k ? pts[4].clone().addScaledVector(d, head.size*.3).addScaledVector(UP, -head.size*.25*k) : pts[4];
          this.head(head.type, q, head.face === "out" ? d.clone().lerp(out, .5).lerp(UP, .25).normalize() : d, head.size*(.85 + .3*r()), head);
        }
      }
      tips.push(pts[4]);
    }
    return tips;
  }
  /* a sprig of leaves: a card three rows long whose tip bends away from `face`,
     so foliage reads as shoots with a curve to them, not as flat plates */
  sprig(role, tex, base, dir, face, w, h, o = {}){
    const B = this.buf(role, tex), rnd = o.rnd ?? this.rnd();
    let side = V().crossVectors(face, dir);
    if(side.lengthSq() < 1e-6) side = perp(dir);
    side.normalize();
    const fn = V().crossVectors(dir, side).normalize(), bend = o.bend ?? .22, own = o.own ?? .4;
    const i0 = B.count;
    for(let j = 0; j <= 2; j++){
      const v = j/2, c = base.clone().addScaledVector(dir, h*v).addScaledVector(fn, -bend*h*v*v);
      /* the card's own facing, tipping back as it bends */
      const cn = fn.clone().addScaledVector(dir, 2*bend*v).normalize();
      for(const sg of [-1, 1]){
        const q = c.clone().addScaledVector(side, sg*w/2);
        const n = this.nrm(q).multiplyScalar(1 - own).addScaledVector(cn, own).normalize();
        B.vert(q, n, sg < 0 ? 0 : 1, v, rnd, (o.ao ?? this.ao(q)));
      }
    }
    for(let j = 0; j < 2; j++){ const k = i0 + j*2; B.idx.push(k, k+1, k+3, k, k+3, k+2); }
  }
  /* A woody shrub, built the way one grows: stems from the crown, twigs forking
     off them to the edge of the canopy, and leafy shoots along the outer half of
     every twig. Foliage sits at every depth, so the shrub is dense without a
     solid core, and the bare framework is what stands in winter.
     profile(u) is the canopy radius, as a share of the half-spread, at height
     fraction u. */
  bush({profile, foliage, heads, stems = {}, trunk = 0, open = 0, lump = .09}){
    const r = this.rnd, H = this.H, R = this.R, y0 = trunk, ch = Math.max(.3, H - y0);
    /* no shrub is a smooth solid of revolution: the outline swells and dips */
    const l1 = r()*TAU, l2 = r()*TAU, l3 = r()*TAU, lk = 1/(1 + lump*.7);
    const swell = (az, u)=>lk*(1 + lump*(.55*Math.sin(az*2 + l1 + u*3) + .3*Math.sin(az*3 + l2 - u*5) + .25*Math.sin(az*5 + l3 + u*9)));
    const env = (u, az)=>R*profile(clamp(u, 0, 1))*(az == null ? 1 : swell(az, u));
    /* canopy normals and AO are measured from the canopy, not the ground */
    const cm = y0 + ch*.42;
    this.nrm = q=>V(q.x, (q.y - cm)*(R/ch)*.9 + R*.4, q.z).normalize();
    this.ao = q=>{ const u = (q.y - y0)/ch, e = Math.max(.2, env(u)); return clamp(.08 + .78*Math.pow(Math.hypot(q.x, q.z)/e, 1.5) + .2*clamp(u, 0, 1), .1, 1); };
    const wood = trunk ? "wood" : "stem";
    const bez = (a, m, b, n)=>{ const pts = []; for(let k = 0; k <= n; k++){ const t = k/n, i = (1-t)*(1-t), j = 2*(1-t)*t, l = t*t; pts.push(V(a.x*i + m.x*j + b.x*l, a.y*i + m.y*j + b.y*l, a.z*i + m.z*j + b.z*l)); } return pts; };
    const along = (pts, t)=>{ const f = clamp(t, 0, 1)*(pts.length - 1), i = Math.min(pts.length - 2, Math.floor(f)); return pts[i].clone().lerp(pts[i+1], f - i); };

    if(trunk){
      this.tube("wood", [V(0, 0, 0), V(.03, trunk*.5, .02), V(0, trunk + ch*.14, 0)], Math.max(.09, H*.02), Math.max(.07, H*.015), 7);
    }
    /* main stems from the crown (or the top of the trunk) up into the canopy */
    const ns = stems.n ?? clamp(Math.round(5 + R*1.6), 5, 10), sr = stems.thick ?? clamp(H*.011, .012, .06);
    const mains = [];
    for(let i = 0; i < ns; i++){
      const az = i*GOLD + r()*.5, u = lerp(.6, .97, (i + r())/ns), top = polar(az, env(u, az)*lerp(.3, .72, r()), y0 + ch*u);
      const a = polar(az, trunk ? .02 : Math.min(R*.12, .25)*r(), trunk ? y0 : 0);
      const mid = a.clone().lerp(top, .5); mid.x *= .5 + open; mid.z *= .5 + open; mid.y += ch*.12;
      const pts = bez(a, mid, top, 5);
      this.tube(wood, pts, sr, sr*.4, 4);
      mains.push({az, pts, top:top.y});
    }
    /* twigs: one for every patch of canopy, forking off the nearest stem below it */
    /* shoots small enough to read as foliage, and enough of them to close the
       canopy: the count follows the canopy's surface, capped for the GPU */
    const area = Math.PI*R*(R + 1.6*ch), cover = foliage.cover ?? 3, cap = foliage.max ?? 760;
    let fs0 = foliage.size*(foliage.fine ?? .66);
    if(cover*area/(fs0*fs0) > cap) fs0 = Math.sqrt(cover*area/cap);
    const nt = stems.twigs ?? clamp(Math.round(area/(fs0*fs0)/3.2), 22, 110);
    const twigs = [];
    for(let j = 0; j < nt; j++){
      const u = clamp(Math.pow((j + .5)/nt, foliage.low ?? .85), .03, .98), az = j*GOLD + r()*.5;
      const tip = polar(az, env(u, az)*(.84 + .1*r()), y0 + ch*u);
      let best = mains[0], bd = 1e9;
      for(const m of mains){
        let d = Math.abs(((az - m.az)%TAU + TAU + Math.PI)%TAU - Math.PI);
        if(m.top < tip.y*.7) d += 2;
        if(d < bd){ bd = d; best = m; }
      }
      /* leave the stem lower down than the tip, so every twig climbs outward */
      const want = y0 + (tip.y - y0)*lerp(.3, .6, r());
      let t = 0; for(let k = 0; k <= 10; k++){ if(along(best.pts, k/10).y <= want) t = k/10; }
      const from = along(best.pts, Math.max(t, .12));
      const mid = from.clone().lerp(tip, .55); mid.y += ch*.07 + (tip.y - from.y)*.15; mid.x *= .86; mid.z *= .86;
      const pts = bez(from, mid, tip, 3);
      this.tube(wood, pts, sr*.38, sr*.12, 3);
      twigs.push(pts);
    }
    /* leafy shoots along the outer half of each twig, thickest at the tips */
    const n = clamp(Math.round(cover*area/(fs0*fs0)), 90, cap), shell = foliage.shell ?? 3, hang = !!foliage.hang, rise = foliage.rise ?? .3, wild = foliage.wild ?? .55, bend = foliage.bend ?? .2;
    for(let i = 0; i < n; i++){
      const s = fs0*(.75 + .5*r());
      let q, dir, face;
      if(i%5 < shell){
        /* the canopy's skin: shoots laid over the outline like shingles, tips
           lifting off it, so the shrub closes from every side */
        const k = Math.floor(i/5)*shell + i%5, m = Math.ceil(n/5)*shell;
        const u = clamp(Math.pow((k + .5)/m, foliage.low ?? .85), .02, .985), az = k*GOLD + r()*.4;
        q = polar(az, env(u, az)*(.8 + .14*r()), y0 + ch*u);
        const nr = V(Math.cos(az), clamp((u - .4)*1.7, -.25, 1.6), Math.sin(az)).normalize();
        let tu = UP.clone().addScaledVector(nr, -nr.y);
        if(tu.lengthSq() < .02) tu = polar(r()*TAU, 1);
        tu.normalize();
        const sd = V().crossVectors(nr, tu), phi = (hang ? Math.PI : 0) + (r() - .5)*(hang ? 1.2 : 2.4), tilt = .2 + .45*r();
        dir = tu.multiplyScalar(Math.cos(phi)).addScaledVector(sd, Math.sin(phi)).multiplyScalar(Math.cos(tilt)).addScaledVector(nr, Math.sin(tilt))
          .addScaledVector(UP, rise*.6).normalize();
        face = nr.add(V(r() - .5, r() - .5, r() - .5).multiplyScalar(.5));
      } else {
        /* and shoots along the twigs inside it, for depth */
        const pts = twigs[i%nt], t = 1 - .62*Math.pow(r(), 1.6);
        q = along(pts, t);
        const tw = V().subVectors(pts[3], pts[1]).normalize();
        const out = V(q.x, 0, q.z); if(out.lengthSq() < 1e-4) out.set(1, 0, 0); out.normalize();
        dir = tw.multiplyScalar(.55).addScaledVector(out, .45*(1 - rise)).addScaledVector(UP, rise)
          .add(V(r() - .5, r() - .5, r() - .5).multiplyScalar(wild)).normalize();
        face = out.multiplyScalar(.5 + .5*r()).addScaledVector(UP, .35 + .6*r()).add(V(r() - .5, 0, r() - .5).multiplyScalar(.9));
      }
      const base = q.clone().addScaledVector(dir, -s*.4).add(V(r() - .5, r() - .5, r() - .5).multiplyScalar(s*.25));
      if(base.y < .02) base.y = .02;
      this.sprig("leaf", foliage.tex, base, dir, face, s, s, {bend:bend*(.5 + r())});
    }
    if(heads){
      const hn = heads.n, z = heads.zone || [.45, 1];
      for(let i = 0; i < hn; i++){
        const u = lerp(z[0], z[1], Math.pow((i + .5)/hn, .8)), az = 1.3 + i*GOLD + r()*.3, e = env(u, az);
        const up = clamp((u - .3)*1.6, 0, 1) + (heads.up ?? .35);
        const dir = V(Math.cos(az), up, Math.sin(az)).normalize();
        const pos = polar(az, e*(heads.out ?? .96), y0 + ch*u);
        this.head(heads.type, pos, dir, heads.size*(.82 + .36*r()), heads);
      }
    }
  }
  /* A dwarf conifer, built as the full-size tree is: a leader, whorls of limbs
     off it, branchlets off the limbs, and every twig a shoot clothed in
     needles. It is the tree in miniature, only shorter between the whorls and
     far denser. profile(u) is the outline; `rise` the angle of the limbs above
     level at the bottom and at the top (rad); `shoot` the needle-clad twig. */
  whorled({profile, trunk = 0, shoot, rise = [.15, 1.05], leader = true, max = 1700}){
    const r = this.rnd, H = this.H, R = this.R, y0 = trunk, ch = Math.max(.3, H - y0);
    const l1 = r()*TAU, l2 = r()*TAU;
    const env = (u, az)=>R*profile(clamp(u, 0, 1))*(az == null ? 1 : .94 + .06*Math.sin(az*3 + l1 + u*5) + .04*Math.sin(az*5 + l2));
    const cm = y0 + ch*.4;
    this.nrm = q=>V(q.x, (q.y - cm)*(R/ch)*.9 + R*.45, q.z).normalize();
    this.ao = q=>{ const u = (q.y - y0)/ch, e = Math.max(.2, env(u)); return clamp(.1 + .75*Math.pow(Math.hypot(q.x, q.z)/e, 1.4) + .2*clamp(u, 0, 1), .1, 1); };
    /* shoots sized to the plant, and fewer, longer ones on a big plant so the count stays in budget */
    const area = Math.PI*R*(R + 1.6*ch);
    let sl = shoot.len;
    const est = area/(sl*sl*.2);
    if(est > max) sl *= Math.sqrt(est/max);
    const sw = sl*shoot.wide, cards = [];
    const put = (base, dir, k = 1)=>{
      const tip = base.clone().addScaledVector(dir, sl*k), u = (tip.y - y0)/ch;
      if(tip.y < .03 || Math.hypot(tip.x, tip.z) > env(u, Math.atan2(tip.z, tip.x))*1.12 + sl*.2) return;
      cards.push([base, dir, k]);
    };
    if(trunk) this.tube("wood", [V(0, 0, 0), V(.03, trunk*.5, .02), V(0, trunk + ch*.2, 0)], Math.max(.09, H*.02), Math.max(.07, H*.015), 7);
    const top = y0 + ch*(leader ? .93 : .6);
    this.tube(trunk ? "wood" : "stem", [V(0, y0, 0), V(.02, (y0 + top)/2, .02), V(0, top, 0)], clamp(H*.014, .03, .1), .012, 5);
    const nW = clamp(Math.round(ch/(sl*.55)), 5, 18);
    for(let j = 0; j < nW; j++){
      const u = (j + .6)/(nW + .4), el = lerp(rise[0], rise[1], Math.pow(u, 1.3));
      const e0 = env(u), nb = clamp(Math.round(5 + e0*2.6 + (r() - .5)), 5, 13);
      for(let k = 0; k < nb; k++){
        const az = k/nb*TAU + j*GOLD + (r() - .5)*.5, out = polar(az, 1), side = V(-out.z, 0, out.x);
        /* the limb ends on the outline and leaves the leader lower down, at its angle */
        const reach = env(u, az)*(.86 + .12*r()), yt = y0 + ch*u;
        const ys = clamp(yt - reach*Math.tan(el), y0 + .02, Math.max(y0 + .03, top));
        const a = V(0, ys, 0), b = polar(az, reach, yt);
        const mid = a.clone().lerp(b, .55); mid.y -= (yt - ys)*.12 + reach*.05;       // a slight sag, tip lifting
        const pts = [];
        for(let i = 0; i <= 5; i++){ const t = i/5, m = 1 - t; pts.push(V(a.x*m*m + mid.x*2*m*t + b.x*t*t, a.y*m*m + mid.y*2*m*t + b.y*t*t, a.z*m*m + mid.z*2*m*t + b.z*t*t)); }
        const L = a.distanceTo(b);
        this.tube("stem", pts, clamp(L*.02, .012, .05), .008, 3);
        const at = t=>{ const f = clamp(t, 0, 1)*5, i = Math.min(4, Math.floor(f)); return [pts[i].clone().lerp(pts[i+1], f - i), V().subVectors(pts[i+1], pts[i]).normalize()]; };
        /* shoots clothe the outer limb, overlapping; branchlets leave it left and right */
        const n = Math.max(2, Math.round(L*.72/(sl*.4)));
        for(let q = 0; q < n; q++){
          const t = .3 + .7*(q + .5)/n, [pos, along] = at(t);
          put(pos, along.clone().add(V(r() - .5, r() - .5, r() - .5).multiplyScalar(.2)).normalize(), .85 + .3*r());
          /* and one standing up off the limb, so its back is clothed too */
          put(pos, along.clone().multiplyScalar(.5).addScaledVector(UP, .85).addScaledVector(side, (r() - .5)*.7).normalize(), .75 + .3*r());
          if(q%2 === 0 || t > .7){
            const sg = (q>>1)%2 ? 1 : -1;
            for(const s2 of t > .55 ? [sg, -sg] : [sg]){
              const d2 = along.clone().multiplyScalar(.6).addScaledVector(side, s2*(.7 + .3*r())).addScaledVector(UP, shoot.lift ?? .25).add(V(r() - .5, r() - .5, r() - .5).multiplyScalar(.25)).normalize();
              put(pos, d2, .8 + .35*r());
              /* a branchlet forks once more where there is room */
              if(t < .8 && r() < .7) put(pos.clone().addScaledVector(d2, sl*.6), d2.clone().multiplyScalar(.7).addScaledVector(along, .5).addScaledVector(UP, (shoot.lift ?? .25) + .2).normalize(), .7 + .3*r());
            }
          }
        }
        const tipDir = at(1)[1], tipAt = b.clone().addScaledVector(out, -sl*.35);
        put(tipAt, tipDir.clone().lerp(UP, shoot.tipUp ?? .25).normalize(), 1);
        /* the limb's end is a rosette of shoots, so it reads from straight on as well as from the side */
        const upP = V().crossVectors(side, tipDir).normalize(), t0 = r()*TAU;
        for(let i = 0; i < 4; i++){
          const th = t0 + i*TAU/4;
          put(tipAt, tipDir.clone().multiplyScalar(.5).addScaledVector(side, Math.cos(th)*.85).addScaledVector(upP, Math.sin(th)*.85).addScaledVector(UP, (shoot.lift ?? .25)*.6).normalize(), .8 + .3*r());
        }
      }
    }
    /* the leader's own shoots: the tree's top */
    if(leader) for(let i = 0; i < 7; i++){ const a = i*GOLD; put(V(0, top - sl*.2 - i*sl*.22, 0), V(Math.cos(a)*.6, i ? .55 : 2, Math.sin(a)*.6).normalize(), .9); }
    for(const [base, dir, k] of cards) this.cross("leaf", shoot.tex, base, dir, sw*k, sl*k, 2, {normal:this.nrm(base).lerp(dir, .35).normalize()});
  }
  /* A shrub of canes: long stems from the base, upright in the middle and
     arching outward at the edge, each with a few side shoots near its end and
     small leaves all the way along. The canes show through the leaves, and
     their tips make a feathered outline: ninebark. */
  wands({n, foliage, heads, thick, arch = .55}){
    const r = this.rnd, H = this.H, R = this.R, sr = thick ?? clamp(H*.006, .012, .035);
    this.nrm = q=>V(q.x, (q.y - H*.45)*(R/H)*.9 + R*.4, q.z).normalize();
    this.ao = q=>clamp(.18 + .6*Math.hypot(q.x, q.z)/Math.max(.2, R) + .3*q.y/H, .12, 1);
    const fs = foliage.size, tips = [];
    const leafy = (pts, from, k)=>{
      /* leaves set alternately along the cane, pointing on toward its tip */
      const len = pts.reduce((s, q, i)=>i ? s + q.distanceTo(pts[i-1]) : 0, 0), m = Math.max(2, Math.round(len*(1 - from)/(fs*.3)));
      for(let i = 0; i < m; i++){
        const t = from + (1 - from)*(i + .5)/m, f = t*(pts.length - 1), j = Math.min(pts.length - 2, Math.floor(f));
        const q = pts[j].clone().lerp(pts[j+1], f - j), along = V().subVectors(pts[j+1], pts[j]).normalize();
        const sd = perp(along).applyAxisAngle(along, i*GOLD), s = fs*k*(.75 + .5*r())*(1 - .25*t);
        const dir = along.clone().multiplyScalar(.75).addScaledVector(sd, .65).addScaledVector(UP, .15).normalize();
        this.sprig("leaf", foliage.tex, q.clone().addScaledVector(dir, -s*.15), dir, sd.clone().lerp(UP, .5), s, s, {bend:.25*r(), own:.5});
      }
    };
    for(let i = 0; i < n; i++){
      const az = i*GOLD + r()*.5, f = Math.sqrt((i + .5)/n), out = polar(az, 1);
      /* inner canes stand, outer ones lean and arch over */
      const top = H*(1 - .36*f*f)*(.88 + .12*r()), reach = R*f*(.98 + .1*r());
      const a = polar(az, R*.12*f*r()), b = out.clone().multiplyScalar(reach).setY(top*(1 - arch*.3*f));
      const mid = out.clone().multiplyScalar(reach*(.3 + .2*f)).setY(top*(.72 + .2*f*arch));
      const pts = [];
      for(let k = 0; k <= 7; k++){ const t = k/7, m = 1 - t; pts.push(V(a.x*m*m + mid.x*2*m*t + b.x*t*t, Math.max(.02, a.y*m*m + mid.y*2*m*t + b.y*t*t), a.z*m*m + mid.z*2*m*t + b.z*t*t)); }
      this.tube("stem", pts, sr, sr*.3, 4);
      leafy(pts, .2 + .15*r(), 1);
      tips.push(pts[7]);
      /* side shoots off the upper cane, climbing */
      const ns = 2 + Math.floor(r()*3);
      for(let k = 0; k < ns; k++){
        const t = .45 + .45*(k + r()*.6)/ns, j = Math.min(6, Math.floor(t*7)), q = pts[j].clone().lerp(pts[j+1], t*7 - j);
        const along = V().subVectors(pts[j+1], pts[j]).normalize(), sd = perp(along).applyAxisAngle(along, r()*TAU);
        const L = H*(.1 + .12*r()), d = along.clone().multiplyScalar(.55).addScaledVector(sd, .6).addScaledVector(UP, .55).normalize();
        const e = q.clone().addScaledVector(d, L), sp = [q, q.clone().lerp(e, .5).addScaledVector(UP, L*.06), e];
        this.tube("stem", sp, sr*.45, sr*.15, 3);
        leafy(sp, .1, .9);
        tips.push(e);
      }
    }
    if(heads){
      /* flower buttons sit along the upper canes and at their ends */
      const hn = Math.min(heads.n, tips.length);
      for(let i = 0; i < hn; i++){
        const q = tips[Math.floor(i*tips.length/hn)], out = V(q.x, 0, q.z).normalize();
        this.head(heads.type, q.clone().addScaledVector(out, -heads.size*.3).addScaledVector(UP, -heads.size*.15), out.lerp(UP, .6).normalize(), heads.size*(.8 + .4*r()), heads);
      }
    }
  }
  /* A hydrangea, built stem by stem. Every flower head ends a shoot of its own,
     and under it the shoot carries big leaves in opposite pairs, each pair
     turned a quarter round from the last. Leafy shoots without a head fill
     the rest of the canopy. The leaves are single leaves, not sprigs: at this
     size they are what the eye reads.
     head: {type, size, n, …} as for head();  leaf: length of a leaf in feet */
  hydrangea({profile, trunk = 0, head, leaf, nod = 0, lump = .08}){
    const r = this.rnd, H = this.H, R = this.R, y0 = trunk, ch = Math.max(.3, H - y0);
    const l1 = r()*TAU, l2 = r()*TAU, lk = 1/(1 + lump*.7);
    const env = (u, az)=>R*profile(clamp(u, 0, 1))*(az == null ? 1 : lk*(1 + lump*(.6*Math.sin(az*2 + l1 + u*3) + .4*Math.sin(az*3 + l2 - u*5))));
    const cm = y0 + ch*.42;
    this.nrm = q=>V(q.x, (q.y - cm)*(R/ch)*.9 + R*.4, q.z).normalize();
    this.ao = q=>{ const u = (q.y - y0)/ch, e = Math.max(.2, env(u)); return clamp(.1 + .76*Math.pow(Math.hypot(q.x, q.z)/e, 1.5) + .2*clamp(u, 0, 1), .1, 1); };
    const wood = trunk ? "wood" : "stem", sr = clamp(H*.009, .014, .05);
    const bez = (a, m, b, n)=>{ const pts = []; for(let k = 0; k <= n; k++){ const t = k/n, i = (1-t)*(1-t), j = 2*(1-t)*t, l = t*t; pts.push(V(a.x*i + m.x*j + b.x*l, a.y*i + m.y*j + b.y*l, a.z*i + m.z*j + b.z*l)); } return pts; };
    if(trunk) this.tube("wood", [V(0, 0, 0), V(.03, trunk*.5, .02), V(0, trunk + ch*.14, 0)], Math.max(.09, H*.02), Math.max(.07, H*.015), 7);
    /* the framework: stems from the crown that the shoots fork from */
    const ns = clamp(Math.round(6 + R*1.6), 6, 11), mains = [];
    for(let i = 0; i < ns; i++){
      const az = i*GOLD + r()*.5, u = lerp(.45, .8, r()), top = polar(az, env(u, az)*lerp(.3, .6, r()), y0 + ch*u);
      const a = polar(az, trunk ? .02 : Math.min(R*.14, .3)*r(), trunk ? y0 : 0), mid = a.clone().lerp(top, .5);
      mid.x *= .55; mid.z *= .55; mid.y += ch*.1;
      const pts = bez(a, mid, top, 5);
      this.tube(wood, pts, sr*1.25, sr*.6, 4);
      mains.push({az, pts});
    }
    const LL = leaf, LW = LL*.6;
    /* one leaf: a stalk, then a blade that lifts, arches and droops at the tip */
    const blade = (at, out, k)=>{
      const L = LL*k*(.8 + .35*r()), side = V().crossVectors(out, UP);
      if(side.lengthSq() < 1e-4) side.set(1, 0, 0);
      side.normalize();
      const lift = .35 + .3*r(), p0 = at.clone(), p1 = at.clone().addScaledVector(out, L*.5).addScaledVector(UP, L*.5*lift),
            p2 = at.clone().addScaledVector(out, L*.98).addScaledVector(UP, L*(lift*.5 - .12 - .2*r()));
      if(p2.y < .03) p2.y = .03;
      this.ribbon("leaf", "leaf:hydrangea", [p0, p1, p2], LW*k*(L/(LL*k)), side.applyAxisAngle(out, (r() - .5)*.7), {cup:.3});
    };
    /* a shoot from the framework to `tip`, ending along `dir`, with `pairs` pairs of leaves below its end */
    const shoot = (tip, dir, pairs, thick)=>{
      const az = Math.atan2(tip.z, tip.x);
      let best = mains[0], bd = 9;
      for(const m of mains){ const d = Math.abs(((az - m.az)%TAU + TAU + Math.PI)%TAU - Math.PI); if(d < bd){ bd = d; best = m; } }
      const want = y0 + (tip.y - y0)*lerp(.25, .5, r());
      let f = best.pts[1]; for(const q of best.pts) if(q.y <= want) f = q;
      const back = tip.clone().addScaledVector(dir, -Math.max(LL*1.4, tip.distanceTo(f)*.45));
      const pts = bez(f, back.lerp(f, .15), tip, 5);
      this.tube(wood, pts, thick, thick*.55, 3);
      const axis = V().subVectors(pts[5], pts[4]).normalize(), a = perp(axis), b = V().crossVectors(axis, a), t0 = r()*TAU;
      for(let j = 0; j < pairs; j++){
        /* nodes crowd toward the end of the shoot */
        const d = LL*(.22 + .5*j + .1*r()), len = tip.distanceTo(f), t = clamp(1 - d/Math.max(d + .01, len), .15, 1);
        const g = t*5, i0 = Math.min(4, Math.floor(g)), at = pts[i0].clone().lerp(pts[i0+1], g - i0), th = t0 + j*Math.PI/2;
        for(const sg of [1, -1]){
          const out = a.clone().multiplyScalar(Math.cos(th)*sg).addScaledVector(b, Math.sin(th)*sg).addScaledVector(axis, .35).normalize();
          blade(at, out, j ? 1 : .8);
        }
      }
    };
    /* flowering shoots: a head for every patch of the upper canopy */
    const hn = head ? head.n : 0, z = head?.zone || [.3, 1];
    for(let i = 0; i < hn; i++){
      const u = lerp(z[0], z[1], Math.pow((i + .5)/hn, .8)), az = 1.3 + i*GOLD + r()*.3, hs = head.size*(.82 + .36*r());
      const out = polar(az, 1), up = clamp((u - .25)*1.7, .1, 1.4) + .3 - nod;
      const dir = V(out.x, up, out.z).normalize();
      const tip = polar(az, env(u, az)*.92, y0 + ch*u).addScaledVector(dir, -hs*.55);
      shoot(tip, dir, 4, sr*.7);
      /* heavy heads bow the end of the stem */
      const hd = nod ? dir.clone().lerp(V(out.x, -.15, out.z).normalize(), nod*r()).normalize() : dir;
      this.head(head.type, tip, hd, hs, head);
    }
    /* leafy shoots: enough to close the canopy, more low down where there are no heads */
    const area = Math.PI*R*(R + 1.6*ch), want = clamp(Math.round(3*area/(LL*LW)), 160, 1000);
    const nv = Math.max(8, Math.round((want - hn*6)/7));
    for(let i = 0; i < nv; i++){
      const u = clamp(Math.pow((i + .5)/nv, 1.25), .03, .97), az = i*GOLD + r()*.5, out = polar(az, 1);
      const dir = V(out.x, clamp((u - .3)*1.5, -.1, 1.2) + .25, out.z).normalize();
      const tip = polar(az, env(u, az)*(i%3 ? .7 + .22*r() : .35 + .3*r()), Math.max(.15, y0 + ch*u));
      shoot(tip, dir, 3, sr*.35);
      /* the growing end: a last, smaller pair */
      const sd = perp(dir).applyAxisAngle(dir, r()*TAU);
      for(const sg of [1, -1]) blade(tip, dir.clone().multiplyScalar(.7).addScaledVector(sd, sg*.7).normalize(), .6);
    }
  }
  /* long canes arching up and over: weigela, bridalwreath, sumac */
  canes({n, foliage, heads, thick, droop = .5, reach = 1, fork = false, tips}){
    const r = this.rnd, H = this.H, R = this.R, sr = thick ?? clamp(H*.012, .012, .07);
    for(let i = 0; i < n; i++){
      const az = i*GOLD + r()*.5, f = .3 + .7*Math.sqrt((i + .5)/n), out = V(Math.cos(az), 0, Math.sin(az));
      const top = H*(1 - .3*f*droop)*(tips ? .62 + .38*r() : .86 + .14*r()), end = out.clone().multiplyScalar(R*f*reach).setY(top*(1 - droop*.55*f));
      const mid = out.clone().multiplyScalar(R*f*.45).setY(top*1.08);
      const P0 = out.clone().multiplyScalar(R*.06*r()), pts = [];
      for(let k = 0; k <= 6; k++){ const t = k/6; pts.push(V(P0.x*(1-t)*(1-t) + mid.x*2*(1-t)*t + end.x*t*t, P0.y*(1-t)*(1-t) + mid.y*2*(1-t)*t + end.y*t*t, P0.z*(1-t)*(1-t) + mid.z*2*(1-t)*t + end.z*t*t)); }
      this.tube("stem", pts, sr, sr*.3, 4);
      const side = V(-out.z, 0, out.x);
      if(tips){
        /* a whorl of big compound leaves at the end of each cane */
        for(const at of fork ? [6, 5, 4, 3] : [6]){
          const c = pts[at], k0 = r()*TAU;
          for(let k = 0; k < tips.n; k++){
            const la = k0 + k/tips.n*TAU + r()*.4, lo = V(Math.cos(la), .28 - .5*r(), Math.sin(la)).normalize();
            const s = tips.size*(.75 + .4*r())*(.55 + .075*at);
            this.card("leaf", foliage.tex, c, lo, UP, s*.7, s);
          }
        }
        continue;
      }
      for(let k = 0; k < foliage.n; k++){
        const t = lerp(.22, 1, (k + .5)/foliage.n), j = Math.min(5, Math.floor(t*6)), q = pts[j].clone().lerp(pts[j+1], t*6 - j);
        const sgn = k%2 ? 1 : -1, s = foliage.size*(.8 + .4*r());
        const dir = side.clone().multiplyScalar(sgn).addScaledVector(UP, .55).addScaledVector(out, .3).normalize();
        this.card("leaf", foliage.tex, q, dir, UP, s, s);
        if(heads && k%heads.every === 0){
          const hd = UP.clone().multiplyScalar(.8).addScaledVector(side, sgn*.5).normalize();
          this.head(heads.type, q.clone().addScaledVector(hd, heads.size*.4), hd, heads.size*(.8 + .4*r()), heads);
        }
      }
    }
  }
}

/* ---------- canopy outlines for bush() ---------- */
const P_ROUND  = u=>Math.pow(Math.sin(Math.PI*Math.pow(u, .78)), .55);
const P_MOUND  = u=>Math.pow(Math.sin(Math.PI*Math.pow(u, .5)), .5);
const P_OVAL   = u=>.92*Math.pow(Math.sin(Math.PI*Math.pow(u, .85)), .45);
const P_VASE   = u=>(.56 + .44*Math.sin(Math.PI/2*Math.min(1, u/.62)))*(u > .62 ? Math.sqrt(Math.max(.02, 1 - .9*Math.pow((u - .62)/.38, 2))) : 1);
const P_COLUMN = u=>Math.pow(Math.sin(Math.PI*Math.pow(u, .62)), .22)*(1 - .25*u);
const P_BALL   = u=>Math.sqrt(Math.max(0, 1 - Math.pow(2*u - 1, 2)));
const P_FOUNTAIN = u=>.32 + .68*Math.pow(Math.sin(Math.PI*Math.pow(clamp(u, 0, 1), 1.15)*.96), .6);
const P_WEEP   = u=>.5 + .5*Math.pow(Math.sin(Math.PI*Math.pow(clamp(u, 0, 1), .8)*.97), .5);

const P_FLAT   = u=>Math.pow(Math.sin(Math.PI*Math.pow(u, .55)*.9), .4)*(u > .94 ? 1 - (u - .94)*6 : 1);
const P_CONE   = u=>Math.pow(1 - u, .78)*(.55 + .45*Math.min(1, u*9));
const P_SPIRE  = u=>Math.pow(1 - u, .85)*(.6 + .4*Math.min(1, u*7))*.98 + .02;
const P_SPREAD = u=>(.42 + .58*Math.pow(clamp(u, 0, 1), .55))*(u > .82 ? Math.sqrt(Math.max(0, 1 - Math.pow((u - .82)/.18, 2))) : 1);

/* ---------- the growth forms ---------- */
const count = (v, lo, hi)=>clamp(Math.round(v), lo, hi);
export const MODELS = {
  /* ----- perennials ----- */
  coneflower: {label:"Coneflowers & daisies", symbol:"star",
    build(P, p, o){
      const H = P.H, R = P.R, fs = o.flowerSize ?? clamp(.12*H + .12, .2, .42);
      P.tuft({tex:"leaf:lance", n:count(8 + R*8, 8, 18), w:H*.42, h:H*.52, ring:R*.62, lean:.9});
      P.stalks({n:count(5 + R*R*14, 6, 20), h:[H*.72, H], ring:R*.3, spread:R*.86, thick:.014,
        leaves:{tex:"leaf:lance", n:2, size:H*.3}, head:{type:"daisy", size:fs, droop:o.droop ?? .1, cone:(o.droop ?? .1) > .25, tex:o.tex, face:"out"}});
    }},
  hosta: {label:"Hostas & bold foliage", symbol:"lobed",
    build(P, p, o){
      const H = P.H, R = P.R, mh = o.mound ?? .62, tex = o.leafTex || ("leaf:hosta" + (o.variegation ? "+"+o.variegation : ""));
      const k = o.leaf ?? 1, L = R*1.08;
      const tall = clamp(H*mh/(L*.62), .8, 1.2);            // stretch the leaves toward the mound height
      P.rosette({tex, n:count(12 + R*4, 12, 22), len:L*1.12*tall, lift:1.15, arch:1.75, width:L*.62*k, jitter:.12, cup:.22});
      P.rosette({tex, n:count(10 + R*3, 10, 18), len:L*.95*tall, lift:1.35, arch:1.7, width:L*.58*k, jitter:.15, cup:.22});
      P.rosette({tex, n:9, len:L*.72*tall, lift:1.5, arch:1.5, width:L*.48*k, cup:.22});
      const wl = H*(1 - mh)*.9;
      if(p.flower != null) P.stalks({n:count(2 + R*1.5, 2, 6), h:[H - wl*1.25, H - wl*.85], ring:R*.1, spread:R*.4, thick:.012,
        head:{type:o.head || "wand", size:wl, tex:o.headTex, wide:.5}});
    }},
  spikes: {label:"Spikes", symbol:"star",
    build(P, p, o){
      const H = P.H, R = P.R, loose = o.density === "loose";
      const ltex = o.leafTex || (loose ? "leaf:small" : "leaf:lance");
      if(loose) P.dome({tex:ltex, n:count(26 + R*R*16, 26, 70), size:H*.5, rx:R*.9, ry:H*.62});
      else P.tuft({tex:ltex, n:count(9 + R*10, 9, 20), w:H*.4, h:H*.6, ring:R*.6, lean:.7, crossed:true});
      const ss = o.spike ?? (loose ? H*.34 : H*.44);
      P.stalks({n:count((loose ? 14 : 8) + R*R*(loose ? 26 : 16), 8, 60), h:[H*.5, H - ss*.6], ring:R*.4, spread:R*(loose ? 1 : .8), thick:.01,
        leaves:loose ? null : {tex:ltex, n:2, size:H*.26}, head:{type:"spike", size:ss, tex:loose ? "flower:spike-loose" : "flower:spike", wide:loose ? .42 : .34}});
    }},
  daylily: {label:"Daylilies", symbol:"spray",
    build(P, p, o){
      const H = P.H, R = P.R, fh = o.foliage ?? .62;
      P.tuft({tex:"leaf:blades-arch", n:count(6 + R*4, 6, 12), w:R*1.7, h:H*fh*.95, ring:R*.25, lean:.4, crossed:true});
      P.rosette({tex:"leaf:strap", n:count(34 + R*14, 34, 64), len:Math.hypot(R, H*fh)*1.12, lift:1.3, arch:1.2, width:.11 + R*.05, jitter:.3, segs:6});
      P.stalks({n:count(4 + R*4, 4, 10), h:[H*.8, H], ring:R*.15, spread:R*.7, thick:.012,
        head:{type:"trumpet", size:o.flowerSize ?? .36, tex:"flower:trumpet", face:"out"}, heads:2});
    }},
  tallclump: {label:"Tall clumps", symbol:"scallop",
    build(P, p, o){
      const H = P.H, R = P.R, head = o.head || "dome";
      const sizes = {shag:.28, dome:.5, flat:.5, trumpet:.42, plume:.85};
      const hs = (o.headSize ?? sizes[head])*clamp(H/3, .7, 1.3);
      const type = head === "trumpet" ? "trumpet" : head;
      P.stalks({n:count(7 + R*R*10, 7, 20), h:[H*.74, H - (head === "plume" ? hs*.4 : hs*.2)], ring:R*.45, spread:R*.82, thick:.018,
        leaves:{tex:o.leafTex || "leaf:lance", n:count(H*2.2, 4, 8), size:clamp(H*.2, .32, .7), from:.12, to:.92},
        head:{type, size:hs, tex:head === "plume" ? "flower:plume-arch" : head === "trumpet" ? "flower:lily" : o.headTex, face:head === "trumpet" ? "out" : undefined},
        heads:head === "trumpet" ? 3 : 1});
    }},
  allium: {label:"Globes on stalks", symbol:"spray",
    build(P, p, o){
      const H = P.H, R = P.R;
      if(o.leafTex) P.dome({tex:o.leafTex, n:count(18 + R*R*20, 18, 44), size:H*.34, rx:R*.9, ry:H*.42});
      else {
        P.tuft({tex:"leaf:blades-arch", n:count(6 + R*4, 6, 10), w:R*1.6, h:H*.5, ring:R*.25, lean:.4, crossed:true});
        P.rosette({tex:"leaf:strap", n:count(26 + R*10, 26, 44), len:Math.hypot(R, H*.45), lift:1.2, arch:1.15, width:.08 + R*.03, jitter:.3});
      }
      P.stalks({n:count(6 + R*R*14, 6, 22), h:[H*.72, H*.95], ring:R*.25, spread:R*.78, thick:.011, nod:o.nod ?? 0,
        head:{type:o.head || "globe", size:o.headSize ?? clamp(H*.11, .16, .3)}});
    }},
  peony: {label:"Peonies & bushy perennials", symbol:"scallop",
    build(P, p, o){
      const H = P.H, R = P.R, head = o.head || "peony";
      const hs = o.headSize ?? (head === "peony" ? clamp(H*.17, .38, .6) : head === "spike" ? H*.36 : .3);
      P.bush({profile:P_ROUND,         foliage:{tex:o.leafTex || "leaf:peony", size:clamp(H*.36, .6, 1.2), fine:1, cover:1.5, max:170, shell:4, bend:.35},
        stems:{n:8, thick:.02},
        heads:{type:head, n:count((head === "peony" ? 6 : 9) + R*R*(head === "peony" ? 3 : 5), 6, 22), size:hs, zone:head === "peony" ? [.5, 1] : [.6, 1], up:head === "spike" ? .9 : .5, out:head === "spike" ? .7 : 1.02}});
    }},
  astilbe: {label:"Astilbes & ferns", symbol:"fern",
    build(P, p, o){
      const H = P.H, R = P.R, fern = o.plumes === false, fh = fern ? 1 : .55;
      if(fern){
        const L = Math.hypot(R, H)*1.04;
        P.rosette({tex:"leaf:fern", n:count(14 + R*4, 14, 22), len:L, lift:1.3, arch:.8, width:L*.3, jitter:.15, cup:.1});
        P.rosette({tex:"leaf:fern", n:8, len:L*.8, lift:1.48, arch:.5, width:L*.26, cup:.1});
      }
      else {
        P.dome({tex:"leaf:ferny", n:count(14 + R*R*10, 14, 30), size:clamp(H*.45, .4, .9), rx:R*.5, ry:H*fh*.6, lift:.7});
        P.dome({tex:"leaf:ferny", n:count(40 + R*R*36, 40, 110), size:clamp(H*.5, .4, 1), rx:R*.9, ry:H*fh});
        P.stalks({n:count(5 + R*R*9, 5, 16), h:[H*.6, H*.72], ring:R*.25, spread:R*.6, thick:.01,
          head:{type:"plume", size:H*.42, tex:o.arching ? "flower:plume-arch" : "flower:plume", wide:.42}});
      }
    }},
  heuchera: {label:"Ruffled mounds", symbol:"lobed",
    build(P, p, o){
      const H = P.H, R = P.R, mh = o.mound ?? .5, wand = o.wand || "bells";
      const tex = o.leafTex || ("leaf:round" + (o.silver ? "+silver" : ""));
      P.dome({tex, n:count(26 + R*R*24, 26, 70), size:clamp(R*.7, .28, .8), rx:R*.82, ry:H*mh*.9, sink:.62, lift:.55});
      const wl = H*(1 - mh)*(wand === "bells" ? .85 : .9);
      if(p.flower != null) P.stalks({n:count((wand === "bells" ? 4 : 5) + R*R*7, 4, 12), h:[H - wl*1.3, H - wl*.9], ring:R*.25, spread:R*(wand === "hearts" ? .5 : .6), thick:.007,
        head:{type:"wand", size:wl, tex:"flower:"+wand, wide:wand === "bells" ? .3 : wand === "hearts" ? 1.1 : .75}});
    }},
  cushion: {label:"Cushions", symbol:"scallop",
    build(P, p, o){
      const H = P.H, R = P.R, fs = o.flowerSize ?? clamp(R*.2, .1, .2);
      P.dome({tex:o.leafTex || "leaf:small", n:count(20 + R*R*16, 20, 50), size:clamp(H*.5, .3, .8), rx:R*.55, ry:H*.55, lift:.7});
      P.dome({tex:o.leafTex || "leaf:small", n:count(50 + R*R*50, 50, 170), size:clamp(H*.42, .26, .7), rx:R*.9, ry:H*.86});
      P.dots({n:count(20 + R*R*(o.sparse ? 14 : 34), 18, 110), size:fs, rx:R*.92, ry:H*.9, type:o.flower === "daisy" ? "daisy" : "single", tex:o.flowerTex, droop:o.flower === "daisy" ? .05 : -.15});
    }},
  mat: {label:"Groundcover mats", symbol:"mat",
    build(P, p, o){
      const H = Math.max(.12, P.H), R = P.R, r = P.rnd, tex = o.leafTex || "leaf:carpet";
      /* overlapping pads lying almost flat */
      const n = count(10 + R*R*16, 10, 46);
      for(let i = 0; i < n; i++){
        const az = i*GOLD, d = R*.82*Math.sqrt((i + .5)/n), s = clamp(R*.75, .35, 1.1)*(.8 + .4*r());
        const c = polar(az, d, H*(.35 + .5*(1 - d/R)) );
        const dir = V(Math.cos(az + 1.6), .12, Math.sin(az + 1.6)).normalize();
        P.card("leaf", tex, c.clone().addScaledVector(dir, -s/2), dir, UP.clone().applyAxisAngle(dir, (r() - .5)*.5), s, s, {normal:UP, ao:.55 + .45*r()});
      }
      if(o.spikes) P.stalks({n:count(R*R*14, 6, 30), h:[H*1.3, H*2.2], ring:R*.8, spread:R*.85, thick:.006, head:{type:"spike", size:H*1.6, wide:.4}});
      else if(p.flower != null) P.dots({n:count(R*R*(o.sparse ? 12 : 30), 8, 90), size:o.flowerSize ?? .1, rx:R*.88, ry:H*.75, y0:H*.2, cap:1.5, tex:o.flowerTex});
    }},
  grass: {label:"Upright grasses", symbol:"spray",
    build(P, p, o){
      const H = P.H, R = P.R, fh = o.foliage ?? .68, tex = "leaf:blades" + (o.stripe ? "+stripe" : "");
      P.tuft({tex, n:count(8 + R*6, 8, 16), w:R*1.5, h:H*fh*1.08, ring:R*.4, lean:.3, crossed:true});
      P.rosette({tex:"leaf:strap", n:count(16 + R*8, 16, 30), len:H*fh, lift:1.42, arch:.55, width:.07 + R*.02, jitter:.3});
      if(p.flower != null) P.stalks({n:count(10 + R*R*16, 10, 30), h:[H*.74, H*.82], ring:R*.3, spread:R*.62, thick:.008,
        head:{type:"plume", size:H*(o.plume ?? .3), tex:"flower:plume", wide:o.plumeWide ?? .22}});
    }},
  fountain: {label:"Fountain grasses", symbol:"spray",
    build(P, p, o){
      const H = P.H, R = P.R, fh = o.foliage ?? (p.flower != null ? .72 : 1), stripe = o.stripe ? "+stripe" : "";
      const L = Math.hypot(R, H*fh)*1.08;
      P.tuft({tex:(o.tuftTex || "leaf:blades-arch")+stripe, n:count(8 + R*5, 8, 16), w:R*(o.tuftTex ? 1.3 : 2.1), h:H*fh*(o.tuftTex ? 1.05 : 1.5), ring:R*.3, lean:H > 3 ? .3 : .45, crossed:true});
      P.rosette({tex:"leaf:strap"+stripe, n:count(30 + R*12, 30, 60), len:L, lift:H > 3 ? 1.4 : 1.25, arch:H > 3 ? .95 : 1.35, width:.07 + R*.03, jitter:.35, segs:6});
      if(p.flower != null) P.stalks({n:count(8 + R*R*8, 8, 26), h:[H*.82, H*.96], ring:R*.25, spread:R*.75, thick:.008,
        head:{type:"plume", size:H*(o.plume ?? .26), tex:"flower:plume-arch", wide:.34}});
    }},
  iris: {label:"Irises", symbol:"spray",
    build(P, p, o){
      const H = P.H, R = P.R, fh = o.foliage ?? .78;
      for(let f = 0; f < count(3 + R*3, 3, 7); f++){
        P.rosette({tex:"leaf:sword", n:9, len:H*fh, lift:1.5, arch:.16, width:.17 + R*.05, jitter:.3, r0:R*.5*Math.sqrt(f/6), fanned:true});
      }
      P.rosette({tex:"leaf:sword", n:count(18 + R*12, 18, 36), len:H*fh, lift:1.36, arch:.4, width:.16 + R*.04, jitter:.3});
      P.stalks({n:count(4 + R*4, 4, 10), h:[H*.82, H*.96], ring:R*.2, spread:R*.55, thick:.014, head:{type:"flag", size:o.flowerSize ?? .42}});
    }},

  /* ----- shrubs ----- */
  panicle: {label:"Panicle hydrangeas", symbol:"cloud",
    build(P, p, o){
      const H = P.H, R = P.R, trunk = o.trunk || 0, ch = H - trunk;
      const hs = o.bloom ?? clamp(.17*ch + .4, .62, 1.2);
      P.hydrangea({profile:trunk ? P_BALL : P_ROUND, trunk, leaf:clamp(ch*.095, .38, .6),
        head:{type:"panicle", n:count((o.dense ? 9 : 6) + R*R*(o.dense ? 3.6 : 2.6), 7, 46), size:hs, zone:[.32, 1], fat:o.fat}});
    }},
  mophead: {label:"Mophead hydrangeas", symbol:"cloud",
    build(P, p, o){
      const H = P.H, R = P.R, hs = o.bloom ?? clamp(.13*H + .36, .5, 1.05);
      P.hydrangea({profile:P_MOUND, leaf:clamp(H*.11, .38, .62), nod:o.fine ? 0 : .5,
        head:{type:"mop", n:count(6 + R*R*(o.fine ? 3.6 : 3), 6, 60), size:hs, zone:[.35, 1], fine:o.fine}});
    }},
  weigela: {label:"Arching shrubs", symbol:"cloud",
    build(P, p, o){
      const H = P.H, R = P.R;
      const fs = o.flowerSize ?? clamp(H*.06, .13, .22);
      P.bush({profile:(o.droop ?? .55) > .7 ? P_WEEP : P_FOUNTAIN, open:.15,
        foliage:{tex:o.leafTex || "leaf:ovate", size:clamp(H*.16, .5, .95), fine:1, rise:.1, wild:.7, bend:.35},
        heads:p.flower != null ? {type:"single", n:count((o.sparse ? 14 : 40) + R*R*(o.sparse ? 6 : 22), 14, 200), size:fs, zone:[.3, 1], up:.5, out:1.02, tex:o.flowerTex} : null});
    }},
  vase: {label:"Upright shrubs", symbol:"cloud",
    build(P, p, o){
      const H = P.H, R = P.R, head = o.head;
      const sizes = {flat:.46, berries:.4, plume:.9, spike:.6, single:.24, smoke:1};
      P.bush({profile:P_VASE, open:.12,
        stems:{n:count(7 + R*2, 7, 13), thick:clamp(H*.009, .02, .06)},
        foliage:{tex:o.leafTex || "leaf:ovate", size:clamp(H*.15, .6, 1.05), fine:1, low:1.1},
        heads:head && p.flower != null ? {type:head, n:count(8 + R*R*(head === "plume" ? 2 : head === "smoke" ? 2.6 : 3.2), 8, head === "smoke" ? 90 : 40),
          size:(o.headSize ?? sizes[head])*(head === "plume" ? clamp(H/8, .6, 1.2) : head === "smoke" ? clamp(H*.14, .7, 1.6) : 1), out:head === "smoke" ? 1 : undefined,
          zone:head === "smoke" ? [.5, 1] : [.5, 1], up:head === "spike" ? .8 : head === "smoke" ? .7 : .45, tex:head === "plume" ? "flower:plume-wide" : head === "flat" ? "flower:umbel" : o.headTex, wide:head === "plume" ? .85 : undefined} : null});
    }},
  ninebark: {label:"Ninebarks & cane shrubs", symbol:"cloud",
    build(P, p, o){
      const H = P.H, R = P.R;
      P.wands({n:count(18 + R*R*4, 20, 48), arch:o.arch ?? .55,
        foliage:{tex:o.leafTex || "leaf:lobed-small", size:clamp(H*.11, .4, .72)},
        heads:p.flower != null ? {type:"button", n:count(14 + R*R*4, 14, 60), size:o.headSize ?? .3} : null});
    }},
  sumac: {label:"Cut-leaf shrubs", symbol:"fern",
    build(P, p, o){
      const H = P.H, R = P.R;
      P.canes({n:count(7 + R*1.6, 7, 13), droop:.25, reach:.8, thick:clamp(H*.016, .03, .09), fork:true,
        foliage:{tex:o.leafTex || "leaf:pinnate"}, tips:{n:6, size:clamp(R*.8, .6, 2.4)}});
      if(o.head && p.flower != null){
        const r = P.rnd, n = count(4 + R*2, 4, 12);
        for(let i = 0; i < n; i++){
          const az = i*GOLD, q = polar(az, R*.6*Math.sqrt((i + .5)/n), H*(.88 + .1*r()));
          P.head(o.head, q, UP.clone().lerp(polar(az, 1), .25).normalize(), o.headSize ?? .5, {tex:"flower:umbel-lace"});
        }
      }
    }},
  spirea: {label:"Mounding shrubs", symbol:"cloud",
    build(P, p, o){
      const H = P.H, R = P.R, head = o.head ?? "flat";
      P.bush({profile:o.low ? P_MOUND : P_ROUND,
        foliage:{tex:o.leafTex || "leaf:small", size:clamp(H*.2, .42, .75), fine:1, rise:.15},
        heads:head && p.flower != null ? {type:head, n:count(10 + R*R*(head === "single" ? 16 : 7), 10, 70), size:o.headSize ?? (head === "single" ? .14 : .26), zone:[.4, 1], up:.5, out:1, tex:o.headTex} : null});
    }},
  lilac: {label:"Lilacs", symbol:"cloud",
    build(P, p, o){
      const H = P.H, R = P.R, trunk = o.trunk || 0, ch = H - trunk;
      P.bush({profile:trunk ? P_BALL : P_OVAL, trunk,
        foliage:{tex:"leaf:heart", size:clamp(ch*.15, .6, 1), fine:1},
        heads:{type:"lilac", n:count(12 + R*R*4.5, 12, 60), size:o.bloom ?? clamp(ch*.1 + .28, .45, .85), zone:[.35, 1], up:.7}});
    }},
  dense: {label:"Small-leaved mounds", symbol:"box",
    build(P, p, o){
      const H = P.H, R = P.R;
      P.bush({profile:o.round ? P_BALL : P_ROUND, lump:.05,
        foliage:{tex:o.leafTex || "leaf:small", size:clamp(H*.2, .4, .7), fine:1, rise:.2, cover:4.2, max:900, shell:4, wild:.4}});
    }},
  columnar: {label:"Columnar shrubs", symbol:"box",
    build(P, p, o){
      const H = P.H, R = P.R;
      P.bush({profile:P_COLUMN, stems:{n:6},
        foliage:{tex:o.leafTex || "leaf:small", size:clamp(R*.7, .4, .75), fine:1, rise:.6, low:1, wild:.4, cover:3.4}});
    }}
};

/* Evergreen shrubs. One model, five structures (`form`):
     globe      a dense ball or bun: globe arborvitae, mugo pine, bird's-nest spruce
     flat       a flat-topped globe wider than tall: dwarf globe blue spruce
     cone       a small pyramid with a leader: dwarf Colorado spruce
     spreading  long branches lying along the ground in layers: creeping juniper
     vase       ascending branches opening outward: spreading yew
   `leafTex` picks the foliage: spruce, pine, arborvitae, juniper or yew. */
MODELS.conifer = {label:"Evergreen shrubs", symbol:"box",
  build(P, p, o){
    const H = P.H, R = P.R, form = o.form || "globe", tex = o.leafTex || "leaf:spruce", r = P.rnd;
    if(form === "spreading"){
      /* main branches radiate along the ground, each carrying flat sprays that lift at the tips */
      const n = count(11 + R*4, 11, 22), s = clamp(R*.5, .45, 1.1);
      for(let i = 0; i < n; i++){
        const az = i*GOLD + r()*.4, L = R*(.72 + .28*r()), out = polar(az, 1), side = V(-out.z, 0, out.x);
        const k = count(3 + L*2.4, 4, 10);
        for(let j = 0; j < k; j++){
          /* sprays lie almost flat, stacked a little higher toward the middle, tips just lifting */
          const t = (j + .3)/k, y = H*(.25 + .6*(1 - t)*(.6 + .4*r()));
          for(const sg of [1, -1]){
            /* the outer sprays feather upward a little, as the growing tips do */
            const dir = out.clone().multiplyScalar(.8).addScaledVector(side, sg*.55).addScaledVector(UP, .04 + (.1 + .3*t)*r()).normalize();
            const ss = s*(.8 + .4*r());
            P.card("leaf", tex, polar(az, L*t, y).addScaledVector(dir, -ss*.2), dir, UP, ss, ss, {normal:UP.clone().lerp(dir, .25).normalize()});
          }
        }
      }
      return;
    }
    const profile = {globe:P_BALL, flat:P_FLAT, cone:P_CONE, vase:P_SPREAD, mound:P_MOUND}[form] || P_BALL;
    if(tex === "leaf:spruce" || tex === "leaf:pine"){
      /* dwarf spruces and pines: the tree in miniature. Spruce limbs stand out
         nearly level and lift toward the top; pine limbs sweep up, each ending
         in an upright candle of long needles. */
      const pineK = tex === "leaf:pine", tr = o.trunk || 0, size = Math.min(H - tr, R*2);
      P.whorled({profile:form === "cone" ? P_SPIRE : profile, trunk:tr,
        rise:pineK ? [.5, 1.25] : form === "cone" ? [.05, .75] : [.12, 1.1],
        shoot:pineK ? {tex:"leaf:shoot-pine", len:clamp(size*.2, .5, .85), wide:1, lift:.75, tipUp:.75}
                    : {tex:"leaf:shoot-spruce", len:clamp(size*.12, .34, .55), wide:1, lift:.22, tipUp:.2}});
      return;
    }
    const pine = tex === "leaf:pine", trunk = o.trunk || 0, ch = H - trunk;
    P.bush({profile, trunk, open:form === "vase" ? .15 : 0,
      stems:{n:form === "cone" ? 3 : count(5 + R*2, 5, 10)},
      foliage:{tex, size:clamp(Math.min(ch, R*2)*(pine ? .22 : .14), .28, .62), fine:1, cover:4, max:1000, shell:4, bend:.1,
               /* spruce branches hold level, pine candles and yew shoots reach up */
               rise:pine ? .7 : tex === "leaf:arborvitae" ? .8 : form === "vase" || o.reach ? .55 : form === "cone" ? .05 : .25, wild:pine ? .5 : tex === "leaf:arborvitae" ? .22 : .45, low:form === "cone" ? .7 : .85}});
    if(form === "cone") P.tube("wood", [V(0, 0, 0), V(0, H*.5, 0), V(0, H*.96, 0)], Math.max(.05, H*.014), .012, 5);
  }};

/* ---------- the layers of one catalog plant, at its real size in feet ---------- */
const protoCache = new Map();
export function plantProto(p){
  /* a plan's own variety is rebuilt whenever its size changes */
  const ck = p.custom ? p.base+"|"+p.h+"x"+p.w : p.k;
  let proto = protoCache.get(ck);
  if(proto) return proto;
  const P = new Plant(p), model = MODELS[p.model] || MODELS.cushion;
  model.build(P, p, p.opt || {});
  const layers = [];
  for(const L of P.layers.values()) if(L.buf.count) layers.push({role:L.role, tex:L.tex, geometry:L.buf.geometry()});
  proto = {layers};
  protoCache.set(ck, proto);
  return proto;
}

/* ---------- plan symbols ----------
   A unit-radius disc in the ground plane: translucent fill, an inked edge whose
   outline says what kind of plant it is, and a centre dot. */
export const SYMBOLS = {
  scallop: {outline:a=>.9 + .1*Math.abs(Math.cos(a*4.5))},
  star:    {outline:a=>.8 + .2*Math.abs(Math.cos(a*7))},
  spray:   {outline:a=>.72 + .28*Math.pow(Math.abs(Math.cos(a*9)), 1.6), ring:.04},
  mat:     {outline:a=>.9 + .06*Math.sin(a*3 + .6) + .04*Math.sin(a*7), ring:.045},
  lobed:   {outline:a=>.78 + .22*Math.pow(Math.abs(Math.cos(a*3.5)), .7)},
  fern:    {outline:a=>.7 + .3*Math.pow(Math.abs(Math.cos(a*5)), .5)*(.85 + .15*Math.cos(a*30)), ring:.045},
  cloud:   {outline:a=>.92 + .08*Math.cos(a*6), ring:.1, inner:true},
  box:     {outline:a=>.9 + .1*Math.abs(Math.cos(a*12)), ring:.08, inner:true}
};
export function symbolOf(p){ return SYMBOLS[(MODELS[p.model] || MODELS.cushion).symbol] || SYMBOLS.scallop; }

const symbolCache = new Map();
/* `fill` and `ink` are linear RGB triples, already compensated for the tone curve. */
export function symbolGeometry(p, fill, ink, cacheKey){
  const sym = symbolOf(p), key = (MODELS[p.model] || MODELS.cushion).symbol+"|"+cacheKey;
  let g = symbolCache.get(key);
  if(g) return g;
  const N = 120, ring = sym.ring ?? .06;
  const pos = [], col = [];
  const push = (x, z, c, a)=>{ pos.push(x, 0, z); col.push(c[0], c[1], c[2], a); };
  const edge = [];
  let mx = 0;
  for(let i=0;i<N;i++){ const a = i/N*TAU, r = sym.outline(a); edge.push([Math.cos(a), Math.sin(a), r]); if(r > mx) mx = r; }
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
  if(sym.inner) band(.56, .56 + ring*.5, ink, .55, false);
  band(0, .07, ink, .9, false);
  g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 4));
  g.userData.shared = true;
  symbolCache.set(key, g);
  return g;
}
/* the same outline as an SVG path, for palette swatches and the planting key */
export function symbolPath(p, cx, cy, r){
  const sym = symbolOf(p), N = 72;
  let mx = 0, d = "";
  for(let i=0;i<N;i++) mx = Math.max(mx, sym.outline(i/N*TAU));
  for(let i=0;i<N;i++){
    const a = i/N*TAU, k = sym.outline(a)/mx*r;
    d += (i ? "L" : "M") + (cx + Math.cos(a)*k).toFixed(1) + " " + (cy + Math.sin(a)*k).toFixed(1);
  }
  return d + "Z";
}
