/* ============================================================ plant catalog
   Every plant that can go in a planting bed. Data only: each entry is a
   preset on one of the growth forms in models.js, so adding a variety is a
   new row here and nothing else.

   Rows are written in groups that share a model and defaults:

     group({model, cat, sci, sun, zone, bloom, foliage, …}, [
       [name, height ft, spread ft, flower colour, {overrides}], …
     ])

   The fields of a finished entry:

     k        stable key, saved in plan files (a slug of the name)
     n        common name with variety, as on a nursery tag
     sci      botanical name
     cat      "perennial" | "grass" | "groundcover" | "shrub"
     model    a key of MODELS in models.js: the growth form
     h, w     mature height and spread in feet. `w` is the circle on the plan.
     foliage  leaf colour. foliage2: the second leaf colour of a variegated
              or silvered leaf.
     flower   bloom colour, or a list the bloom ages through over its season
              (panicle hydrangeas: lime, then white, then pink). null for a
              foliage plant.
     flower2  the bloom's second colour: a daisy's cone, a daylily's throat,
              the older base of a panicle (a list ages like `flower`).
     mix      other colours individual flowers may take (a seed mix)
     stem     stem colour: what a shrub shows in winter
     bloom    {from, to} as "MM-DD", northern hemisphere; the app shifts them
              six months south of the equator. bloomLabel overrides the
              wording (berries, plumes).
     sun      exposures it tolerates: any of "full" | "part" | "shade"
     zone     [coldest, warmest] USDA zones
     winter   out of season: "dormant" (cut back), "standing" (dry stems and
              seedheads), "heads" (bare stems holding dried blooms), "bare"
              (twigs), "evergreen"
     fall     autumn leaf colour. winterFoliage: the colour an evergreen
              turns in the cold (a juniper going plum).
     opt      options for the growth form (see its build() in models.js);
              `trunk` (ft) raises a shrub's canopy into a patio tree
     note     a line for the library card

   Sizes are mature sizes from the grower or the garden centre catalogue,
   rounded; check the tag of the plant you buy. */

export const CATEGORIES = [
  {k:"perennial",   label:"Perennials"},
  {k:"grass",       label:"Grasses"},
  {k:"groundcover", label:"Groundcovers"},
  {k:"shrub",       label:"Shrubs"},
  {k:"evergreen",   label:"Evergreens"}
];

