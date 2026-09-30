import * as THREE from 'three';
import brownD from '../assets/textures/bark_brown_02_diff.jpg';
import brownN from '../assets/textures/bark_brown_02_nor.jpg';
import oakD from '../assets/textures/jolcham_oak_bark_01_diff.jpg';
import oakN from '../assets/textures/jolcham_oak_bark_01_nor.jpg';
import hackD from '../assets/textures/chinese_hackberry_bark_diff.jpg';
import hackN from '../assets/textures/chinese_hackberry_bark_nor.jpg';
import willowD from '../assets/textures/bark_willow_diff.jpg';
import willowN from '../assets/textures/bark_willow_nor.jpg';
import plateD from '../assets/textures/bark_platanus_diff.jpg';
import plateN from '../assets/textures/bark_platanus_nor.jpg';
import cedarD from '../assets/textures/japanese_cedar_bark_diff.jpg';
import cedarN from '../assets/textures/japanese_cedar_bark_nor.jpg';

/*
 * Bark per species. Scanned CC0 bark from Poly Haven (polyhaven.com) where a
 * close match exists, tinted toward the species' colour; birches, whose
 * chalky white bark with dark lenticels has no scan, are painted.
 *
 *   maple, linden, elm, poplar, locust, alder  bark_brown_02 (grey, furrowed)
 *   oaks                                     jolcham_oak_bark_01 (ridged, mossy)
 *   hackberry, aspen                         chinese_hackberry_bark (smooth, warty)
 *   willow, hydrangea                        bark_willow (dark, fissured)
 *   spruce, pine                             bark_platanus (scaly plates)
 *   arborvitae, juniper                      japanese_cedar_bark (fibrous strips)
 */

const loader = new THREE.TextureLoader();
const cache = new Map();
function load(url, srgb) {
  const k = url + srgb;
  if (cache.has(k)) return cache.get(k);
  const t = loader.load(url);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  cache.set(k, t);
  return t;
}
const SCANS = {
  brown: [brownD, brownN, 2.4],
  oak: [oakD, oakN, 2.6],
  hack: [hackD, hackN, 2.2],
  willow: [willowD, willowN, 2.4],
  plate: [plateD, plateN, 2.0],
  cedar: [cedarD, cedarN, 2.2],
};
const BY_KIND = {
  maple: ['brown', 0xc8c2b6], linden: ['brown', 0xb8b2a8], elm: ['brown', 0xb0a898], poplar: ['brown', 0xc4c0b4],
  locust: ['brown', 0x8a7a6c], alder: ['willow', 0xa8a498], oak: ['oak', 0xbab0a2], hackberry: ['hack', 0xd8d2c8],
  aspen: ['hack', 0xf0f2e2], willow: ['willow', 0xb8a890], hydrangea: ['willow', 0xc0a888], crabapple: ['brown', 0x9a8878],
  spruce: ['plate', 0x9a8878], pine: ['plate', 0xc89a78], cedar: ['cedar', 0xc8a898],
  brown: ['brown', 0xb0a698], smooth: ['brown', 0xd8d6d0], cherry: ['brown', 0x9a6450], ash: ['oak', 0xc4bcb0],
  ginkgo: ['oak', 0xb4a894], fir: ['brown', 0xc0beba], whitepine: ['plate', 0x8a847c], scotch: ['plate', 0xe89a62],
  larch: ['plate', 0xb08a72],
};

export function barkMaps(kind) {
  if (kind === 'birch' || kind === 'riverbirch') return paintedBirch(kind);
  const b = BY_KIND[kind];
  if (!b) return null;
  const [d, n, size] = SCANS[b[0]];
  return { map: load(d, true), normalMap: load(n, false), texSize: size, tint: b[1], color: new THREE.Color(b[1]), tinted: false };
}

/* Birch: chalk-white with dark horizontal lenticels and black patches where
   limbs meet. River birch: salmon to cinnamon, peeling in curls. */
const painted = {};
function paintedBirch(kind) {
  if (painted[kind]) return painted[kind];
  const N = 512;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  let s = kind.length * 977;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  if (kind === 'birch') {
    g.fillStyle = '#ebe7de';
    g.fillRect(0, 0, N, N);
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `rgba(${200 + r() * 40},${196 + r() * 40},${186 + r() * 40},.5)`;
      g.fillRect(r() * N, r() * N, 20 + r() * 80, 2 + r() * 6);
    }
    for (let i = 0; i < 140; i++) {
      g.fillStyle = `rgba(40,34,30,${0.35 + r() * 0.5})`;
      const x = r() * N;
      const y = r() * N;
      g.fillRect(x, y, 6 + r() * 28, 1 + r() * 2.5);
    }
    for (let i = 0; i < 9; i++) {
      g.fillStyle = 'rgba(30,26,24,.85)';
      g.beginPath();
      const x = r() * N;
      const y = r() * N;
      g.moveTo(x, y);
      g.quadraticCurveTo(x + 30, y + 10 + r() * 20, x + 60 + r() * 40, y);
      g.quadraticCurveTo(x + 30, y + 6, x, y);
      g.fill();
    }
  } else {
    g.fillStyle = '#b07a5a';
    g.fillRect(0, 0, N, N);
    for (let i = 0; i < 420; i++) {
      const L = 50 + r() * 60;
      g.fillStyle = `hsl(${18 + r() * 14}, ${38 + r() * 20}%, ${48 + r() * 24}%)`;
      g.beginPath();
      const x = r() * N;
      const y = r() * N;
      g.moveTo(x, y);
      g.bezierCurveTo(x + L * 0.3, y - 4 - r() * 6, x + L * 0.7, y - 4 - r() * 6, x + L, y);
      g.bezierCurveTo(x + L * 0.7, y + 4, x + L * 0.3, y + 4, x, y);
      g.fill();
      g.strokeStyle = 'rgba(60,30,20,.35)';
      g.lineWidth = 1;
      g.stroke();
    }
  }
  const map = new THREE.CanvasTexture(c);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  painted[kind] = { map, texSize: 1.6, tinted: true };
  return painted[kind];
}
