import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/index.mjs';

const demoPassword = 'FormDemo123!';
const day = (offset = 0) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
};
const planPayload = (clientId = 'client-jamie') => ({
  clientId, name: 'Progressive strength', date: day(),
  items: [{ exerciseId: 'ex-bench', sets: 3, reps: 8, weight: 40, rest: 90, notes: 'Controlled repetitions' }],
  notes: 'Build strength steadily',
});
const sessionPayload = (overrides = {}) => ({
  clientId: 'client-jamie', date: day(14), time: '09:00', duration: 60,
  type: 'Online', location: 'https://meet.google.com/abc-defg-hij', notes: 'Technique check-in', ...overrides,
});
const exercisePayload = (overrides = {}) => ({
  name: 'Cable chest press', category: 'Strength', muscles: 'Chest · Triceps',
  equipment: ['Cable machine'], difficulty: 'Intermediate', instructions: 'Press forward with control.',
  cues: 'Keep your torso steady.', videoUrl: 'https://www.youtube.com/watch?v=example',
  alternatives: ['ex-pushup'], ...overrides,
});

async function fixture(t, { seed = true, config = {} } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'form-api-test-'));
  const databasePath = join(directory, 'test.sqlite');
  let app;
  let server;
  let base;
  let worker;
  let send = fetch;
  const start = async () => {
    if (process.env.FORM_TEST_RUNTIME === 'cloudflare') {
      const { Miniflare, convertV4MiniflareOptions } = await import('miniflare');
      worker = new Miniflare(convertV4MiniflareOptions({
        name: 'form-api-test',
        modules: true, scriptPath: '.worker-build/worker.js',
        compatibilityDate: '2026-10-04', compatibilityFlags: ['nodejs_compat'],
        durableObjects: { FORM_DB: { className: 'FormDatabase', useSQLite: true } },
        resourcePersistencePath: join(directory, 'durable-objects'),
        bindings: { FORM_SEED_DEMO: seed ? '1' : '0', FORM_COOKIE_SECURE: '0', ...config },
      }));
      await worker.ready;
      base = 'http://localhost';
      send = (url, init) => worker.dispatchFetch(url, init);
      return;
    }
    app = createApp({ databasePath, seed, config });
    server = await new Promise(resolve => {
      const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    });
    base = `http://127.0.0.1:${server.address().port}`;
  };
  const stop = async () => {
    if (worker) { await worker.dispose(); worker = undefined; return; }
    if (!server) return;
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    app.locals.db.close();
    server = undefined;
  };
  await start();
  t.after(async () => { await stop(); await rm(directory, { recursive: true, force: true }); });
  const request = async (path, { method = 'GET', cookie, body, headers = {}, rawBody } = {}) => {
    const response = await send(`${base}/api${path}`, {
      method,
      headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      ...(rawBody !== undefined ? { body: rawBody } : {}),
    });
    return { status: response.status, body: await response.json(), headers: response.headers };
  };
  const login = async (email, password = demoPassword) => {
    const result = await request('/auth/login', { method: 'POST', body: { email, password } });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    const setCookie = result.headers.get('set-cookie');
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /SameSite=Lax/);
    return { user: result.body.user, cookie: setCookie.split(';')[0] };
  };
  const bootstrap = async (cookie) => {
    const result = await request('/bootstrap', { cookie });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    return result.body;
  };
  return { request, login, bootstrap, restart: async () => { await stop(); await start(); } };
}

function status(result, expected) {
  assert.equal(result.status, expected, JSON.stringify(result.body));
  if (expected >= 400) assert.equal(typeof result.body.error, 'string');
  return result.body;
}

test('authentication protects client records, signs in all roles, and invalidates logout sessions', async t => {
  const f = await fixture(t);
  status(await f.request('/health'), 200);
  status(await f.request('/bootstrap'), 401);
  status(await f.request('/auth/login', { method: 'POST', body: { email: 'admin@form.fit', password: 'WrongPassword!' } }), 401);
  for (const [email, role] of [['admin@form.fit', 'admin'], ['coach@form.fit', 'coach'], ['jamie@form.fit', 'client']]) {
    const account = await f.login(email);
    assert.equal(account.user.role, role);
    const me = status(await f.request('/auth/me', { cookie: account.cookie }), 200);
    assert.equal(me.user.id, account.user.id);
    assert.equal('password_hash' in me.user, false);
    const data = await f.bootstrap(account.cookie);
    assert.ok(data.users.every(user => !('password_hash' in user) && !('password' in user)));
    const result = await f.request('/auth/logout', { method: 'POST', cookie: account.cookie });
    status(result, 200);
    assert.match(result.headers.get('set-cookie'), /Max-Age=0/);
    status(await f.request('/bootstrap', { cookie: account.cookie }), 401);
  }
});

test('bootstrap limits clients to their own plans, sessions, measurements, logs, and assessments', async t => {
  const f = await fixture(t);
  const client = await f.login('jamie@form.fit');
  const data = await f.bootstrap(client.cookie);
  assert.deepEqual(data.clients.map(c => c.id), ['client-jamie']);
  for (const key of ['plans', 'sessions', 'measurements', 'logs', 'assessments']) {
    assert.ok(data[key].length > 0, `${key} should include Jamie's seeded records`);
    assert.ok(data[key].every(record => record.clientId === 'client-jamie'), `${key} leaked another client`);
  }
  assert.equal(data.users.some(user => user.email === 'maya@form.fit'), false);
  const coach = await f.login('coach@form.fit');
  assert.equal((await f.bootstrap(coach.cookie)).clients.length, 4);
  const admin = await f.login('admin@form.fit');
  assert.equal((await f.bootstrap(admin.cookie)).users.length, 6);
});

test('only admins manage exercise instructions, equipment, links, and alternatives', async t => {
  const f = await fixture(t);
  const admin = await f.login('admin@form.fit');
  const exercise = status(await f.request('/exercises', { method: 'POST', cookie: admin.cookie, body: exercisePayload() }), 201);
  assert.deepEqual(exercise.equipment, ['Cable machine']);
  assert.deepEqual(exercise.alternatives, ['ex-pushup']);
  const updated = status(await f.request(`/exercises/${exercise.id}`, { method: 'PATCH', cookie: admin.cookie, body: { equipment: ['Cable machine', 'Bench'], cues: 'New coaching cue' } }), 200);
  assert.equal(updated.cues, 'New coaching cue');
  assert.deepEqual(updated.equipment, ['Cable machine', 'Bench']);
  for (const email of ['coach@form.fit', 'jamie@form.fit']) {
    const account = await f.login(email);
    status(await f.request('/exercises', { method: 'POST', cookie: account.cookie, body: exercisePayload() }), 403);
    status(await f.request(`/exercises/${exercise.id}`, { method: 'PATCH', cookie: account.cookie, body: { name: 'Unauthorized change' } }), 403);
    status(await f.request(`/exercises/${exercise.id}`, { method: 'DELETE', cookie: account.cookie }), 403);
  }
  for (const changes of [
    { videoUrl: 'javascript:alert(1)' },
    { videoUrl: 'http://www.youtube.com/watch?v=example' },
    { alternatives: ['missing-exercise'] },
    { alternatives: [exercise.id] },
    { equipment: ['Bench', 'Bench'] },
    { archived: 'true' },
  ]) status(await f.request(`/exercises/${exercise.id}`, { method: 'PATCH', cookie: admin.cookie, body: changes }), 400);
});

