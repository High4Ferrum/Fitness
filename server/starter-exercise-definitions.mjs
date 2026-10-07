import { starterExercises } from './starter-exercises.mjs';

// Equivalent names already present in the curated catalog. Keep their stable IDs
// and original coaching text, including when a workspace has customized them.
const aliases = {
  EX0025: ['chest-press-machine', 'Seated chest press'],
  EX0030: ['db-fly', 'Flat bench dumbbell fly'],
  EX0066: ['face-pull', 'Cable face pull'],
  EX0079: ['machine-overhead-press', 'Machine overhead press'],
  EX0081: ['cable-lateral-raise', 'Standing cable lateral raise'],
  EX0087: ['rear-delt-fly', 'Rear delt fly'],
  EX0101: ['db-curl', 'Standing dumbbell curl'],
  EX0104: ['hammer-curl', 'Standing hammer curl'],
  EX0118: ['rope-triceps-pushdown', 'Rope triceps press-down'],
  EX0176: ['deadlift', 'Romanian deadlift'],
  EX0246: ['pallof-press', 'Resistance band Pallof press'],
};
const equipmentNames = {
  Bodyweight: null, Dumbbell: 'Dumbbells', Cable: 'Cable machine',
  'Resistance Band': 'Resistance bands', 'Pull-Up Bar': 'Pull-up bar',
  'Assisted Machine': 'Assisted pull-up machine',
  'Leg Press Machine': 'Leg press machine', 'Stationary Bike': 'Stationary bike',
  'Barbell/Rack': 'Barbell', Box: 'Step or box', Platform: 'Step or box',
  'Plyo Box': 'Step or box', 'Battle Rope': 'Battle ropes',
};
function equipmentFor(row) {
  const equipment = row.equipment.split(';').map(item => item.trim())
    .flatMap(item => item === 'Barbell/Rack' ? ['Barbell', 'Rack']
      : [Object.hasOwn(equipmentNames, item) ? equipmentNames[item] : item])
    .filter(Boolean);
  // The source lists a generic machine for these movements. Use specific
  // names so possessing one machine does not imply access to every machine.
  const machine = equipment.indexOf('Machine');
  if (machine >= 0) equipment[machine] = `${row.exercise_name.replace(/ Machine$/i, '').toLowerCase()} machine`;
  if (/bench press|dumbbell fly|incline dumbbell curl|chest-supported|incline bench|bench dip/i.test(row.exercise_name)
      && !equipment.includes('Bench')) equipment.push('Bench');
  if (/back squat|front squat|pause squat|tempo squat|zercher squat/i.test(row.exercise_name)
      && equipment.includes('Barbell') && !equipment.includes('Rack')) equipment.push('Rack');
  return [...new Set(equipment)];
}

export const starterExerciseDefinitions = starterExercises.map(row => {
  const [key, name] = aliases[row.exercise_id] || [
    `starter-${row.exercise_id.toLowerCase()}`,
    // The original app's Romanian deadlift uses dumbbells; the spreadsheet's
    // generic Romanian deadlift explicitly uses a barbell and is distinct.
    row.exercise_id === 'EX0175' ? 'Barbell Romanian deadlift' : row.exercise_name,
  ];
  const category = ['Core', 'Mobility', 'Cardio'].includes(row.body_region)
    ? row.body_region : ['Conditioning', 'Locomotion', 'Jump'].includes(row.movement_pattern) ? 'Cardio' : 'Strength';
  const muscles = [...new Set([row.primary_muscle, ...(row.secondary_muscles || '').split(';')]
    .map(value => value.trim()).filter(Boolean))].join(' · ');
  return [key, name, category, muscles, equipmentFor(row), row.difficulty, '', row.notes || '', []];
});
