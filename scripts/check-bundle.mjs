import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = path.join(root, 'dist', 'index.html');
if (!fs.existsSync(htmlPath)) throw new Error('Build output is missing dist/index.html; run npm run build first.');

const html = fs.readFileSync(htmlPath, 'utf8');
const mainEntry = html.match(/<script\b(?=[^>]*\btype=["']module["'])[^>]*\bsrc=["']([^"']+)["']/i)?.[1];
if (!mainEntry) throw new Error('Could not locate the main entry script in dist/index.html.');

const entryPath = path.resolve(path.dirname(htmlPath), mainEntry.replace(/^\//, ''));
if (!fs.existsSync(entryPath)) throw new Error(`Main entry chunk is missing: ${entryPath}`);
const source = fs.readFileSync(entryPath, 'utf8');
if (source.includes('WebGLRenderer')) {
  throw new Error(`WebGLRenderer leaked into the main app entry chunk: ${path.relative(root, entryPath)}`);
}

console.log(`Main app entry is WebGL-free: ${path.relative(root, entryPath)}`);
