# FORM local continuation checkpoint

The existing app from the original cloud handoff has been continued without rebuilding its interface or removing the admin/coach/client features.

## Preview

- Local Cloudflare runtime: run `npm ci` and `npm run dev:cloudflare`, then open http://127.0.0.1:8787.
- Original Express/Vite development: run `npm run dev`, then open http://localhost:5173.
- Public Cloudflare preview: https://form-fitness-preview.highferrum.workers.dev
- Destination repository: https://github.com/High4Ferrum/Fitness

Use the role buttons on the login screen for the public demo. The sample workspace is persistent; restarting or redeploying does not reset it.

## Implementation

The shared API is in `server/api.mjs`. Express uses Node's local SQLite implementation; Cloudflare uses synchronous SQL in a SQLite-backed Durable Object. Database transactions use each runtime's native transaction facility. Password hashes, cookie sessions, validation, role permissions, scheduling conflicts and historical workout protections remain shared.

`wrangler.jsonc` includes frontend assets, the database binding and SQLite class migration. The preview environment seeds sample data; production disables demo seeding and expects bootstrap admin secrets. The deployment uses Cloudflare's `workers.dev` URL and does not modify custom domains.

## Verified

- Frontend TypeScript/Vite production build.
- 17 original Express API contracts.
- 17 Cloudflare runtime API contracts, including persistence across a runtime restart.
- Five Cloudflare browser workflows, including mobile layouts.
- Live sign-in for admin, coach and client; admin exercise create/edit; coach workout assignment; client completion; persisted results after reload.

The browser configuration supports installed Chrome on Windows/macOS and bundled Chromium on Linux. All automated local tests use isolated sample databases. The live smoke test preserves demo passwords and leaves a uniquely named completed sample workout as evidence.

## Credentials

Keep credentials out of source and chat. Local Wrangler authorization is stored outside this source folder. See README.md for standard Wrangler deployment and the documented direct-upload alternative for restricted Windows environments.

Original cloud source commit: dd132a8a2b591225e6cd7fa434c1602da40ba09e.