test('archiving exercises preserves prescribed workouts and past performance, and removes active alternatives', async t => {
  const f = await fixture(t);
  const admin = await f.login('admin@form.fit');
  const coach = await f.login('coach@form.fit');
  const before = await f.bootstrap(admin.cookie);
  const benchLogs = before.logs.filter(log => log.items.some(item => item.exerciseId === 'ex-bench'));
  assert.ok(benchLogs.length > 0);
  status(await f.request('/exercises/ex-bench', { method: 'DELETE', cookie: admin.cookie }), 200);
  const data = await f.bootstrap(admin.cookie);
  assert.equal(data.exercises.find(exercise => exercise.id === 'ex-bench').archived, true);
  assert.deepEqual(data.logs.filter(log => log.items.some(item => item.exerciseId === 'ex-bench')), benchLogs);
  assert.deepEqual(data.plans, before.plans);
  assert.ok(data.exercises.every(exercise => !exercise.alternatives.includes('ex-bench')));
  status(await f.request('/plans', { method: 'POST', cookie: coach.cookie, body: planPayload() }), 400);
});

test('coaches create client accounts and update the matching login email without exposing passwords', async t => {
  const f = await fixture(t);
  const coach = await f.login('coach@form.fit');
  const client = status(await f.request('/clients', { method: 'POST', cookie: coach.cookie, body: {
    name: 'Taylor Test', email: 'taylor@example.com', password: 'ClientPassword123!',
    goal: 'Build strength', equipment: ['Dumbbells'],
  } }), 201);
  assert.equal(client.coachId, coach.user.id);
  assert.equal('password' in client, false);
  const account = await f.login('taylor@example.com', 'ClientPassword123!');
  assert.equal(account.user.clientId, client.id);
  const changed = status(await f.request(`/clients/${client.id}`, { method: 'PATCH', cookie: coach.cookie, body: { email: 'taylor.updated@example.com', name: 'Taylor Updated' } }), 200);
  assert.equal(changed.email, 'taylor.updated@example.com');
  status(await f.request('/auth/login', { method: 'POST', body: { email: 'taylor@example.com', password: 'ClientPassword123!' } }), 401);
  const updatedLogin = await f.login('taylor.updated@example.com', 'ClientPassword123!');
  assert.equal(updatedLogin.user.name, 'Taylor Updated');
  status(await f.request('/clients', { method: 'POST', cookie: coach.cookie, body: { name: 'Duplicate', email: 'taylor.updated@example.com', password: 'ClientPassword123!' } }), 409);
  status(await f.request('/clients', { method: 'POST', cookie: coach.cookie, body: { name: 'Reassigned', email: 'other@example.com', password: 'ClientPassword123!', coachId: 'user-admin' } }), 403);
});

test('clients update only their own equipment and cannot write schedules, plans, other client data, or assessments', async t => {
  const f = await fixture(t);
  const client = await f.login('jamie@form.fit');
  status(await f.request('/clients/client-jamie', { method: 'PATCH', cookie: client.cookie, body: { equipment: ['Dumbbells'] } }), 200);
  assert.deepEqual((await f.bootstrap(client.cookie)).clients[0].equipment, ['Dumbbells']);
  status(await f.request('/clients/client-jamie', { method: 'PATCH', cookie: client.cookie, body: { coachId: 'user-admin' } }), 400);
  status(await f.request('/clients/client-maya', { method: 'PATCH', cookie: client.cookie, body: { equipment: [] } }), 403);
  for (const [path, body] of [
    ['/plans', planPayload()],
    ['/sessions', sessionPayload()],
    ['/clients', { name: 'Other', email: 'other@example.com', password: 'ClientPassword123!' }],
    ['/assessments', { clientId: 'client-jamie', date: day(), name: 'Push-ups', result: 20, unit: 'reps' }],
    ['/measurements', { clientId: 'client-maya', date: day(), weight: 64, height: 165, waist: 76, hip: 96 }],
    ['/logs', { clientId: 'client-maya', planId: 'plan-maya-full', date: day(), items: [] }],
  ]) status(await f.request(path, { method: 'POST', cookie: client.cookie, body }), 403);
  status(await f.request('/plans/plan-jamie-lower', { method: 'PATCH', cookie: client.cookie, body: { name: 'Client changed plan' } }), 403);
  status(await f.request('/plans/plan-jamie-lower', { method: 'DELETE', cookie: client.cookie }), 403);
  status(await f.request('/sessions/session-0', { method: 'PATCH', cookie: client.cookie, body: { time: '12:00' } }), 403);
  status(await f.request('/sessions/session-0', { method: 'DELETE', cookie: client.cookie }), 403);
});

test('admins provision coaches and coach access remains limited to assigned clients', async t => {
  const f = await fixture(t);
  const admin = await f.login('admin@form.fit');
  const existingCoach = await f.login('coach@form.fit');
  const coachPayload = { name: 'Second Coach', email: 'second.coach@example.com', password: 'CoachPassword123!', role: 'coach' };
  status(await f.request('/users', { method: 'POST', cookie: existingCoach.cookie, body: coachPayload }), 403);
  const secondCoach = status(await f.request('/users', { method: 'POST', cookie: admin.cookie, body: coachPayload }), 201);
  assert.equal(secondCoach.role, 'coach');
  assert.equal('password' in secondCoach, false);
  const coach = await f.login(coachPayload.email, coachPayload.password);
  const client = status(await f.request('/clients', { method: 'POST', cookie: coach.cookie, body: {
    name: 'Second Coach Client', email: 'second.client@example.com', password: 'ClientPassword123!', equipment: [],
  } }), 201);
  const data = await f.bootstrap(coach.cookie);
  assert.deepEqual(data.clients.map(record => record.id), [client.id]);
  for (const key of ['plans', 'sessions', 'measurements', 'logs', 'assessments']) assert.deepEqual(data[key], []);
  assert.ok(data.exercises.length > 0);
  assert.equal(data.users.some(user => user.email === 'jamie@form.fit'), false);
  for (const [path, method, body] of [
    ['/clients/client-jamie', 'PATCH', { goal: 'Unauthorized goal' }],
    ['/plans', 'POST', planPayload()],
    ['/plans/plan-jamie-lower', 'PATCH', { name: 'Unauthorized workout' }],
    ['/plans/plan-jamie-lower', 'DELETE', undefined],
    ['/sessions', 'POST', sessionPayload()],
    ['/sessions/session-0', 'PATCH', { time: '08:00' }],
    ['/sessions/session-0', 'DELETE', undefined],
    ['/measurements', 'POST', { clientId: 'client-jamie', date: day(), weight: 81, height: 180, waist: 80, hip: 100 }],
    ['/assessments', 'POST', { clientId: 'client-jamie', date: day(), name: 'Push-ups', result: 10, unit: 'reps' }],
    ['/logs', 'POST', { clientId: 'client-jamie', planId: 'plan-jamie-lower', date: day(), items: [] }],
  ]) status(await f.request(path, { method, cookie: coach.cookie, ...(body === undefined ? {} : { body }) }), 403);
  const assignedPlan = status(await f.request('/plans', { method: 'POST', cookie: coach.cookie, body: planPayload(client.id) }), 201);
  assert.equal(assignedPlan.clientId, client.id);
  status(await f.request('/sessions', { method: 'POST', cookie: existingCoach.cookie, body: sessionPayload() }), 201);
  status(await f.request('/sessions', { method: 'POST', cookie: coach.cookie, body: sessionPayload({ clientId: client.id }) }), 201);
  status(await f.request('/clients/client-jamie', { method: 'PATCH', cookie: admin.cookie, body: { coachId: secondCoach.id } }), 409);
  assert.equal((await f.bootstrap(admin.cookie)).clients.find(record => record.id === 'client-jamie').coachId, existingCoach.user.id);
});

