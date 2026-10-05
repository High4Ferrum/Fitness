// Cloudflare's documented direct-upload API, for restricted build environments.
// Credentials are read from environment or an explicitly supplied Wrangler file.
import { readFile, readdir } from 'node:fs/promises';
import { resolve, relative, extname } from 'node:path';
import { createHash } from 'node:crypto';

const account = process.env.CLOUDFLARE_ACCOUNT_ID;
if (!account || !/^[a-f0-9]{32}$/.test(account)) throw new Error('Set CLOUDFLARE_ACCOUNT_ID.');
let credential = process.env.CLOUDFLARE_API_TOKEN;
if (!credential && process.env.FORM_WRANGLER_AUTH_FILE) {
  const auth = await readFile(process.env.FORM_WRANGLER_AUTH_FILE, 'utf8');
  credential = auth.match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];
}
if (!credential) throw new Error('Use CLOUDFLARE_API_TOKEN or FORM_WRANGLER_AUTH_FILE; never commit credentials.');
const base = `https://api.cloudflare.com/client/v4/accounts/${account}`;
async function api(path, { method = 'GET', json, form, token = credential } = {}) {
  const response = await fetch(`${base}${path}`, {
    method, headers: { Authorization: `Bearer ${token}`, ...(json ? { 'Content-Type': 'application/json' } : {}) },
    body: json ? JSON.stringify(json) : form,
  });
  const payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(`Cloudflare ${response.status}: ${payload.errors?.map(error => error.message).join('; ') || 'Request failed'}`);
  return payload.result;
}
const production = process.argv.includes('--production');
const name = production ? 'train-with-me' : 'form-fitness-preview';
const secrets = production && process.env.FORM_PRODUCTION_SECRET_FILE ? JSON.parse(await readFile(process.env.FORM_PRODUCTION_SECRET_FILE, 'utf8')) : {};
if (Object.keys(secrets).some(key => key !== 'TRAIN_SETUP_TOKEN') || (secrets.TRAIN_SETUP_TOKEN && !/^[a-f0-9]{64}$/.test(secrets.TRAIN_SETUP_TOKEN))) throw new Error('Invalid production setup secret.');
const scripts = await api('/workers/scripts');
const previous = scripts.find(script => script.id === name);
if (production && !previous && !secrets.TRAIN_SETUP_TOKEN) throw new Error('Supply FORM_PRODUCTION_SECRET_FILE with a random 64-character hexadecimal TRAIN_SETUP_TOKEN for the first production deployment.');
if (previous?.migration_tag && previous.migration_tag !== 'v1') throw new Error('Unexpected database migration tag. Review before deployment.');
if (production && previous) {
  const settings = await api(`/workers/scripts/${name}/settings`);
  if (!settings.bindings.some(binding => binding.name === 'FORM_DB' && binding.class_name === 'FormDatabase')) throw new Error('An unrelated Worker uses this name. Choose a different app name before deploying.');
}
const subdomain = (await api('/workers/subdomain')).subdomain;
const dist = resolve('dist');
const manifest = {}, files = new Map();
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml' };
async function collect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) await collect(path);
    else {
      const bytes = await readFile(path);
      const hash = createHash('sha256').update(bytes.toString('base64') + extname(path).slice(1)).digest('hex').slice(0, 32);
      manifest['/' + relative(dist, path).replaceAll('\\', '/')] = { hash, size: bytes.length };
      files.set(hash, { bytes, type: mime[extname(path)] || 'application/octet-stream' });
    }
  }
}
await collect(dist);
const session = await api(`/workers/scripts/${name}/assets-upload-session`, { method: 'POST', json: { manifest } });
let completion = session.buckets.length ? undefined : session.jwt;
for (const bucket of session.buckets) {
  const form = new FormData();
  for (const hash of bucket) {
    const file = files.get(hash);
    form.append(hash, new Blob([file.bytes.toString('base64')], { type: file.type }), hash);
  }
  const uploaded = await api('/workers/assets/upload?base64=true', { method: 'POST', form, token: session.jwt });
  if (uploaded.jwt) completion = uploaded.jwt;
}
if (!completion) throw new Error('Cloudflare did not confirm the complete asset upload.');
const metadata = {
  main_module: 'worker.js', compatibility_date: '2026-10-04', compatibility_flags: ['nodejs_compat'],
  bindings: [
    { name: 'ASSETS', type: 'assets' },
    { name: 'FORM_DB', type: 'durable_object_namespace', class_name: 'FormDatabase' },
    { name: 'FORM_SEED_DEMO', type: 'plain_text', text: production ? '0' : '1' },
    { name: 'FORM_COOKIE_SECURE', type: 'plain_text', text: '1' },
    ...Object.entries(secrets).map(([name, text]) => ({ name, type: 'secret_text', text })),
  ],
  assets: { jwt: completion, config: { not_found_handling: 'single-page-application', run_worker_first: true } },
  observability: { enabled: true },
  keep_bindings: ['secret_text'],
  ...(!previous?.migration_tag ? { migrations: { new_tag: 'v1', steps: [{ new_sqlite_classes: ['FormDatabase'] }] } } : {}),
};
const form = new FormData();
form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }), 'metadata.json');
form.append('worker.js', new Blob([await readFile('.worker-build/worker.js')], { type: 'application/javascript+module' }), 'worker.js');
const uploaded = await api(`/workers/scripts/${name}`, { method: 'PUT', form });
await api(`/workers/scripts/${name}/subdomain`, { method: 'POST', json: { enabled: true } });
console.log(JSON.stringify({ worker: name, version: uploaded.id || uploaded.etag, url: `https://${name}.${subdomain}.workers.dev` }));
