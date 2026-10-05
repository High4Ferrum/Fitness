import { randomBytes, scryptSync } from 'node:crypto';
import { exerciseAdditions } from './exercise-additions.mjs';

export function passwordHash(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
}

export function seedDatabase(db) {
  if (db.prepare('SELECT COUNT(*) AS count FROM users').get().count) return;
  const user = db.prepare('INSERT INTO users (id,name,email,role,client_id,password_hash) VALUES (?,?,?,?,?,?)');
  const hash = passwordHash('FormDemo123!');
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7));
  const day = (offset) => {
    const date = new Date(monday);
    date.setUTCDate(date.getUTCDate() + offset);
    return date.toISOString().slice(0, 10);
  };
  const add = (table, value) => db.prepare(`INSERT INTO ${table} (id,json) VALUES (?,?)`).run(value.id, JSON.stringify(value));
  db.transaction(() => {
    user.run('user-admin', 'Alex Morgan', 'admin@form.fit', 'admin', null, hash);
    user.run('user-coach', 'Alex Morgan', 'coach@form.fit', 'coach', null, hash);
    const clients = [
      ['jamie', 'Jamie Chen', 'jamie@form.fit', 'Build strength and feel more confident in the gym', ['Barbell', 'Bench', 'Dumbbells', 'Resistance bands'], '#e7efbb'],
      ['maya', 'Maya Patel', 'maya@form.fit', 'Stay consistent with training and improve overall fitness', ['Dumbbells', 'Resistance bands'], '#dfd6f0'],
      ['chris', 'Chris Wilson', 'chris@form.fit', 'Improve strength and mobility for an active lifestyle', ['Barbell', 'Bench', 'Dumbbells', 'Stationary bike'], '#c8dfe8'],
      ['jordan', 'Jordan Davis', 'jordan@form.fit', 'Build a sustainable home workout routine', [], '#f4d6bb'],
    ];
    for (const [key, name, email, goal, equipment, color] of clients) {
      user.run(`user-${key}`, name, email, 'client', `client-${key}`, hash);
      add('clients', { id: `client-${key}`, userId: `user-${key}`, coachId: 'user-coach', name, email, goal, equipment, color, joinedAt: day(-56) });
    }
    seedExerciseLibrary(db);
    const item = (key, sets, reps, weight = 0, rest = 60, notes = '') => ({ exerciseId: `ex-${key}`, sets, reps, weight, rest, notes });
    const plans = [
      { id: 'plan-jamie-upper', clientId: 'client-jamie', name: 'Upper body strength', date: day(0), items: [item('bench', 3, 8, 65, 90), item('row', 3, 10, 25), item('shoulder-press', 3, 10, 15), item('dead-bug', 3, 10)], notes: 'A steady pace today. Leave 1–2 good reps in reserve.' },
      { id: 'plan-jamie-lower', clientId: 'client-jamie', name: 'Lower body & core', date: day(2), items: [item('goblet-squat', 3, 10, 30), item('deadlift', 3, 10, 25), item('lunge', 3, 10), item('plank', 3, 1, 0, 45, 'Hold for 30 seconds per set.')], notes: 'Warm up with a 5-minute walk and bodyweight squats.' },
      { id: 'plan-jamie-full', clientId: 'client-jamie', name: 'Full body flow', date: day(4), items: [item('goblet-squat', 3, 12, 25), item('db-bench', 3, 10, 25), item('row', 3, 12, 20), item('bridge', 3, 15)], notes: 'Finish with a comfortable 10-minute walk.' },
      { id: 'plan-maya-full', clientId: 'client-maya', name: 'Home strength', date: day(1), items: [item('goblet-squat', 3, 10, 20), item('floor-press', 3, 10, 15), item('band-row', 3, 12), item('dead-bug', 3, 10)], notes: 'Your home equipment is all you need.' },
      { id: 'plan-chris-strength', clientId: 'client-chris', name: 'Strength foundations', date: day(3), items: [item('bench', 3, 8, 85), item('deadlift', 3, 10, 35), item('row', 3, 10, 30)], notes: 'Prioritize smooth, controlled repetitions.' },
      { id: 'plan-jordan-home', clientId: 'client-jordan', name: 'Bodyweight basics', date: day(0), items: [item('squat', 3, 12), item('pushup', 3, 6), item('bridge', 3, 15), item('dead-bug', 3, 10)], notes: 'Take an extra break between sets if you need it.' },
    ];
    plans.forEach(p => add('plans', p));
    const completedHome = plans.find(plan => plan.id === 'plan-jordan-home');
    add('logs', { id: 'log-jordan-current', clientId: completedHome.clientId, planId: completedHome.id, date: completedHome.date, notes: 'Finished my first workout of the week. Push-ups are getting easier.', items: completedHome.items.map(({ exerciseId, sets, reps, weight }) => ({ exerciseId, sets, reps, weight })) });
    [40, 45, 50, 55, 60, 65].forEach((weight, index) => {
      const offset = -42 + index * 7;
      const plan = { id: `plan-jamie-history-${index}`, clientId: 'client-jamie', name: 'Upper body strength', date: day(offset), items: [item('bench', 3, 8, weight, 90), item('row', 3, 10, 20)], notes: 'Build strength one week at a time.' };
      add('plans', plan);
      add('logs', { id: `log-jamie-history-${index}`, clientId: 'client-jamie', planId: plan.id, date: plan.date, notes: index === 5 ? '65 lb felt strong! Ready to keep building.' : 'Completed all sets with controlled form.', items: plan.items.map(({ exerciseId, sets, reps, weight }) => ({ exerciseId, sets, reps, weight })) });
      add('measurements', { id: `measurement-jamie-${index}`, clientId: 'client-jamie', date: plan.date, weight: 76.4 - index * .3, height: 172, waist: 84 - index * .6, hip: 101 });
    });
    add('assessments', { id: 'assessment-jamie-pushups-first', clientId: 'client-jamie', date: day(-42), name: 'Push-ups', result: 8, unit: 'reps', notes: 'Full range with consistent technique.' });
    add('assessments', { id: 'assessment-jamie-pushups-now', clientId: 'client-jamie', date: day(-7), name: 'Push-ups', result: 15, unit: 'reps', notes: 'Great improvement in control and endurance.' });
    add('assessments', { id: 'assessment-jamie-squats', clientId: 'client-jamie', date: day(-7), name: 'Bodyweight squats', result: 24, unit: 'reps', notes: '60-second test. Good depth and knee alignment.' });
    for (const [key, weight, height, waist, hip] of [['maya', 64, 165, 76, 96], ['chris', 88, 182, 94, 103], ['jordan', 71, 175, 82, 99]]) {
      add('measurements', { id: `measurement-${key}`, clientId: `client-${key}`, date: day(-7), weight, height, waist, hip });
      add('assessments', { id: `assessment-${key}`, clientId: `client-${key}`, date: day(-7), name: 'Push-ups', result: key === 'chris' ? 18 : 9, unit: 'reps', notes: 'Initial assessment with controlled technique.' });
    }
    [
      ['jamie', 0, '09:00', 'In person', 'Studio · Strength floor'],
      ['maya', 0, '11:30', 'Online', 'https://meet.google.com/'],
      ['chris', 1, '14:00', 'In person', 'Studio · Strength floor'],
      ['jamie', 2, '09:00', 'Online', 'https://meet.google.com/'],
      ['jordan', 3, '10:00', 'Online', 'https://meet.google.com/'],
      ['maya', 4, '11:30', 'In person', 'Studio · Strength floor'],
    ].forEach(([key, offset, time, type, location], index) => add('training_sessions', { id: `session-${index}`, clientId: `client-${key}`, date: day(offset), time, duration: 60, type, location, notes: type === 'Online' ? 'Coach will share the meeting link before the session.' : 'Bring water and arrive a few minutes early.' }));
  });
}

