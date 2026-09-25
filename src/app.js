import * as THREE from "three";
import "./importer.js";
import { SkyEnvironment } from "./scene/environment.js";
import { lawnTextures, sidingTextures, shingleTextures, concreteTile, paverTextures } from "./scene/textures.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { TreeLibrary } from "./trees/trees.js";
import { createPost } from "./post.js";

const DEG = Math.PI/180;
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const escapeHTML = value => String(value).replace(/[&<>"']/g, c=>({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[c]));

/* ============================================================ crown profiles */
const SHAPES = {
  round:     {label:"Round crown (maple, ash)",      base:.32, r:u=>Math.sqrt(Math.max(0,1-Math.pow(2*u-1,2)))},
  oval:      {label:"Upright oval (linden, alder)",  base:.22, r:u=>Math.pow(Math.max(0,1-Math.pow(2*u-1,2)),.36)},
  pyramidal: {label:"Pyramidal (spruce, fir)",       base:.05, r:u=>Math.pow(1-u,.8)},
  columnar:  {label:"Columnar (juniper, mugo)",      base:.06, r:u=>u<.82?.92+.08*Math.sin(u*4):Math.sqrt(Math.max(0,1-Math.pow((u-.82)/.18,2)))},
  spreading: {label:"Wide spreading (oak, locust)",  base:.40, r:u=>Math.pow(Math.sin(Math.PI*(.22+.72*u)),.45)},
  vase:      {label:"Vase (elm, serviceberry)",      base:.42, r:u=>.32+.68*Math.pow(u,.75)},
  weeping:   {label:"Weeping (willow, river birch)", base:.16, r:u=>Math.pow(Math.sin(Math.PI*(.18+.78*u)),.42)}
};
const PRESETS = [
 {g:"Shortlist", n:"Autumn Blaze Maple", s:"oval", h:50, w:40, ev:false, d:.85, leaf:0x46702c, fall:0xb8321c,
  note:"Freeman maple (Jeffersred). Upright oval, fast, brilliant orange-red in fall. Hardy to zone 3."},
 {g:"Shortlist", n:"Sienna Glen Maple", s:"oval", h:55, w:38, ev:false, d:.82, leaf:0x46702c, fall:0xb5512a,
  note:"Freeman maple. Upright oval that broadens with age, fast growth, hardy to zone 3."},
 {g:"Shortlist", n:"Matador Maple", s:"oval", h:45, w:35, ev:false, d:.90, leaf:0x42692a, fall:0xb3261e,
  note:"Freeman maple, tighter and more uniform than Sienna Glen. Heavy shade underneath."},
 {g:"Shortlist", n:"Redmond Linden", s:"pyramidal", h:55, w:35, ev:false, d:.90, leaf:0x3f6a2a, fall:0xb89a3a,
  note:"American linden. Broad pyramidal, very dense. Handles wind and alkaline soil."},
 {g:"Shortlist", n:"Greenspire Linden", s:"pyramidal", h:45, w:30, ev:false, d:.88, leaf:0x3f6a2a, fall:0xb8a040,
  note:"Littleleaf linden. Tight pyramidal form, dense shade, narrower than Redmond."},
 {g:"Shortlist", n:"Prairie Horizon Alder", s:"oval", h:35, w:28, ev:false, d:.55, leaf:0x2f5424, fall:0x6e6a2c,
  note:"Manchurian alder. Open canopy, so the shade underneath stays dappled. Very hardy and fast."},
 {g:"Shortlist", n:"Spartan Juniper", s:"columnar", h:18, w:5, ev:true, d:.95, leaf:0x2f4a2a,
  note:"Narrow columnar evergreen. Thin but solid shadow, year round. Rated zone 4, marginal in 4a."},
 {g:"Shortlist", n:"Moonglow Juniper", s:"pyramidal", h:20, w:10, ev:true, d:.92, leaf:0x66796b,
  note:"Broad pyramidal blue-green evergreen. Dense year-round shade in a compact footprint."},
 {g:"Shortlist", n:"Tannenbaum Mugo Pine", s:"pyramidal", h:11, w:7, ev:true, d:.90, leaf:0x2e4d22,
  note:"Compact pyramidal mugo. Slow, stays small, casts dense shade low to the ground."},
 {g:"Shortlist", n:"Columnar Mugo Pine", s:"columnar", h:12, w:5, ev:true, d:.90, leaf:0x2e4d22,
  note:"Narrow upright mugo. Slow-growing evergreen screen without a wide shadow."},
 {g:"Shortlist", n:"Columnar Norway Spruce", s:"columnar", h:30, w:6, ev:true, d:.92, leaf:0x264221,
  note:"Picea abies 'Cupressina'. Very narrow column that keeps its lower branches. Hardy to zone 3."},
 {g:"Shortlist", n:"Columnar Norway Pine", s:"columnar", h:25, w:8, ev:true, d:.85, leaf:0x2a4a26,
  note:"Narrow upright conifer. Mature size varies a lot between growers — confirm the tag."},
 {g:"Already here", n:"Royal Red maple", s:"round", h:35, w:25, ev:false, d:.95, leaf:0x4a2530, fall:0x5a1f1f,
  note:"Norway maple. Round, very dense crown — the deepest shade of the maples here."},
 {g:"Already here", n:"Crimson Sunset maple", s:"oval", h:35, w:22, ev:false, d:.90, leaf:0x5a2a36, fall:0x6a2424,
  note:"Upright oval, purple foliage, denser and narrower than a Freeman maple."},
 {g:"Already here", n:"Swamp white oak", s:"spreading", h:55, w:50, ev:false, d:.70, leaf:0x3f5f2a, fall:0x8a5a2a,
  note:"Wide spreading crown with a fairly open interior. Leafs out late."},
 {g:"Already here", n:"Prairie Expedition elm", s:"vase", h:50, w:40, ev:false, d:.70, leaf:0x3f6a2a, fall:0xb09a3a,
  note:"Vase shape with a high crown, so shade lands well out from the trunk."},
 {g:"Already here", n:"Flowering crabapple", s:"round", h:18, w:18, ev:false, d:.70, leaf:0x4a7030, fall:0xa0702a,
  note:"Small round crown, light shade. Safe near a bed."},
 {g:"Already here", n:"Black Hills spruce", s:"pyramidal", h:35, w:18, ev:true, d:.95, leaf:0x3a5a4a,
  note:"Dense conifer that shades year round, including the low winter sun."},
 {g:"Already here", n:"Pinky Winky hydrangea", s:"round", h:8, w:6, ev:false, d:.75, leaf:0x4a7a30, fall:0x8a6a30,
  note:"Tree-form shrub. Its shadow only matters to a bed right beside it."}
];

/* ============================================================ polygon helpers */
function rectPoly(w,h){ return [{x:-w/2,y:-h/2},{x:w/2,y:-h/2},{x:w/2,y:h/2},{x:-w/2,y:h/2}]; }
function bbox(p){
  let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(const q of p){ if(q.x<x0)x0=q.x; if(q.x>x1)x1=q.x; if(q.y<y0)y0=q.y; if(q.y>y1)y1=q.y; }
  return {x0,y0,x1,y1,w:x1-x0,h:y1-y0,cx:(x0+x1)/2,cy:(y0+y1)/2};
}
function polyArea(p){
  let a = 0;
  for(let i=0,j=p.length-1;i<p.length;j=i++) a += (p[j].x+p[i].x)*(p[j].y-p[i].y);
  return Math.abs(a/2);
}
function polyPerimeter(p){
  let s = 0;
  for(let i=0,j=p.length-1;i<p.length;j=i++) s += Math.hypot(p[i].x-p[j].x, p[i].y-p[j].y);
  return s;
}
function polyCentroid(p){
  let a=0, cx=0, cy=0;
  for(let i=0,j=p.length-1;i<p.length;j=i++){
    const f = p[j].x*p[i].y - p[i].x*p[j].y;
    a += f; cx += (p[j].x+p[i].x)*f; cy += (p[j].y+p[i].y)*f;
  }
  if(Math.abs(a) < 1e-9){ const b = bbox(p); return {x:b.cx, y:b.cy}; }
  return {x:cx/(3*a), y:cy/(3*a)};
}
function pointInPoly(p, x, y){
  let inside = false;
  for(let i=0,j=p.length-1;i<p.length;j=i++){
    const xi=p[i].x, yi=p[i].y, xj=p[j].x, yj=p[j].y;
    if((yi>y) !== (yj>y) && x < (xj-xi)*(y-yi)/(yj-yi) + xi) inside = !inside;
  }
  return inside;
}
function distToSeg(px,py,ax,ay,bx,by){
  const dx=bx-ax, dy=by-ay, L=dx*dx+dy*dy;
  const t = L ? clamp(((px-ax)*dx + (py-ay)*dy)/L, 0, 1) : 0;
  return {d:Math.hypot(px-(ax+dx*t), py-(ay+dy*t)), t};
}
function scalePolyTo(poly, w, h){
  const b = bbox(poly);
  const sx = b.w > .001 ? w/b.w : 1, sy = b.h > .001 ? h/b.h : 1;
  for(const q of poly){ q.x = (q.x-b.cx)*sx; q.y = (q.y-b.cy)*sy; }
}
function rot2(px, py, a){
  const c = Math.cos(a), s = Math.sin(a);
  return {x: px*c - py*s, y: px*s + py*c};
}
/* an object's outline in yard coordinates */
function worldPoly(o){
  const a = (o.rot||0)*DEG;
  return (o.poly||[]).map(q=>{ const r = rot2(q.x, q.y, a); return {x:o.x+r.x, y:o.y+r.y}; });
}

/* ============================================================ fence styles */
const FENCE_STYLES = {
  picket:  {label:"Aluminum picket", dens:.50, color:0x14161a, metal:.65, rough:.42, kind:"picket"},
  privacy: {label:"Wood privacy",    dens:.95, color:0x8a6b47, metal:0,   rough:.9,  kind:"panel"},
  board:   {label:"Board on board",  dens:.88, color:0x9a7b55, metal:0,   rough:.88, kind:"picket"},
  rail:    {label:"Split rail",      dens:.18, color:0x7a6248, metal:0,   rough:.95, kind:"rail"},
  chain:   {label:"Chain link",      dens:.14, color:0x9aa2ab, metal:.8,  rough:.5,  kind:"mesh"},
  hedge:   {label:"Clipped hedge",   dens:.90, color:0x3c6b2f, metal:0,   rough:1,   kind:"hedge"}
};
const PAVING = {
  driveway:{name:"Driveway",w:14,h:32,color:0x41464c,wire:0x9caec2},
  sidewalk:{name:"Sidewalk",w:4,h:24,color:0xb7b9b2,wire:0xd9ddd2}
};

/* ============================================================ state */
let uid = 1;
const nid = () => uid++;
let sceneVer = 0;

function fromPreset(name, x, y){
  const d = PRESETS.find(p=>p.n===name) || PRESETS[0];
  return {id:nid(), type:"tree", name:d.n, x, y, shape:d.s, height:d.h, spread:d.w,
          evergreen:d.ev, density:d.d, note:d.note, leaf:d.leaf, fall:d.fall};
}
function isoToday(){
  const d = new Date();
  return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
}
function freshState(){
  return {
    lat:46.8772, lon:-96.7898, tz:-6, autoDST:true,
    place:"Fargo, ND", tzMode:"zone", tzZone:"America/Chicago",
    date: isoToday(), minutes: 13*60,
    north:0, grid:5, snap:true, showGrid:true, simple:false, gridFrame:null,
    yard:{w:110, h:90},
    boundary: rectPoly(110, 90),
    boundaryLabels:[], boundaryImage:null, boundaryImageDraft:null,
    fence:{on:true, style:"picket", height:5, density:.5, sides:[true,true,true,true]},
    heat:false, leafSeason:true, fullSun:6,
    leafOut:"05-05", leafDrop:"10-12",
    objects:[
      {id:nid(), type:"structure", name:"House", x:0, y:-28, rot:0, height:22, poly:rectPoly(44,26)},
      {id:nid(), type:"deck", name:"Patio", x:0, y:-8, rot:0, height:0.5, surface:"concrete", poly:rectPoly(24,12)},
      fromPreset("Sienna Glen Maple", -32, 8),
      fromPreset("Black Hills spruce", 34, -2),
      {id:nid(), type:"bed", name:"Vegetable bed", x:2, y:20, w:16, h:8, rot:0},
      {id:nid(), type:"bed", name:"Perennial bed", x:-26, y:30, w:20, h:6, rot:0}
    ],
    sel:null
  };
}
let S = freshState();

/* Rendering preferences belong to this browser, not to the plan file. */
const PREFS_KEY = "yard-shade-studio:render";
const QUALITY = {
  /* pixel ratio cap, ambient occlusion, shadow map, AO at half resolution */
  performance:{dpr:1,   ao:false, shadow:2048, half:true},
  balanced:   {dpr:1.5, ao:true,  shadow:4096, half:true},
  quality:    {dpr:2,   ao:true,  shadow:4096, half:false}
};
const prefs = Object.assign({sky:"hdri", quality:"balanced", treeDetail:"standard", exposure:1}, (()=>{
  try{ return JSON.parse(localStorage.getItem(PREFS_KEY) || "{}"); }catch{ return {}; }
})());
function savePrefs(){ try{ localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); }catch{ /* private mode */ } }
let tool = "select";
let nodeEdit = false;

const isPoly = o => !!(o && o.poly);
const isPaved = o => !!(o && Object.hasOwn(PAVING,o.type));
const isOutlineType = o => o.type === "structure" || o.type === "deck" || isPaved(o);
function ensureFenceSides(){
  const n = S.boundary.length;
  if(!Array.isArray(S.fence.sides)) S.fence.sides = [];
  while(S.fence.sides.length < n) S.fence.sides.push(true);
  if(S.fence.sides.length > n) S.fence.sides.length = n;
  if(!Array.isArray(S.boundaryLabels)) S.boundaryLabels = [];
  while(S.boundaryLabels.length < n) S.boundaryLabels.push("");
  S.boundaryLabels.length = n;
  return S.fence.sides;
}
function insertBoundaryCorner(k, point){
  ensureFenceSides();
  if(S.gridFrame?.edgeIndex != null && S.gridFrame.edgeIndex > k) S.gridFrame.edgeIndex++;
  S.boundary.splice(k+1, 0, point);
  S.boundaryLabels.splice(k+1, 0, S.boundaryLabels[k]);
  S.fence.sides.splice(k+1, 0, S.fence.sides[k]);
}
function removeBoundaryCorner(k){
  ensureFenceSides();
  if(S.gridFrame?.edgeIndex != null){
    const i = S.gridFrame.edgeIndex;
    S.gridFrame.edgeIndex = k === i || k === (i+1)%S.boundary.length ? null : i > k ? i-1 : i;
  }
  S.boundary.splice(k, 1);
  S.boundaryLabels.splice(k, 1);
  S.fence.sides.splice(k, 1);
}
/* edge i runs from boundary[i] to boundary[i+1] */
function boundaryEdges(){
  const p = S.boundary, c = polyCentroid(p), out = [];
  for(let i=0;i<p.length;i++){
    const A = p[i], B = p[(i+1)%p.length];
    const len = Math.hypot(B.x-A.x, B.y-A.y);
    let nx = (B.y-A.y), ny = -(B.x-A.x);
    const L = Math.hypot(nx,ny) || 1;
    nx /= L; ny /= L;
    const mx = (A.x+B.x)/2, my = (A.y+B.y)/2;
    if(nx*(mx-c.x) + ny*(my-c.y) < 0){ nx = -nx; ny = -ny; }
    const bear = vecBearing(nx, ny);
    const direction = compassName(bear);
    out.push({i, A, B, len, mx, my, nx, ny, bear, direction,
              name:S.boundaryLabels?.[i] || direction});
  }
  return out;
}
function yardBounds(){ return bbox(S.boundary); }
function yardSpan(){ const b = yardBounds(); return Math.max(b.w, b.h); }
function gridFrame(){
  return S.gridFrame || {angle:0, origin:{x:0,y:0}};
}
function gridToWorld(p){
  const f = gridFrame(), q = rot2(p.x,p.y,f.angle*DEG);
  return {x:q.x+f.origin.x,y:q.y+f.origin.y};
}
function worldToGrid(p){
  const f = gridFrame();
  return rot2(p.x-f.origin.x,p.y-f.origin.y,-f.angle*DEG);
}
function gridBounds(){ return bbox(S.boundary.map(worldToGrid)); }
function alignGridToSide(k, axis){
  const e = boundaryEdges()[k];
  if(!e || e.len < .01 || !["x","y"].includes(axis)){
    toast("Choose a nonzero property side and its grid axis."); return;
  }
  pushHist();
  const angle = Math.atan2(e.B.y-e.A.y,e.B.x-e.A.x)/DEG - (axis === "y" ? 90 : 0);
  S.gridFrame = {edgeIndex:k, axis, angle:((angle+90)%180+180)%180-90,
                 origin:{x:e.mx,y:e.my}, modified:false};
  S.showGrid = true;
  $("showgrid").checked = true;
  buildGrid(); panelFor = "init"; drawPanel(); markDirty(); pushHist();
  setView("vplan",true);
  toast("Grid squared to "+e.name+". Geometry, distances and true north are unchanged.");
}
function resetGridReference(){
  pushHist(); S.gridFrame = null; buildGrid(); panelFor = "init"; drawPanel();
  markDirty(); pushHist(); setView("vplan",true);
}

/* ============================================================ solar position */
function nthSunday(y, month, from){
  for(let d=from; d<from+7; d++) if(new Date(Date.UTC(y, month, d)).getUTCDay()===0) return d;
  return from;
}
/* Offset (hours) in an IANA zone at local noon on a date, via Intl. Handles
   each zone's own daylight-saving rules, north or south of the equator. */
const zoneOffsetCache = new Map();
function zoneOffsetHours(zone, date){
  const key = zone+"|"+date;
  if(zoneOffsetCache.has(key)) return zoneOffsetCache.get(key);
  const fmt = new Intl.DateTimeFormat("en-US", {timeZone:zone, hourCycle:"h23", year:"numeric",
    month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit"});
  const at = ms=>{
    const p = fmt.formatToParts(new Date(ms)), g = t=>+p.find(x=>x.type===t).value;
    return (Date.UTC(g("year"), g("month")-1, g("day"), g("hour"), g("minute")) - ms)/3600000;
  };
  const [Y,M,D] = date.split("-").map(Number);
  const noon = Date.UTC(Y, M-1, D, 12);
  const off = at(noon - at(noon)*3600000);
  zoneOffsetCache.set(key, off);
  return off;
}
function zoneIsValid(zone){
  try{ new Intl.DateTimeFormat("en-US", {timeZone:zone}); return true; }catch{ return false; }
}
function tzOffset(){
  if(S.tzMode === "zone" && S.tzZone && zoneIsValid(S.tzZone)) return zoneOffsetHours(S.tzZone, S.date);
  if(!S.autoDST) return S.tz;
  const [Y,M,D] = S.date.split("-").map(Number);
  const start = Date.UTC(Y,2,nthSunday(Y,2,8)), end = Date.UTC(Y,10,nthSunday(Y,10,1));
  const t = Date.UTC(Y,M-1,D);
  return (t>=start && t<end) ? S.tz+1 : S.tz;
}
function solarPos(minutes){
  const [Y,M,D] = S.date.split("-").map(Number);
  const off = tzOffset();
  const ms = Date.UTC(Y, M-1, D) + (minutes - off*60)*60000;
  const jd = ms/86400000 + 2440587.5, T = (jd - 2451545)/36525;
  const L0 = (280.46646 + T*(36000.76983 + 0.0003032*T)) % 360;
  const Mx = 357.52911 + T*(35999.05029 - 0.0001537*T);
  const e  = 0.016708634 - T*(0.000042037 + 0.0000001267*T);
  const C  = Math.sin(Mx*DEG)*(1.914602 - T*(0.004817 + 0.000014*T))
           + Math.sin(2*Mx*DEG)*(0.019993 - 0.000101*T) + Math.sin(3*Mx*DEG)*0.000289;
  const om = 125.04 - 1934.136*T;
  const lam = L0 + C - 0.00569 - 0.00478*Math.sin(om*DEG);
  const eps0 = 23 + (26 + (21.448 - T*(46.815 + T*(0.00059 - T*0.001813)))/60)/60;
  const eps = eps0 + 0.00256*Math.cos(om*DEG);
  const decl = Math.asin(Math.sin(eps*DEG)*Math.sin(lam*DEG));
  const y = Math.pow(Math.tan(eps*DEG/2),2);
  const eot = 4/DEG*( y*Math.sin(2*L0*DEG) - 2*e*Math.sin(Mx*DEG)
            + 4*e*y*Math.sin(Mx*DEG)*Math.cos(2*L0*DEG)
            - 0.5*y*y*Math.sin(4*L0*DEG) - 1.25*e*e*Math.sin(2*Mx*DEG) );
  const tst = (minutes + eot + 4*S.lon - 60*off + 1440) % 1440;
  const ha = (tst/4 - 180)*DEG, lat = S.lat*DEG;
  const cosZ = Math.sin(lat)*Math.sin(decl) + Math.cos(lat)*Math.cos(decl)*Math.cos(ha);
  const el = 90 - Math.acos(clamp(cosZ,-1,1))/DEG;
  let az = Math.atan2(Math.sin(ha), Math.cos(ha)*Math.sin(lat) - Math.tan(decl)*Math.cos(lat))/DEG + 180;
  return {el, az:(az+360)%360};
}
let edgeCache = {key:null, val:null};
function dayEdges(){
  const key = [S.date,S.lat,S.lon,S.tz,S.autoDST,S.tzMode,S.tzZone].join("|");
  if(edgeCache.key === key) return edgeCache.val;
  const HZ = -0.833;
  let rise=null, set=null, peak=-90, prev=solarPos(0).el;
  for(let m=1; m<=1440; m++){
    const el = solarPos(m).el;
    if(el > peak) peak = el;
    if(prev<HZ && el>=HZ && rise===null) rise = m-1 + (HZ-prev)/(el-prev);
    if(prev>=HZ && el<HZ && rise!==null && set===null) set = m-1 + (prev-HZ)/(prev-el);
    prev = el;
  }
  /* Polar day and polar night have no sunrise; treat them honestly rather than
     inventing a 6 AM – 8 PM day. */
  let polar = null;
  if(rise === null){
    if(peak >= HZ){ rise = 0; set = 1440; polar = "day"; }
    else{ rise = set = 720; polar = "night"; }
  } else if(set === null) set = 1440;
  let noon = rise, best = -99;
  for(let m=Math.floor(rise); m<=Math.ceil(set); m+=2){ const el = solarPos(m).el; if(el > best){ best = el; noon = m; } }
  const val = {rise, set, peak, polar, noon};
  edgeCache = {key, val};
  return val;
}
function fmtTime(m){
  m = ((Math.round(m)%1440)+1440)%1440;
  let h = Math.floor(m/60); const mm = String(m%60).padStart(2,"0");
  const ap = h<12 ? "AM" : "PM";
  h = h%12; if(h===0) h = 12;
  return h+":"+mm+" "+ap;
}
function compassName(az){
  const n = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return n[Math.round((((az%360)+360)%360)/22.5)%16];
}
function vecBearing(vx, vy){ return ((Math.atan2(vx, -vy)/DEG + S.north)%360+360)%360; }
/* Leaf-out and leaf-drop dates are northern-hemisphere; south of the equator
   the same season falls six months later. */
function seasonMD(){
  if(S.lat >= 0) return S.date.slice(5);
  const [Y,M,D] = S.date.split("-").map(Number);
  const d = new Date(Date.UTC(Y, M-1+6, Math.min(D, 28)));
  return String(d.getUTCMonth()+1).padStart(2,"0")+"-"+String(d.getUTCDate()).padStart(2,"0");
}
function leafOn(){
  if(!S.leafSeason) return true;
  const md = seasonMD();
  return md >= S.leafOut && md <= S.leafDrop;
}
const mdDay = md=>{ const [m,d] = md.split("-").map(Number); return Date.UTC(2001, m-1, d)/86400000; };
/* 0 → 1 over the three weeks before leaf drop. Visual only: the shade maths
   keeps full density until the leaves are off. */
function fallAmount(){
  if(!S.leafSeason || !leafOn()) return 0;
  const left = mdDay(S.leafDrop) - mdDay(seasonMD());
  return clamp((24 - left)/21, 0, 1);
}
function bearingVec(az){
  const a = (az - S.north)*DEG;
  return {x:Math.sin(a), y:-Math.cos(a)};
}

/* ============================================================ shade geometry */
function treeCrown(t){
  const sh = SHAPES[t.shape] || SHAPES.round;
  return {cb: t.height*sh.base, top: t.height, R: t.spread/2, fn: sh.r};
}
function treeDiscs(t, u, cot){
  const {cb, top, R, fn} = treeCrown(t);
  const N = 13, out = [];
  for(let i=0;i<=N;i++){
    const f = i/N, z = cb + (top-cb)*f;
    const r = Math.max(0.4, R*fn(f));
    out.push({x: t.x + u.x*z*cot, y: t.y + u.y*z*cot, r2: r*r});
  }
  for(let i=0;i<3;i++){
    const z = cb*i/3;
    out.push({x:t.x + u.x*z*cot, y:t.y + u.y*z*cot, r2: Math.pow(Math.max(.4, t.height*.012),2)});
  }
  return out;
}
function sweptRect(cx, cy, w, h, rotDeg, height, u, cot){
  const L = Math.min(800, height*cot), a = -rotDeg*DEG;
  const d = rot2(u.x*L, u.y*L, a);
  return {ox:cx, oy:cy, a, dx:d.x, dy:d.y, hw:w/2, hh:h/2};
}
function inSwept(sh, px, py){
  const q = rot2(px-sh.ox, py-sh.oy, sh.a);
  let lo = 0, hi = 1;
  const axes = [[q.x, sh.dx, sh.hw],[q.y, sh.dy, sh.hh]];
  for(const [v,dv,half] of axes){
    if(Math.abs(dv) < 1e-9){ if(Math.abs(v) > half) return false; }
    else{
      let t1 = (v-half)/dv, t2 = (v+half)/dv;
      if(t1>t2){ const s=t1; t1=t2; t2=s; }
      lo = Math.max(lo,t1); hi = Math.min(hi,t2);
      if(lo > hi) return false;
    }
  }
  return true;
}
/* An extruded outline drags its shadow along the sun vector: test the swept solid
   by walking back down that vector and asking whether we land inside the footprint. */
function polyShadow(o, u, cot, hgt){
  const world = worldPoly(o);
  const L = Math.min(800, (hgt ?? o.height) * cot);
  const b = bbox(world);
  const step = Math.max(1.2, Math.min(b.w, b.h)*0.42);
  return {poly:world, dx:u.x*L, dy:u.y*L, n:clamp(Math.ceil(L/step), 6, 90)};
}
function inPolyShadow(ps, px, py){
  for(let i=0;i<=ps.n;i++){
    const t = i/ps.n;
    if(pointInPoly(ps.poly, px - ps.dx*t, py - ps.dy*t)) return true;
  }
  return false;
}
function fenceCasters(u, cot){
  if(!S.fence.on || S.fence.height <= 0) return [];
  const sides = ensureFenceSides(), H = S.fence.height, out = [];
  for(const e of boundaryEdges()){
    if(!sides[e.i] || e.len < .2) continue;
    out.push({sh: sweptRect(e.mx, e.my, e.len, .35,
                            Math.atan2(e.B.y-e.A.y, e.B.x-e.A.x)/DEG, H, u, cot),
              dens:S.fence.density});
  }
  return out;
}
function casters(minutes){
  const sp = solarPos(minutes);
  if(sp.el <= 0) return null;
  const dir = bearingVec(sp.az);
  const u = {x:-dir.x, y:-dir.y};
  const cot = 1/Math.tan(Math.max(1.2, sp.el)*DEG);
  const leaves = leafOn();
  const trees = [], rects = [], polys = [];
  for(const o of S.objects){
    if(o.type === "tree"){
      const dens = o.evergreen ? (o.density ?? .9) : (leaves ? (o.density ?? .85) : .12);
      if(dens <= .02) continue;
      trees.push({discs: treeDiscs(o, u, cot), dens});
    } else if((o.type === "structure" || o.type === "deck") && o.poly && o.poly.length > 2){
      /* a raised deck throws real shade; a ground-level patio does not */
      const H = o.type === "deck" ? deckHeight(o) : o.height;
      if(H > 1) polys.push({ps: polyShadow(o, u, cot, H), dens:1});
    }
  }
  rects.push(...fenceCasters(u, cot));
  return {sp, u, cot, trees, rects, polys};
}
function sunFraction(c, px, py){
  let f = 1;
  for(let i=0;i<c.polys.length;i++){
    if(inPolyShadow(c.polys[i].ps, px, py)){ f *= (1 - c.polys[i].dens); if(f < .01) return 0; }
  }
  for(let i=0;i<c.rects.length;i++){
    if(inSwept(c.rects[i].sh, px, py)){ f *= (1 - c.rects[i].dens); if(f < .01) return 0; }
  }
  for(let i=0;i<c.trees.length;i++){
    const T = c.trees[i], ds = T.discs;
    for(let j=0;j<ds.length;j++){
      const d = ds[j], dx = px-d.x, dy = py-d.y;
      if(dx*dx + dy*dy <= d.r2){ f *= (1 - T.dens); break; }
    }
    if(f < .01) return 0;
  }
  return f;
}

/* ============================================================ sun-hour engine */
let heat = null, bedStats = new Map(), computeJob = null;
let onComputeDone = ()=>{};

function scheduleCompute(){
  sceneVer++;
  scheduleHist();
  edgeCache.key = null;
  if(computeJob) cancelAnimationFrame(computeJob.raf);
  const {rise, set} = dayEdges();
  const stepMin = 15, times = [];
  for(let m=rise; m<=set; m+=stepMin) times.push(m);

  const b = yardBounds();
  const cols = clamp(Math.round(b.w/1.6), 24, 110);
  const cell = b.w/cols;
  const rows = clamp(Math.round(b.h/cell), 16, 110);
  const x0 = b.x0 + cell/2, y0 = b.y0 + cell/2;
  const mask = new Uint8Array(cols*rows);
  for(let r=0;r<rows;r++) for(let q=0;q<cols;q++)
    mask[r*cols+q] = pointInPoly(S.boundary, x0+q*cell, y0+r*cell) ? 1 : 0;

  const NB = 11;
  const bedAcc = S.objects.filter(o=>o.type==="bed").map(bd=>({b:bd, grid:new Float32Array(NB*NB)}));
  computeJob = {
    i:0, times, stepH:stepMin/60, raf:0, NB, bedAcc, wantHeat:S.heat,
    heat:{cols, rows, cell, x0, y0, mask, data:new Float32Array(cols*rows), max:0}
  };
  computeJob.raf = requestAnimationFrame(computeTick);
}
function computeTick(){
  const J = computeJob;
  if(!J) return;
  const deadline = performance.now() + 20;
  while(J.i < J.times.length && performance.now() < deadline){
    const c = casters(J.times[J.i]);
    J.i++;
    if(!c) continue;
    if(J.wantHeat){
      const A = J.heat;
      for(let r=0;r<A.rows;r++){
        const py = A.y0 + r*A.cell;
        for(let q=0;q<A.cols;q++){
          if(!A.mask[r*A.cols+q]) continue;
          const f = sunFraction(c, A.x0 + q*A.cell, py);
          if(f > 0) A.data[r*A.cols+q] += J.stepH*f;
        }
      }
    }
    for(const acc of J.bedAcc){
      const b = acc.b, a = b.rot*DEG, N = J.NB;
      for(let iy=0; iy<N; iy++){
        const ly = (iy/(N-1) - .5)*b.h;
        for(let ix=0; ix<N; ix++){
          const p = rot2((ix/(N-1) - .5)*b.w, ly, a);
          const f = sunFraction(c, b.x+p.x, b.y+p.y);
          if(f > 0) acc.grid[iy*N+ix] += J.stepH*f;
        }
      }
    }
  }
  if(J.i < J.times.length){ J.raf = requestAnimationFrame(computeTick); return; }
  let mx = 0;
  for(let i=0;i<J.heat.data.length;i++) if(J.heat.data[i] > mx) mx = J.heat.data[i];
  J.heat.max = mx;
  heat = J.wantHeat ? J.heat : null;
  bedStats = new Map();
  for(const acc of J.bedAcc){
    let sum=0, mn=99, mxb=0, good=0;
    for(const v of acc.grid){ sum+=v; if(v<mn) mn=v; if(v>mxb) mxb=v; if(v>=S.fullSun) good++; }
    bedStats.set(acc.b.id, {avg:sum/acc.grid.length, min:mn, max:mxb,
                            pct:Math.round(100*good/acc.grid.length), grid:acc.grid, N:J.NB});
  }
  computeJob = null;
  onComputeDone();
}

/* ============================================================ property lines */
function objReach(o){
  if(o.type === "tree") return o.spread/2;
  if(o.poly) { const b = bbox(worldPoly(o)); return Math.max(b.w,b.h)/2; }
  return Math.hypot(o.w||0, o.h||0)/2;
}
/* distance from an item to every edge of the lot, named by where that edge faces */
function lineDistances(o){
  const reach = objReach(o), out = [];
  for(const e of boundaryEdges()){
    if(e.len < .2) continue;
    const d = distToSeg(o.x,o.y,e.A.x,e.A.y,e.B.x,e.B.y).d;
    out.push({bear:e.bear, name:e.name, d, over:reach-d, len:e.len});
  }
  out.sort((a,b)=>a.d-b.d);
  return out;
}
function nearestLine(o){
  const L = lineDistances(o);
  return L.length ? L[0] : {name:"—", d:0, over:-1};
}
function insideLot(o){ return pointInPoly(S.boundary, o.x, o.y); }

/* ============================================================ three.js scene */
const canvas = document.getElementById("gl");
let renderer, scene, camera, perspectiveCamera, planCamera, sunLight, hemi, fillLight, groundMesh, gridLines, majorLines,
    post, sky, trees, lawnMat, apronMat,
    fenceGroup, heatMesh, measureLine, edgeLine;
const objGroup = new THREE.Group();
const helperGroup = new THREE.Group();
const meshes = new Map();
let dirty = true, playing = false, playTimer = null;
const orbit = {az:0, el:46, dist:190, tx:0, ty:0, tz:0};
let camAnim = null;
let activeView = "v3d", bootFlyTimer = null;

function mulberry(a){
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function markDirty(){ dirty = true; }
/* Overlays (grid, outlines, heat map) sit just above the ground. */
const OVER = .06;
/* Anything that changes shadows (sun, objects, fence, lot) bumps this; camera moves do not. */
let shadowStamp = 0;
function markShadows(){ shadowStamp++; dirty = true; }

const SKYSTOPS = [
  {el:-12, top:0x060912, bot:0x121a2e, sun:0x223055, i:0.0,  amb:0x1b2440, ai:0.30, cl:0.25},
  {el: -2, top:0x121c38, bot:0x4a3c54, sun:0xff9a5c, i:0.12, amb:0x3a3f60, ai:0.55, cl:0.55},
  {el:  3, top:0x1e3768, bot:0xf2a768, sun:0xffb163, i:1.25, amb:0x516385, ai:0.72, cl:0.85},
  {el: 12, top:0x2a5595, bot:0xf7c79a, sun:0xffd2a1, i:2.30, amb:0x6d85ab, ai:0.80, cl:1.0},
  {el: 30, top:0x2f68b8, bot:0xbdd8f2, sun:0xfff0d2, i:3.05, amb:0x93b4d8, ai:0.88, cl:1.0},
  {el: 60, top:0x2a63c4, bot:0xcae1f7, sun:0xfff8ea, i:3.35, amb:0xa8c6e6, ai:0.95, cl:1.0}
];
function lerpStops(el){
  const a = SKYSTOPS;
  let i = 0;
  while(i < a.length-2 && el > a[i+1].el) i++;
  const s0 = a[i], s1 = a[i+1];
  const t = clamp((el - s0.el)/(s1.el - s0.el), 0, 1);
  const mix = (x,y)=> new THREE.Color(x).lerp(new THREE.Color(y), t);
  return {top:mix(s0.top,s1.top), bot:mix(s0.bot,s1.bot), sun:mix(s0.sun,s1.sun), amb:mix(s0.amb,s1.amb),
          i:s0.i+(s1.i-s0.i)*t, ai:s0.ai+(s1.ai-s0.ai)*t, cl:s0.cl+(s1.cl-s0.cl)*t};
}

/* ---------- textures ---------- */
function cv(n){ const c = document.createElement("canvas"); c.width = c.height = n; return c; }
function tex(c, rep){
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if(rep) t.repeat.set(rep, rep);
  return t;
}
function soilTexture(){
  const N = 256, c = cv(N), g = c.getContext("2d"), rnd = mulberry(29);
  g.fillStyle = "#3d2b1e"; g.fillRect(0,0,N,N);
  for(let i=0;i<18000;i++){
    const v = rnd();
    g.fillStyle = v>.66 ? "rgba(96,70,47,.75)" : v>.33 ? "rgba(38,26,18,.75)" : "rgba(70,50,34,.6)";
    g.fillRect(rnd()*N, rnd()*N, 2, 2);
  }
  return tex(c, 1);
}
function deckTexture(){
  const N = 512, c = cv(N), g = c.getContext("2d"), rnd = mulberry(53), boards = 8, bw = N/boards;
  for(let i=0;i<boards;i++){
    const l = .34 + rnd()*.09;
    g.fillStyle = `hsl(${26+rnd()*9}, ${27+rnd()*11}%, ${l*100}%)`;
    g.fillRect(i*bw, 0, bw, N);
    for(let k=0;k<220;k++){
      g.fillStyle = `rgba(0,0,0,${.03+rnd()*.06})`;
      g.fillRect(i*bw + rnd()*bw, rnd()*N, 1 + rnd()*bw*.55, 1);
    }
    g.fillStyle = "rgba(0,0,0,.36)"; g.fillRect(i*bw, 0, 1.7, N);
  }
  return tex(c, 1/6);
}
let TEX = {};

/* ---------- materials ---------- */
let MAT_WALL, MAT_ROOF, MAT_TIMBER;
/* schematic mode: flat untextured solids plus a crisp wire outline */
const MAT_SIMPLE = {
  structure: new THREE.MeshStandardMaterial({color:0x2c3742, roughness:1, metalness:0, flatShading:true}),
  deck:      new THREE.MeshStandardMaterial({color:0x3d3527, roughness:1, metalness:0, flatShading:true}),
  bed:       new THREE.MeshStandardMaterial({color:0x3a2e22, roughness:1, metalness:0, flatShading:true}),
  soil:      new THREE.MeshStandardMaterial({color:0x241c14, roughness:1, metalness:0}),
  trunk:     new THREE.MeshStandardMaterial({color:0x7d6045, roughness:1, metalness:0, flatShading:true}),
  driveway:  new THREE.MeshStandardMaterial({color:0x303b49, roughness:1, metalness:0}),
  sidewalk:  new THREE.MeshStandardMaterial({color:0x656c75, roughness:1, metalness:0})
};
const MAT_PAVING = Object.fromEntries(Object.entries(PAVING).map(([type,p])=>
  [type,new THREE.MeshStandardMaterial({color:p.color,roughness:.95,metalness:0})]));
const WIRE = {
  structure: 0x9fd0ff, deck: 0xf0c98a, bed: 0xd9b48a,
  leafy: 0x8fe0b0, evergreen: 0x74cfe0
};
function wireOf(geo, color, opacity){
  return new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20),
    new THREE.LineBasicMaterial({color, transparent:true, opacity:opacity ?? .85, depthWrite:false}));
}
function addWire(grp, mesh, color){
  const w = wireOf(mesh.geometry, color);
  w.position.copy(mesh.position);
  w.renderOrder = 4;
  grp.add(w);
}
function initMaterials(){
  /* Extrusion and roof UVs are in feet: siding boards ~0.6 ft, shingle courses ~5 in. */
  const siding = sidingTextures(1/8, 1/4.8);
  MAT_WALL = new THREE.MeshStandardMaterial({...siding, roughness:.75, metalness:0});
  const shingles = shingleTextures(1/3.4, 1/3.4);
  MAT_ROOF = new THREE.MeshStandardMaterial({...shingles, roughness:.92, metalness:0,
    side:THREE.DoubleSide, flatShading:true});
  MAT_TIMBER = new THREE.MeshStandardMaterial({color:0x7a5a3c, roughness:.9, metalness:0});
}

function canopyRadius({R, fn}){
  // Refine the profile maximum, including crowns widest between sample heights.
  const N = 128;
  let best = 0;
  for(let i=1;i<=N;i++) if(fn(i/N) > fn(best/N)) best = i;
  let lo = Math.max(0, (best-1)/N), hi = Math.min(1, (best+1)/N);
  for(let i=0;i<32;i++){
    const a = lo+(hi-lo)/3, b = hi-(hi-lo)/3;
    if(fn(a) < fn(b)) lo = a; else hi = b;
  }
  return R*Math.max(fn(best/N), fn((lo+hi)/2));
}

/* Schematic trees have only a ground-level canopy perimeter; picking is planar. */
function buildTreeSimple(grp, t, crown){
  const col = t.evergreen ? WIRE.evergreen : WIRE.leafy;
  const Rw = canopyRadius(crown), pts = [], N = 64;
  grp.userData.canopyRadius = Rw;
  for(let i=0;i<N;i++){
    const a = i/N*Math.PI*2;
    pts.push(Math.cos(a)*Rw, .07, Math.sin(a)*Rw);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pts,3));
  const wire = new THREE.LineLoop(geo,
    new THREE.LineBasicMaterial({color:col, transparent:true, opacity:.72, depthWrite:false}));
  wire.renderOrder = 4;
  wire.raycast = ()=>{}; // The whole canopy disk is tested in pickObject, not a thick line.
  grp.add(wire);
}

function buildTree(t){
  const grp = new THREE.Group();
  const {cb, top, R, fn} = treeCrown(t);
  const bare = !t.evergreen && !leafOn();
  const trunkR = Math.max(.16, t.height*.0135);

  if(S.simple){ buildTreeSimple(grp, t, {cb, top, R, fn}); return grp; }

  const sh = SHAPES[t.shape] || SHAPES.round;
  grp.add(trees.build(t, {bare, fall:fallAmount(), crownBase:sh.base, profile:sh.r}));

  const r0 = Math.max(.5, trunkR*2.1);
  const ring = new THREE.Mesh(new THREE.RingGeometry(r0, r0+.3, 28),
    new THREE.MeshBasicMaterial({color:0x000000, transparent:true, opacity:.7, depthWrite:false, side:THREE.DoubleSide}));
  ring.rotation.x = -Math.PI/2; ring.position.y = OVER; ring.renderOrder = 3; grp.add(ring);
  const ring2 = new THREE.Mesh(new THREE.RingGeometry(r0+.3, r0+.45, 28),
    new THREE.MeshBasicMaterial({color:0xffffff, transparent:true, opacity:.45, depthWrite:false, side:THREE.DoubleSide}));
  ring2.rotation.x = -Math.PI/2; ring2.position.y = OVER; ring2.renderOrder = 3; grp.add(ring2);
  return grp;
}

/* ---------- outlines to geometry ---------- */
function polyShape(poly){
  const s = new THREE.Shape();
  poly.forEach((p,i)=> i ? s.lineTo(p.x, -p.y) : s.moveTo(p.x, -p.y));
  s.closePath();
  return s;
}
function extrudePoly(poly, depth){
  const g = new THREE.ExtrudeGeometry(polyShape(poly), {depth, bevelEnabled:false, curveSegments:1});
  g.rotateX(-Math.PI/2);
  return g;
}
function flatPoly(poly){
  const g = new THREE.ShapeGeometry(polyShape(poly));
  g.rotateX(-Math.PI/2);
  return g;
}
function hipRoof(poly, peak, overhang){
  const c = polyCentroid(poly);
  let avg = 0;
  for(const p of poly) avg += Math.hypot(p.x-c.x, p.y-c.y);
  avg = Math.max(.5, avg/poly.length);
  const s = 1 + overhang/avg;
  const outer = poly.map(p=>({x:c.x+(p.x-c.x)*s, y:c.y+(p.y-c.y)*s}));
  const topR  = poly.map(p=>({x:c.x+(p.x-c.x)*.42, y:c.y+(p.y-c.y)*.42}));
  const v = [], uv = [];
  const P = (q,yy)=>[q.x, yy, q.y];
  const tri = (a,b,cc, ua,ub,uc)=>{
    v.push(a[0],a[1],a[2], b[0],b[1],b[2], cc[0],cc[1],cc[2]);
    uv.push(ua[0],ua[1], ub[0],ub[1], uc[0],uc[1]);
  };
  for(let i=0;i<poly.length;i++){
    const j = (i+1)%poly.length;
    const w = Math.hypot(outer[j].x-outer[i].x, outer[j].y-outer[i].y);
    const sl = Math.hypot(topR[i].x-outer[i].x, topR[i].y-outer[i].y, peak);
    tri(P(outer[i],0), P(outer[j],0), P(topR[j],peak), [0,0],[w,0],[w,sl]);
    tri(P(outer[i],0), P(topR[j],peak), P(topR[i],peak), [0,0],[w,sl],[0,sl]);
  }
  for(let i=1;i<poly.length-1;i++)
    tri(P(topR[0],peak), P(topR[i],peak), P(topR[i+1],peak),
        [topR[0].x,topR[0].y],[topR[i].x,topR[i].y],[topR[i+1].x,topR[i+1].y]);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(v,3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv,2));
  g.computeVertexNormals();
  return g;
}
/* ---------- building details ----------
   Foundation, corner boards, fascia and soffit, windows and a door, generated
   for any outline and merged per material so a house costs a handful of draw
   calls. Coordinates are the building's local plan (x, y) → scene (x, z). */
