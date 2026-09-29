// Injects server-rendered HTML into dist/index.html so crawlers (and no-JS visitors)
// get the full story copy, headings and CTAs without executing the canvas engine.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { render } = await import(pathToFileURL(path.join(root, 'dist-ssr/entry-server.js')).href);
const file = path.join(root, 'dist/index.html');
const html = fs.readFileSync(file, 'utf8');
const out = html.replace('<div id="root"></div>', `<div id="root">${render()}</div>`);
if (out === html) throw new Error('root placeholder not found');
fs.writeFileSync(file, out);
try {
  fs.rmSync(path.join(root, 'dist-ssr'), { recursive: true, force: true });
} catch {}
console.log('prerendered', (out.length / 1024).toFixed(1), 'KB');
