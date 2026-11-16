/* ============================================================ houses
   The shape of a building beyond its footprint: roof form, eave height, and
   the windows and doors on each wall. Geometry and drawing only; app.js owns
   the materials and the editor's panel.

   A building in the plan is

     {type:"structure", poly:[{x,y}…], height, rot,
      eave?,                 eave height in feet (default 68% of the height)
      roof?,                 "hip" (default) | "gable"
      ridge?,                "turn" runs a gable's ridge across the short way
      siding?,               "lap" (default) | "batten"
      wallColor?, trimColor?, frameColor?, roofColor?, doorColor?, garageColor?,
      openings?:[{id, wall, t, y, w, h, kind, cols?, rows?, grid?, glass?}]}

   An opening sits on wall `wall` (the edge from poly[wall] to the next
   corner), centred a fraction `t` of the way along it, with its sill `y`
   feet above the ground. Without `openings` a building gets the automatic
   layout from autoOpenings(), so older plans draw as they always did. */
import * as THREE from "three";

const clamp = (v, a, b)=>Math.max(a, Math.min(b, v));

function inPoly(poly, x, y){
  let inside = false;
  for(let i = 0, j = poly.length - 1; i < poly.length; j = i++){
    const a = poly[i], b = poly[j];
    if((a.y > y) !== (b.y > y) && x < (b.x - a.x)*(y - a.y)/(b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
function centroid(poly){
  let x = 0, y = 0;
  for(const p of poly){ x += p.x; y += p.y; }
  return {x:x/poly.length, y:y/poly.length};
}
function grown(poly, by){
  const c = centroid(poly);
  let avg = 0;
  for(const p of poly) avg += Math.hypot(p.x - c.x, p.y - c.y);
  const s = 1 + by/Math.max(.5, avg/poly.length);
  return poly.map(p=>({x:c.x + (p.x - c.x)*s, y:c.y + (p.y - c.y)*s}));
}

/* ---------- the building's frame: heights, roof form, walls ---------- */
export function houseFrame(o){
  const poly = o.poly && o.poly.length > 2 ? o.poly : [{x:-6,y:-5},{x:6,y:-5},{x:6,y:5},{x:-6,y:5}];
  const H = Math.max(1, o.height || 10);
  const eave = clamp(Number.isFinite(o.eave) ? o.eave : H*.68, .6, Math.max(.6, H - .1)), peak = Math.max(H - eave, .1);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for(const p of poly){ x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  const w = x1 - x0, h = y1 - y0, gable = o.roof === "gable";
  /* the ridge runs the long way unless turned */
  const alongX = (w >= h) !== (o.ridge === "turn");
  const ax = alongX ? {x:0, y:1} : {x:1, y:0}, c = {x:(x0 + x1)/2, y:(y0 + y1)/2}, half = Math.max(.5, (alongX ? h : w)/2);
  const across = p=>(p.x - c.x)*ax.x + (p.y - c.y)*ax.y;
  /* how far the roof stands above the eave line over point p */
  const rise = p=>gable ? peak*(1 - Math.abs(across(p))/half) : 0;
  const edges = poly.map((A, i)=>{
    const B = poly[(i + 1)%poly.length], len = Math.hypot(B.x - A.x, B.y - A.y) || 1e-6;
    const dx = (B.x - A.x)/len, dy = (B.y - A.y)/len;
    let nx = dy, ny = -dx;
    const mx = (A.x + B.x)/2, my = (A.y + B.y)/2;
    if(inPoly(poly, mx + nx*.05, my + ny*.05)){ nx = -nx; ny = -ny; }
    /* where the ridge crosses this wall, as a fraction along it */
    const a = across(A), b = across(B), cross = gable && a*b < -1e-6 ? a/(a - b) : null;
    /* seen from outside, does the wall run left to right from A? */
    const leftIsA = dx*ny - dy*nx > 0;
    return {i, A, B, len, dx, dy, nx, ny, mx, my, cross, leftIsA};
  });
  const at = (e, t)=>({x:e.A.x + (e.B.x - e.A.x)*t, y:e.A.y + (e.B.y - e.A.y)*t});
  /* height of the wall's top a fraction t along it */
  const top = (e, t)=>eave + rise(at(e, t));
  return {poly, H, eave, peak, gable, alongX, ax, c, half, across, rise, edges, at, top, pitch:gable ? peak/half*12 : null};
}

/* ---------- geometry ---------- */
function finish(pos, uv, nor){
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  if(nor) g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  else g.computeVertexNormals();
  return g;
}
/* the walls, from the ground to the roof line; UVs in feet so siding runs true */
export function wallGeometry(F){
  const pos = [], uv = [], nor = [];
  let run = 0;
  for(const e of F.edges){
    const ts = e.cross != null ? [0, e.cross, 1] : [0, 1];
    for(let k = 0; k < ts.length - 1; k++){
      const t0 = ts[k], t1 = ts[k + 1], p0 = F.at(e, t0), p1 = F.at(e, t1), h0 = F.top(e, t0), h1 = F.top(e, t1);
      const u0 = run + e.len*t0, u1 = run + e.len*t1;
      const quad = [[p0, 0, u0], [p1, 0, u1], [p1, h1, u1], [p0, h0, u0]];
      /* wind the triangles so they face out of the house */
      const out = e.dx*e.ny - e.dy*e.nx > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
      for(const i of out){
        const [p, y, u] = quad[i];
        pos.push(p.x, y, p.y); uv.push(u, y); nor.push(e.nx, 0, e.ny);
      }
    }
    run += e.len;
  }
  return finish(pos, uv, nor);
}
/* one side of a polygon cut by the ridge line */
function clipHalf(poly, F, sign){
  const out = [];
  for(let i = 0; i < poly.length; i++){
    const a = poly[i], b = poly[(i + 1)%poly.length], da = sign*F.across(a), db = sign*F.across(b);
    if(da >= 0) out.push(a);
    if((da > 0 && db < 0) || (da < 0 && db > 0)){ const t = da/(da - db); out.push({x:a.x + (b.x - a.x)*t, y:a.y + (b.y - a.y)*t}); }
  }
  return out;
}
/* a gable roof: two planes meeting at the ridge, running past the walls by `overhang` */
export function gableRoofGeometry(F, overhang){
  const outer = grown(F.poly, overhang), slope = Math.hypot(F.half, F.peak)/F.half;
  const pos = [], uv = [];
  for(const sign of [1, -1]){
    const half = clipHalf(outer, F, sign);
    if(half.length < 3) continue;
    const tris = THREE.ShapeUtils.triangulateShape(half.map(p=>new THREE.Vector2(p.x, p.y)), []);
    for(const tri of tris) for(const i of tri){
      const p = half[i], d = Math.abs(F.across(p));
      pos.push(p.x, F.eave + F.peak*(1 - d/F.half), p.y);
      uv.push(F.alongX ? p.x : p.y, d*slope);
    }
  }
  return finish(pos, uv);
}
const _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _X = new THREE.Vector3(1, 0, 0), _v = new THREE.Vector3(), _one = new THREE.Vector3(1, 1, 1);
function beam(a, b, h, d){
  const dir = _v.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]), len = dir.length();
  const g = new THREE.BoxGeometry(len + .1, h, d);
  _q.setFromUnitVectors(_X, dir.normalize());
  g.applyMatrix4(_m.compose(new THREE.Vector3((a[0] + b[0])/2, (a[1] + b[1])/2, (a[2] + b[2])/2), _q, _one));
  return g;
}
/* fascia along the eaves and up the rakes of a gable roof */
export function gableTrim(F, overhang){
  const outer = grown(F.poly, overhang), out = [];
  const y = p=>F.eave + F.peak*(1 - Math.abs(F.across(p))/F.half) - .34;
  for(let i = 0; i < outer.length; i++){
    const a = outer[i], b = outer[(i + 1)%outer.length], da = F.across(a), db = F.across(b);
    const pts = da*db < -1e-6 ? [a, {x:a.x + (b.x - a.x)*da/(da - db), y:a.y + (b.y - a.y)*da/(da - db)}, b] : [a, b];
    for(let k = 0; k < pts.length - 1; k++) out.push(beam([pts[k].x, y(pts[k]), pts[k].y], [pts[k+1].x, y(pts[k+1]), pts[k+1].y], .7, .14));
  }
  return out;
}

/* ---------- openings ---------- */
/* The pieces on offer. w, h and sill y in feet. */
export const OPENING_KINDS = [
  {k:"dh",       group:"Windows", label:"Double-hung",      kind:"window", w:3,   h:5,   y:3.5, cols:1, rows:2},
  {k:"casement", group:"Windows", label:"Casement",         kind:"window", w:2.5, h:5,   y:3.5, cols:1, rows:1},
  {k:"slider",   group:"Windows", label:"Slider",           kind:"window", w:5,   h:4,   y:4.5, cols:2, rows:1},
  {k:"picture",  group:"Windows", label:"Picture",          kind:"window", w:5,   h:5,   y:3.5, cols:1, rows:1},
  {k:"triple",   group:"Windows", label:"Triple",           kind:"window", w:9,   h:5,   y:3.5, cols:3, rows:1},
  {k:"transom",  group:"Windows", label:"Small / transom",  kind:"window", w:2.5, h:2,   y:6.5, cols:1, rows:1},
  {k:"basement", group:"Windows", label:"Basement",         kind:"window", w:4,   h:1.5, y:.4,  cols:2, rows:1},
  {k:"entry",    group:"Doors",   label:"Entry door",       kind:"door",   w:3,   h:6.8, y:1.5, glass:"half"},
  {k:"patio",    group:"Doors",   label:"Patio slider",     kind:"patio",  w:6,   h:6.8, y:1.5, cols:2},
  {k:"patio3",   group:"Doors",   label:"Patio, 3 panels",  kind:"patio",  w:9,   h:6.8, y:1.5, cols:3},
  {k:"french",   group:"Doors",   label:"French doors",     kind:"patio",  w:6,   h:6.8, y:1.5, cols:2, grid:true},
  {k:"garage1",  group:"Garage",  label:"Garage, single",   kind:"garage", w:9,   h:7,   y:.3},
  {k:"garage2",  group:"Garage",  label:"Garage, double",   kind:"garage", w:16,  h:7,   y:.3}
];
export function newOpening(k, wall){
  const d = OPENING_KINDS.find(x=>x.k === k) || OPENING_KINDS[0];
  const op = {wall, t:.5, y:d.y, w:d.w, h:d.h, kind:d.kind};
  for(const key of ["cols", "rows", "grid", "glass"]) if(d[key] != null) op[key] = d[key];
  return op;
}
/* keep what a plan file holds sane */
export function cleanOpenings(list){
  if(!Array.isArray(list)) return undefined;
  const out = [];
  let id = 1;
  for(const op of list){
    if(!op || !Number.isFinite(op.wall) || !Number.isFinite(op.t) || !(op.w > 0) || !(op.h > 0)) continue;
    out.push({id:id++, wall:Math.max(0, Math.round(op.wall)), t:clamp(op.t, 0, 1), y:Math.max(0, +op.y || 0), w:clamp(op.w, .5, 40), h:clamp(op.h, .5, 30),
      kind:["window", "door", "patio", "garage"].includes(op.kind) ? op.kind : "window",
      ...(op.cols ? {cols:clamp(Math.round(op.cols), 1, 6)} : {}), ...(op.rows ? {rows:clamp(Math.round(op.rows), 1, 2)} : {}),
      ...(op.grid ? {grid:true} : {}), ...(op.glass ? {glass:String(op.glass)} : {})});
  }
  return out;
}
/* The layout a building gets until someone designs it: a door on `doorWall`,
   a row of windows on each floor of every wall long enough to hold one. */
export function autoOpenings(F, doorWall){
  const out = [], rows = F.eave >= 16 ? [3, F.eave - 5.6] : F.eave >= 7 ? [3] : [];
  let id = 1;
  for(const e of F.edges){
    if(e.len < 7 || !rows.length) continue;
    const doorAt = e.i === doorWall ? e.len*(e.len > 20 ? .38 : .5) : null;
    if(doorAt != null) out.push({id:id++, wall:e.i, t:doorAt/e.len, y:.9, w:3, h:6.8, kind:"door", glass:"none"});
    const n = Math.max(1, Math.floor(e.len/11));
    for(let k = 0; k < n; k++){
      const s = (k + .5)*e.len/n;
      for(const [r, sill] of rows.entries()){
        if(r === 0 && doorAt != null && Math.abs(s - doorAt) < 4.5) continue;
        if(s < 2.6 || s > e.len - 2.6) continue;
        out.push({id:id++, wall:e.i, t:s/e.len, y:sill, w:3, h:Math.min(4.2, F.eave - sill - 1.4), kind:"window", cols:1, rows:2});
      }
    }
  }
  return out;
}
/* the panes of a window or patio door: [{x, y, w, h}] relative to its lower-left corner */
function panes(op){
  const cols = op.cols || 1, rows = op.kind === "window" ? op.rows || 1 : 1, f = op.kind === "patio" ? .22 : .16, out = [];
  /* a triple is a wide picture window between two narrow flankers */
  const widths = cols === 3 && op.kind === "window" ? [.25, .5, .25] : Array(cols).fill(1/cols);
  let x = 0;
  for(let c = 0; c < cols; c++){
    const w = op.w*widths[c];
    for(let r = 0; r < rows; r++) out.push({x:x + f/2, y:op.h*r/rows + f/2, w:w - f, h:op.h/rows - f});
    x += w;
  }
  return out;
}
/* muntin bars inside one pane: [{x, y, w, h}] */
function muntins(p){
  const out = [], nx = p.w > 1.6 ? Math.max(1, Math.round(p.w/1.4) - 1) : 1, ny = Math.max(1, Math.round(p.h/1.5) - 1);
  for(let i = 1; i <= nx; i++) out.push({x:p.x + p.w*i/(nx + 1) - .03, y:p.y, w:.06, h:p.h});
  for(let i = 1; i <= ny; i++) out.push({x:p.x, y:p.y + p.h*i/(ny + 1) - .03, w:p.w, h:.06});
  return out;
}
function doorLite(op){
  if(op.glass === "none" || !op.glass) return null;
  return op.glass === "full" ? {x:op.w*.2, y:op.h*.1, w:op.w*.6, h:op.h*.8} : {x:op.w*.22, y:op.h*.5, w:op.w*.56, h:op.h*.4};
}
function garagePanels(op){
  const cols = Math.max(2, Math.round(op.w/4)), rows = 4, out = [], g = .25;
  for(let r = 0; r < rows; r++) for(let c = 0; c < cols; c++)
    out.push({x:op.w*c/cols + g/2, y:op.h*r/rows + g/2, w:op.w/cols - g, h:op.h/rows - g});
  return out;
}
/* The boxes that make one opening in 3D, sorted by what they are made of:
   {trim, frame, glass, door, garage} → [BufferGeometry]. */
export function openingParts(F, op, parts){
  const e = F.edges[op.wall];
  if(!e) return;
  const rot = -Math.atan2(e.dy, e.dx), s0 = clamp(op.t*e.len, op.w/2, Math.max(op.w/2, e.len - op.w/2)) - op.w/2;
  /* a box w × h whose lower-left corner is (x, y) from the opening's own, standing `out` off the wall */
  const box = (key, r, depth, out)=>{
    const s = s0 + r.x + r.w/2, g = new THREE.BoxGeometry(r.w, r.h, depth);
    _q.setFromAxisAngle(_v.set(0, 1, 0), rot);
    g.applyMatrix4(_m.compose(new THREE.Vector3(e.A.x + e.dx*s + e.nx*out, op.y + r.y + r.h/2, e.A.y + e.dy*s + e.ny*out), _q, _one));
    parts[key].push(g);
  };
  const whole = {x:0, y:0, w:op.w, h:op.h};
  box("trim", {x:-.25, y:-.25, w:op.w + .5, h:op.h + .5}, .16, .06);
  if(op.kind === "window" || op.kind === "patio"){
    box("frame", whole, .2, .08);
    for(const p of panes(op)){
      box("glass", p, .08, .17);
      if(op.grid) for(const b of muntins(p)) box("frame", b, .05, .2);
    }
    if(op.kind === "window") box("trim", {x:-.4, y:-.45, w:op.w + .8, h:.2}, .45, .12);
  } else if(op.kind === "door"){
    box("door", whole, .14, .08);
    const lite = doorLite(op);
    if(lite) box("glass", lite, .06, .14);
    else for(const p of [{x:op.w*.18, y:op.h*.52, w:op.w*.64, h:op.h*.36}, {x:op.w*.18, y:op.h*.1, w:op.w*.64, h:op.h*.34}]) box("door", p, .05, .15);
  } else {
    box("garage", whole, .1, .08);
    for(const p of garagePanels(op)) box("garage", p, .05, .13);
  }
}

/* ---------- a wall drawn square-on, for the editor ---------- */
const f1 = v=>(+v).toFixed(2);
/* Opening positions on this wall as seen from outside: x from the wall's left end. */
export function opLeft(e, op){
  const s = clamp(op.t*e.len, op.w/2, Math.max(op.w/2, e.len - op.w/2));
  return (e.leftIsA ? s : e.len - s) - op.w/2;
}
export function tFromLeft(e, left, w){
  const s = left + w/2;
  return clamp((e.leftIsA ? s : e.len - s)/e.len, 0, 1);
}
/* the wall's top outline, left to right: [[x, y]…] */
export function wallProfile(F, e){
  const ts = e.cross != null ? [0, e.cross, 1] : [0, 1];
  const pts = ts.map(t=>[e.leftIsA ? e.len*t : e.len*(1 - t), F.top(e, t)]);
  return e.leftIsA ? pts : pts.reverse();
}
/* highest sill + height an opening `w` wide can reach with its left edge at x */
export function headroom(F, e, x, w){
  const prof = wallProfile(F, e), at = q=>{
    for(let i = 0; i < prof.length - 1; i++) if(q <= prof[i+1][0] + 1e-6){ const k = (q - prof[i][0])/Math.max(1e-6, prof[i+1][0] - prof[i][0]); return prof[i][1] + (prof[i+1][1] - prof[i][1])*k; }
    return prof[prof.length - 1][1];
  };
  return Math.min(at(x), at(x + w)) - .5;
}
export function elevationSVG(F, e, openings, sel, col, guides = []){
  const prof = wallProfile(F, e), maxTop = Math.max(...prof.map(p=>p[1])), pad = Math.max(2.5, e.len*.06);
  const Y = y=>-y, vb = `${f1(-pad)} ${f1(-maxTop - pad)} ${f1(e.len + pad*2)} ${f1(maxTop + pad*1.9)}`;
  const outline = `M0 0 L${prof.map(p=>f1(p[0]) + " " + f1(Y(p[1]))).join(" L")} L${f1(e.len)} 0 Z`;
  const rect = (r, ox, oy, attrs)=>`<rect x="${f1(ox + r.x)}" y="${f1(Y(oy + r.y + r.h))}" width="${f1(r.w)}" height="${f1(r.h)}" ${attrs}/>`;
  let s = `<svg class="elev2" viewBox="${vb}" preserveAspectRatio="xMidYMid meet" data-len="${f1(e.len)}">`
    + `<defs><pattern id="hsiding" width="${col.batten ? 1 : 4}" height="${col.batten ? 4 : .6}" patternUnits="userSpaceOnUse">`
    + (col.batten ? `<line x1=".5" y1="0" x2=".5" y2="4"` : `<line x1="0" y1=".3" x2="4" y2=".3"`) + ` stroke="rgba(0,0,0,.16)" stroke-width=".05"/></pattern>`
    + `<clipPath id="hwall"><path d="${outline}"/></clipPath></defs>`
    + `<rect x="${f1(-pad)}" y="0" width="${f1(e.len + pad*2)}" height="${f1(pad*.9)}" fill="#2c3a26"/>`
    + `<path d="${outline}" fill="${col.wall}"/><path d="${outline}" fill="url(#hsiding)"/>`
    + `<rect x="0" y="${f1(Y(.9))}" width="${f1(e.len)}" height=".9" fill="#8d887e"/>`
    + `<path d="${outline}" fill="none" stroke="${col.trim}" stroke-width=".3" stroke-linejoin="round" clip-path="url(#hwall)"/>`;
  /* a ruler along the ground */
  for(let x = 0; x <= e.len + 1e-6; x += 5)
    s += `<line x1="${f1(x)}" y1="0" x2="${f1(x)}" y2="${x%10 ? .5 : .8}" stroke="#8A8C80" stroke-width=".06"/>`
      + (x%10 === 0 ? `<text x="${f1(x)}" y="1.9" class="tick">${x}</text>` : "");
  for(const g of guides) s += g.x != null
    ? `<line x1="${f1(g.x)}" y1="${f1(Y(maxTop + 1))}" x2="${f1(g.x)}" y2="0" class="guide"/>`
    : `<line x1="${f1(-1)}" y1="${f1(Y(g.y))}" x2="${f1(e.len + 1)}" y2="${f1(Y(g.y))}" class="guide"/>`;
  for(const op of openings){
    const x = opLeft(e, op), y = op.y, on = op.id === sel, whole = {x:0, y:0, w:op.w, h:op.h};
    s += `<g class="op${on ? " on" : ""}" data-op="${op.id}">` + rect({x:-.25, y:-.25, w:op.w + .5, h:op.h + .5}, x, y, `fill="${col.trim}"`);
    if(op.kind === "window" || op.kind === "patio"){
      s += rect(whole, x, y, `fill="${col.frame}"`);
      for(const p of panes(op)){
        s += rect(p, x, y, `fill="#22303c"`);
        if(op.grid) for(const b of muntins(p)) s += rect(b, x, y, `fill="${col.frame}"`);
      }
      if(op.kind === "window") s += rect({x:-.4, y:-.45, w:op.w + .8, h:.2}, x, y, `fill="${col.trim}"`);
    } else if(op.kind === "door"){
      s += rect(whole, x, y, `fill="${col.door}"`);
      const lite = doorLite(op);
      if(lite) s += rect(lite, x, y, `fill="#22303c"`);
      else for(const p of [{x:op.w*.18, y:op.h*.52, w:op.w*.64, h:op.h*.36}, {x:op.w*.18, y:op.h*.1, w:op.w*.64, h:op.h*.34}]) s += rect(p, x, y, `fill="none" stroke="rgba(0,0,0,.35)" stroke-width=".06"`);
    } else {
      s += rect(whole, x, y, `fill="${col.garage}"`);
      for(const p of garagePanels(op)) s += rect(p, x, y, `fill="none" stroke="rgba(0,0,0,.28)" stroke-width=".06"`);
    }
    s += rect({x:-.25, y:-.25, w:op.w + .5, h:op.h + .5}, x, y, `class="hit" fill="transparent"`) + `</g>`;
    if(on){
      /* where it sits: from the wall's left end, and off the ground */
      s += `<line x1="0" y1="${f1(Y(y + op.h/2))}" x2="${f1(x)}" y2="${f1(Y(y + op.h/2))}" class="dim"/>`
        + `<line x1="${f1(x + op.w/2)}" y1="0" x2="${f1(x + op.w/2)}" y2="${f1(Y(y))}" class="dim"/>`;
    }
  }
  return s + `</svg>`;
}
/* the footprint from above with one wall picked out */
export function planSVG(F, wall){
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for(const p of F.poly){ x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
  const pad = Math.max(x1 - x0, y1 - y0)*.12 + 1;
  let s = `<svg class="hplan" viewBox="${f1(x0 - pad)} ${f1(y0 - pad)} ${f1(x1 - x0 + pad*2)} ${f1(y1 - y0 + pad*2)}" preserveAspectRatio="xMidYMid meet">`
    + `<polygon points="${F.poly.map(p=>f1(p.x) + "," + f1(p.y)).join(" ")}" class="fp"/>`;
  const sw = Math.max(x1 - x0, y1 - y0)*.035;
  for(const e of F.edges) s += `<line x1="${f1(e.A.x)}" y1="${f1(e.A.y)}" x2="${f1(e.B.x)}" y2="${f1(e.B.y)}" class="w${e.i === wall ? " on" : ""}" data-wall="${e.i}" stroke-width="${f1(e.i === wall ? sw*1.6 : sw)}"/>`;
  return s + `</svg>`;
}
