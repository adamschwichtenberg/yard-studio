# Handoff: smoke-tree plumes (plus notes on arborvitae, junipers, perennials)

> **Status, Nov 16:** done on this branch. Smoke trees are a `smoketree` species in the botany engine (round leaves,
> a `smoke` ornament). Upright junipers grow fastigiate with foliage standing vertical, arborvitae has a new spray
> texture (`paintArborvitae` in `leafArt.js`), and bed shrubs are rebuilt on a twig framework with no core solid
> (`bush()` in `src/garden/models.js`). Clump trees grow three stems (`p.clump` in `growBroadleaf`), and weeping
> spruces have their own grower (`growWeepingSpruce`). Still open: removing the dead `src/trees/trees.js`.
> The rest of this page is the original brief, kept for reference.

Branch: `claude/yard-studio-v2-diorama`. Run `npm ci && npm run dev`, then open `/` (the app) or `/gallery.html` (every bed plant, rendered).

## Why this is needed

On Nov 15 a session built smoke-tree plumes the user loved. It worked on a checkout one commit older than the
**botany engine** (`src/botany/`, commit `94b054d`). That engine replaced the old one (`src/trees/trees.js`),
so the plume code was written for an engine diorama no longer runs. The work was then merged into diorama (`8a3a4f2`).
The preset data came through, but the visuals did not.

| | Target (old engine) | Now on diorama |
|---|---|---|
| Smoke trees | `docs/trees-smoke.png` | `docs/handoff/now-smoke.png` |
| Clump trees | (three stems from one base) | `docs/handoff/now-clump.png` (single trunk) |
| Arborvitae / junipers | `docs/trees-arborvitae-juniper.png` | `docs/handoff/now-arb.png` |
| Bed plants | `docs/plant-models.png` | `docs/handoff/now-perennials.png` |

## Main job: port the smoke plume into the botany engine

**The look to match** (`docs/trees-smoke.png`): a billowy, stippled haze tinted with the preset's `bloom` colours.
It sits *down among the leaves*, not out past them, with a few big loose heads per foliage clump. It shows in summer
(the bloom window is about 40–105 days after leaf-out).

**Reference code.** It is all still in git, and on diorama the file is unchanged from that session:
- Texture: `paintSmoke()` in `src/trees/leafTextures.js` (registered as `'bloom:smoke'`). Hair-fine stalks from the base,
  plus about 2,400 stipple dots, denser in the middle, so the haze survives alpha testing.
- Placement: `src/trees/trees.js` around lines 460–490 (`const smoke = p.bloom === 'smoke'`). Smoke reuses the
  hydrangea-panicle path, with bigger cards (`R*0.3`, clamped 0.8–1.9 ft), only `1 + 1.6*dens` per clump, and placed at
  `clumpR * (0.5 + 0.35*r())` from the clump centre.
- Original commits: `da9a46c` and `f67e9bf` (`git show f67e9bf`).

**Where it goes in the botany engine:**
- Blooms in the botany engine are **ornaments**: `species.js` lists `ornaments: [...]` per species, and
  `library.js` `#ornamentMesh()` (about line 504) builds them. A shader `uPhase` drives the bloom over its season
  (`setSeason`, about line 537 onward; `DEFAULT_BLOOM`). Hydrangea panicles and lilac plumes already work this way,
  so model smoke on them.
- Painted textures live in `src/botany/leafArt.js`. It already borrows the old painters from `src/trees/leafTextures.js`,
  so `paintSmoke` can be imported or moved there.
- **Species.** `speciesFor()` in `species.js` sends unknown names to a profile by crown shape. Smoke trees (`s:"round"`)
  currently get **maple** leaves, which is wrong: they should have round leaves. Add a `smoketree` species (round leaf,
  smooth bark, the smoke ornament) and a `BY_NAME` entry for `/smoke tree|cotinus/`.
- **Preset data is already there**, unread: Royal Purple and Golden Spirit in `src/app.js` (about line 310) carry
  `bloom:[…colours]`, `bk:"smoke"`, `bw:[40,105]`, `lk:"aspen"`, `bark:"smooth"`, `cb`. `fromPreset()` and the
  species-change code (search `o.crownBase = p.cb`) copy only `bloom`, `leaf2`, `fruit` and `cb`, so wire through
  whatever the new species needs.
- `bloomLabel()` in `app.js` decides the panel text from `speciesFor()`. Give smoke trees "Smoke in summer".

**Check your work:** `window.__yardDebug` (dev only) has `S`, `fromPreset`, `rebuildAll`, `afterDateChange`, `setView` and
`flyTo`. Set `S.objects = []`, push `fromPreset("Royal Purple Smoke Tree", 0, 0)`, set `S.date = "2026-07-25"`, then call
`afterDateChange()` and `rebuildAll()`. For headless screenshots, launch Chromium with `--use-gl=swiftshader --enable-unsafe-swiftshader`.

## Smaller, if time allows

- **Clump trees** (Prairie Dream birch clump, Royal Raindrops clump, Northern Redbud clump, Japanese Tree Lilac clump)
  carry `clump:true`, but the botany engine ignores it. The old idea was three stems from one base, leaning apart and
  sharing one crown (`trees.js` about line 363). The botany equivalent would be several seeded trunks in `grow.js`'s
  space-colonization start.
- **Arborvitae and junipers:** the user wants these **rebuilt from scratch** in the botany engine. Don't port the old
  code. Today they grow as whorled conifers with flat fans or cords (`grow.js` about lines 797–884, `SPECIES.arborvitae` and
  `SPECIES.juniper` in `species.js`, shoot painters in `leafArt.js`). Presets that came from the old branch used
  `teardrop`/`spire` crowns. They were mapped to `pyramidal`/`columnar` because the botany engine has no such shapes.
- **Bed perennials** (`src/garden/`): the user wants their visuals improved. Every plant is a preset in `plants.js` on one of
  24 growth forms in `models.js`, with procedural card textures in `plantTextures.js`. `gallery.html` renders them all in
  every season. That's the place to iterate. The bed shrub smokebush (`plantTextures.js` `smoke()`) is a separate,
  smaller texture from the tree plume.

## Housekeeping

- `src/trees/trees.js` is dead code on diorama except `leafTextures.js`, which `botany/leafArt.js` imports. Once the
  plume is ported, the old builder can go.
- Tree counts (143) are hardcoded in `index.html` (welcome screen), the tour text in `app.js` and the README.
- Rebuild the standalone page with `npm run build:standalone` before committing UI changes.
