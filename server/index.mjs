import express from 'express';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createApi } from './api.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function createApp({ databasePath = process.env.FORM_DB_PATH || resolve(root, 'data/form.sqlite'), seed = process.env.FORM_SEED_DEMO !== '0', config = process.env } = {}) {
  if (databasePath !== ':memory:') mkdirSync(dirname(resolve(databasePath)), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  db.transaction = callback => {
    db.exec('BEGIN');
    try { const result = callback(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  };
  const app = express();
  app.use(express.json({ limit: '256kb' }));
  createApi({ app, db, seed, config });
  const dist = resolve(root, 'dist');
  if (existsSync(resolve(dist, 'index.html'))) {
    app.use(express.static(dist));
    app.get('/{*path}', (req, res) => res.sendFile(resolve(dist, 'index.html')));
  }
  return app;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const app = createApp();
  const port = Number(process.env.PORT || 3001);
  const server = app.listen(port, '0.0.0.0', () => console.log(`Train with me API listening on http://0.0.0.0:${port}`));
  const stop = () => server.close(() => { app.locals.db.close(); process.exit(0); });
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
}
