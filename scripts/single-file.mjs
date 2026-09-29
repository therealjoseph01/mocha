// Builds preview.html: the whole site in one file you can double-click (no server needed).
// Production should use `npm run build` (code-split + pre-rendered). This is for quick review.
import { build } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'node_modules/.preview');
await build({
  root, logLevel: 'warn', plugins: [react()],
  build: { outDir: out, emptyOutDir: true, cssCodeSplit: false, modulePreload: false, rollupOptions: { output: { inlineDynamicImports: true } } },
});
await build({ root, logLevel: 'warn', plugins: [react()], build: { ssr: 'src/entry-server.jsx', outDir: path.join(out, 'ssr'), emptyOutDir: true } });
const { render } = await import(pathToFileURL(path.join(out, 'ssr/entry-server.js')).href);
let html = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
const assets = path.join(out, 'assets');
for (const f of fs.readdirSync(assets)) {
  const code = fs.readFileSync(path.join(assets, f), 'utf8');
  if (f.endsWith('.css')) html = html.replace(new RegExp(`<link rel="stylesheet"[^>]*${f}[^>]*>`), () => `<style>${code}</style>`);
  if (f.endsWith('.js')) {
    html = html.replace(new RegExp(`<script type="module"[^>]*${f}[^>]*></script>`), '');
    html = html.replace('</body>', () => `<script type="module">${code.replace(/<\/script/g, '<\\/script')}</script></body>`);
  }
}
html = html.replace('<div id="root"></div>', () => `<div id="root">${render()}</div>`);
fs.writeFileSync(path.join(root, 'preview.html'), html);
console.log('preview.html', (html.length / 1024).toFixed(0), 'KB');