const MAT_TRIM = new THREE.MeshStandardMaterial({color:0xf1eee7, roughness:.55, metalness:0});
const MAT_GLASS = new THREE.MeshStandardMaterial({color:0x1b2733, roughness:.06, metalness:.85, envMapIntensity:1.4});
const MAT_FOUND = new THREE.MeshStandardMaterial({color:0x8d887e, roughness:.95, metalness:0});
const MAT_DOOR = new THREE.MeshStandardMaterial({color:0x34414d, roughness:.45, metalness:0});
const _m4 = new THREE.Matrix4(), _q4 = new THREE.Quaternion(), _up4 = new THREE.Vector3(0,1,0);
function placedBox(w, h, d, x, y, z, rotY){
  const g = new THREE.BoxGeometry(w, h, d);
  _q4.setFromAxisAngle(_up4, rotY);
  g.applyMatrix4(_m4.compose(new THREE.Vector3(x, y, z), _q4, new THREE.Vector3(1,1,1)));
  return g;
}
function scaledPoly(poly, grow){
  const c = polyCentroid(poly);
  let avg = 0;
  for(const p of poly) avg += Math.hypot(p.x-c.x, p.y-c.y);
  avg = Math.max(.5, avg/poly.length);
  const s = 1 + grow/avg;
  return poly.map(p=>({x:c.x+(p.x-c.x)*s, y:c.y+(p.y-c.y)*s}));
}
function buildingDetails(o, poly, eave){
  const parts = {trim:[], glass:[], found:[], door:[]};
  const c = polyCentroid(poly);
  const overhang = Math.min(1.6, eave*.12);

  /* foundation band, a hand's width proud of the siding */
  const fnd = extrudePoly(scaledPoly(poly, .12), .9);
  parts.found.push(fnd);

  /* fascia board and soffit around the roof edge */
  const outer = scaledPoly(poly, overhang);
  for(let i=0;i<outer.length;i++){
    const A = outer[i], B = outer[(i+1)%outer.length], len = Math.hypot(B.x-A.x, B.y-A.y);
    parts.trim.push(placedBox(len+.1, .75, .14, (A.x+B.x)/2, eave-.28, (A.y+B.y)/2, -Math.atan2(B.y-A.y, B.x-A.x)));
  }
  /* soffit: the roof-edge outline, facing down */
  const soffit = flatPoly(outer).toNonIndexed();
  const sp = soffit.attributes.position, sn = soffit.attributes.normal;
  for(let i=0;i<sp.count;i+=3){
    const x = sp.getX(i+1), y = sp.getY(i+1), z = sp.getZ(i+1);
    sp.setXYZ(i+1, sp.getX(i+2), sp.getY(i+2), sp.getZ(i+2));
    sp.setXYZ(i+2, x, y, z);
  }
  for(let i=0;i<sn.count;i++) sn.setXYZ(i, 0, -1, 0);
  soffit.translate(0, eave-.02, 0);
  parts.trim.push(soffit);

  /* which wall gets the door: the one facing the nearest deck or patio */
  let doorWall = -1, best = Infinity;
  const decks = S.objects.filter(d=>d.type === "deck");
  const edges = poly.map((A,i)=>{
    const B = poly[(i+1)%poly.length], len = Math.hypot(B.x-A.x, B.y-A.y);
    const dx = (B.x-A.x)/(len||1), dy = (B.y-A.y)/(len||1);
    let nx = dy, ny = -dx;
    const mx = (A.x+B.x)/2, my = (A.y+B.y)/2;
    if(nx*(mx-c.x) + ny*(my-c.y) < 0){ nx = -nx; ny = -ny; }
    return {A, B, len, dx, dy, nx, ny, mx, my};
  });
  edges.forEach((e,i)=>{
    if(e.len < 6) return;
    for(const d of decks){
      const p = localOf(o, d.x, d.y), dist = Math.hypot(p.x-e.mx, p.y-e.my);
      if((p.x-e.mx)*e.nx + (p.y-e.my)*e.ny > 0 && dist < best){ best = dist; doorWall = i; }
    }
  });
  if(doorWall < 0) doorWall = edges.reduce((bi,e,i,a)=>e.len > a[bi].len ? i : bi, 0);

  const opening = (e, t, w, h, sill, glass)=>{
    const x = e.A.x + e.dx*t, y = e.A.y + e.dy*t, rot = -Math.atan2(e.dy, e.dx);
    const out = .06;
    parts.trim.push(placedBox(w+.5, h+.5, .16, x + e.nx*out, sill + h/2, y + e.ny*out, rot));
    const pane = placedBox(w, h, .1, x + e.nx*(out+.05), sill + h/2, y + e.ny*(out+.05), rot);
    (glass ? parts.glass : parts.door).push(pane);
    if(glass){
      /* muntins and a sill */
      parts.trim.push(placedBox(.12, h, .06, x + e.nx*(out+.11), sill + h/2, y + e.ny*(out+.11), rot));
      parts.trim.push(placedBox(w, .12, .06, x + e.nx*(out+.11), sill + h/2, y + e.ny*(out+.11), rot));
      parts.trim.push(placedBox(w+.8, .2, .45, x + e.nx*(out+.12), sill - .25, y + e.ny*(out+.12), rot));
    }
  };
  const rows = eave >= 16 ? [3, eave - 5.6] : eave >= 7 ? [3] : [];
  edges.forEach((e,i)=>{
    /* corner board at the start of every wall */
    parts.trim.push(placedBox(.5, eave-.9, .5, e.A.x, .9 + (eave-.9)/2, e.A.y, -Math.atan2(e.dy, e.dx)));
    if(e.len < 7 || !rows.length) return;
    const doorAt = i === doorWall ? e.len*(e.len > 20 ? .38 : .5) : null;
    if(doorAt != null) opening(e, doorAt, 3, 6.8, .9, false);
    const n = Math.max(1, Math.floor(e.len/11));
    for(let k=0;k<n;k++){
      const t = (k+.5)*e.len/n;
      for(const [r, sill] of rows.entries()){
        if(r === 0 && doorAt != null && Math.abs(t - doorAt) < 4.5) continue;
        if(t < 2.6 || t > e.len - 2.6) continue;
        opening(e, t, 3, Math.min(4.2, eave - sill - 1.4), sill, true);
      }
    }
  });
  const grp = new THREE.Group();
  for(const [key, mat] of [["trim",MAT_TRIM],["glass",MAT_GLASS],["found",MAT_FOUND],["door",MAT_DOOR]]){
    if(!parts[key].length) continue;
    const geos = parts[key].map(g=>{ const n = g.index ? g.toNonIndexed() : g; n.deleteAttribute("uv"); return n; });
    const m = new THREE.Mesh(mergeGeometries(geos, false), mat);
    m.castShadow = key !== "glass"; m.receiveShadow = true;
    grp.add(m);
  }
  return grp;
}
function buildStructure(o){
  const grp = new THREE.Group();
  const poly = o.poly && o.poly.length > 2 ? o.poly : rectPoly(12,10);
  const eave = Math.max(.6, o.height*.68), peak = Math.max(o.height - eave, .1);
  const walls = new THREE.Mesh(extrudePoly(poly, eave), S.simple ? MAT_SIMPLE.structure : MAT_WALL);
  walls.castShadow = walls.receiveShadow = true;
  grp.add(walls);
  const roof = new THREE.Mesh(hipRoof(poly, peak, Math.min(1.6, eave*.12)),
    S.simple ? MAT_SIMPLE.structure : MAT_ROOF);
  roof.position.y = eave;
  roof.castShadow = roof.receiveShadow = true;
  grp.add(roof);
  if(S.simple){ addWire(grp, walls, WIRE.structure); addWire(grp, roof, WIRE.structure); }
  else grp.add(buildingDetails(o, poly, eave));
  return grp;
}
function deckHeight(o){ return Math.max(.1, o.height ?? .5); }
const SURFACES = {concrete:"Broom-finished concrete", pavers:"Concrete pavers", wood:"Wood decking"};
function deckSurface(o){ return SURFACES[o.surface] ? o.surface : /patio/i.test(o.name||"") ? "concrete" : "wood"; }
/* One shared material per surface; top-face UVs are in feet. */
const deckMats = {};
function deckMaterial(kind){
  if(deckMats[kind]) return deckMats[kind];
  let mat;
  if(kind === "concrete"){
    const t = concreteTile();
    for(const x of [t.map, t.roughnessMap, t.normalMap]) x.repeat.set(1/5, 1/5);   // 5 ft control joints
    mat = new THREE.MeshStandardMaterial({...t, roughness:1, metalness:0});
  } else if(kind === "pavers"){
    const t = paverTextures();
    for(const x of [t.map, t.normalMap]) x.repeat.set(1/5.3, 1/5.3);                 // 8 in × 16 in pavers
    mat = new THREE.MeshStandardMaterial({...t, roughness:.9, metalness:0});
  } else mat = new THREE.MeshStandardMaterial({map:TEX.deck, roughness:.85, metalness:0});
  return deckMats[kind] = mat;
}
function buildDeck(o){
  const poly = o.poly && o.poly.length > 2 ? o.poly : rectPoly(16,12);
  const H = deckHeight(o);
  const mat = S.simple ? MAT_SIMPLE.deck : deckMaterial(deckSurface(o));
  const m = new THREE.Mesh(extrudePoly(poly, H), mat);
  m.castShadow = m.receiveShadow = true;
  const grp = new THREE.Group();
  grp.add(m);
  if(S.simple) addWire(grp, m, WIRE.deck);
  /* anything you could fall off gets a rail, which also throws a real shadow */
  else if(H >= 2){
    const rail = new THREE.Group();
    const postMat = new THREE.MeshStandardMaterial({color:0x6d543a, roughness:.9, metalness:0});
    const n = poly.length;
    for(let i=0;i<n;i++){
      const A = poly[i], B = poly[(i+1)%n];
      const len = Math.hypot(B.x-A.x, B.y-A.y);
      const steps = Math.max(1, Math.round(len/6));
      for(let k=0;k<steps;k++){
        const f = k/steps, px = A.x+(B.x-A.x)*f, py = A.y+(B.y-A.y)*f;
        const post = new THREE.Mesh(new THREE.BoxGeometry(.3, 3.2, .3), postMat);
        post.position.set(px, H+1.6, py);
        post.castShadow = true;
        rail.add(post);
      }
      const top = new THREE.Mesh(new THREE.BoxGeometry(len, .22, .3), postMat);
      top.position.set((A.x+B.x)/2, H+3.15, (A.y+B.y)/2);
      top.rotation.y = -Math.atan2(B.y-A.y, B.x-A.x);
      top.castShadow = true;
      rail.add(top);
    }
    grp.add(rail);
  }
  return grp;
}
function buildPaved(o){
  const preset = PAVING[o.type], grp = new THREE.Group();
  const poly = o.poly?.length > 2 ? o.poly : rectPoly(preset.w,preset.h);
  const slab = new THREE.Mesh(extrudePoly(poly,.12),S.simple ? MAT_SIMPLE[o.type] : MAT_PAVING[o.type]);
  slab.receiveShadow = true;
  grp.add(slab);
  if(S.simple) addWire(grp,slab,preset.wire);
  return grp;
}
function buildBed(b){
  const grp = new THREE.Group();
  const wall = .55;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(b.w, wall, b.h),
    S.simple ? MAT_SIMPLE.bed : MAT_TIMBER);
  frame.position.y = wall/2;
  frame.castShadow = frame.receiveShadow = true;
  grp.add(frame);
  if(S.simple) addWire(grp, frame, WIRE.bed);
  const soilMat = S.simple ? MAT_SIMPLE.soil
    : new THREE.MeshStandardMaterial({roughness:1, metalness:0});
  if(!S.simple && TEX.soil){
    soilMat.map = TEX.soil.clone(); soilMat.map.needsUpdate = true;
    soilMat.map.repeat.set(Math.max(1,b.w/6), Math.max(1,b.h/6));
  }
  const soil = new THREE.Mesh(new THREE.BoxGeometry(b.w-.5, .28, b.h-.5), soilMat);
  soil.position.y = wall - .02;
  soil.receiveShadow = true;
  grp.add(soil);
  return grp;
}

