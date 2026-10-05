/* Where plans live between visits.

   Every named plan keeps a copy in this browser (IndexedDB), so it can be
   reopened from the Plan file list and picked up again after a reload.
   Where the browser allows it (Chrome and Edge on a computer, opened as a
   top-level page) a plan can also be tied to a real .json file on disk:
   the File System Access API hands back a file handle, which IndexedDB can
   store, so autosave writes straight into that file. Elsewhere (Safari,
   Firefox, phones, or inside an embedding frame) plans save in the browser
   and "Download a copy" gives the user a file. */

const DB = "yard-shade-studio", VER = 1;
let dbp = null;
function db(){
  dbp ??= new Promise((res, rej)=>{
    let req;
    try{ req = indexedDB.open(DB, VER); }catch(err){ rej(err); return; }
    req.onupgradeneeded = ()=>{
      const d = req.result;
      if(!d.objectStoreNames.contains("plans")) d.createObjectStore("plans", {keyPath:"id"});
      if(!d.objectStoreNames.contains("meta")) d.createObjectStore("meta");
    };
    req.onsuccess = ()=>res(req.result);
    req.onerror = ()=>rej(req.error);
  });
  return dbp;
}
function run(store, mode, fn){
  return db().then(d=>new Promise((res, rej)=>{
    const tx = d.transaction(store, mode), st = tx.objectStore(store);
    const req = fn(st);
    tx.oncomplete = ()=>res(req?.result);
    tx.onerror = ()=>rej(tx.error);
    tx.onabort = ()=>rej(tx.error);
  }));
}

export const store = {
  getPlan: id=>run("plans", "readonly", s=>s.get(id)),
  putPlan: rec=>run("plans", "readwrite", s=>s.put(rec)),
  delPlan: id=>run("plans", "readwrite", s=>s.delete(id)),
  /* newest first, without the plan data itself */
  async listPlans(){
    const all = await run("plans", "readonly", s=>s.getAll()) || [];
    return all.map(({data, ...r})=>r).sort((a, b)=>b.updated - a.updated);
  },
  getMeta: k=>run("meta", "readonly", s=>s.get(k)),
  setMeta: (k, v)=>run("meta", "readwrite", s=>s.put(v, k)),
  delMeta: k=>run("meta", "readwrite", s=>s.delete(k))
};

export const newPlanId = ()=>"p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/* ---------- files on disk ---------- */
const PICK = {types:[{description:"Yard plan", accept:{"application/json":[".json"]}}], excludeAcceptAllOption:false};
/* File pickers only work in a top-level page; framed copies fall back to the browser. */
export const canUseFiles = ()=>{
  try{ return "showSaveFilePicker" in window && window.self === window.top; }catch{ return false; }
};
export const fileName = name=>(name || "yard").trim().replace(/[\\/:*?"<>|]+/g, "-").slice(0, 60) + ".json";

/* Ask where to save. Resolves a handle, or null if the user cancelled. */
export async function pickSaveFile(name){
  try{ return await window.showSaveFilePicker({...PICK, suggestedName:fileName(name)}); }
  catch(err){ if(err?.name === "AbortError") return null; throw err; }
}
export async function pickOpenFile(){
  try{ const [h] = await window.showOpenFilePicker({...PICK, multiple:false}); return h || null; }
  catch(err){ if(err?.name === "AbortError") return null; throw err; }
}
/* "granted", or "prompt"/"denied" when the browser needs the user to say yes
   again (after a reload). Pass ask=true only from a click. */
export async function filePermission(handle, ask){
  const o = {mode:"readwrite"};
  let p = await handle.queryPermission?.(o) ?? "granted";
  if(p !== "granted" && ask) p = await handle.requestPermission(o);
  return p;
}
export async function writeFile(handle, text){
  const w = await handle.createWritable();
  await w.write(text);
  await w.close();
}
export async function readFile(handle){
  return (await handle.getFile()).text();
}
