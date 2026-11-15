/* ============================================================ plant catalog
   Everything that can go in a planting bed: perennials, grasses, groundcovers
   and shrubs. This file is data only. To add a plant, add one entry to PLANTS;
   nothing else needs to change as long as its `habit` and `bloom.form` already
   exist in models.js.

   One entry:

     k       stable key, saved in plan files. Never rename one that has shipped.
     n       common name with cultivar, as on a nursery tag
     sci     botanical name
     cat     "perennial" | "grass" | "groundcover" | "shrub"
     habit   the overall form, a key of HABITS in models.js. It picks both the
             plan symbol outline and the 3D model:
               mound     soft dome of foliage (catmint, geranium, spirea)
               upright   stiff vertical stems (salvia, coneflower, Russian sage)
               fountain  arching strap leaves or blades (daylily, iris, grasses)
               mat       ground-hugging carpet (thyme, creeping phlox, sedum)
               rosette   broad leaves from a central crown (hosta, bergenia)
               shrub     woody, rounded, branched to the ground
               conifer   dense evergreen globe or cushion
     h, w    mature height and spread in feet. `w` is the circle on the plan.
     foliage leaf colour (hex)
     bloom   optional {color, from, to, form}
               color  flower colour (hex); also the colour of the plan symbol
               from, to  "MM-DD" in the northern hemisphere; the app shifts
                         them six months south of the equator
               form   a key of FLOWERS in models.js:
                        spike | daisy | cluster | panicle | bell
     sun     the exposures it tolerates, any of "full" | "part" | "shade".
             A spot is "full" at or above the plan's full-sun hours, "part"
             from 4 hours, otherwise "shade".
     zone    [coldest, warmest] USDA hardiness zones
     winter  what is left out of season:
               "dormant"    dies back to the ground (the default for perennials)
               "standing"   dry stems and seedheads stay up (grasses, sedum)
               "bare"       woody twigs, no leaves (the default for shrubs)
               "evergreen"  unchanged
     fall    optional autumn foliage colour (hex)
     note    one or two sentences for the palette and the inspector

   The entries below are a small starter set that exercises every habit and
   flower form. They are placeholders for the real plant list. */

export const CATEGORIES = [
  {k:"perennial",   label:"Perennials"},
  {k:"grass",       label:"Grasses"},
  {k:"groundcover", label:"Groundcovers"},
  {k:"shrub",       label:"Shrubs"}
];