const FULL = ["full"], FP = ["full","part"], PS = ["part","shade"], ANY = ["full","part","shade"];
const WHITE = 0xF5F4EC, CREAM = 0xF2EAC8, GREEN = 0x4f6f36, DARK = 0x3a5f2e;
const slug = s=>s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/['’.]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const PLANTS = [];
function group(def, rows){
  for(const [n, h, w, flower, over = {}] of rows){
    const p = {...def, ...over, n, h, w, flower, k:over.k || slug(n)};
    p.opt = {...(def.opt || {}), ...(over.opt || {})};
    if(Array.isArray(p.bloom)) p.bloom = {from:p.bloom[0], to:p.bloom[1]};
    if(p.flower == null) delete p.bloom;
    PLANTS.push(p);
  }
}

/* ================================================================ PERENNIALS */
/* P1 — coneflowers and daisies */
const ECH = {model:"coneflower", cat:"perennial", sci:"Echinacea", sun:FP, zone:[4,8], bloom:["07-01","09-10"], foliage:0x4f6b34,
             flower2:0x8a4a1c, winter:"standing", opt:{droop:.45}, note:"Drooping petals round a raised cone, midsummer to fall. Seedheads stand through winter."};
group(ECH, [
  ["Coneflower 'Magnus'", 2.5, 1.5, 0xD0588F, {sci:"Echinacea purpurea 'Magnus'", zone:[3,8], opt:{droop:.3}}],
  ["Coneflower 'PowWow Wild Berry'", 1.4, 1.2, 0xB0408A],
  ["Coneflower 'Kismet Raspberry'", 1.75, 1.5, 0xC2275E],
  ["Coneflower 'Artisan Red Ombre'", 1.9, 1.5, 0xB8202A],
  ["Coneflower 'Sombrero Fiesta Orange'", 1.6, 1.5, 0xE86A1C, {flower2:0x9a5a2a}],
  ["Coneflower 'Artisan Soft Orange'", 2, 1.5, 0xF0A060],
  ["Coneflower 'SunSeekers Mineola'", 1.3, 1.2, 0xEE8A2A, {opt:{droop:.2, tex:"flower:daisy-double"}, note:"Semi-double orange flowers on a compact plant."}],
  ["Coneflower 'Cheyenne Spirit'", 1.75, 1.5, 0xE2562A, {mix:[0xD7301F, 0xF2C230, 0xE86AA0], note:"A seed mix: each plant flowers in its own shade from scarlet through orange to yellow."}],
  ["Coneflower 'SunMagic Yellow'", 1.5, 1.3, 0xF2C230],
  ["Coneflower 'Prairie Splendor'", 2, 1.5, 0xC8508C, {sci:"Echinacea purpurea 'Prairie Splendor'", zone:[3,8], bloom:["06-20","09-15"], opt:{droop:.2}, note:"Rose-magenta flowers that start two weeks ahead of most coneflowers and carry on to fall."}],
  ["Coneflower 'Sombrero Salsa Red'", 2, 1.8, 0xC8321E, {k:"coneflower-salsa-red", flower2:0x7a3a1c, note:"Glowing red-orange flowers on sturdy, well-branched stems."}],
  ["Coneflower 'SunSeekers Rainbow'", 1.6, 1.5, [0xE0507A, 0xF08A4A, 0xF2C860], {opt:{droop:.15}, note:"Each flower opens rose-pink and ages through orange to soft yellow, so one plant carries every shade at once."}],
  ["Coneflower 'Kismet Red'", 1.5, 1.5, 0xC8201E, {note:"True red flowers in great numbers on a compact, long-blooming plant."}]
]);
group({...ECH, sci:"Rudbeckia", zone:[3,9], bloom:["07-15","09-25"], foliage:0x47652f, flower2:0x1c120c, opt:{droop:.06},
       note:"Flat gold daisies with a dark eye, late summer into fall."}, [
  ["Black-eyed Susan 'Goldsturm'", 2, 2, 0xF2B705, {sci:"Rudbeckia fulgida 'Goldsturm'", k:"rudbeckia-goldsturm"}],
  ["Black-eyed Susan 'Little Goldstar'", 1.25, 1.25, 0xF2B705, {sci:"Rudbeckia fulgida 'Little Goldstar'"}],
  ["Rudbeckia 'Prairie Glow'", 3.5, 2.5, 0xA8421C, {sci:"Rudbeckia triloba 'Prairie Glow'", flower2:0xF2C230, opt:{droop:.06, tex:"flower:daisy-tip"}, note:"Burnt-red daisies tipped in yellow on a tall, airy plant."}]
]);
group({...ECH, sci:"Leucanthemum × superbum", zone:[4,9], bloom:["06-20","08-15"], foliage:0x2f5a2e, flower2:0xE8C23A, winter:"dormant",
       opt:{droop:0, tex:"flower:daisy-fine"}, note:"Clean white daisies with a yellow eye in early summer."}, [
  ["Shasta Daisy 'Snowcap'", 1, 1.25, 0xF7F7F2],
  ["Shasta Daisy 'Mt. Hood'", 1.7, 1.5, 0xF7F7F2, {opt:{droop:0, tex:"flower:daisy-double"}, note:"Fully double white flowers."}],
  ["Shasta Daisy 'Real Neat'", 1.3, 1.5, 0xF7F7F2, {sci:"Leucanthemum × superbum 'Real Neat'", zone:[5,9], note:"White petals rolled into flutes that flare at the tip, round a gold eye."}],
  ["Shasta Daisy 'Real Sunbeam'", 1.7, 1.7, [0xF2DC6A, 0xF4E8A0, 0xF6F2DC], {sci:"Leucanthemum × superbum 'Real Sunbeam'", zone:[5,9], flower2:0xE0B020, opt:{droop:0, tex:"flower:daisy-double"}, note:"Semi-double flowers open sunny yellow and soften to cream as they age."}]
]);
group({...ECH, opt:{droop:.05}}, [
  ["False Sunflower 'Tuscan Sun'", 2.5, 2, 0xF0B414, {sci:"Heliopsis helianthoides 'Tuscan Sun'", zone:[3,9], flower2:0xC98A10, bloom:["06-25","09-10"], note:"Golden daisies for most of the summer on a compact plant."}],
  ["Sneezeweed 'Mardi Gras'", 1.75, 1.5, 0xD8481E, {sci:"Helenium 'Mardi Gras'", flower2:0xF2C230, bloom:["07-10","09-01"], opt:{droop:.3, tex:"flower:daisy-tip"}, note:"Yellow petals splashed orange-red round a brown button."}],
  ["Blanket Flower 'Arizona Sun'", 1.4, 1.2, 0xC8281E, {sci:"Gaillardia × grandiflora 'Arizona Sun'", zone:[3,9], flower2:0xF2C230, bloom:["06-10","09-25"], winter:"dormant", opt:{droop:.05, tex:"flower:daisy-tip"}, note:"Red daisies tipped in yellow from June to frost on a low mound."}],
  ["Blanket Flower 'Barbican Yellow Red Ring'", 1.2, 1.2, 0xB8281E, {sci:"Gaillardia × grandiflora 'Barbican Yellow Red Ring'", zone:[3,9], flower2:0xF2C830, bloom:["06-10","09-25"], winter:"dormant", opt:{droop:.05, tex:"flower:daisy-tip"}, note:"Broad yellow petals with a red ring round the eye, June to frost, on a tidy mound."}],
  ["Blanket Flower 'SpinTop Mariachi Copper Sun'", 1, 1.2, 0xD0602A, {sci:"Gaillardia aristata 'SpinTop Mariachi Copper Sun'", zone:[3,9], flower2:0xF0B840, bloom:["06-10","09-25"], winter:"dormant", opt:{droop:.05, tex:"flower:daisy-tip"}, note:"Fluted copper-orange petals tipped in gold on a low, uniform plant."}]
]);

/* P2 — hostas and bold foliage */
group({model:"hosta", cat:"perennial", sci:"Hosta", sun:PS, zone:[3,8], bloom:["07-05","08-05"], foliage:0x3f6b3a, fall:0xc7a646,
       symbol:"foliage", note:"A mound of broad, ribbed leaves for shade, with flower scapes above in summer."}, [
  ["Hosta 'Halcyon'", 2.2, 3, 0xC9B8E6, {foliage:0x6F8FA0, opt:{mound:.62}, note:"Powder-blue, heavily ribbed leaves that hold their colour all season."}],
  ["Hosta 'Sum and Substance'", 4, 5.5, 0xD8CCE8, {foliage:0xB4BE46, sun:ANY, opt:{mound:.72, leaf:1.15}, note:"A giant: chartreuse-gold leaves two feet across. Takes more sun than most."}],
  ["Hosta 'Royal Standard'", 3.4, 4, WHITE, {foliage:0x4f8a3c, sun:ANY, bloom:["08-10","09-10"], opt:{mound:.6}, note:"Glossy green mound with fragrant white flowers in late summer."}],
  ["Hosta 'Francee'", 2.6, 3.5, 0xC9B8E6, {foliage:0x2f5a34, foliage2:0xF2F0E2, opt:{mound:.62, variegation:"edge"}, note:"Dark green leaves with a crisp white edge."}],
  ["Hosta 'Aureomarginata'", 2.8, 3.5, 0x8A6AC0, {sci:"Hosta ventricosa 'Aureomarginata'", foliage:0x356434, foliage2:0xD8C85A, opt:{mound:.6, variegation:"edge"}, note:"Glossy green leaves with a wide gold margin."}],
  ["Hosta 'Fire and Ice'", 1.6, 1.6, 0xC9B8E6, {foliage:0x2f5a34, foliage2:0xF4F2E6, opt:{mound:.6, variegation:"centre"}, note:"White-centred leaves edged in dark green."}],
  ["Hosta 'Blue Mouse Ears'", .9, 1, 0xB8A0DC, {foliage:0x6F8FA0, opt:{mound:.6, leaf:1.25}, note:"A miniature: thick, round blue-green leaves."}]
]);

/* P3 — spikes */
const SAL = {model:"spikes", cat:"perennial", sci:"Salvia nemorosa", sun:FULL, zone:[4,8], bloom:["05-28","07-10"], foliage:0x55703c,
             opt:{density:"tight"}, note:"Dense flower spikes in early summer; shear for a second flush."};
group(SAL, [
  ["Salvia 'May Night'", 1.6, 1.5, 0x4B3FA0, {sci:"Salvia × sylvestris 'Mainacht'", k:"salvia-may-night"}],
  ["Salvia 'Caradonna'", 2, 1.5, 0x4A2D8F, {stem:0x2a1c3a, note:"Deep purple spikes on near-black stems."}],
  ["Salvia 'Sensation Deep Rose'", 1, 1, 0xC2478A],
  ["Salvia 'Lyrical White'", 1.6, 1.4, 0xF4F2EC],
  ["Salvia 'Rose Marvel'", 1, 1, 0xC23A78, {sci:"Salvia nemorosa 'Rose Marvel'", bloom:["05-28","08-15"], note:"The largest flowers of any rose salvia, on a compact plant that reblooms without cutting back."}],
  ["Blazing Star 'Kobold'", 2, 1.25, 0xB07CC8, {sci:"Liatris spicata 'Kobold'", zone:[3,9], bloom:["07-10","08-25"], foliage:0x4f7a3a, opt:{density:"tight", leafTex:"leaf:blades", spike:.95}, note:"Fuzzy lavender wands above grassy foliage; a butterfly magnet."}],
  ["Cardinal Flower 'Queen Victoria'", 3, 1.25, 0xD21F2B, {sci:"Lobelia cardinalis 'Queen Victoria'", sun:FP, bloom:["07-15","09-15"], foliage:0x5a2430, stem:0x4a1c28, opt:{density:"tight", spike:1.2}, note:"Scarlet spikes over burgundy foliage. Wants moist soil."}],
  ["Catmint 'Walker's Low'", 2.5, 3, 0x9C8FD6, {sci:"Nepeta × faassenii 'Walker's Low'", k:"catmint-walkers-low", sun:FP, zone:[3,8], bloom:["05-25","09-05"], foliage:0x8e9c7c, opt:{density:"loose"}, note:"Grey-green mound under a long haze of lavender-blue."}],
  ["Russian Sage 'Denim 'n Lace'", 2.7, 3, 0x8F86D8, {sci:"Salvia yangii 'Denim 'n Lace'", zone:[4,9], bloom:["07-10","09-30"], foliage:0xa3ae9c, stem:0xc8ccc0, winter:"standing", opt:{density:"loose", spike:1.3}, note:"Airy silver stems and a lavender-purple cloud from July to frost."}]
]);

/* P4 — daylilies */
group({model:"daylily", cat:"perennial", sci:"Hemerocallis", sun:FP, zone:[3,9], bloom:["06-25","08-10"], foliage:0x5c8238, flower2:0xD8D23A,
       note:"Arching strap leaves and trumpet flowers on wiry scapes through midsummer."}, [
  ["Daylily 'Stella de Oro'", 1.1, 1.5, 0xF0B91E, {k:"daylily-stella", bloom:["06-10","08-25"], flower2:0xE6A81E, note:"Low and golden, reblooming all summer."}],
  ["Daylily 'Chicago Apache'", 2.3, 2, 0xB3201E],
  ["Daylily 'Night Beacon'", 2.3, 2, 0x4A1F4F, {note:"Near-black purple with a chartreuse throat."}],
  ["Daylily 'Rosy Returns'", 1.2, 1.5, 0xE0708A, {bloom:["06-15","08-25"], flower2:0xE6C83C, note:"Rose-pink rebloomer with a yellow throat."}],
  ["Daylily 'Rocket City'", 3, 2, 0xF08A1C, {flower2:0xE2561C}],
  ["Daylily 'Sunday Gloves'", 2.25, 2, 0xF5F0E0, {flower2:0xE6D66A, note:"Near-white, fragrant flowers."}],
  ["Daylily 'Blazing Glory'", 2, 2, 0xF2C230, {flower2:0xB3201E, note:"Yellow with a red eye."}]
]);

/* P5 — tall clumps with flowers on top */
const TALL = {model:"tallclump", cat:"perennial", sun:FP, zone:[4,8], foliage:0x4a6a34};
group({...TALL, sci:"Monarda didyma", bloom:["07-01","08-20"], opt:{head:"shag"}, note:"Shaggy whorled flowers that hummingbirds work all day. Spreads into a colony."}, [
  ["Bee Balm 'Jacob Cline'", 4, 2.5, 0xD21F2B],
  ["Bee Balm 'Bubblegum Blast'", 2, 2.3, 0xE0468F],
  ["Bee Balm 'Grand Parade'", 1.25, 1.5, 0xB070C0],
  ["Bee Balm 'Sugar Buzz Grape Gumball'", 1.8, 2, 0xA8388A, {sci:"Monarda 'Grape Gumball'", note:"Vibrant magenta-purple flowers on a mid-height plant with good mildew resistance."}]
]);
group({...TALL, sci:"Phlox paniculata", bloom:["07-15","09-10"], opt:{head:"dome"}, note:"Big domed flower heads, fragrant in the evening, at the back of the border."}, [
  ["Garden Phlox 'David'", 3.5, 2.5, 0xF7F7F2],
  ["Garden Phlox 'Pink Lightning'", 2.3, 1.6, 0xE8609A, {flower2:0xF8ECF0, note:"Bright pink flowers, each with a white star at its centre."}],
  ["Garden Phlox 'Flame Purple'", 1.5, 1.25, 0x8A3AA8, {bloom:["07-05","09-05"], note:"A dwarf that needs no staking: fragrant purple flowers with a pale eye."}],
  ["Garden Phlox 'Early Start Pink'", 1.4, 1.3, 0xE0508C, {bloom:["06-15","08-20"], note:"Flowers weeks ahead of other garden phlox: deep pink on a short, bushy plant."}],
  ["Garden Phlox 'Coral Creme Drop'", 1.8, 1.5, 0xF07868, {sci:"Phlox paniculata 'Ditomdre'", note:"Candy Store series. Coral-pink flowers on a compact, mildew-resistant plant."}],
  ["Garden Phlox 'Cotton Candy'", 1.8, 1.5, 0xF2B4CC, {sci:"Phlox paniculata 'Ditomfra'", note:"Candy Store series. Soft, clear pink flowers."}],
  ["Garden Phlox 'Grape Lollipop'", 1.8, 1.5, 0x9A3A96, {sci:"Phlox paniculata 'Ditomsur'", note:"Candy Store series. Purple-magenta flowers."}],
  ["Garden Phlox 'Olympus'", 2, 2, 0xC987B0, {foliage:0x4f7a3a, foliage2:0xF0ECD0, opt:{head:"dome", leafTex:"leaf:lance+edge"}, note:"Rosy-mauve flowers over cream-edged leaves."}]
]);
group(TALL, [
  ["Joe Pye Weed 'Baby Joe'", 2.5, 2.5, 0xB98AA8, {sci:"Eutrochium dubium 'Baby Joe'", zone:[4,9], bloom:["07-25","09-15"], winter:"standing", stem:0x6a3a4a, opt:{head:"flat", headSize:.7}, note:"Mauve-pink domes on purple stems; a compact Joe Pye."}],
  ["Sedum 'Autumn Joy'", 2, 2, [0xE8B4A8, 0xC0596B, 0x8F3F2E], {sci:"Hylotelephium 'Herbstfreude'", k:"sedum-autumn-joy", sun:FULL, zone:[3,9], bloom:["08-20","10-15"], foliage:0x7c9a6c, winter:"standing", opt:{head:"flat", headSize:.55, leafTex:"leaf:ovate"}, note:"Succulent clump; flat heads go from pale pink to rust and stand through winter."}],
  ["Showy Goldenrod", 3, 2, 0xE6B81E, {sci:"Solidago speciosa", sun:FULL, zone:[3,8], bloom:["08-10","09-30"], winter:"standing", opt:{head:"plume"}, note:"Dense golden plumes in late summer. A native that stays in a clump."}],
  ["Lily 'Tiny Heroes'", 1.3, 1, 0xEE7A1C, {sci:"Lilium (Asiatic)", sun:FULL, zone:[3,8], bloom:["06-20","07-15"], flower2:0xC8501C, opt:{head:"trumpet", headSize:.4}, note:"A dwarf Asiatic lily with up-facing orange flowers."}],
  ["Lily 'Pink Stargazer'", 3, 1.25, 0xE0508A, {sci:"Lilium (Oriental)", sun:FULL, bloom:["07-20","08-15"], flower2:0xF6E0E8, opt:{head:"trumpet", headSize:.55}, note:"Big, fragrant, pink Oriental lily."}],
  ["Lily 'Red Velvet'", 3.5, 1.25, 0x8F1420, {sci:"Lilium (Asiatic)", sun:FULL, zone:[3,8], bloom:["07-01","07-25"], flower2:0x5a0c14, opt:{head:"trumpet", headSize:.5}, note:"Deep velvet red on tall stems."}]
]);

/* P6 — globes on stalks */
const ALL = {model:"allium", cat:"perennial", sci:"Allium", sun:FULL, zone:[4,8], bloom:["07-15","08-25"], foliage:0x5a8a45, flower2:0x6a8a4a,
             winter:"standing", note:"Globes of tiny flowers on bare stalks over a tidy clump of strap leaves."};
group(ALL, [
  ["Allium 'Millenium'", 1.5, 1.25, 0xB565B0],
  ["Allium 'Summer Beauty'", 1.6, 1.5, 0xD8A0CC],
  ["Allium 'Serendipity'", 1.5, 1.25, 0x8A3F9A, {foliage:0x6a8f80, note:"Deep purple globes over blue-green leaves."}],
  ["Nodding Pink Onion", 1.25, 1, 0xE6B4CE, {sci:"Allium cernuum", zone:[3,8], bloom:["06-25","07-30"], opt:{nod:.8}, note:"A prairie native whose pink globes hang from a crook in the stalk."}],
  ["Gas Plant", 3, 2.5, 0xF4F2EC, {sci:"Dictamnus albus", zone:[3,8], bloom:["06-01","06-28"], foliage:0x3f6a34, opt:{head:"spike", headSize:.9, leafTex:"leaf:pinnate"}, note:"Glossy, lemon-scented foliage and white spires in June. Slow, then lives for decades."}],
  ["Masterwort 'Star of Fire'", 2, 1.5, 0x8F1F2E, {sci:"Astrantia major 'Star of Fire'", sun:PS, bloom:["06-10","08-10"], foliage:0x3f6a34, winter:"dormant", opt:{leafTex:"leaf:lobed", headSize:.13}, note:"Dark red pincushion flowers on wiry stems for part shade."}]
]);

/* P7 — peonies and bushy perennials */
const PEO = {model:"peony", cat:"perennial", sci:"Paeonia lactiflora", sun:FULL, zone:[3,8], bloom:["06-01","06-22"], foliage:0x3c5f2e, fall:0x8a3b2c,
             stem:0x5a6a3a, note:"Big, fragrant flowers in June on a shrub-sized mound that lives for decades."};
group(PEO, [
  ["Peony 'Sarah Bernhardt'", 3, 3, 0xF0A9C2, {k:"peony-sarah-bernhardt"}],
  ["Peony 'Karl Rosenfield'", 3, 3, 0xB01E3A],
  ["Peony 'Coral Charm'", 3, 3, 0xF47C6A, {bloom:["05-25","06-15"]}],
  ["Itoh Peony 'Scrumdiddlyumptious'", 2.5, 3, 0xF2E0A0, {sci:"Paeonia (Itoh hybrid)", zone:[4,9], note:"Cream-yellow flowers blushed pink on a sturdy, self-supporting plant."}]
]);
group({...PEO, sci:"Baptisia", zone:[4,9], bloom:["05-28","06-25"], foliage:0x6f8f7a, fall:null, winter:"standing",
       opt:{head:"spike", leafTex:"leaf:small"}, note:"Lupine-like spikes over a blue-green, shrub-like clump that never needs staking."}, [
  ["False Indigo 'Blueberry Sundae'", 3, 3, 0x5A5FC0],
  ["False Indigo 'Lemon Meringue'", 3, 3, 0xF0DC5A, {stem:0x4a4a44}],
  ["False Indigo 'Vanilla Cream'", 2.75, 3, CREAM]
]);

/* P8 — astilbes and ferns */
group({model:"astilbe", cat:"perennial", sci:"Astilbe", sun:PS, zone:[4,8], bloom:["06-25","07-30"], foliage:0x3f6a34, winter:"standing",
       note:"Feathery plumes over ferny foliage. Needs steady moisture."}, [
  ["Astilbe 'Fanal'", 1.75, 1.5, 0xB01E2E, {foliage:0x4a4a2e, note:"Blood-red plumes over bronze foliage."}],
  ["Astilbe 'Deutschland'", 1.75, 1.5, 0xF6F6F0, {k:"astilbe-deutschland-white"}],
  ["Astilbe 'Visions in Pink'", 1.5, 1.5, 0xF0A9C8, {sci:"Astilbe chinensis 'Visions in Pink'"}],
  ["Astilbe 'Visions'", 1.25, 1.5, 0xC2378A, {sci:"Astilbe chinensis 'Visions'"}],
  ["Astilbe 'Younique Salmon'", 1.5, 1.5, 0xF4957A],
  ["Ostrich Fern", 3.5, 3, null, {sci:"Matteuccia struthiopteris", k:"ostrich-fern", zone:[3,7], foliage:0x4f8a3c, winter:"dormant", opt:{plumes:false}, note:"Tall shuttlecocks of fresh green fronds. Spreads by runners in moist shade."}]
]);

/* P9 — ruffled mounds with wiry flower stems */
group({model:"heuchera", cat:"perennial", sci:"Heuchera", sun:PS, zone:[4,9], bloom:["06-05","07-20"], foliage:0x4a2530, winter:"evergreen",
       symbol:"foliage", note:"Grown for its foliage: a low mound of ruffled leaves with airy flower wands above."}, [
  ["Coral Bells 'Palace Purple'", 1.7, 1.5, 0xF0E6DC, {foliage:0x4a2530}],
  ["Coral Bells 'Obsidian'", 1.6, 1.3, 0xF0E6DC, {foliage:0x1e1418, note:"The darkest: glossy, near-black leaves."}],
  ["Coral Bells 'Lime Marmalade'", 1.3, 1.5, 0xF4F4EA, {foliage:0xB6D24A}],
  ["Coral Bells 'Caramel'", 1.4, 1.6, 0xF2E0D0, {sci:"Heuchera villosa 'Caramel'", foliage:0xD49A4A}],
  ["Coral Bells 'Forever Red'", 1.2, 1.2, 0xF4F0E8, {foliage:0x9a1f28}],
  ["Coral Bells 'Black Forest Cake'", 1.2, 1.2, 0xC82840, {foliage:0x2a1a1c, note:"Dark chocolate leaves with cherry-red flowers above them."}],
  ["Coral Bells 'Primo Black Pearl'", 1, 1.7, 0xF0E0E4, {foliage:0x161014, sun:ANY, note:"Jet-black, scalloped leaves with rosy undersides that hold their colour in full sun."}],
  ["Coral Bells 'Sugar Plum'", 1.5, 1.3, 0xE88AB0, {foliage:0x6a3a5a, foliage2:0xB8B0C0, opt:{silver:true}, note:"Plum leaves frosted with silver; pink flowers."}]
]);
group({model:"heuchera", cat:"perennial", sci:"Aquilegia", sun:FP, zone:[3,9], bloom:["05-15","06-20"], foliage:0x6f8f6a,
       opt:{wand:"columbine", leafTex:"leaf:ferny", mound:.5}, note:"Spurred, two-tone flowers nodding over lacy blue-green foliage in late spring."}, [
  ["Columbine 'Earlybird Blue White'", 1, 1, 0x4A63C8, {flower2:0xF4F4F0}],
  ["Columbine 'Earlybird Red White'", 1, 1, 0xB8202A, {flower2:0xF4F4F0}],
  ["Columbine 'Earlybird Yellow'", 1, 1, 0xF2D23A, {flower2:0xF6E680}],
  ["Bleeding Heart 'Amore Titanium'", 1, 1.25, 0xF4F2EE, {sci:"Dicentra 'Amore Titanium'", sun:PS, bloom:["05-10","07-30"], foliage:0x7f9a94, flower2:0xE8E0E0, opt:{wand:"hearts", leafTex:"leaf:ferny", mound:.6}, note:"White hearts on arching stems over blue-grey ferny leaves."}]
]);

/* P10 — cushions dotted with flowers */
const CUSH = {model:"cushion", cat:"perennial", sun:FP, zone:[4,8], foliage:0x4f7a3a};
group(CUSH, [
  ["Geranium 'Rozanne'", 1.5, 2.5, 0x6F6AD8, {sci:"Geranium 'Gerwat'", zone:[5,8], bloom:["06-01","09-30"], flower2:0xF4F2F6, opt:{leafTex:"leaf:lobed", flowerSize:.16, sparse:true}, note:"Violet-blue flowers with a white eye from June to frost."}],
  ["Aster 'Purple Dome'", 1.5, 2.5, 0x6A3FB0, {sci:"Symphyotrichum novae-angliae 'Purple Dome'", sun:FULL, bloom:["08-25","10-10"], flower2:0xE8C23A, opt:{flower:"daisy", flowerTex:"flower:daisy-fine", flowerSize:.14, leafTex:"leaf:fine"}, note:"A tight dome that disappears under purple daisies in September."}],
  ["Mum 'Clara Curtis'", 2, 2.5, 0xEE8FB4, {sci:"Chrysanthemum × rubellum 'Clara Curtis'", sun:FULL, bloom:["08-20","10-05"], flower2:0xE8C23A, opt:{flower:"daisy", flowerSize:.22, leafTex:"leaf:lobed"}, note:"A hardy garden mum with single pink daisies."}],
  ["Dianthus 'Electric Red'", .8, 1, 0xD21F2B, {sci:"Dianthus 'Electric Red'", sun:FULL, bloom:["05-25","07-15"], foliage:0x7f9a94, flower2:0xB01828, winter:"evergreen", opt:{leafTex:"leaf:needle", flowerSize:.11}, note:"Clove-scented red flowers over a blue-grey cushion."}],
  ["Coreopsis 'Moonbeam'", 1.5, 1.75, 0xF2E68A, {sci:"Coreopsis verticillata 'Moonbeam'", sun:FULL, zone:[3,9], bloom:["06-15","09-10"], flower2:0xE8C84A, opt:{leafTex:"leaf:needle", flowerSize:.13, flowerTex:"flower:daisy"}, note:"Pale yellow stars all summer over thread-fine foliage."}],
  ["Baby's Breath 'Summer Sparkles'", 2.5, 3, 0xF7F7F2, {sci:"Gypsophila paniculata 'Summer Sparkles'", sun:FULL, zone:[3,9], bloom:["06-20","08-15"], foliage:0x7f9a8a, flower2:0xF7F7F2, opt:{leafTex:"leaf:needle", flowerSize:.09}, note:"A cloud of tiny white flowers."}],
  ["Bellflower 'Rapido Blue'", .5, 1, 0x5A5AC8, {sci:"Campanula carpatica 'Rapido Blue'", zone:[3,8], bloom:["06-01","08-10"], flower2:0x7a7ad8, opt:{flowerSize:.13}, note:"Up-facing violet-blue bells on a low mound."}],
  ["Balloon Flower 'Astra Blue'", .7, .8, 0x5A5AC8, {sci:"Platycodon grandiflorus 'Astra Blue'", zone:[3,8], bloom:["06-20","08-20"], flower2:0x7a7ad8, opt:{flowerSize:.2, sparse:true}, note:"Puffed buds pop open into wide, starry violet-blue flowers on a dwarf plant. Late to emerge in spring."}]
]);

/* P11 — groundcover mats */
const MAT = {model:"mat", cat:"groundcover", sun:FULL, zone:[3,9], foliage:0x4d7a4a, winter:"evergreen"};
group({...MAT, sci:"Sedum", opt:{leafTex:"leaf:succulent"}, symbol:"foliage", note:"A succulent carpet for hot, dry edges and between stones."}, [
  ["Sedum 'Angelina'", .4, 1.75, null, {sci:"Sedum rupestre 'Angelina'", zone:[5,8], foliage:0xD8C83A, fall:0xD88A2A, note:"Needle-like gold foliage that turns orange in fall."}],
  ["Sedum 'Bronze Carpet'", .3, 1.5, 0xE0708A, {sci:"Sedum spurium 'Bronze Carpet'", bloom:["06-25","08-05"], foliage:0x6a2a30, opt:{leafTex:"leaf:succulent", sparse:true}}],
  ["Sedum 'Blue Spruce'", .5, 1.5, 0xE6C83A, {sci:"Sedum reflexum 'Blue Spruce'", bloom:["06-20","07-25"], foliage:0x7fa3a8, opt:{leafTex:"leaf:succulent", sparse:true}}],
  ["Sedum kamtschaticum 'Variegatum'", .4, 1.25, 0xE6B81E, {bloom:["06-10","07-20"], foliage:0x7f9a5a, opt:{leafTex:"leaf:succulent", sparse:true}, note:"Green leaves edged in cream, with yellow stars in early summer."}]
]);
group({...MAT, sci:"Phlox subulata", sun:FP, bloom:["05-01","05-28"], flower2:0x6a4a8a, note:"A needle-leaved mat that disappears under flowers in May."}, [
  ["Creeping Phlox 'Emerald Blue'", .5, 2, 0x8FA2E6, {k:"creeping-phlox"}],
  ["Creeping Phlox 'Scarlet Flame'", .5, 2, 0xD21F4A, {flower2:0x8a1430}],
  ["Creeping Phlox 'White Delight'", .5, 2, 0xF6F6F2, {flower2:0xE8E0B0}],
  ["Creeping Phlox 'Candy Stripe'", .5, 2, 0xF6E6EE, {flower2:0xE0508A, note:"White flowers striped in pink."}]
]);
group(MAT, [
  ["Bugleweed 'Black Scallop'", .4, 1.5, 0x4A4FC0, {sci:"Ajuga reptans 'Black Scallop'", sun:PS, zone:[4,9], bloom:["05-10","06-10"], foliage:0x2a1c24, symbol:"foliage", opt:{leafTex:"leaf:succulent", spikes:true}, note:"Glossy near-black leaves with short blue spikes in spring. For shade."}],
  ["Dead Nettle 'Purple Dragon'", .6, 1.75, 0xB050B0, {sci:"Lamium maculatum 'Purple Dragon'", sun:PS, zone:[4,8], bloom:["05-15","07-15"], foliage:0xB8C4B8, symbol:"foliage", winter:"dormant", opt:{sparse:true}, note:"Silver leaves edged in green; purple flowers. Lights up dry shade."}],
  ["Periwinkle 'Bowles'", .5, 2, 0x6F6AD8, {sci:"Vinca minor 'Bowles'", sun:PS, zone:[4,8], bloom:["05-01","06-01"], foliage:0x2f5a2e, flower2:0xF0F0F6, opt:{sparse:true}, note:"Glossy evergreen trailer with violet-blue flowers in spring."}],
  ["Creeping Thyme", .25, 1.5, 0xC77FC0, {sci:"Thymus serpyllum", k:"creeping-thyme", zone:[4,9], bloom:["06-05","07-15"], foliage:0x5d7a4a, flower2:0xC77FC0, note:"A flat, fragrant carpet for bed edges and between stones."}]
]);

/* P12, P13 — grasses */
group({model:"grass", cat:"grass", sun:FULL, zone:[4,9], foliage:0x6f8f45, winter:"standing", bloomLabel:"Plumes"}, [
  ["Feather Reed Grass 'Karl Foerster'", 5, 2, 0xD9C08A, {sci:"Calamagrostis × acutiflora 'Karl Foerster'", k:"karl-foerster", sun:FP, bloom:["06-20","10-15"], fall:0xcfae6a, opt:{foliage:.58, plume:.36}, note:"A narrow vertical accent. Wheat-coloured plumes from June that stand all winter."}],
  ["Feather Reed Grass 'Overdam'", 3.5, 1.75, 0xD9B8A0, {sci:"Calamagrostis × acutiflora 'Overdam'", sun:FP, bloom:["06-20","10-15"], foliage2:0xE8E6C0, opt:{stripe:true, foliage:.6, plume:.34}, note:"Cream-striped blades under pinkish plumes."}],
  ["Switchgrass 'Heavy Metal'", 4.5, 2, 0xC8B8A0, {sci:"Panicum virgatum 'Heavy Metal'", bloom:["08-01","10-15"], foliage:0x7f9aa0, fall:0xD8B84A, opt:{foliage:.74, plume:.32, plumeWide:.6}, note:"Stiffly upright, metallic-blue blades with an airy haze of seedheads."}],
  ["Switchgrass 'Shenandoah'", 3.5, 2, 0xC88A8A, {sci:"Panicum virgatum 'Shenandoah'", bloom:["08-01","10-15"], foliage:0x6f7f4a, fall:0xA8282E, opt:{foliage:.74, plume:.32, plumeWide:.6}, note:"Green blades that turn wine-red from the tips by midsummer."}],
  ["Little Bluestem 'Blue Heaven'", 3.5, 1.75, 0xD8C8B4, {sci:"Schizachyrium scoparium 'Blue Heaven'", k:"little-bluestem", zone:[3,9], bloom:["08-15","10-15"], foliage:0x7fa0a8, fall:0xB5562F, opt:{foliage:.8, plume:.22}, note:"Native prairie grass: blue in summer, copper and burgundy from fall through winter."}]
]);
group({model:"fountain", cat:"grass", sun:FULL, zone:[5,9], foliage:0x5f8a45, winter:"standing", bloomLabel:"Plumes"}, [
  ["Maiden Grass 'Graziella'", 5.5, 3.5, 0xE6DCCB, {sci:"Miscanthus sinensis 'Graziella'", bloom:["08-20","10-20"], fall:0xC88A3A, note:"A fine-textured fountain with silvery plumes held well above the leaves."}],
  ["Maiden Grass 'Morning Light'", 5, 3.5, 0xD8C0B0, {sci:"Miscanthus sinensis 'Morning Light'", bloom:["09-10","10-20"], foliage:0x7f9a6a, foliage2:0xE6EAD8, opt:{stripe:true}, note:"Narrow, white-edged blades that shimmer silver."}],
  ["Maiden Grass 'Flame'", 4.5, 3, 0xE6DCCB, {sci:"Miscanthus 'Purpurascens'", zone:[4,9], bloom:["08-10","10-20"], fall:0xC8401E, note:"The hardiest maiden grass; flaming orange-red in fall."}],
  ["Golden Hakone Grass", 1.25, 2, null, {sci:"Hakonechloa macra 'Aureola'", sun:PS, foliage:0xC8C83A, foliage2:0x6f9a3a, winter:"dormant", opt:{stripe:true}, note:"A cascading gold-striped grass for shade."}],
  ["Blue Fescue 'Elijah Blue'", .9, .9, 0xC8B88A, {sci:"Festuca glauca 'Elijah Blue'", zone:[4,8], bloom:["06-10","07-20"], foliage:0x8fb0c0, winter:"evergreen", opt:{foliage:.7, plume:.3, tuftTex:"leaf:blades"}, note:"A tidy, silver-blue tuft."}]
]);

/* P14 — irises */
group({model:"iris", cat:"perennial", sci:"Iris", sun:FP, zone:[3,8], bloom:["05-25","06-20"], foliage:0x4d7740, flower2:0xE6D66A, fall:0xb9923c,
       note:"Upright sword leaves with flag flowers for three weeks in early summer."}, [
  ["Siberian Iris 'Caesar's Brother'", 3, 2, 0x3D2F8F, {sci:"Iris sibirica 'Caesar's Brother'", k:"iris-caesars-brother"}],
  ["Blue Flag Iris", 2.5, 2, 0x5A63C8, {sci:"Iris versicolor", zone:[3,9], note:"A native iris for wet ground and pond edges."}],
  ["Bearded Iris", 2.5, 1.5, 0x8A6AC8, {sci:"Iris × germanica", sun:FULL, zone:[3,9], foliage:0x7f9a8a, opt:{flowerSize:.45, foliage:.62}, note:"Broad grey-green fans and big ruffled flowers. Comes in every colour; this one stands in for them."}]
]);

/* ==================================================================== SHRUBS */
/* S1 — panicle hydrangeas. `flower` is what the cones age through. */
const W0 = 0xF4F4EA;
const PAN = {model:"panicle", cat:"shrub", sci:"Hydrangea paniculata", sun:FP, zone:[3,8], bloom:["07-10","10-05"], foliage:0x486f35, fall:0x9a8a3a,
             stem:0x7a5a40, winter:"heads", note:"Cone-shaped flower heads from midsummer that change colour as they age and dry on the plant for winter."};
group(PAN, [
  ["Hydrangea 'Limelight'", 7, 7, [0xC8DC8A, 0xF4F4E6, 0xE8A9B8], {note:"The classic: big lime cones that go white, then pink and burgundy in fall."}],
  ["Hydrangea 'Little Lime'", 4.5, 4.5, [0xCFE0A0, 0xEEF0DC, 0xE6A8B6], {sci:"Hydrangea paniculata 'Jane'", k:"hydrangea-little-lime", note:"Limelight at half the size."}],
  ["Hydrangea 'Little Hottie'", 4, 4, [0xD2E2A8, 0xF6F6EC, 0xF0C8CE], {note:"Compact and heat-tolerant; green buds open white and blush soft pink."}],
  ["Hydrangea 'Fire Light'", 5.5, 5.5, [W0, 0xE4708A, 0xB02848], {note:"Upright white cones that turn pomegranate red."}],
  ["Hydrangea 'Berry White'", 6, 4.5, [W0, 0xE890A8, 0xB02A5A], {note:"Strong upright stems; white cones darken to deep berry pink from the base up."}],
  ["Hydrangea 'Vanilla Strawberry'", 6.5, 4.5, [0xF6F0DC, 0xF0A0B4, 0xC82A48], {stem:0x8a2a34, note:"Vanilla cones turn pink, then strawberry red, on red stems."}],
  ["Hydrangea 'Strawberry Sundae'", 4.5, 3.5, [0xF6F0DC, 0xF0A0B4, 0xC83A4E], {stem:0x8a2a34, note:"A compact Vanilla Strawberry."}],
  ["Hydrangea 'Quick Fire Fab'", 6, 5.5, [W0, 0xF0B4C4, 0xD0486A], {bloom:["06-25","10-05"], opt:{fat:.42}, note:"Blooms a month early; full, mophead-like cones turn from white to pink to red."}],
  ["Hydrangea 'Diamond Rouge'", 4.5, 3.5, [W0, 0xE86A88, 0xA01830], {note:"The reddest: white cones go pink, then deep wine red."}],
  ["Hydrangea 'Spring Sizzle'", 4.5, 4.5, [W0, 0xD8587A, 0x9A1830], {bloom:["06-20","10-05"], note:"Very early; white turning deep red."}],
  ["Hydrangea 'Limelight Prime'", 5.5, 4.5, [0xC8E08A, 0xF4F4E6, 0xD04A78], {bloom:["07-01","10-05"], note:"Earlier and stronger-stemmed than Limelight, with deeper pink fall colour."}],
  ["Hydrangea 'Little Lime Punch'", 4, 4, [0xC8E08A, 0xF0A0B8, 0xC02848], {flower2:[0xD8E8A0, 0xE0507A, 0xB02040], note:"Lime cones that turn pink and punch red from the bottom up, several colours at once."}],
  ["Hydrangea 'Pinky Winky'", 7, 6.5, [W0, W0, 0xF2DCE2], {flower2:[W0, 0xE0507A, 0xB8284A], opt:{bloom:1.05}, note:"Two-tone cones: white tips keep opening above a base that has already turned pink."}],
  ["Hydrangea 'Bobo'", 3, 3.5, [W0, W0, 0xF0C0CC], {opt:{dense:true}, note:"A dwarf covered to the ground in white cones that blush pink."}],
  ["Hydrangea 'Fire Light Tidbit'", 2.5, 3, [W0, 0xE4708A, 0xB02848], {opt:{dense:true}, note:"The smallest panicle hydrangea; white to pomegranate pink."}],
  ["Hydrangea 'Puffer Fish'", 4, 4, [0xF6F6EE, 0xF6F6EE, 0xCFE0A0], {opt:{dense:true, fat:.4}, note:"A larger Bobo. Fluffy white cones age to lime, with a fresh burst of white at the tips late in the season."}],
  ["Hydrangea 'Sweet Starlight'", 4, 3.5, [W0, 0xF0B0C0, 0xD0507A], {zone:[4,8], note:"Compact, with white cones that start turning pink earlier than most."}],
  ["Hydrangea 'Limelight' tree", 8, 6, [0xC8DC8A, 0xF4F4E6, 0xE8A9B8], {opt:{trunk:3.4}, note:"Limelight grown on a single trunk. The same plant is in the tree library."}],
  ["Hydrangea 'Pinky Winky' tree", 8, 6, [0xEEEEDC, 0xF2E6E2, 0xD0607E], {opt:{trunk:3.4}, note:"Pinky Winky grown on a single trunk: white cones that turn pink from the base up."}],
  ["Hydrangea 'Berry White' tree", 7, 4.5, [W0, 0xE890A8, 0xB02A5A], {opt:{trunk:3}, note:"Berry White grown on a single trunk."}],
  ["Hydrangea 'Little Lime' tree", 6.5, 4, [0xCFE0A0, 0xEEF0DC, 0xE6A8B6], {opt:{trunk:3}, note:"Little Lime grown on a single trunk."}],
  ["Hydrangea 'Vanilla Strawberry' patio tree", 7.5, 4.5, [0xF6F0DC, 0xF0A0B4, 0xC82A48], {opt:{trunk:3.2}, note:"Vanilla Strawberry grown on a single trunk."}]
]);

/* S2 — mophead and smooth hydrangeas */
const MOP = {model:"mophead", cat:"shrub", sci:"Hydrangea arborescens", sun:FP, zone:[3,8], bloom:["06-25","09-15"], foliage:0x4a7436, fall:0x9a9a3a,
             stem:0x8a7a5a, winter:"heads", note:"Ball-shaped flower heads through summer. Blooms on new wood, so it flowers after any winter."};
group(MOP, [
  ["Hydrangea 'Annabelle'", 5, 5, [0xD8E6B0, 0xF6F6EE, 0xD8E0B8], {note:"The old favourite: big white snowballs that fade back to green."}],
  ["Hydrangea 'Incrediball'", 4.5, 4.5, [0xC8E08A, 0xF6F6EE, 0xD0DCA8], {opt:{bloom:1.05}, note:"Annabelle with stronger stems and heads up to a foot across."}],
  ["Hydrangea 'Flowerfull'", 4.5, 4.5, [0xE0E8C0, 0xF6F6EE, 0xDDE2C0], {opt:{bloom:.6}, note:"Two to three times as many white heads as other smooth hydrangeas, held upright."}],
  ["Hydrangea 'Bubble Bath'", 4.5, 4.5, [0xF4EEDC, 0xF4E0DC, 0xF2C8D2], {note:"Cream heads that blush soft pink."}],
  ["Hydrangea 'DreamScape'", 4.5, 4.5, [0xD04A78, 0xE090A8, 0xE6C0C4], {note:"Ruby-pink heads that soften to parchment pink."}],
  ["Hydrangea 'Summer Crush'", 2.5, 2.5, [0xD82A5A, 0xC82A70, 0xA83A8A], {sci:"Hydrangea macrophylla 'Bailmacfive'", zone:[4,9], sun:["part"], foliage:0x2f5a2e, opt:{bloom:.5}, note:"A compact bigleaf hydrangea: raspberry-red to neon-purple mopheads over glossy leaves. Wants afternoon shade and winter protection in zone 4."}],
  ["Hydrangea 'Invincibelle Sublime'", 4.2, 4.2, [0xB8D86A, 0xC8E08A, 0xD8E0B0], {zone:[3,9], note:"A green-flowered smooth hydrangea: rich lime heads with a pink eye in each floret."}],
  ["Snowball Viburnum", 11, 11, [0xC8E08A, 0xF6F6F2, 0xF6F6F2], {sci:"Viburnum opulus 'Roseum'", sun:FP, bloom:["05-20","06-12"], foliage:0x4a7436, fall:0x9a3a2a, winter:"bare", opt:{bloom:.42, fine:true}, note:"A big old-fashioned shrub hung with white snowballs in late spring."}]
]);

/* S3 — arching shrubs */
const WEI = {model:"weigela", cat:"shrub", sci:"Weigela florida", sun:FULL, zone:[4,8], bloom:["05-25","06-25"], foliage:0x4a7436, stem:0x6a5a44,
             winter:"bare", note:"Arching branches lined with trumpet flowers in late spring; hummingbirds come for them."};
group(WEI, [
  ["Weigela 'Spilled Wine'", 2.5, 3, 0xC8327A, {foliage:0x4a1f2a, note:"Dark red, wavy foliage and magenta flowers on a low, spreading plant."}],
  ["Weigela 'Shining Sensation'", 5.5, 4, 0xE86A9A, {foliage:0x5a2530, note:"Glossy burgundy leaves with pink flowers."}],
  ["Weigela 'Red Prince'", 5.5, 5, 0xC81E2E],
  ["Weigela 'Minuet'", 2.5, 3, 0xD03A6A, {zone:[3,7], foliage:0x4a5a34, note:"A very hardy dwarf: ruby-red flowers with a lilac throat over purple-tinged leaves."}],
  ["Weigela 'Rainbow Sensation'", 3.5, 3.5, 0xF0A0BC, {sci:"Weigela florida 'Kolmagira'", foliage:0x5f8a4a, foliage2:0xE8E0A0, opt:{leafTex:"leaf:ovate+edge"}, note:"Green leaves edged in creamy yellow, with soft pink flowers in late spring."}],
  ["Weigela 'My Monet'", 1.5, 2, 0xE88AB0, {foliage:0x6f9a5a, foliage2:0xF2E6DC, opt:{leafTex:"leaf:ovate+edge"}, note:"A dwarf with green, cream and pink variegated leaves."}],
  ["Weigela 'Midnight Sun'", 1.25, 1.5, 0xE06A8A, {foliage:0xC8642A, fall:0xB8281E, opt:{sparse:true}, note:"A tiny mound of orange and red foliage."}],
  ["Forsythia 'Northern Gold'", 6, 6, 0xF2D21E, {sci:"Forsythia 'Northern Gold'", zone:[3,8], bloom:["04-25","05-12"], fall:0x8a7a3a, opt:{droop:.4, flowerSize:.15}, note:"Golden-yellow flowers on bare branches, the first big show of spring. Bud-hardy in the north."}],
  ["Bridalwreath Spirea 'Renaissance'", 6, 6, 0xF7F7F2, {sci:"Spiraea × vanhouttei 'Renaissance'", zone:[3,8], bloom:["05-15","06-05"], foliage:0x5a8a5a, fall:0xC8642A, opt:{droop:.85, leafTex:"leaf:small", flowerSize:.2, flowerTex:"flower:umbel"}, note:"A fountain of branches smothered in white in late May."}],
  ["Diervilla 'Dark Mode'", 3.5, 3.5, 0xE6C83A, {sci:"Diervilla", zone:[4,7], sun:ANY, bloom:["06-15","08-15"], foliage:0x2a1c20, fall:0x8a1c2a, opt:{sparse:true, flowerSize:.1}, note:"Near-black foliage with small yellow flowers. Tough, and takes shade."}]
]);

/* S4 — upright, vase-shaped shrubs */
const VASE = {model:"vase", cat:"shrub", sun:FP, zone:[3,7], foliage:0x4a7436, stem:0x6a5a44, winter:"bare"};
group({...VASE, sci:"Cornus sericea", bloom:["05-25","06-15"], fall:0x8a2a3a, opt:{head:"flat"}, note:"Grown for its winter stems, brightest on young wood. White flower clusters in spring."}, [
  ["Dogwood 'Cardinal'", 8, 8, 0xF4F4EA, {stem:0xC8202A}],
  ["Dogwood 'Bud's Yellow'", 7, 6, 0xF4F4EA, {sci:"Cornus alba 'Bud's Yellow'", stem:0xD8C83A}],
  ["Dogwood 'Sgt. Pepper'", 5.5, 5, 0xF4F4EA, {foliage:0x5a8a5a, foliage2:0xF0ECD8, stem:0xB8202A, opt:{head:"flat", leafTex:"leaf:ovate+edge"}, note:"Cream-edged leaves, pink in fall, on red stems."}]
]);
group({...VASE, model:"ninebark", sci:"Physocarpus opulifolius", sun:FULL, bloom:["06-01","06-25"], stem:0x6a4a3a, opt:{},
       note:"Coloured foliage all season with pinkish-white flower buttons in June and peeling bark in winter."}, [
  ["Ninebark 'Summer Wine'", 5.5, 5.5, 0xF0DCE0, {foliage:0x5a2530}],
  ["Ninebark 'Summer Wine Black'", 5.5, 5.5, 0xF0DCE0, {foliage:0x241418}],
  ["Ninebark 'Honeycomb'", 5, 5, 0xF4F4EA, {foliage:0xC8C83A}],
  ["Ninebark 'Amber Jubilee'", 5.5, 4, 0xF4F4EA, {foliage:0xD08A3A, fall:0x8a2a3a, note:"New growth in orange, yellow and gold."}],
  ["Ninebark 'Summer Wine' tree", 7, 5, 0xF0DCE0, {k:"ninebark-summer-wine-tree", foliage:0x5a2530, opt:{trunk:3.2}, note:"Summer Wine grown on a standard: a rounded head of wine-red leaves on a single trunk."}],
  ["Ninebark 'Amber Jubilee' tree", 7, 4.5, 0xF4F4EA, {k:"ninebark-amber-jubilee-tree", foliage:0xD08A3A, fall:0x8a2a3a, opt:{trunk:3.2}, note:"Amber Jubilee grown on a standard: orange, yellow and gold new growth on a single trunk."}],
  ["Ninebark 'Fireside'", 6, 5, 0xF2D8DE, {sci:"Physocarpus opulifolius 'UMNHarpell'", k:"ninebark-fireside", foliage:0x4a1c2a, fall:0x3a1630, bloom:["05-28","06-20"],
    note:"Reddish new growth deepens to red-purple and holds through summer, turning deep purple in fall. Rounded and upright, tidier than most ninebarks, with pinkish-white flowers in late spring."}]
]);
group(VASE, [
  ["Smokebush 'Lilla'", 4, 4, 0xE8A0B0, {sci:"Cotinus coggygria 'Lilla'", sun:FULL, zone:[4,8], bloom:["06-15","08-20"], bloomLabel:"Smoke", foliage:0x5a2030, fall:0xB8281E, opt:{head:"smoke", leafTex:"leaf:heart"}, note:"A dwarf smokebush that stays a four-foot shrub: wine-red leaves under pink smoke. The full-size smoke trees are in the tree library."}],
  ["Viburnum 'Blue Muffin'", 6, 5, 0x3A4FB0, {sci:"Viburnum dentatum 'Christom'", bloom:["08-05","10-10"], bloomLabel:"Blue berries", fall:0x8a2a3a, opt:{head:"berries"}, note:"White flower clusters in June, then bright blue berries the birds strip in fall."}],
  ["Cranberrybush 'Bailey Compact'", 5.5, 5.5, 0xC8202A, {sci:"Viburnum trilobum 'Bailey Compact'", zone:[2,7], bloom:["08-15","10-30"], bloomLabel:"Red berries", fall:0xA8202A, opt:{head:"berries", leafTex:"leaf:lobed"}, note:"A dense native viburnum: red berries and deep red fall colour."}],
  ["Summersweet 'Ruby Spice'", 5, 4, 0xE06A9A, {sci:"Clethra alnifolia 'Ruby Spice'", zone:[4,9], sun:ANY, bloom:["07-15","08-25"], fall:0xD8B83A, opt:{head:"spike"}, note:"Fragrant rose-pink bottlebrushes in late summer, even in shade."}],
  ["Mock Orange 'Snow White Fantasy'", 5.5, 4.5, 0xF7F7F2, {sci:"Philadelphus 'Snow White Fantasy'", sun:FULL, zone:[4,8], bloom:["06-05","06-30"], flower2:0xE8D880, opt:{head:"single", headSize:.22}, note:"Double, orange-blossom-scented white flowers in June, with some rebloom."}]
]);

/* S5 — cut-leaf shrubs */
group({model:"sumac", cat:"shrub", sun:FP, zone:[4,8], foliage:0x4a7436, stem:0x6a5a44, winter:"bare", symbol:"foliage"}, [
  ["Sumac 'Tiger Eyes'", 6, 6, null, {sci:"Rhus typhina 'Bailtiger'", sun:FULL, foliage:0xC8D83A, stem:0xC88A8A, fall:0xE0642A, opt:{leafTex:"leaf:lacy"}, note:"Chartreuse cut leaves on fuzzy pink stems, orange and scarlet in fall. Suckers slowly."}],
  ["Elderberry 'Black Lace'", 7, 7, 0xF0B4C8, {sci:"Sambucus nigra 'Eva'", bloom:["06-10","07-05"], foliage:0x2a1820, opt:{leafTex:"leaf:lacy", head:"flat", headSize:.6}, note:"Lacy near-black foliage like a Japanese maple, with flat pink flower heads in June."}],
  ["Elderberry 'Lemony Lace'", 4, 4.5, 0xF4F4EA, {sci:"Sambucus racemosa 'SMNSRD4'", zone:[3,7], bloom:["05-10","06-01"], foliage:0xD0D83A, opt:{leafTex:"leaf:lacy", head:"flat", headSize:.4}, note:"Finely cut gold foliage, red-tinged when new."}],
  ["Ash Leaf Spirea 'Matcha Ball'", 2.75, 2.75, 0xF2EAC8, {sci:"Sorbaria sorbifolia 'Levgreen'", zone:[3,7], bloom:["07-01","07-30"], foliage:0x9ab83a, opt:{leafTex:"leaf:pinnate", head:"flat", headSize:.4}, note:"A tidy ball of ferny, tea-green leaves flushed peach in spring."}]
]);

/* S6 — mounding shrubs */
const SPI = {model:"spirea", cat:"shrub", sci:"Spiraea japonica", sun:FULL, zone:[4,8], bloom:["06-10","07-25"], foliage:0x5a8a45, stem:0x6a5040, winter:"bare",
             note:"A fine-textured mound topped with flat flower clusters in early summer; shear for more."};
group(SPI, [
  ["Spirea 'Superstar'", 2.5, 3.5, 0xC8327A, {sci:"Spiraea × bumalda 'Denistar'", k:"spirea-superstar", zone:[3,8], foliage:0x3f6a34, fall:0x9a4a2a, bloom:["06-05","07-10"],
    note:"A compact, rounded spirea. New growth comes scarlet, then deep green under dark pink flowers in June; bronze-red in fall. Shear after bloom for a second flush in August."}],
  ["Spirea 'Goldflame'", 3, 3.5, 0xD8588F, {k:"spirea-goldflame", foliage:0xA7B24A, fall:0xC8642C, note:"New growth in burnt orange, then gold; rosy flowers; coppery in fall."}],
  ["Spirea 'Glow Girl'", 3.5, 3.5, 0xF7F7F2, {sci:"Spiraea betulifolia 'Tor Gold'", zone:[3,9], bloom:["05-28","06-25"], foliage:0xC8D83A, fall:0xD8782A}],
  ["Spirea 'Double Play Blue Kazoo'", 2.5, 2.5, 0xF7F7F2, {sci:"Spiraea media 'SMSMBK'", zone:[3,8], foliage:0x7f9aa0, fall:0xA83A3A, note:"Blue-green leaves with burgundy new growth and white flowers."}],
  ["Spirea 'Magic Carpet'", 1.75, 2.25, 0xC8327A, {foliage:0xC8B83A, fall:0xB8442A, opt:{low:true}}],
  ["Spirea 'Double Play Doozie'", 2.5, 2.5, 0xC8284A, {zone:[3,8], bloom:["06-01","09-20"], foliage:0x6f8f3a, note:"Red new growth and red-pink flowers that keep coming without deadheading."}],
  ["Birchleaf Spirea 'Tor'", 2.75, 2.75, 0xF7F7F2, {sci:"Spiraea betulifolia 'Tor'", zone:[3,9], bloom:["05-28","06-25"], foliage:0x3f6a34, fall:0xC8402A, note:"A dense green ball with white flowers and orange-red-purple fall colour."}],
  ["Potentilla 'Dakota Sunspot'", 2.5, 2.75, 0xF2D21E, {sci:"Dasiphora fruticosa 'Fargo'", zone:[2,7], bloom:["06-01","09-25"], foliage:0x5a8a4a, flower2:0xE8B81E, opt:{head:"single", leafTex:"leaf:fine"}, note:"Bright yellow flowers from June to frost. Bred in Fargo."}],
  ["Potentilla 'Mandarin Tango'", 2, 2.5, 0xE0642A, {sci:"Dasiphora fruticosa 'Jefman'", zone:[2,7], bloom:["06-01","09-25"], foliage:0x5a8a4a, flower2:0xF2C230, opt:{head:"single", leafTex:"leaf:fine"}, note:"Orange flowers with a red centre, best colour in cool weather."}],
  ["Sumac 'Gro-Low'", 1.75, 7, null, {sci:"Rhus aromatica 'Gro-Low'", zone:[3,9], sun:FP, foliage:0x2f6a2e, fall:0xC8402A, symbol:"foliage", opt:{low:true, leafTex:"leaf:ovate", head:null}, note:"A wide, glossy-leaved groundcover shrub for banks; orange-red in fall."}]
]);

/* S7 — lilacs */
group({model:"lilac", cat:"shrub", sci:"Syringa", sun:FULL, zone:[3,7], bloom:["05-20","06-10"], foliage:0x436a34, stem:0x6a5a48, winter:"bare",
       note:"Fragrant flower cones in late spring on a dense, upright shrub."}, [
  ["Lilac 'Miss Kim'", 6, 5.5, 0xC8A0E0, {sci:"Syringa pubescens subsp. patula 'Miss Kim'", bloom:["05-28","06-15"], fall:0x7a2a44, note:"Late, icy-lavender flowers and burgundy fall colour."}],
  ["Lilac 'Bloomerang Dark Purple'", 5, 5, 0x6A3A9A, {sci:"Syringa 'SMSJBP7'", bloom:["05-18","06-08"], note:"Blooms in spring, rests, then again from midsummer to frost."}],
  ["Lilac 'Pinktini'", 4.5, 3.5, 0xE0559A, {sci:"Syringa × prestoniae 'Jeftini'", k:"lilac-pinktini", zone:[2,7], bloom:["05-25","06-12"], foliage:0x4f8a3a,
    note:"A small, upright Preston lilac for tight spaces: rich pink flowers in late May and early June over clean bright green leaves. Very cold hardy."}],
  ["Lilac 'Dream Cloud'", 5.5, 5, 0xE8B0D0, {note:"Soft pink flowers."}],
  ["Dwarf Korean Lilac patio tree", 6.5, 4.5, 0xD8B8E6, {sci:"Syringa meyeri 'Palibin'", k:"lilac-dwarf-korean", opt:{trunk:3}, note:"The dense dwarf Korean lilac grafted on a single trunk."}]
]);

/* S8, S9 — small-leaved mounds and columns */
const BAR = {model:"dense", cat:"shrub", sci:"Berberis thunbergii", sun:FULL, zone:[4,8], foliage:0x8a1f30, stem:0x5a3a34, winter:"bare", symbol:"foliage",
             note:"A dense, thorny mound grown for its foliage colour. Deer leave it alone."};
group(BAR, [
  ["Barberry 'Crimson Pygmy'", 1.75, 2.75, null, {foliage:0x8a1f30, fall:0xC8281E}],
  ["Barberry 'Concorde'", 1.5, 2, null, {foliage:0x4a1f3a, fall:0xA8202A}],
  ["Barberry 'Golden Nugget'", 1, 1.5, null, {foliage:0xD8B83A, fall:0xE0782A}],
  ["Barberry 'Sunjoy Tangelo'", 3.5, 3.5, null, {foliage:0xE0782A, foliage2:0xC8D83A, opt:{leafTex:"leaf:small+edge"}, note:"Orange leaves that develop a chartreuse edge."}],
  ["Boxwood 'Green Velvet'", 3, 3.5, null, {sci:"Buxus 'Green Velvet'", sun:FP, zone:[4,9], foliage:0x3a6a2e, winter:"evergreen", stem:0x5a4a3a, opt:{round:true}, k:"boxwood-green-velvet", note:"A hardy evergreen ball that holds its green through winter. Shelter it from winter wind."}]
]);
group({...BAR, model:"columnar", note:"A narrow exclamation point of coloured foliage."}, [
  ["Barberry 'Golden Rocket'", 4.5, 1.75, null, {foliage:0xD0C83A, fall:0xE0782A}],
  ["Barberry 'Orange Rocket'", 4.5, 2, null, {foliage:0xD8643A, fall:0xC8281E, note:"Coral-orange new growth that turns ruby red in fall."}],
  ["Barberry 'Toscana'", 4, 2.25, null, {foliage:0x8a2030, foliage2:0xD8C83A, fall:0xC8281E, opt:{leafTex:"leaf:small+edge"}, note:"Red leaves with a thin gold edge."}],
  ["Buckthorn 'Fine Line'", 6, 2.5, null, {sci:"Frangula alnus 'Ron Williams'", sun:FP, zone:[2,7], foliage:0x4a7a3a, fall:0xD8B83A, opt:{leafTex:"leaf:needle"}, note:"A feathery column of narrow leaves for hedges and tight corners."}]
]);

/* ================================================================ EVERGREENS */
/* Evergreen shrubs. winterFoliage: the colour the needles turn in the cold. */
const EVG = {model:"conifer", cat:"evergreen", sun:FULL, zone:[3,7], foliage:0x3d6a2c, stem:0x5a4636, winter:"evergreen", symbol:"foliage"};
group({...EVG, sci:"Thuja occidentalis", opt:{form:"globe", leafTex:"leaf:arborvitae"}}, [
  ["Globe Arborvitae 'Hetz Midget'", 2, 2, null, {sci:"Thuja occidentalis 'Hetz Midget'", k:"arborvitae-hetz-midget", winterFoliage:0x4a6230, note:"A dense little globe of rich green, flat-sprayed foliage that needs no shearing."}],
  ["Globe Arborvitae 'Planet Earth'", 4, 4, null, {sci:"Thuja occidentalis 'RutThu4'", sun:FP, zone:[4,8], foliage:0x3f7030, note:"Perfectly round without pruning, and resistant to needle blight."}]
]);
group({...EVG, sci:"Juniperus horizontalis", opt:{form:"spreading", leafTex:"leaf:juniper"}, note:"A low, spreading carpet for banks, edges and the front of a bed."}, [
  ["Creeping Juniper 'Andorra Compact'", 1.5, 4, null, {sci:"Juniperus horizontalis 'Plumosa Compacta'", foliage:0x5f8a54, winterFoliage:0x6a4a5a, note:"Feathery light green foliage that turns plum-purple for fall and winter."}],
  ["Creeping Juniper 'Blue Chip'", .8, 4, null, {sci:"Juniperus horizontalis 'Blue Chip'", sun:FP, foliage:0x587c94, winterFoliage:0x5f6488, note:"Very low, with outstanding steel-blue colour all season."}]
]);
group({...EVG, sci:"Pinus mugo", zone:[2,7], foliage:0x3a6a2a, opt:{form:"mound", leafTex:"leaf:pine"}}, [
  ["Mugo Pine", 4, 4.5, null, {note:"A rugged, bright green mound. Stays dwarf if the spring candles are pinched."}],
  ["Mugo Pine 'Slowmound'", 2.5, 3.5, null, {sci:"Pinus mugo 'Slowmound'", foliage:0x34602a, note:"A dense, slow mound that rarely needs pruning; about two feet in ten years. Salt tolerant."}]
]);
group({...EVG, sci:"Picea pungens", foliage:0x5c839c, opt:{form:"flat", leafTex:"leaf:spruce"}}, [
  ["Dwarf Globe Blue Spruce", 4, 5.5, null, {sci:"Picea pungens 'Glauca Globosa'", note:"A flat-topped, densely branched bun of bright blue needles. Very slow."}],
  ["Dwarf Globe Blue Spruce tree form", 6, 5.5, null, {sci:"Picea pungens 'Glauca Globosa'", opt:{form:"flat", leafTex:"leaf:spruce", trunk:2.6}, note:"The blue globe grafted on a standard: a blue ball on a stem."}],
  ["Dwarf Blue Spruce 'Sester Dwarf'", 7, 4.5, null, {sci:"Picea pungens 'Sester Dwarf'", zone:[2,7], opt:{form:"cone", leafTex:"leaf:spruce"}, note:"A perfect, slow, miniature Colorado spruce: classic cone, stunning blue."}],
  ["Dwarf Norway Spruce 'Pumila'", 3.5, 3.5, null, {sci:"Picea abies 'Pumila'", sun:FP, foliage:0x2f5228, opt:{form:"mound", leafTex:"leaf:spruce"}, note:"A nest-type spruce: rounded when young, spreading with age, with short dark needles."}]
]);
group({...EVG, opt:{form:"globe", leafTex:"leaf:spruce"}}, [
  ["Blue Spruce 'Roundabout'", 2, 2.5, null, {sci:"Picea pungens 'Roundabout'", zone:[2,7], foliage:0x6a94ae, k:"spruce-roundabout", note:"An Iseli introduction: a tight, round ball of bright blue needles that stays small without shearing."}],
  ["Korean Fir 'Ice Breaker'", 1.5, 2.5, null, {sci:"Abies koreana 'Ice Breaker'", zone:[5,7], sun:FP, foliage:0xb4c6c2, k:"fir-ice-breaker", note:"A miniature bun. Each needle curls back to show its white underside, so the whole plant looks frosted."}],
  ["Dahurian Larch 'Romberg Park'", 2.5, 3, null, {sci:"Larix gmelinii 'Romberg Park'", cat:"shrub", zone:[2,6], foliage:0x6f9a4a, fall:0xd8b030, winter:"bare", k:"larch-romberg-park", note:"A dwarf globe larch: soft, bright green needles that turn gold in fall and drop, leaving a twiggy ball for winter."}]
]);
group({...EVG, sci:"Thuja occidentalis", opt:{form:"cone", leafTex:"leaf:arborvitae"}}, [
  ["Arborvitae 'Primo'", 4, 1.25, null, {sci:"Thuja occidentalis 'IslPrim'", zone:[3,8], foliage:0x2f5a2a, winterFoliage:0x4a5a30, k:"arborvitae-primo", note:"A slow, narrow, sculptural little column of dark green, tightly layered foliage. About four feet in ten years."}]
]);
group({...EVG, sci:"Taxus × media", sun:ANY, zone:[4,7], foliage:0x24481f, opt:{form:"mound", leafTex:"leaf:yew", reach:true}}, [
  ["Yew 'Dark Green'", 4, 6.5, null, {sci:"Taxus × media 'Dark Green'", note:"For hedges and foundations, in sun or shade, as long as the soil drains. Red berries in summer."}],
  ["Yew 'Taunton'", 3.5, 5, null, {sci:"Taxus × media 'Tauntonii'", note:"A slow, spreading yew that takes shade and resists winter burn. Easy to prune."}]
]);

/* ---------------------------------------------------------------- lookups */
const BY_KEY = new Map(PLANTS.map(p=>[p.k, p]));
/* keys used by plans saved before the full catalogue */
const ALIASES = {"russian-sage":"russian-sage-denim-n-lace", "hosta-patriot":"hosta-francee", "ninebark-little-devil":"ninebark-summer-wine",
  "smokebush-golden-spirit":"smokebush-lilla", "smoke-tree-royal-purple":"smokebush-lilla"};
/* Plans can outlive the catalog: an unknown key still draws, as a grey mound. */
const UNKNOWN = {k:"?", n:"Unknown plant", sci:"", cat:"perennial", model:"cushion", h:1.5, w:1.5, flower:null,
                 foliage:0x7a8274, sun:ANY, zone:[1,13], opt:{}, note:"This plant is not in the catalog."};
/* A plan's own varieties. No catalogue holds every plant, so a plan can carry
   copies of catalogue entries with their own name, size, colours and bloom
   time:  {k:"my-…", base:<catalogue key>, n, h, w, foliage?, flower?, bloom?}
   They draw on the base entry's growth form at the new size. */
const CUSTOM = new Map();
function customEntry(c){
  const base = BY_KEY.get(c?.base) || BY_KEY.get(ALIASES[c?.base]);
  if(!base || typeof c.k !== "string") return null;
  const h = Math.max(.2, Math.min(30, +c.h || base.h)), w = Math.max(.3, Math.min(30, +c.w || base.w));
  const p = {...base, k:c.k, n:String(c.n || base.n).slice(0, 80), h, w, custom:true, base:base.k,
             note:"Your own variety, drawn on the form of "+base.n+"."};
  p.opt = {...base.opt};
  if(p.opt.trunk) p.opt.trunk *= h/base.h;
  if(Number.isFinite(c.foliage)){ p.foliage = c.foliage; delete p.foliage2; }
  if(base.flower != null && Number.isFinite(c.flower)){ p.flower = c.flower; delete p.mix; }
  if(base.bloom && c.bloom && /^\d\d-\d\d$/.test(c.bloom.from) && /^\d\d-\d\d$/.test(c.bloom.to) && c.bloom.from < c.bloom.to) p.bloom = {from:c.bloom.from, to:c.bloom.to};
  return p;
}
export function setCustomPlants(list){
  CUSTOM.clear();
  for(const c of Array.isArray(list) ? list : []){ const p = customEntry(c); if(p) CUSTOM.set(p.k, p); }
}
export function customPlants(){ return [...CUSTOM.values()]; }
export function plantByKey(k){ return CUSTOM.get(k) || BY_KEY.get(k) || BY_KEY.get(ALIASES[k]) || UNKNOWN; }

export function winterHabit(p){
  return p.winter || (p.cat === "evergreen" ? "evergreen" : p.cat === "shrub" ? "bare" : p.cat === "grass" ? "standing" : "dormant");
}
const seqAt = (c, t)=>{
  if(!Array.isArray(c)) return c;
  const f = Math.max(0, Math.min(1, t))*(c.length - 1), i = Math.min(c.length - 2, Math.floor(f)), k = f - i;
  const ch = s=>Math.round(((c[i] >> s) & 255)*(1 - k) + ((c[i+1] >> s) & 255)*k);
  return ch(16) << 16 | ch(8) << 8 | ch(0);
};
/* a bloom's colours part-way through its season: [main, second] */
export function flowerColors(p, phase){
  if(p.flower == null) return null;
  const aging = Array.isArray(p.flower);
  const a = seqAt(p.flower, aging ? phase - .08 : 0);
  const b = p.flower2 != null ? seqAt(p.flower2, phase + .1) : aging ? seqAt(p.flower, phase + .22) : a;
  return [a, b];
}
/* The colour of a plant on the plan: its flowers at their peak, else its leaves. */
export function symbolColor(p){
  if(p.flower == null || p.symbol === "foliage") return p.foliage;
  return seqAt(p.flower, .5);
}

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
  const a = MONTHS[+p.bloom.from.slice(0,2)-1], b = MONTHS[+p.bloom.to.slice(0,2)-1], what = p.bloomLabel || "Blooms";
  return a === b ? what+" in "+a : what+" "+part(p.bloom.from)+" to "+part(p.bloom.to);
}
const mdDay = md=>{ const [m, d] = md.split("-").map(Number); return Date.UTC(2001, m-1, d)/86400000; };

