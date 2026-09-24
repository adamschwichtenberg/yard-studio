// Downloads high-resolution CC0 HDRIs from Poly Haven into public/hdri so the
// app doesn't depend on the Poly Haven CDN at runtime.
//   npm run fetch-assets            → 4k partly-cloudy sky (default)
//   npm run fetch-assets -- 2k      → smaller download
import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

const res = process.argv[2] || '4k';
const assets = ['kloofendal_48d_partly_cloudy_puresky'];
const outDir = new URL('../public/hdri/', import.meta.url);
mkdirSync(outDir, { recursive: true });

for (const name of assets) {
  const file = `${name}_${res}.hdr`;
  const dest = new URL(file, outDir);
  if (existsSync(dest)) {
    console.log(`✓ ${file} already present`);
    continue;
  }
  const url = `https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/${res}/${file}`;
  console.log(`↓ ${url}`);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} for ${url}`);
  await pipeline(Readable.fromWeb(r.body), createWriteStream(dest));
  console.log(`✓ saved public/hdri/${file}`);
}

if (res !== '4k') {
  console.log('\nNote: src/scene/environment.js looks for the 4k file first; update HDRI_SOURCES to use this resolution.');
}
