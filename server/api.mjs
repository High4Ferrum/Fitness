import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { seedDatabase, seedExerciseLibrary, passwordHash } from './seed.mjs';

const tables = ['clients', 'exercises', 'plans', 'training_sessions', 'logs', 'measurements', 'assessments'];
const SESSION_DAYS = 7;
const fail = (status, message) => { const error = new Error(message); error.status = status; throw error; };
const own = (object, key) => Object.hasOwn(object, key);
const str = (value, label, max = 2000, required = false) => {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) fail(400, `${label} must be ${required ? 'a nonempty' : 'a'} string of at most ${max} characters.`);
  return value.trim();
};
const num = (value, label, min, max, integer = false) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) fail(400, `${label} must be ${integer ? 'an integer' : 'a number'} from ${min} to ${max}.`);
  return value;
};
const stringList = (value, label, maxCount = 40) => {
  if (!Array.isArray(value) || value.length > maxCount) fail(400, `${label} must be a list of at most ${maxCount} values.`);
  const list = value.map(v => str(v, label, 100, true));
  if (new Set(list).size !== list.length) fail(400, `${label} cannot contain duplicates.`);
  return list;
};
const dateValue = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(400, 'Date must use YYYY-MM-DD.');
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) fail(400, 'Date is invalid.');
  return value;
};
const emailValue = (value) => {
  const email = str(value, 'Email', 254, true).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'Enter a valid email address.');
  return email;
};
const passwordValue = (value, label = 'Password', minimum = 8) => {
  if (typeof value !== 'string' || value.length < minimum || value.length > 256 || !value.trim()) fail(400, `${label} must contain ${minimum}–256 characters.`);
  return value;
};
const verifyPassword = (password, encoded) => {
  const [salt, hash] = encoded.split(':');
  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(password, salt, expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};
const cleanUser = (record) => ({ id: record.id, name: record.name, email: record.email, role: record.role, ...(record.client_id ? { clientId: record.client_id } : {}) });
const sha = value => createHash('sha256').update(value).digest('hex');

export function createApi({ app, db, seed = true, config = {} }) {
  db.exec(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK(role IN ('admin','coach','client')), client_id TEXT,
    password_hash TEXT NOT NULL
  ); CREATE TABLE IF NOT EXISTS auth_sessions (
    token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL
  ); CREATE INDEX IF NOT EXISTS auth_sessions_expiry ON auth_sessions(expires_at);`);
  db.exec(`CREATE TABLE IF NOT EXISTS client_invitations (
    id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
    email TEXT NOT NULL, goal TEXT NOT NULL, coach_id TEXT NOT NULL REFERENCES users(id),
    created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, used_at INTEGER, revoked_at INTEGER
  );`);
  for (const table of tables) db.exec(`CREATE TABLE IF NOT EXISTS ${table} (id TEXT PRIMARY KEY, json TEXT NOT NULL CHECK(json_valid(json)));`);
  if (seed) seedDatabase(db);
  else if (!db.prepare('SELECT id FROM users LIMIT 1').get() && (config.FORM_ADMIN_EMAIL || config.FORM_ADMIN_PASSWORD)) {
    const email = emailValue(config.FORM_ADMIN_EMAIL);
    const password = passwordValue(config.FORM_ADMIN_PASSWORD, 'Initial admin password');
    const name = str(config.FORM_ADMIN_NAME || 'Administrator', 'Admin name', 120, true);
    db.prepare('INSERT INTO users(id,name,email,role,client_id,password_hash) VALUES (?,?,?,?,?,?)').run(`user-${randomUUID()}`, name, email, 'admin', null, passwordHash(password));
  }
  const all = table => db.prepare(`SELECT json FROM ${table}`).all().map(row => JSON.parse(row.json));
  const get = (table, id) => {
    if (typeof id !== 'string') return undefined;
    const row = db.prepare(`SELECT json FROM ${table} WHERE id=?`).get(id);
    return row ? JSON.parse(row.json) : undefined;
  };
  const save = (table, entity) => {
    db.prepare(`INSERT INTO ${table}(id,json) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET json=excluded.json`).run(entity.id, JSON.stringify(entity));
    return entity;
  };
  const requiredEntity = (table, id) => get(table, id) || fail(404, 'Record was not found.');
  app.disable('x-powered-by');
  app.locals.db = db;
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (req.path.startsWith('/api/')) res.set('Cache-Control', 'no-store');
    next();
  });
  app.use('/api', (req, res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.get('origin');
      if (origin) {
        let parsed;
        try { parsed = new URL(origin); } catch { return res.status(403).json({ error: 'Invalid request origin.' }); }
        const allowed = (config.FORM_ALLOWED_ORIGINS || '').split(',').filter(Boolean);
        if (!['http:', 'https:'].includes(parsed.protocol) || (parsed.host !== req.get('host') && !allowed.includes(parsed.origin))) return res.status(403).json({ error: 'Request origin is not allowed.' });
      }
      if (req.get('sec-fetch-site') === 'cross-site') return res.status(403).json({ error: 'Cross-site requests are not allowed.' });
      const emptyAllowed = req.method === 'DELETE' || req.path === '/auth/logout';
      if (emptyAllowed && req.body === undefined && (!req.get('content-length') || req.get('content-length') === '0') && !req.get('transfer-encoding')) req.body = {};
      else if (!req.is('application/json')) return res.status(415).json({ error: 'Use application/json for API requests.' });
      if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) return res.status(400).json({ error: 'Request body must be an object.' });
    }
    next();
  });
  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.get('/api/config', (req, res) => res.json({ demoMode: seed, setupRequired: !seed && !!config.TRAIN_SETUP_TOKEN && !db.prepare('SELECT id FROM users LIMIT 1').get() }));
  const cookie = req => {
    const match = (req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith('form_session='));
    return match ? match.slice('form_session='.length) : '';
  };
  const sessionCookie = (req, token, maxAge) => `form_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${req.secure || config.FORM_COOKIE_SECURE === '1' ? '; Secure' : ''}`;
  const loginAttempts = new Map();
  const dummyHash = passwordHash(randomBytes(24).toString('hex'));
  const signIn = (req, res, account) => {
    const now = Date.now();
    db.prepare('DELETE FROM auth_sessions WHERE expires_at < ?').run(now);
    const oldToken = cookie(req);
    if (oldToken) db.prepare('DELETE FROM auth_sessions WHERE token_hash=?').run(sha(oldToken));
    const token = randomBytes(32).toString('hex');
    db.prepare('INSERT INTO auth_sessions(token_hash,user_id,expires_at) VALUES (?,?,?)').run(sha(token), account.id, now + SESSION_DAYS * 86_400_000);
    res.set('Set-Cookie', sessionCookie(req, token, SESSION_DAYS * 86_400));
    return { user: cleanUser(account) };
  };
  const validInvitation = token => {
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) fail(404, 'This invitation is invalid or no longer available. Ask your coach for a new link.');
    const invite = db.prepare('SELECT * FROM client_invitations WHERE token_hash=? AND expires_at>? AND used_at IS NULL AND revoked_at IS NULL').get(sha(token), Date.now());
    if (!invite) fail(404, 'This invitation is invalid or no longer available. Ask your coach for a new link.');
    return invite;
  };
  const requireSetup = token => {
    if (seed || typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token) || !config.TRAIN_SETUP_TOKEN || sha(token) !== sha(config.TRAIN_SETUP_TOKEN)) fail(404, 'This workspace setup link is invalid.');
    if (db.prepare('SELECT id FROM users LIMIT 1').get()) fail(409, 'This workspace is already set up. Please sign in.');
  };
  app.get('/api/auth/setup/:token', (req, res) => { requireSetup(req.params.token); res.json({ available: true }); });
  app.post('/api/auth/setup', (req, res) => {
    checkKeys(req.body, ['token', 'name', 'email', 'password']);
    requireSetup(req.body.token);
    const name = str(req.body.name, 'Full name', 120, true), email = emailValue(req.body.email);
    const hashed = passwordHash(passwordValue(req.body.password));
    const account = { id: `user-${randomUUID()}`, name, email, role: 'admin' };
    const signedIn = db.transaction(() => {
      requireSetup(req.body.token);
      db.prepare('INSERT INTO users(id,name,email,role,client_id,password_hash) VALUES (?,?,?,?,?,?)').run(account.id, name, email, 'admin', null, hashed);
      seedExerciseLibrary(db);
      return signIn(req, res, account);
    });
    res.status(201).json(signedIn);
  });
  app.get('/api/auth/invitations/:token', (req, res) => {
    const invite = validInvitation(req.params.token);
    const coach = db.prepare('SELECT name FROM users WHERE id=?').get(invite.coach_id);
    res.json({ name: invite.name, email: invite.email, goal: invite.goal, coachName: coach.name, expiresAt: invite.expires_at, demoMode: seed });
  });
  app.post('/api/auth/register', (req, res) => {
    checkKeys(req.body, ['token', 'name', 'password', 'goal']);
    const invite = validInvitation(req.body.token);
    const name = str(req.body.name, 'Full name', 120, true);
    const goal = str(req.body.goal ?? invite.goal, 'Training goal', 2000);
    const hashed = passwordHash(passwordValue(req.body.password));
    if (db.prepare('SELECT id FROM users WHERE email=?').get(invite.email)) fail(409, 'An account with this email already exists. Please sign in.');
    const client = { id: `client-${randomUUID()}`, userId: `user-${randomUUID()}`, coachId: invite.coach_id, name, email: invite.email, goal, equipment: [], color: '#e7efbb', joinedAt: new Date().toISOString().slice(0, 10) };
    const signedIn = db.transaction(() => {
      validInvitation(req.body.token);
      db.prepare('INSERT INTO users(id,name,email,role,client_id,password_hash) VALUES (?,?,?,?,?,?)').run(client.userId, name, invite.email, 'client', client.id, hashed);
      save('clients', client);
      db.prepare('UPDATE client_invitations SET used_at=? WHERE id=?').run(Date.now(), invite.id);
      return signIn(req, res, { id: client.userId, name, email: invite.email, role: 'client', client_id: client.id });
    });
    res.status(201).json(signedIn);
  });
  app.post('/api/auth/login', (req, res) => {
    const email = emailValue(req.body.email);
    const password = passwordValue(req.body.password, 'Password', 1);
    const attemptKey = req.ip;
    const now = Date.now();
    const attempt = loginAttempts.get(attemptKey);
    if (attempt && now - attempt.started < 900_000 && attempt.count >= 20) fail(429, 'Too many login attempts. Try again in 15 minutes.');
    if (loginAttempts.size > 10_000) for (const [key, value] of loginAttempts) if (now - value.started >= 900_000) loginAttempts.delete(key);
    const account = db.prepare('SELECT * FROM users WHERE email=?').get(email);
    const valid = verifyPassword(password, account?.password_hash || dummyHash);
    if (!account || !valid) {
      loginAttempts.set(attemptKey, attempt && now - attempt.started < 900_000 ? { ...attempt, count: attempt.count + 1 } : { started: now, count: 1 });
      fail(401, 'Email or password is incorrect.');
    }
    loginAttempts.delete(attemptKey);
    res.json(signIn(req, res, account));
  });
  app.post('/api/auth/logout', (req, res) => {
    const token = cookie(req);
    if (token) db.prepare('DELETE FROM auth_sessions WHERE token_hash=?').run(sha(token));
    res.set('Set-Cookie', sessionCookie(req, '', 0));
    res.json({ ok: true });
  });
  app.use('/api', (req, res, next) => {
    const token = cookie(req);
    if (!/^[a-f0-9]{64}$/.test(token)) return res.status(401).json({ error: 'Please sign in to continue.' });
    const account = db.prepare('SELECT users.* FROM users JOIN auth_sessions ON users.id=auth_sessions.user_id WHERE auth_sessions.token_hash=? AND auth_sessions.expires_at>?').get(sha(token), Date.now());
    if (!account) return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
    req.user = cleanUser(account);
    next();
  });
  const admin = req => { if (req.user.role !== 'admin') fail(403, 'Only an admin can manage the exercise library.'); };
  const trainer = req => { if (!['admin', 'coach'].includes(req.user.role)) fail(403, 'Only a coach can perform this action.'); };
  const canAccess = (user, client) => user.role === 'admin' || (user.role === 'coach' && client.coachId === user.id) || (user.role === 'client' && user.clientId === client.id);
  const clientFor = (req, id) => {
    const client = requiredEntity('clients', id);
    if (!canAccess(req.user, client)) fail(403, 'You do not have access to this client.');
    return client;
  };
  const checkCoach = coachId => {
    const coach = db.prepare('SELECT * FROM users WHERE id=?').get(coachId);
    if (!coach || !['admin', 'coach'].includes(coach.role)) fail(400, 'Choose a valid coach.');
    return coachId;
  };
  const checkKeys = (body, allowed) => {
    const unknown = Object.keys(body).find(key => !allowed.includes(key));
    if (unknown) fail(400, `Unexpected field: ${unknown}.`);
  };
  app.get('/api/auth/me', (req, res) => res.json({ user: req.user }));
  app.post('/api/auth/password', (req, res) => {
    checkKeys(req.body, ['currentPassword', 'newPassword']);
    const currentPassword = passwordValue(req.body.currentPassword, 'Current password', 1);
    const newPassword = passwordValue(req.body.newPassword, 'New password');
    const account = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
    if (!verifyPassword(currentPassword, account.password_hash)) fail(400, 'Current password is incorrect.');
    const hashed = passwordHash(newPassword);
    db.transaction(() => {
      db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(hashed, req.user.id);
      db.prepare('DELETE FROM auth_sessions WHERE user_id=? AND token_hash<>?').run(req.user.id, sha(cookie(req)));
      
    });
    res.json({ ok: true });
  });
  app.post('/api/users', (req, res) => {
    admin(req); checkKeys(req.body, ['name', 'email', 'password', 'role']);
    if (req.body.role !== 'coach') fail(400, 'This endpoint creates coach accounts.');
    const name = str(req.body.name, 'Coach name', 120, true);
    const email = emailValue(req.body.email);
    const password = passwordValue(req.body.password, 'Initial password');
    if (db.prepare('SELECT id FROM users WHERE email=?').get(email)) fail(409, 'An account with that email already exists.');
    const id = `user-${randomUUID()}`;
    db.prepare('INSERT INTO users(id,name,email,role,client_id,password_hash) VALUES (?,?,?,?,?,?)').run(id, name, email, 'coach', null, passwordHash(password));
    res.status(201).json({ id, name, email, role: 'coach' });
  });
  app.patch('/api/users/:id', (req, res) => {
    admin(req); checkKeys(req.body, ['name', 'email', 'password']);
    const account = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
    if (!account) fail(404, 'Account was not found.');
    if (!['admin', 'coach'].includes(account.role)) fail(400, 'Update client accounts through their client profile.');
    const name = own(req.body, 'name') ? str(req.body.name, 'Name', 120, true) : account.name;
    const email = own(req.body, 'email') ? emailValue(req.body.email) : account.email;
    if (db.prepare('SELECT id FROM users WHERE email=? AND id<>?').get(email, account.id)) fail(409, 'An account with that email already exists.');
    const hashed = own(req.body, 'password') ? passwordHash(passwordValue(req.body.password, 'New password')) : account.password_hash;
    db.transaction(() => {
      db.prepare('UPDATE users SET name=?,email=?,password_hash=? WHERE id=?').run(name, email, hashed, account.id);
      if (own(req.body, 'password')) db.prepare('DELETE FROM auth_sessions WHERE user_id=?').run(account.id);
      
    });
    res.json({ id: account.id, name, email, role: account.role });
  });
  app.get('/api/bootstrap', (req, res) => {
    const clients = all('clients').filter(client => canAccess(req.user, client));
    const clientIds = new Set(clients.map(client => client.id));
    const userIds = new Set([req.user.id, ...clients.map(client => client.userId), ...clients.map(client => client.coachId)]);
    const users = db.prepare('SELECT * FROM users').all().filter(user => req.user.role === 'admin' || userIds.has(user.id)).map(cleanUser);
    const filtered = table => all(table).filter(entity => clientIds.has(entity.clientId));
    const invitations = req.user.role === 'client' ? [] : db.prepare('SELECT id,name,email,goal,coach_id,expires_at,used_at,revoked_at FROM client_invitations').all().filter(invite => req.user.role === 'admin' || invite.coach_id === req.user.id).map(invite => ({ id: invite.id, name: invite.name, email: invite.email, coachId: invite.coach_id, expiresAt: invite.expires_at, status: invite.used_at ? 'Joined' : invite.revoked_at ? 'Revoked' : invite.expires_at <= Date.now() ? 'Expired' : 'Pending' }));
    res.json({ demoMode: seed, user: req.user, users, invitations, exercises: all('exercises'), clients, plans: filtered('plans'), sessions: filtered('training_sessions'), logs: filtered('logs'), measurements: filtered('measurements'), assessments: filtered('assessments') });
  });

  app.post('/api/invitations', (req, res) => {
    trainer(req); checkKeys(req.body, ['name', 'email', 'goal', 'coachId']);
    const name = str(req.body.name, 'Client name', 120, true), email = emailValue(req.body.email);
    const goal = str(req.body.goal ?? '', 'Training goal', 2000);
    const coachId = req.body.coachId ?? req.user.id;
    if (req.user.role === 'coach' && coachId !== req.user.id) fail(403, 'You can only invite clients to your own workspace.');
    checkCoach(coachId);
    if (db.prepare('SELECT id FROM users WHERE email=?').get(email)) fail(409, 'An account with that email already exists.');
    const token = randomBytes(32).toString('hex'), id = `invite-${randomUUID()}`, now = Date.now(), expiresAt = now + 7 * 86_400_000;
    db.transaction(() => {
      db.prepare('UPDATE client_invitations SET revoked_at=? WHERE email=? AND coach_id=? AND used_at IS NULL AND revoked_at IS NULL').run(now, email, coachId);
      db.prepare('INSERT INTO client_invitations(id,token_hash,name,email,goal,coach_id,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?)').run(id, sha(token), name, email, goal, coachId, now, expiresAt);
    });
    res.status(201).json({ id, token, expiresAt });
  });
  app.delete('/api/invitations/:id', (req, res) => {
    trainer(req);
    const invite = db.prepare('SELECT * FROM client_invitations WHERE id=?').get(req.params.id);
    if (!invite) fail(404, 'Invitation was not found.');
    if (req.user.role !== 'admin' && invite.coach_id !== req.user.id) fail(403, 'You do not have access to this invitation.');
    db.prepare('UPDATE client_invitations SET revoked_at=? WHERE id=? AND used_at IS NULL').run(Date.now(), invite.id);
    res.json({ ok: true });
  });

  const exerciseKeys = ['name', 'category', 'muscles', 'equipment', 'difficulty', 'instructions', 'cues', 'videoUrl', 'alternatives', 'archived'];
  const validateExercise = (body, id) => {
    const videoUrl = str(body.videoUrl ?? '', 'Video URL', 2000);
    if (videoUrl) {
      let url;
      try { url = new URL(videoUrl); } catch { fail(400, 'Video link must be a valid HTTPS URL.'); }
      if (url.protocol !== 'https:' || url.username || url.password) fail(400, 'Video link must be a valid HTTPS URL.');
    }
    const alternatives = stringList(body.alternatives ?? [], 'Alternatives');
    for (const alternative of alternatives) {
      const exercise = get('exercises', alternative);
      if (alternative === id || !exercise || exercise.archived) fail(400, 'Alternatives must be active exercises other than this exercise.');
    }
    const difficulty = str(body.difficulty ?? 'Beginner', 'Difficulty', 50, true);
    if (!['Beginner', 'Intermediate', 'Advanced'].includes(difficulty)) fail(400, 'Choose Beginner, Intermediate, or Advanced difficulty.');
    if (own(body, 'archived') && typeof body.archived !== 'boolean') fail(400, 'Archived must be true or false.');
    return { id, name: str(body.name, 'Exercise name', 120, true), category: str(body.category, 'Category', 80, true), muscles: str(body.muscles ?? '', 'Muscles', 200), equipment: stringList(body.equipment ?? [], 'Equipment'), difficulty, instructions: str(body.instructions ?? '', 'Instructions', 5000), cues: str(body.cues ?? '', 'Coaching cues', 2000), videoUrl, alternatives, archived: body.archived ?? false };
  };
  const persistExercise = exercise => {
    save('exercises', exercise);
    if (exercise.archived) for (const other of all('exercises')) if (other.alternatives.includes(exercise.id)) save('exercises', { ...other, alternatives: other.alternatives.filter(id => id !== exercise.id) });
    return exercise;
  };
  app.post('/api/exercises', (req, res) => {
    admin(req); checkKeys(req.body, exerciseKeys);
    res.status(201).json(persistExercise(validateExercise(req.body, `ex-${randomUUID()}`)));
  });
  app.patch('/api/exercises/:id', (req, res) => {
    admin(req); checkKeys(req.body, exerciseKeys);
    const current = requiredEntity('exercises', req.params.id);
    res.json(persistExercise(validateExercise({ ...current, ...req.body }, current.id)));
  });
  app.delete('/api/exercises/:id', (req, res) => {
    admin(req);
    const current = requiredEntity('exercises', req.params.id);
    persistExercise({ ...current, archived: true });
    res.json({ ok: true });
  });

  const clientKeys = ['name', 'email', 'password', 'goal', 'equipment', 'color', 'coachId'];
  app.post('/api/clients', (req, res) => {
    trainer(req); checkKeys(req.body, clientKeys);
    const name = str(req.body.name, 'Client name', 120, true);
    const email = emailValue(req.body.email);
    const password = passwordValue(req.body.password, 'Initial password');
    if (db.prepare('SELECT id FROM users WHERE email=?').get(email)) fail(409, 'An account with that email already exists.');
    const coachId = req.body.coachId ?? req.user.id;
    if (req.user.role === 'coach' && coachId !== req.user.id) fail(403, 'You can only assign clients to yourself.');
    checkCoach(coachId);
    const color = str(req.body.color ?? '#e7efbb', 'Color', 20);
    if (!/^#[a-fA-F0-9]{6}$/.test(color)) fail(400, 'Color must be a six-digit hex color.');
    const client = { id: `client-${randomUUID()}`, userId: `user-${randomUUID()}`, coachId, name, email, goal: str(req.body.goal ?? '', 'Goal', 2000), equipment: stringList(req.body.equipment ?? [], 'Equipment'), color, joinedAt: new Date().toISOString().slice(0, 10) };
    const hashed = passwordHash(password);
    db.transaction(() => {
      db.prepare('INSERT INTO users(id,name,email,role,client_id,password_hash) VALUES (?,?,?,?,?,?)').run(client.userId, name, email, 'client', client.id, hashed);
      save('clients', client); 
    });
    res.status(201).json(client);
  });
  app.patch('/api/clients/:id', (req, res) => {
    const current = clientFor(req, req.params.id);
    if (req.user.role === 'client') {
      checkKeys(req.body, ['equipment']);
      return res.json(save('clients', { ...current, equipment: stringList(req.body.equipment, 'Equipment') }));
    }
    trainer(req); checkKeys(req.body, clientKeys.filter(key => key !== 'password'));
    const next = { ...current, ...req.body };
    next.name = str(next.name, 'Client name', 120, true); next.email = emailValue(next.email);
    next.goal = str(next.goal, 'Goal', 2000); next.equipment = stringList(next.equipment, 'Equipment');
    next.color = str(next.color, 'Color', 20);
    if (!/^#[a-fA-F0-9]{6}$/.test(next.color)) fail(400, 'Color must be a six-digit hex color.');
    if (req.user.role === 'coach' && next.coachId !== req.user.id) fail(403, 'Only an admin can reassign a client.');
    checkCoach(next.coachId);
    if (next.coachId !== current.coachId) {
      const sessions = all('training_sessions');
      const assigned = new Set(all('clients').filter(client => client.coachId === next.coachId && client.id !== current.id).map(client => client.id));
      const conflict = sessions.filter(session => session.clientId === current.id).some(session => {
        const start = Number(session.time.slice(0, 2)) * 60 + Number(session.time.slice(3));
        return sessions.some(other => {
          if (other.date !== session.date || !assigned.has(other.clientId)) return false;
          const otherStart = Number(other.time.slice(0, 2)) * 60 + Number(other.time.slice(3));
          return start < otherStart + other.duration && start + session.duration > otherStart;
        });
      });
      if (conflict) fail(409, 'This reassignment would overlap existing sessions for the new coach. Reschedule those sessions first.');
    }
    if (db.prepare('SELECT id FROM users WHERE email=? AND id<>?').get(next.email, current.userId)) fail(409, 'An account with that email already exists.');
    db.transaction(() => { db.prepare('UPDATE users SET name=?, email=? WHERE id=?').run(next.name, next.email, current.userId); save('clients', next);  });
    res.json(next);
  });

  const itemValue = (item, forLog = false) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) fail(400, 'Each workout item must be an object.');
    checkKeys(item, forLog ? ['exerciseId', 'sets', 'reps', 'weight'] : ['exerciseId', 'sets', 'reps', 'weight', 'rest', 'notes']);
    const exerciseId = str(item.exerciseId, 'Exercise ID', 100, true);
    const exercise = get('exercises', exerciseId);
    if (!exercise || (!forLog && exercise.archived)) fail(400, 'Choose an active exercise from the library.');
    return { exerciseId, sets: num(item.sets, 'Sets', 1, 100, true), reps: num(item.reps, 'Reps', 1, 1000, true), weight: num(item.weight ?? 0, 'Weight', 0, 2000), ...(!forLog ? { rest: num(item.rest ?? 60, 'Rest', 0, 3600, true), notes: str(item.notes ?? '', 'Exercise notes', 2000) } : {}) };
  };
  const itemsValue = (value, forLog = false) => {
    if (!Array.isArray(value) || !value.length || value.length > 40) fail(400, 'A workout needs 1–40 exercises.');
    const items = value.map(item => itemValue(item, forLog));
    if (new Set(items.map(item => item.exerciseId)).size !== items.length) fail(400, 'Choose each exercise only once per workout.');
    return items;
  };
  const validatePlan = (req, body, id) => {
    clientFor(req, body.clientId);
    return { id, clientId: body.clientId, name: str(body.name, 'Workout name', 120, true), date: dateValue(body.date), items: itemsValue(body.items), notes: str(body.notes ?? '', 'Workout notes', 5000) };
  };
  const planKeys = ['clientId', 'name', 'date', 'items', 'notes'];
  app.post('/api/plans', (req, res) => { trainer(req); checkKeys(req.body, planKeys); res.status(201).json(save('plans', validatePlan(req, req.body, `plan-${randomUUID()}`))); });
  app.patch('/api/plans/:id', (req, res) => {
    trainer(req); checkKeys(req.body, planKeys);
    const current = requiredEntity('plans', req.params.id); clientFor(req, current.clientId);
    if (all('logs').some(log => log.planId === current.id)) fail(409, 'Completed workouts are kept as historical records and cannot be edited.');
    res.json(save('plans', validatePlan(req, { ...current, ...req.body }, current.id)));
  });
  app.delete('/api/plans/:id', (req, res) => {
    trainer(req); const current = requiredEntity('plans', req.params.id); clientFor(req, current.clientId);
    if (all('logs').some(log => log.planId === current.id)) fail(409, 'Completed workouts are kept as historical records and cannot be deleted.');
    db.prepare('DELETE FROM plans WHERE id=?').run(current.id); res.json({ ok: true });
  });

  const sessionKeys = ['clientId', 'date', 'time', 'duration', 'type', 'location', 'notes'];
  const validateSession = (req, body, id) => {
    const client = clientFor(req, body.clientId);
    const date = dateValue(body.date);
    const time = str(body.time, 'Time', 5, true);
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) fail(400, 'Time must use HH:MM in 24-hour format.');
    if (!['In person', 'Online'].includes(body.type)) fail(400, 'Session type must be In person or Online.');
    const duration = num(body.duration ?? 60, 'Duration', 5, 480, true);
    const location = str(body.location ?? '', 'Location or meeting link', 2000);
    if (body.type === 'Online' && location) {
      let url;
      try { url = new URL(location); } catch { fail(400, 'Online meeting link must be a valid HTTPS URL.'); }
      if (url.protocol !== 'https:' || url.username || url.password) fail(400, 'Online meeting link must be a valid HTTPS URL.');
    }
    const start = Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
    if (start + duration > 1440) fail(400, 'A session must finish on its scheduled day.');
    const collision = all('training_sessions').some(session => {
      if (session.id === id || session.date !== date) return false;
      const otherClient = get('clients', session.clientId);
      if (session.clientId !== client.id && otherClient?.coachId !== client.coachId) return false;
      const otherStart = Number(session.time.slice(0, 2)) * 60 + Number(session.time.slice(3));
      return start < otherStart + session.duration && start + duration > otherStart;
    });
    if (collision) fail(409, 'This session overlaps another session for the client or their coach.');
    return { id, clientId: body.clientId, date, time, duration, type: body.type, location, notes: str(body.notes ?? '', 'Session notes', 5000) };
  };
  app.post('/api/sessions', (req, res) => { trainer(req); checkKeys(req.body, sessionKeys); res.status(201).json(save('training_sessions', validateSession(req, req.body, `session-${randomUUID()}`))); });
  app.patch('/api/sessions/:id', (req, res) => {
    trainer(req); checkKeys(req.body, sessionKeys);
    const current = requiredEntity('training_sessions', req.params.id); clientFor(req, current.clientId);
    res.json(save('training_sessions', validateSession(req, { ...current, ...req.body }, current.id)));
  });
  app.delete('/api/sessions/:id', (req, res) => {
    trainer(req); const current = requiredEntity('training_sessions', req.params.id); clientFor(req, current.clientId);
    db.prepare('DELETE FROM training_sessions WHERE id=?').run(current.id); res.json({ ok: true });
  });

  app.post('/api/logs', (req, res) => {
    checkKeys(req.body, ['clientId', 'planId', 'date', 'items', 'notes']);
    const plan = requiredEntity('plans', req.body.planId);
    clientFor(req, plan.clientId);
    if (req.body.clientId !== plan.clientId) fail(400, 'The workout and client must match.');
    if (all('logs').some(log => log.planId === plan.id)) fail(409, 'This workout has already been completed.');
    const date = dateValue(req.body.date ?? new Date().toISOString().slice(0, 10));
    const items = itemsValue(req.body.items, true);
    const expected = new Set(plan.items.map(item => item.exerciseId));
    if (items.length !== expected.size || items.some(item => !expected.has(item.exerciseId))) fail(400, 'Record a result for every exercise in this workout.');
    const log = { id: `log-${randomUUID()}`, clientId: plan.clientId, planId: plan.id, date, items, notes: str(req.body.notes ?? '', 'Workout notes', 5000) };
    res.status(201).json(save('logs', log));
  });
  app.post('/api/measurements', (req, res) => {
    checkKeys(req.body, ['clientId', 'date', 'weight', 'height', 'waist', 'hip']);
    clientFor(req, req.body.clientId);
    const measurement = { id: `measurement-${randomUUID()}`, clientId: req.body.clientId, date: dateValue(req.body.date), weight: num(req.body.weight, 'Weight (kg)', 1, 500), height: num(req.body.height, 'Height (cm)', 50, 250), waist: num(req.body.waist, 'Waist (cm)', 1, 300), hip: num(req.body.hip, 'Hip (cm)', 1, 300) };
    res.status(201).json(save('measurements', measurement));
  });
  app.post('/api/assessments', (req, res) => {
    trainer(req); checkKeys(req.body, ['clientId', 'date', 'name', 'result', 'unit', 'notes']); clientFor(req, req.body.clientId);
    const assessment = { id: `assessment-${randomUUID()}`, clientId: req.body.clientId, date: dateValue(req.body.date), name: str(req.body.name, 'Assessment name', 120, true), result: num(req.body.result, 'Result', 0, 100000), unit: str(req.body.unit ?? 'reps', 'Unit', 40, true), notes: str(req.body.notes ?? '', 'Assessment notes', 5000) };
    res.status(201).json(save('assessments', assessment));
  });
  app.use('/api', (req, res) => res.status(404).json({ error: 'API route was not found.' }));
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body contains invalid JSON.' });
    if (error.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large.' });
    const status = Number.isInteger(error.status) ? error.status : 500;
    if (status >= 500) console.error('API request failed:', error.message);
    res.status(status).json({ error: status >= 500 ? 'Something went wrong. Please try again.' : error.message });
  });
  return app;
}
