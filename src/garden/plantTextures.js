/* ============================================================ plant textures
   Procedural leaf and flower textures for the planting-bed models, painted
   once on a canvas and shared by every plant that uses them.

   They are data, not pictures. The plant shader reads
     R  brightness (veins, shading, petal detail)
     G  which of the plant's two colours a texel takes: 0 = first, 1 = second
        (a variegated leaf edge, a daisy's cone, the older base of a panicle)
     A  shape, alpha-tested
   so one texture serves every colour of every variety.

   Sprigs, blades and spikes grow up from the middle of the bottom edge, where
   the card meets its stem. Top-view flowers are centred. "fill" textures are
   opaque and wrap around a ball or cone. */
import * as THREE from "three";

function rng(seed){
  let s = seed >>> 0;
  return ()=>{
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const c01 = v=>Math.max(0, Math.min(1, v));
const ink = (l, m = 0)=>`rgb(${Math.round(255*c01(l))},${Math.round(255*c01(m))},0)`;
const TAU = Math.PI*2;

/* ---------- shared strokes ---------- */
/* one leaf, base at (x, y), pointing `ang` from straight up */
function leaf(g, x, y, len, wid, ang, l, o = {}){
  const {m = 0, edge = false, centre = false, tip = .75, vein = true, lobes = 0} = o;
  if(lobes){
    for(const s of [1, -1]) leaf(g, x, y, len*.72, wid*.62, ang + s*.85, l*.94, {...o, lobes:0});
    for(const s of [1, -1]) leaf(g, x, y, len*.5, wid*.5, ang + s*1.55, l*.9, {...o, lobes:0});
  }
  g.save(); g.translate(x, y); g.rotate(ang);
  const shape = k=>{
    g.beginPath(); g.moveTo(0, 0);
    g.bezierCurveTo(wid*k, -len*.22, wid*k*.92, -len*tip, 0, -len*(.5 + .5*k));
    g.bezierCurveTo(-wid*k*.92, -len*tip, -wid*k, -len*.22, 0, len*(1-k)*-.5);
    g.closePath();
  };
  shape(1); g.fillStyle = ink(l, edge ? 1 : m); g.fill();
  if(edge){ shape(.78); g.fillStyle = ink(l*.96, 0); g.fill(); }
  if(centre){ shape(.52); g.fillStyle = ink(l*1.06, 1); g.fill(); }
  /* one half a little darker, so the leaf reads as folded along its midrib */
  g.save(); shape(1); g.clip(); g.fillStyle = "rgba(0,0,0,.13)"; g.fillRect(0, -len, wid*1.2, len); g.restore();
  if(vein){
    g.strokeStyle = `rgba(255,255,255,.2)`; g.lineWidth = Math.max(1, wid*.07);
    g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -len*.94); g.stroke();
    g.lineWidth = Math.max(.6, wid*.035);
    for(let i = 1; i < 5; i++) for(const s of [1, -1]){
      g.beginPath(); g.moveTo(0, -len*i/5.4); g.lineTo(s*wid*.7*Math.sin(Math.PI*i/5.6), -len*(i/5.4 + .13)); g.stroke();
    }
  }
  g.restore();
}
function stemLine(g, x0, y0, x1, y1, w, l = .55){
  g.strokeStyle = ink(l); g.lineWidth = w; g.lineCap = "round";
  g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
}
/* a small flower seen from the front: n petals round a centre */
function floret(g, x, y, r, n, l, o = {}){
  const {m = 0, eye = .22, eyeM = 1, eyeL = .7, rot = 0, pw = .55, notch = false} = o;
  g.save(); g.translate(x, y); g.rotate(rot);
  for(let i = 0; i < n; i++){
    g.rotate(TAU/n);
    g.fillStyle = ink(l*(.9 + .1*((i*7)%3)/2), m);
    g.beginPath();
    g.ellipse(0, -r*.56, r*pw*Math.min(1, 3.2/n + .25), r*.46, 0, 0, TAU);
    g.fill();
    if(notch){ g.fillStyle = "rgba(0,0,0,.1)"; g.beginPath(); g.ellipse(0, -r*.3, r*.06, r*.28, 0, 0, TAU); g.fill(); }
  }
  if(eye > 0){ g.fillStyle = ink(eyeL, eyeM); g.beginPath(); g.arc(0, 0, r*eye, 0, TAU); g.fill(); }
  g.restore();
}

/* ---------- foliage ---------- */
/* a leafy shoot: leaves up a stem, a few side shoots when `branches` */
function sprig(o){
  return (g, N, r)=>{
    const {n = 9, len = .3, asp = .5, branches = 0, edge = false, lobes = 0, droop = 0} = o;
    const shoot = (x0, y0, ang, L, count, scale)=>{
      const x1 = x0 + Math.sin(ang)*L, y1 = y0 - Math.cos(ang)*L;
      stemLine(g, x0, y0, x1, y1, N*.012*scale, .5);
      for(let i = 0; i < count; i++){
        const t = (i + .6)/count, side = i%2 ? 1 : -1;
        const ll = N*len*scale*(.72 + .28*Math.sin(Math.PI*Math.min(1, t*1.15))) * (.9 + r()*.2);
        const a = ang + side*(1.05 - t*.55 + droop) + (r() - .5)*.3;
        leaf(g, x0 + (x1-x0)*t, y0 + (y1-y0)*t, ll, ll*asp, a, .62 + r()*.3, {edge, lobes});
      }
      const ll = N*len*scale;
      leaf(g, x1, y1, ll, ll*asp, ang + (r() - .5)*.2, .8 + r()*.15, {edge, lobes});
    };
    if(branches){
      for(let b = 0; b < branches; b++){
        const a = (b/(branches - 1 || 1) - .5)*1.5 + (r() - .5)*.15;
        shoot(N/2, N*.99, a, N*(.62 + r()*.2), Math.round(n/branches) + 2, .8);
      }
    }
    shoot(N/2, N*.99, (r() - .5)*.08, N*(branches ? .7 : .66), branches ? Math.round(n/branches) + 2 : n, 1);
  };
}
/* a pinnate leaf: leaflets in pairs along a midrib; `sub` makes each one a small frond */
function compound(o){
  return (g, N, r)=>{
    const {pairs = 9, asp = .26, len = .26, sub = 0, taper = .5, three = false, lance = false} = o;
    const frond = (x0, y0, ang, L, P, scale, depth)=>{
      const x1 = x0 + Math.sin(ang)*L, y1 = y0 - Math.cos(ang)*L;
      stemLine(g, x0, y0, x1, y1, Math.max(1, N*.009*scale), .5);
      for(let i = 0; i < P; i++){
        const t = .16 + .8*i/P, k = lance ? Math.pow(Math.sin(Math.PI*Math.min(1, t*.95 + .1)), .7) : 1 - taper*t, px = x0 + (x1-x0)*t, py = y0 + (y1-y0)*t;
        for(const s of [1, -1]){
          const a = ang + s*(1.15 - t*.35) + (r() - .5)*.12, ll = N*len*scale*k;
          if(depth < sub) frond(px, py, a, ll*1.25, Math.max(4, Math.round(P*.6)), scale*.42, depth + 1);
          else leaf(g, px, py, ll, ll*asp, a, .6 + r()*.32, {vein:depth === 0});
        }
      }
      const ll = N*len*scale*(1 - taper)*1.2;
      leaf(g, x1, y1, ll, ll*asp, ang, .85, {vein:depth === 0});
    };
    if(three) for(const a of [-.75, 0, .75]) frond(N/2, N*.99, a, N*(a ? .62 : .8), pairs, a ? .8 : 1, 0);
    else frond(N/2, N*.99, 0, N*.86, pairs, 1, 0);
  };
}
/* one broad, ribbed leaf on a short stalk */
function broadLeaf(o){
  return (g, N)=>{
    const {variegation = "none", asp = .68} = o;
    const len = N*.7, base = N*.72;
    stemLine(g, N/2, N, N/2, base - 2, N*.035, .62);
    leaf(g, N/2, base, len, len*asp, 0, .8, {edge:variegation === "edge", centre:variegation === "centre", tip:.5, vein:false});
    /* parallel veins sweeping from stalk to tip, the hosta signature */
    g.save(); g.translate(N/2, base);
    for(let i = -5; i <= 5; i++){
      const k = i/5.6;
      g.strokeStyle = i ? "rgba(0,0,0,.2)" : "rgba(255,255,255,.22)"; g.lineWidth = N*(i ? .006 : .01);
      g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(len*asp*k*1.25, -len*.3, len*asp*k*1.05, -len*.72, 0, -len*.97); g.stroke();
    }
    g.restore();
  };
}
/* one long blade, base at the bottom */
function strap(o){
  return (g, N)=>{
    const {variegation = "none", wide = .1} = o;
    const w = N*wide, top = N*.02;
    const shape = k=>{
      g.beginPath(); g.moveTo(N/2 - w*.55*k, N);
      g.bezierCurveTo(N/2 - w*k, N*.6, N/2 - w*.7*k, N*.25, N/2, top + (1-k)*N*.1);
      g.bezierCurveTo(N/2 + w*.7*k, N*.25, N/2 + w*k, N*.6, N/2 + w*.55*k, N);
      g.closePath();
    };
    shape(1); g.fillStyle = ink(.82, variegation === "edge" ? 1 : 0); g.fill();
    if(variegation === "edge"){ shape(.62); g.fillStyle = ink(.78, 0); g.fill(); }
    if(variegation === "stripe"){ shape(.34); g.fillStyle = ink(.9, 1); g.fill(); }
    g.save(); shape(1); g.clip();
    g.fillStyle = "rgba(0,0,0,.14)"; g.fillRect(N/2, 0, w*1.2, N);
    g.strokeStyle = "rgba(255,255,255,.2)"; g.lineWidth = Math.max(1, w*.12);
    g.beginPath(); g.moveTo(N/2, N); g.lineTo(N/2, top); g.stroke();
    g.strokeStyle = "rgba(0,0,0,.12)"; g.lineWidth = 1;
    for(const k of [-.5, .5]){ g.beginPath(); g.moveTo(N/2 + w*k*.6, N); g.lineTo(N/2 + w*k*.3, N*.2); g.stroke(); }
    g.restore();
  };
}
/* a rounded, scalloped leaf on a stalk; `overlay` paints silver between the veins */
function ruffled(o){
  return (g, N, r)=>{
    const {overlay = false, lobes = 7} = o;
    const cx = N/2, cy = N*.47, R = N*.44;
    stemLine(g, cx, N, cx, cy + R*.5, N*.022, .5);
    const shape = k=>{
      g.beginPath();
      for(let i = 0; i <= 160; i++){
        const a = i/160*TAU - Math.PI/2, sinus = Math.pow(Math.max(0, Math.cos(a - Math.PI/2)), 10);
        const rr = R*k*(1 - .11*(1 - Math.abs(Math.cos(a*lobes/2 + .4))) - .05*Math.sin(a*lobes*2.5) - .5*sinus);
        g[i ? "lineTo" : "moveTo"](cx + Math.cos(a)*rr, cy + Math.sin(a)*rr);
      }
      g.closePath();
    };
    shape(1); g.fillStyle = ink(.74, 0); g.fill();
    if(overlay){ shape(.8); g.fillStyle = ink(.92, 1); g.fill(); }
    g.save(); shape(1); g.clip();
    for(let i = 0; i < lobes; i++){
      const a = -Math.PI/2 + (i - (lobes-1)/2)*TAU/(lobes + 1.5);
      g.strokeStyle = overlay ? ink(.5, 0) : "rgba(0,0,0,.22)"; g.lineWidth = N*(overlay ? .022 : .012);
      g.beginPath(); g.moveTo(cx, cy + R*.48); g.quadraticCurveTo(cx + Math.cos(a)*R*.5, cy + Math.sin(a)*R*.4 + R*.2, cx + Math.cos(a)*R*.95, cy + Math.sin(a)*R*.95); g.stroke();
    }
    for(let i = 0; i < 260; i++){ g.fillStyle = `rgba(${r() > .5 ? "255,255,255" : "0,0,0"},.05)`; g.fillRect(r()*N, r()*N, N*.03, N*.03); }
    g.restore();
  };
}
/* a tuft of fine grass blades fanning up from the base */
function blades(o){
  return (g, N, r)=>{
    const {n = 46, fan = .5, arch = .25, stripe = false} = o;
    for(let i = 0; i < n; i++){
      const a = (r() - .5)*2*fan, L = N*(.62 + r()*.36), bend = (a > 0 ? 1 : -1)*arch*(.4 + r())*N*.5;
      const x0 = N/2 + (r() - .5)*N*.1, x1 = x0 + Math.sin(a)*L + bend, y1 = N - Math.cos(a)*L*(1 - arch*.45);
      const cxp = x0 + Math.sin(a)*L*.55, cyp = N - Math.cos(a)*L*.75;
      g.strokeStyle = ink(.55 + r()*.4, stripe && r() > .45 ? 1 : 0); g.lineCap = "round";
      for(const [w, t1] of [[N*.016, .7], [N*.009, 1]]){
        g.lineWidth = w; g.beginPath(); g.moveTo(x0, N);
        g.quadraticCurveTo(cxp, cyp, x0 + (x1 - x0)*t1 + (1 - t1)*(cxp - x0)*.4, N + (y1 - N)*t1 + (1 - t1)*(cyp - N)*.3); g.stroke();
      }
    }
  };
}
/* a conifer branchlet: needles along a twig and its side shoots.
   needle: length; spread: how far needles stand off the twig (rad); flat keeps
   them in two ranks (yew, fir); tufts gathers long needles at the tips (pine);
   scales draws overlapping scale leaves instead (arborvitae, juniper). */
function conifer(o){
  return (g, N, r)=>{
    const {shoots = 7, needle = .05, spread = 1, step = .012, flat = false, tufts = false, scales = false, fan = .9, width = .006, reach = .6} = o;
    const twig = (x0, y0, ang, L, depth)=>{
      const x1 = x0 + Math.sin(ang)*L, y1 = y0 - Math.cos(ang)*L;
      stemLine(g, x0, y0, x1, y1, N*(scales ? .02 : .01)*(depth ? .7 : 1), scales ? .7 : .42);
      if(scales){
        /* braided scale leaves: overlapping diamonds along the shoot */
        for(let t = 0; t <= 1; t += .07){
          g.save(); g.translate(x0 + (x1 - x0)*t, y0 + (y1 - y0)*t); g.rotate(ang);
          g.fillStyle = ink(.6 + r()*.36); g.beginPath();
          g.moveTo(0, -N*.03); g.lineTo(N*.016, 0); g.lineTo(0, N*.018); g.lineTo(-N*.016, 0); g.fill(); g.restore();
        }
      } else if(!tufts){
        for(let t = .04; t <= 1; t += step/Math.max(.2, L/N)){
          const px = x0 + (x1 - x0)*t, py = y0 + (y1 - y0)*t;
          for(const s of flat ? [1, -1] : [1, -1, r() > .5 ? .35 : -.35]){
            const a = ang + s*spread*(.8 + r()*.4), l = N*needle*(.75 + r()*.5)*(1 - t*.25);
            g.strokeStyle = ink(.5 + r()*.48); g.lineWidth = N*width; g.lineCap = "round";
            g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.sin(a)*l, py - Math.cos(a)*l); g.stroke();
          }
        }
      }
      if(tufts || depth === 0){
        /* the tip: a brush of needles (pine) or the leading bud */
        const n = tufts ? 26 : 5, l0 = N*needle*(tufts ? 1 : .9);
        for(let i = 0; i < n; i++){
          const a = ang + (r() - .5)*(tufts ? 2.5 : 1.2), l = l0*(.7 + r()*.5);
          g.strokeStyle = ink(.55 + r()*.45); g.lineWidth = N*width; g.lineCap = "round";
          g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 + Math.sin(a)*l, y1 - Math.cos(a)*l); g.stroke();
        }
        if(tufts){ g.fillStyle = ink(.95, 0); g.beginPath(); g.ellipse(x1 + Math.sin(ang)*N*.025, y1 - Math.cos(ang)*N*.025, N*.008, N*.03, ang, 0, TAU); g.fill(); }
      }
      return [x1, y1];
    };
    const main = N*.9;
    twig(N/2, N*.99, 0, main, 0);
    for(let i = 0; i < shoots; i++){
      const t = .12 + .76*(i + .5)/shoots, side = i%2 ? 1 : -1, a = side*fan*(1 - t*.35) + (r() - .5)*.15;
      const L = N*reach*(1 - t*.6)*(.85 + r()*.3), y = N*.99 - main*t;
      const [x1, y1] = twig(N/2, y, a, L, 1);
      if(scales || o.fork) for(const s2 of [1, -1]) twig(N/2 + (x1 - N/2)*.5, y + (y1 - y)*.5, a + s2*.6, L*.45, 2);
    }
  };
}
/* a carpet of tiny leaves seen from above */
function carpet(o){
  return (g, N, r)=>{
    const {n = 420, size = .05, asp = .5} = o;
    for(let i = 0; i < n; i++){
      const a = r()*TAU, d = Math.sqrt(r())*N*.47, ll = N*size*(.7 + r()*.6);
      leaf(g, N/2 + Math.cos(a)*d, N/2 + Math.sin(a)*d, ll, ll*asp, r()*TAU, .5 + r()*.45, {vein:false});
    }
  };
}

