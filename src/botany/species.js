/*
 * Botanical profiles for every tree in the planner, from arboretum and
 * extension fact sheets (Morton Arboretum, Missouri Botanical Garden, UMN,
 * NC State, Ohio DNR, Go Botany; see docs/botany.md for the list).
 *
 * Everything is in feet unless a name says otherwise. The growth code reads
 * these numbers directly, so a species looks the way its fact sheet says:
 * leaf size and outline, opposite or alternate leaves, how steeply branches
 * climb, whether a leader runs to the top, what flowers or fruit it carries
 * and when.
 */

const IN = 1 / 12;

/* Leaf outline families, drawn by leafArt.js. */
export const LEAF = {
  // Freeman maple: 5 lobes, deep sinuses, silvery underside, red petiole. 3–5 in.
  freeman: { outline: 'palmate', lobes: 5, depth: 0.62, length: 4 * IN, width: 1.0, petiole: 2.2 * IN, petioleColor: '#9a3a2c', underside: '#b9c4b0', margin: 'toothed' },
  // Norway maple (Crimson King, Royal Red): 5–7 broad lobes, shallow sinuses. 4–7 in.
  norway: { outline: 'palmate', lobes: 7, depth: 0.32, length: 5 * IN, width: 1.15, petiole: 3 * IN, petioleColor: '#6a2a24', underside: '#8a4a48', margin: 'entire' },
  // American linden: heart-shaped, finely serrate, 4–8 in. Littleleaf linden 1.5–3 in.
  linden: { outline: 'cordate', length: 5.5 * IN, width: 0.9, petiole: 2 * IN, petioleColor: '#6a6a34', underside: '#aebc98', margin: 'serrate' },
  littleleaf: { outline: 'cordate', length: 2.4 * IN, width: 0.95, petiole: 1.3 * IN, petioleColor: '#6a6a34', underside: '#aebc98', margin: 'serrate' },
  // Birches: triangular-ovate, long point, doubly serrate. 1.5–3 in.
  birch: { outline: 'deltoid', length: 2.3 * IN, width: 0.75, petiole: 0.8 * IN, petioleColor: '#5a3a2a', underside: '#b4c0a0', margin: 'double' },
  // Alder: oval, blunt tip, doubly serrate, deep parallel veins. 2–4 in.
  alder: { outline: 'oval', length: 3 * IN, width: 0.72, petiole: 0.8 * IN, petioleColor: '#4f4a2a', underside: '#9aa888', margin: 'double', veins: 'parallel' },
  // Quaking aspen: nearly round, short point, fine teeth, flattened petiole. 1.5–3 in.
  aspen: { outline: 'round', length: 2.2 * IN, width: 0.95, petiole: 2 * IN, petioleColor: '#8a8a4a', underside: '#c4ccb0', margin: 'crenate' },
  // Poplar/cottonwood: deltoid with a flat base and coarse teeth. 3–5 in.
  poplar: { outline: 'deltoid', length: 3.8 * IN, width: 0.95, petiole: 2.5 * IN, petioleColor: '#8a8a4a', underside: '#bcc6a8', margin: 'crenate' },
  // Hackberry: ovate, lopsided base, long tapering tip. 2–4 in.
  hackberry: { outline: 'ovate', length: 3 * IN, width: 0.6, skew: 0.25, petiole: 0.5 * IN, petioleColor: '#4f4a2a', underside: '#a8b494', margin: 'serrate' },
  // American elm: ovate-oblong, unequal base, doubly serrate. 3–6 in.
  elm: { outline: 'ovate', length: 4 * IN, width: 0.55, skew: 0.2, petiole: 0.3 * IN, petioleColor: '#4f4a2a', underside: '#a0ae8c', margin: 'double', veins: 'parallel' },
  // Bur oak: fiddle-shaped, deep central sinus, big crenate top. 4–10 in.
  buroak: { outline: 'fiddle', length: 7 * IN, width: 0.62, petiole: 0.7 * IN, petioleColor: '#5a4a2a', underside: '#b8bea4', margin: 'entire' },
  // Crimson Spire (robur × alba): 5–7 pairs of rounded lobes. 3–5 in.
  whiteoak: { outline: 'lobed', lobes: 6, depth: 0.45, length: 4 * IN, width: 0.6, petiole: 0.3 * IN, petioleColor: '#5a4a2a', underside: '#aab498', margin: 'entire' },
  // Swamp white oak: obovate, shallow wavy lobes. 4–7 in.
  swampoak: { outline: 'lobed', lobes: 5, depth: 0.16, length: 5.5 * IN, width: 0.62, petiole: 0.5 * IN, petioleColor: '#5a4a2a', underside: '#c8ccb8', margin: 'entire' },
  // Willow: narrow lance, finely toothed. 2–4 in.
  willow: { outline: 'lance', length: 3.2 * IN, width: 0.2, petiole: 0.3 * IN, petioleColor: '#9a9a4a', underside: '#c8d0b8', margin: 'serrate' },
  // Crabapple: small ovate, finely serrate. 2–3 in.
  crabapple: { outline: 'ovate', length: 2.4 * IN, width: 0.62, petiole: 1 * IN, petioleColor: '#7a3a2a', underside: '#a8ae98', margin: 'serrate' },
  // Panicle hydrangea: elliptic, pointed, toothed, opposite or whorled. 3–6 in.
  hydrangea: { outline: 'elliptic', length: 4.2 * IN, width: 0.55, petiole: 0.8 * IN, petioleColor: '#6a5a2a', underside: '#aeb89c', margin: 'serrate', veins: 'parallel' },
  // Honeylocust: bipinnate, leaflets under 1 in. The "leaf" drawn is one pinna.
  locust: { outline: 'pinnate', length: 5 * IN, width: 0.45, leaflet: 0.7 * IN, petiole: 0.5 * IN, petioleColor: '#6a6a36', underside: '#c0c890', margin: 'entire' },
};

