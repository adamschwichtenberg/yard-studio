# Yard Studio: shade simulator

A three.js yard shade simulator. Plant real species, then scrub the date and time to see where shade falls. The sun position is astronomically correct for your location.

![Yard Studio](docs/screenshot.png)

```bash
npm install
npm run fetch-assets   # optional: 4k Poly Haven sky HDRI (~25 MB) into public/hdri
npm run dev
```

## What's in this first pass

| Piece | Where | Notes |
| --- | --- | --- |
| **HDRI image-based lighting** | `src/scene/environment.js` | Uses `HDRLoader`, which replaced `RGBELoader` in r180. The raw equirect goes to `scene.background` (sharp), and a copy with the photographed sun clamped out goes to `scene.environment`, because the `DirectionalLight` supplies the direct sun. The HDRI's sun is detected automatically, and background and environment are rotated so it matches the simulated sun's azimuth. Sources are tried in order: local 4k file, Poly Haven CDN 2k, then the bundled 1k quarry HDRI. A three.js physical `Sky` mode re-bakes a PMREM as the sun moves. |
| **Sun from latitude, date and time** | `src/scene/sun.js` | Uses suncalc. The time is wall-clock time in the location's time zone, so 17:00 in Fargo means 17:00 CDT whatever time zone your browser is in. Includes a hemisphere fill light, a 4k shadow map fitted to the lot (2k or 8k selectable), and shadows that only re-render when the sun or trees change. |
| **Instanced grass** | `src/scene/grass.js` | 3-blade clumps on one `InstancedMesh`, about 60k clumps at Medium. A patched `MeshStandardMaterial` adds wind while keeping receive-shadow and IBL support. Density is adjustable. |
| **ACES + SSAO** | `src/post.js` | pmndrs `postprocessing`: RenderPass → N8AO → ACES `ToneMappingEffect` → SMAA. The renderer's own tone mapping is off, the frame buffers are half-float, and MSAA is off. |
| **Trees** | `src/trees/` | Generated at runtime with `@dgreenheck/ez-tree`, then rescaled to real mature height and spread. |

### Species (zone 4a)

| Species | Mature size | Built from |
| --- | --- | --- |
| Autumn Blaze maple | 15 × 11 m | Oak leaves recoloured; upright oval |
| Redmond linden | 14 × 9 m | Aspen leaves on a conical "evergreen" skeleton, giving a dense pyramid |
| Prairie Horizon alder | 11 × 5.5 m | Aspen leaves; narrow upright oval |
| Tannenbaum mugo pine | 3.5 × 2.6 m | Pine needles; dense and bushy |
| Columnar Norway spruce | 10 × 1.8 m | Pine needles; very narrow column |
| Moonglow juniper | 6 × 2.6 m | Pine needles tinted silver-blue; pyramidal |

The deciduous trees follow the calendar. Leaf-out runs early to late May, fall colour peaks in early October, and the leaves drop in late October. Scrub the date to compare July shade with December shade. The **Years after planting** slider grows every tree from nursery size toward maturity.

Leaf textures only supply shape and light/dark detail. Each species' colour is set in `species.js`, and leaf normals point out from the crown centre so the canopy shades as a volume.

## Controls

- **Orbit / pan / zoom:** drag, right-drag, scroll
- **Plant:** pick a species, then click the lawn. Hold Shift to keep planting.
- **Select / move / delete:** click a tree, drag it, then press Delete or use **Remove**
- The layout and settings persist in `localStorage`.

## Conventions

- 1 unit = 1 metre. +X = east, −Z = north.
- suncalc ≥ 2 returns **degrees** and **compass azimuth from north**. suncalc 1.x snippets online use radians measured from south, so don't mix the two.
- `postprocessing` 6.x supports three < 0.187, so three is pinned to `~0.186`.

## Next steps

- Shade-hours heatmap: accumulate shadow-map samples over a day or season into a lawn texture.
- Editable lot, house footprint and patio.
- Scanned Poly Haven ground and bark textures to replace the procedural ones.
- LOD or impostors for large plantings. EZ-Tree trees are about 15–40k triangles each.