/* ---------- flowers ---------- */
function daisy(o){
  return (g, N, r)=>{
    const {n = 16, double = false, eye = .2, pw = .32, tips = false} = o;
    const rows = double ? [[1, n], [.78, n], [.55, Math.round(n*.7)]] : tips ? [[1, n, 1], [.66, n, 0]] : [[1, n]];
    /* tipped daisies spend the second colour on the petal ends, so their eye is a dark shade of the first */
    rows.forEach(([k, cnt, m = 0], j)=>floret(g, N/2, N/2, N*.48*k, cnt, .78 + (tips ? 0 : j*.09), {eye:0, rot:tips ? .4 : j*.3 + r(), pw, notch:!tips || j === 1, m}));
    const R = N*.48*(double ? eye*.6 : eye), em = tips ? 0 : 1, dim = tips ? .4 : 1;
    g.fillStyle = ink(.6*dim, em); g.beginPath(); g.arc(N/2, N/2, R, 0, TAU); g.fill();
    for(let i = 0; i < 90; i++){
      const a = i*2.39996, d = R*Math.sqrt(i/90);
      g.fillStyle = ink((.5 + .5*(i%3)/2)*dim, em); g.beginPath(); g.arc(N/2 + Math.cos(a)*d, N/2 + Math.sin(a)*d, R*.07, 0, TAU); g.fill();
    }
  };
}
/* a flower spike, seen from the side */
function spike(o){
  return (g, N, r)=>{
    const {loose = false} = o;
    stemLine(g, N/2, N, N/2, N*.05, N*.014, .45);
    if(loose){
      for(let i = 0; i < 9; i++){
        const y = N*(.9 - i*.085), L = N*.26*(1 - i/11);
        for(const s of [1, -1]){
          const x1 = N/2 + s*L, y1 = y - L*.9;
          stemLine(g, N/2, y, x1, y1, N*.008, .45);
          for(let k = 0; k < 6; k++){
            const t = .3 + .7*k/6;
            floret(g, N/2 + (x1 - N/2)*t + (r() - .5)*N*.03, y + (y1 - y)*t, N*.03, 4, .7 + r()*.3, {eye:0, rot:r()*6});
          }
        }
      }
    }
    const rows = loose ? 16 : 34;
    for(let i = 0; i < rows; i++){
      const t = i/rows, y = N*(.86 - t*.8), w = N*(loose ? .05 : .115)*Math.pow(1 - t, .55) + N*.012;
      const cnt = loose ? 2 : 5;
      for(let k = 0; k < cnt; k++){
        const x = N/2 + ((k + .5)/cnt - .5)*2*w + (r() - .5)*N*.02;
        floret(g, x, y + (r() - .5)*N*.02, N*(loose ? .028 : .034)*(1 - t*.4), 4, .62 + r()*.38, {eye:0, rot:r()*6, pw:.7});
      }
    }
  };
}
/* a six-tepal trumpet seen down its throat (daylily, lily) */
function trumpet(o){
  return (g, N)=>{
    const {eye = .32, recurved = false} = o;
    for(const [k, rot, l] of [[1, 0, .78], [.92, TAU/6, .9]]) for(let i = 0; i < 3; i++){
      const a = rot + i*TAU/3;
      g.save(); g.translate(N/2, N/2); g.rotate(a);
      g.fillStyle = ink(l, 0); g.beginPath(); g.moveTo(0, 0);
      g.bezierCurveTo(N*.2*k, -N*.12, N*(recurved ? .12 : .17)*k, -N*.4*k, 0, -N*.48*k);
      g.bezierCurveTo(-N*(recurved ? .12 : .17)*k, -N*.4*k, -N*.2*k, -N*.12, 0, 0); g.fill();
      g.strokeStyle = "rgba(255,255,255,.25)"; g.lineWidth = N*.012; g.beginPath(); g.moveTo(0, -N*.05); g.lineTo(0, -N*.42*k); g.stroke();
      g.restore();
    }
    const grad = g.createRadialGradient(N/2, N/2, 0, N/2, N/2, N*eye);
    grad.addColorStop(0, ink(.7, 1)); grad.addColorStop(.7, ink(.75, 1)); grad.addColorStop(1, "rgba(190,255,0,0)");
    g.fillStyle = grad; g.beginPath(); g.arc(N/2, N/2, N*eye, 0, TAU); g.fill();
    for(let i = 0; i < 6; i++){
      const a = i*TAU/6 + .3;
      stemLine(g, N/2, N/2, N/2 + Math.cos(a)*N*.13, N/2 + Math.sin(a)*N*.13, N*.008, .95);
      g.fillStyle = ink(.4, 1); g.beginPath(); g.arc(N/2 + Math.cos(a)*N*.13, N/2 + Math.sin(a)*N*.13, N*.016, 0, TAU); g.fill();
    }
  };
}
/* a shaggy whorl of tubular petals (bee balm) */
function shag(){
  return (g, N, r)=>{
    for(let j = 0; j < 2; j++) for(let i = 0; i < 30; i++){
      const a = i/30*TAU + r()*.2, L = N*(.3 + r()*.17)*(j ? .65 : 1), bend = (r() - .5)*.9;
      g.strokeStyle = ink(.65 + r()*.35, 0); g.lineWidth = N*.022; g.lineCap = "round";
      g.beginPath(); g.moveTo(N/2 + Math.cos(a)*N*.07, N/2 + Math.sin(a)*N*.07);
      g.quadraticCurveTo(N/2 + Math.cos(a + bend*.4)*L*.6, N/2 + Math.sin(a + bend*.4)*L*.6, N/2 + Math.cos(a + bend)*L, N/2 + Math.sin(a + bend)*L); g.stroke();
    }
    g.fillStyle = ink(.5, 1); g.beginPath(); g.arc(N/2, N/2, N*.1, 0, TAU); g.fill();
  };
}
/* half-width of a panicle at distance d (0 tip … 1 base) down its length */
const coneHalf = d=>(.03 + .37*Math.pow(d, .75))*(1 - .55*Math.pow(Math.max(0, (d - .8)/.2), 2));
/* many small florets packed into a head. shape: "dome" (side view, flat base),
   "round" (ball), "flat" (top view, ragged disc), "cone" (panicle, side view) */