test('admin account updates synchronize coach identity and revoke sessions after a password reset', async t => {
  const f = await fixture(t);
  const admin = await f.login('admin@form.fit');
  const coach = await f.login('coach@form.fit');
  status(await f.request('/users/user-coach', { method: 'PATCH', cookie: coach.cookie, body: { name: 'Unauthorized' } }), 403);
  const updated = status(await f.request('/users/user-coach', { method: 'PATCH', cookie: admin.cookie, body: {
    name: 'Updated Coach', email: 'updated.coach@example.com', password: 'ResetPassword123!',
  } }), 200);
  assert.equal(updated.name, 'Updated Coach');
  assert.equal(updated.email, 'updated.coach@example.com');
  status(await f.request('/bootstrap', { cookie: coach.cookie }), 401);
  status(await f.request('/auth/login', { method: 'POST', body: { email: 'coach@form.fit', password: demoPassword } }), 401);
  assert.equal((await f.login('updated.coach@example.com', 'ResetPassword123!')).user.id, 'user-coach');
});

test('changing a password keeps the current session and invalidates other sessions', async t => {
  const f = await fixture(t);
  const current = await f.login('jamie@form.fit');
  const other = await f.login('jamie@form.fit');
  status(await f.request('/auth/password', { method: 'POST', cookie: current.cookie, body: { currentPassword: 'WrongPassword!', newPassword: 'ChangedPassword123!' } }), 400);
  status(await f.request('/auth/password', { method: 'POST', cookie: current.cookie, body: { currentPassword: demoPassword, newPassword: 'short' } }), 400);
  status(await f.request('/auth/password', { method: 'POST', cookie: current.cookie, body: { currentPassword: demoPassword, newPassword: 'ChangedPassword123!' } }), 200);
  status(await f.request('/bootstrap', { cookie: current.cookie }), 200);
  status(await f.request('/bootstrap', { cookie: other.cookie }), 401);
  status(await f.request('/auth/login', { method: 'POST', body: { email: 'jamie@form.fit', password: demoPassword } }), 401);
  assert.equal((await f.login('jamie@form.fit', 'ChangedPassword123!')).user.clientId, 'client-jamie');
});

test('completed workouts capture actual performance once and preserve historical prescriptions', async t => {
  const f = await fixture(t);
  const coach = await f.login('coach@form.fit');
  const client = await f.login('jamie@form.fit');
  const plan = status(await f.request('/plans', { method: 'POST', cookie: coach.cookie, body: planPayload() }), 201);
  const updated = status(await f.request(`/plans/${plan.id}`, { method: 'PATCH', cookie: coach.cookie, body: { notes: 'Ready for 65 lb', items: [{ ...plan.items[0], weight: 65 }] } }), 200);
  assert.equal(updated.items[0].weight, 65);
  const logPayload = { clientId: plan.clientId, planId: plan.id, date: day(), items: [{ exerciseId: 'ex-bench', sets: 3, reps: 8, weight: 65 }], notes: 'All sets completed' };
  status(await f.request('/logs', { method: 'POST', cookie: client.cookie, body: { ...logPayload, items: [{ exerciseId: 'ex-row', sets: 3, reps: 8, weight: 65 }] } }), 400);
  const log = status(await f.request('/logs', { method: 'POST', cookie: client.cookie, body: logPayload }), 201);
  assert.equal(log.items[0].weight, 65);
  assert.equal(log.planId, plan.id);
  status(await f.request('/logs', { method: 'POST', cookie: client.cookie, body: logPayload }), 409);
  status(await f.request(`/plans/${plan.id}`, { method: 'PATCH', cookie: coach.cookie, body: { name: 'Rewrite history' } }), 409);
  status(await f.request(`/plans/${plan.id}`, { method: 'DELETE', cookie: coach.cookie }), 409);
  const data = await f.bootstrap(client.cookie);
  assert.deepEqual(data.logs.find(record => record.id === log.id), log);
  assert.deepEqual(data.plans.find(record => record.id === plan.id), updated);
  const disposable = status(await f.request('/plans', { method: 'POST', cookie: coach.cookie, body: planPayload() }), 201);
  status(await f.request(`/plans/${disposable.id}`, { method: 'DELETE', cookie: coach.cookie }), 200);
  assert.equal((await f.bootstrap(coach.cookie)).plans.some(record => record.id === disposable.id), false);
});

test('workout validation rejects impossible dates, empty prescriptions, duplicated exercises, and untrusted fields', async t => {
  const f = await fixture(t);
  const coach = await f.login('coach@form.fit');
  const valid = planPayload();
  for (const changes of [
    { date: '2026-02-30' }, { date: '10/05/2026' }, { items: [] },
    { items: [valid.items[0], valid.items[0]] },
    { items: [{ ...valid.items[0], sets: 0 }] },
    { items: [{ ...valid.items[0], weight: -5 }] },
    { items: [{ ...valid.items[0], reps: 2.5 }] },
    { items: [{ ...valid.items[0], exerciseId: 'does-not-exist' }] },
    { role: 'admin' },
  ]) status(await f.request('/plans', { method: 'POST', cookie: coach.cookie, body: { ...valid, ...changes } }), 400);
});

test('session scheduling supports online and in-person lifecycle and blocks coach and client overlaps', async t => {
  const f = await fixture(t);
  const coach = await f.login('coach@form.fit');
  const session = status(await f.request('/sessions', { method: 'POST', cookie: coach.cookie, body: sessionPayload() }), 201);
  assert.equal(session.location, 'https://meet.google.com/abc-defg-hij');
  status(await f.request('/sessions', { method: 'POST', cookie: coach.cookie, body: sessionPayload({ time: '09:30' }) }), 409);
  status(await f.request('/sessions', { method: 'POST', cookie: coach.cookie, body: sessionPayload({ clientId: 'client-maya', time: '09:30' }) }), 409);
  const adjacent = status(await f.request('/sessions', { method: 'POST', cookie: coach.cookie, body: sessionPayload({ clientId: 'client-maya', time: '10:00' }) }), 201);
  const updated = status(await f.request(`/sessions/${session.id}`, { method: 'PATCH', cookie: coach.cookie, body: { time: '08:00', type: 'In person', location: 'Training studio' } }), 200);
  assert.equal(updated.type, 'In person');
  assert.equal(updated.location, 'Training studio');
  status(await f.request(`/sessions/${adjacent.id}`, { method: 'PATCH', cookie: coach.cookie, body: { time: '08:30' } }), 409);
  status(await f.request(`/sessions/${session.id}`, { method: 'DELETE', cookie: coach.cookie }), 200);
  const data = await f.bootstrap(coach.cookie);
  assert.equal(data.sessions.some(record => record.id === session.id), false);
  assert.equal(data.sessions.some(record => record.id === adjacent.id), true);
});

