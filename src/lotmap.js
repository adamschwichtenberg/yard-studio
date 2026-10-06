/* Find my lot: search an address, line an outline up with the aerial photo,
   and bring it into the plan in feet.

   Everything here is free and needs no key:
   - Address search: OpenStreetMap's Nominatim. Its usage policy allows about
     one request a second and no search-as-you-type, so the page only searches
     when asked and waits a moment between searches.
   - Aerial photos: Esri World Imagery by default (sharp enough to see
     property lines; free to view with attribution), or USGS The National Map
     (public domain, US only, but only sharp to about zoom 16, so blurry at
     lot scale), plus the OpenStreetMap street map.
   - The map itself: Leaflet, bundled with the app.

   Only the outline's shape comes back; the photos stay on the map. */
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const LAYERS = {
  esri:{label:"Esri aerial", native:19, attribution:"Imagery © Esri, Maxar, Earthstar Geographics",
        url:"https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"},
  usgs:{label:"USGS aerial", native:16, attribution:'Imagery: <a href="https://www.usgs.gov/programs/national-geospatial-program/national-map" target="_blank" rel="noopener">USGS The National Map</a>',
        url:"https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}"},
  osm: {label:"Street map", native:19, attribution:'© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors',
        url:"https://tile.openstreetmap.org/{z}/{x}/{y}.png"}
};
const SEARCH = "https://nominatim.openstreetmap.org/search";
const PAGES_URL = "https://adamschwichtenberg.github.io/yard-studio/";
const FT = 3.28084;

/* metres per degree at a latitude (WGS84, good to centimetres over a lot) */
function mPerDeg(lat){
  const p = lat*Math.PI/180;
  return {lat:111132.92 - 559.82*Math.cos(2*p) + 1.175*Math.cos(4*p),
          lon:111412.84*Math.cos(p) - 93.5*Math.cos(3*p)};
}
/* plan feet <-> lat/lon around an anchor. Plan up is the true bearing
   `north` degrees; x runs right, y runs down. */
export function planToGeo(pts, anchor){
  const t = anchor.north*Math.PI/180, c = Math.cos(t), s = Math.sin(t), k = mPerDeg(anchor.lat);
  return pts.map(p=>{
    const vx = p.x - anchor.x, vy = p.y - anchor.y;
    const E = (vx*c - vy*s)/FT, N = (-vx*s - vy*c)/FT;
    return L.latLng(anchor.lat + N/k.lat, anchor.lon + E/k.lon);
  });
}
export function geoToPlan(lls, anchor){
  const t = anchor.north*Math.PI/180, c = Math.cos(t), s = Math.sin(t), k = mPerDeg(anchor.lat);
  return lls.map(ll=>{
    const E = (ll.lng - anchor.lon)*k.lon*FT, N = (ll.lat - anchor.lat)*k.lat*FT;
    return {x:anchor.x + E*c - N*s, y:anchor.y - (E*s + N*c)};
  });
}
function areaFt(lls){
  if(lls.length < 3) return 0;
  const a = {lat:lls[0].lat, lon:lls[0].lng, x:0, y:0, north:0}, p = geoToPlan(lls, a);
  let s = 0;
  for(let i=0;i<p.length;i++){ const q = p[(i+1)%p.length]; s += p[i].x*q.y - q.x*p[i].y; }
  return Math.abs(s)/2;
}
const esc = s=>String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