export function seedExerciseLibrary(db) {
  const video = (name) => `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} proper form exercise demonstration`)}`;
  const definitions = [
    ['bench', 'Barbell bench press', 'Strength', 'Chest · Triceps', ['Barbell', 'Bench'], 'Intermediate', 'Lie on a bench with feet planted. Grip the bar slightly wider than shoulder width. Lower with control to the mid-chest, then press upward.', 'Keep wrists above elbows and shoulder blades set.', ['db-bench', 'pushup']],
    ['db-bench', 'Dumbbell bench press', 'Strength', 'Chest · Triceps', ['Dumbbells', 'Bench'], 'Beginner', 'Lie on the bench with a dumbbell in each hand. Lower until your upper arms are near parallel to the floor, then press upward.', 'Use a comfortable range and keep both hands moving together.', ['floor-press', 'pushup']],
    ['floor-press', 'Dumbbell floor press', 'Strength', 'Chest · Triceps', ['Dumbbells'], 'Beginner', 'Lie on the floor with knees bent. Lower the weights until your upper arms gently meet the floor, then press up.', 'Pause briefly on the floor without relaxing your shoulders.', ['pushup']],
    ['pushup', 'Push-up', 'Strength', 'Chest · Core', [], 'Beginner', 'Start in a high plank. Bend your elbows to lower your chest, then push the floor away to return.', 'Keep your body in one line. Use an elevated surface if needed.', ['incline-pushup']],
    ['incline-pushup', 'Incline push-up', 'Strength', 'Chest · Triceps', ['Bench'], 'Beginner', 'Place your hands on a stable bench. Walk your feet back and perform a controlled push-up.', 'Choose a higher surface to reduce difficulty.', ['pushup']],
    ['squat', 'Bodyweight squat', 'Strength', 'Quads · Glutes', [], 'Beginner', 'Stand with feet around shoulder width. Sit down between your hips, then stand tall.', 'Keep heels grounded and knees aligned with your toes.', ['goblet-squat']],
    ['goblet-squat', 'Goblet squat', 'Strength', 'Quads · Glutes', ['Dumbbells'], 'Beginner', 'Hold one dumbbell close to your chest. Squat through a comfortable range and stand.', 'Brace your trunk and keep the weight close.', ['squat']],
    ['deadlift', 'Romanian deadlift', 'Strength', 'Hamstrings · Glutes', ['Dumbbells'], 'Intermediate', 'Hold dumbbells in front of your thighs. Push your hips back with soft knees, then stand by extending your hips.', 'Keep the weights close and your back steady.', ['bridge']],
    ['row', 'Dumbbell bent-over row', 'Strength', 'Back · Biceps', ['Dumbbells'], 'Beginner', 'Hinge at the hips with knees slightly bent. Pull both dumbbells toward your ribs, then lower slowly.', 'Keep your torso still and shoulders away from your ears.', ['band-row']],
    ['band-row', 'Resistance band row', 'Strength', 'Back · Biceps', ['Resistance bands'], 'Beginner', 'Anchor a band securely at chest height. Pull your elbows back toward your ribs, then return with control.', 'Check the anchor before each set.', ['row']],
    ['shoulder-press', 'Dumbbell shoulder press', 'Strength', 'Shoulders · Triceps', ['Dumbbells'], 'Intermediate', 'Start with dumbbells at shoulder height. Press overhead through a comfortable range and lower.', 'Avoid arching your lower back.', ['lateral-raise']],
    ['lateral-raise', 'Dumbbell lateral raise', 'Strength', 'Shoulders', ['Dumbbells'], 'Beginner', 'Raise light dumbbells out to the sides with elbows slightly bent. Lower slowly.', 'Stop near shoulder height and avoid swinging.', ['shoulder-press']],
    ['lunge', 'Reverse lunge', 'Strength', 'Quads · Glutes', [], 'Beginner', 'Step one foot backward and lower into a split stance. Push through your front foot to stand.', 'Use a stable support for balance if needed.', ['squat']],
    ['bridge', 'Glute bridge', 'Strength', 'Glutes · Hamstrings', [], 'Beginner', 'Lie on your back with knees bent and feet flat. Lift your hips, pause, and lower.', 'Finish by squeezing your glutes without arching your back.', ['deadlift']],
    ['plank', 'Forearm plank', 'Core', 'Core · Shoulders', [], 'Beginner', 'Support yourself on your forearms and toes. Hold a straight body position while breathing normally.', 'Record hold duration in the workout notes.', ['dead-bug']],
    ['dead-bug', 'Dead bug', 'Core', 'Core', [], 'Beginner', 'Lie on your back with arms up and knees bent. Slowly extend the opposite arm and leg, then alternate.', 'Keep your lower back gently against the floor.', ['plank']],
    ['bike', 'Stationary bike', 'Cardio', 'Legs · Cardiovascular', ['Stationary bike'], 'Beginner', 'Adjust the seat for a slight bend in your knee at the bottom of each pedal stroke. Pedal at your prescribed intensity.', 'Record duration and effort in the workout notes.', ['walk']],
    ['walk', 'Brisk walk', 'Cardio', 'Legs · Cardiovascular', [], 'Beginner', 'Walk at a comfortable brisk pace on a safe, even route.', 'Use a pace that matches the coach’s prescribed effort.', ['bike']],
    ['hip-flexor', 'Half-kneeling hip flexor stretch', 'Mobility', 'Hip flexors', [], 'Beginner', 'Kneel with one foot forward. Gently tuck your pelvis and shift forward until you feel a comfortable stretch.', 'Avoid forcing the stretch or arching your back.', []],
  ];
  const existing = db.prepare('SELECT json FROM exercises').all().map(row => JSON.parse(row.json));
  const byId = new Map(existing.map(exercise => [exercise.id, exercise]));
  const normalize = name => name.trim().toLowerCase().replace(/[\s-]+/g, ' ');
  const byName = new Map(existing.map(exercise => [normalize(exercise.name), exercise]));
  const canonicalIds = new Map(), pending = [];
  for (const [key, name, category, muscles, equipment, difficulty, instructions, cues, alternatives, references] of [...definitions, ...exerciseAdditions]) {
    const id = `ex-${key}`, current = byId.get(id) || byName.get(normalize(name));
    if (current) { canonicalIds.set(id, current.id); continue; }
    const exercise = { id, name, category, muscles, equipment, difficulty, instructions, cues, videoUrl: video(name), alternatives: alternatives.map(a => `ex-${a}`), archived: false, ...(references ? { references } : {}) };
    pending.push(exercise); byId.set(id, exercise); byName.set(normalize(name), exercise); canonicalIds.set(id, id);
  }
  const insert = db.prepare('INSERT OR IGNORE INTO exercises(id,json) VALUES (?,?)');
  for (const exercise of pending) {
    exercise.alternatives = [...new Set(exercise.alternatives.map(id => canonicalIds.get(id) || id))].filter(id => id !== exercise.id && byId.has(id) && !byId.get(id).archived);
    insert.run(exercise.id, JSON.stringify(exercise));
  }
}
