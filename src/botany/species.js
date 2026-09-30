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

  // Sugar maple: 5 lobes with shallow, rounded sinuses and smooth margins. 3–6 in.
  sugar: { outline: 'palmate', lobes: 5, depth: 0.45, length: 4.5 * IN, width: 1.05, petiole: 2.5 * IN, petioleColor: '#7a5a2a', underside: '#aab89a', margin: 'entire' },
  // Red maple: 3 main lobes (the lower pair small), sharply toothed, red petiole. 2–4 in.
  redmaple: { outline: 'palmate', lobes: 5, depth: 0.34, length: 3.5 * IN, width: 1.0, petiole: 2.2 * IN, petioleColor: '#a02a24', underside: '#c4ccc0', margin: 'toothed' },
  // Silver maple: 5 lobes cut nearly to the midrib, silver-white beneath. 4–7 in.
  silvermaple: { outline: 'palmate', lobes: 5, depth: 0.7, length: 5 * IN, width: 1.0, petiole: 3 * IN, petioleColor: '#8a3a2a', underside: '#dfe4da', margin: 'toothed' },
  // Japanese maple: 7 slender lobes cut deep, fine teeth. 2–4 in.
  jmaple: { outline: 'palmate', lobes: 7, depth: 0.72, length: 2.6 * IN, width: 1.05, petiole: 1.4 * IN, petioleColor: '#7a2a2a', underside: '#8a4a48', margin: 'toothed' },
  // Sweetgum: a five-pointed star, lobes nearly equal, finely toothed. 4–7 in.
  sweetgum: { outline: 'palmate', lobes: 5, depth: 0.58, even: true, length: 5 * IN, width: 1.05, petiole: 3 * IN, petioleColor: '#6a5a2a', underside: '#aab89a', margin: 'toothed' },
  // Boxelder: compound, three (sometimes five) coarsely toothed leaflets. 2–4 in each.
  boxelder: { outline: 'pinnate', pairs: 1, terminal: true, terminalAt: 0.5, lw: 0.34, aspect: 0.95, spread: 0.9, length: 7 * IN, petiole: 2 * IN, petioleColor: '#6a7a3a', underside: '#c0c8a8', margin: 'crenate' },
  // Green ash: 5–9 lance-shaped leaflets on a stout rachis. Leaf 6–10 in.
  ash: { outline: 'pinnate', pairs: 3, terminal: true, lw: 0.2, aspect: 0.7, spread: 0.55, length: 9 * IN, petiole: 1.5 * IN, petioleColor: '#5a5a2a', underside: '#b8c0a0', margin: 'entire' },
  // Mountain ash: 11–17 narrow, sharply toothed leaflets. Leaf 6–9 in.
  mtnash: { outline: 'pinnate', pairs: 7, terminal: true, lw: 0.2, aspect: 0.6, spread: 0.45, length: 7.5 * IN, petiole: 1 * IN, petioleColor: '#7a4a2a', underside: '#b8c0a0', margin: 'serrate' },
  // Kentucky coffeetree: huge twice-compound leaf; one pinna of 6–7 pairs of 2 in ovate leaflets.
  coffeetree: { outline: 'pinnate', pairs: 5, terminal: true, lw: 0.3, aspect: 0.66, spread: 0.6, length: 11 * IN, petiole: 1.5 * IN, petioleColor: '#5a5a3a', underside: '#aab8a0', margin: 'entire' },
  // Buckeye: palmately compound, five leaflets from one point. Leaflets 3–6 in.
  buckeye: { outline: 'palmcompound', leaflets: 5, length: 6 * IN, petiole: 3 * IN, petioleColor: '#6a5a2a', underside: '#b0bc9c', margin: 'serrate' },
  // Northern pin oak: 5–7 deep, bristle-tipped lobes, C-shaped sinuses. 3–5 in.
  pinoak: { outline: 'lobed', lobes: 3.4, depth: 0.78, pointed: true, length: 4 * IN, width: 0.8, petiole: 1.4 * IN, petioleColor: '#6a4a2a', underside: '#b0b89c', margin: 'entire' },
  // Northern red oak: 7–11 bristle-tipped lobes cut halfway. 5–8 in.
  redoak: { outline: 'lobed', lobes: 4.6, depth: 0.5, pointed: true, length: 6.5 * IN, width: 0.62, petiole: 1.5 * IN, petioleColor: '#8a3a2a', underside: '#b8bea4', margin: 'entire' },
  // Siberian elm: small, elliptic, singly serrate. 1–2.5 in.
  siberianelm: { wx: 0.62, outline: 'ovate', length: 1.8 * IN, width: 0.5, skew: 0.08, petiole: 0.2 * IN, petioleColor: '#4f4a2a', underside: '#a8b494', margin: 'serrate', veins: 'parallel' },
  // Japanese tree lilac: broad ovate, smooth edges, dark and slightly glossy. 3–6 in.
  lilac: { wx: 0.95, outline: 'ovate', length: 4.2 * IN, width: 0.7, petiole: 1 * IN, petioleColor: '#5a5a2a', underside: '#a8b494', margin: 'entire' },
  // Serviceberry: small oval, finely toothed. 1.5–3 in.
  serviceberry: { wx: 0.9, outline: 'oval', length: 2.2 * IN, width: 0.66, petiole: 0.8 * IN, petioleColor: '#7a3a2a', underside: '#b8c0a8', margin: 'serrate' },
  // Chokecherry: oval to obovate, sharply fine-toothed. 2–4 in.
  chokecherry: { wx: 0.74, outline: 'elliptic', length: 3 * IN, width: 0.55, petiole: 0.8 * IN, petioleColor: '#8a3a3a', underside: '#9a8888', margin: 'serrate' },
  // Plums: elliptic, finely toothed. 2–3 in.
  plum: { wx: 0.76, outline: 'elliptic', length: 2.6 * IN, width: 0.55, petiole: 0.7 * IN, petioleColor: '#7a2a2a', underside: '#9a8a88', margin: 'serrate' },
  // Hawthorn: small, broad, toothed, sometimes shallowly lobed. 1.5–3 in.
  hawthorn: { wx: 0.9, outline: 'ovate', length: 2.2 * IN, width: 0.72, petiole: 0.7 * IN, petioleColor: '#5a4a2a', underside: '#a8b494', margin: 'double' },
  // Dogwoods: oval, smooth edges, veins curving to follow the margin. 3–5 in.
  dogwood: { wx: 0.8, outline: 'oval', length: 4 * IN, width: 0.6, petiole: 0.6 * IN, petioleColor: '#6a3a2a', underside: '#b8c0a8', margin: 'entire', veins: 'parallel' },
  pagoda: { wx: 0.84, outline: 'oval', length: 3.6 * IN, width: 0.58, petiole: 1 * IN, petioleColor: '#7a3a3a', underside: '#b8c0a8', margin: 'entire', veins: 'parallel' },
  // Ironwood: birch-like, doubly toothed, straight parallel veins. 3–5 in.
  ironwood: { wx: 0.72, outline: 'ovate', length: 3.6 * IN, width: 0.5, skew: 0.1, petiole: 0.3 * IN, petioleColor: '#4f4a2a', underside: '#a8b494', margin: 'double', veins: 'parallel' },
  // Blue beech: ovate, doubly toothed, straight veins. 2–4 in.
  bluebeech: { wx: 0.74, outline: 'ovate', length: 3.2 * IN, width: 0.52, skew: 0.12, petiole: 0.4 * IN, petioleColor: '#4f4a2a', underside: '#a8b494', margin: 'double', veins: 'parallel' },
  // Ginkgo: a fan with radiating, forking veins. 2–3 in on a long stalk.
  ginkgo: { outline: 'fan', length: 2.4 * IN, width: 1.2, petiole: 2 * IN, petioleColor: '#7a8a3a', underside: '#b8c898', margin: 'entire' },
  // Tulip tree: four lobes and a square, notched tip. 5–8 in.
  tulip: { outline: 'tulip', length: 5 * IN, width: 1.0, petiole: 3.5 * IN, petioleColor: '#6a7a3a', underside: '#b8c4a0', margin: 'entire' },
  // Redbud: broad heart, smooth edge. 3–5 in.
  redbud: { outline: 'cordate', length: 3.8 * IN, width: 1.05, petiole: 2 * IN, petioleColor: '#6a5a2a', underside: '#b0bc9c', margin: 'entire' },
  // Magnolia: obovate, smooth, leathery. 4–6 in.
  magnolia: { wx: 0.72, outline: 'elliptic', length: 5 * IN, width: 0.55, petiole: 0.6 * IN, petioleColor: '#5a5a2a', underside: '#b8c0a8', margin: 'entire' },
  // Black gum: elliptic, glossy, smooth edged. 3–5 in.
  blackgum: { wx: 0.8, outline: 'elliptic', length: 4 * IN, width: 0.55, petiole: 0.8 * IN, petioleColor: '#6a2a2a', underside: '#aab89a', margin: 'entire' },
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
  // Firs: flat, soft needles parted along the twig. Concolor 2–3 in, balsam ~1 in.
  fir: { kind: 'bottlebrush', needle: 1.3 * IN, length: 8 * IN },
  // Eastern white pine: soft, slender needles in fives, 3–5 in.
  whitepine: { kind: 'tuft', needle: 4 * IN, length: 10 * IN },
  // Scotch pine: short, twisted blue-green pairs, 1.5–3 in.
  scotchpine: { kind: 'tuft', needle: 2.4 * IN, length: 7 * IN },
  // Tamarack: soft tufts of 15–30 needles on short spur shoots, ~1 in.
  tamarack: { kind: 'larch', needle: 1 * IN, length: 7 * IN },
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

  sugarmaple: { leaf: 'sugar', bark: 'maple', leader: false, angle: 34, tropism: 0.35, arrange: 'opposite', perShoot: 6, twiggy: 0.8, scaffolds: 5 },
  redmaple: { leaf: 'redmaple', bark: 'smooth', leader: false, angle: 30, tropism: 0.45, arrange: 'opposite', perShoot: 6, twiggy: 0.7,
    ornaments: [{ type: 'blossom', from: -16, to: -3, bloom: true }] },
  silvermaple: { leaf: 'silvermaple', bark: 'maple', leader: false, angle: 30, tropism: 0.3, arrange: 'opposite', perShoot: 5, twiggy: 0.6, scaffolds: 4, vase: true, arch: 0.7,
    pheno: { out: -4, drop: 0 } },
  boxelder: { leaf: 'boxelder', bark: 'brown', leader: false, angle: 52, tropism: 0.1, arrange: 'opposite', perShoot: 4, twiggy: 0.5, scaffolds: 4, stems: 2, gnarl: 0.15 },
  jmaple: { leaf: 'jmaple', bark: 'smooth', leader: false, angle: 58, tropism: 0.05, arrange: 'opposite', perShoot: 8, twiggy: 0.9, scaffolds: 5 },
  pinoak: { leaf: 'pinoak', bark: 'oak', leader: true, angle: 72, tropism: -0.05, arrange: 'alternate', perShoot: 6, twiggy: 0.8,
    ornaments: [{ type: 'acorn', from: 110, to: 170, color: [0x7a6a3a, 0x6a4a2a], size: 0.6 }] },
  redoak: { leaf: 'redoak', bark: 'oak', leader: false, angle: 50, tropism: 0.15, arrange: 'alternate', perShoot: 6, twiggy: 0.7, scaffolds: 5,
    ornaments: [{ type: 'acorn', from: 110, to: 170, color: [0x7a6a3a, 0x6a4a2a], size: 1 }] },
  siberianelm: { leaf: 'siberianelm', bark: 'elm', leader: false, angle: 40, tropism: 0.25, arrange: 'alternate', perShoot: 9, twiggy: 0.85, scaffolds: 5, gnarl: 0.15 },
  hackberrycol: { leaf: 'hackberry', bark: 'hackberry', leader: true, angle: 14, tropism: 0.7, arrange: 'alternate', perShoot: 6, twiggy: 0.8,
    ornaments: [{ type: 'drupe', from: 110, to: 260, color: [0x8a5a3a, 0x3a2430] }] },
  ash: { leaf: 'ash', bark: 'ash', leader: false, angle: 35, tropism: 0.3, arrange: 'opposite', perShoot: 3, twiggy: 0.45, scaffolds: 4 },
  // Coffeetree: coarse, stubby twigs; one of the last trees to leaf out and among the first to drop.
  coffeetree: { leaf: 'coffeetree', bark: 'oak', leader: false, angle: 35, tropism: 0.3, arrange: 'alternate', perShoot: 3, twiggy: 0.25, scaffolds: 4,
    pheno: { out: 14, drop: -10 } },
  // Buckeyes leaf out first and are often bare by mid-September.
  buckeye: { leaf: 'buckeye', bark: 'oak', leader: false, angle: 45, tropism: 0.2, arrange: 'opposite', perShoot: 3, twiggy: 0.55, scaffolds: 4,
    pheno: { out: -7, drop: -14 },
    ornaments: [{ type: 'panicle', from: 10, to: 28, bloom: true, size: 1.3 }, { type: 'drupe', from: 100, to: 140, color: [0x8a6a3a, 0x5a3a20], size: 2.2 }] },
  treelilac: { leaf: 'lilac', bark: 'cherry', leader: false, angle: 40, tropism: 0.3, arrange: 'opposite', perShoot: 4, twiggy: 0.7,
    ornaments: [{ type: 'panicle', from: 36, to: 52, bloom: true, size: 1.7 }] },
  serviceberry: { leaf: 'serviceberry', bark: 'smooth', leader: false, angle: 24, tropism: 0.45, arrange: 'alternate', perShoot: 5, twiggy: 0.75, stems: 4,
    ornaments: [{ type: 'blossom', from: -5, to: 8, bloom: true, size: 1.4 }, { type: 'drupe', from: 40, to: 62, color: [0x5a2a4a, 0x2a1a3a] }] },
  // Canada Red: leaves open green and turn purple over early summer (`shift`).
  chokecherry: { leaf: 'chokecherry', bark: 'cherry', leader: false, angle: 35, tropism: 0.3, arrange: 'alternate', perShoot: 5, twiggy: 0.7, stems: 2,
    shift: { from: 12, to: 45 },
    ornaments: [{ type: 'blossom', from: 4, to: 16, bloom: true, size: 1.3 }, { type: 'drupe', from: 85, to: 120, color: [0x3a0a1a, 0x1a0a14] }] },
  plum: { leaf: 'plum', bark: 'cherry', leader: false, angle: 40, tropism: 0.25, arrange: 'alternate', perShoot: 5, twiggy: 0.8,
    ornaments: [{ type: 'blossom', from: -6, to: 8, bloom: true, size: 1.4 }, { type: 'drupe', from: 90, to: 130, color: [0xa02a2a, 0x6a1a2a], size: 2 }] },
  hawthorn: { leaf: 'hawthorn', bark: 'brown', leader: false, angle: 56, tropism: 0.05, arrange: 'alternate', perShoot: 5, twiggy: 0.85, scaffolds: 5, spurs: true,
    ornaments: [{ type: 'blossom', from: 16, to: 28, bloom: true }, { type: 'pome', from: 100, to: 300, color: [0xa01a1a, 0x7a1a1a], winter: true, size: 0.7 }] },
  mtnash: { leaf: 'mtnash', bark: 'smooth', leader: false, angle: 35, tropism: 0.3, arrange: 'alternate', perShoot: 3, twiggy: 0.5,
    ornaments: [{ type: 'blossom', from: 20, to: 34, bloom: true, size: 1.5 }, { type: 'pome', from: 80, to: 240, color: [0xe0501a, 0xc0301a], winter: true, size: 0.6 }] },
  // Pagoda dogwood: branches in flat, horizontal tiers off a single stem.
  pagoda: { leaf: 'pagoda', bark: 'smooth', leader: true, angle: 84, tropism: -0.12, arrange: 'alternate', perShoot: 5, twiggy: 0.55, tiers: 3,
    ornaments: [{ type: 'blossom', from: 30, to: 44, bloom: true, size: 1.5 }, { type: 'drupe', from: 70, to: 100, color: [0x2a2a5a, 0x1a1a3a] }] },
  dogwood: { leaf: 'dogwood', bark: 'oak', leader: false, angle: 62, tropism: 0, arrange: 'opposite', perShoot: 4, twiggy: 0.8, scaffolds: 4,
    ornaments: [{ type: 'blossom', from: -4, to: 14, bloom: true, size: 1.8 }, { type: 'drupe', from: 110, to: 170, color: [0xc01a1a, 0x9a1a1a], size: 1.4 }] },
  ironwood: { leaf: 'ironwood', bark: 'hackberry', leader: true, angle: 60, tropism: 0.1, arrange: 'alternate', perShoot: 6, twiggy: 0.8,
    ornaments: [{ type: 'catkin', from: 40, to: 140, color: [0xc8c8a0, 0xb8a878] }] },
  bluebeech: { leaf: 'bluebeech', bark: 'smooth', leader: false, angle: 45, tropism: 0.2, arrange: 'alternate', perShoot: 6, twiggy: 0.85, stems: 2 },
  // Ginkgo: sparse spur-shoot branching; the whole crown drops within a day or two.
  ginkgo: { leaf: 'ginkgo', bark: 'ginkgo', leader: true, angle: 40, tropism: 0.35, arrange: 'alternate', perShoot: 7, twiggy: 0.3, spurs: true, syncDrop: true },
  magnolia: { leaf: 'magnolia', bark: 'smooth', leader: false, angle: 40, tropism: 0.3, arrange: 'alternate', perShoot: 4, twiggy: 0.6, stems: 3,
    ornaments: [{ type: 'blossom', from: -14, to: 2, bloom: true, size: 1.6 }] },
  redbud: { leaf: 'redbud', bark: 'brown', leader: false, angle: 56, tropism: 0.1, arrange: 'alternate', perShoot: 4, twiggy: 0.7, scaffolds: 4,
    ornaments: [{ type: 'blossom', from: -12, to: 6, bloom: true, size: 1.6 }, { type: 'pod', from: 90, to: 300, color: [0x7a4a3a, 0x4a2a1a], winter: true, size: 0.25 }] },
  sweetgum: { leaf: 'sweetgum', bark: 'oak', leader: true, angle: 55, tropism: 0.2, arrange: 'alternate', perShoot: 5, twiggy: 0.7,
    pheno: { out: 0, drop: 7 },
    ornaments: [{ type: 'drupe', from: 100, to: 330, color: [0x6a4a2a, 0x3a2a1a], winter: true, size: 3.5 }] },
  tulip: { leaf: 'tulip', bark: 'oak', leader: true, angle: 50, tropism: 0.35, arrange: 'alternate', perShoot: 5, twiggy: 0.6,
    ornaments: [{ type: 'blossom', from: 30, to: 44, bloom: true, size: 1.3 }] },
  blackgum: { leaf: 'blackgum', bark: 'oak', leader: true, angle: 78, tropism: 0, arrange: 'alternate', perShoot: 6, twiggy: 0.75 },

  spruce: { conifer: true, shoot: 'spruce', bark: 'spruce', whorl: 1.1, droop: -0.15, ornaments: [{ type: 'cone', color: [0x6a4a30, 0x7a5a3a], size: 3 }] },
  bluespruce: { conifer: true, shoot: 'bluespruce', bark: 'spruce', whorl: 1.2, droop: -0.1, ornaments: [{ type: 'cone', color: [0x7a5a3a, 0x8a6a48], size: 3 }] },
  norway: { conifer: true, shoot: 'norway', bark: 'spruce', whorl: 1.4, droop: 0.05, pendulous: true, ornaments: [{ type: 'cone', color: [0x6a4a30, 0x8a6a48], size: 5 }] },
  pine: { conifer: true, shoot: 'pine', bark: 'pine', whorl: 0.9, droop: 0.4, candles: true, ornaments: [{ type: 'cone', color: [0x6a5238, 0x7a6048], size: 1.5 }] },
  redpine: { conifer: true, shoot: 'redpine', bark: 'pine', whorl: 1.2, droop: 0.3, ornaments: [{ type: 'cone', color: [0x6a5238, 0x7a6048], size: 2 }] },
  arborvitae: { conifer: true, shoot: 'arborvitae', bark: 'cedar', whorl: 0.55, droop: 0.6 },
  juniper: { conifer: true, shoot: 'juniper', bark: 'cedar', whorl: 0.5, droop: 0.7, ornaments: [{ type: 'berry', color: [0x6a7a9a, 0x5a6a8a], size: 0.3 }] },
  // Weeping white spruce: short limbs that turn straight down and hang against the trunk.
  weepingspruce: { conifer: true, shoot: 'spruce', bark: 'spruce', whorl: 0.75, weep: true, pendulous: 1, ornaments: [{ type: 'cone', color: [0x6a4a30, 0x7a5a3a], size: 2 }] },
  fir: { conifer: true, shoot: 'fir', bark: 'fir', whorl: 1.0, ascend: 0.08, ornaments: [{ type: 'cone', color: [0x5a4a6a, 0x6a5a3a], size: 3 }] },
  // White pine: widely spaced, near-horizontal whorls give its layered look.
  whitepine: { conifer: true, shoot: 'whitepine', bark: 'whitepine', whorl: 2.2, ascend: 0.06, perWhorl: 5, open: true, ornaments: [{ type: 'cone', color: [0x7a5a38, 0x8a6a48], size: 5 }] },
  scotchpine: { conifer: true, shoot: 'scotchpine', bark: 'scotch', whorl: 1.8, ascend: 0.3, perWhorl: 4, open: true, ornaments: [{ type: 'cone', color: [0x6a5238, 0x7a6048], size: 1.5 }] },
  // Tamarack: a conifer that colours gold and drops its needles.
  tamarack: { conifer: true, deciduous: true, shoot: 'tamarack', bark: 'larch', whorl: 0.9, ascend: 0.12, pheno: { out: -5, drop: 6 },
    ornaments: [{ type: 'cone', color: [0x7a5a3a, 0x8a6a48], size: 0.8 }] },
};

