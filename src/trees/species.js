/**
 * Species catalogue. Each entry pairs an EZ-Tree generator recipe (a preset plus
 * overrides, in EZ-Tree's own units) with real-world size and phenology so the
 * generated tree is rescaled to metres and leafs out / colours / drops on the
 * right dates for USDA zone 4a (Fargo–Moorhead).
 *
 * `leafColor` / `fallColor` replace the leaf texture's hue: the texture only
 * supplies shape and light/dark detail.
 */

// Day-of-year helpers (non-leap year is close enough for phenology).
const doy = (month, day) => {
  const cum = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  return cum[month - 1] + day;
};

export const SPECIES = {
  autumnBlazeMaple: {
    name: 'Autumn Blaze maple',
    latin: 'Acer × freemanii ‘Jeffersred’',
    matureHeight: 15,
    matureSpread: 11,
    growthRate: 0.9, // m/yr when young
    deciduous: true,
    leafColor: 0x46702c,
    fallColor: 0xb8321c,
    phenology: { leafOut: doy(5, 5), fullLeaf: doy(5, 28), colorStart: doy(9, 18), peak: doy(10, 5), drop: doy(10, 25) },
    preset: 'Oak Medium',
    options: {
      seed: 4127,
      bark: { type: 'oak', tint: 0xb9b4aa, textureScale: { x: 1, y: 6 } },
      branch: {
        levels: 3,
        angle: { 1: 30, 2: 44, 3: 40 },
        children: { 0: 9, 1: 5, 2: 4 },
        force: { direction: { x: 0, y: 1, z: 0 }, strength: 0.02 },
        gnarliness: { 0: 0.02, 1: 0.08, 2: 0.12, 3: 0.08 },
        length: { 0: 34, 1: 15, 2: 8, 3: 5 },
        radius: { 0: 1.3, 1: 0.65, 2: 0.6, 3: 0.8 },
        start: { 1: 0.35, 2: 0.2, 3: 0.2 },
        taper: { 0: 0.75, 1: 0.6, 2: 0.7, 3: 0.7 },
      },
      leaves: { type: 'oak', billboard: 'double', angle: 40, count: 16, start: 0.1, size: 2.6, sizeVariance: 0.5, alphaTest: 0.5 },
    },
  },

  redmondLinden: {
    name: 'Redmond linden',
    latin: 'Tilia americana ‘Redmond’',
    matureHeight: 14,
    matureSpread: 9,
    growthRate: 0.6,
    deciduous: true,
    leafColor: 0x3f6a2a,
    fallColor: 0xb89a3a,
    phenology: { leafOut: doy(5, 10), fullLeaf: doy(6, 1), colorStart: doy(9, 25), peak: doy(10, 8), drop: doy(10, 22) },
    // Central leader with shorter branches up high → pyramidal crown.
    preset: 'Pine Medium',
    options: {
      seed: 812,
      type: 'evergreen',
      bark: { type: 'oak', tint: 0xa39d92, textureScale: { x: 1, y: 6 } },
      branch: {
        levels: 2,
        angle: { 1: 68, 2: 42 },
        children: { 0: 46, 1: 8 },
        force: { direction: { x: 0, y: 1, z: 0 }, strength: 0.01 },
        gnarliness: { 0: 0.02, 1: 0.1, 2: 0.2 },
        length: { 0: 42, 1: 21, 2: 6 },
        radius: { 0: 1.3, 1: 0.35, 2: 0.6 },
        sections: { 0: 14, 1: 8, 2: 4 },
        segments: { 0: 8, 1: 5, 2: 3 },
        start: { 1: 0.12, 2: 0.1 },
        taper: { 0: 0.7, 1: 0.7, 2: 0.7 },
      },
      leaves: { type: 'aspen', billboard: 'double', angle: 35, count: 12, start: 0.05, size: 3.0, sizeVariance: 0.4, alphaTest: 0.5 },
    },
  },

  prairieHorizonAlder: {
    name: 'Prairie Horizon alder',
    latin: 'Alnus hirsuta ‘Harbin’',
    matureHeight: 11,
    matureSpread: 5.5,
    growthRate: 0.7,
    deciduous: true,
    leafColor: 0x2f5424,
    fallColor: 0x6e6a2c, // alders drop mostly green-brown
    phenology: { leafOut: doy(5, 1), fullLeaf: doy(5, 25), colorStart: doy(10, 5), peak: doy(10, 18), drop: doy(10, 30) },
    preset: 'Ash Medium',
    options: {
      seed: 5531,
      bark: { type: 'birch', tint: 0x8a8278, textureScale: { x: 1, y: 6 } },
      branch: {
        levels: 3,
        angle: { 1: 30, 2: 38, 3: 40 },
        children: { 0: 13, 1: 4, 2: 4 },
        force: { direction: { x: 0, y: 1, z: 0 }, strength: 0.02 },
        gnarliness: { 0: 0.02, 1: 0.06, 2: 0.1, 3: 0.08 },
        length: { 0: 36, 1: 12, 2: 6, 3: 4 },
        radius: { 0: 1.0, 1: 0.6, 2: 0.6, 3: 0.8 },
        start: { 1: 0.12, 2: 0.2, 3: 0.2 },
        taper: { 0: 0.8, 1: 0.6, 2: 0.7, 3: 0.7 },
      },
      leaves: { type: 'aspen', billboard: 'double', angle: 35, count: 16, start: 0.1, size: 2.2, sizeVariance: 0.4, alphaTest: 0.5 },
    },
  },

  tannenbaumMugo: {
    name: 'Tannenbaum mugo pine',
    latin: 'Pinus mugo ‘Tannenbaum’',
    matureHeight: 3.5,
    matureSpread: 2.6,
    growthRate: 0.15,
    deciduous: false,
    leafColor: 0x2e4d22,
    preset: 'Pine Small',
    options: {
      seed: 9021,
      type: 'evergreen',
      bark: { type: 'pine', tint: 0x8c7f70 },
      branch: {
        levels: 2,
        angle: { 1: 80, 2: 40 },
        children: { 0: 64, 1: 6 },
        gnarliness: { 0: 0.05, 1: 0.18, 2: 0.2 },
        length: { 0: 30, 1: 21, 2: 6 },
        radius: { 0: 0.9, 1: 0.35, 2: 0.5 },
        sections: { 0: 12, 1: 6, 2: 3 },
        segments: { 0: 7, 1: 4, 2: 3 },
        start: { 1: 0.06, 2: 0.2 },
      },
      leaves: { type: 'pine', billboard: 'double', angle: 25, count: 16, start: 0.05, size: 2.6, sizeVariance: 0.3, alphaTest: 0.35 },
    },
  },

  columnarNorwaySpruce: {
    name: 'Columnar Norway spruce',
    latin: 'Picea abies ‘Cupressina’',
    matureHeight: 10,
    matureSpread: 1.8,
    growthRate: 0.35,
    deciduous: false,
    leafColor: 0x264221,
    preset: 'Pine Medium',
    options: {
      seed: 377,
      type: 'evergreen',
      bark: { type: 'pine', tint: 0x7d6f62 },
      branch: {
        levels: 2,
        angle: { 1: 55, 2: 50 },
        children: { 0: 110, 1: 4 },
        gnarliness: { 0: 0.01, 1: 0.1, 2: 0.15 },
        length: { 0: 44, 1: 8, 2: 3 },
        radius: { 0: 0.8, 1: 0.3, 2: 0.5 },
        sections: { 0: 18, 1: 5, 2: 3 },
        segments: { 0: 7, 1: 4, 2: 3 },
        start: { 1: 0.04, 2: 0.2 },
      },
      leaves: { type: 'pine', billboard: 'double', angle: 30, count: 8, start: 0.0, size: 1.9, sizeVariance: 0.3, alphaTest: 0.35 },
    },
  },

  moonglowJuniper: {
    name: 'Moonglow juniper',
    latin: 'Juniperus scopulorum ‘Moonglow’',
    matureHeight: 6,
    matureSpread: 2.6,
    growthRate: 0.3,
    deciduous: false,
    leafColor: 0x66796b, // silvery blue-green
    preset: 'Pine Medium',
    options: {
      seed: 2604,
      type: 'evergreen',
      bark: { type: 'willow', tint: 0x8a6e5a },
      branch: {
        levels: 2,
        angle: { 1: 42, 2: 35 },
        children: { 0: 110, 1: 6 },
        gnarliness: { 0: 0.02, 1: 0.1, 2: 0.2 },
        length: { 0: 40, 1: 14, 2: 4 },
        radius: { 0: 0.9, 1: 0.3, 2: 0.5 },
        sections: { 0: 16, 1: 6, 2: 3 },
        segments: { 0: 7, 1: 4, 2: 3 },
        start: { 1: 0.03, 2: 0.1 },
      },
      leaves: { type: 'pine', billboard: 'double', angle: 25, count: 13, start: 0.0, size: 2.4, sizeVariance: 0.3, alphaTest: 0.35 },
    },
  },
};