export const PLANTS = [
  /* ---- perennials ---- */
  {k:"catmint-walkers-low", n:"Catmint 'Walker's Low'", sci:"Nepeta × faassenii", cat:"perennial", habit:"mound",
   h:2.5, w:3, foliage:0x8e9c7c, bloom:{color:0x9c8fd6, from:"05-25", to:"09-05", form:"spike"},
   sun:["full","part"], zone:[3,8],
   note:"Grey-green mound under a long haze of lavender-blue. Shear after the first flush for a second."},
  {k:"salvia-may-night", n:"Salvia 'May Night'", sci:"Salvia × sylvestris 'Mainacht'", cat:"perennial", habit:"upright",
   h:1.75, w:1.5, foliage:0x55703c, bloom:{color:0x4b3a9a, from:"05-28", to:"07-10", form:"spike"},
   sun:["full"], zone:[4,8],
   note:"Deep violet spikes in early summer. Good repeated in drifts along the front."},
  {k:"coneflower-magnus", n:"Purple Coneflower 'Magnus'", sci:"Echinacea purpurea 'Magnus'", cat:"perennial", habit:"upright",
   h:3, w:1.75, foliage:0x4f6b34, bloom:{color:0xc763a0, from:"07-01", to:"09-10", form:"daisy"},
   sun:["full","part"], zone:[3,8], winter:"standing",
   note:"Rosy daisies with a copper cone, midsummer to fall. Seedheads feed finches in winter."},
  {k:"rudbeckia-goldsturm", n:"Black-eyed Susan 'Goldsturm'", sci:"Rudbeckia fulgida 'Goldsturm'", cat:"perennial", habit:"upright",
   h:2.25, w:2, foliage:0x47652f, bloom:{color:0xe9b320, from:"07-15", to:"09-25", form:"daisy"},
   sun:["full","part"], zone:[3,9], winter:"standing",
   note:"A solid block of gold in late summer. Spreads slowly into a colony."},
  {k:"daylily-stella", n:"Daylily 'Stella de Oro'", sci:"Hemerocallis 'Stella de Oro'", cat:"perennial", habit:"fountain",
   h:1.25, w:1.75, foliage:0x5c8238, bloom:{color:0xf0b91e, from:"06-10", to:"08-25", form:"bell"},
   sun:["full","part"], zone:[3,9],
   note:"Low arching foliage and golden trumpets that rebloom all summer."},
  {k:"iris-caesars-brother", n:"Siberian Iris 'Caesar's Brother'", sci:"Iris sibirica 'Caesar's Brother'", cat:"perennial", habit:"fountain",
   h:3, w:2, foliage:0x4d7740, bloom:{color:0x3d2f8f, from:"05-25", to:"06-20", form:"bell"},
   sun:["full","part"], zone:[3,8], fall:0xb9923c,
   note:"Upright grassy blades and velvet-purple flowers for three weeks in early summer."},
  {k:"peony-sarah-bernhardt", n:"Peony 'Sarah Bernhardt'", sci:"Paeonia lactiflora 'Sarah Bernhardt'", cat:"perennial", habit:"mound",
   h:3, w:3, foliage:0x3c5f2e, bloom:{color:0xf0a9c2, from:"06-01", to:"06-22", form:"cluster"},
   sun:["full"], zone:[3,8], fall:0x8a3b2c,
   note:"Big, fragrant, double pink flowers in June on a shrub-sized mound that lasts decades."},
  {k:"russian-sage", n:"Russian Sage", sci:"Salvia yangii", cat:"perennial", habit:"upright",
   h:3.5, w:3, foliage:0xa3ae9c, bloom:{color:0x8f8fd8, from:"07-10", to:"09-30", form:"panicle"},
   sun:["full"], zone:[4,9], winter:"standing",
   note:"Airy silver stems and a blue-violet cloud from July to frost. Wants heat and lean soil."},
  {k:"sedum-autumn-joy", n:"Sedum 'Autumn Joy'", sci:"Hylotelephium 'Herbstfreude'", cat:"perennial", habit:"mound",
   h:2, w:2, foliage:0x7c9a6c, bloom:{color:0xc0596b, from:"08-20", to:"10-15", form:"cluster"},
   sun:["full"], zone:[3,9], winter:"standing",
   note:"Succulent mound; flat flower heads go from pale pink to rust and stand through winter."},
  {k:"hosta-patriot", n:"Hosta 'Patriot'", sci:"Hosta 'Patriot'", cat:"perennial", habit:"rosette",
   h:1.5, w:3, foliage:0x3f6b3a, bloom:{color:0xc9b8e6, from:"07-05", to:"07-30", form:"bell"},
   sun:["part","shade"], zone:[3,8], fall:0xc7a646,
   note:"Wide green leaves edged in white. The standard answer for the shady side of a bed."},
  {k:"ostrich-fern", n:"Ostrich Fern", sci:"Matteuccia struthiopteris", cat:"perennial", habit:"fountain",
   h:3.5, w:3, foliage:0x4f8a3c,
   sun:["part","shade"], zone:[3,7],
   note:"Tall shuttlecocks of fresh green fronds. Spreads by runners in moist shade."},

  /* ---- grasses ---- */
  {k:"karl-foerster", n:"Feather Reed Grass 'Karl Foerster'", sci:"Calamagrostis × acutiflora 'Karl Foerster'", cat:"grass", habit:"upright",
   h:5, w:2, foliage:0x6f8f45, bloom:{color:0xd9c08a, from:"06-20", to:"10-15", form:"panicle"},
   sun:["full","part"], zone:[4,9], winter:"standing", fall:0xcfae6a,
   note:"A narrow vertical accent. Wheat-coloured plumes from June that stand all winter."},
  {k:"little-bluestem", n:"Little Bluestem", sci:"Schizachyrium scoparium", cat:"grass", habit:"fountain",
   h:3, w:1.75, foliage:0x7fa08f, bloom:{color:0xd8c8b4, from:"08-15", to:"10-15", form:"panicle"},
   sun:["full"], zone:[3,9], winter:"standing", fall:0xb5562f,
   note:"Native prairie grass: blue-green in summer, copper-orange from fall through winter."},

  /* ---- groundcovers ---- */
  {k:"creeping-thyme", n:"Creeping Thyme", sci:"Thymus serpyllum", cat:"groundcover", habit:"mat",
   h:.25, w:1.5, foliage:0x5d7a4a, bloom:{color:0xc77fc0, from:"06-05", to:"07-15", form:"cluster"},
   sun:["full"], zone:[4,9], winter:"evergreen",
   note:"A flat, fragrant carpet for bed edges and between stones. Pink-purple in early summer."},
  {k:"creeping-phlox", n:"Creeping Phlox 'Emerald Blue'", sci:"Phlox subulata 'Emerald Blue'", cat:"groundcover", habit:"mat",
   h:.5, w:2, foliage:0x4d7a4a, bloom:{color:0x8fa2e6, from:"05-01", to:"05-28", form:"cluster"},
   sun:["full","part"], zone:[3,9], winter:"evergreen",
   note:"Needle-leaved mat that disappears under lavender-blue flowers in May."},

  /* ---- shrubs ---- */
  {k:"hydrangea-little-lime", n:"Hydrangea 'Little Lime'", sci:"Hydrangea paniculata 'Jane'", cat:"shrub", habit:"shrub",
   h:4, w:4.5, foliage:0x486f35, bloom:{color:0xdfe8bf, from:"07-10", to:"09-30", form:"panicle"},
   sun:["full","part"], zone:[3,8],
   note:"Compact panicle hydrangea. Lime cones turn white, then pink, from midsummer into fall."},
  {k:"spirea-goldflame", n:"Spirea 'Goldflame'", sci:"Spiraea japonica 'Goldflame'", cat:"shrub", habit:"mound",
   h:3, w:3.5, foliage:0xa7b24a, bloom:{color:0xd8588f, from:"06-10", to:"07-25", form:"cluster"},
   sun:["full","part"], zone:[4,8], winter:"bare", fall:0xc8642c,
   note:"Chartreuse-gold foliage with rosy flower clusters in early summer; coppery in fall."},
  {k:"ninebark-little-devil", n:"Ninebark 'Little Devil'", sci:"Physocarpus opulifolius 'Donna May'", cat:"shrub", habit:"shrub",
   h:3.5, w:3.5, foliage:0x5a2f36, bloom:{color:0xf0dce0, from:"06-01", to:"06-25", form:"cluster"},
   sun:["full","part"], zone:[3,7],
   note:"Burgundy foliage all season as a dark foil for bright flowers. Pinkish-white clusters in June."},
  {k:"lilac-dwarf-korean", n:"Dwarf Korean Lilac", sci:"Syringa meyeri 'Palibin'", cat:"shrub", habit:"shrub",
   h:4.5, w:5.5, foliage:0x436a34, bloom:{color:0xc79adf, from:"05-18", to:"06-08", form:"panicle"},
   sun:["full"], zone:[3,7],
   note:"A dense, tidy lilac that stays under five feet. Fragrant lavender panicles in late May."},
  {k:"arborvitae-hetz-midget", n:"Globe Arborvitae 'Hetz Midget'", sci:"Thuja occidentalis 'Hetz Midget'", cat:"shrub", habit:"conifer",
   h:3, w:3.5, foliage:0x3d6a2c,
   sun:["full","part"], zone:[3,8], winter:"evergreen",
   note:"A slow evergreen ball. Year-round structure between the perennials."}
];

