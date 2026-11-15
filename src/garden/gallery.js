/* QA gallery (gallery.html): every catalog preset, by growth form, on a chosen
   day of the year, plus the texture sheet the models are built from. */
import { PLANTS } from "./plants.js";
import { MODELS } from "./models.js";
import { plantThumb } from "./thumbs.js";
import { plantTexture, TEXTURE_KINDS } from "./plantTextures.js";

const VIEWS = [
  {k:"best", label:"In bloom", season:null},
  {k:"jun", label:"June 5", season:{md:"06-05", growing:true, fall:0}},
  {k:"aug", label:"August 1", season:{md:"08-01", growing:true, fall:0}},
  {k:"oct", label:"October 5 (fall)", season:{md:"10-05", growing:true, fall:.9}},
  {k:"win", label:"Winter", season:{md:"01-15", growing:false, fall:0}},
  {k:"tex", label:"Textures"}
];
let view = new URLSearchParams(location.search).get("view") || "best";
const only = new URLSearchParams(location.search).get("model");
const bar = document.getElementById("bar"), host = document.getElementById("host");
bar.innerHTML = VIEWS.map(v=>`<button data-v="${v.k}">${v.label}</button>`).join("");
bar.addEventListener("click", e=>{ const b = e.target.closest("button"); if(b){ view = b.dataset.v; draw(); } });
const ft = v=>v < 1 ? Math.round(v*12)+" in" : (+v.toFixed(1))+" ft";

function drawTextures(){
  host.innerHTML = `<h2>Textures<span>first colour green, second colour pink</span></h2><div class="grid tex" id="tx"></div>`;
  const tx = document.getElementById("tx");
  for(const kind of TEXTURE_KINDS){
    const src = plantTexture(kind).map.image, N = src.width;
    const c = document.createElement("canvas"); c.width = c.height = N;
    const g = c.getContext("2d");
    const px = src.getContext("2d").getImageData(0, 0, N, N), d = px.data;
    for(let i = 0; i < d.length; i += 4){
      const l = d[i]/255, m = d[i+1]/255;
      d[i] = l*(90 + 150*m); d[i+1] = l*(190 - 90*m); d[i+2] = l*(80 + 110*m);
    }
    g.putImageData(px, 0, 0);
    const f = document.createElement("figure");
    f.append(c);
    f.insertAdjacentHTML("beforeend", `<figcaption><b>${kind}</b></figcaption>`);
    tx.append(f);
  }
}
function draw(){
  bar.querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed", b.dataset.v === view));
  if(view === "tex") return drawTextures();
  const season = VIEWS.find(v=>v.k === view)?.season || undefined;
  host.innerHTML = "";
  for(const [key, model] of Object.entries(MODELS)){
    if(only && only !== key) continue;
    const list = PLANTS.filter(p=>p.model === key);
    if(!list.length) continue;
    host.insertAdjacentHTML("beforeend", `<h2>${model.label}<span>${key} · ${list.length}</span></h2><div class="grid" data-m="${key}"></div>`);
    const grid = host.lastElementChild;
    for(const p of list){
      const f = document.createElement("figure");
      f.innerHTML = `<img alt=""><figcaption><b>${p.n}</b><i>${ft(p.h)} × ${ft(p.w)}</i></figcaption>`;
      grid.append(f);
      queue.push(()=>{ f.firstChild.src = plantThumb(p, {season}); });
    }
  }
  pump();
}
/* render a few per frame so the page stays responsive */
const queue = [];
let pumping = false;
function pump(){
  if(pumping) return;
  pumping = true;
  const step = ()=>{
    const t = performance.now();
    while(queue.length && performance.now() - t < 24) queue.shift()();
    if(queue.length) requestAnimationFrame(step); else { pumping = false; document.body.dataset.done = "1"; }
  };
  delete document.body.dataset.done;
  requestAnimationFrame(step);
}
draw();
