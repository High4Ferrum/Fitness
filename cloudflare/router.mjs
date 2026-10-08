// The small Express-compatible surface used by server/api.mjs, backed by Fetch.
// Middleware order, mounted paths, error handlers and status codes are shared.
export class FetchRouter {
  locals = {};
  stack = [];
  disable() {}
  use(path, handler) {
    if (typeof path === 'function') { handler = path; path = '/'; }
    this.stack.push({ path, handler });
    return this;
  }
  route(method, path, handler) {
    const names = [];
    const pattern = path.split('/').map(part => {
      if (part.startsWith(':')) { names.push(part.slice(1)); return '([^/]+)'; }
      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }).join('/');
    this.stack.push({ method, path, handler, names, pattern: new RegExp(`^${pattern}/?$`, 'i') });
    return this;
  }
  get(path, handler) { return this.route('GET', path, handler); }
  post(path, handler) { return this.route('POST', path, handler); }
  patch(path, handler) { return this.route('PATCH', path, handler); }
  delete(path, handler) { return this.route('DELETE', path, handler); }

  async fetch(request) {
    const url = new URL(request.url);
    const headers = new Headers({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'Cache-Control': 'no-store' });
    let status = 200, result, parsingError;
    const req = {
      path: url.pathname, method: request.method,
      headers: { cookie: request.headers.get('cookie') || '' },
      ip: request.headers.get('x-form-client-ip') || 'unknown',
      secure: url.protocol === 'https:', params: {},
      get(name) { return name.toLowerCase() === 'host' ? url.host : request.headers.get(name); },
      is(type) { return request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() === type; },
    };
    if (!['GET', 'HEAD'].includes(req.method)) {
      const length = Number(request.headers.get('content-length') || 0);
      if (length > 262144) parsingError = { type: 'entity.too.large' };
      else if (req.is('application/json') && request.body) {
        const reader = request.body.getReader();
        const chunks = [];
        let total = 0;
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          total += value.byteLength;
          if (total > 262144) { await reader.cancel(); parsingError = { type: 'entity.too.large' }; break; }
          chunks.push(value);
        }
        if (!parsingError) {
          const bytes = new Uint8Array(total);
          let offset = 0;
          for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
          try { req.body = JSON.parse(new TextDecoder().decode(bytes)); }
          catch { parsingError = { type: 'entity.parse.failed' }; }
        }
      }
    }
    const res = {
      headersSent: false,
      set(name, value) { headers.set(name, value); return this; },
      status(value) { status = value; return this; },
      json(value) { result = value; this.headersSent = true; return this; },
    };
    let error = parsingError;
    for (const layer of this.stack) {
      if (res.headersSent) break;
      if (Boolean(error) !== (layer.handler.length === 4)) continue;
      let match;
      if (layer.method) {
        if (req.method !== layer.method && !(req.method === 'HEAD' && layer.method === 'GET')) continue;
        match = layer.pattern.exec(url.pathname);
        if (!match) continue;
      } else if (layer.path !== '/' && url.pathname !== layer.path && !url.pathname.startsWith(layer.path + '/')) continue;
      req.path = !layer.method && layer.path !== '/' ? url.pathname.slice(layer.path.length) || '/' : url.pathname;
      let advanced = false;
      const next = value => { advanced = true; error = value; };
      try {
        req.params = match ? Object.fromEntries(layer.names.map((name, i) => [name, decodeURIComponent(match[i + 1])])) : {};
        if (error) layer.handler(error, req, res, next);
        else await layer.handler(req, res, next);
      } catch (caught) { error = caught; advanced = true; }
      if (!advanced && !res.headersSent) break;
    }
    if (!res.headersSent) { status = error ? 500 : 404; result = { error: error ? 'Something went wrong. Please try again.' : 'API route was not found.' }; }
    headers.set('Content-Type', 'application/json; charset=utf-8');
    return new Response(req.method === 'HEAD' ? null : JSON.stringify(result), { status, headers });
  }
}