test('session validation rejects invalid dates, times, durations, and meeting links', async t => {
  const f = await fixture(t);
  const coach = await f.login('coach@form.fit');
  for (const changes of [
    { date: '2026-02-30' }, { time: '24:00' }, { time: '09:60' },
    { time: '23:30', duration: 60 }, { duration: 0 }, { duration: 7.5 },
    { type: 'Unknown' }, { location: 'javascript:alert(1)' }, { location: 'http://example.com/meeting' },
  ]) status(await f.request('/sessions', { method: 'POST', cookie: coach.cookie, body: sessionPayload(changes) }), 400);
});

test('measurements retain metric inputs for BMI and waist-to-hip calculations and protect record ownership', async t => {
  const f = await fixture(t);
  const client = await f.login('jamie@form.fit');
  const payload = { clientId: 'client-jamie', date: day(), weight: 81, height: 180, waist: 80, hip: 100 };
  const measurement = status(await f.request('/measurements', { method: 'POST', cookie: client.cookie, body: payload }), 201);
  const saved = (await f.bootstrap(client.cookie)).measurements.find(record => record.id === measurement.id);
  assert.deepEqual(saved, { ...payload, id: measurement.id });
  assert.equal(saved.weight / ((saved.height / 100) ** 2), 25);
  assert.equal(saved.waist / saved.hip, 0.8);
  for (const changes of [{ height: 0 }, { hip: 0 }, { weight: -1 }, { waist: '80' }, { date: '2026-02-30' }]) {
    status(await f.request('/measurements', { method: 'POST', cookie: client.cookie, body: { ...payload, ...changes } }), 400);
  }
  status(await f.request('/measurements', { method: 'POST', cookie: client.cookie, body: { ...payload, clientId: 'client-maya' } }), 403);
});

test('coaches record fitness assessments and clients can read their results', async t => {
  const f = await fixture(t);
  const coach = await f.login('coach@form.fit');
  const client = await f.login('jamie@form.fit');
  const payload = { clientId: 'client-jamie', date: day(), name: 'Bodyweight squats', result: 24, unit: 'reps', notes: '60-second assessment' };
  const assessment = status(await f.request('/assessments', { method: 'POST', cookie: coach.cookie, body: payload }), 201);
  assert.deepEqual((await f.bootstrap(client.cookie)).assessments.find(record => record.id === assessment.id), { ...payload, id: assessment.id });
  status(await f.request('/assessments', { method: 'POST', cookie: client.cookie, body: payload }), 403);
  status(await f.request('/assessments', { method: 'POST', cookie: coach.cookie, body: { ...payload, result: -1 } }), 400);
});

test('SQLite restart preserves workout plans, actual progress, equipment, and existing authenticated sessions', async t => {
  const f = await fixture(t);
  const coach = await f.login('coach@form.fit');
  const client = await f.login('jamie@form.fit');
  const plan = status(await f.request('/plans', { method: 'POST', cookie: coach.cookie, body: planPayload() }), 201);
  const log = status(await f.request('/logs', { method: 'POST', cookie: client.cookie, body: {
    clientId: plan.clientId, planId: plan.id, date: day(),
    items: [{ exerciseId: 'ex-bench', sets: 3, reps: 8, weight: 65 }], notes: 'A personal best',
  } }), 201);
  status(await f.request('/clients/client-jamie', { method: 'PATCH', cookie: client.cookie, body: { equipment: ['Dumbbells', 'Bench'] } }), 200);
  const before = await f.bootstrap(client.cookie);
  await f.restart();
  const after = await f.bootstrap(client.cookie);
  assert.deepEqual(after.plans.find(record => record.id === plan.id), plan);
  assert.deepEqual(after.logs.find(record => record.id === log.id), log);
  assert.deepEqual(after.clients[0].equipment, ['Dumbbells', 'Bench']);
  assert.equal(after.plans.length, before.plans.length, 'Restart must not duplicate the demo seed');
  assert.equal(after.logs.length, before.logs.length);
});

test('API rejects cross-site mutations, invalid JSON, and unsupported request bodies', async t => {
  const f = await fixture(t);
  const admin = await f.login('admin@form.fit');
  status(await f.request('/exercises', { method: 'POST', cookie: admin.cookie, body: exercisePayload(), headers: { Origin: 'https://untrusted.example' } }), 403);
  status(await f.request('/exercises', { method: 'POST', cookie: admin.cookie, body: exercisePayload(), headers: { 'Sec-Fetch-Site': 'cross-site' } }), 403);
  status(await f.request('/exercises', { method: 'POST', cookie: admin.cookie, headers: { 'Content-Type': 'application/json' }, rawBody: '{broken' }), 400);
  status(await f.request('/exercises', { method: 'POST', cookie: admin.cookie, headers: { 'Content-Type': 'text/plain' }, rawBody: 'not-json' }), 415);
  status(await f.request('/exercises', { method: 'POST', cookie: admin.cookie, body: [] }), 400);
});

test('invited clients choose their password, join only their coach, and retain accounts after restart', async t => {
  const f = await fixture(t);
  const coach = await f.login('coach@form.fit');
  const invite = status(await f.request('/invitations', { method: 'POST', cookie: coach.cookie, body: { name: 'Invited Client', email: 'invited@example.com', goal: 'Build consistency' } }), 201);
  assert.equal(invite.token.length, 64);
  await f.restart();
  const details = status(await f.request(`/auth/invitations/${invite.token}`), 200);
  assert.equal(details.email, 'invited@example.com');
  assert.equal(details.coachName, 'Alex Morgan');
  const registration = { token: invite.token, name: 'New Client', password: 'ClientOwnPassword123!', goal: 'Get stronger' };
  for (const injection of [{ role: 'admin' }, { email: 'other@example.com' }, { coachId: 'user-admin' }]) status(await f.request('/auth/register', { method: 'POST', body: { ...registration, ...injection } }), 400);
  const result = await f.request('/auth/register', { method: 'POST', body: registration });
  status(result, 201);
  assert.equal(result.body.user.role, 'client');
  assert.equal(result.body.user.email, 'invited@example.com');
  const cookie = result.headers.get('set-cookie').split(';')[0];
  const data = await f.bootstrap(cookie);
  assert.equal(data.clients.length, 1);
  assert.equal(data.clients[0].coachId, coach.user.id);
  assert.equal(data.clients[0].goal, 'Get stronger');
  assert.equal(data.invitations.length, 0);
  assert.equal(data.clients.some(client => client.id === 'client-jamie'), false);
  const assigned = status(await f.request('/plans', { method: 'POST', cookie: coach.cookie, body: planPayload(data.clients[0].id) }), 201);
  assert.equal((await f.bootstrap(cookie)).plans[0].id, assigned.id);
  status(await f.request(`/auth/invitations/${invite.token}`), 404);
  status(await f.request('/auth/register', { method: 'POST', body: registration }), 404);
  await f.restart();
  const fresh = await f.login('invited@example.com', registration.password);
  assert.equal((await f.bootstrap(fresh.cookie)).clients[0].id, data.clients[0].id);
  assert.equal((await f.bootstrap(coach.cookie)).invitations.find(item => item.id === invite.id).status, 'Joined');
});