/* Where each profile's leaf season sits against the plan's leaf-out and
   leaf-drop dates, in days (+ later). Also used by the shade engine. */
const PHENO = {
  buroak: { out: 7, drop: 0 }, swampoak: { out: 7, drop: 0 }, locust: { out: 7, drop: -7 },
  willow: { out: -10, drop: 12 }, aspen: { out: 0, drop: -5 }, poplar: { out: 0, drop: -5 }, columnaraspen: { out: 0, drop: -5 },
};
export function phenology(key) {
  return SPECIES[key]?.pheno || PHENO[key] || { out: 0, drop: 0 };
}

/* Name → profile, checked in order; the first match wins. */
const BY_NAME = [
  [/tamarack|larch|larix/, 'tamarack'],
];
const CONIFER_BY_NAME = [
  [/arborvitae|thuja/, 'arborvitae'],
  [/juniper|cedar|yew/, 'juniper'],
  [/weeping white spruce|glauca 'pendula'/, 'weepingspruce'],
  [/\bfir\b|abies/, 'fir'],
  [/white pine|strobus/, 'whitepine'],
  [/scotch|scots pine|sylvestris/, 'scotchpine'],
  [/norway pine|red pine|resinosa/, 'redpine'],
  [/pine|mugo/, 'pine'],
];
const BROADLEAF_BY_NAME = [
  [/hydrangea/, 'hydrangea'],
  [/crab|malus|prairifire/, 'crabapple'],
  [/willow/, 'willow'],
  [/japanese maple|palmatum|bloodgood/, 'jmaple'],
  [/sugar maple|saccharum\b|fall fiesta|unity/, 'sugarmaple'],
  [/silver maple|saccharinum/, 'silvermaple'],
  [/red maple|rubrum|northwood|firedance/, 'redmaple'],
  [/box ?elder|negundo/, 'boxelder'],
  [/crimson king|royal red|norway maple|platanoides|crimson sunset/, 'norwaymaple'],
  [/maple/, 'maple'],
  [/greenspire|littleleaf|cordata/, 'littleleaf'],
  [/linden|basswood/, 'linden'],
  [/river birch/, 'riverbirch'],
  [/birch/, 'birch'],
  [/hackberry|celtis/, 'hackberry'],
  [/locust|gleditsia/, 'locust'],
  [/alder/, 'alder'],
  [/siberian elm|pumila/, 'siberianelm'],
  [/elm/, 'elm'],
  [/bur oak|burr oak|macrocarpa/, 'buroak'],
  [/pin oak|ellipsoidalis|palustris/, 'pinoak'],
  [/red oak|rubra/, 'redoak'],
  [/spire|english oak|robur/, 'whiteoak'],
  [/oak/, 'swampoak'],
  [/mountain ash|sorbus/, 'mtnash'],
  [/\bash\b|fraxinus/, 'ash'],
  [/coffee ?tree|gymnocladus/, 'coffeetree'],
  [/buckeye|aesculus|horse ?chestnut/, 'buckeye'],
  [/lilac|syringa/, 'treelilac'],
  [/serviceberry|amelanchier|saskatoon|juneberry/, 'serviceberry'],
  [/chokecherry|virginiana|schubert/, 'chokecherry'],
  [/plum|cherry|prunus/, 'plum'],
  [/hawthorn|crataegus/, 'hawthorn'],
  [/pagoda|alternifolia/, 'pagoda'],
  [/dogwood|cornus/, 'dogwood'],
  [/ironwood|ostrya/, 'ironwood'],
  [/blue beech|musclewood|hornbeam|carpinus/, 'bluebeech'],
  [/ginkgo/, 'ginkgo'],
  [/magnolia/, 'magnolia'],
  [/redbud|cercis/, 'redbud'],
  [/sweet ?gum|liquidambar/, 'sweetgum'],
  [/tulip|liriodendron/, 'tulip'],
  [/black ?gum|tupelo|nyssa/, 'blackgum'],
];