/**
 * Canopy state for a day of year: `density` 0–1 (fraction of leaves present)
 * and `fall` 0–1 (how far the colour has turned).
 */
export function canopyState(species, dayOfYear) {
  if (!species.deciduous) return { density: 1, fall: 0 };
  const p = species.phenology;
  const ramp = (a, b) => Math.min(1, Math.max(0, (dayOfYear - a) / (b - a)));
  if (dayOfYear < p.leafOut || dayOfYear >= p.drop + 10) return { density: 0, fall: 0 };
  if (dayOfYear < p.fullLeaf) return { density: 0.15 + 0.85 * ramp(p.leafOut, p.fullLeaf), fall: 0 };
  if (dayOfYear < p.colorStart) return { density: 1, fall: 0 };
  if (dayOfYear < p.drop) return { density: 1 - 0.35 * ramp(p.peak, p.drop), fall: ramp(p.colorStart, p.peak) };
  return { density: 0.65 * (1 - ramp(p.drop, p.drop + 10)), fall: 1 };
}

/** Height (m) after `years` in the ground, from a typical nursery size. */
export function heightAtAge(species, years) {
  const start = Math.min(2.2, species.matureHeight * 0.4);
  const span = species.matureHeight - start;
  // Exponential approach tuned so early growth ≈ growthRate m/yr.
  const k = species.growthRate / span;
  return start + span * (1 - Math.exp(-k * years));
}
