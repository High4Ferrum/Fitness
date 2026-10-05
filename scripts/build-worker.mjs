import { rollup } from 'rollup';
const bundle = await rollup({ input: 'cloudflare/worker.mjs', external: ['cloudflare:workers', 'node:crypto'] });
try { await bundle.write({ file: '.worker-build/worker.js', format: 'es', sourcemap: true }); }
finally { await bundle.close(); }