/* ---------- fence, by style, per side ---------- */
function buildFence(){
  if(fenceGroup){ scene.remove(fenceGroup); disposeTree(fenceGroup); fenceGroup = null; }
  const sides = ensureFenceSides();
  markShadows();
  if(!S.fence.on || S.fence.height <= 0 || !sides.some(Boolean)) return;
  const st = FENCE_STYLES[S.fence.style] || FENCE_STYLES.picket;
  const H = S.fence.height, g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({color:st.color, roughness:st.rough, metalness:st.metal});
  const segs = boundaryEdges().filter(e=>sides[e.i] && e.len > .3);
  if(!segs.length) return;

  if(S.simple){
    /* one flat panel per side plus its outline — enough to read height and position */
    const smat = new THREE.MeshStandardMaterial({color:0x2b3a33, roughness:1, metalness:0,
      transparent:true, opacity:.5});
    for(const s of segs){
      const box = new THREE.BoxGeometry(s.len, H, .18);
      const m = new THREE.Mesh(box, smat);
      m.position.set(s.mx, H/2, s.my);
      m.rotation.y = -Math.atan2(s.B.y-s.A.y, s.B.x-s.A.x);
      m.castShadow = st.dens > .6; m.receiveShadow = true;
      g.add(m);
      const w = wireOf(box, 0x86e0c0, .55);
      w.position.copy(m.position); w.rotation.copy(m.rotation); w.renderOrder = 4;
      g.add(w);
    }
    fenceGroup = g;
    scene.add(g);
    return;
  }

  if(st.kind === "picket" || st.kind === "mesh"){
    const gap = st.kind === "mesh" ? .22 : .42;
    const wdt = st.kind === "mesh" ? .035 : .055;
    let total = 0;
    for(const s of segs) total += Math.floor(s.len/gap);
    if(total > 0){
      const pick = new THREE.InstancedMesh(new THREE.BoxGeometry(wdt, H*.94, wdt), mat, total);
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1,1,1);
      const up = new THREE.Vector3(0,1,0);
      let k = 0;
      for(const s of segs){
        const n = Math.floor(s.len/gap);
        q.setFromAxisAngle(up, -Math.atan2(s.B.y-s.A.y, s.B.x-s.A.x));
        for(let i=0;i<n;i++){
          const f = (i+.5)/n;
          m.compose(new THREE.Vector3(s.A.x+(s.B.x-s.A.x)*f, H*.47+.06, s.A.y+(s.B.y-s.A.y)*f), q, sc);
          pick.setMatrixAt(k++, m);
        }
      }
      pick.instanceMatrix.needsUpdate = true;
      g.add(pick);
    }
  }
  for(const s of segs){
    const ang = -Math.atan2(s.B.y-s.A.y, s.B.x-s.A.x);
    const mx = s.mx, mz = s.my;
    if(st.kind === "panel"){
      const panel = new THREE.Mesh(new THREE.BoxGeometry(s.len, H, .16), mat);
      panel.position.set(mx, H/2, mz); panel.rotation.y = ang;
      panel.castShadow = panel.receiveShadow = true; g.add(panel);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(s.len, .12, .3), mat);
      cap.position.set(mx, H+.06, mz); cap.rotation.y = ang;
      cap.castShadow = true; g.add(cap);
    } else if(st.kind === "hedge"){
      const hedgeMat = new THREE.MeshStandardMaterial({color:st.color, roughness:1, metalness:0, flatShading:true});
      const hd = new THREE.Mesh(new THREE.BoxGeometry(s.len, H, 2.2, Math.max(2,Math.round(s.len/3)), 3, 2), hedgeMat);
      const pa = hd.geometry.attributes.position, rr = mulberry(s.i*31+7);
      for(let i=0;i<pa.count;i++)
        pa.setXYZ(i, pa.getX(i)+(rr()-.5)*.5, pa.getY(i)+(rr()-.5)*.4, pa.getZ(i)+(rr()-.5)*.55);
      hd.geometry.computeVertexNormals();
      hd.position.set(mx, H/2, mz); hd.rotation.y = ang;
      hd.castShadow = hd.receiveShadow = true; g.add(hd);
      continue;
    } else {
      const rails = st.kind === "rail" ? [H*.35, H*.75] : [H*.14, H*.93];
      for(const ry of rails){
        const rail = new THREE.Mesh(new THREE.BoxGeometry(s.len, st.kind === "rail" ? .22 : .14,
                                                          st.kind === "rail" ? .16 : .085), mat);
        rail.position.set(mx, ry, mz); rail.rotation.y = ang;
        rail.castShadow = true; g.add(rail);
      }
    }
    const posts = Math.max(1, Math.round(s.len/(st.kind === "rail" ? 9 : 7)));
    for(let i=0;i<=posts;i++){
      const f = i/posts;
      const pw = st.kind === "rail" ? .28 : .16;
      const post = new THREE.Mesh(new THREE.BoxGeometry(pw, H+.3, pw), mat);
      post.position.set(s.A.x+(s.B.x-s.A.x)*f, (H+.3)/2, s.A.y+(s.B.y-s.A.y)*f);
      post.rotation.y = ang;
      post.castShadow = post.receiveShadow = true; g.add(post);
    }
  }
  fenceGroup = g;
  scene.add(g);
  markShadows();
}