function cluster(o){
  return (g, N, r)=>{
    const {shape = "round", size = .07, petals = 5, n = 150, eye = .2, gradient = false, gaps = 0, wide = 1} = o;
    const pts = [];
    let guard = 0;
    while(pts.length < n && guard++ < n*40){
      const x = r(), y = r();
      let ok;
      if(shape === "dome"){ const dx = (x - .5)/.47, dy = (y - .92)/.82; ok = y < .94 && dx*dx + dy*dy < 1; }
      else if(shape === "cone"){ const d = (y - .04)/.92; ok = d > 0 && d < 1 && Math.abs(x - .5) < coneHalf(d)*wide; }
      else { const dx = (x - .5)/.46, dy = (y - .5)/.46, d = dx*dx + dy*dy; ok = d < 1 - (shape === "flat" ? .22*r() : 0); }
      if(ok && (!gaps || r() > gaps)) pts.push([x, y]);
    }
    /* paint back to front so the lit florets sit on top */
    pts.sort((a, b)=>(shape === "flat" || shape === "round" ? Math.hypot(b[0] - .5, b[1] - .5) - Math.hypot(a[0] - .5, a[1] - .5) : a[1] - b[1]));
    if(shape !== "flat"){ g.fillStyle = ink(.42, gradient ? .6 : 0); g.beginPath();
      if(shape === "dome") g.ellipse(N/2, N*.92, N*.4, N*.72, 0, Math.PI, TAU);
      else if(shape === "cone"){ g.moveTo(N/2, N*.06);
        for(let i = 1; i <= 20; i++) g.lineTo(N*(.5 + coneHalf(i/20)*wide*.9), N*(.04 + .92*i/20));
        for(let i = 20; i >= 1; i--) g.lineTo(N*(.5 - coneHalf(i/20)*wide*.9), N*(.04 + .92*i/20)); }
      else g.arc(N/2, N/2, N*.4, 0, TAU);
      g.fill(); }
    for(const [x, y] of pts){
      const m = gradient ? c01((y - .1)/.8 + (r() - .5)*.25) : 0;
      floret(g, x*N, y*N, N*size*(.8 + r()*.4), petals, .66 + r()*.34, {m, eye, eyeM:gradient ? m : 1, eyeL:.55, rot:r()*6, pw:.62});
    }
  };
}
/* opaque florets for wrapping a ball or cone; colour runs from first (top) to second (bottom) */
function fill(o){
  return (g, N, r)=>{
    const {size = .1, petals = 4, ruffle = false} = o;
    g.fillStyle = ink(.45, .5); g.fillRect(0, 0, N, N);
    const n = Math.round(1.5/(size*size));
    for(let i = 0; i < n; i++){
      const x = r(), y = r(), m = c01(y*1.15 - .05 + (r() - .5)*.2), s = N*size*(.8 + r()*.4);
      /* drawn at the wrapped positions too, so the tile has no seam */
      for(const ox of [0, -1, 1]) for(const oy of [0, -1, 1]){
        if(Math.abs(x + ox - .5) > .5 + size || Math.abs(y + oy - .5) > .5 + size) continue;
        if(ruffle){
          g.save(); g.translate((x + ox)*N, (y + oy)*N); g.rotate(i*2.1);
          g.fillStyle = ink(.6 + ((i*13)%10)/25, m); g.beginPath(); g.ellipse(0, 0, s*1.5, s*.8, 0, 0, TAU); g.fill();
          g.strokeStyle = "rgba(0,0,0,.16)"; g.lineWidth = N*.008; g.beginPath(); g.ellipse(0, s*.2, s*1.3, s*.6, 0, Math.PI, TAU); g.stroke();
          g.restore();
        } else floret(g, (x + ox)*N, (y + oy)*N, s, petals, .66 + ((i*7)%10)/29, {m, eye:.16, eyeM:m, eyeL:.5, rot:i*1.7, pw:.72});
      }
    }
  };
}
/* a feathery plume on a stalk */
function plume(o){
  return (g, N, r)=>{
    const {width = .2, arch = 0, dense = 1} = o;
    const axis = t=>[N/2 + arch*N*.3*t*t, N*(1 - t*.97)];
    g.strokeStyle = ink(.5); g.lineWidth = N*.012; g.beginPath(); g.moveTo(...axis(0));
    for(let i = 1; i <= 20; i++) g.lineTo(...axis(i/20)); g.stroke();
    const n = Math.round(46*dense);
    for(let i = 0; i < n; i++){
      const t = .2 + .8*i/n, [x, y] = axis(t), k = Math.sin(Math.PI*Math.pow((t - .2)/.8, .7));
      for(const s of [1, -1]){
        const L = N*width*k*(.6 + r()*.7), a = s*(.5 + r()*.5), x1 = x + Math.sin(a)*L, y1 = y - Math.cos(a)*L*.9;
        stemLine(g, x, y, x1, y1, N*.006, .5);
        for(let j = 0; j < 7; j++){
          const u = .25 + .75*j/7;
          g.fillStyle = ink(.6 + r()*.4, 0); g.beginPath();
          g.arc(x + (x1 - x)*u + (r() - .5)*N*.02, y + (y1 - y)*u + (r() - .5)*N*.02, N*.011*(1.4 - u*.5), 0, TAU); g.fill();
        }
      }
    }
  };
}
/* a globe of tiny stars on fine stalks (allium), seen from any side */
function globe(){
  return (g, N, r)=>{
    for(let i = 0; i < 150; i++){
      const a = i*2.39996, d = N*.42*Math.sqrt((i + .5)/150), x = N/2 + Math.cos(a)*d, y = N/2 + Math.sin(a)*d;
      stemLine(g, N/2, N/2, x, y, N*.004, .5);
      floret(g, x, y, N*.045, 6, .64 + r()*.36, {eye:.2, eyeM:1, eyeL:.6, rot:r()*6, pw:.34});
    }
  };
}
/* a wiry wand with small flowers. kind: "bells" | "columbine" | "hearts" */
function wand(o){
  return (g, N, r)=>{
    const {kind = "bells"} = o;
    if(kind === "hearts"){
      const P = t=>[N*(.12 + .8*t), N*(.95 - .8*Math.sin(Math.PI*Math.pow(t, .8)*.62))];
      g.strokeStyle = ink(.5); g.lineWidth = N*.012; g.beginPath(); g.moveTo(...P(0));
      for(let i = 1; i <= 24; i++) g.lineTo(...P(i/24)); g.stroke();
      for(let i = 0; i < 8; i++){
        const [x, y] = P(.28 + .7*i/8), s = N*.055*(1 - i/14);
        stemLine(g, x, y, x, y + s*.8, N*.005, .5);
        g.fillStyle = ink(.85, 0); g.beginPath(); g.moveTo(x, y + s*2.9);
        g.bezierCurveTo(x + s*2, y + s*1.6, x + s*1.2, y + s*.4, x, y + s*1.1);
        g.bezierCurveTo(x - s*1.2, y + s*.4, x - s*2, y + s*1.6, x, y + s*2.9); g.fill();
        g.fillStyle = ink(.95, 1); g.beginPath(); g.ellipse(x, y + s*3, s*.3, s*.6, 0, 0, TAU); g.fill();
      }
      return;
    }
    stemLine(g, N/2, N, N/2, N*.12, N*.01, .5);
    if(kind === "columbine"){
      for(const [x, y, s] of [[.5, .16, 1], [.24, .36, .85], [.76, .4, .85], [.42, .6, .6]]){
        stemLine(g, N/2, N*(y + .22), N*x, N*y, N*.007, .5);
        const R = N*.15*s;
        for(let i = 0; i < 5; i++){            // spurred sepals behind
          const a = i*TAU/5 + .3;
          g.fillStyle = ink(.72, 0); g.beginPath();
          g.ellipse(N*x + Math.cos(a)*R*.62, N*y + Math.sin(a)*R*.62, R*.52, R*.2, a, 0, TAU); g.fill();
        }
        floret(g, N*x, N*y, R*.5, 5, .95, {m:1, eye:.25, eyeM:1, eyeL:.7, pw:.8});
      }
      return;
    }
    for(let i = 0; i < 26; i++){
      const t = i/26, y = N*(.82 - t*.7), s = i%2 ? 1 : -1, L = N*.13*(1 - t*.5), x = N/2 + s*L;
      stemLine(g, N/2, y + N*.03, x, y, N*.007, .5);
      g.fillStyle = ink(.7 + r()*.3, 0); g.beginPath(); g.ellipse(x, y + N*.02, N*.034, N*.044, 0, 0, TAU); g.fill();
    }
  };
}
/* an iris: three standards up, three falls down */
function flag(){
  return (g, N)=>{
    for(const a of [-.5, 0, .5]) leaf(g, N/2, N*.52, N*.46, N*.15, a, a ? .78 : .92, {vein:true, tip:.6});
    for(const a of [2.05, Math.PI, -2.05]){
      leaf(g, N/2, N*.5, N*.46, N*.19, a, a === Math.PI ? .9 : .75, {vein:true, tip:.55});
      g.save(); g.translate(N/2, N*.5); g.rotate(a);
      g.fillStyle = ink(.95, 1); g.beginPath(); g.ellipse(0, -N*.13, N*.035, N*.1, 0, 0, TAU); g.fill(); g.restore();
    }
  };
}
/* a single open flower seen from the front */
function single(o){
  return (g, N)=>{
    const {n = 5, eye = .2, pw = .62} = o;
    floret(g, N/2, N/2, N*.48, n, .86, {eye, eyeM:1, eyeL:.7, pw, notch:true});
  };
}
/* berries in a loose bunch, seen from above */
function berries(){
  return (g, N, r)=>{
    for(let i = 0; i < 46; i++){
      const a = i*2.39996, d = N*.4*Math.sqrt((i + .5)/46), x = N/2 + Math.cos(a)*d, y = N/2 + Math.sin(a)*d, R = N*.052*(.8 + r()*.4);
      stemLine(g, N/2, N/2, x, y, N*.006, .5);
      g.fillStyle = ink(.7, 0); g.beginPath(); g.arc(x, y, R, 0, TAU); g.fill();
      g.fillStyle = ink(1, 0); g.beginPath(); g.arc(x - R*.3, y - R*.3, R*.3, 0, TAU); g.fill();
    }
  };
}