test('invitation permissions, revocation, replacement and single use prevent unauthorized registration', async t => {
  const f = await fixture(t), coach = await f.login('coach@form.fit'), admin = await f.login('admin@form.fit'), client = await f.login('jamie@form.fit');
  const payload = { name: 'Registration Test', email: 'registration@example.com' };
  status(await f.request('/invitations', { method: 'POST', body: payload }), 401);
  status(await f.request('/invitations', { method: 'POST', cookie: client.cookie, body: payload }), 403);
  status(await f.request('/invitations', { method: 'POST', cookie: coach.cookie, body: { ...payload, coachId: admin.user.id } }), 403);
  status(await f.request('/invitations', { method: 'POST', cookie: coach.cookie, body: { ...payload, email: 'jamie@form.fit' } }), 409);
  const old = status(await f.request('/invitations', { method: 'POST', cookie: coach.cookie, body: payload }), 201);
  const replacement = status(await f.request('/invitations', { method: 'POST', cookie: coach.cookie, body: payload }), 201);
  status(await f.request(`/auth/invitations/${old.token}`), 404);
  const outsiderUser = status(await f.request('/users', { method: 'POST', cookie: admin.cookie, body: { name: 'Other Coach', email: 'othercoach@example.com', password: 'OtherCoach123!', role: 'coach' } }), 201);
  const outsider = await f.login(outsiderUser.email, 'OtherCoach123!');
  assert.equal((await f.bootstrap(outsider.cookie)).invitations.length, 0);
  status(await f.request(`/invitations/${replacement.id}`, { method: 'DELETE', cookie: outsider.cookie }), 403);
  status(await f.request(`/invitations/${replacement.id}`, { method: 'DELETE', cookie: coach.cookie }), 200);
  status(await f.request(`/auth/invitations/${replacement.token}`), 404);
  const last = status(await f.request('/invitations', { method: 'POST', cookie: coach.cookie, body: payload }), 201);
  const register = () => f.request('/auth/register', { method: 'POST', body: { token: last.token, name: 'Registration Test', password: 'Registration123!' } });
  assert.deepEqual((await Promise.all([register(), register()])).map(result => result.status).sort(), [201, 404]);
  assert.equal((await f.bootstrap(coach.cookie)).clients.filter(item => item.email === payload.email).length, 1);
  assert.ok((await f.bootstrap(coach.cookie)).invitations.every(item => !('token' in item) && !('token_hash' in item)));
});

test('a private workspace can be activated only once with its setup secret and has no demo accounts', async t => {
  const token = 'a'.repeat(64);
  const f = await fixture(t, { seed: false, config: { TRAIN_SETUP_TOKEN: token } });
  assert.equal(status(await f.request('/config'), 200).setupRequired, true);
  status(await f.request(`/auth/setup/${'b'.repeat(64)}`), 404);
  const payload = { token, name: 'Workspace Owner', email: 'owner@example.com', password: 'OwnerPassword123!' };
  status(await f.request('/auth/setup', { method: 'POST', body: { ...payload, role: 'admin' } }), 400);
  const result = await f.request('/auth/setup', { method: 'POST', body: payload });
  status(result, 201);
  const cookie = result.headers.get('set-cookie').split(';')[0];
  const data = await f.bootstrap(cookie);
  assert.equal(data.demoMode, false);
  assert.equal(data.user.role, 'admin');
  assert.equal(data.users.length, 1);
  assert.equal(data.clients.length, 0);
  assert.equal(data.plans.length, 0);
  assert.equal(data.exercises.length, 353);
  assert.equal(status(await f.request('/config'), 200).setupRequired, false);
  status(await f.request(`/auth/setup/${token}`), 409);
  status(await f.request('/auth/setup', { method: 'POST', body: { ...payload, email: 'imposter@example.com' } }), 409);
  status(await f.request('/auth/login', { method: 'POST', body: { email: 'admin@form.fit', password: demoPassword } }), 401);
  await f.restart();
  assert.equal((await f.bootstrap(cookie)).user.email, payload.email);
});