/* ---------- ground, boundary, grid ---------- */
let lawnTex = null;
const stripeUniform = {value:new THREE.Vector2(1, 0)};
function lawnMaterial(repeat, stripes){
  lawnTex ??= lawnTextures(1);
  const map = lawnTex.map.clone(), normalMap = lawnTex.normalMap.clone();
  for(const t of [map, normalMap]){ t.repeat.set(repeat, repeat); t.needsUpdate = true; }
  const mat = new THREE.MeshStandardMaterial({map, normalMap,
    normalScale:new THREE.Vector2(.8,.8), roughness:.95, metalness:0});
  /* world-space colour drift hides the texture repeat; mowing stripes run
     along the grid's axis, 6 ft wide (coords in feet) */
  mat.onBeforeCompile = shader=>{
    shader.uniforms.uStripe = stripeUniform;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vGroundXZ;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGroundXZ = (modelMatrix * vec4(position, 1.0)).xz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vGroundXZ;\nuniform vec2 uStripe;")
      .replace("#include <map_fragment>", `#include <map_fragment>
        vec2 gp = vGroundXZ * .3048;
        float macro = sin(gp.x*.071 + sin(gp.y*.053)*2.) * sin(gp.y*.067 + sin(gp.x*.041)*2.);
        float micro = sin(gp.x*.37 + gp.y*.21) * sin(gp.y*.31 - gp.x*.17);
        diffuseColor.rgb *= .92 + .1*macro + .04*micro;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb*vec3(1.06,1.,.84), .5 + .5*macro);
        float along = dot(vGroundXZ, vec2(-uStripe.y, uStripe.x));
        float stripe = smoothstep(-.15, .15, sin(along * 3.14159 / 6.));
        diffuseColor.rgb *= mix(1., mix(.965, 1.035, stripe), ${stripes ? "1." : "0."});`);
  };
  return mat;
}
function buildGround(){
  if(groundMesh){ scene.remove(groundMesh); groundMesh.geometry.dispose(); }
  if(!lawnMat){ lawnMat = lawnMaterial(1/6.5, true); apronMat = lawnMaterial(2600/6.5, false); apronMat.color.setRGB(.9,.92,.86); }
  const mat = S.simple
    ? new THREE.MeshStandardMaterial({color:0x1d2731, roughness:1, metalness:0})
    : lawnMat;
  groundMesh = new THREE.Mesh(flatPoly(S.boundary), mat);
  groundMesh.receiveShadow = true;
  groundMesh.name = "ground";
  scene.add(groundMesh);
  let apron = scene.getObjectByName("apron");
  if(!apron){
    apron = new THREE.Mesh(new THREE.PlaneGeometry(2600,2600), apronMat);
    apron.rotateX(-Math.PI/2); apron.position.y = -.09; apron.name = "apron";
    apron.receiveShadow = true;
    scene.add(apron);
  }
  apron.material = S.simple ? new THREE.MeshStandardMaterial({color:0x11171d, roughness:1}) : apronMat;
  buildEdgeLine();
  buildGrid();
  markShadows();
}
function buildEdgeLine(){
  if(edgeLine){ helperGroup.remove(edgeLine); edgeLine.geometry.dispose(); edgeLine = null; }
  const pts = [], p = S.boundary;
  for(let i=0,j=p.length-1;i<p.length;j=i++) pts.push(p[j].x,0,p[j].y, p[i].x,0,p[i].y);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pts,3));
  edgeLine = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
    color:0xffd79a, transparent:true, opacity:S.simple ? .9 : .55, depthWrite:false}));
  edgeLine.position.y = OVER + .01;
  helperGroup.add(edgeLine);
}
function buildGrid(){
  if(gridLines){ helperGroup.remove(gridLines); gridLines.geometry.dispose(); gridLines = null; }
  if(majorLines){ helperGroup.remove(majorLines); majorLines.geometry.dispose(); majorLines = null; }
  const ga = gridFrame().angle*DEG;
  stripeUniform.value.set(Math.cos(ga), Math.sin(ga));
  if(!S.showGrid) return;
  const polygon = S.boundary.map(worldToGrid);
  const b = bbox(polygon), g = S.grid, pts = [], major = [], step = Math.max(.6, g/4);
  const add = (into,x0,y0,x1,y1)=>{
    const L = Math.hypot(x1-x0, y1-y0), n = Math.max(1, Math.ceil(L/step));
    for(let i=0;i<n;i++){
      const t0 = i/n, t1 = (i+1)/n;
      if(!pointInPoly(polygon, x0+(x1-x0)*(t0+t1)/2, y0+(y1-y0)*(t0+t1)/2)) continue;
      const A = gridToWorld({x:x0+(x1-x0)*t0,y:y0+(y1-y0)*t0});
      const B = gridToWorld({x:x0+(x1-x0)*t1,y:y0+(y1-y0)*t1});
      into.push(A.x,0,A.y, B.x,0,B.y);
    }
  };
  /* in the simple view every fifth line is called out, so the grid reads as a ruler */
  const isMajor = v => S.simple && Math.abs(v/(g*5) - Math.round(v/(g*5))) < 1e-6;
  for(let x = Math.ceil(b.x0/g)*g; x <= b.x1; x += g) add(isMajor(x)?major:pts, x, b.y0, x, b.y1);
  for(let y = Math.ceil(b.y0/g)*g; y <= b.y1; y += g) add(isMajor(y)?major:pts, b.x0, y, b.x1, y);
  const mk = (arr, opacity, color)=>{
    if(!arr.length) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(arr,3));
    const m = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({
      color, transparent:true, opacity, depthWrite:false}));
    m.position.y = OVER;
    helperGroup.add(m);
    return m;
  };
  gridLines = mk(pts, S.simple ? .34 : .05, 0xffffff);
  majorLines = mk(major, .8, 0x8fc4ff);
}

/* ---------- sun-hours overlay ---------- */
/* The overlay is drawn before ACES tone mapping, which would wash its ramp out.
   Pre-invert the tone curve so the colours land on screen as designed.
   (Mirrors three's ACESFilmicToneMapping.) */
const HEAT_GAIN = 4;
function acesJS(c, exposure){
  const k = exposure/.6, v = [c[0]*k, c[1]*k, c[2]*k];
  const a = [.59719*v[0] + .35458*v[1] + .04823*v[2],
             .07600*v[0] + .90834*v[1] + .01566*v[2],
             .02840*v[0] + .13383*v[1] + .83777*v[2]];
  const f = x=>(x*(x+.0245786) - .000090537)/(x*(.983729*x + .4329510) + .238081);
  const r = a.map(f);
  return [1.60475*r[0] - .53108*r[1] - .07367*r[2],
          -.10208*r[0] + 1.10813*r[1] - .00605*r[2],
          -.00327*r[0] - .07276*r[1] + 1.07602*r[2]].map(x=>clamp(x,0,1));
}
const toLin = u=>{ u /= 255; return u <= .04045 ? u/12.92 : Math.pow((u+.055)/1.055, 2.4); };
const toSRGB = l=>255*(l <= .0031308 ? l*12.92 : 1.055*Math.pow(l, 1/2.4) - .055);
/* sRGB display colour → sRGB texel that, times HEAT_GAIN and tone mapped, shows that colour */
function preToneMap(rgb, exposure){
  const want = rgb.map(toLin).map(x=>Math.min(x, .97));
  let L = want.slice();
  for(let i=0;i<24;i++){
    const got = acesJS(L, exposure);
    L = L.map((x,j)=>clamp(x*(want[j]+1e-4)/(got[j]+1e-4), 0, HEAT_GAIN));
  }
  return L.map(x=>clamp(toSRGB(x/HEAT_GAIN), 0, 255));
}
function heatTexture(){
  const {cols, rows, data, max, mask} = heat;
  const UP = 4, W = cols*UP, H = rows*UP;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d"), img = g.createImageData(W,H);
  const stops = [[29,36,69],[44,95,116],[201,154,54],[255,238,194]];
  const sample = (fx,fy)=>{
    const x = clamp(fx,0,cols-1.001), y = clamp(fy,0,rows-1.001);
    const x0 = Math.floor(x), y0 = Math.floor(y), tx = x-x0, ty = y-y0;
    const v00=data[y0*cols+x0], v10=data[y0*cols+x0+1], v01=data[(y0+1)*cols+x0], v11=data[(y0+1)*cols+x0+1];
    return (v00*(1-tx)+v10*tx)*(1-ty) + (v01*(1-tx)+v11*tx)*ty;
  };
  const inside = (fx,fy)=>mask[clamp(Math.round(fy),0,rows-1)*cols + clamp(Math.round(fx),0,cols-1)];
  const thr = S.fullSun;
  const exposure = renderer.toneMappingExposure || 1, lut = [];
  for(let i=0;i<=255;i++){
    const f = i/255*(stops.length-1), j = Math.min(stops.length-2, Math.floor(f)), k = f-j;
    lut.push(preToneMap([0,1,2].map(c=>stops[j][c]+(stops[j+1][c]-stops[j][c])*k), exposure));
  }
  const white = preToneMap([255,255,255], exposure);
  for(let py=0;py<H;py++) for(let px=0;px<W;px++){
    const fx = px/UP - .5, fy = py/UP - .5, o = (py*W+px)*4;
    if(!inside(fx,fy)){ img.data[o+3] = 0; continue; }
    const v = sample(fx,fy), t = clamp(v/Math.max(.001,max),0,1);
    let [R, G, Bb] = lut[Math.round(t*255)];
    const vr = sample(fx+1/UP, fy), vd = sample(fx, fy+1/UP);
    if((v-thr)*(vr-thr) < 0 || (v-thr)*(vd-thr) < 0) [R, G, Bb] = white;
    img.data[o]=R; img.data[o+1]=G; img.data[o+2]=Bb; img.data[o+3]=205;
  }
  g.putImageData(img,0,0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.minFilter = THREE.LinearFilter;
  return t;
}
function refreshHeat(){
  if(heatMesh){
    helperGroup.remove(heatMesh);
    if(heatMesh.material.map) heatMesh.material.map.dispose();
    heatMesh.material.dispose(); heatMesh.geometry.dispose(); heatMesh = null;
  }
  document.getElementById("legend").style.display = (S.heat && heat) ? "block" : "none";
  if(!S.heat || !heat) return;
  const geo = new THREE.PlaneGeometry(heat.cols*heat.cell, heat.rows*heat.cell);
  geo.rotateX(-Math.PI/2);
  heatMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
    map:heatTexture(), color:new THREE.Color(HEAT_GAIN, HEAT_GAIN, HEAT_GAIN), transparent:true, opacity:.82, depthWrite:false}));
  heatMesh.position.set(heat.x0 + (heat.cols-1)*heat.cell/2, OVER + .03, heat.y0 + (heat.rows-1)*heat.cell/2);
  heatMesh.renderOrder = 2;
  helperGroup.add(heatMesh);
  document.getElementById("legmax").textContent = heat.max.toFixed(1)+" h";
  document.getElementById("legline").textContent = S.fullSun+" h line";
}

/* ---------- assembly ---------- */
function disposeTree(root){
  root.traverse(n=>{
    if(n.geometry && !n.geometry.userData.shared) n.geometry.dispose();
    if(n.material?.userData?.uniforms) n.material.dispose();
  });
}
function buildFor(o){
  return o.type === "tree" ? buildTree(o)
       : o.type === "bed" ? buildBed(o)
       : o.type === "deck" ? buildDeck(o)
       : isPaved(o) ? buildPaved(o)
       : buildStructure(o);
}
function rebuildObject(o){
  const old = meshes.get(o.id);
  if(old){ objGroup.remove(old); disposeTree(old); meshes.delete(o.id); }
  const m = buildFor(o);
  m.position.set(o.x, 0, o.y);
  m.rotation.y = -(o.rot||0)*DEG;
  m.traverse(n=>{ n.userData.id = o.id; });
  objGroup.add(m);
  meshes.set(o.id, m);
  shadowStamp++;
  if(activeView === "vplan") applyCamera();
}
function rebuildAll(){
  for(const [id,m] of meshes){ objGroup.remove(m); disposeTree(m); }
  meshes.clear();
  for(const o of S.objects) rebuildObject(o);
  buildFence();
  markDirty();
}
function placeObject(o){
  const m = meshes.get(o.id);
  if(!m) return rebuildObject(o);
  m.position.set(o.x, 0, o.y);
  m.rotation.y = -(o.rot||0)*DEG;
  markShadows();
}
let pendingRebuild = null, rebuildQueued = false;
function queueRebuild(o){
  pendingRebuild = o;
  if(rebuildQueued) return;
  rebuildQueued = true;
  requestAnimationFrame(()=>{
    rebuildQueued = false;
    if(pendingRebuild){ rebuildObject(pendingRebuild); updateSelection(); pendingRebuild = null; }
  });
}

/* ============================================================ selection ---- */
const BOUNDARY = "boundary";
function selected(){
  if(S.sel === BOUNDARY) return {id:BOUNDARY, type:"boundary", name:"Property line",
                                 x:0, y:0, rot:0, poly:S.boundary};
  return S.objects.find(o=>o.id === S.sel) || null;
}
let selRing = null, activeNode = null;
function updateSelection(){
  if(selRing){ helperGroup.remove(selRing); selRing.geometry.dispose(); selRing = null; }
  const o = selected();
  if(o && o.type !== "boundary"){
    if(o.type === "tree"){
      const geo = new THREE.RingGeometry(o.spread/2, o.spread/2 + .55, 64);
      geo.rotateX(-Math.PI/2);
      selRing = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({color:0xffb43f,
        transparent:true, opacity:.85, side:THREE.DoubleSide, depthWrite:false}));
      selRing.position.set(o.x, OVER + .1, o.y);
    } else {
      const pts = [];
      if(o.poly){
        const w = worldPoly(o);
        for(let i=0,j=w.length-1;i<w.length;j=i++) pts.push(w[j].x,0,w[j].y, w[i].x,0,w[i].y);
      } else {
        const hw = o.w/2+.4, hd = o.h/2+.4;
        const c = [[-hw,-hd],[hw,-hd],[hw,hd],[-hw,hd]].map(q=>{
          const r = rot2(q[0], q[1], o.rot*DEG);
          return [o.x+r.x, o.y+r.y];
        });
        for(let i=0;i<4;i++){ const j=(i+1)%4; pts.push(c[i][0],0,c[i][1], c[j][0],0,c[j][1]); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(pts,3));
      selRing = new THREE.LineSegments(g, new THREE.LineBasicMaterial({color:0xffb43f}));
      selRing.position.y = OVER + .11;
    }
    selRing.renderOrder = 4;
    helperGroup.add(selRing);
  }
  markDirty();
}
function localOf(o, gx, gy){
  const r = rot2(gx - o.x, gy - o.y, -(o.rot||0)*DEG);
  return {x:r.x, y:r.y};
}
function afterBoundaryChange(full){
  ensureFenceSides();
  const b = yardBounds();
  S.yard = {w:b.w, h:b.h};
  if(S.boundaryImage) S.boundaryImage.geometryEdited = true;
  if(S.gridFrame) S.gridFrame.modified = true;
  buildEdgeLine();
  if(full){ buildGround(); buildFence(); scheduleCompute(); drawList(); }
  markDirty();
}
function applyImportedBoundary({points, labels, reference, source}){
  if(!Array.isArray(points) || points.length < 3 || points.length > 128
      || points.some(p=>!Number.isFinite(p.x) || !Number.isFinite(p.y))
      || !Number.isInteger(reference?.edgeIndex) || !points[reference.edgeIndex]
      || !Number.isFinite(reference.lengthFeet) || reference.lengthFeet <= 0){
    throw new Error("The imported boundary needs a valid outline and a known side length.");
  }
  const invalid = window.PropertyImageImport.algorithms.validate(points);
  if(invalid) throw new Error(invalid);
  const b = bbox(points), current = yardBounds();
  if(b.w < .1 || b.h < .1 || b.w > 900 || b.h > 900 || polyArea(points) < .01){
    throw new Error("The scaled property must be between 0.1 and 900 feet across each axis. Check the reference length.");
  }
  pushHist();
  S.boundary = points.map(p=>({x:p.x-b.cx+current.cx, y:p.y-b.cy+current.cy}));
  S.boundaryLabels = points.map((p,i)=>typeof labels?.[i] === "string" ? labels[i].trim().slice(0,80) : "");
  S.gridFrame = null;
  S.fence.sides = points.map(()=>true);
  S.boundaryImage = {source, reference:{...reference}, geometryEdited:false};
  S.boundaryImageDraft = null;
  nodeEdit = true; activeNode = null; panelFor = "init";
  afterBoundaryChange(true);
  S.boundaryImage.geometryEdited = false;
  select(BOUNDARY);
  setView("vplan", true);
  pushHist();
  if(window.innerWidth <= 1020) openSheet(true);
  toast("Property imported and scaled. Existing objects were kept; review their placement.");
}
function scaleBoundaryFromEdge(k, lengthFeet){
  const edge = boundaryEdges()[k];
  if(!edge || edge.len < .000001 || !Number.isFinite(lengthFeet) || lengthFeet <= 0){
    toast("Enter a positive length in feet for the selected side."); return;
  }
  const factor = lengthFeet/edge.len, b = yardBounds();
  if(b.w*factor > 900 || b.h*factor > 900 || Math.min(b.w,b.h)*factor < .1){
    toast("The scaled outline must stay within 0.1 to 900 feet across each axis."); return;
  }
  pushHist();
  for(const p of S.boundary){
    p.x = b.cx + (p.x-b.cx)*factor; p.y = b.cy + (p.y-b.cy)*factor;
  }
  if(S.gridFrame){
    const p = S.gridFrame.origin;
    p.x = b.cx + (p.x-b.cx)*factor; p.y = b.cy + (p.y-b.cy)*factor;
  }
  afterBoundaryChange(true);
  if(S.boundaryImage) S.boundaryImage.reference = {edgeIndex:k, lengthFeet};
  panelFor = "init"; drawPanel(); updateSelection();
  pushHist(); setView("vplan", true);
  toast("All boundary lengths scaled proportionally.");
}

/* ============================================================ sun ---------- */
const WARM = new THREE.Color(1, .55, .3), NOON = new THREE.Color(1, .97, .92);
let skyKey = null;
function updateSun(){
  const sp = solarPos(S.minutes);
  const k = lerpStops(sp.el);
  const azRel = (sp.az - S.north)*DEG;
  const ce = Math.cos(Math.max(sp.el,-8)*DEG), se = Math.sin(Math.max(sp.el,-8)*DEG);
  const dir = new THREE.Vector3(Math.sin(azRel)*ce, se, -Math.cos(azRel)*ce).normalize();
  const b = yardBounds(), span = Math.max(b.w, b.h), cx = b.cx, cz = b.cy;
  sunLight.position.set(cx + dir.x*span*1.6, dir.y*span*1.6, cz + dir.z*span*1.6);
  sunLight.target.position.set(cx, 0, cz);
  sunLight.target.updateMatrixWorld();
  sunLight.visible = sp.el > 0;
  const R = span*.8, sc = sunLight.shadow.camera;
  sc.left = -R; sc.right = R; sc.top = R; sc.bottom = -R;
  sc.near = span*.4; sc.far = span*3.4;
  sc.updateProjectionMatrix();

  if(S.simple){
    /* quiet, even backdrop so the plan lines carry the picture, while shadows
       still land where they really land (intensities ×π: physical light units) */
    sky.hide();
    scene.background = new THREE.Color(0x0d141c);
    scene.fog.color.setHex(0x0d141c);
    sunLight.intensity = Math.min(k.i, 1.05)*Math.PI;
    sunLight.color.setHex(0xffffff);
    hemi.visible = true;
    hemi.color.setHex(0x6c8299); hemi.groundColor.setHex(0x232b35); hemi.intensity = .5*Math.PI;
    fillLight.intensity = .1*Math.PI;
    fillLight.position.set(cx - dir.x*span, span*.5, cz - dir.z*span);
    renderer.toneMappingExposure = .9;
    skyKey = null;
    return sp;
  }

  /* Realistic: direct sun from the solar maths, fill from the sky (HDRI or
     physical sky), both following the same sun direction. */
  const up = THREE.MathUtils.smoothstep(sp.el, -2, 6);
  const warmth = 1 - THREE.MathUtils.smoothstep(sp.el, 2, 25);
  sunLight.color.copy(NOON).lerp(WARM, warmth);
  sunLight.intensity = 3.2*up*(.55 + .45*THREE.MathUtils.smoothstep(sp.el, 0, 30));
  hemi.visible = false;
  fillLight.intensity = 0;
  const daylight = THREE.MathUtils.smoothstep(sp.el, -8, 8);
  const key = [prefs.sky, dir.x.toFixed(4), dir.y.toFixed(4), dir.z.toFixed(4)].join("|");
  if(key !== skyKey){ skyKey = key; sky.update(dir, daylight); }
  renderer.toneMappingExposure = prefs.exposure;
  return sp;
}

/* ============================================================ camera ------- */
const _up = new THREE.Vector3(), _fwd = new THREE.Vector3();
function planFitDistance(b){
  const aspect = window.innerWidth/window.innerHeight;
  return Math.max(b.h, b.w/aspect)*1.2/(2*Math.tan(perspectiveCamera.fov*DEG/2));
}
function updateCameraProjection(){
  const aspect = window.innerWidth/window.innerHeight;
  perspectiveCamera.aspect = aspect;
  perspectiveCamera.updateProjectionMatrix();
  const half = Math.tan(perspectiveCamera.fov*DEG/2)*orbit.dist;
  planCamera.left = -half*aspect; planCamera.right = half*aspect;
  planCamera.top = half; planCamera.bottom = -half;
  planCamera.updateProjectionMatrix();
}
function applyCamera(){
  camera = activeView === "vplan" ? planCamera : perspectiveCamera;
  post?.setCamera(camera);
  if(activeView === "vplan"){
    orbit.el = 90; orbit.ty = 0;
    updateCameraProjection();
    // Distance controls scale, not clearance above tall objects when zooming in.
    const height = S.objects.reduce((h,o)=>Math.max(h, (o.height||0)+10), (S.fence.height||0)+10);
    const a = orbit.az*DEG;
    camera.position.set(orbit.tx, Math.max(Math.min(orbit.dist, 1200), height), orbit.tz);
    camera.up.set(-Math.sin(a), 0, -Math.cos(a));
    camera.lookAt(orbit.tx, 0, orbit.tz);
    camera.updateMatrixWorld(true);
    markDirty();
    return;
  }
  const el = clamp(orbit.el, 1, 90), a = orbit.az*DEG, e = el*DEG, d = orbit.dist;
  camera.position.set(
    orbit.tx + Math.sin(a)*Math.cos(e)*d,
    orbit.ty + Math.sin(e)*d,
    orbit.tz + Math.cos(a)*Math.cos(e)*d
  );
  // straight down puts the view direction parallel to world up, which is undefined:
  // roll "up" onto the ground plane as we approach nadir
  const blend = clamp((el - 76)/12, 0, 1);
  _fwd.set(-Math.sin(a), 0, -Math.cos(a));
  _up.set(0,1,0).lerp(_fwd, blend);
  if(_up.lengthSq() < 1e-6) _up.copy(_fwd);
  camera.up.copy(_up.normalize());
  camera.lookAt(orbit.tx, orbit.ty, orbit.tz);
  camera.updateMatrixWorld(true);
  markDirty();
}
function flyTo(target, ms){
  clearTimeout(bootFlyTimer); bootFlyTimer = null;
  if(activeView === "vplan"){
    camAnim = null;
    Object.assign(orbit, target);
    applyCamera();
    return;
  }
  const from = {az:orbit.az, el:orbit.el, dist:orbit.dist, tx:orbit.tx, ty:orbit.ty, tz:orbit.tz};
  const t0 = performance.now();
  if(window.matchMedia("(prefers-reduced-motion: reduce)").matches) ms = 1;
  camAnim = ()=>{
    const p = clamp((performance.now()-t0)/ms, 0, 1);
    const e = p<.5 ? 2*p*p : 1-Math.pow(-2*p+2,2)/2;
    for(const k in target) orbit[k] = from[k] + (target[k]-from[k])*e;
    applyCamera();
    if(p >= 1) camAnim = null;
  };
}
function setView(v, recenter){
  activeView = v;
  camAnim = null;
  ["vplan","v3d","veye"].forEach(id=>document.getElementById(id).setAttribute("aria-pressed", id === v));
  applyCamera();
  const b = gridBounds(), span = Math.max(b.w, b.h), center = gridToWorld({x:b.cx,y:b.cy});
  // keep wherever the person has panned to unless they explicitly ask to reframe
  const base = recenter ? {tx:center.x, tz:center.y, az:-gridFrame().angle} : {tx:orbit.tx, tz:orbit.tz};
  if(v === "vplan") flyTo(Object.assign({el:90, az:orbit.az, dist:recenter?planFitDistance(b):orbit.dist, ty:0}, base), 600);
  if(v === "v3d")   flyTo(Object.assign({el:46, az:orbit.az, dist:recenter?span*1.55:orbit.dist, ty:0}, base), 600);
  if(v === "veye")  flyTo(Object.assign({el:1.6, az:orbit.az, dist:recenter?span*.62:orbit.dist, ty:5}, base), 850);
}
function fitYard(){
  if(activeView === "vplan"){ setView("vplan", true); return; }
  activeView = "v3d";
  const b = gridBounds(), span = Math.max(b.w, b.h), center = gridToWorld({x:b.cx,y:b.cy});
  flyTo({el:46, az:-gridFrame().angle, dist:span*1.55, tx:center.x, ty:0, tz:center.y}, 700);
  ["vplan","v3d","veye"].forEach(id=>document.getElementById(id).setAttribute("aria-pressed", id === "v3d"));
}
function focusSelection(){
  const o = selected();
  if(!o || o.type === "boundary"){ fitYard(); return; }
  const reach = o.type === "boundary" ? Math.max(yardBounds().w, yardBounds().h) : objReach(o)*2.6 + 16;
  flyTo({tx:o.x, tz:o.y, dist:clamp(reach*1.5, 22, 900), ty:0}, 550);
}
/* slide the pivot to a point on the ground */
function recenterOn(x, z, ms){
  flyTo({tx:x, ty:0, tz:z}, ms || 420);
}
function nudge(dx, dz){
  camAnim = null;
  /* same screen-relative axes as panBy: up arrow pushes the view away from you */
  const a = orbit.az*DEG, c = Math.cos(a), s = Math.sin(a), k = orbit.dist*.06;
  orbit.tx += (c*dx + s*dz)*k;
  orbit.tz += (-s*dx + c*dz)*k;
  applyCamera();
}