/* Needle and scale foliage, drawn as shoots by leafArt.js. */
export const SHOOT = {
  // Spruces: 4-sided needles all round the twig, 0.5–1 in.
  spruce: { kind: 'bottlebrush', needle: 0.8 * IN, length: 7 * IN },
  // Colorado blue spruce: stiff, sharp, ~1 in, a little longer.
  bluespruce: { kind: 'bottlebrush', needle: 1 * IN, length: 7 * IN },
  // Norway spruce: shoots hang from the branches in curtains.
  norway: { kind: 'bottlebrush', needle: 0.75 * IN, length: 8 * IN },
  // Mugo pine: needles in pairs, 1.5–3 in, crowded toward pale candles.
  pine: { kind: 'tuft', needle: 2.2 * IN, length: 6 * IN },
  // Red pine (sold as columnar Norway pine): pairs, 4–6 in.
  redpine: { kind: 'tuft', needle: 5 * IN, length: 9 * IN },
  // Arborvitae: flat sprays of 3–5 mm scale leaves.
  arborvitae: { kind: 'fan', length: 5 * IN },
  // Juniper: dense cords of scale leaves, blue berries.
  juniper: { kind: 'cord', length: 5 * IN },
};

/*
 * Architecture, in the terms arborists use:
 *   leader     – a single stem runs to the top (excurrent) instead of forking
 *   angle      – how far scaffold limbs lean out from vertical, degrees
 *   tropism    – bend of new growth: +up (reaching), −down (weeping)
 *   arrange    – leaf arrangement on the twig: opposite, alternate, whorled
 *   perShoot   – leaves on each current-year shoot
 *   twiggy     – density of fine branching (0–1)
 *   scaffolds  – main limbs for forking crowns (vase, spreading)
 */
