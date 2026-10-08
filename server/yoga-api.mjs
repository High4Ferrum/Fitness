import { randomUUID } from 'node:crypto';
import { migrateYoga } from './migrations/yoga-v1.mjs';
import { yogaPoses, yogaStarterFlows, yogaBlocks } from './yoga-seed.mjs';
import { flowSeconds } from '../shared/yoga-timing.mjs';
export function installYoga({app,db,trainer,clientFor,fail,str,num,stringList,checkKeys}) {
 db.transaction(() => migrateYoga(db));
 const key = name => name.trim().toLowerCase().replace(/[\s-]+/g,' ');
 const jsonRows=(sql,...args)=>db.prepare(sql).all(...args).map(r=>JSON.parse(r.json));
 const pose=id=>{const r=db.prepare('SELECT json FROM yoga_poses WHERE id=?').get(id);return r?JSON.parse(r.json):fail(400,'Choose an existing pose.');};
 const writePose=p=>db.prepare('INSERT INTO yoga_poses(id,name_key,json) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET name_key=excluded.name_key,json=excluded.json').run(p.id,key(p.name),JSON.stringify(p));
 const steps=(column,id)=>jsonRows(`SELECT json FROM yoga_steps WHERE ${column}=? ORDER BY sort_order`,id);
 const flow=id=>{const r=db.prepare('SELECT * FROM yoga_flows WHERE id=?').get(id);if(!r)fail(404,'Yoga flow was not found.');return {...JSON.parse(r.json),id:r.id,ownerId:r.owner_id,status:r.status,updatedAt:r.updated_at,sections:db.prepare('SELECT * FROM yoga_sections WHERE flow_id=? ORDER BY sort_order').all(id).map(s=>({id:s.id,title:s.title,steps:steps('section_id',s.id)}))};};
 const writeSteps=(values,column,id)=>values.forEach((s,i)=>{const next={...s,id:`step-${randomUUID()}`};db.prepare(`INSERT INTO yoga_steps(id,${column},pose_id,sort_order,json) VALUES (?,?,?,?,?)`).run(next.id,id,s.poseId,i,JSON.stringify(next));});
 const writeFlow=(f,ownerId,seedKey=null)=>{
  const {sections,...meta}=f;
  db.prepare('INSERT INTO yoga_flows(id,owner_id,seed_key,status,updated_at,json) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET status=excluded.status,updated_at=excluded.updated_at,json=excluded.json').run(f.id,ownerId,seedKey,f.status,new Date().toISOString(),JSON.stringify(meta));
  db.prepare('DELETE FROM yoga_steps WHERE section_id IN (SELECT id FROM yoga_sections WHERE flow_id=?)').run(f.id);
  db.prepare('DELETE FROM yoga_sections WHERE flow_id=?').run(f.id);
  sections.forEach((s,i)=>{const id=`section-${randomUUID()}`;db.prepare('INSERT INTO yoga_sections(id,flow_id,sort_order,title) VALUES (?,?,?,?)').run(id,f.id,i,s.title);writeSteps(s.steps,'section_id',id);});
  return flow(f.id);
 };
 const writeBlock=(b,ownerId,seedKey=null)=>{
  db.prepare('INSERT INTO yoga_blocks(id,owner_id,seed_key,name,json) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,json=excluded.json').run(b.id,ownerId,seedKey,b.name,JSON.stringify({description:b.description||''}));
  db.prepare('DELETE FROM yoga_steps WHERE block_id=?').run(b.id);writeSteps(b.steps,'block_id',b.id);return {...b,ownerId};
 };
 db.transaction(()=>{
  const poseMap=new Map();
  for(const p of yogaPoses) { let row=db.prepare('SELECT id FROM yoga_poses WHERE id=? OR name_key=?').get(p.id,key(p.name)); if(!row){writePose(p);row={id:p.id};}poseMap.set(p.id,row.id); }
  const seedSteps=values=>values.map(step=>({...step,poseId:step.poseId?poseMap.get(step.poseId):null}));
  for(const f of yogaStarterFlows) if(!db.prepare('SELECT seed_key FROM yoga_seed_history WHERE seed_key=?').get(f.seedKey)){ if(!db.prepare('SELECT id FROM yoga_flows WHERE seed_key=?').get(f.seedKey))writeFlow({...f,id:`yoga-${f.seedKey}`,sections:f.sections.map(s=>({...s,steps:seedSteps(s.steps)}))},null,f.seedKey); db.prepare('INSERT INTO yoga_seed_history(seed_key) VALUES (?)').run(f.seedKey); }
  yogaBlocks.forEach((b,i)=>{const seedKey=`block-${i+1}`;if(!db.prepare('SELECT seed_key FROM yoga_seed_history WHERE seed_key=?').get(seedKey)){if(!db.prepare('SELECT id FROM yoga_blocks WHERE seed_key=?').get(seedKey))writeBlock({...b,id:`yoga-${seedKey}`,steps:seedSteps(b.steps)},null,seedKey);db.prepare('INSERT INTO yoga_seed_history(seed_key) VALUES (?)').run(seedKey);}});
 });
 const owned=(req,table,id)=>{trainer(req);const r=db.prepare(`SELECT * FROM ${table} WHERE id=?`).get(id);if(!r)fail(404,'Record was not found.');if(req.user.role!=='admin'&&r.owner_id!==req.user.id)fail(403,'This template belongs to another coach. Duplicate starter templates to edit your own copy.');return r;};
 const readFlow=(req,id)=>{trainer(req);const f=flow(id);if(f.ownerId!==null&&req.user.role!=='admin'&&f.ownerId!==req.user.id)fail(403,'This flow belongs to another coach.');return f;};
 const listFlows=req=>{trainer(req);return db.prepare('SELECT id FROM yoga_flows WHERE owner_id IS NULL OR owner_id=? OR ?=1').all(req.user.id,req.user.role==='admin'?1:0).map(r=>flow(r.id));};
 const enumValue=(v,values,label)=>values.includes(v)?v:fail(400,`Choose a valid ${label}.`);
 const safeUrl=v=>{const value=str(v??'','URL',2000);if(value){let u;try{u=new URL(value);}catch{fail(400,'Use a valid HTTPS URL.');}if(u.protocol!=='https:'||u.username||u.password)fail(400,'Use a valid HTTPS URL.');}return value;};
 const validateSteps=values=>{
  if(!Array.isArray(values)||values.length>250)fail(400,'Use at most 250 steps per section or block.');
  return values.map(s=>{
   if(!s||typeof s!=='object'||Array.isArray(s))fail(400,'Each step must be an object.');
   checkKeys(s,['id','poseId','kind','label','hold','unit','secondsPerBreath','side','repetitions','transitionSeconds','restSeconds','overrideSeconds','transitionNotes','cues']);
   const kind=enumValue(s.kind,['Pose','Breathing','Pause'],'step type');
   if(kind==='Pose'){if(typeof s.poseId!=='string'||!pose(s.poseId).active)fail(400,'Choose an active pose.');}else if(s.poseId!==null)fail(400,'Breathing and pauses do not reference poses.');
   return {poseId:s.poseId,kind,label:str(s.label??'','Step label',120),hold:num(s.hold,'Hold',1,s.unit==='breaths'?300:1800,true),unit:enumValue(s.unit,['seconds','breaths'],'hold unit'),secondsPerBreath:num(s.secondsPerBreath,'Seconds per breath',2,30,true),side:enumValue(s.side,['Center','Left','Right','Both'],'side'),repetitions:num(s.repetitions,'Repetitions',1,30,true),transitionSeconds:num(s.transitionSeconds,'Transition seconds',0,300,true),restSeconds:num(s.restSeconds,'Rest seconds',0,600,true),overrideSeconds:s.overrideSeconds===null||s.overrideSeconds===undefined?null:num(s.overrideSeconds,'Timing override',1,3600,true),transitionNotes:str(s.transitionNotes??'','Transitions',2000),cues:str(s.cues??'','Instructor cues',2000)};
  });
 };
 const flowKeys=['title','theme','quote','quoteAttribution','description','style','difficulty','targetMinutes','targetAreas','equipment','openingIntention','closingReflection','instructorNotes','status','references','sections'];
 const validateFlow=b=>{
  checkKeys(b,flowKeys);
  if(!Array.isArray(b.sections)||b.sections.length<1||b.sections.length>30)fail(400,'Use 1–30 class sections.');
  const f={title:str(b.title,'Title',120,true),theme:str(b.theme??'','Theme',120),quote:str(b.quote??'','Quote',1000),quoteAttribution:str(b.quoteAttribution??'','Attribution',300),description:str(b.description??'','Description',5000),style:enumValue(b.style,['Hatha','Vinyasa','Yin','Restorative','Power','Gentle'],'yoga style'),difficulty:enumValue(b.difficulty,['Beginner','Intermediate','Advanced'],'difficulty'),targetMinutes:num(b.targetMinutes,'Target minutes',25,55,true),targetAreas:str(b.targetAreas??'','Target areas',500),equipment:stringList(b.equipment??[],'Equipment'),openingIntention:str(b.openingIntention??'','Opening intention',3000),closingReflection:str(b.closingReflection??'','Closing reflection',3000),instructorNotes:str(b.instructorNotes??'','Instructor notes',5000),status:enumValue(b.status,['Draft','Published'],'status'),sections:b.sections.map(s=>{if(!s||typeof s!=='object')fail(400,'Section must be an object.');checkKeys(s,['id','title','steps']);return {title:str(s.title,'Section title',120,true),steps:validateSteps(s.steps)};})};
  if(f.sections.reduce((sum,s)=>sum+s.steps.length,0)>500)fail(400,'Use at most 500 steps in a flow.');
  if(b.references!==undefined&&(!Array.isArray(b.references)||b.references.length>10))fail(400,'Use at most 10 references.');
  f.references=(b.references??[]).map(r=>{ if(!r||typeof r!=='object'||Array.isArray(r))fail(400,'Each reference must be an object.'); checkKeys(r,['name','url','attribution']); return {name:str(r.name,'Reference name',160,true),url:safeUrl(r.url),attribution:str(r.attribution??'','Reference attribution',1000)}; });
  if(f.status==='Published'&&(flowSeconds(f)<1500||flowSeconds(f)>3300||f.sections.some(s=>!s.steps.length)))fail(400,'Published classes need complete sections and 25–55 minutes of calculated time.');
  return f;
 };
 const poseKeys=['name','sanskritName','chineseName','aliases','category','difficulty','targetAreas','movementType','position','recommendedHold','breathInstructions','instructions','alignmentCues','commonMistakes','modifications','contraindications','equipment','imageUrl','videoUrl','active'];
 app.get('/api/yoga/poses',(req,res)=>{trainer(req);res.json(jsonRows('SELECT json FROM yoga_poses'));});
 const validatePose=(b,id)=>{
  checkKeys(b,poseKeys);const p={id};
  for(const field of ['name','sanskritName','chineseName','category','targetAreas','movementType','breathInstructions','instructions','alignmentCues','commonMistakes','modifications','contraindications'])p[field]=str(b[field]??'',field,field==='name'?120:5000,['name','instructions','alignmentCues','modifications','contraindications'].includes(field));
  p.difficulty=enumValue(b.difficulty,['Beginner','Intermediate','Advanced'],'difficulty');p.position=enumValue(b.position,['Standing','Seated','Supine','Prone','Kneeling','Inversion'],'position');p.aliases=stringList(b.aliases??[],'Aliases');p.equipment=stringList(b.equipment??[],'Equipment');p.recommendedHold=num(b.recommendedHold,'Recommended hold',1,1800,true);p.imageUrl=safeUrl(b.imageUrl);p.videoUrl=safeUrl(b.videoUrl);if(typeof b.active!=='boolean')fail(400,'Active must be true or false.');p.active=b.active;
  const match=db.prepare('SELECT id FROM yoga_poses WHERE name_key=?').get(key(p.name));if(match&&match.id!==id)fail(409,'A pose with this name already exists.');return p;
 };
 app.post('/api/yoga/poses',(req,res)=>{trainer(req);const p=validatePose(req.body,`pose-${randomUUID()}`);writePose(p);res.status(201).json(p);});
 app.patch('/api/yoga/poses/:id',(req,res)=>{trainer(req);const {id,...current}=pose(req.params.id);const p=validatePose({...current,...req.body},id);writePose(p);res.json(p);});
 app.delete('/api/yoga/poses/:id',(req,res)=>{trainer(req);writePose({...pose(req.params.id),active:false});res.json({ok:true});});
 app.get('/api/yoga/flows',(req,res)=>res.json(listFlows(req)));
 app.get('/api/yoga/flows/:id',(req,res)=>res.json(readFlow(req,req.params.id)));
 app.post('/api/yoga/flows',(req,res)=>{trainer(req);const f=validateFlow(req.body);let saved;db.transaction(()=>{saved=writeFlow({...f,id:`flow-${randomUUID()}`},req.user.id);});res.status(201).json(saved);});
 app.patch('/api/yoga/flows/:id',(req,res)=>{const row=owned(req,'yoga_flows',req.params.id);const current=flow(row.id);checkKeys(req.body,flowKeys);const meta=Object.fromEntries(flowKeys.map(k=>[k,current[k]]));const f=validateFlow({...meta,...req.body});let saved;db.transaction(()=>{saved=writeFlow({...f,id:row.id},row.owner_id,row.seed_key);});res.json(saved);});
 app.post('/api/yoga/flows/:id/duplicate',(req,res)=>{const current=readFlow(req,req.params.id);checkKeys(req.body,[]);let saved;db.transaction(()=>{saved=writeFlow({...current,id:`flow-${randomUUID()}`,title:`${current.title} (copy)`,status:'Draft'},req.user.id);});res.status(201).json(saved);});
 app.delete('/api/yoga/flows/:id',(req,res)=>{owned(req,'yoga_flows',req.params.id);if(db.prepare('SELECT id FROM yoga_assignments WHERE flow_id=?').get(req.params.id))fail(409,'Assigned flows are kept for history. Save as a draft instead.');db.transaction(()=>{db.prepare('DELETE FROM yoga_steps WHERE section_id IN (SELECT id FROM yoga_sections WHERE flow_id=?)').run(req.params.id);db.prepare('DELETE FROM yoga_sections WHERE flow_id=?').run(req.params.id);db.prepare('DELETE FROM yoga_flows WHERE id=?').run(req.params.id);});res.json({ok:true});});
 app.get('/api/yoga/blocks',(req,res)=>{trainer(req);res.json(db.prepare('SELECT * FROM yoga_blocks WHERE owner_id IS NULL OR owner_id=? OR ?=1').all(req.user.id,req.user.role==='admin'?1:0).map(r=>({id:r.id,ownerId:r.owner_id,name:r.name,...JSON.parse(r.json),steps:steps('block_id',r.id)})));});
 const blockBody=b=>{checkKeys(b,['name','description','steps']);const v={name:str(b.name,'Block name',120,true),description:str(b.description??'','Description',3000),steps:validateSteps(b.steps)};if(!v.steps.length)fail(400,'A reusable block needs steps.');return v;};
 app.post('/api/yoga/blocks',(req,res)=>{trainer(req);const b=blockBody(req.body);let saved;db.transaction(()=>{saved=writeBlock({...b,id:`block-${randomUUID()}`},req.user.id);});res.status(201).json(saved);});
 app.patch('/api/yoga/blocks/:id',(req,res)=>{const row=owned(req,'yoga_blocks',req.params.id);const b=blockBody(req.body);let saved;db.transaction(()=>{saved=writeBlock({...b,id:row.id},row.owner_id,row.seed_key);});res.json(saved);});
 app.delete('/api/yoga/blocks/:id',(req,res)=>{owned(req,'yoga_blocks',req.params.id);db.transaction(()=>{db.prepare('DELETE FROM yoga_steps WHERE block_id=?').run(req.params.id);db.prepare('DELETE FROM yoga_blocks WHERE id=?').run(req.params.id);});res.json({ok:true});});
 const assigned=req=>jsonRows('SELECT json FROM yoga_assignments').filter(a=>{try{clientFor(req,a.clientId);return true;}catch{return false;}});
 const assignment=(req,id)=>{const row=db.prepare('SELECT json FROM yoga_assignments WHERE id=?').get(id);if(!row)fail(404,'Assignment was not found.');const a=JSON.parse(row.json);clientFor(req,a.clientId);return a;};
 app.post('/api/yoga/flows/:id/assign',(req,res)=>{
  owned(req,'yoga_flows',req.params.id);checkKeys(req.body,['clientId']);clientFor(req,req.body.clientId);const f=flow(req.params.id);if(f.status!=='Published')fail(400,'Publish this flow before assigning it.');
  const ids=[...new Set(f.sections.flatMap(s=>s.steps.map(s=>s.poseId).filter(Boolean)))];const poses=ids.map(pose);if(poses.some(p=>!p.active))fail(400,'Replace inactive poses before assigning.');
  const a={id:`yoga-assignment-${randomUUID()}`,flowId:f.id,clientId:req.body.clientId,assignedBy:req.user.id,createdAt:new Date().toISOString(),flow:f,poses};
  db.prepare('INSERT INTO yoga_assignments(id,flow_id,client_id,assigned_by,created_at,json) VALUES (?,?,?,?,?,?)').run(a.id,a.flowId,a.clientId,a.assignedBy,a.createdAt,JSON.stringify(a));res.status(201).json(a);
 });
 app.get('/api/yoga/assignments',(req,res)=>res.json(assigned(req)));
 app.get('/api/yoga/assignments/:id',(req,res)=>res.json(assignment(req,req.params.id)));
 app.post('/api/yoga/assignments/:id/complete',(req,res)=>{checkKeys(req.body,[]);const a=assignment(req,req.params.id);if(req.user.role!=='client'||a.clientId!==req.user.clientId)fail(403,'Only the assigned trainee can complete this class.');const existing=db.prepare('SELECT json FROM yoga_completions WHERE assignment_id=?').get(a.id);if(existing)return res.json(JSON.parse(existing.json));const c={id:`yoga-completion-${randomUUID()}`,assignmentId:a.id,clientId:a.clientId,completedAt:new Date().toISOString()};db.prepare('INSERT INTO yoga_completions(id,assignment_id,client_id,completed_at,json) VALUES (?,?,?,?,?)').run(c.id,a.id,c.clientId,c.completedAt,JSON.stringify(c));res.status(201).json(c);});
 app.get('/api/yoga/completions',(req,res)=>res.json(jsonRows('SELECT json FROM yoga_completions').filter(c=>{try{clientFor(req,c.clientId);return true;}catch{return false;}})));
}
