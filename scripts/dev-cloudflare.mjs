import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const dist = resolve('dist');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml' };
const port = Number(process.env.PORT || 8787);
const state = process.env.FORM_PREVIEW_STATE || '.wrangler/state/form-local';
await mkdir(state, { recursive: true });
const worker = new Miniflare(convertV4MiniflareOptions({
  name: 'form-local', host: '127.0.0.1', port, modules: true,
  scriptPath: '.worker-build/worker.js',
  compatibilityDate: '2026-10-04', compatibilityFlags: ['nodejs_compat'],
  resourcePersistencePath: state,
  durableObjects: { FORM_DB: { className: 'FormDatabase', useSQLite: true } },
  bindings: { FORM_SEED_DEMO: process.env.FORM_SEED_DEMO || '1', FORM_COOKIE_SECURE: '0', ...(process.env.TRAIN_SETUP_TOKEN ? { TRAIN_SETUP_TOKEN: process.env.TRAIN_SETUP_TOKEN } : {}) },
  serviceBindings: { ASSETS: async request => {
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405 });
    let path;
    try { path = resolve(dist, '.' + decodeURIComponent(new URL(request.url).pathname)); }
    catch { return new Response('Bad path', { status: 400 }); }
    if (path !== dist && !path.startsWith(dist + sep)) return new Response('Forbidden', { status: 403 });
    try { if (!(await stat(path)).isFile()) path = resolve(dist, 'index.html'); }
    catch { path = resolve(dist, 'index.html'); }
    return new Response(request.method === 'HEAD' ? null : await readFile(path), { headers: { 'Content-Type': mime[extname(path)] || 'application/octet-stream' } });
  } },
}));
console.log(`Train with me local app: ${await worker.ready}`);
const stop = async () => { await worker.dispose(); process.exit(0); };
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