/** Which profile a plan tree grows from: by name where we can tell, else by shape. */
export function speciesFor(t) {
  const n = (t.name || '').toLowerCase();
  const narrow = t.shape === 'fastigiate' || t.shape === 'columnar';
  for (const [re, key] of BY_NAME) if (re.test(n)) return key;
  if (t.evergreen) {
    for (const [re, key] of CONIFER_BY_NAME) if (re.test(n)) return key;
    if (/norway spruce/.test(n) && t.shape !== 'columnar') return 'norway';
    if (/blue spruce|pungens/.test(n)) return 'bluespruce';
    return 'spruce';
  }
  if (/aspen/.test(n)) return narrow ? 'columnaraspen' : 'aspen';
  if (/poplar|cottonwood/.test(n)) return narrow ? 'columnaraspen' : 'poplar';
  for (const [re, key] of BROADLEAF_BY_NAME) {
    if (!re.test(n)) continue;
    if (key === 'hackberry' && narrow) return 'hackberrycol';
    return key;
  }
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
  brown: { scan: 'oak', tint: 0x9a8e80 },
  smooth: { scan: 'birch', tint: 0xb4b0a8 },
  cherry: { scan: 'birch', tint: 0x8a5a4a },
  ash: { scan: 'oak', tint: 0x9a9284 },
  ginkgo: { scan: 'oak', tint: 0x9a8c7a },
  fir: { scan: 'birch', tint: 0x9a968e },
  whitepine: { scan: 'pine', tint: 0x7a746c },
  scotch: { scan: 'pine', tint: 0xc07a4a },
  larch: { scan: 'pine', tint: 0x9a7058 },
};