/* ---------- the catalogue of textures ---------- */
const KINDS = {
  /* foliage sprigs */
  "leaf:ovate":      [512, sprig({n:15, len:.19, asp:.5, branches:3})],
  "leaf:ovate+edge": [512, sprig({n:15, len:.19, asp:.5, branches:3, edge:true})],
  "leaf:heart":      [512, sprig({n:15, len:.17, asp:.74, branches:3})],
  "leaf:lance":      [512, sprig({n:11, len:.3, asp:.24})],
  "leaf:lance+edge": [512, sprig({n:11, len:.3, asp:.24, edge:true})],
  "leaf:lobed":      [512, sprig({n:12, len:.19, asp:.4, lobes:1, branches:3})],
  "leaf:small":      [512, sprig({n:42, len:.14, asp:.52, branches:3})],
  "leaf:small+edge": [512, sprig({n:42, len:.14, asp:.52, branches:3, edge:true})],
  "leaf:fine":       [512, sprig({n:130, len:.1, asp:.5, branches:5})],
  "leaf:needle":     [512, sprig({n:110, len:.1, asp:.13, branches:5})],
  "leaf:carpet":     [256, carpet({})],
  /* conifers */
  "leaf:spruce":     [512, conifer({shoots:9, needle:.05, spread:1.05, step:.011, fan:1.0, reach:.52})],
  "leaf:pine":       [512, conifer({shoots:5, needle:.17, tufts:true, fan:.7, reach:.42, width:.005})],
  "leaf:arborvitae": [512, conifer({shoots:9, scales:true, fan:.75, reach:.5})],
  "leaf:juniper":    [512, conifer({shoots:11, needle:.03, spread:.55, step:.014, fan:.5, reach:.5, fork:true, width:.007})],
  "leaf:yew":        [512, conifer({shoots:7, needle:.06, spread:1.2, step:.012, flat:true, fan:.8, reach:.5, width:.008})],
  "leaf:succulent":  [256, carpet({n:260, size:.075, asp:.62})],
  /* compound and cut leaves */
  "leaf:pinnate":    [512, compound({pairs:10, asp:.24, len:.28})],
  "leaf:lacy":       [512, compound({pairs:8, asp:.2, len:.3, sub:1, taper:.45})],
  "leaf:fern":       [512, compound({pairs:17, asp:.13, len:.3, lance:true})],
  "leaf:ferny":      [512, compound({pairs:5, asp:.42, len:.16, three:true, taper:.4})],
  "leaf:peony":      [512, compound({pairs:3, asp:.34, len:.36, three:true, taper:.2})],
  /* single leaves */
  "leaf:hosta":        [512, broadLeaf({})],
  "leaf:hosta+edge":   [512, broadLeaf({variegation:"edge"})],
  "leaf:hosta+centre": [512, broadLeaf({variegation:"centre"})],
  "leaf:round":        [256, ruffled({})],
  "leaf:round+silver": [256, ruffled({overlay:true})],
  "leaf:strap":        [256, strap({})],
  "leaf:strap+stripe": [256, strap({variegation:"stripe"})],
  "leaf:sword":        [256, strap({wide:.17})],
  "leaf:blades":        [512, blades({})],
  "leaf:blades+stripe": [512, blades({stripe:true})],
  "leaf:blades-arch":   [512, blades({fan:.95, arch:.6, n:54})],
  "leaf:blades-arch+stripe": [512, blades({fan:.95, arch:.6, n:54, stripe:true})],
  /* flowers */
  "flower:daisy":        [256, daisy({n:15})],
  "flower:daisy-fine":   [256, daisy({n:24, pw:.26, eye:.24})],
  "flower:daisy-double": [256, daisy({n:18, double:true, pw:.42})],
  "flower:daisy-tip":    [256, daisy({n:14, tips:true, eye:.24, pw:.4})],
  "flower:spike":        [256, spike({})],
  "flower:spike-loose":  [256, spike({loose:true})],
  "flower:trumpet":      [256, trumpet({})],
  "flower:lily":         [256, trumpet({recurved:true, eye:.2})],
  "flower:shag":         [256, shag()],
  "flower:dome":         [256, cluster({shape:"dome", size:.085, n:130})],
  "flower:umbel":        [256, cluster({shape:"flat", size:.04, n:330, eye:.3})],
  "flower:umbel-lace":   [256, cluster({shape:"flat", size:.05, n:200, eye:.3, gaps:.35})],
  "flower:mop":          [256, cluster({shape:"round", size:.1, petals:4, n:120, gradient:true, eye:.15})],
  "flower:panicle":      [256, cluster({shape:"cone", size:.08, petals:4, n:170, gradient:true, eye:.15})],
  "flower:lilac":        [256, cluster({shape:"cone", size:.045, petals:4, n:420, eye:.2, wide:.7})],
  "flower:florets":      [256, fill({size:.11})],
  "flower:florets-fine": [256, fill({size:.07})],
  "flower:ruffles":      [256, fill({size:.12, ruffle:true})],
  "flower:plume":        [256, plume({})],
  "flower:plume-wide":   [256, plume({width:.34, dense:1.3})],
  "flower:plume-arch":   [256, plume({arch:.8, width:.16})],
  "flower:globe":        [256, globe()],
  "flower:bells":        [256, wand({kind:"bells"})],
  "flower:columbine":    [256, wand({kind:"columbine"})],
  "flower:hearts":       [256, wand({kind:"hearts"})],
  "flower:flag":         [256, flag()],
  "flower:single":       [128, single({})],
  "flower:single6":      [128, single({n:6, pw:.5})],
  "flower:berries":      [256, berries()]
};
export const TEXTURE_KINDS = Object.keys(KINDS);

const cache = new Map();
/* {map, luma, opaque} for a texture kind. `luma` is the mean brightness of the
   drawn texels, so the shader can land each plant on its catalogue colour. */
export function plantTexture(kind){
  let out = cache.get(kind);
  if(out) return out;
  const [N, paint] = KINDS[kind] || KINDS["leaf:ovate"];
  const c = document.createElement("canvas");
  c.width = c.height = N;
  const g = c.getContext("2d");
  let seed = 9173;
  for(let i = 0; i < kind.length; i++) seed = Math.imul(seed ^ kind.charCodeAt(i), 16777619);
  paint(g, N, rng(seed));
  const px = g.getImageData(0, 0, N, N).data;
  let sum = 0, n = 0, clear = 0;
  for(let i = 0; i < px.length; i += 16){
    if(px[i + 3] < 128){ clear++; continue; }
    sum += px[i]/255; n++;
  }
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.NoColorSpace;
  map.anisotropy = 8;
  const opaque = clear === 0;
  if(opaque) map.wrapS = map.wrapT = THREE.RepeatWrapping;
  out = {map, luma:n ? sum/n : .7, opaque};
  cache.set(kind, out);
  return out;
}