test('expanded exercises retain references, work in daily routines, and preserve edits and archives after restart', async t => {
  const f = await fixture(t), admin = await f.login('admin@form.fit');
  const initial = await f.bootstrap(admin.cookie);
  const bird = initial.exercises.find(exercise => exercise.id === 'ex-bird-dog');
  assert.match(bird.references[0].url, /^https:\/\/www\.nasm\.org\//);
  assert.ok(initial.exercises.find(exercise => exercise.id === 'ex-incline-db-press').references.some(source => source.name.startsWith('ISSA')));
  const edited = status(await f.request('/exercises/ex-bird-dog', { method: 'PATCH', cookie: admin.cookie, body: { cues: 'My own coaching cue' } }), 200);
  assert.deepEqual(edited.references, bird.references);
  for (const references of [[{ name: 'Unsafe', url: 'javascript:alert(1)' }], [{ name: 'Unsafe', url: 'https://user:pass@example.com/' }], [{ name: 'Unknown', url: 'https://example.com/', extra: true }], null]) {
    status(await f.request('/exercises/ex-bird-dog', { method: 'PATCH', cookie: admin.cookie, body: { references } }), 400);
  }
  status(await f.request('/exercises/ex-seated-leg-curl', { method: 'DELETE', cookie: admin.cookie }), 200);
  const coach = await f.login('coach@form.fit');
  const template = status(await f.request('/templates', { method: 'POST', cookie: coach.cookie, body: { name: 'Expanded library routine', notes: '', items: [
    { exerciseId: 'ex-incline-db-press', sets: 3, reps: 8, weight: 15, rest: 60, notes: '' },
    { exerciseId: 'ex-bird-dog', sets: 2, reps: 10, weight: 0, rest: 45, notes: 'Per side' },
  ] } }), 201);
  await f.restart();
  const saved = await f.bootstrap(coach.cookie);
  assert.equal(saved.exercises.length, initial.exercises.length);
  assert.equal(saved.exercises.find(exercise => exercise.id === 'ex-bird-dog').cues, 'My own coaching cue');
  assert.equal(saved.exercises.find(exercise => exercise.id === 'ex-seated-leg-curl').archived, true);
  assert.ok(saved.exercises.every(exercise => !exercise.alternatives.includes('ex-seated-leg-curl')));
  assert.deepEqual(saved.templates.find(item => item.id === template.id).items, template.items);
});

test('admins and coaches build without clients; templates assign independent copies and survive restart', async t => {
  const token = 'e'.repeat(64), f = await fixture(t, { seed: false, config: { TRAIN_SETUP_TOKEN: token } });
  const result = await f.request('/auth/setup', { method: 'POST', body: { token, name: 'Owner', email: 'template-owner@example.com', password: 'OwnerPassword123!' } });
  status(result, 201); const admin = { cookie: result.headers.get('set-cookie').split(';')[0] };
  status(await f.request('/users', { method: 'POST', cookie: admin.cookie, body: { name: 'Template Coach', email: 'template-coach@example.com', password: 'CoachPassword123!', role: 'coach' } }), 201);
  const coach = await f.login('template-coach@example.com', 'CoachPassword123!');
  const { name, items, notes } = planPayload();
  const payload = { name, items, notes };
  for (const account of [admin, coach]) {
    assert.equal((await f.bootstrap(account.cookie)).clients.length, 0);
    status(await f.request('/templates', { method: 'POST', cookie: account.cookie, body: payload }), 201);
  }
  const template = (await f.bootstrap(coach.cookie)).templates[0];
  assert.equal(template.ownerId, coach.user.id); assert.equal('clientId' in template, false); assert.equal('date' in template, false);
  assert.equal((await f.bootstrap(admin.cookie)).templates.length, 2);
  const client = status(await f.request('/clients', { method: 'POST', cookie: coach.cookie, body: { name: 'Template Client', email: 'template-client@example.com', password: 'ClientPassword123!', equipment: [] } }), 201);
  const copy = status(await f.request(`/templates/${template.id}/assign`, { method: 'POST', cookie: coach.cookie, body: { clientId: client.id, date: day(), name: 'Personal copy' } }), 201);
  assert.deepEqual(copy.items, items); assert.equal(copy.notes, notes); assert.equal(copy.name, 'Personal copy');
  status(await f.request(`/templates/${template.id}`, { method: 'PATCH', cookie: coach.cookie, body: { items: [{ ...items[0], sets: 5 }] } }), 200);
  assert.equal((await f.bootstrap(coach.cookie)).plans.find(plan => plan.id === copy.id).items[0].sets, 3);
  status(await f.request(`/plans/${copy.id}`, { method: 'PATCH', cookie: coach.cookie, body: { items: [{ ...items[0], weight: 125 }] } }), 200);
  assert.equal((await f.bootstrap(coach.cookie)).templates[0].items[0].weight, 40);
  status(await f.request(`/templates/${template.id}`, { method: 'DELETE', cookie: coach.cookie }), 200);
  await f.restart();
  const data = await f.bootstrap(coach.cookie);
  assert.deepEqual(data.templates, []); assert.equal(data.plans.find(plan => plan.id === copy.id).items[0].weight, 125);
});

test('workout library and copying enforce template ownership, target client access, and trusted inputs', async t => {
  const f = await fixture(t), admin = await f.login('admin@form.fit'), coach = await f.login('coach@form.fit'), client = await f.login('jamie@form.fit');
  const { name, items, notes } = planPayload(), payload = { name, items, notes };
  const template = status(await f.request('/templates', { method: 'POST', cookie: coach.cookie, body: payload }), 201);
  status(await f.request('/users', { method: 'POST', cookie: admin.cookie, body: { name: 'Other Coach', email: 'other-template@example.com', password: 'OtherCoach123!', role: 'coach' } }), 201);
  const other = await f.login('other-template@example.com', 'OtherCoach123!');
  assert.deepEqual((await f.bootstrap(other.cookie)).templates, []); assert.deepEqual((await f.bootstrap(client.cookie)).templates, []);
  for (const account of [other, client]) {
    for (const [path, method, body] of [
      [`/templates/${template.id}`, 'PATCH', { name: 'Stolen' }], [`/templates/${template.id}`, 'DELETE', undefined],
      [`/templates/${template.id}/assign`, 'POST', { clientId: 'client-jamie', date: day() }],
      ['/plans/plan-jamie-lower/copy', 'POST', { clientId: 'client-jamie', date: day() }],
      ['/plans/plan-jamie-lower/template', 'POST', {}],
    ]) status(await f.request(path, { method, cookie: account.cookie, body }), 403);
  }
  status(await f.request('/templates', { method: 'POST', cookie: client.cookie, body: payload }), 403);
  for (const changes of [{ ownerId: other.user.id }, { items: [] }, { items: [...items, ...items] }, { items: [{ ...items[0], sets: 0 }] }]) status(await f.request('/templates', { method: 'POST', cookie: coach.cookie, body: { ...payload, ...changes } }), 400);
  const adminTemplate = status(await f.request('/templates', { method: 'POST', cookie: admin.cookie, body: payload }), 201);
  status(await f.request(`/templates/${adminTemplate.id}/assign`, { method: 'POST', cookie: admin.cookie, body: { clientId: 'client-jamie', date: day(), items: [] } }), 400);
  status(await f.request(`/templates/${adminTemplate.id}/assign`, { method: 'POST', cookie: admin.cookie, body: { clientId: 'client-jamie', date: '2026-02-30' } }), 400);
  const otherTemplate = status(await f.request('/templates', { method: 'POST', cookie: other.cookie, body: payload }), 201);
  status(await f.request(`/templates/${otherTemplate.id}/assign`, { method: 'POST', cookie: other.cookie, body: { clientId: 'client-jamie', date: day() } }), 403);
});

test('completed workouts copy prescriptions without results and can be saved to the library', async t => {
  const f = await fixture(t), coach = await f.login('coach@form.fit'), client = await f.login('jamie@form.fit');
  const source = status(await f.request('/plans', { method: 'POST', cookie: coach.cookie, body: planPayload() }), 201);
  status(await f.request('/logs', { method: 'POST', cookie: client.cookie, body: { clientId: source.clientId, planId: source.id, date: day(), items: source.items.map(({ exerciseId, sets, reps, weight }) => ({ exerciseId, sets, reps, weight: weight + 5 })) } }), 201);
  const copy = status(await f.request(`/plans/${source.id}/copy`, { method: 'POST', cookie: coach.cookie, body: { clientId: 'client-maya', date: day(1) } }), 201);
  assert.notEqual(copy.id, source.id); assert.deepEqual(copy.items, source.items); assert.equal(copy.notes, source.notes);
  const template = status(await f.request(`/plans/${source.id}/template`, { method: 'POST', cookie: coach.cookie, body: {} }), 201);
  assert.deepEqual(template.items, source.items);
  const data = await f.bootstrap(coach.cookie); assert.equal(data.logs.some(log => log.planId === copy.id), false);
  status(await f.request(`/plans/${source.id}`, { method: 'PATCH', cookie: coach.cookie, body: { name: 'History edit' } }), 409);
  const admin = await f.login('admin@form.fit');
  status(await f.request('/exercises/ex-bench', { method: 'DELETE', cookie: admin.cookie }), 200);
  status(await f.request(`/templates/${template.id}/assign`, { method: 'POST', cookie: coach.cookie, body: { clientId: 'client-jamie', date: day() } }), 400);
  assert.equal((await f.bootstrap(coach.cookie)).plans.length, data.plans.length);
});

test('body fat assessments store percent history with bounds and client access', async t => {
  const f = await fixture(t), coach = await f.login('coach@form.fit'), client = await f.login('jamie@form.fit');
  const payload = { clientId: 'client-jamie', date: day(), name: 'Body fat percentage', result: 24.5, unit: '%', notes: 'Measured with body composition scale' };
  const assessment = status(await f.request('/assessments', { method: 'POST', cookie: coach.cookie, body: payload }), 201);
  for (const result of [-0.1, 100.1]) status(await f.request('/assessments', { method: 'POST', cookie: coach.cookie, body: { ...payload, result } }), 400);
  status(await f.request('/assessments', { method: 'POST', cookie: coach.cookie, body: { ...payload, unit: 'reps' } }), 400);
  status(await f.request('/assessments', { method: 'POST', cookie: client.cookie, body: payload }), 403);
  await f.restart();
  assert.deepEqual((await f.bootstrap(client.cookie)).assessments.find(record => record.id === assessment.id), { id: assessment.id, ...payload });
  const maya = await f.login('maya@form.fit'); assert.equal((await f.bootstrap(maya.cookie)).assessments.some(record => record.id === assessment.id), false);
});

async function weeklyFixture(t) {
  const f = await fixture(t), coach = await f.login('coach@form.fit');
  const { items, notes } = planPayload();
  const routines = [];
  for (const name of ['Chest & arms', 'Leg day', 'Back & shoulders']) routines.push(status(await f.request('/templates', { method: 'POST', cookie: coach.cookie, body: { name, items, notes } }), 201));
  const days = routines.map((routine, index) => ({ weekday: index * 2, templateId: routine.id }));
  const lineup = status(await f.request('/weekly-lineups', { method: 'POST', cookie: coach.cookie, body: { name: 'Three-day foundations', notes: 'Repeat with consistent technique', days } }), 201);
  return { ...f, coach, routines, days, lineup };
}
const shiftWorkoutDate = (date, days) => { const value = new Date(`${date}T00:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); };

test('weekly lineups assign 2–4 exact weeks across daylight saving and year boundaries', async t => {
  const f = await weeklyFixture(t);
  for (const [startDate, weeks, weekdays] of [['2030-03-04', 2, [0, 2, 4]], ['2030-10-28', 3, [0, 1, 3, 5]], ['2030-12-23', 4, [0, 1, 2, 3, 4]]]) {
    const days = weekdays.map((weekday, index) => ({ weekday, templateId: f.routines[index % 3].id }));
    const { assignment, planCount } = status(await f.request(`/weekly-lineups/${f.lineup.id}/assign`, { method: 'POST', cookie: f.coach.cookie, body: { clientId: 'client-jamie', startDate, weeks, days } }), 201);
    assert.equal(planCount, weekdays.length * weeks); assert.equal(assignment.weeks, weeks);
    const plans = (await f.bootstrap(f.coach.cookie)).plans.filter(plan => plan.weeklyAssignmentId === assignment.id).sort((a, b) => a.date.localeCompare(b.date));
    assert.deepEqual(plans.map(plan => plan.date), Array.from({ length: weeks }, (_, week) => weekdays.map(weekday => shiftWorkoutDate(startDate, week * 7 + weekday))).flat());
    for (let index = 0; index < plans.length; index++) {
      const routine = f.routines[index % weekdays.length % 3];
      assert.equal(plans[index].name, routine.name); assert.deepEqual(plans[index].items, routine.items); assert.equal(plans[index].notes, routine.notes);
    }
    assert.equal(new Set(plans.map(plan => plan.id)).size, planCount);
  }
  assert.deepEqual((await f.bootstrap(f.coach.cookie)).weeklyLineups[0].days, f.days, 'Client variations must not change the reusable lineup');
  const client = await f.login('jamie@form.fit'), maya = await f.login('maya@form.fit');
  assert.deepEqual((await f.bootstrap(client.cookie)).weeklyLineups, []);
  assert.equal((await f.bootstrap(client.cookie)).weeklyAssignments.length, 3);
  assert.equal((await f.bootstrap(maya.cookie)).weeklyAssignments.length, 0);
  await f.restart(); assert.equal((await f.bootstrap(client.cookie)).weeklyAssignments.length, 3);
});

test('assigned weekly workouts are independent snapshots and preserve their program membership', async t => {
  const f = await weeklyFixture(t);
  const result = status(await f.request(`/weekly-lineups/${f.lineup.id}/assign`, { method: 'POST', cookie: f.coach.cookie, body: { clientId: 'client-jamie', startDate: '2030-01-07', weeks: 2 } }), 201);
  const plans = (await f.bootstrap(f.coach.cookie)).plans.filter(plan => plan.weeklyAssignmentId === result.assignment.id);
  status(await f.request(`/templates/${f.routines[0].id}`, { method: 'PATCH', cookie: f.coach.cookie, body: { name: 'Changed future chest routine', items: [{ ...f.routines[0].items[0], sets: 5 }] } }), 200);
  status(await f.request(`/weekly-lineups/${f.lineup.id}`, { method: 'PATCH', cookie: f.coach.cookie, body: { name: 'Future weekly title', days: f.days.map(day => ({ ...day, templateId: f.routines[1].id })) } }), 200);
  assert.deepEqual((await f.bootstrap(f.coach.cookie)).plans.filter(plan => plan.weeklyAssignmentId === result.assignment.id), plans);
  const edited = status(await f.request(`/plans/${plans[0].id}`, { method: 'PATCH', cookie: f.coach.cookie, body: { items: [{ ...plans[0].items[0], weight: 85 }] } }), 200);
  assert.equal(edited.weeklyAssignmentId, result.assignment.id);
  status(await f.request(`/plans/${plans[0].id}`, { method: 'PATCH', cookie: f.coach.cookie, body: { clientId: 'client-maya' } }), 409);
  const copy = status(await f.request(`/plans/${plans[0].id}/copy`, { method: 'POST', cookie: f.coach.cookie, body: { clientId: 'client-maya', date: '2030-01-07' } }), 201);
  assert.equal('weeklyAssignmentId' in copy, false); assert.equal(copy.items[0].weight, 85);
  status(await f.request(`/weekly-lineups/${f.lineup.id}`, { method: 'DELETE', cookie: f.coach.cookie }), 200);
  for (const routine of f.routines) status(await f.request(`/templates/${routine.id}`, { method: 'DELETE', cookie: f.coach.cookie }), 200);
  await f.restart(); const data = await f.bootstrap(f.coach.cookie);
  assert.deepEqual(data.weeklyLineups, []); assert.deepEqual(data.templates, []);
  assert.deepEqual(data.weeklyAssignments[0], result.assignment); assert.equal(data.plans.find(plan => plan.id === edited.id).items[0].weight, 85);
  assert.equal(data.plans.filter(plan => plan.weeklyAssignmentId === result.assignment.id).length, 6);
});

test('weekly assignment rejects collisions and invalid exercises before writing any workouts', async t => {
  const f = await weeklyFixture(t), path = `/weekly-lineups/${f.lineup.id}/assign`;
  const payload = { clientId: 'client-jamie', startDate: '2030-05-06', weeks: 4 };
  status(await f.request('/plans', { method: 'POST', cookie: f.coach.cookie, body: { ...planPayload(), date: '2030-05-31' } }), 201);
  const before = await f.bootstrap(f.coach.cookie);
  const conflict = status(await f.request(path, { method: 'POST', cookie: f.coach.cookie, body: payload }), 409);
  assert.match(conflict.error, /2030-05-31/);
  const after = await f.bootstrap(f.coach.cookie); assert.deepEqual(after.plans, before.plans); assert.deepEqual(after.weeklyAssignments, []);
  const success = status(await f.request(path, { method: 'POST', cookie: f.coach.cookie, body: { ...payload, startDate: '2030-06-03' } }), 201);
  status(await f.request(path, { method: 'POST', cookie: f.coach.cookie, body: { ...payload, startDate: '2030-06-03' } }), 409);
  assert.equal((await f.bootstrap(f.coach.cookie)).weeklyAssignments.length, 1);
  const admin = await f.login('admin@form.fit');
  status(await f.request('/exercises/ex-bench', { method: 'DELETE', cookie: admin.cookie }), 200);
  const archivedBefore = await f.bootstrap(f.coach.cookie);
  status(await f.request(path, { method: 'POST', cookie: f.coach.cookie, body: { ...payload, startDate: '2030-07-01' } }), 400);
  const archivedAfter = await f.bootstrap(f.coach.cookie); assert.deepEqual(archivedAfter.plans, archivedBefore.plans); assert.equal(archivedAfter.weeklyAssignments.length, 1);
  assert.equal(success.planCount, 12);
});

test('weekly lineup validation protects daily references and requires 3–5 distinct training days', async t => {
  const f = await weeklyFixture(t), payload = { name: 'Validation lineup', days: f.days };
  const invalid = [
    { days: f.days.slice(0, 2) }, { days: Array.from({ length: 6 }, (_, weekday) => ({ weekday, templateId: f.routines[0].id })) },
    { days: [{ ...f.days[0] }, { ...f.days[0] }, f.days[1]] }, { days: [{ ...f.days[0], weekday: 7 }, ...f.days.slice(1)] },
    { days: [{ ...f.days[0], weekday: 0.5 }, ...f.days.slice(1)] }, { days: [{ ...f.days[0], weekday: '0' }, ...f.days.slice(1)] },
    { days: [{ ...f.days[0], extra: 'untrusted' }, ...f.days.slice(1)] }, { ownerId: 'user-admin' }, { name: '' },
  ];
  for (const changes of invalid) status(await f.request('/weekly-lineups', { method: 'POST', cookie: f.coach.cookie, body: { ...payload, ...changes } }), 400);
  status(await f.request('/weekly-lineups', { method: 'POST', cookie: f.coach.cookie, body: { ...payload, days: [{ ...f.days[0], templateId: 'missing-template' }, ...f.days.slice(1)] } }), 404);
  const assign = { clientId: 'client-jamie', startDate: '2030-04-01', weeks: 2 };
  for (const changes of [{ weeks: 1 }, { weeks: 5 }, { weeks: 2.5 }, { weeks: '2' }, { startDate: '2030-04-02' }, { startDate: '2030-02-30' }, { days: [] }, { weeklyAssignmentId: 'forged' }]) status(await f.request(`/weekly-lineups/${f.lineup.id}/assign`, { method: 'POST', cookie: f.coach.cookie, body: { ...assign, ...changes } }), 400);
  assert.equal((await f.bootstrap(f.coach.cookie)).weeklyLineups.length, 1);
  assert.deepEqual((await f.bootstrap(f.coach.cookie)).weeklyAssignments, []);
  status(await f.request(`/templates/${f.routines[0].id}`, { method: 'DELETE', cookie: f.coach.cookie }), 409);
  status(await f.request(`/weekly-lineups/${f.lineup.id}`, { method: 'PATCH', cookie: f.coach.cookie, body: { ownerId: 'user-admin' } }), 400);
});

test('weekly lineups enforce coach ownership and client permissions at every endpoint', async t => {
  const f = await weeklyFixture(t), admin = await f.login('admin@form.fit'), client = await f.login('jamie@form.fit');
  status(await f.request('/users', { method: 'POST', cookie: admin.cookie, body: { name: 'Other Weekly Coach', email: 'other-weekly@example.com', password: 'OtherWeekly123!', role: 'coach' } }), 201);
  const other = await f.login('other-weekly@example.com', 'OtherWeekly123!');
  for (const account of [client, other]) {
    assert.deepEqual((await f.bootstrap(account.cookie)).weeklyLineups, []);
    for (const [path, method, body] of [
      [`/weekly-lineups/${f.lineup.id}`, 'PATCH', { name: 'Stolen lineup' }], [`/weekly-lineups/${f.lineup.id}`, 'DELETE', undefined],
      [`/weekly-lineups/${f.lineup.id}/assign`, 'POST', { clientId: 'client-jamie', startDate: '2030-08-05', weeks: 2 }],
      ['/weekly-lineups', 'POST', { name: 'Cross-owner lineup', days: f.days }],
    ]) status(await f.request(path, { method, cookie: account.cookie, body }), 403);
  }
  const foreignClient = status(await f.request('/clients', { method: 'POST', cookie: other.cookie, body: { name: 'Foreign Weekly Client', email: 'foreign-weekly@example.com', password: 'ClientPassword123!' } }), 201);
  status(await f.request(`/weekly-lineups/${f.lineup.id}/assign`, { method: 'POST', cookie: f.coach.cookie, body: { clientId: foreignClient.id, startDate: '2030-08-05', weeks: 2 } }), 403);
  const { items } = planPayload();
  const adminRoutine = status(await f.request('/templates', { method: 'POST', cookie: admin.cookie, body: { name: 'Admin day', items } }), 201);
  status(await f.request(`/weekly-lineups/${f.lineup.id}`, { method: 'PATCH', cookie: admin.cookie, body: { days: f.days.map(day => ({ ...day, templateId: adminRoutine.id })) } }), 400);
  const assigned = status(await f.request(`/weekly-lineups/${f.lineup.id}/assign`, { method: 'POST', cookie: admin.cookie, body: { clientId: foreignClient.id, startDate: '2030-08-05', weeks: 2 } }), 201);
  assert.equal((await f.bootstrap(other.cookie)).weeklyAssignments[0].id, assigned.assignment.id);
  assert.equal((await f.bootstrap(f.coach.cookie)).weeklyAssignments.length, 0);
  assert.equal((await f.bootstrap(admin.cookie)).weeklyLineups.length, 1);
});


test('private password recovery enforces roles, replaces links and revokes sessions', async t => {
 const f=await fixture(t);
 const login=async email=>(await f.login(email)).cookie;
 const coach=await login('coach@form.fit'), client=await login('jamie@form.fit'), admin=await login('admin@form.fit');
 const create=cookie=>f.request('/auth/recovery-link',{method:'POST',cookie,body:{userId:'user-jamie'}});
 assert.equal((await create(client)).status,403);
 assert.equal((await f.request('/auth/recovery-link',{method:'POST',cookie:coach,body:{userId:'user-admin'}})).status,403);
 const first=await create(coach); assert.equal(first.status,201);
 const second=await create(admin); assert.equal(second.status,201);
 assert.equal((await f.request(`/auth/reset-password/${first.body.token}`)).status,400);
 assert.equal((await f.request(`/auth/reset-password/${second.body.token}`)).status,200);
 assert.equal((await f.request('/auth/reset-password',{method:'POST',body:{token:second.body.token,password:'tiny'}})).status,400);
 assert.equal((await f.request('/auth/reset-password',{method:'POST',body:{token:second.body.token,password:'NewRecovery123!'}})).status,200);
 assert.equal((await f.request('/bootstrap',{cookie:client})).status,401);
 assert.equal((await f.request('/auth/reset-password',{method:'POST',body:{token:second.body.token,password:'AnotherPassword123!'}})).status,400);
 assert.equal((await f.request('/auth/login',{method:'POST',body:{email:'jamie@form.fit',password:'NewRecovery123!'}})).status,200);
 for(let i=0;i<5;i++)assert.equal((await f.request('/auth/forgot-password',{method:'POST',body:{email:'absent@example.com'}})).status,503);
 assert.equal((await f.request('/auth/forgot-password',{method:'POST',body:{email:'absent@example.com'}})).status,429);
});

test('recovery links persist across restart and expire after thirty minutes', {skip:process.env.FORM_TEST_RUNTIME==='cloudflare'}, async t => {
 const f=await fixture(t), coach=(await f.login('coach@form.fit')).cookie;
 const created=await f.request('/auth/recovery-link',{method:'POST',cookie:coach,body:{userId:'user-jamie'}});
 assert.equal(created.status,201);assert.match(created.body.token,/^[a-f0-9]{64}$/);
 await f.restart();assert.equal((await f.request(`/auth/reset-password/${created.body.token}`)).status,200);
 t.mock.timers.enable({apis:['Date'],now:Date.now()});t.mock.timers.tick(30*60_000+1000);
 assert.equal((await f.request(`/auth/reset-password/${created.body.token}`)).status,400);
 assert.equal((await f.request('/auth/reset-password',{method:'POST',body:{token:created.body.token,password:'ExpiredPassword123!'}})).status,400);
});