/* What a plant looks like on a given day.
   md       "MM-DD", already shifted for the hemisphere
   growing  whether the plan's leaf season is on
   fall     0…1 through the last weeks before leaf drop
   Returns {state, bloom, spent, phase, fall}:
     state  "growing" | "evergreen" | "dormant" | "standing" | "heads" | "bare"
     bloom  inside the flowering window; phase runs 0…1 through it
     spent  flowering is over but the dried heads are still on the plant */
export function plantPhase(p, {md, growing, fall}){
  const wh = winterHabit(p), keeps = wh === "standing" || wh === "heads";
  if(!growing && wh !== "evergreen") return {state:wh, bloom:false, spent:keeps && !!p.bloom, phase:1, fall:0};
  let bloom = false, spent = false, phase = 0;
  if(p.bloom && growing){
    bloom = md >= p.bloom.from && md <= p.bloom.to;
    if(bloom) phase = (mdDay(md) - mdDay(p.bloom.from))/Math.max(1, mdDay(p.bloom.to) - mdDay(p.bloom.from));
    else if(md > p.bloom.to && keeps){ spent = true; phase = 1; }
  }
  return {state: wh === "evergreen" ? "evergreen" : "growing", bloom, spent, phase, fall: p.fall != null ? fall : 0};
}
export function phaseKey(p, ph){
  return ph.state + (ph.bloom ? "+b"+(Array.isArray(p.flower) || Array.isArray(p.flower2) ? Math.round(ph.phase*10) : "") : "")
       + (ph.spent ? "+s" : "") + (ph.fall > 0 ? "+f"+Math.round(ph.fall*4) : "");
}

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
