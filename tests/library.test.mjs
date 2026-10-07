import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createApp } from '../server/index.mjs';
import { exerciseAdditions } from '../server/exercise-additions.mjs';
import { starterExerciseDefinitions } from '../server/starter-exercise-definitions.mjs';

test('catalog upgrades fill a 19-exercise workspace while preserving custom entries, edits, archives and workouts', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'train-library-upgrade-'));
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + '\\') || resolve(directory).startsWith(resolve(tmpdir()) + '/'));
  const databasePath = join(directory, 'library.sqlite');
  let app = createApp({ databasePath });
  t.after(async () => { app.locals.db.close(); await rm(directory, { recursive: true, force: true }); });
  const db = app.locals.db;
  for (const [key] of exerciseAdditions) db.prepare('DELETE FROM exercises WHERE id=?').run(`ex-${key}`);
  for (const [key] of starterExerciseDefinitions) {
    if (key.startsWith('starter-')) db.prepare('DELETE FROM exercises WHERE id=?').run(`ex-${key}`);
  }
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM exercises').get().count, 19);
  const bench = JSON.parse(db.prepare('SELECT json FROM exercises WHERE id=?').get('ex-bench').json);
  bench.cues = 'Owner-edited coaching cue';
  db.prepare('UPDATE exercises SET json=? WHERE id=?').run(JSON.stringify(bench), bench.id);
  const row = JSON.parse(db.prepare('SELECT json FROM exercises WHERE id=?').get('ex-row').json);
  row.archived = true;
  db.prepare('UPDATE exercises SET json=? WHERE id=?').run(JSON.stringify(row), row.id);
  const custom = { ...bench, id: 'ex-custom-front-raise', name: '  DUMBBELL FRONT RAISE  ', alternatives: [], cues: 'My custom entry' };
  db.prepare('INSERT INTO exercises(id,json) VALUES (?,?)').run(custom.id, JSON.stringify(custom));
  const plans = db.prepare('SELECT * FROM plans ORDER BY id').all();
  const users = db.prepare('SELECT * FROM users ORDER BY id').all();
  db.close();
  app = createApp({ databasePath });
  const updated = app.locals.db;
  const entries = updated.prepare('SELECT json FROM exercises').all().map(item => JSON.parse(item.json));
  assert.equal(entries.length, 353);
  assert.deepEqual(entries.find(item => item.id === bench.id), bench);
  assert.deepEqual(entries.find(item => item.id === row.id), row);
  assert.deepEqual(entries.find(item => item.id === custom.id), custom);
  assert.equal(entries.some(item => item.id === 'ex-db-front-raise'), false);
  assert.ok(entries.find(item => item.id === 'ex-barbell-front-raise').alternatives.includes(custom.id));
  assert.ok(!entries.find(item => item.id === 'ex-cable-row').alternatives.includes(row.id));
  assert.deepEqual(updated.prepare('SELECT * FROM plans ORDER BY id').all(), plans);
  assert.deepEqual(updated.prepare('SELECT * FROM users ORDER BY id').all(), users);
});