const BY_KEY = new Map(PLANTS.map(p=>[p.k, p]));
/* Plans can outlive the catalog: an unknown key still draws, as a grey mound. */
const UNKNOWN = {k:"?", n:"Unknown plant", sci:"", cat:"perennial", habit:"mound", h:1.5, w:1.5,
                 foliage:0x7a8274, sun:["full","part","shade"], zone:[1,13], note:"This plant is not in the catalog."};
export function plantByKey(k){ return BY_KEY.get(k) || UNKNOWN; }

export function winterHabit(p){
  return p.winter || (p.cat === "shrub" ? "bare" : p.cat === "grass" ? "standing" : "dormant");
}
/* The colour of a plant on the plan: its flowers if it has any, else its leaves. */
export function symbolColor(p){ return p.bloom ? p.bloom.color : p.foliage; }

export function sunClass(hours, fullSunHours){
  return hours >= fullSunHours ? "full" : hours >= 4 ? "part" : "shade";
}
export const SUN_LABEL = {full:"Full sun", part:"Part sun", shade:"Shade"};
export function sunNeeds(p){
  const has = k=>p.sun.includes(k);
  return has("full") && has("shade") ? "Sun or shade" : has("full") && has("part") ? "Full to part sun"
       : has("part") && has("shade") ? "Part sun to shade" : SUN_LABEL[p.sun[0]] || "Any exposure";
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const part = md=>{ const d = +md.slice(3); return (d <= 10 ? "early " : d <= 20 ? "mid " : "late ") + MONTHS[+md.slice(0,2)-1]; };
export function bloomText(p){
  if(!p.bloom) return "Foliage plant";
  const a = MONTHS[+p.bloom.from.slice(0,2)-1], b = MONTHS[+p.bloom.to.slice(0,2)-1];
  return a === b ? "Blooms in "+a : "Blooms "+part(p.bloom.from)+" to "+part(p.bloom.to);
}

/* What a plant looks like on a given day.
   md       "MM-DD", already shifted for the hemisphere
   growing  whether the plan's leaf season is on
   fall     0…1 through the last weeks before leaf drop
   Returns {state, bloom, fall}: state is "growing" | "dormant" | "standing" |
   "bare" | "evergreen"; bloom is true inside the flowering window. */
export function plantPhase(p, {md, growing, fall}){
  const wh = winterHabit(p);
  if(!growing && wh !== "evergreen") return {state:wh, bloom:false, fall:0};
  const bloom = !!p.bloom && growing && md >= p.bloom.from && md <= p.bloom.to;
  return {state: wh === "evergreen" ? "evergreen" : "growing", bloom, fall: p.fall != null ? fall : 0};
}
export function phaseKey(ph){ return ph.state + (ph.bloom ? "+b" : "") + (ph.fall > 0 ? "+f"+Math.round(ph.fall*4) : ""); }

/* The numbered key for one bed: each kind of plant once, in the order it was
   first planted, with how many there are. Repeated plants share a number. */
export function bedLegend(bed){
  const rows = [], at = new Map();
  for(const pl of bed.plants || []){
    let r = at.get(pl.k);
    if(!r){ r = {k:pl.k, plant:plantByKey(pl.k), no:rows.length+1, count:0}; at.set(pl.k, r); rows.push(r); }
    r.count++;
  }
  return rows;
}
