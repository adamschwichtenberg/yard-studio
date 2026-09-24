# Yard Shade Studio

Plan a yard and see where the shade falls, at any time of day, on any date, anywhere on Earth. This is the original Yard Shade Studio planner with a realistic three.js renderer underneath it.

![Eye-level view with the tree inspector](docs/screenshot.png)

```bash
npm install
npm run dev            # http://localhost:5173
npm run fetch-assets   # optional: 4k Poly Haven sky HDRI (~25 MB) into public/hdri
```

The original single-file app is kept for reference at `legacy/yard-shade-studio-original.html`.

## What it does

All of the original planner's features and navigation are unchanged:

- **Tools:** select and move, pan, measure, and place trees, beds, buildings, decks, driveways and sidewalks.
- **Views:** plan, tilted, eye level, frame the lot, centre on the selection, and a simple schematic view. Keyboard: 1 / 2 / 3 / 0 / F / G.
- **Layout:** a sidebar with Lot & fence, Location & sun, Yard items, Display and Plan file; a sun timeline along the bottom; tools, views and undo along the top; and the inspector on the right while something is selected. On phones the sidebar becomes a bottom sheet.
- **Sun timeline:** drag the sun arc to set the time, play the day, pick a date, or jump to a solstice or equinox. Readouts show sun height, bearing, the shadow cast by a 10 ft object, daylight and solar noon.
- **Property & fence:** reshape the lot corner by corner, type exact side lengths, stretch the lot, and set the fence style, height, density and sides. Set up the grid and snapping.
- **Site & sky:**
  - House angle versus north.
  - Location and clock (see below).
  - The sun-hours heat map and bare branches in the off-season.
  - Rendering settings.
- **Everything in the yard:** every object with its size, distance to the property line and sun hours.
- **Plan file:** save and open JSON plans, start over, undo and redo (60 steps), and import a property image to trace and scale the lot.
- **Inspector:**
  - Tree presets and crown shapes, with property-line clearance.
  - Bed sun hours with a planting verdict.
  - Reshaping and height for buildings, decks and paving.
  - Duplicate and delete.

All units are feet.

## Location, clock and sun angles

The sun position comes from the original's NOAA-based solar maths. It matches suncalc to within 0.2° from Fargo to Sydney to Tromsø; the remaining difference is atmospheric refraction.

- **Location:**
  - Pick a preset, or type any latitude (−90 to 90) and longitude (−180 to 180). North and east are positive.
  - **Use my location** fills them in where the browser allows it.
- **Clock:**
  - **Time zone** (the default) uses the zone's own daylight-saving rules through the browser's time-zone data. That covers Phoenix (no DST), Europe and the southern hemisphere.
  - **Fixed UTC offset** keeps the original manual offset and its US daylight-saving switch. **Offset from longitude** suggests one.
  - If the clock is more than about 2.5 hours from what the longitude implies, the Clock section warns you, because every sun time would look wrong.
- **Edge cases:**
  - Inside the polar circles, the panel reports "Sun up all day" or "Sun below horizon all day" instead of inventing a sunrise.
  - South of the equator, leaf-out and leaf-drop dates shift six months, and the sun arcs through the north.

## Rendering

| Piece | Where |
| --- | --- |
| HDRI or physical sky. The HDRI's sun is detected, clamped out of the lighting, and rotated to the solar-maths sun, with house angle vs. north applied. | `src/scene/environment.js` |
| RenderPass → N8AO → ACES → SMAA, half-float buffers, with no tone mapping on the renderer. It switches cleanly between the perspective and plan (orthographic) cameras. | `src/post.js` |
| EZ-Tree trees built from each tree's crown shape, height, spread and density, so what you see matches the shade engine. Per-variety leaf colour, fall colour before leaf drop, bare branches in winter. | `src/trees/trees.js` |
| Buildings: foundation, corner boards, fascia and soffit, windows and a door on the wall facing the patio, generated for any outline and merged into a few draw calls | `src/app.js` (`buildingDetails`) |
| Procedural maple sprig (palmate, serrated, red petioles) for every maple | `src/trees/mapleLeaf.js` |
| Procedural lawn (blade strokes plus normal map, mowing stripes along the grid), concrete, pavers, siding and shingles | `src/scene/textures.js` |

- **Sun-hours numbers:** the original's analytic shade engine calculates them. The 3D shadows are for looking; the numbers don't depend on them.
- **Heat-map colours:** they're pre-compensated for the tone curve, so the colour ramp reads the same in the realistic and simple views.
- **Display settings** (render quality, sky and exposure) are saved per browser, not in plan files.

## Performance

- **Renders on demand.** Nothing draws unless something changes: the camera, the sun, the plan or a setting. When idle, the GPU does no work.
- **Shadows only when needed.** The shadow map re-renders only when the sun or the yard changes, never for camera moves.
- **Lighter while moving.** While you orbit, drag or play the day, frames render at 1× resolution without ambient occlusion. One full-quality frame follows when the view settles.
- **No wind and no grass geometry.** The lawn is a texture, not millions of blades.
- **Render quality presets** in the Display section:

| Preset | Resolution | Ambient occlusion | Shadow map |
| --- | --- | --- | --- |
| Performance | 1× | off | 2048 |
| Balanced (default) | up to 1.5× | half resolution | 4096 |
| Quality | display resolution | full | 4096 |