/* ============================================================ render ------- */
let lastLeaf = null;
function resize(){
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  post?.setSize(w, h);
  updateCameraProjection();
  markDirty();
}
/* Rendering is on demand: nothing draws unless something changed. While the
   view is being dragged or animated, frames render at 1× pixel ratio without
   ambient occlusion, then one full-quality frame lands when it settles. */
let lastSunKey = "", lastShadowStamp = -1, lastInput = 0, lowQ = false;
function qualityPreset(){ return QUALITY[prefs.quality] || QUALITY.balanced; }
function applyQuality(low){
  const q = qualityPreset(), dpr = Math.min(window.devicePixelRatio || 1, q.dpr);
  const want = low ? Math.min(dpr, 1) : dpr;
  if(renderer.getPixelRatio() !== want){
    renderer.setPixelRatio(want);
    post.setSize(window.innerWidth, window.innerHeight);
  }
  if(post.ao.configuration.halfRes !== q.half) post.ao.configuration.halfRes = q.half;
  post.setAO(q.ao && !low);
  if(sunLight.shadow.mapSize.x !== q.shadow){
    sunLight.shadow.mapSize.set(q.shadow, q.shadow);
    sunLight.shadow.map?.dispose(); sunLight.shadow.map = null;
    shadowStamp++;
  }
}
document.addEventListener("pointermove", e=>{ if(e.buttons) lastInput = performance.now(); }, {passive:true});
canvas.addEventListener("wheel", ()=>{ lastInput = performance.now(); }, {passive:true});
function loop(){
  requestAnimationFrame(loop);
  if(camAnim) camAnim();
  const now = performance.now();
  const moving = !!camAnim || playing || now - lastInput < 160;
  if(moving !== lowQ && (dirty || !moving)){ lowQ = moving; applyQuality(lowQ); dirty = true; }
  if(!dirty && !playing) return;
  dirty = false;
  const sp = updateSun();
  /* shadows depend on the sun and the yard, never on the camera */
  const sunKey = sunLight.position.x.toFixed(2)+","+sunLight.position.y.toFixed(2)+","+sunLight.position.z.toFixed(2);
  if(sunKey !== lastSunKey || shadowStamp !== lastShadowStamp){
    renderer.shadowMap.needsUpdate = true;
    lastSunKey = sunKey; lastShadowStamp = shadowStamp;
  }
  post.render();
  updateLabels();
  updateShapeEditor();
  updateReadout(sp);
  updateCompass();
}

/* ============================================================ labels ------- */
const labelHost = document.getElementById("labels");
const treeCenter = document.getElementById("treeCenter");
const labelPool = [];
const _v = new THREE.Vector3();
function project(x, y, z){
  _v.set(x, y, z).project(camera);
  return {x:(_v.x*.5+.5)*window.innerWidth, y:(-_v.y*.5+.5)*window.innerHeight, z:_v.z};
}
function updateLabels(){
  let n = 0;
  const take = cls=>{
    let el = labelPool[n];
    if(!el){ el = document.createElement("div"); labelHost.appendChild(el); labelPool.push(el); }
    el.className = "lbl "+cls; el.style.display = "block"; n++;
    return el;
  };
  for(const o of S.objects){
    if(o.type !== "bed") continue;
    const st = bedStats.get(o.id);
    if(!st) continue;
    const p = project(o.x, 1.2, o.y);
    if(p.z > 1) continue;
    const el = take(st.avg >= S.fullSun ? "sun" : "low");
    el.textContent = st.avg.toFixed(1)+" h";
    el.style.left = p.x+"px"; el.style.top = p.y+"px";
  }
  if(measure.a && (measure.b || measure.live)){
    const b = measure.b || measure.live;
    const d = Math.hypot(b.x-measure.a.x, b.y-measure.a.y);
    const p = project((measure.a.x+b.x)/2, .8, (measure.a.y+b.y)/2);
    if(p.z <= 1){
      const el = take("meas");
      const ft = Math.floor(d), inch = Math.round((d-ft)*12);
      el.textContent = d.toFixed(1)+" ft · "+ft+"' "+inch+'"';
      el.style.left = p.x+"px"; el.style.top = (p.y-14)+"px";
    }
  }
  for(let i=n;i<labelPool.length;i++) labelPool[i].style.display = "none";
  const o = selected();
  const center = S.simple && o?.type === "tree" ? project(o.x, 0, o.y) : null;
  treeCenter.hidden = !center || center.z < -1 || center.z > 1;
  if(!treeCenter.hidden){
    treeCenter.style.left = center.x+"px";
    treeCenter.style.top = center.y+"px";
  }
}
function updateReadout(sp){
  const {rise, set} = dayEdges();
  document.getElementById("clockbig").textContent = fmtTime(S.minutes);
  document.getElementById("datelbl").textContent =
    new Date(S.date+"T12:00:00").toLocaleDateString(undefined,{weekday:"short",month:"long",day:"numeric"});
  document.getElementById("rEl").textContent = sp.el > 0 ? sp.el.toFixed(1)+"°" : "below horizon";
  document.getElementById("rAz").textContent = sp.el > 0 ? Math.round(sp.az)+"° "+compassName(sp.az) : "—";
  document.getElementById("rShad").textContent = sp.el > .5
    ? (10/Math.tan(Math.max(1.2,sp.el)*DEG)).toFixed(1)+" ft" : "—";
  const ed = dayEdges();
  document.getElementById("rDay").textContent = ed.polar === "day" ? "Sun up all day"
    : ed.polar === "night" ? "Sun below horizon all day"
    : fmtTime(rise).replace(/ /,"")+" – "+fmtTime(set).replace(/ /,"");
  document.getElementById("rNoon").textContent = ed.polar === "night" ? "—"
    : fmtTime(ed.noon).replace(/ /,"")+" · "+ed.peak.toFixed(0)+"°";
  document.getElementById("loclbl").textContent = placeLabel();
  moveBead(sp);
}
let compassKey = null;
function updateCompass(){
  const rot = orbit.az - S.north, key = rot.toFixed(1);
  if(key === compassKey) return;
  compassKey = key;
  document.getElementById("compsvg").innerHTML = `
    <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="1.5"/>
    <g transform="rotate(${rot} 50 50)">
      <path d="M50 12 L57 46 L50 41 L43 46 Z" fill="#ffb43f"/>
      <path d="M50 88 L43 54 L50 59 L57 54 Z" fill="rgba(255,255,255,.3)"/>
      <text x="50" y="9" text-anchor="middle" font-size="11" font-weight="700"
            fill="#ffb43f" font-family="Archivo,sans-serif">N</text>
    </g>`;
}

/* ============================================================ outline editor
   A flat overlay rather than 3D handles: big screen-space targets, live edge
   lengths you can type into, and no raycasting to fight with. */
const shapeEdit = document.getElementById("shapeEdit");
const shapeSvg = document.getElementById("shapeSvg");
const shTip = document.getElementById("shTip");
let shPool = {nodes:[], adds:[], lens:[]}, shDrag = null, shEditingLen = null;

function shapePoolSize(n){
  const mk = (cls, host)=>{ const d = document.createElement("div"); d.className = cls; shapeEdit.appendChild(d); return d; };
  while(shPool.nodes.length < n){
    const i = shPool.nodes.length;
    const nd = mk("sh-node");
    nd.dataset.i = i;
    nd.addEventListener("pointerdown", e=>{
      e.stopPropagation(); e.preventDefault();
      nd.setPointerCapture(e.pointerId);
      activeNode = +nd.dataset.i;
      shDrag = {i:activeNode, id:e.pointerId};
      panelFor = null; drawPanel(); markDirty();
    });
    nd.addEventListener("pointermove", e=>{
      if(!shDrag || shDrag.id !== e.pointerId) return;
      const o = selected();
      if(!isPoly(o)) return;
      const g = groundAt(e.clientX, e.clientY);
      if(!g) return;
      const s = snapPt(g);
      o.poly[shDrag.i] = localOf(o, s.x, s.y);
      if(o.type === "boundary") afterBoundaryChange(false);
      else { queueRebuild(o); updateSelection(); }
      markDirty();
    });
    const release = e=>{
      if(!shDrag || shDrag.id !== e.pointerId) return;
      shDrag = null;
      const o = selected();
      if(o && o.type === "boundary") afterBoundaryChange(true); else scheduleCompute();
      drawList(); panelFor = null; drawPanel();
    };
    nd.addEventListener("pointerup", release);
    nd.addEventListener("pointercancel", release);
    nd.addEventListener("dblclick", e=>{
      e.stopPropagation();
      const o = selected();
      if(!isPoly(o) || o.poly.length < 4) return;
      if(o.type === "boundary") removeBoundaryCorner(+nd.dataset.i);
      else o.poly.splice(+nd.dataset.i, 1);
      activeNode = null;
      if(o.type === "boundary") afterBoundaryChange(true);
      else { queueRebuild(o); scheduleCompute(); }
      panelFor = null; drawPanel(); drawList();
    });
    shPool.nodes.push(nd);

    const ad = mk("sh-add");
    ad.textContent = "+";
    ad.dataset.i = i;
    ad.addEventListener("pointerdown", e=>{
      e.stopPropagation(); e.preventDefault();
      const o = selected();
      if(!isPoly(o)) return;
      const k = +ad.dataset.i, w = worldPoly(o), j = (k+1)%w.length;
      const mid = {x:(w[k].x+w[j].x)/2, y:(w[k].y+w[j].y)/2};
      if(o.type === "boundary") insertBoundaryCorner(k, mid);
      else o.poly.splice(k+1, 0, localOf(o, mid.x, mid.y));
      activeNode = k+1;
      if(o.type === "boundary") afterBoundaryChange(true);
      else { queueRebuild(o); scheduleCompute(); }
      panelFor = null; drawPanel(); drawList();
    });
    shPool.adds.push(ad);

    const ln = mk("sh-len");
    ln.dataset.i = i;
    ln.addEventListener("click", e=>{
      e.stopPropagation();
      const o = selected();
      if(!isPoly(o)) return;
      const k = +ln.dataset.i, w = worldPoly(o), j = (k+1)%w.length;
      const cur = Math.hypot(w[j].x-w[k].x, w[j].y-w[k].y);
      shEditingLen = k;
      ln.innerHTML = `<input type="text" value="${cur.toFixed(1)}"> ft`;
      const inp = ln.querySelector("input");
      inp.focus(); inp.select();
      const commit = ()=>{
        const v = parseFloat(inp.value);
        shEditingLen = null;
        if(isFinite(v) && v > .5) setEdgeLength(o, k, v);
        markDirty();
      };
      inp.addEventListener("keydown", ev=>{
        if(ev.key === "Enter"){ ev.preventDefault(); commit(); inp.blur(); }
        if(ev.key === "Escape"){ shEditingLen = null; inp.blur(); }
      });
      inp.addEventListener("blur", ()=>{ if(shEditingLen === k) commit(); });
    });
    shPool.lens.push(ln);
  }
  for(let i=0;i<shPool.nodes.length;i++){
    const on = i < n;
    shPool.nodes[i].style.display = on ? "block" : "none";
    shPool.adds[i].style.display  = on ? "block" : "none";
    shPool.lens[i].style.display  = on ? "block" : "none";
  }
}
function setEdgeLength(o, k, len){
  const w = worldPoly(o), n = w.length, j = (k+1)%n;
  const dx = w[j].x-w[k].x, dy = w[j].y-w[k].y;
  const L = Math.hypot(dx,dy) || 1;
  const nx = w[k].x + dx/L*len, ny = w[k].y + dy/L*len;
  o.poly[j] = localOf(o, nx, ny);
  if(o.type === "boundary") afterBoundaryChange(true);
  else { queueRebuild(o); scheduleCompute(); }
  panelFor = null; drawPanel(); drawList();
}
function updateShapeEditor(){
  const o = selected();
  if(!nodeEdit || !isPoly(o)){
    if(shapeEdit.classList.contains("on")){ shapeEdit.classList.remove("on"); shapePoolSize(0); }
    return;
  }
  shapeEdit.classList.add("on");
  const w = worldPoly(o), n = w.length;
  shapePoolSize(n);
  const panels = [...document.querySelectorAll("#sunpanel,#top,#compass,#dock,#inspector")]
    .filter(e=>getComputedStyle(e).display!=="none")
    .map(e=>e.getBoundingClientRect())
    .filter(r=>r.width>0 && r.height>0 && r.right>0 && r.bottom>0 && r.left<innerWidth && r.top<innerHeight);
  const hideCovered = (element, clipped)=>{
    const r = element.getBoundingClientRect();
    element.style.visibility = clipped || panels.some(p=>r.right>p.left && r.left<p.right && r.bottom>p.top && r.top<p.bottom)
      ? "hidden" : "visible";
  };
  const P = w.map(p=>project(p.x, .35, p.y));
  shapeSvg.innerHTML = `<defs><mask id="shape-panel-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="${innerWidth}" height="${innerHeight}">
    <rect width="${innerWidth}" height="${innerHeight}" fill="white"/>
    ${panels.map(p=>`<rect x="${p.left}" y="${p.top}" width="${p.width}" height="${p.height}" fill="black"/>`).join("")}
    </mask></defs><path mask="url(#shape-panel-mask)" d="${P.map((p,i)=>(i?"L":"M")+p.x.toFixed(1)+" "+p.y.toFixed(1)).join(" ")} Z"
    fill="rgba(255,180,63,.07)" stroke="#ffb43f" stroke-width="2" stroke-linejoin="round"/>`;
  for(let i=0;i<n;i++){
    const nd = shPool.nodes[i];
    nd.dataset.i = i;
    nd.classList.toggle("on", i === activeNode);
    nd.style.left = P[i].x+"px"; nd.style.top = P[i].y+"px";
    const j = (i+1)%n;
    const mx = (P[i].x+P[j].x)/2, my = (P[i].y+P[j].y)/2;
    const len = Math.hypot(w[j].x-w[i].x, w[j].y-w[i].y);
    const dx = P[j].x-P[i].x, dy = P[j].y-P[i].y;
    const sl = Math.hypot(dx,dy) || 1;
    const ox = -dy/sl*22, oy = dx/sl*22;
    const ad = shPool.adds[i];
    ad.dataset.i = i;
    ad.style.left = (mx - ox*.55)+"px"; ad.style.top = (my - oy*.55)+"px";
    const ln = shPool.lens[i];
    ln.dataset.i = i;
    ln.style.left = (mx + ox)+"px"; ln.style.top = (my + oy)+"px";
    if(shEditingLen !== i) ln.textContent =
      (o.type === "boundary" && S.boundaryLabels[i] ? S.boundaryLabels[i]+" · " : "") + len.toFixed(1)+" ft";
    hideCovered(nd,P[i].z>1 || P[i].z<-1);
    const clipped = P[i].z>1 || P[i].z<-1 || P[j].z>1 || P[j].z<-1;
    hideCovered(ad,clipped); hideCovered(ln,clipped);
  }
  shTip.textContent = o.type === "boundary"
    ? "Drag a corner · + adds one · tap a length to type it · double-tap a corner to remove"
    : "Reshaping " + o.name + " · tap a length to type an exact dimension";
  hideCovered(shTip,false);
}

/* ============================================================ sun arc ------ */
const arcSvg = document.getElementById("arc");
let arcGeom = null;
function buildArc(){
  const {rise, set, peak} = dayEdges();
  /* draw at the arc's real aspect so labels don't stretch in a wide timeline */
  const W = Math.max(220, Math.round(arcSvg.clientWidth*78/Math.max(1, arcSvg.clientHeight))) || 320;
  arcSvg.setAttribute("viewBox", "0 0 "+W+" 78");
  const x0 = 22, x1 = W-22, base = 58, top = 22, pts = [], N = 70;
  for(let i=0;i<=N;i++){
    const m = rise + (set-rise)*i/N;
    pts.push([x0 + (x1-x0)*i/N, base - (Math.max(0,solarPos(m).el)/Math.max(1,peak))*(base-top)]);
  }
  arcGeom = {rise, set, peak, x0, x1, base, top, W};
  const d = pts.map((p,i)=>(i?"L":"M")+p[0].toFixed(1)+" "+p[1].toFixed(1)).join(" ");
  let ni = 0;
  for(let i=1;i<pts.length;i++) if(pts[i][1] < pts[ni][1]) ni = i;
  const noon = pts[ni], noonMin = rise + (set-rise)*ni/N;
  // keep the peak caption inside the viewBox — it used to slide up under the panel edge
  const capY = Math.max(10, noon[1] - 8);
  const capX = clamp(noon[0], x0 + 30, x1 - 30);
  arcSvg.innerHTML = `
    <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffb43f" stop-opacity=".30"/>
      <stop offset="1" stop-color="#ffb43f" stop-opacity="0"/></linearGradient></defs>
    <path d="${d} L ${x1} ${base} L ${x0} ${base} Z" fill="url(#ag)"/>
    <line x1="${x0-8}" y1="${base}" x2="${x1+8}" y2="${base}" stroke="rgba(255,255,255,.18)"/>
    <path d="${d}" fill="none" stroke="#ffb43f" stroke-width="1.8" stroke-opacity=".8"/>
    <line x1="${noon[0]}" y1="${noon[1]}" x2="${noon[0]}" y2="${base}" stroke="rgba(255,255,255,.16)" stroke-dasharray="2 3"/>
    <text x="${x0-6}" y="${base+15}" font-size="10" fill="#95a0b0" font-family="Archivo,sans-serif">${fmtTime(rise)}</text>
    <text x="${x1+6}" y="${base+15}" font-size="10" fill="#95a0b0" text-anchor="end" font-family="Archivo,sans-serif">${fmtTime(set)}</text>
    <text x="${capX}" y="${capY}" font-size="10" fill="#c3ccd8" text-anchor="middle" font-family="Archivo,sans-serif">${fmtTime(noonMin)} · ${peak.toFixed(0)}&#176; high</text>
    <circle id="aglow" cx="${x0}" cy="${base}" r="13" fill="#ffb43f" opacity=".18"/>
    <circle id="abead" cx="${x0}" cy="${base}" r="7" fill="#ffb43f" stroke="rgba(0,0,0,.35)"/>`;
}
function moveBead(sp){
  if(!arcGeom) return;
  const {rise, set, peak, x0, x1, base, top} = arcGeom;
  const t = clamp((S.minutes - rise)/Math.max(1, set - rise), 0, 1);
  const x = x0 + (x1-x0)*t;
  const y = base - (Math.max(0, sp.el)/Math.max(1,peak))*(base-top);
  const bead = document.getElementById("abead"), glow = document.getElementById("aglow");
  if(bead){ bead.setAttribute("cx",x); bead.setAttribute("cy",y); }
  if(glow){ glow.setAttribute("cx",x); glow.setAttribute("cy",y);
            glow.setAttribute("opacity", sp.el > 0 ? .18 : 0); }
}
function arcSet(clientX){
  if(!arcGeom) return;
  const r = arcSvg.getBoundingClientRect();
  const {rise, set, x0, x1, W} = arcGeom;
  const t = clamp(((clientX - r.left)/r.width*W - x0)/(x1-x0), 0, 1);
  S.minutes = Math.round(rise + (set-rise)*t);
  markDirty();
}
let arcDrag = false;
arcSvg.addEventListener("pointerdown", e=>{ arcDrag = true; arcSvg.setPointerCapture(e.pointerId); arcSet(e.clientX); });
arcSvg.addEventListener("pointermove", e=>{ if(arcDrag) arcSet(e.clientX); });
arcSvg.addEventListener("pointerup", ()=>{ arcDrag = false; });
arcSvg.addEventListener("pointercancel", ()=>{ arcDrag = false; });

/* ============================================================ pointer ------ */
const raycaster = new THREE.Raycaster();
const GROUND = new THREE.Plane(new THREE.Vector3(0,1,0), 0);
const CANOPY_PLANE = new THREE.Plane(new THREE.Vector3(0,1,0), -.07);
const pointers = new Map();
let mode = null, pinch = null, dragObj = null, dragOff = null, panGrab = null;
let measure = {a:null, b:null, live:null};

