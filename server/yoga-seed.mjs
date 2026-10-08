import { flowSeconds } from '../shared/yoga-timing.mjs';
// Canonical Sanskrit is ASCII transliteration; modern variations retain the base name.
// Instructions are original. No third-party media or instructional scripts are copied.
const groups = [
['Standing','Standing', 'Legs, feet, posture', 'Keep feet grounded and knees tracking toward the toes.', 'Use a chair or wall for support; shorten your stance.', 'Avoid deep knee bends with painful knee or hip injury.', `
Mountain|Tadasana|Stand tall with feet hip-width apart and arms relaxed.
Raised Arms|Urdhva Hastasana|From standing, reach arms upward without flaring the ribs.
Chair|Utkatasana|Bend knees and sit hips back while keeping weight in the heels.
Warrior I|Virabhadrasana I|Step into a wide stance, bend the front knee and lift the arms; turn the back heel down comfortably.
Warrior II|Virabhadrasana II|Open into a wide stance, bend the front knee and reach arms in opposite directions.
Reverse Warrior|Viparita Virabhadrasana|From Warrior II, lift the front arm and lengthen the front side of the torso.
Extended Side Angle|Utthita Parsvakonasana|From Warrior II, rest the forearm on the thigh and reach the upper arm overhead.
Triangle|Utthita Trikonasana|Straighten the front leg comfortably, hinge over it and place a hand on a block.
High Lunge|Ashta Chandrasana|Step one foot back with heel raised, bend the front knee and reach upward.
Low Lunge|Anjaneyasana|Lower the back knee onto padding, keeping the front foot under the knee.
Goddess|Utkata Konasana|Take a wide turned-out stance and bend both knees with an upright torso.
Garland|Malasana|Squat with feet comfortably apart and use a block beneath the seat.
Gate|Parighasana|Kneel on padding, extend one leg to the side and lengthen the torso over that leg.
`],
['Forward Folds','Standing','Hamstrings, calves, back','Hinge from the hips and keep length through the spine.', 'Bend knees and support hands on blocks; stop before pulling.', 'Avoid deep folds with acute back pain or dizziness.', `
Standing Forward Fold|Uttanasana|From standing, soften the knees and fold from the hip creases.
Half Forward Fold|Ardha Uttanasana|From a fold, place hands on shins or blocks and lengthen the spine forward.
Wide-Legged Forward Fold|Prasarita Padottanasana|Set feet wide, hinge at the hips and support hands beneath shoulders.
Pyramid|Parsvottanasana|Stagger the feet, square the hips comfortably and hinge over the front leg.
`],
['Balance','Standing','Feet, ankles, hips, core','Fix your gaze and use stable support before lifting a foot.', 'Keep toes on the floor or hold a wall; reduce the range.', 'Use support for balance impairment; avoid painful joint loading.', `
Tree|Vrksasana|Shift onto one foot and place the other foot at the ankle or thigh, away from the knee.
Eagle|Garudasana|Bend knees, cross one thigh over the other and wrap arms only as far as comfortable.
Warrior III|Virabhadrasana III|Hinge over a standing leg and extend the other leg behind, using blocks.
Half Moon|Ardha Chandrasana|From triangle, bend the front knee, use a block and lift the back leg while opening the torso.
Dancer|Natarajasana|Hold one ankle or a strap and gently press the foot back while reaching forward.
Extended Hand-to-Big-Toe|Utthita Hasta Padangusthasana|Balance beside a wall, lift one knee and use a strap to extend the leg.
Standing Split|Urdhva Prasarita Eka Padasana|From a supported fold, lift one leg while keeping both hips directed down.
`],
['Seated','Seated','Hips, spine, shoulders','Sit on support and lengthen the spine without forcing the knees.', 'Elevate the seat on a blanket; use a strap or chair.', 'Avoid pressure on injured knees; do not force hip rotation.', `
Easy Seat|Sukhasana|Cross the shins comfortably and rest hands on the thighs.
Staff|Dandasana|Sit with legs extended and press hands beside the hips to grow tall.
Thunderbolt|Vajrasana|Kneel with shins grounded and sit on a block between or above the heels.
Hero|Virasana|Kneel with knees comfortable and sit on a high block between the feet.
Bound Angle|Baddha Konasana|Bring soles together and support both knees with blocks.
Seated Forward Fold|Paschimottanasana|Sit on a folded blanket, bend knees and hinge toward the legs.
Head-to-Knee|Janu Sirsasana|Extend one leg, bend the other comfortably and hinge over the extended leg.
Wide-Angle Seated Fold|Upavistha Konasana|Open legs to a comfortable width and hinge forward with support.
Cow Face|Gomukhasana|Stack bent legs only if comfortable and use a strap for the arm reach.
Fire Log|Agnistambhasana|Cross shins in front and support the upper knee rather than pushing it down.
Lotus|Padmasana|Only with established hip mobility, place feet on opposite thighs without pressure at the knees.
Half Lotus|Ardha Padmasana|Rest one foot on the opposite thigh only if the knee remains comfortable.
Boat|Navasana|Sit behind the sitting bones, lift the chest and raise bent knees while holding the thighs.
Half Boat|Ardha Navasana|Lower from boat with bent knees, keeping the lower back comfortable.
`],
['Twists','Seated','Spine, hips, shoulders','Lengthen first; rotate gently without using the arms to force depth.', 'Use a chair, keep feet grounded and twist only a little.', 'Avoid deep twists with acute spinal injury; use open twists in pregnancy with qualified guidance.', `
Half Lord of the Fishes|Ardha Matsyendrasana|Sit tall, cross one foot outside the opposite leg and rotate toward the bent knee.
Bharadvaja Twist|Bharadvajasana|Sit on support with bent legs to one side and turn the chest gently.
Sage Marichi Twist|Marichyasana III|Extend one leg, bend the other with foot grounded and gently rotate toward it.
Revolved Triangle|Parivrtta Trikonasana|From a short staggered stance, support a hand on a block and rotate the chest gently.
Revolved Side Angle|Parivrtta Parsvakonasana|From a supported lunge, turn toward the front leg with hands at the chest.
Revolved Half Moon|Parivrtta Ardha Chandrasana|Use blocks in a supported single-leg hinge and rotate gently toward the standing leg.
`],
['Backbends','Prone','Chest, spine, hips','Lengthen through the chest and avoid compressing the lower back or neck.', 'Use a small range; choose sphinx or supported bridge.', 'Avoid with acute back or neck injury; stop with pinching or nerve symptoms.', `
Cobra|Bhujangasana|Lie on the belly, place hands near ribs and lift the chest using back muscles.
Sphinx|Salamba Bhujangasana|Place elbows under shoulders while prone and lengthen the chest forward.
Locust|Salabhasana|From the belly, gently lift the chest and legs while keeping the neck long.
Bow|Dhanurasana|Bend knees, hold ankles or a strap and gently press feet back to lift the chest.
Upward-Facing Dog|Urdhva Mukha Svanasana|Press hands under shoulders and lift the chest and thighs with long arms.
Camel|Ustrasana|Kneel on padding, support the lower back with hands and gently lift the chest.
Bridge|Setu Bandha Sarvangasana|Lie on the back with feet near hips and press feet down to lift the pelvis.
Wheel|Urdhva Dhanurasana|With established strength and qualified supervision, press through feet and hands to lift from supine.
Fish|Matsyasana|From supine, use a bolster along the upper back to gently lift the chest; support the head.
Wild Thing|Camatkarasana|From supported side plank, step the upper foot behind and lift the chest only with stable shoulders.
`],
['Hip Openers','Supine','Hips, glutes, lower back','Keep the pelvis supported and do not force rotation through the knee.', 'Use a reclined figure four instead of pigeon; support with a bolster.', 'Avoid painful knee or hip rotation; reduce range after joint surgery with clinician guidance.', `
Pigeon|Eka Pada Rajakapotasana (preparation)|From all fours, bring one bent knee forward, extend the other leg back and support the front hip.
Reclined Figure Four|Supta Kapotasana (variation)|Lie on the back, cross one ankle over the opposite thigh and gently draw legs closer.
Happy Baby|Ananda Balasana|Lie on the back, bend knees beside ribs and hold thighs or feet without pulling.
Reclining Hand-to-Big-Toe|Supta Padangusthasana|Use a strap to raise one leg from supine while keeping the other knee bent if needed.
Lizard|Utthan Pristhasana|From a low lunge, place both hands inside the front foot and use blocks.
Frog|Mandukasana (variation)|On padded knees, widen them only slightly and support the chest on a bolster.
Half Split|Ardha Hanumanasana|From low lunge, shift hips back and extend the front leg with a soft knee.
Splits|Hanumanasana|Use blocks and a bolster beneath the pelvis; lengthen legs only within a pain-free range.
`],
['Warm-Up','Kneeling','Spine, shoulders, core','Move gently with the breath and keep wrists below shoulders.', 'Pad the knees or place hands on a chair to reduce wrist load.', 'Avoid bearing weight on painful wrists or knees.', `
Tabletop|Bharmanasana|Place hands under shoulders and knees under hips on padding.
Cat|Marjaryasana|From tabletop, exhale and gently round the spine while pressing the floor away.
Cow|Bitilasana|From tabletop, inhale and lift the chest and sitting bones without dropping the belly heavily.
Cat-Cow|Marjaryasana–Bitilasana|Alternate a gentle rounded spine on exhale with chest opening on inhale.
Bird Dog|Dandayamana Bharmanasana|From tabletop, extend opposite arm and leg while keeping hips level.
Child's Pose|Balasana|Bring hips toward heels and rest the forehead on support with knees comfortable.
Extended Puppy|Uttana Shishosana|From tabletop, walk hands forward and lower chest onto support while hips stay above knees.
Thread the Needle|Parsva Balasana|From tabletop, slide one arm under the other and rest the shoulder on padding.
`],
['Strength','Prone','Core, shoulders, arms','Press through the hands and keep shoulders stable without sagging.', 'Lower knees, use forearms or a wall; take frequent breaks.', 'Avoid unsupported weight bearing with wrist, shoulder or abdominal injury.', `
Plank|Phalakasana|Place hands under shoulders and extend legs, keeping a long line through the trunk.
Side Plank|Vasisthasana|From a knee-supported plank, turn to one side and keep the lower shoulder supported.
Four-Limbed Staff|Chaturanga Dandasana|From a knees-down plank, bend elbows close to ribs without lowering shoulders below elbows.
Dolphin Plank|Makara Adho Mukha Svanasana|Place forearms on the mat and step legs back, keeping ribs lifted.
Upward Plank|Purvottanasana|Sit with hands behind hips and press through feet and hands to lift hips.
Crow|Bakasana|With qualified guidance, squat with hands grounded and shift weight forward while keeping feet close to the floor.
Side Crow|Parsva Bakasana|With qualified guidance, start in a low twisted squat and practice weight shift with feet grounded.
`],
['Inversion','Inversion','Shoulders, legs, circulation','Use stable support; avoid pressure on the head or neck.', 'Choose legs on a chair; use a wall or qualified spotter for advanced variations.', 'Head/neck-loading inversions need qualified supervision; avoid with glaucoma, uncontrolled blood pressure or neck injury.', `
Downward-Facing Dog|Adho Mukha Svanasana|From tabletop, tuck toes and lift hips back with bent knees and a long spine.
Dolphin|Ardha Pincha Mayurasana|Set forearms parallel, tuck toes and lift hips while keeping the neck free.
Legs-Up-the-Wall|Viparita Karani|Lie beside a wall and rest legs upward with the pelvis comfortably away from the wall.
Supported Shoulderstand|Salamba Sarvangasana|Practice only with qualified instruction and appropriate shoulder support; keep the neck unloaded.
Plow|Halasana|Only with qualified instruction, support shoulders and feet; avoid neck pressure or turning the head.
Supported Headstand|Salamba Sirsasana|Requires qualified supervision and established shoulder strength; substitute dolphin when learning.
Handstand|Adho Mukha Vrksasana|Practice wall-supported preparation with a qualified spotter rather than kicking up unsupervised.
Forearm Balance|Pincha Mayurasana|Use wall-supported preparation with a qualified spotter and stable forearms.
`],
['Restorative','Supine','Whole body, breath','Arrange supports before relaxing; breathe naturally without holding the breath.', 'Use a bolster, blankets or a chair; side-lying rest is an option.', 'Choose side-lying rest when lying flat is uncomfortable, including later pregnancy; stop if dizzy.', `
Corpse|Savasana|Lie on the back with knees supported and let arms rest comfortably.
Reclining Bound Angle|Supta Baddha Konasana|Lie supported on a bolster, bring soles together and support both thighs.
Knees-to-Chest|Apanasana|From supine, gently draw knees toward the torso while keeping the neck relaxed.
Supine Twist|Supta Matsyendrasana|From supine, lower bent knees to one side onto support while keeping shoulders comfortable.
Crocodile|Makarasana|Lie prone with the forehead supported on the forearms and breathe naturally.
`],
];
const advanced = /Lotus|Wheel|Splits|Crow|Shoulderstand|Plow|Headstand|Handstand|Forearm Balance|Wild Thing/;
const intermediate = /Warrior III|Half Moon|Dancer|Eagle|Boat|Bow|Camel|Upward|Revolved|Pigeon|Side Plank|Four-Limbed/;
export const yogaPoses = groups.flatMap(([category,position,targetAreas,alignment,modifications,safety,lines]) => lines.trim().split('\n').map(line => {
 const [name,sanskritName,instructions]=line.split('|');
 const actualPosition = /Thunderbolt|Hero|Gate/.test(name)?'Kneeling':/Bridge|Wheel|Fish/.test(name)?'Supine':name==='Camel'?'Kneeling':category==='Twists'&&name.startsWith('Revolved')?'Standing':category==='Hip Openers'&&/Pigeon|Lizard|Frog|Half Split|Splits/.test(name)?'Kneeling':name==='Crocodile'?'Prone':position;
 return { id:`pose-${name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/-$/,'')}`, name,sanskritName,chineseName:'',aliases:[...(name==='Corpse'?['Final Relaxation','Shavasana']:[]),...(name==='Tree'?['Vrikshasana']:[]),...(name==='Pigeon'?['Pigeon preparation']:[])],category,difficulty:advanced.test(name)?'Advanced':intermediate.test(name)?'Intermediate':'Beginner',targetAreas,movementType:category==='Warm-Up'?'Dynamic':'Static',position:actualPosition,recommendedHold:category==='Restorative'?180:30,breathInstructions:'Breathe comfortably through the nose if possible. Never strain or hold the breath.',instructions,alignmentCues:alignment,commonMistakes:'Forcing the range, holding the breath or ignoring joint pain.',modifications,contraindications:safety,equipment:['Yoga mat',...(/Restorative|Seated/.test(category)?['Blanket','Bolster']:['Blocks'])],imageUrl:'',videoUrl:'',active:true };
}));
// Supported variations are separate selectable poses, with explicit variation names.
for (const name of ['Mountain','Chair','Warrior I','Warrior II','Triangle','High Lunge','Low Lunge','Tree','Warrior III','Half Moon','Dancer','Standing Forward Fold','Wide-Legged Forward Fold','Easy Seat','Staff','Bound Angle','Seated Forward Fold','Head-to-Knee','Boat','Cobra','Bridge','Fish','Pigeon','Reclined Figure Four','Happy Baby','Half Split','Tabletop','Child\'s Pose','Extended Puppy','Plank','Side Plank','Downward-Facing Dog','Legs-Up-the-Wall','Corpse','Reclining Bound Angle','Supine Twist']) {
 const base=yogaPoses.find(p=>p.name===name);
 yogaPoses.push({...base,id:`${base.id}-supported`,name:`Supported ${name}`,sanskritName:`${base.sanskritName} (supported variation)`,aliases:[`${name} with props`],difficulty:'Beginner',instructions:`Set up stable chair, wall, block or bolster support first. ${base.instructions} ${base.modifications}`,equipment:[...new Set([...base.equipment,'Chair','Wall'])]});
}
export const poseId = name => yogaPoses.find(p=>p.name===name)?.id;
export const yogaStep = (name, hold=30, side='Center', extra={}) => ({poseId:name?poseId(name):null,kind:name?'Pose':'Breathing',label:name||'Guided Breathing',hold,unit:'seconds',secondsPerBreath:6,side,repetitions:1,transitionSeconds:0,restSeconds:0,overrideSeconds:null,transitionNotes:'Move slowly, using support as needed.',cues:'Keep the breath easy. Choose the supported version or rest whenever needed.',...extra});
const section=(title,steps)=>({title,steps});
export const yogaBlocks=[
 {name:'Sun Salutation A',steps:['Mountain','Raised Arms','Standing Forward Fold','Half Forward Fold','Plank','Cobra','Downward-Facing Dog','Half Forward Fold','Standing Forward Fold','Raised Arms','Mountain'].map(n=>yogaStep(n, n==='Downward-Facing Dog'?25:5,'Center',{transitionSeconds:5,cues:'Move with one comfortable breath; lower knees for plank and use a low cobra.'}))},
 {name:'Sun Salutation B',steps:['Mountain','Chair','Standing Forward Fold','Half Forward Fold','Plank','Cobra','Downward-Facing Dog','Warrior I','Downward-Facing Dog','Warrior I','Downward-Facing Dog','Half Forward Fold','Standing Forward Fold','Chair','Mountain'].map((n,i)=>yogaStep(n,10,n==='Warrior I'?(i===7?'Left':'Right'):'Center',{transitionSeconds:5}))},
 {name:'Cat-Cow Warm-Up',steps:[...Array.from({length:6},()=>[yogaStep('Cat',5),yogaStep('Cow',5)]).flat(),yogaStep('Child\'s Pose',60)]},
 {name:'Warrior Flow',steps:['Warrior I','Warrior II','Extended Side Angle','Reverse Warrior'].map(n=>yogaStep(n,30,'Both',{transitionSeconds:10}))},
 {name:'Standing Balance Series',steps:['Tree','Warrior III','Half Moon'].map(n=>yogaStep(n,30,'Both',{transitionSeconds:15,cues:'Use the wall and repeat equally on each side.'}))},
 {name:'Hip Opening Series',steps:[yogaStep('Low Lunge',45,'Both',{transitionSeconds:15}),yogaStep('Reclined Figure Four',60,'Both'),yogaStep('Bound Angle',60)]},
 {name:'Restorative Closing Series',steps:[yogaStep('Supine Twist',60,'Both'),yogaStep('Legs-Up-the-Wall',180),yogaStep('Corpse',300)]},
];
const sun = rounds => Array.from({length:rounds},()=>structuredClone(yogaBlocks[0].steps)).flat();
// Exact sample: 300 + 480 + 1020 + 600 + 300 seconds.
const heart = [
 section('Centering & Breathwork',[yogaStep('Easy Seat',120),yogaStep(null,30,'Center',{unit:'breaths',secondsPerBreath:6,cues:'Notice the breath without retention. Reflect on one thing you appreciate.'})]),
 section('Warm-Up',[yogaStep('Cat-Cow',5,'Center',{unit:'breaths',repetitions:4,transitionSeconds:15}),yogaStep('Child\'s Pose',120),yogaStep('Downward-Facing Dog',50,'Center',{repetitions:3,restSeconds:10,transitionNotes:'Lower to tabletop between rounds.'})]),
 section('Standing Flow',[...sun(4),...['Warrior I','Warrior II','Extended Side Angle'].map(n=>yogaStep(n,30,'Both',{repetitions:2,transitionSeconds:10,cues:'Alternate left and right, then repeat. Use a shorter stance or forearm on thigh.'})),yogaStep('Mountain',20)]),
 section('Floor Work & Cool-Down',[yogaStep('Pigeon',70,'Both',{transitionSeconds:10,cues:'Support the front hip; substitute reclined figure four if the knee feels strained.'}),yogaStep('Bridge',30,'Center',{repetitions:3,restSeconds:20,transitionSeconds:10}),yogaStep('Supine Twist',110,'Both',{transitionSeconds:20})]),
 section('Savasana / Closing',[yogaStep('Corpse',300,'Center',{cues:'Support knees, settle the breath and remember the gratitude intention.'})]),
];
const configs=[
 ['Morning Awakening',25,'Gentle','Beginner','Fresh Start',['Low Lunge','Warrior II'],['Reclined Figure Four','Supine Twist']],
 ['Beginner Foundation',30,'Hatha','Beginner','Foundation',['Mountain','Warrior I','Triangle'],['Bound Angle','Knees-to-Chest']],
 ['Gentle Full Body Stretch',30,'Gentle','Beginner','Self-Love',['Supported Triangle','Supported Chair'],['Head-to-Knee','Reclined Figure Four']],
 ['Hip Opening & Flexibility',35,'Hatha','Intermediate','Openness',['Low Lunge','Warrior II','Extended Side Angle'],['Pigeon','Bound Angle','Half Split']],
 ['Stress Relief & Grounding',30,'Restorative','Beginner','Grounding',[],['Supported Reclining Bound Angle','Supported Supine Twist','Legs-Up-the-Wall']],
 ['Core Strength Yoga',40,'Hatha','Intermediate','Strength',['Chair','Warrior III','Side Plank'],['Boat','Bridge','Supine Twist']],
 ['Sun Salutation Vinyasa',35,'Vinyasa','Intermediate','Energy',['Warrior I','Warrior II','Reverse Warrior'],['Reclined Figure Four','Seated Forward Fold']],
 ['Balance & Stability',40,'Hatha','Intermediate','Balance',['Tree','Warrior III','Half Moon'],['Bound Angle','Supine Twist']],
 ['Heart Opening & Gratitude',45,'Vinyasa','Intermediate','Gratitude',[],[]],
 ['Evening Yin Yoga',45,'Yin','Beginner','Rest',[],['Supported Bound Angle','Supported Pigeon','Supported Supine Twist','Supported Reclining Bound Angle']],
 ['Power Vinyasa',50,'Power','Advanced','Resilience',['Warrior I','Warrior II','Chair','Side Plank'],['Boat','Locust','Supine Twist']],
 ['Full Body Hatha Flow',55,'Hatha','Intermediate','Wholeness',['Warrior I','Triangle','Tree','Extended Side Angle'],['Cobra','Bridge','Reclined Figure Four','Seated Forward Fold']],
];
export const yogaStarterFlows=configs.map(([title,targetMinutes,style,difficulty,theme,standing,floor],index)=>{
 let sections;
 if(index===8) sections=heart;
 else {
  const quiet=['Yin','Restorative'].includes(style);
  sections=[section('Centering & Breathwork',[yogaStep('Easy Seat',120),yogaStep(null,20,'Center',{unit:'breaths',cues:'Let the breath stay natural and establish your intention.'})]),section('Warm-Up',[yogaStep('Cat-Cow',6,'Center',{repetitions:10,transitionSeconds:6}),yogaStep('Child\'s Pose',90),yogaStep('Downward-Facing Dog',30,'Center',{repetitions:2,restSeconds:15})]),...(!quiet?[section('Sun Salutations',sun(style==='Power'?6:style==='Vinyasa'?5:style==='Gentle'?1:2))]:[]),...standing.length?[section('Standing Flow',standing.map(n=>yogaStep(n,30,n==='Mountain'||n==='Chair'?'Center':'Both',{repetitions:targetMinutes>=40?2:1,transitionSeconds:10,restSeconds:10})))]:[],section('Floor Work & Cool-Down',floor.map(n=>yogaStep(n,quiet?120:targetMinutes===25?45:60,/Pigeon|Twist|Figure Four|Split|Head-to-Knee/.test(n)?'Both':'Center',{transitionSeconds:15,restSeconds:15,cues:quiet?'Use props and settle only into a mild stretch. Leave the pose early if needed.':'Stay within a comfortable range; use blocks and keep both sides equal.'}))),section('Savasana / Closing',[yogaStep('Corpse',300)])];
  // Add purposeful supported rest/reflection to reach the target, not hidden overrides.
  const remaining=targetMinutes*60-flowSeconds({sections});
  if(remaining<0) throw new Error(`Starter is too long: ${title}`);
  const floorSection=sections[sections.length-2];
  const rests=['Supported Reclining Bound Angle','Supported Child\'s Pose','Knees-to-Chest'];
  const count=Math.ceil(remaining/240);
  for(let j=0;j<count;j++) floorSection.steps.push(yogaStep(rests[j%rests.length],Math.floor(remaining/count)+(j<remaining%count?1:0),'Center',{cues:'Arrange support and take quiet natural breaths. Change position whenever needed; no stretch should be painful.'}));
 }
 return {seedKey:`starter-${index+1}`,title,theme,quote:index===8?'Cultivate gratitude with every breath.':'Make space for one comfortable breath.',quoteAttribution:'Train with me · original intention',description:`An original ${targetMinutes}-minute ${style.toLowerCase()} practice exploring ${theme.toLowerCase()}, with supported options and balanced sides.`,style,difficulty,targetMinutes,targetAreas:'Whole body',equipment:['Yoga mat','Blocks','Blanket','Bolster'],openingIntention:`Arrive as you are and explore ${theme.toLowerCase()} without forcing a result.`,closingReflection:`Notice how you feel now. Carry one moment of ${theme.toLowerCase()} into the rest of your day.`,instructorNotes:'Review suitability, props and transitions before publishing. Offer rest at any point. Advanced poses in the library are optional and require qualified supervision.',status:'Draft',references:[{name:'Cleveland Clinic · sun salutation concepts',url:'https://health.clevelandclinic.org/sun-salutation',attribution:'Lynda Robinson, OT/L, RYT-500; reference inspiration only. Original class arrangement and wording.'},{name:'Yoga Journal · foundational pose reference',url:'https://www.yogajournal.com/practice/beginners/foundational-beginner-yoga-poses/',attribution:'Yoga Journal; naming and foundational category reference only.'},...(['Yin','Restorative'].includes(style)?[{name:style==='Yin'?'Yoga Journal · Yin practice references':'Cleveland Clinic · restorative practice',url:style==='Yin'?'https://www.yogajournal.com/practice/yoga-sequences-type/yin-yoga-sequences/':'https://health.clevelandclinic.org/restorative-yoga',attribution:style==='Yin'?'Yoga Journal; slow supported practice inspiration. Original sequence and wording.':'Cleveland Clinic; supported rest and prop concepts. Original sequence and wording.'}]:[])],sections};
});
