import { DurableObject } from 'cloudflare:workers';
import { createApi } from '../server/api.mjs';
import { durableDatabase } from './sql.mjs';
import { FetchRouter } from './router.mjs';

export class FormDatabase extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.app = createApi({
      app: new FetchRouter(), db: durableDatabase(ctx.storage),
      seed: env.FORM_SEED_DEMO === '1', config: env,
    });
  }
  fetch(request) { return this.app.fetch(request); }
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === '/api' || path.startsWith('/api/')) {
      const headers = new Headers(request.headers);
      // Replace the caller's header with the IP supplied by Cloudflare.
      headers.set('x-form-client-ip', request.headers.get('CF-Connecting-IP') || 'local');
      return env.FORM_DB.getByName('form-database-v1').fetch(new Request(request, { headers }));
    }
    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    return new Response(response.body, { status: response.status, headers });
  },
};