function ndc(x,y){
  const r = canvas.getBoundingClientRect();
  return {x:(x-r.left)/r.width*2-1, y:-(y-r.top)/r.height*2+1};
}
function groundAt(sx, sy){
  raycaster.setFromCamera(ndc(sx,sy), camera);
  const hit = new THREE.Vector3();
  return raycaster.ray.intersectPlane(GROUND, hit) ? {x:hit.x, y:hit.z} : null;
}
function pickObject(sx, sy){
  raycaster.setFromCamera(ndc(sx,sy), camera);
  objGroup.updateMatrixWorld(true);
  const hits = raycaster.intersectObjects(objGroup.children, true);
  if(S.simple){
    const p = raycaster.ray.intersectPlane(CANOPY_PLANE, new THREE.Vector3());
    if(p){
      for(const o of S.objects){
        if(o.type !== "tree") continue;
        const m = meshes.get(o.id), r = m?.userData.canopyRadius;
        if(r != null && (p.x-o.x)**2+(p.z-o.y)**2 <= r*r){
          hits.push({distance:raycaster.ray.origin.distanceTo(p), object:m});
        }
      }
      // Visible objects above the footprint remain selectable through its empty interior.
      hits.sort((a,b)=>a.distance-b.distance);
    }
  }
  for(const h of hits){
    const id = h.object.userData.id;
    if(id != null) return S.objects.find(o=>o.id === id) || null;
  }
  return null;
}
function snapPt(p){
  if(!S.snap) return p;
  const q = worldToGrid(p);
  return gridToWorld({x:Math.round(q.x/S.grid)*S.grid, y:Math.round(q.y/S.grid)*S.grid});
}
function grabPan(sx, sy){
  camAnim = null;
  camera.updateMatrixWorld(true);
  raycaster.setFromCamera(ndc(sx,sy), camera);
  const anchor = new THREE.Vector3();
  if(raycaster.ray.direction.y >= -1e-6 || !raycaster.ray.intersectPlane(GROUND, anchor)){
    toast("Start panning on the grid below the horizon.");
    return null;
  }
  return {anchor, plane:GROUND.clone(), horizonWarning:false};
}
function panTo(grab, sx, sy){
  if(!grab) return;
  camera.updateMatrixWorld(true);
  raycaster.setFromCamera(ndc(sx,sy), camera);
  const hit = raycaster.ray.direction.y < -1e-6
    ? raycaster.ray.intersectPlane(grab.plane, new THREE.Vector3()) : null;
  // A ground point cannot project above the horizon without moving below ground.
  // Pause at that singularity; resume the same anchor when the pointer returns.
  if(!hit){
    if(!grab.horizonWarning) toast("Drag back below the horizon to continue panning.");
    grab.horizonWarning = true;
    return;
  }
  grab.horizonWarning = false;
  const delta = grab.anchor.clone().sub(hit);
  orbit.tx += delta.x; orbit.ty += delta.y; orbit.tz += delta.z;
  applyCamera();
}
function zoomDistance(distance, grab){
  const max = activeView === "vplan" ? Math.max(1200, planFitDistance(gridBounds())*2) : 1200;
  const next = clamp(distance, 8, max), ratio = next/orbit.dist;
  if(grab){
    const a = grab.anchor;
    orbit.tx = a.x + (orbit.tx-a.x)*ratio;
    orbit.ty = a.y + (orbit.ty-a.y)*ratio;
    orbit.tz = a.z + (orbit.tz-a.z)*ratio;
  }
  orbit.dist = next;
  applyCamera();
}
canvas.addEventListener("pointerdown", e=>{
  camAnim = null;
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, {x:e.clientX, y:e.clientY});
  if(pointers.size === 2){
    mode = "pinch"; dragObj = null;
    const p = [...pointers.values()];
    pinch = {d0:Math.max(1, Math.hypot(p[0].x-p[1].x, p[0].y-p[1].y)), s0:orbit.dist,
             mx:(p[0].x+p[1].x)/2, my:(p[0].y+p[1].y)/2};
    panGrab = grabPan(pinch.mx, pinch.my);
    return;
  }
  if(pointers.size > 2) return;
  /* middle button, right button, shift, or the pan tool all mean "slide the view" */
  const wantPan = (e.button === 1 || e.button === 2 || e.shiftKey || tool === "pan");
  if(wantPan){
    e.preventDefault();
    panGrab = grabPan(e.clientX, e.clientY);
    mode = "pan";
    canvas.style.cursor = "grabbing";
    return;
  }
  if(tool === "measure"){
    const g = groundAt(e.clientX, e.clientY);
    if(g){
      const s = snapPt(g);
      if(!measure.a || measure.b) measure = {a:s, b:null, live:s};
      else measure.b = s;
      drawMeasureLine();
    }
    mode = "measure";
    return;
  }
  const hitObj = pickObject(e.clientX, e.clientY);
  if(tool !== "select" && !hitObj){
    const g = groundAt(e.clientX, e.clientY);
    if(g){ addObject(tool, snapPt(g)); mode = null; return; }
  }
  if(hitObj){
    if(hitObj.id !== S.sel){ nodeEdit = false; activeNode = null; }
    select(hitObj.id);
    const g = groundAt(e.clientX, e.clientY);
    if(g){ dragObj = hitObj; dragOff = {x:hitObj.x-g.x, y:hitObj.y-g.y}; mode = "drag"; return; }
  }
  mode = activeView === "vplan" ? "pan" : "orbit";
  if(mode === "pan"){
    panGrab = grabPan(e.clientX, e.clientY);
    canvas.style.cursor = "grabbing";
  }
  if(!hitObj && tool === "select" && !nodeEdit) select(null);
});
canvas.addEventListener("mousedown", e=>{ if(e.button === 1) e.preventDefault(); });
canvas.addEventListener("auxclick", e=>{ if(e.button === 1) e.preventDefault(); });
canvas.addEventListener("pointermove", e=>{
  const held = pointers.has(e.pointerId);
  if(!held && !(tool === "measure" && measure.a && !measure.b)) return;
  const prev = held ? pointers.get(e.pointerId) : null;
  if(held) pointers.set(e.pointerId, {x:e.clientX, y:e.clientY});
  if(mode === "pinch" && pointers.size >= 2){
    const p = [...pointers.values()];
    const d = Math.max(1, Math.hypot(p[0].x-p[1].x, p[0].y-p[1].y));
    zoomDistance(pinch.s0 * pinch.d0/d, panGrab);
    const mx = (p[0].x+p[1].x)/2, my = (p[0].y+p[1].y)/2;
    panTo(panGrab, mx, my);
    return;
  }
  if(!held && tool === "measure"){
    const g = groundAt(e.clientX, e.clientY);
    if(g){ measure.live = snapPt(g); drawMeasureLine(); }
    return;
  }
  if(mode === "drag" && dragObj){
    const g = groundAt(e.clientX, e.clientY);
    if(g){
      const np = snapPt({x:g.x+dragOff.x, y:g.y+dragOff.y});
      dragObj.x = np.x; dragObj.y = np.y;
      placeObject(dragObj); updateSelection(); drawPanel(); drawList();
    }
    return;
  }
  if(!prev) return;
  const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
  if(mode === "orbit" && activeView !== "vplan"){
    orbit.az -= dx*.3;
    orbit.el = clamp(orbit.el + dy*.3, 1, 90);
    applyCamera();
  } else if(mode === "pan"){ panTo(panGrab, e.clientX, e.clientY); }
});
function endPointer(e){
  if(mode === "pan" && e.type === "pointerup") panTo(panGrab, e.clientX, e.clientY);
  pointers.delete(e.pointerId);
  if(mode === "pinch" && pointers.size === 1){
    const p = [...pointers.values()][0];
    panGrab = grabPan(p.x, p.y);
    mode = "pan";
  }
  if(mode === "drag") scheduleCompute();
  dragObj = null;
  if(pointers.size === 0){
    if(mode !== "measure") mode = null;
    panGrab = null; pinch = null;
    canvas.style.cursor = tool === "pan" ? "grab" : tool === "select" ? "default" : "crosshair";
  }
}
canvas.addEventListener("pointerup", endPointer);
canvas.addEventListener("pointercancel", endPointer);
canvas.addEventListener("contextmenu", e=>e.preventDefault());
canvas.addEventListener("dblclick", e=>{
  const g = groundAt(e.clientX, e.clientY);
  if(g) recenterOn(g.x, g.y);
});
let lastTap = 0, lastTapPt = null;
canvas.addEventListener("pointerup", e=>{        // double-tap to re-centre on touch
  if(e.pointerType === "mouse") return;
  const now = performance.now();
  if(now - lastTap < 320 && lastTapPt && Math.hypot(e.clientX-lastTapPt.x, e.clientY-lastTapPt.y) < 26){
    const g = groundAt(e.clientX, e.clientY);
    if(g) recenterOn(g.x, g.y);
    lastTap = 0;
  } else { lastTap = now; lastTapPt = {x:e.clientX, y:e.clientY}; }
});
canvas.addEventListener("wheel", e=>{
  e.preventDefault();
  camAnim = null;
  const grab = mode === "pan" ? panGrab : activeView === "vplan" ? grabPan(e.clientX, e.clientY) : null;
  zoomDistance(orbit.dist*(e.deltaY > 0 ? 1.12 : 1/1.12), grab);
  if(mode === "pan") panTo(panGrab, e.clientX, e.clientY);
}, {passive:false});

function drawMeasureLine(){
  if(measureLine){ helperGroup.remove(measureLine); measureLine.geometry.dispose(); measureLine = null; }
  const b = measure.b || measure.live;
  if(!measure.a || !b) return;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute([measure.a.x,OVER+.2,measure.a.y, b.x,OVER+.2,b.y],3));
  measureLine = new THREE.Line(geo, new THREE.LineBasicMaterial({color:0x7fd4e8}));
  measureLine.renderOrder = 5;
  helperGroup.add(measureLine);
  markDirty();
}

/* ============================================================ objects ------ */
function addObject(kind, p){
  let o;
  const rot = gridFrame().angle;
  if(kind === "tree") o = fromPreset(PRESETS[0].n, p.x, p.y);
  else if(kind === "bed") o = {id:nid(), type:"bed", name:"Garden bed", x:p.x, y:p.y, w:12, h:4, rot};
  else if(kind === "deck") o = {id:nid(), type:"deck", name:"Deck", x:p.x, y:p.y, rot, height:.5, poly:rectPoly(16,12)};
  else if(Object.hasOwn(PAVING,kind)){
    const preset = PAVING[kind];
    o = {id:nid(),type:kind,name:preset.name,x:p.x,y:p.y,rot,poly:rectPoly(preset.w,preset.h)};
  } else o = {id:nid(), type:"structure", name:"Shed", x:p.x, y:p.y, rot, height:10, poly:rectPoly(12,10)};
  S.objects.push(o);
  rebuildObject(o);
  nodeEdit = isPaved(o); activeNode = null;
  select(o.id);
  setTool("select");
  scheduleCompute();
  if(isPaved(o)){
    setView("vplan");
    if(window.innerWidth <= 1020) openSheet(true);
    toast("Drag corners or add points to shape the "+kind+". Choose Done reshaping when finished.");
  }
}
function removeSelected(){
  if(S.sel === BOUNDARY) return;
  const m = meshes.get(S.sel);
  if(m){ objGroup.remove(m); disposeTree(m); meshes.delete(S.sel); markShadows(); }
  S.objects = S.objects.filter(o=>o.id !== S.sel);
  nodeEdit = false; activeNode = null;
  select(null);
  scheduleCompute();
}
function select(id){
  S.sel = id;
  if(id !== BOUNDARY && !S.objects.find(o=>o.id===id)){ nodeEdit = false; activeNode = null; }
  updateSelection();
  drawPanel();
  drawList();
}

/* ============================================================ inspector ---- */
const props = document.getElementById("props");
let panelFor = "init";
function slider(label, key, min, max, step, val, unit){
  return `<div class="field"><span class="lab">${label}</span>`
    + `<span class="inp"><input type="number" data-key="${key}" min="${min}" max="${max}" step="${step}" value="${val}">`
    + `<span class="u">${unit||"ft"}</span></span></div>`
    + `<div class="sliderow"><input type="range" data-key="${key}" min="${min}" max="${max}" step="${step}" value="${val}"></div>`;
}
function field(label, key, attrs, unit){
  return `<div class="field"><span class="lab">${label}</span>`
    + `<span class="inp"><input type="number" data-key="${key}" ${attrs}><span class="u">${unit||"ft"}</span></span></div>`;
}
function numRow(label, attr, val, unit, step){
  return `<div class="field"><span class="lab">${label}</span>`
    + `<span class="inp"><input type="number" ${attr} step="${step||1}" value="${val}"><span class="u">${unit||"ft"}</span></span></div>`;
}
function readRow(label, val){
  return `<div class="field"><span class="lab">${label}</span><span class="val num">${val}</span></div>`;
}
/* fill the played part of every slider track */
function syncRanges(root){
  (root||document).querySelectorAll('input[type=range]').forEach(r=>{
    const mn = parseFloat(r.min)||0, mx = parseFloat(r.max);
    const p = mx > mn ? ((parseFloat(r.value)-mn)/(mx-mn))*100 : 0;
    r.style.setProperty("--p", p.toFixed(1)+"%");
  });
}
document.addEventListener("input", e=>{ if(e.target.type === "range") syncRanges(e.target.parentNode); }, true);
function presetSelect(o){
  const groups = [];
  for(const p of PRESETS){
    let g = groups.find(x=>x.name===p.g);
    if(!g){ g = {name:p.g, items:[]}; groups.push(g); }
    g.items.push(p);
  }
  const idx = PRESETS.findIndex(p=>p.n===o.name);
  return `<select data-preset><option value="-1">${idx<0?"Custom tree":"Load a different tree…"}</option>`
    + groups.map(g=>`<optgroup label="${g.name}">`
      + g.items.map(p=>`<option value="${PRESETS.indexOf(p)}" ${PRESETS.indexOf(p)===idx?"selected":""}>${p.n}</option>`).join("")
      + `</optgroup>`).join("") + `</select>`;
}
function statHTML(st){
  const v = st.avg >= S.fullSun ? `<span class="verdict v-full">Full sun</span>`
          : st.avg >= 4 ? `<span class="verdict v-part">Part sun</span>`
          : `<span class="verdict v-shade">Shade</span>`;
  return v + `<div class="big num">${st.avg.toFixed(1)} h</div>`
    + `<div class="sub">average direct sun across this bed<br>`
    + `spans ${st.min.toFixed(1)}–${st.max.toFixed(1)} h · ${st.pct}% clears ${S.fullSun} h<br>`
    + (st.avg >= S.fullSun ? "Tomatoes and peppers are happy here."
       : st.avg >= 4 ? "Good for greens, roots and most herbs."
       : "Leafy greens only, or move the bed.") + `</div>`;
}
function lineHTML(o){
  const L = lineDistances(o).slice(0,6);
  if(!L.length) return "";
  const rows = L.map(e=>`<div>${escapeHTML(e.name)} line <b class="num">${e.d.toFixed(1)} ft</b></div>`).join("");
  const spill = L.filter(e=>e.over > .1);
  const note = !insideLot(o)
    ? `<div class="warn">This sits outside the property line.</div>`
    : spill.length
      ? `<div class="warn">Canopy reaches over the ${spill.map(e=>escapeHTML(e.name)).join(" and ")} line by `
        + spill.map(e=>e.over.toFixed(1)+" ft").join(" and ")+`.</div>`
      : `<div class="sub">Stays inside every property line.</div>`;
  return `<div class="sub" style="margin-bottom:5px">Centre to the nearest lines</div>
          <div class="lines">${rows}</div>${note}`;
}
function outlineHTML(o){
  const w = worldPoly(o);
  let html = `<div class="btnrow" style="margin-top:2px">
      <button class="btn accent" data-act="nodes" aria-pressed="${nodeEdit}">${nodeEdit?"Done reshaping":"Reshape outline"}</button>
    </div>`;
  if(nodeEdit){
    html += `<p class="hint">Drag a corner. The + between corners adds one. Tap any length to type an exact dimension. Double-tap a corner to remove it.</p>`;
    if(activeNode != null && w[activeNode]){
      const p = w[activeNode];
      html += `<h4>Corner ${activeNode+1} of ${w.length}</h4>`
        + numRow("Across", 'data-node="x"', p.x.toFixed(1), "ft", .5)
        + numRow("Up–down", 'data-node="y"', p.y.toFixed(1), "ft", .5)
        + `<div class="btnrow"><button class="btn" data-act="delnode" ${o.poly.length<4?"disabled":""}>Remove this corner</button></div>`;
    } else {
      html += `<p class="hint">Tap a corner to type its exact position.</p>`;
    }
  }
  html += readRow("Corners", o.poly.length)
       +  readRow("Area", Math.round(polyArea(w))+" sq ft")
       +  readRow("Perimeter", Math.round(polyPerimeter(w))+" ft");
  return html;
}
function boundaryMeasurementsHTML(){
  const edges = boundaryEdges();
  return `<h4>Boundary names &amp; calculated lengths</h4>`
    + edges.map(e=>`<div class="field"><label for="boundary-label-${e.i}">Side ${e.i+1} (${e.direction})<br>
        <span class="num">${e.len.toFixed(2)} ft</span></label>
        <span class="inp wide"><input id="boundary-label-${e.i}" data-boundary-label="${e.i}"
          type="text" maxlength="80" placeholder="e.g. Back" value="${escapeHTML(S.boundaryLabels[e.i] || "")}"></span></div>`).join("")
    + `<h4>Scale all sides from one measurement</h4>
       <label class="hint" for="boundary-scale-edge">Known side</label>
       <select id="boundary-scale-edge">${edges.map(e=>`<option value="${e.i}">
         Side ${e.i+1}: ${escapeHTML(e.name)} (${e.len.toFixed(2)} ft)</option>`).join("")}</select>
       <div class="field"><label for="boundary-scale-feet">Actual length</label>
         <span class="inp"><input id="boundary-scale-feet" type="number" min="0.1" step="any" placeholder="140"><span class="u">ft</span></span></div>
       <div class="btnrow"><button class="btn" data-act="scaleboundary">Scale whole boundary</button></div>
       <p class="hint">Keeps the shape and scales every boundary length proportionally. Existing objects stay at their current positions and sizes.</p>`;
}
function gridReferenceHTML(){
  const f = S.gridFrame, edges = boundaryEdges();
  const name = f?.edgeIndex != null && edges[f.edgeIndex] ? edges[f.edgeIndex].name : "saved side";
  return `<section id="boundary-grid-controls"><h4>Square the grid to a property side</h4>
    <label class="hint" for="boundary-grid-edge">Reference side</label>
    <select id="boundary-grid-edge">${edges.map(e=>`<option value="${e.i}" ${f?.edgeIndex===e.i?"selected":""}>
      Side ${e.i+1}: ${escapeHTML(e.name)}</option>`).join("")}</select>
    <label class="hint" for="boundary-grid-axis">Make this side</label>
    <select id="boundary-grid-axis"><option value="x" ${f?.axis!=="y"?"selected":""}>Horizontal (back / front)</option>
      <option value="y" ${f?.axis==="y"?"selected":""}>Vertical (left / right)</option></select>
    <div class="btnrow"><button class="btn accent" data-act="aligngrid">Use side as grid reference</button>
      <button class="btn" data-act="resetgrid" ${f?"":"disabled"}>Reset</button></div>
    <p class="hint">${f ? "Grid aligned to "+escapeHTML(name)+". " : ""}
      Grid, snapping, new shapes and the framed view share these axes. Property dimensions, existing objects and true north do not change.
      ${f?.modified ? "The outline was edited; reapply to follow the revised side." : ""}</p></section>`;
}
function drawPanel(){
  const o = selected();
  const title = document.getElementById("seltitle"), tag = document.getElementById("seltag");
  document.getElementById("inspector").classList.toggle("empty", !o);
  if(!o){
    title.textContent = "Nothing selected";
    tag.textContent = "";
    if(panelFor !== null){
      props.innerHTML = `<p class="hint">Tap anything in the yard to edit it here. Site-wide settings are in the sidebar.</p>`;
      panelFor = null;
    }
    return;
  }
  title.textContent = o.name;
  tag.textContent = o.type === "structure" ? "building" : o.type;
  const key = [o.id, nodeEdit, activeNode, o.poly?o.poly.length:0].join("|");
  if(panelFor === key){
    if(o.type === "boundary" && !props.contains(document.activeElement)){
      panelFor = "init";
      drawPanel();
      return;
    }
    props.querySelectorAll("input[data-key]").forEach(i=>{
      if(document.activeElement === i) return;
      if(i.type === "checkbox") i.checked = !!o[i.dataset.key];
      else i.value = o[i.dataset.key];
    });
    const box = props.querySelector(".stat");
    if(box){
      const st = bedStats.get(o.id);
      box.innerHTML = o.type === "bed" ? (st ? statHTML(st) : "Measuring…") : lineHTML(o);
    }
    const lb = props.querySelector(".linebox");
    if(lb) lb.innerHTML = lineHTML(o);
    syncRanges(props);
    return;
  }
  panelFor = key;
  let html = "";
  if(o.type !== "boundary")
    html += `<div class="field"><span class="lab">Name</span><span class="inp wide">`
      + `<input type="text" data-key="name" value="${String(o.name).replace(/"/g,"&quot;")}"></span></div>`;

  if(o.type === "tree"){
    html += presetSelect(o)
      + (o.note ? `<p class="profile">${o.note}</p>` : "")
      + `<h4>Crown shape</h4>`
      + `<select data-key="shape">${Object.entries(SHAPES).map(([k,v])=>`<option value="${k}" ${k===o.shape?"selected":""}>${v.label}</option>`).join("")}</select>`
      + slider("Height","height",2,90,1,o.height)
      + slider("Crown width","spread",1,80,1,o.spread)
      + slider("Canopy density","density",.1,1,.05,o.density ?? .85,"×")
      + `<div class="field"><span class="lab">Evergreen</span><input type="checkbox" class="sw" data-key="evergreen" ${o.evergreen?"checked":""}></div>`
      + `<h4>Position</h4>`
      + field("Left–right","x",`step="1" value="${o.x}"`)
      + field("Up–down","y",`step="1" value="${o.y}"`)
      + `<div class="stat">${lineHTML(o)}</div>`;
  } else if(o.type === "bed"){
    const st = bedStats.get(o.id);
    html += slider("Width","w",1,120,1,o.w)
      + slider("Depth","h",1,120,1,o.h)
      + field("Rotation","rot",`min="-180" max="180" step="1" value="${o.rot}"`,"°")
      + `<h4>Position</h4>` + field("Left–right","x",`step="1" value="${o.x}"`)
      + field("Up–down","y",`step="1" value="${o.y}"`)
      + `<div class="stat">${st?statHTML(st):"Measuring…"}</div><div class="linebox">${lineHTML(o)}</div>`;
  } else if(o.type === "boundary"){
    const b = yardBounds();
    html += outlineHTML(o)
      + (isPaved(o) ? `<p class="hint">Ground-level ${o.type === "driveway" ? "asphalt driveway" : "concrete sidewalk"}.
          Drag corners and use + to make bends, tapers or irregular shapes. It receives shade but does not act like a building.</p>` : "")
      + gridReferenceHTML()
      + boundaryMeasurementsHTML()
      + `<h4>Stretch the whole lot</h4>`
      + numRow("Width across", 'data-fitlot="w"', b.w.toFixed(0))
      + numRow("Depth", 'data-fitlot="h"', b.h.toFixed(0))
      + `<p class="hint">Fence sides, style and height are under Lot &amp; fence in the sidebar.</p>`;
  } else {
    const b = bbox(o.poly);
    html += outlineHTML(o)
      + `<h4>Overall size</h4>`
      + numRow("Width", 'data-fit="w"', b.w.toFixed(0))
      + numRow("Depth", 'data-fit="h"', b.h.toFixed(0))
      + (o.type === "structure" ? slider("Height to peak","height",4,80,1,o.height) : "")
      + (o.type === "deck" ? slider("Deck height","height",0,20,.5,(o.height ?? .5).toFixed(1))
          + `<div class="field"><span class="lab">Surface</span><span style="flex:1.4"><select data-key="surface">${
            Object.entries(SURFACES).map(([k,v])=>`<option value="${k}" ${k===deckSurface(o)?"selected":""}>${v}</option>`).join("")}</select></span></div>` : "")
      + field("Rotation","rot",`min="-180" max="180" step="1" value="${o.rot}"`,"°")
      + `<h4>Position</h4>` + field("Left–right","x",`step="1" value="${o.x}"`)
      + field("Up–down","y",`step="1" value="${o.y}"`)
      + `<div class="stat">${lineHTML(o)}</div>`;
  }
  if(o.type !== "boundary")
    html += `<div class="btnrow"><button class="btn" data-act="dup">Duplicate</button>`
      + `<button class="btn danger" data-act="del">Delete</button></div>`;
  props.innerHTML = html;
  syncRanges(props);
}
const GEOKEYS = new Set(["height","spread","density","shape","evergreen","w","h","surface"]);
props.addEventListener("input", e=>{
  const o = selected();
  if(!o) return;
  if(e.target.hasAttribute("data-preset")){
    const p = PRESETS[+e.target.value];
    if(!p) return;
    o.name = p.n; o.shape = p.s; o.height = p.h; o.spread = p.w;
    o.evergreen = p.ev; o.density = p.d; o.note = p.note;
    panelFor = null;
    rebuildObject(o); drawPanel(); drawList(); updateSelection(); scheduleCompute();
    return;
  }
  const nd = e.target.dataset.node;
  if(nd && activeNode != null){
    const v = parseFloat(e.target.value);
    if(!isFinite(v)) return;
    const w = worldPoly(o);
    w[activeNode][nd] = v;
    o.poly[activeNode] = localOf(o, w[activeNode].x, w[activeNode].y);
    if(o.type === "boundary") afterBoundaryChange(true);
    else { queueRebuild(o); scheduleCompute(); }
    drawList(); markDirty();
    return;
  }
  const fitLot = e.target.dataset.fitlot;
  if(fitLot){
    const v = Math.max(10, parseFloat(e.target.value)||10), b = yardBounds();
    scalePolyTo(S.boundary, fitLot === "w" ? v : b.w, fitLot === "h" ? v : b.h);
    afterBoundaryChange(true); drawList(); syncLotFields();
    return;
  }
  const fit = e.target.dataset.fit;
  if(fit){
    const v = Math.max(1, parseFloat(e.target.value)||1), b = bbox(o.poly);
    scalePolyTo(o.poly, fit === "w" ? v : b.w, fit === "h" ? v : b.h);
    queueRebuild(o); updateSelection(); drawList(); scheduleCompute();
    return;
  }
  const k = e.target.dataset.key;
  if(!k) return;
  if(e.target.type === "checkbox") o[k] = e.target.checked;
  else if(e.target.type === "number" || e.target.type === "range") o[k] = parseFloat(e.target.value)||0;
  else o[k] = e.target.value;
  if(GEOKEYS.has(k)) queueRebuild(o); else placeObject(o);
  if(k === "name") document.getElementById("seltitle").textContent = o.name;
  updateSelection(); drawPanel(); drawList(); scheduleCompute();
});
props.addEventListener("click", e=>{
  const btn = e.target.closest("button[data-act]");
  if(!btn) return;
  const act = btn.dataset.act, o = selected();
  if(!o) return;
  if(act === "scaleboundary" && o.type === "boundary"){
    const edge = +$("boundary-scale-edge").value, lengthFeet = +$("boundary-scale-feet").value;
    scaleBoundaryFromEdge(edge, lengthFeet);
    return;
  }
  if(act === "aligngrid" && o.type === "boundary"){
    alignGridToSide(+$("boundary-grid-edge").value,$("boundary-grid-axis").value); return;
  }
  if(act === "resetgrid" && o.type === "boundary"){ resetGridReference(); return; }
  if(act === "nodes"){
    nodeEdit = !nodeEdit;
    if(!nodeEdit) activeNode = null;
    else setView("vplan");
    panelFor = null; drawPanel(); markDirty();
  }
  if(act === "delnode" && o.poly && o.poly.length > 3 && activeNode != null){
    if(o.type === "boundary") removeBoundaryCorner(activeNode);
    else o.poly.splice(activeNode, 1);
    activeNode = null; panelFor = null;
    if(o.type === "boundary") afterBoundaryChange(true);
    else { queueRebuild(o); scheduleCompute(); }
    drawPanel(); updateSelection(); drawList();
  }
  if(act === "del") removeSelected();
  if(act === "dup"){
    const copy = JSON.parse(JSON.stringify(o));
    const offset = rot2(S.grid*2,S.grid*2,gridFrame().angle*DEG);
    copy.id = nid(); copy.x += offset.x; copy.y += offset.y;
    S.objects.push(copy); rebuildObject(copy); select(copy.id); scheduleCompute();
  }
});
props.addEventListener("change", e=>{
  if(!e.target.hasAttribute("data-boundary-label")) return;
  const k = +e.target.dataset.boundaryLabel;
  if(!S.boundary[k]) return;
  S.boundaryLabels[k] = e.target.value.trim().slice(0,80);
  scheduleHist();
  panelFor = "init"; drawPanel(); drawList(); markDirty();
});

