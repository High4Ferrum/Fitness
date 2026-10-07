import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { seedExerciseLibrary } from '../server/seed.mjs';
import { starterExercises } from '../server/starter-exercises.mjs';
import { starterExerciseDefinitions } from '../server/starter-exercise-definitions.mjs';

test('spreadsheet catalog is complete, deduplicated and safe to seed repeatedly', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE exercises(id TEXT PRIMARY KEY,json TEXT)');
    assert.equal(starterExercises.length, 350);
    assert.equal(new Set(starterExercises.map(row => row.exercise_id)).size, 350);
    seedExerciseLibrary(db);
    const read = () => db.prepare('SELECT json FROM exercises ORDER BY id').all().map(row => JSON.parse(row.json));
    const exercises = read();
    assert.equal(exercises.length, 353);
    assert.equal(new Set(exercises.map(exercise => exercise.name.toLowerCase())).size, 353);
    for (const [key, name] of starterExerciseDefinitions) {
      assert.ok(exercises.some(exercise => exercise.id === `ex-${key}` || exercise.name.toLowerCase() === name.toLowerCase()), name);
    }
    const byName = name => exercises.find(exercise => exercise.name.toLowerCase() === name.toLowerCase());
    assert.deepEqual(byName('Barbell Romanian deadlift').equipment, ['Barbell']);
    assert.deepEqual(byName('Romanian deadlift').equipment, ['Dumbbells']);
    assert.deepEqual(byName('Knee Push-Up').equipment, []);
    assert.deepEqual(byName('Incline Barbell Bench Press').equipment, ['Barbell', 'Bench']);
    assert.equal(byName('Cable Crunch').category, 'Core');
    assert.equal(byName('Treadmill Run').category, 'Cardio');
    assert.equal(byName('Cat-Cow').category, 'Mobility');
    assert.equal(byName('Barbell bench press').instructions.startsWith('Lie on a bench'), true);
    const edited = { ...byName('Barbell Romanian deadlift'), archived: true, cues: 'Owner cue' };
    db.prepare('UPDATE exercises SET json=? WHERE id=?').run(JSON.stringify(edited), edited.id);
    seedExerciseLibrary(db);
    assert.equal(read().length, 353);
    assert.deepEqual(read().find(exercise => exercise.id === edited.id), edited);
    for (const exercise of read()) {
      assert.ok(['Beginner', 'Intermediate', 'Advanced'].includes(exercise.difficulty));
      assert.ok(Array.isArray(exercise.equipment));
      assert.ok(new URL(exercise.videoUrl).protocol === 'https:');
      assert.ok(exercise.alternatives.every(id => exercises.some(candidate => candidate.id === id)));
    }
  } finally { db.close(); }
});

test('an existing custom spreadsheet movement is retained by normalized name', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE exercises(id TEXT PRIMARY KEY,json TEXT)');
    const custom = { id: 'custom-knee', name: '  KNEE PUSH-UP  ', archived: true, cues: 'Preserve me' };
    db.prepare('INSERT INTO exercises VALUES (?,?)').run(custom.id, JSON.stringify(custom));
    seedExerciseLibrary(db);
    assert.equal(db.prepare('SELECT COUNT(*) count FROM exercises').get().count, 353);
    assert.deepEqual(JSON.parse(db.prepare('SELECT json FROM exercises WHERE id=?').get(custom.id).json), custom);
    assert.equal(db.prepare('SELECT json FROM exercises WHERE id=?').get('ex-starter-ex0014'), undefined);
  } finally { db.close(); }
});
