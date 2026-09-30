// Builds yard-shade-studio.html: the whole app in one file (scripts, styles,
// textures and the bundled sky HDRI inlined) that runs when opened straight
// from disk, e.g. from a downloaded ZIP. Run with `npm run build:standalone`.
import { build } from 'vite';
import { readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'node_modules', '.standalone');

await build({ root, base: './', logLevel: 'warn', build: { outDir: out, emptyOutDir: true, copyPublicDir: false, chunkSizeWarningLimit: 20000, assetsInlineLimit: 100_000_000 } });

const assets = readdirSync(join(out, 'assets'));
const css = assets.filter((f) => f.endsWith('.css')).map((f) => readFileSync(join(out, 'assets', f), 'utf8')).join('\n');
const jsFiles = assets.filter((f) => f.endsWith('.js'));
if (jsFiles.length !== 1) throw new Error(`expected one JS chunk, got ${jsFiles.join(', ')}`);
// A literal "</script" would end the inline tag early.
const js = readFileSync(join(out, 'assets', jsFiles[0]), 'utf8').replace(/<\/script/gi, '<\\/script');
const hdri = readFileSync(join(root, 'public', 'hdri', 'quarry_01_1k.hdr')).toString('base64');

let html = readFileSync(join(out, 'index.html'), 'utf8');
html = html.replace(/<link rel="stylesheet"[^>]*>/, () => `<style>\n${css}\n</style>`);
html = html.replace(/<script type="module"[^>]*><\/script>/, '');
html = html.replace(
  '</body>',
  () => `<script>window.__YARD_HDRI_B64 = "${hdri}";</script>\n<script type="module">\n${js}\n</script>\n</body>`,
);
writeFileSync(join(root, 'yard-shade-studio.html'), html);
rmSync(out, { recursive: true, force: true });
console.log(`yard-shade-studio.html  ${(html.length / 1048576).toFixed(1)} MB`);