export const SPECIES = {
  maple: { leaf: 'freeman', bark: 'maple', leader: false, angle: 38, tropism: 0.35, arrange: 'opposite', perShoot: 6, twiggy: 0.7 },
  norwaymaple: { leaf: 'norway', bark: 'maple', leader: false, angle: 48, tropism: 0.2, arrange: 'opposite', perShoot: 6, twiggy: 0.8 },
  linden: { leaf: 'linden', bark: 'linden', leader: true, angle: 62, tropism: 0.1, arrange: 'alternate', perShoot: 5, twiggy: 0.8,
    ornaments: [{ type: 'bract', from: 40, to: 62, color: [0xd8dc9a, 0xe4e0a0] }] },
  littleleaf: { leaf: 'littleleaf', bark: 'linden', leader: true, angle: 60, tropism: 0.1, arrange: 'alternate', perShoot: 7, twiggy: 0.9,
    ornaments: [{ type: 'bract', from: 40, to: 62, color: [0xd8dc9a, 0xe4e0a0] }] },
  birch: { leaf: 'birch', bark: 'birch', leader: true, angle: 16, tropism: 0.6, arrange: 'alternate', perShoot: 5, twiggy: 0.75,
    ornaments: [{ type: 'catkin', from: -30, to: 12, color: [0x8a6a44, 0xb89a5a], winter: true }] },
  riverbirch: { leaf: 'birch', bark: 'riverbirch', leader: false, angle: 34, tropism: 0.25, arrange: 'alternate', perShoot: 5, twiggy: 0.7, stems: 3,
    ornaments: [{ type: 'catkin', from: -30, to: 12, color: [0x8a6a44, 0xb89a5a], winter: true }] },
  alder: { leaf: 'alder', bark: 'alder', leader: true, angle: 45, tropism: 0.25, arrange: 'alternate', perShoot: 5, twiggy: 0.55,
    ornaments: [{ type: 'catkin', from: -40, to: 10, color: [0x6a3a4a, 0x8a4a5a], winter: true },
                { type: 'strobile', from: 90, to: 400, color: [0x4a3a28, 0x3a2c20], winter: true }] },
  aspen: { leaf: 'aspen', bark: 'aspen', leader: true, angle: 35, tropism: 0.4, arrange: 'alternate', perShoot: 6, twiggy: 0.55 },
  poplar: { leaf: 'poplar', bark: 'poplar', leader: true, angle: 30, tropism: 0.5, arrange: 'alternate', perShoot: 5, twiggy: 0.6 },
  columnaraspen: { leaf: 'aspen', bark: 'aspen', leader: true, angle: 12, tropism: 0.8, arrange: 'alternate', perShoot: 6, twiggy: 0.7 },
  hackberry: { leaf: 'hackberry', bark: 'hackberry', leader: false, angle: 52, tropism: 0.1, arrange: 'alternate', perShoot: 6, twiggy: 0.75, scaffolds: 5,
    ornaments: [{ type: 'drupe', from: 110, to: 260, color: [0x8a5a3a, 0x3a2430] }] },
  elm: { leaf: 'elm', bark: 'elm', leader: false, angle: 24, tropism: 0.45, arrange: 'alternate', perShoot: 7, twiggy: 0.8, scaffolds: 5, vase: true, arch: 0.5 },
  buroak: { leaf: 'buroak', bark: 'oak', leader: false, angle: 64, tropism: -0.05, arrange: 'alternate', perShoot: 6, twiggy: 0.6, scaffolds: 5, gnarl: 0.35,
    ornaments: [{ type: 'acorn', from: 100, to: 160, color: [0x7a7a3a, 0x7a5430], size: 1.1 }] },
  whiteoak: { leaf: 'whiteoak', bark: 'oak', leader: true, angle: 14, tropism: 0.7, arrange: 'alternate', perShoot: 6, twiggy: 0.8,
    ornaments: [{ type: 'acorn', from: 110, to: 160, color: [0x7a7a3a, 0x7a5430], size: 0.8 }] },
  swampoak: { leaf: 'swampoak', bark: 'oak', leader: false, angle: 58, tropism: 0.05, arrange: 'alternate', perShoot: 6, twiggy: 0.6, scaffolds: 5, gnarl: 0.2,
    ornaments: [{ type: 'acorn', from: 100, to: 160, color: [0x7a7a3a, 0x7a5430], size: 0.9 }] },
  willow: { leaf: 'willow', bark: 'willow', leader: false, angle: 42, tropism: 0.25, arrange: 'alternate', perShoot: 10, twiggy: 0.4, scaffolds: 5, weeping: true },
  crabapple: { leaf: 'crabapple', bark: 'crabapple', leader: false, angle: 40, tropism: 0.25, arrange: 'alternate', perShoot: 5, twiggy: 0.8, spurs: true,
    ornaments: [{ type: 'blossom', from: 0, to: 16, bloom: true },
                { type: 'pome', from: 120, to: 300, color: [0x8a2a2a, 0x5a1a2a], winter: true }] },
  hydrangea: { leaf: 'hydrangea', bark: 'hydrangea', leader: false, angle: 45, tropism: 0.2, arrange: 'opposite', perShoot: 6, twiggy: 0.6, standard: true,
    ornaments: [{ type: 'panicle', from: 62, to: 150, bloom: true }] },
  locust: { leaf: 'locust', bark: 'locust', leader: false, angle: 55, tropism: 0.05, arrange: 'alternate', perShoot: 6, twiggy: 0.5, scaffolds: 4,
    ornaments: [{ type: 'pod', from: 110, to: 330, color: [0x7a5a2a, 0x4a2a1a], winter: true }] },
  broadleaf: { leaf: 'linden', bark: 'maple', leader: false, angle: 45, tropism: 0.2, arrange: 'alternate', perShoot: 5, twiggy: 0.7 },

  spruce: { conifer: true, shoot: 'spruce', bark: 'spruce', whorl: 1.1, droop: -0.15, ornaments: [{ type: 'cone', color: [0x6a4a30, 0x7a5a3a], size: 3 }] },
  bluespruce: { conifer: true, shoot: 'bluespruce', bark: 'spruce', whorl: 1.2, droop: -0.1, ornaments: [{ type: 'cone', color: [0x7a5a3a, 0x8a6a48], size: 3 }] },
  norway: { conifer: true, shoot: 'norway', bark: 'spruce', whorl: 1.4, droop: 0.05, pendulous: true, ornaments: [{ type: 'cone', color: [0x6a4a30, 0x8a6a48], size: 5 }] },
  pine: { conifer: true, shoot: 'pine', bark: 'pine', whorl: 0.9, droop: 0.4, candles: true, ornaments: [{ type: 'cone', color: [0x6a5238, 0x7a6048], size: 1.5 }] },
  redpine: { conifer: true, shoot: 'redpine', bark: 'pine', whorl: 1.2, droop: 0.3, ornaments: [{ type: 'cone', color: [0x6a5238, 0x7a6048], size: 2 }] },
  arborvitae: { conifer: true, shoot: 'arborvitae', bark: 'cedar', whorl: 0.55, droop: 0.6 },
  juniper: { conifer: true, shoot: 'juniper', bark: 'cedar', whorl: 0.5, droop: 0.7, ornaments: [{ type: 'berry', color: [0x6a7a9a, 0x5a6a8a], size: 0.3 }] },
};