/* ============================================================ dock lists --- */
function drawList(){
  const el = document.getElementById("objlist");
  if(el){
    const rows = [`<button data-id="${BOUNDARY}" aria-pressed="${S.sel===BOUNDARY}">
        <svg class="ic"><use href="#i-line"/></svg>
        <span class="tx"><span class="nm">Property line</span>
        <span class="mt">${S.boundary.length} corners · ${Math.round(polyArea(S.boundary))} sq ft</span></span></button>`];
    for(const o of S.objects){
      const nl = nearestLine(o);
      const near = `${nl.d.toFixed(0)}' to ${escapeHTML(nl.name)} line`;
      const st = o.type === "bed" ? bedStats.get(o.id) : null;
      const b = o.poly ? bbox(o.poly) : null;
      const mt = o.type === "tree" ? `${o.height}' × ${o.spread}' · ${near}`
        : o.type === "bed" ? `${o.w}' × ${o.h}' · ${st ? st.avg.toFixed(1)+" h sun" : near}`
        : o.type === "deck" ? `${Math.round(polyArea(o.poly))} sq ft · ${(o.height ?? .5).toFixed(1)}' high · ${near}`
        : isPaved(o) ? `${Math.round(polyArea(o.poly))} sq ft · ${o.poly.length} corners · ${near}`
        : `${b.w.toFixed(0)}' × ${b.h.toFixed(0)}' · ${o.height}' to peak`;
      const ic = o.type === "tree" ? "i-tree" : o.type === "bed" ? "i-bed"
               : o.type === "deck" ? "i-deck" : isPaved(o) ? "i-"+o.type : "i-house";
      rows.push(`<button data-id="${o.id}" aria-pressed="${o.id===S.sel}">
        <svg class="ic"><use href="#${ic}"/></svg>
        <span class="tx"><span class="nm">${o.name}</span><span class="mt">${mt}</span></span></button>`);
    }
    el.innerHTML = rows.join("");
    $("objcount").textContent = S.objects.length;
  }
  syncLotFields();
  drawFenceEdges();
}
function syncLotFields(){
  const set = (id,v)=>{ const n = document.getElementById(id); if(n) n.textContent = v; };
  set("bcount", S.boundary.length);
  set("barea", Math.round(polyArea(S.boundary))+" sq ft");
  set("bperim", Math.round(polyPerimeter(S.boundary))+" ft");
  set("boundary-image-state", S.boundaryImageDraft
    ? "Unscaled image draft: saved with your plan. Import the same picture to resume and set a known length."
    : S.boundaryImage ? "Image-based outline. Names and measurements are saved with the plan; the image itself is not included." : "");
  const b = yardBounds();
  for(const [id,v] of [["yardw", b.w],["yardh", b.h]]){
    const n = document.getElementById(id);
    if(n && document.activeElement !== n) n.value = Math.round(v);
  }
}
function drawFenceEdges(){
  const host = document.getElementById("fenceedges");
  if(!host) return;
  const sides = ensureFenceSides();
  host.innerHTML = boundaryEdges().map(e=>`
    <label class="edgerow ${sides[e.i]?"on":""}" data-edge="${e.i}">
      <span class="w"><b>${escapeHTML(e.name)}</b> side · ${e.len.toFixed(1)} ft</span>
      <input type="checkbox" class="sw" data-edge="${e.i}" ${sides[e.i]?"checked":""}>
    </label>`).join("");
}
document.getElementById("objlist").addEventListener("click", e=>{
  const b = e.target.closest("button");
  if(!b) return;
  nodeEdit = false; activeNode = null;
  select(b.dataset.id === BOUNDARY ? BOUNDARY : +b.dataset.id);
});
document.getElementById("fenceedges").addEventListener("change", e=>{
  const i = e.target.dataset.edge;
  if(i == null) return;
  ensureFenceSides()[+i] = e.target.checked;
  buildFence(); scheduleCompute(); drawFenceEdges(); markDirty();
});