export class LotMap {
  /* onApply({points, anchor, label}) gets the outline in plan feet.
     fmtArea(sqft) formats an area in the user's units. */
  constructor({onApply, fmtArea, layer = "esri", onLayer}){
    this.onApply = onApply; this.fmtArea = fmtArea || (a=>Math.round(a)+" sq ft");
    this.layerKey = LAYERS[layer] ? layer : "esri"; this.onLayer = onLayer;
    this.pts = []; this.label = ""; this.lastSearch = 0;
    this.#dom();
  }
  #dom(){
    const el = this.el = document.createElement("div");
    el.id = "lotmap"; el.hidden = true;
    el.innerHTML = `<section class="panel lmbox" role="dialog" aria-modal="true" aria-labelledby="lmtitle">
      <header class="lmhead">
        <div><span class="eyebrow">Find my lot</span><h3 id="lmtitle">Search your address, then drag the corners onto your property line</h3></div>
        <button class="ibtn lmclose" type="button" aria-label="Close"><svg class="ic"><use href="#i-close"/></svg></button>
      </header>
      <form class="lmsearch" role="search">
        <input type="search" name="q" placeholder="Street address, city, state" autocomplete="street-address" aria-label="Address" required>
        <button class="btn solid" type="submit">Search</button>
      </form>
      <div class="lmresults" hidden></div>
      <div class="lmwrap">
        <div class="lmmap"></div>
        <div class="lmnote" hidden></div>
      </div>
      <footer class="lmfoot">
        <div class="seg tiny lmlayers" role="group" aria-label="Map layer">${Object.entries(LAYERS).map(([k, v])=>`<button type="button" data-layer="${k}">${v.label}</button>`).join("")}</div>
        <p class="lmhint">Drag the <b>corners</b> · tap <b>+</b> to add a corner · double-tap a corner to remove it · drag the <b>centre</b> to move the whole outline.</p>
        <span class="lmstat num"></span>
        <div class="lmbtns"><button class="btn" type="button" data-lm="cancel">Cancel</button><button class="btn solid" type="button" data-lm="apply">Use this outline</button></div>
      </footer>
    </section>`;
    document.body.appendChild(el);
    const $ = s=>el.querySelector(s);
    this.form = $(".lmsearch"); this.input = this.form.q; this.results = $(".lmresults");
    this.note = $(".lmnote"); this.stat = $(".lmstat");
    this.form.addEventListener("submit", e=>{ e.preventDefault(); this.search(this.input.value); });
    $(".lmclose").addEventListener("click", ()=>this.close());
    $('[data-lm="cancel"]').addEventListener("click", ()=>this.close());
    $('[data-lm="apply"]').addEventListener("click", ()=>this.apply());
    $(".lmlayers").addEventListener("click", e=>{ const b = e.target.closest("[data-layer]"); if(b) this.setLayer(b.dataset.layer); });
    this.results.addEventListener("click", e=>{
      const b = e.target.closest("[data-i]");
      if(b) this.goTo(this.found[+b.dataset.i]);
    });
    /* keep the app's keyboard shortcuts (WASD, G, 1-3…) out of the dialog */
    el.addEventListener("keydown", e=>{ e.stopPropagation(); if(e.key === "Escape") this.close(); });
    el.addEventListener("pointerdown", e=>{ if(e.target === el) this.close(); });
  }
  #ensureMap(){
    if(this.map) return;
    this.map = L.map(this.el.querySelector(".lmmap"), {zoomControl:true, maxZoom:21, doubleClickZoom:false, attributionControl:true});
    this.map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
    this.setLayer(this.layerKey);
    this.poly = L.polygon([], {color:"#F2C94C", weight:2.5, fillColor:"#F2C94C", fillOpacity:.12, interactive:false}).addTo(this.map);
    this.handles = L.layerGroup().addTo(this.map);
    this.map.on("zoomend", ()=>this.#draw());
  }
  setLayer(k){
    if(!LAYERS[k]) return;
    this.layerKey = k; this.onLayer?.(k);
    this.el.querySelectorAll("[data-layer]").forEach(b=>b.setAttribute("aria-pressed", b.dataset.layer === k));
    if(!this.map) return;
    if(this.tiles) this.map.removeLayer(this.tiles);
    const d = LAYERS[k];
    this.tileErrors = 0; this.tileOK = 0;
    this.tiles = L.tileLayer(d.url, {maxNativeZoom:d.native, maxZoom:21, attribution:d.attribution, crossOrigin:false})
      .on("tileload", ()=>{ this.tileOK++; if(!this.blocked) this.#notice(null); })
      .on("tileerror", ()=>{ if(++this.tileErrors > 6 && !this.tileOK) this.#notice("blocked"); })
      .addTo(this.map);
    this.tiles.bringToBack();
  }
  #notice(kind, text){
    if(!kind){ this.note.hidden = true; return; }
    this.note.hidden = false;
    this.note.innerHTML = kind === "blocked"
      ? `<b>The map can't reach outside sites from here.</b> Pages shown inside claude.ai can't load map photos or search. Open the app on its own site to use this: <a href="${PAGES_URL}" target="_blank" rel="noopener">${PAGES_URL}</a>`
      : text;
  }
  /* anchor: {lat, lon, x, y, north} ties a plan point to the map. */
  open({anchor, boundary, label}){
    this.el.hidden = false;
    this.#ensureMap();
    this.anchor = {...anchor};
    this.label = label || "";
    this.results.hidden = true;
    this.pts = planToGeo(boundary, this.anchor);
    this.map.invalidateSize();
    this.map.fitBounds(L.latLngBounds(this.pts).pad(.6), {maxZoom:19});
    this.#draw();
    setTimeout(()=>{ this.map.invalidateSize(); this.input.focus(); }, 60);
  }
  close(){ this.el.hidden = true; }

  async search(q){
    q = q.trim();
    if(!q) return;
    /* Nominatim asks for no more than one request a second */
    const wait = this.lastSearch + 1100 - Date.now();
    if(wait > 0) await new Promise(r=>setTimeout(r, wait));
    this.lastSearch = Date.now();
    const btn = this.form.querySelector("button");
    btn.disabled = true; btn.textContent = "Searching…";
    this.results.hidden = false; this.results.innerHTML = `<p class="hint">Searching OpenStreetMap…</p>`;
    try{
      const u = new URL(SEARCH);
      u.search = new URLSearchParams({q, format:"jsonv2", limit:"6", addressdetails:"1", "accept-language":navigator.language || "en"});
      const res = await fetch(u, {headers:{Accept:"application/json"}});
      if(!res.ok) throw new Error("HTTP " + res.status);
      this.found = await res.json();
      if(!this.found.length){
        this.results.innerHTML = `<p class="hint">No match for “${esc(q)}”. Try the street address with the city and state, or just the city and pan to your house.</p>`;
      } else if(this.found.length === 1) this.goTo(this.found[0]);
      else this.results.innerHTML = this.found.map((r, i)=>`<button type="button" data-i="${i}"><b>${esc(shortName(r))}</b><span>${esc(r.display_name)}</span></button>`).join("");
    }catch(err){
      console.warn("address search", err);
      this.results.innerHTML = `<p class="hint"><b>Search couldn't reach OpenStreetMap.</b> Check the connection and try again. Inside claude.ai the search is blocked; open <a href="${PAGES_URL}" target="_blank" rel="noopener">the app's own site</a> to use it.</p>`;
    }finally{
      btn.disabled = false; btn.textContent = "Search";
    }
  }
  /* Move to a search result and carry the outline along, centred on it. */
  goTo(r){
    this.results.hidden = true;
    const ll = L.latLng(+r.lat, +r.lon);
    const c = L.latLngBounds(this.pts).getCenter();
    const dLat = ll.lat - c.lat, dLon = ll.lng - c.lng;
    /* re-lay the shape at the new latitude so its feet stay true */
    const plan = geoToPlan(this.pts, this.anchor);
    this.anchor = {...this.anchor, lat:this.anchor.lat + dLat, lon:this.anchor.lon + dLon};
    this.pts = planToGeo(plan, this.anchor);
    this.label = shortName(r);
    const house = r.addresstype === "building" || r.address?.house_number || r.category === "building";
    if(house) this.map.fitBounds(L.latLngBounds(this.pts).pad(.25), {maxZoom:20});
    else this.map.setView(ll, 17);
    this.#draw();
    if(!house) this.#notice("info", "That's a whole area, not one house: zoom in to your lot, then drag the outline there (grab the centre).");
    else this.#notice(null);
  }
  #draw(){
    if(!this.map) return;
    this.poly.setLatLngs(this.pts);
    this.handles.clearLayers();
    const n = this.pts.length;
    this.pts.forEach((p, i)=>{
      const m = L.marker(p, {draggable:true, keyboard:false, title:"Drag this corner",
        icon:L.divIcon({className:"lm-corner", iconSize:[18, 18]})}).addTo(this.handles);
      m.on("drag", e=>{ this.pts[i] = e.target.getLatLng(); this.poly.setLatLngs(this.pts); this.#stats(); });
      m.on("dragend", ()=>this.#draw());
      const del = ()=>{ if(this.pts.length > 3){ this.pts.splice(i, 1); this.#draw(); } };
      m.on("dblclick", del); m.on("contextmenu", del);
      const q = this.pts[(i+1)%n], mid = L.latLng((p.lat + q.lat)/2, (p.lng + q.lng)/2);
      L.marker(mid, {keyboard:false, title:"Add a corner here",
        icon:L.divIcon({className:"lm-mid", html:"+", iconSize:[18, 18]})}).addTo(this.handles)
        .on("click", ()=>{ this.pts.splice(i+1, 0, mid); this.#draw(); });
    });
    /* the centre handle moves the whole outline */
    const c = L.latLngBounds(this.pts).getCenter();
    let start = null;
    L.marker(c, {draggable:true, keyboard:false, title:"Drag to move the whole outline",
      icon:L.divIcon({className:"lm-move", html:'<svg viewBox="0 0 16 16"><path d="M8 1.6v12.8M1.6 8h12.8M8 1.6L6.1 3.7M8 1.6l1.9 2.1M8 14.4l-1.9-2.1M8 14.4l1.9-2.1M1.6 8l2.1-1.9M1.6 8l2.1 1.9M14.4 8l-2.1-1.9M14.4 8l-2.1 1.9"/></svg>', iconSize:[30, 30]})})
      .addTo(this.handles)
      .on("dragstart", e=>{ start = {c:e.target.getLatLng(), pts:this.pts.map(p=>L.latLng(p.lat, p.lng))}; })
      .on("drag", e=>{
        const ll = e.target.getLatLng(), dLat = ll.lat - start.c.lat, dLon = ll.lng - start.c.lng;
        this.pts = start.pts.map(p=>L.latLng(p.lat + dLat, p.lng + dLon));
        this.poly.setLatLngs(this.pts);
      })
      .on("dragend", ()=>this.#draw());
    this.#stats();
  }
  #stats(){
    this.stat.textContent = `${this.pts.length} corners · ${this.fmtArea(areaFt(this.pts))}`;
  }
  apply(){
    if(this.pts.length < 3) return;
    /* Anchor the plan on the outline's centre so the feet are measured
       where the lot is. */
    const c = L.latLngBounds(this.pts).getCenter();
    const anchor = {lat:c.lat, lon:c.lng, x:0, y:0, north:this.anchor.north};
    const points = geoToPlan(this.pts, anchor);
    this.close();
    this.onApply({points, anchor, label:this.label});
  }
}
function shortName(r){
  const a = r.address || {};
  const street = [a.house_number, a.road].filter(Boolean).join(" ");
  const town = a.city || a.town || a.village || a.hamlet || a.suburb || "";
  const st = a.state_code || (a["ISO3166-2-lvl4"] || "").split("-")[1] || a.state || "";
  return [street || r.name, town, st].filter(Boolean).join(", ") || r.display_name;
}