/** Which profile a plan tree grows from: by name where we can tell, else by shape. */
export function speciesFor(t) {
  const n = (t.name || '').toLowerCase();
  if (t.evergreen) {
    if (/arborvitae|thuja/.test(n)) return 'arborvitae';
    if (/juniper|cedar|yew/.test(n)) return 'juniper';
    if (/norway pine|red pine|resinosa/.test(n)) return 'redpine';
    if (/pine|mugo/.test(n)) return 'pine';
    if (/norway spruce/.test(n) && t.shape !== 'columnar') return 'norway';
    if (/blue spruce|pungens/.test(n)) return 'bluespruce';
    return 'spruce';
  }
  if (/hydrangea/.test(n)) return 'hydrangea';
  if (/crab|malus|prairifire/.test(n)) return 'crabapple';
  if (/willow/.test(n)) return 'willow';
  if (/crimson king|royal red|norway maple|platanoides|crimson sunset/.test(n)) return 'norwaymaple';
  if (/maple/.test(n)) return 'maple';
  if (/greenspire|littleleaf|cordata/.test(n)) return 'littleleaf';
  if (/linden|basswood/.test(n)) return 'linden';
  if (/river birch/.test(n)) return 'riverbirch';
  if (/birch/.test(n)) return 'birch';
  if (/aspen/.test(n)) return t.shape === 'fastigiate' || t.shape === 'columnar' ? 'columnaraspen' : 'aspen';
  if (/poplar|cottonwood/.test(n)) return t.shape === 'fastigiate' || t.shape === 'columnar' ? 'columnaraspen' : 'poplar';
  if (/hackberry/.test(n)) return 'hackberry';
  if (/locust/.test(n)) return 'locust';
  if (/alder/.test(n)) return 'alder';
  if (/elm/.test(n)) return 'elm';
  if (/bur oak|burr oak|macrocarpa/.test(n)) return 'buroak';
  if (/spire|english oak|robur/.test(n)) return 'whiteoak';
  if (/oak/.test(n)) return 'swampoak';
  return { round: 'maple', oval: 'maple', spreading: 'swampoak', vase: 'elm', linden: 'linden', weeping: 'willow', fastigiate: 'whiteoak' }[t.shape] || 'broadleaf';
}

/* Bark: EZ-Tree scanned type, tint, and whether to paint it procedurally. */
export const BARK = {
  maple: { scan: 'oak', tint: 0xa8a092 },
  linden: { scan: 'oak', tint: 0x9a948a },
  birch: { paint: 'birch', tint: 0xf2efe8 },
  riverbirch: { paint: 'riverbirch', tint: 0xc89a7a },
  alder: { scan: 'birch', tint: 0x8a8278 },
  aspen: { paint: 'aspen', tint: 0xdfe2cf },
  poplar: { scan: 'oak', tint: 0xaaa597 },
  hackberry: { paint: 'hackberry', tint: 0xa8a298 },
  elm: { scan: 'oak', tint: 0x9a9388 },
  oak: { scan: 'oak', tint: 0x8e867a },
  willow: { scan: 'willow', tint: 0x9a8a78 },
  crabapple: { scan: 'oak', tint: 0x8a7a6c },
  hydrangea: { scan: 'willow', tint: 0xa08a70 },
  locust: { scan: 'oak', tint: 0x7a6d60 },
  spruce: { scan: 'pine', tint: 0x8c7f70 },
  pine: { scan: 'pine', tint: 0xa07a5a },
  cedar: { scan: 'willow', tint: 0x8e6a52 },
};