/* ============================================================ controls ----- */
const $ = id => document.getElementById(id);
function toast(msg){
  const t = $("toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(()=>t.classList.remove("show"), 2000);
}
function setTool(t){
  tool = t;
  document.querySelectorAll("#top button[data-tool]").forEach(b=>
    b.setAttribute("aria-pressed", b.dataset.tool === t));
  if(t !== "measure"){ measure = {a:null,b:null,live:null}; drawMeasureLine(); }
  canvas.style.cursor = t === "pan" ? "grab" : t === "select" ? "default" : "crosshair";
}
document.querySelectorAll("#top button[data-tool]").forEach(b=>
  b.addEventListener("click", ()=>setTool(b.dataset.tool)));
$("vplan").addEventListener("click", ()=>setView("vplan"));
$("v3d").addEventListener("click", ()=>setView("v3d"));
$("veye").addEventListener("click", ()=>setView("veye"));
$("vfit").addEventListener("click", fitYard);
$("vfocus").addEventListener("click", focusSelection);

/* ---------- simple / schematic view ---------- */
function applySimpleChrome(){
  document.body.classList.toggle("simple", !!S.simple);
  $("vsimple").setAttribute("aria-pressed", !!S.simple);
  $("vsimple").title = S.simple ? "Back to the realistic view (G)" : "Simple schematic view (G)";
  const cb = $("simpleview");
  if(cb) cb.checked = !!S.simple;
}
function setSimple(v){
  if(S.simple === !!v) return;
  S.simple = !!v;
  applySimpleChrome();
  buildGround();
  rebuildAll();
  updateSun(); refreshHeat();
  markDirty();
  scheduleHist();
  toast(S.simple ? "Simple view — tree canopy outlines and grid; no tree trunks or branches" : "Realistic view");
}
$("vsimple").addEventListener("click", ()=>setSimple(!S.simple));
$("simpleview").addEventListener("change", e=>setSimple(e.target.checked));

/* ---------- layout: sidebar and sun timeline ---------- */
const root = document.documentElement;
let arcW = 0;
function syncSunH(){
  const sun = $("sunpanel").getBoundingClientRect();
  if(arcSvg.clientWidth && Math.abs(arcSvg.clientWidth - arcW) > 2){ arcW = arcSvg.clientWidth; buildArc(); }
  if(window.innerWidth > 1020) root.style.setProperty("--tlH", Math.round(sun.height) + "px");
  root.style.setProperty("--barH", $("dockbar").offsetHeight + "px");
  markDirty();
}
function setNavCollapsed(min){
  $("dock").classList.toggle("min", min);
  document.body.classList.toggle("navmin", min);
  $("dockToggle").title = min ? "Expand the sidebar" : "Collapse the sidebar";
  try{ localStorage.setItem("yard-shade-studio:navmin", min ? "1" : ""); }catch{ /* private mode */ }
  syncSunH();
}
$("dockToggle").addEventListener("click", ()=>setNavCollapsed(!$("dock").classList.contains("min")));
if(window.ResizeObserver){
  const ro = new ResizeObserver(syncSunH);
  for(const id of ["sunpanel","dockbar","dock","inspector","top"]) ro.observe($(id));
}
document.querySelectorAll("#sunpanel,#dock,#inspector,#top").forEach(panel=>
  panel.addEventListener("transitionend", syncSunH));
window.addEventListener("resize", syncSunH);
$("sunToggle").addEventListener("click", e=>{ e.stopPropagation(); toggleSun(); });
$("sunhead").addEventListener("click", toggleSun);
function toggleSun(){
  const min = $("sunpanel").classList.toggle("min");
  $("sunToggle").title = min ? "Show the sun details" : "Hide the sun details";
  syncSunH();
}
/* the compass is a steering wheel */
(function(){
  const c = $("compass");
  let spin = null;
  const ang = e=>{
    const r = c.getBoundingClientRect();
    return Math.atan2(e.clientY - (r.top+r.height/2), e.clientX - (r.left+r.width/2))/DEG;
  };
  c.addEventListener("pointerdown", e=>{
    camAnim = null;
    c.setPointerCapture(e.pointerId);
    spin = {a0:ang(e), az:orbit.az};
    e.preventDefault();
  });
  c.addEventListener("pointermove", e=>{
    if(!spin) return;
    orbit.az = spin.az + (ang(e) - spin.a0);
    applyCamera();
  });
  const stop = ()=>{ spin = null; };
  c.addEventListener("pointerup", stop);
  c.addEventListener("pointercancel", stop);
  c.addEventListener("dblclick", ()=>{ flyTo({az:0}, 420); });
})();
function showTab(tab){
  document.querySelectorAll("#tabs button").forEach(x=>x.setAttribute("aria-pressed", x.dataset.tab === tab));
  document.querySelectorAll(".pane").forEach(p=>p.classList.toggle("on", p.dataset.pane === tab));
  if($("dock").classList.contains("min")) setNavCollapsed(false);
}
document.querySelectorAll("#tabs button").forEach(b=>b.addEventListener("click", ()=>showTab(b.dataset.tab)));
$("date").addEventListener("input", e=>{ S.date = e.target.value || S.date; afterDateChange(); });
document.querySelectorAll("[data-jump]").forEach(b=>b.addEventListener("click", ()=>{
  S.date = S.date.slice(0,4)+"-"+b.dataset.jump;
  $("date").value = S.date;
  afterDateChange();
}));
function afterDateChange(){
  edgeCache.key = null;
  const {rise, set} = dayEdges();
  S.minutes = clamp(S.minutes, Math.round(rise), Math.round(set));
  buildArc();
  const leaf = leafOn();
  if(leaf !== lastLeaf){ lastLeaf = leaf; rebuildAll(); }
  else trees.setFall(objGroup, fallAmount());
  scheduleCompute();
  syncLocationUI();
  markDirty();
}
$("playbtn").addEventListener("click", e=>{
  e.stopPropagation();
  playing = !playing;
  $("playbtn").innerHTML = `<svg class="ic fill"><use href="#i-${playing?"pause":"play"}"/></svg>`;
  if(playing){
    const {rise, set} = dayEdges();
    if(S.minutes < rise || S.minutes >= set) S.minutes = rise;
    playTimer = setInterval(()=>{
      const e = dayEdges();
      S.minutes += 4;
      if(S.minutes > e.set) S.minutes = e.rise;
      markDirty();
    }, 55);
  } else clearInterval(playTimer);
});
function bindNum(id, apply){
  const el = $(id);
  if(el) el.addEventListener("input", e=>{
    const v = parseFloat(e.target.value);
    if(!isNaN(v)) apply(v);
  });
}
function setNorth(v){
  S.north = ((Math.round(v)%360)+360)%360;
  $("north").value = S.north; $("northnum").value = S.north;
  compassKey = null;
  scheduleCompute(); panelFor = null; drawPanel(); drawList(); markDirty();
}
bindNum("north", setNorth);
bindNum("northnum", setNorth);
bindNum("tz",  v=>{ S.tz = clamp(v, -12, 14); locationChanged(); });
bindNum("grid", v=>{ S.grid = Math.max(1,v); buildGrid(); markDirty(); scheduleHist(); });
bindNum("yardw", v=>{ const b = yardBounds(); scalePolyTo(S.boundary, clamp(v,10,900), b.h);
                      afterBoundaryChange(true); panelFor = null; drawPanel(); });
bindNum("yardh", v=>{ const b = yardBounds(); scalePolyTo(S.boundary, b.w, clamp(v,10,900));
                      afterBoundaryChange(true); panelFor = null; drawPanel(); });
bindNum("fenceh", v=>{ S.fence.height = clamp(v,0,12); buildFence(); scheduleCompute(); markDirty(); });
function setFenceD(v){
  S.fence.density = clamp(v,0,1);
  $("fenced").value = S.fence.density; $("fenced2").value = S.fence.density;
  scheduleCompute();
}
bindNum("fenced", setFenceD);
bindNum("fenced2", setFenceD);
function setMins(v){
  S.fullSun = clamp(v,1,14);
  $("mins").value = S.fullSun; $("mins2").value = S.fullSun;
  for(const st of bedStats.values()){
    let good = 0;
    for(const x of st.grid) if(x >= S.fullSun) good++;
    st.pct = Math.round(100*good/st.grid.length);
  }
  refreshHeat(); panelFor = null; drawPanel(); drawList(); markDirty();
}
bindNum("mins", setMins);
bindNum("mins2", setMins);
$("fencestyle").innerHTML = Object.entries(FENCE_STYLES)
  .map(([k,v])=>`<option value="${k}">${v.label}</option>`).join("");
$("fencestyle").addEventListener("change", e=>{
  S.fence.style = e.target.value;
  const st = FENCE_STYLES[S.fence.style];
  S.fence.density = st.dens;
  $("fenced").value = st.dens; $("fenced2").value = st.dens;
  buildFence(); scheduleCompute(); markDirty();
  toast(st.label + " — blocks about " + Math.round(st.dens*100) + "% of direct sun");
});
$("fenceall").addEventListener("click", ()=>{
  S.fence.on = true;
  ensureFenceSides().fill(true);
  buildFence(); scheduleCompute(); drawFenceEdges(); markDirty();
});
$("fencenone").addEventListener("click", ()=>{
  ensureFenceSides().fill(false);
  buildFence(); scheduleCompute(); drawFenceEdges(); markDirty();
});
$("dst").addEventListener("change", e=>{ S.autoDST = e.target.checked; locationChanged(); });
$("snap").addEventListener("change", e=>{ S.snap = e.target.checked; scheduleHist(); });
$("showgrid").addEventListener("change", e=>{ S.showGrid = e.target.checked; buildGrid(); markDirty(); scheduleHist(); });
$("heat").addEventListener("change", e=>{
  S.heat = e.target.checked;
  if(!S.heat){ heat = null; refreshHeat(); markDirty(); }
  scheduleCompute();
});
$("leaf").addEventListener("change", e=>{ S.leafSeason = e.target.checked; lastLeaf = null; afterDateChange(); });
$("editBoundary").addEventListener("click", ()=>{
  select(BOUNDARY);
  nodeEdit = true;
  setView("vplan");
  panelFor = null; drawPanel(); markDirty();
  if(window.innerWidth <= 1020) openSheet(true);
  toast("Drag the corners, or tap a length to type it");
});
$("gridReferenceButton").addEventListener("click", ()=>{
  select(BOUNDARY);
  if(window.innerWidth <= 1020) openSheet(true);
  $("boundary-grid-controls").scrollIntoView({block:"nearest"});
});
$("rectBoundary").addEventListener("click", ()=>{
  const b = yardBounds();
  S.boundary = rectPoly(Math.max(10, Math.round(b.w)), Math.max(10, Math.round(b.h)));
  S.boundaryLabels = []; S.boundaryImage = null; S.gridFrame = null;
  activeNode = null; panelFor = null;
  afterBoundaryChange(true); drawPanel(); drawList();
  toast("Outline squared off");
});
document.addEventListener("keydown", e=>{
  if(e.defaultPrevented || window.PropertyImageImport?.isOpen()) return;
  const mod = e.ctrlKey || e.metaKey;
  if(mod && (e.key === "z" || e.key === "Z")){
    if(/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    e.preventDefault();
    e.shiftKey ? redo() : undo();
    return;
  }
  if(mod && (e.key === "y" || e.key === "Y")){
    if(/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
    e.preventDefault(); redo(); return;
  }
  if(mod && (e.key === "s" || e.key === "S")){ e.preventDefault(); savePlan(); return; }
  if(mod) return;
  if(/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
  if($("modal").classList.contains("on")) return;
  if(e.key === "Escape" && nodeEdit){ nodeEdit = false; activeNode = null; panelFor = null; drawPanel(); markDirty(); }
  if((e.key === "Delete" || e.key === "Backspace") && S.sel != null && S.sel !== BOUNDARY){ removeSelected(); e.preventDefault(); }
  if(e.key === "1") setView("vplan");
  if(e.key === "2") setView("v3d");
  if(e.key === "3") setView("veye");
  if(e.key === "0") fitYard();
  if(e.key === "f" || e.key === "F") focusSelection();
  if(e.key === "g" || e.key === "G"){ setSimple(!S.simple); return; }
  const nud = {ArrowLeft:[-1,0], ArrowRight:[1,0], ArrowUp:[0,-1], ArrowDown:[0,1],
               a:[-1,0], d:[1,0], w:[0,-1], s:[0,1]}[e.key];
  if(nud){ nudge(nud[0], nud[1]); e.preventDefault(); }
});
function openSheet(on){
  $("inspector").classList.toggle("open", on);
  $("closesheet").style.display = on ? "block" : "none";
}
$("sheetbtn").addEventListener("click", ()=>openSheet(!$("inspector").classList.contains("open")));
$("closesheet").addEventListener("click", ()=>openSheet(false));

/* ============================================================ modal -------- */
function askUser(title, msg, buttons){
  const box = $("modal");
  $("modaltitle").textContent = title;
  $("modalmsg").textContent = msg;
  const host = $("modalbtns");
  host.innerHTML = "";
  const close = ()=>{ box.classList.remove("on"); document.removeEventListener("keydown", onKey, true); };
  buttons.forEach(b=>{
    const el = document.createElement("button");
    el.className = "btn" + (b.kind ? " " + b.kind : "");
    el.textContent = b.label;
    el.addEventListener("click", ()=>{ close(); if(b.run) b.run(); });
    host.appendChild(el);
  });
  const onKey = e=>{
    if(e.key === "Escape"){ e.stopPropagation(); close(); }
  };
  document.addEventListener("keydown", onKey, true);
  box.classList.add("on");
  const last = host.lastElementChild;
  if(last) last.focus();
}
$("modal").addEventListener("pointerdown", e=>{ if(e.target.id === "modal") $("modal").classList.remove("on"); });

/* ============================================================ plan file ---- */
function savePlan(){
  const blob = new Blob([JSON.stringify(S,null,2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "yard-plan.json";
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
  savedMark = JSON.stringify(S);
  toast("Plan saved");
}
/* Rebuild everything from a plain object. Shared by Open, Start over and Undo. */
function loadState(data, frame){
  const priorGridAngle = gridFrame().angle;
  const f = data.gridFrame;
  if(f && (!Number.isFinite(f.angle) || !Number.isFinite(f.origin?.x) || !Number.isFinite(f.origin?.y))){
    throw new Error("The saved grid alignment is invalid.");
  }
  clearTimeout(hist.t); hist.t = null;
  pendingRebuild = null;
  camAnim = null;
  pointers.clear(); panGrab = null; pinch = null; mode = null; dragObj = null;
  hist.lock = true;
  try{
    S = Object.assign(freshState(), data);
    /* plans saved before time zones existed used a fixed offset */
    if(!("tzMode" in data)){ S.tzMode = "manual"; S.place = ""; }
    S.fence = Object.assign({on:true, style:"picket", height:5, density:.5, sides:[]}, data.fence||{});
    if(!Array.isArray(S.boundary) || S.boundary.length < 3)
      S.boundary = rectPoly(S.yard?.w || 110, S.yard?.h || 90);
    for(const o of S.objects){
      if(isOutlineType(o) && !o.poly) o.poly = rectPoly(o.w || PAVING[o.type]?.w || 12, o.h || PAVING[o.type]?.h || 10);
      if(o.type === "deck" && !(o.height >= 0)) o.height = .5;
    }
    ensureFenceSides();
    if(gridFrame().angle !== priorGridAngle){
      orbit.az = -gridFrame().angle;
      applyCamera();
    }
    uid = Math.max(...S.objects.map(o=>o.id), 0) + 1;
    measure = {a:null, b:null, live:null};
    nodeEdit = false; activeNode = null; panelFor = "init"; lastLeaf = leafOn();
    applySimpleChrome();
    syncInputs(); buildGround(); rebuildAll(); buildArc(); drawMeasureLine();
    const keep = S.sel;
    select(keep != null && (keep === BOUNDARY || S.objects.some(o=>o.id === keep)) ? keep : null);
    scheduleCompute();
    if(frame) fitYard();
  } finally {
    hist.lock = false;
  }
}

/* ============================================================ undo / redo -- */
let savedMark = null;
const hist = {stack:[], i:-1, t:null, lock:false};
function planKey(value){
  const {sel, ...plan} = value;
  return JSON.stringify(plan);
}
function histBtns(){
  const set = (id, on)=>{ const b = $(id); if(b) b.disabled = !on; };
  set("undoBtn", hist.i > 0); set("undoBtn2", hist.i > 0);
  set("redoBtn", hist.i < hist.stack.length-1); set("redoBtn2", hist.i < hist.stack.length-1);
}
function pushHist(){
  clearTimeout(hist.t);
  hist.t = null;
  const s = JSON.stringify(S);
  if(hist.i >= 0 && planKey(JSON.parse(hist.stack[hist.i])) === planKey(S)) return;
  hist.stack.length = hist.i + 1;
  hist.stack.push(s);
  if(hist.stack.length > 60) hist.stack.shift();
  hist.i = hist.stack.length - 1;
  histBtns();
}
function scheduleHist(){
  if(hist.lock) return;
  clearTimeout(hist.t);
  hist.t = setTimeout(pushHist, 450);
}
function stepHist(d){
  pushHist();
  const n = hist.i + d;
  if(n < 0 || n >= hist.stack.length){ toast(d < 0 ? "Nothing left to undo" : "Nothing to redo"); return; }
  hist.i = n;
  loadState(JSON.parse(hist.stack[n]), false);
  histBtns();
  toast(d < 0 ? "Undone" : "Redone");
}
const undo = ()=>stepHist(-1), redo = ()=>stepHist(1);
$("undoBtn").addEventListener("click", undo);
$("redoBtn").addEventListener("click", redo);
$("undoBtn2").addEventListener("click", undo);
$("redoBtn2").addEventListener("click", redo);

$("savebtn").addEventListener("click", savePlan);
document.querySelectorAll("[data-import-property]").forEach(button=>button.addEventListener("click", ()=>{
  if(playing) $("playbtn").click();
  pushHist();
  const b = yardBounds();
  window.PropertyImageImport.clearDraft();
  window.PropertyImageImport.open({center:{x:b.cx,y:b.cy}, draft:S.boundaryImageDraft});
}));
$("pii-dialog").addEventListener("close", ()=>{
  const draft = window.PropertyImageImport.getDraft();
  if(draft){
    S.boundaryImageDraft = draft;
    pushHist();
    syncLotFields();
    toast("Unscaled draft kept. Save the plan to keep it after closing this tab.");
  }
});
$("loadbtn").addEventListener("click", ()=>$("fileinput").click());
$("fileinput").addEventListener("change", e=>{
  const f = e.target.files[0];
  if(!f) return;
  const rd = new FileReader();
  rd.onload = ()=>{
    try{
      const data = JSON.parse(rd.result);
      if(!data.objects) throw new Error("not a plan");
      loadState(data, true);
      savedMark = JSON.stringify(S);
      pushHist();
      toast("Plan opened");
    }catch(err){ toast("That file isn't a yard plan"); }
  };
  rd.readAsText(f);
  e.target.value = "";
});
function doReset(){
  loadState(freshState(), true);
  savedMark = JSON.stringify(S);
  pushHist();
  toast("Back to the starting yard");
}
$("resetbtn").addEventListener("click", ()=>{
  const dirtyPlan = savedMark !== JSON.stringify(S);
  askUser("Start over?",
    dirtyPlan
      ? "This wipes the current plan and drops you back on the starting yard. Anything you have not saved to a file will be lost — Undo can bring it back, but only while this tab stays open."
      : "This wipes the current plan and drops you back on the starting yard.",
    [ {label:"Cancel"},
      {label:"Save a copy first", run:()=>{ savePlan(); setTimeout(doReset, 350); }},
      {label:"Start over", kind:"danger", run:doReset} ]);
});
function syncInputs(){
  syncRanges(document);
  $("date").value = S.date;
  syncLocationUI();
  $("north").value = S.north; $("northnum").value = S.north;
  $("grid").value = S.grid; $("snap").checked = S.snap; $("showgrid").checked = S.showGrid;
  $("simpleview").checked = !!S.simple;
  $("fencestyle").value = S.fence.style || "picket";
  $("fenceh").value = S.fence.height;
  $("fenced").value = S.fence.density; $("fenced2").value = S.fence.density;
  $("heat").checked = S.heat; $("leaf").checked = S.leafSeason;
  $("mins").value = S.fullSun; $("mins2").value = S.fullSun;
  syncLotFields();
  syncRanges(document);
}

/* ============================================================ location ----- */
const PLACES = [
  {n:"Fargo, ND", lat:46.8772, lon:-96.7898, z:"America/Chicago"},
  {n:"Moorhead, MN", lat:46.8738, lon:-96.7678, z:"America/Chicago"},
  {n:"Bismarck, ND", lat:46.8083, lon:-100.7837, z:"America/Chicago"},
  {n:"Grand Forks, ND", lat:47.9253, lon:-97.0329, z:"America/Chicago"},
  {n:"Minneapolis, MN", lat:44.9778, lon:-93.2650, z:"America/Chicago"},
  {n:"Sioux Falls, SD", lat:43.5446, lon:-96.7311, z:"America/Chicago"},
  {n:"Chicago, IL", lat:41.8781, lon:-87.6298, z:"America/Chicago"},
  {n:"Denver, CO", lat:39.7392, lon:-104.9903, z:"America/Denver"},
  {n:"Phoenix, AZ", lat:33.4484, lon:-112.0740, z:"America/Phoenix"},
  {n:"Seattle, WA", lat:47.6062, lon:-122.3321, z:"America/Los_Angeles"},
  {n:"Toronto, ON", lat:43.6532, lon:-79.3832, z:"America/Toronto"},
  {n:"London, UK", lat:51.5074, lon:-0.1278, z:"Europe/London"},
  {n:"Sydney, AU", lat:-33.8688, lon:151.2093, z:"Australia/Sydney"}
];
function fmtCoord(v, pos, neg){ return Math.abs(v).toFixed(3)+"°"+(v >= 0 ? pos : neg); }
function placeLabel(){
  return (S.place ? S.place+" · " : "")+fmtCoord(S.lat,"N","S")+" "+fmtCoord(S.lon,"E","W");
}
function fmtOffset(h){
  const sign = h < 0 ? "−" : "+", a = Math.abs(h), hh = Math.floor(a), mm = Math.round((a-hh)*60);
  return "UTC"+sign+hh+(mm ? ":"+String(mm).padStart(2,"0") : "");
}
function syncLocationUI(){
  const i = PLACES.findIndex(p=>p.n === S.place && Math.abs(p.lat-S.lat) < 1e-3 && Math.abs(p.lon-S.lon) < 1e-3);
  $("locpreset").value = i < 0 ? "custom" : String(i);
  $("lat").value = S.lat; $("lon").value = S.lon;
  $("tzmode").value = S.tzMode === "manual" ? "manual" : "zone";
  if(S.tzZone && ![...$("tzzone").options].some(o=>o.value === S.tzZone)) $("tzzone").add(new Option(S.tzZone, S.tzZone));
  $("tzzone").value = S.tzZone || "";
  $("tzzonerow").hidden = S.tzMode === "manual";
  $("tzmanual").hidden = S.tzMode !== "manual";
  $("tz").value = S.tz; $("dst").checked = S.autoDST;
  /* The clock only makes sense if it roughly matches the longitude. A zone
     picked for somewhere else shifts every sun time by hours. */
  const off = tzOffset(), solar = S.lon/15, gap = ((off - solar + 12)%24 + 24)%24 - 12;
  let hint = fmtOffset(off)+" on "+new Date(S.date+"T12:00:00").toLocaleDateString(undefined,{month:"short",day:"numeric"})+".";
  if(Math.abs(gap) > 2.5) hint += " That is "+Math.abs(gap).toFixed(1)+" h off the "+fmtOffset(Math.round(solar))
    +" this longitude suggests, so clock times may look wrong. Check the time zone.";
  else hint += " Solar noon is around "+fmtTime(dayEdges().noon)+".";
  $("tzhint").textContent = hint;
  const lh = $("lochint");
  lh.textContent = Math.abs(S.lat) > 66.56
    ? "Inside the polar circle: expect days with no sunrise or no sunset."
    : S.lat < 0 ? "Southern hemisphere: the sun arcs through the north, and leaf seasons shift six months."
    : "North and east are positive. South and west are negative.";
  markDirty();
}
function locationChanged(){
  zoneOffsetCache.clear();
  edgeCache.key = null;
  compassKey = null;
  afterDateChange();
  scheduleHist();
}
function initLocationUI(){
  const pre = $("locpreset");
  PLACES.forEach((p,i)=>pre.add(new Option(p.n, String(i))));
  pre.add(new Option("Custom coordinates", "custom"));
  const zones = (Intl.supportedValuesOf?.("timeZone") || PLACES.map(p=>p.z)).slice();
  for(const z of new Set(zones)) $("tzzone").add(new Option(z.replace(/_/g," "), z));
  pre.addEventListener("change", ()=>{
    const p = PLACES[+pre.value];
    if(!p){ S.place = ""; syncLocationUI(); return; }
    Object.assign(S, {place:p.n, lat:p.lat, lon:p.lon, tzMode:"zone", tzZone:p.z});
    locationChanged();
    toast(p.n+" · "+fmtOffset(tzOffset()));
  });
  const coord = (id, lo, hi)=>$(id).addEventListener("change", e=>{
    const v = parseFloat(e.target.value);
    if(!Number.isFinite(v) || v < lo || v > hi){
      toast((id === "lat" ? "Latitude" : "Longitude")+" must be between "+lo+" and "+hi+".");
      e.target.value = S[id]; return;
    }
    S[id] = v; S.place = "";
    locationChanged();
  });
  coord("lat", -90, 90);
  coord("lon", -180, 180);
  $("tzmode").addEventListener("change", e=>{ S.tzMode = e.target.value; locationChanged(); });
  $("tzzone").addEventListener("change", e=>{ S.tzZone = e.target.value; locationChanged(); });
  $("tzguess").addEventListener("click", ()=>{
    S.tz = Math.round(S.lon/15); S.autoDST = false; locationChanged();
    toast("Offset set to "+fmtOffset(S.tz)+" from longitude. Add daylight saving yourself if it applies.");
  });
  $("geolocate").addEventListener("click", ()=>{
    if(!navigator.geolocation){ toast("Location isn't available here. Type the coordinates instead."); return; }
    toast("Finding your location…");
    navigator.geolocation.getCurrentPosition(pos=>{
      S.lat = +pos.coords.latitude.toFixed(4); S.lon = +pos.coords.longitude.toFixed(4);
      S.place = ""; S.tzMode = "zone"; S.tzZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      locationChanged();
      toast("Using your location and this device's time zone.");
    }, ()=>toast("Location isn't available here. Type the coordinates instead."),
    {enableHighAccuracy:false, timeout:10000});
  });
}

/* ============================================================ rendering ---- */
const QUALITY_HINT = {
  performance:"1× resolution, no ambient occlusion, 2048 shadows. Best for laptops and phones.",
  balanced:"Up to 1.5× resolution, half-resolution ambient occlusion, 4096 shadows.",
  quality:"Full display resolution, full ambient occlusion. Needs a strong GPU."
};
function syncPrefs(label){
  $("rsky").value = prefs.sky;
  document.querySelectorAll("#rquality button").forEach(b=>b.setAttribute("aria-pressed", b.dataset.quality === prefs.quality));
  document.querySelectorAll("#rtrees button").forEach(b=>b.setAttribute("aria-pressed", b.dataset.trees === prefs.treeDetail));
  $("rqualityhint").textContent = QUALITY_HINT[prefs.quality] || "";
  $("rexp").value = prefs.exposure; $("rexp2").value = prefs.exposure;
  if(label !== undefined) $("rsource").textContent = label
    ? "Sky photo: "+label+". Display settings are saved in this browser, not in the plan file."
    : "No HDRI could be loaded, so the physical sky is used.";
  syncRanges(document);
}
function initPrefsUI(){
  const changed = ()=>{ savePrefs(); skyKey = null; markDirty(); };
  $("rsky").addEventListener("change", e=>{
    prefs.sky = e.target.value;
    if(prefs.sky === "hdri" && !sky.hdri){ prefs.sky = "sky"; e.target.value = "sky"; toast("No HDRI is available, so the physical sky stays on."); }
    sky.setMode(prefs.sky); changed();
  });
  document.querySelectorAll("#rquality button").forEach(b=>b.addEventListener("click", ()=>{
    prefs.quality = b.dataset.quality;
    applyQuality(false); syncPrefs(); changed();
  }));
  document.querySelectorAll("#rtrees button").forEach(b=>b.addEventListener("click", ()=>{
    if(prefs.treeDetail === b.dataset.trees) return;
    prefs.treeDetail = b.dataset.trees;
    toast(prefs.treeDetail === "high" ? "Growing high-detail trees…" : "Standard trees");
    setTimeout(()=>{ trees.setHighDetail(prefs.treeDetail === "high"); rebuildAll(); syncPrefs(); changed(); }, 30);
  }));
  const exp = v=>{ prefs.exposure = clamp(v, .3, 2.5); $("rexp").value = prefs.exposure; $("rexp2").value = prefs.exposure;
    changed(); clearTimeout(exp.t); exp.t = setTimeout(()=>{ updateSun(); refreshHeat(); markDirty(); }, 200); };
  bindNum("rexp", exp); bindNum("rexp2", exp);
}

/* ============================================================ init --------- */
function init(){
  renderer = new THREE.WebGLRenderer({canvas, antialias:false, stencil:false, powerPreference:"high-performance"});
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;      // ACES happens once, at the end of the post chain
  scene = new THREE.Scene();
  perspectiveCamera = new THREE.PerspectiveCamera(38, 1, .4, 5000);
  planCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, .4, 5000);
  camera = perspectiveCamera;
  TEX.soil = soilTexture(); TEX.deck = deckTexture();
  initMaterials();
  sky = new SkyEnvironment(renderer, scene, {fogDensity:.0008});   // feet
  sky.setMode(prefs.sky);
  sunLight = new THREE.DirectionalLight(0xfff0d0, 3);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(qualityPreset().shadow, qualityPreset().shadow);
  sunLight.shadow.bias = -0.0003;
  sunLight.shadow.normalBias = 0.06;
  sunLight.shadow.radius = 3;
  scene.add(sunLight, sunLight.target);
  hemi = new THREE.HemisphereLight(0xa8c6e6, 0x4a5340, .9);
  fillLight = new THREE.DirectionalLight(0xbcd2ea, .2);
  scene.add(hemi, fillLight);
  scene.add(objGroup, helperGroup);
  trees = new TreeLibrary();
  trees.setHighDetail(prefs.treeDetail === "high");
  post = createPost(renderer, scene, camera);
  applyQuality(false);
  ensureFenceSides();
  buildGround();
  rebuildAll();
  window.addEventListener("resize", resize);
  resize();
  applyCamera();
}
onComputeDone = ()=>{ refreshHeat(); drawPanel(); drawList(); markDirty(); };

async function boot(){
  try{
    init();
    $("bootmsg").textContent = "Loading the sky";
    const label = await sky.loadHDRI(m=>{ $("bootmsg").textContent = m; });
    if(!label && prefs.sky === "hdri") prefs.sky = "sky";
    sky.setMode(prefs.sky);
    skyKey = null;
    syncPrefs(label);
  }
  catch(err){
    $("bootmsg").textContent = "This browser could not start WebGL. " + err.message;
    document.querySelector("#boot .ring").style.animation = "none";
    return;
  }
  lastLeaf = leafOn();
  applySimpleChrome();
  syncInputs(); buildArc(); drawList(); drawPanel(); setTool("select"); scheduleCompute();
  try{ if(localStorage.getItem("yard-shade-studio:navmin")) setNavCollapsed(true); }catch{ /* private mode */ }
  syncSunH(); histBtns();
  savedMark = JSON.stringify(S);
  pushHist();
  if(window.innerWidth <= 1020) $("sunpanel").classList.add("min");
  loop();
  const b = yardBounds(), span = Math.max(b.w, b.h);
  orbit.tx = b.cx; orbit.tz = b.cy; orbit.dist = span*3.1; orbit.el = 74;
  applyCamera();
  bootFlyTimer = setTimeout(()=>{
    if(activeView === "v3d") flyTo({dist:span*1.55, el:46, az:0, tx:b.cx, tz:b.cy, ty:0}, 1400);
  }, 120);
  const bd = $("boot");
  bd.style.opacity = "0";
  setTimeout(()=>bd.remove(), 650);
}
window.applyImportedBoundary = applyImportedBoundary;   // hook for the property-image importer
/* development-only hook for automated screenshots */
if(import.meta.env.DEV) window.__yardDebug = { get S(){ return S; }, rebuildAll, fromPreset, setView, flyTo, orbit, applyCamera, markDirty, scheduleCompute };
initLocationUI();
initPrefsUI();
if(document.readyState === "complete") boot();
else window.addEventListener("load", boot);

