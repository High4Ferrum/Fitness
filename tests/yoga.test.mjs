import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/index.mjs';
import { flowSeconds, stepSeconds, sessionPhases } from '../shared/yoga-timing.mjs';
import { yogaPoses, yogaStarterFlows, yogaStep } from '../server/yoga-seed.mjs';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
const payload=f=>Object.fromEntries(['title','theme','quote','quoteAttribution','description','style','difficulty','targetMinutes','targetAreas','equipment','openingIntention','closingReflection','instructorNotes','status','references','sections'].map(k=>[k,f[k]]));
async function fixture(t){
 const directory=await mkdtemp(join(tmpdir(),'yoga-api-'));let app,server,worker;const path=join(directory,'db.sqlite');
 async function start(){if(process.env.FORM_TEST_RUNTIME==='cloudflare'){const {Miniflare,convertV4MiniflareOptions}=await import('miniflare');worker=new Miniflare(convertV4MiniflareOptions({name:'yoga-api-test',modules:true,scriptPath:'.worker-build/worker.js',compatibilityDate:'2026-10-04',compatibilityFlags:['nodejs_compat'],durableObjects:{FORM_DB:{className:'FormDatabase',useSQLite:true}},resourcePersistencePath:join(directory,'do'),bindings:{FORM_SEED_DEMO:'1',FORM_COOKIE_SECURE:'0'}}));await worker.ready;}else{app=createApp({databasePath:path});server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));}}
 async function stop(){if(worker){await worker.dispose();worker=null;}else{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));app.locals.db.close();}}
 await start();t.after(async()=>{await stop();await rm(directory,{recursive:true,force:true});});
 async function request(route,cookie,method='GET',body){const url=`http://127.0.0.1${worker?'':`:${server.address().port}`}/api${route}`;const options={method,headers:{...(cookie?{cookie}:{}),...(body!==undefined?{'content-type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})};const response=worker?await worker.dispatchFetch(url,options):await fetch(url,options);return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};}
 const login=async name=>(await request('/auth/login',null,'POST',{email:`${name}@form.fit`,password:'FormDemo123!'})).cookie;
 return {request,login,restart:async()=>{await stop();await start();},db:()=>app?.locals.db};
}
test('126 unique poses, 12 original drafts, exact 25–55 minute sequences and balanced sample',()=>{
 assert.equal(yogaPoses.length,126);assert.equal(new Set(yogaPoses.map(p=>p.id)).size,126);assert.equal(new Set(yogaPoses.map(p=>p.name)).size,126);assert.equal(yogaStarterFlows.length,12);
 for(const f of yogaStarterFlows){assert.equal(f.status,'Draft');assert.equal(flowSeconds(f),f.targetMinutes*60,f.title);assert.ok(f.sections.every(s=>s.steps.length));assert.ok(f.sections.flatMap(s=>s.steps).every(s=>s.poseId===null||yogaPoses.some(p=>p.id===s.poseId)));assert.ok(f.openingIntention&&f.closingReflection&&f.references.length);}
 const heart=yogaStarterFlows[8];assert.deepEqual(heart.sections.map(s=>s.steps.reduce((sum,p)=>sum+stepSeconds(p),0)),[300,480,1020,600,300]);assert.ok(heart.sections[2].steps.filter(s=>s.poseId===yogaStep('Warrior I').poseId).every(s=>s.side==='Both'));
});
test('timing and player phases count breaths, bilateral rounds, transitions, rest and overrides',()=>{
 const s={...yogaStep('Tree',5,'Both'),unit:'breaths',secondsPerBreath:6,repetitions:3,transitionSeconds:10,restSeconds:20};assert.equal(stepSeconds(s),360);assert.equal(sessionPhases(s).reduce((sum,p)=>sum+p.seconds,0),360);assert.equal(stepSeconds({...s,overrideSeconds:125}),125);assert.deepEqual(sessionPhases({...s,overrideSeconds:125}).map(p=>p.seconds),[125]);
});
test('yoga permissions, owner boundaries, atomic validation, snapshot assignment, completion and persistence',async t=>{
 const f=await fixture(t),coach=await f.login('coach'),admin=await f.login('admin'),client=await f.login('jamie'),otherClient=await f.login('maya');const request=f.request;
 for(const url of ['/yoga/poses','/yoga/flows','/yoga/blocks','/exercises'])assert.equal((await request(url,client)).status,403,url);
 const bootstrap=(await request('/bootstrap',client)).body;assert.ok(bootstrap.exercises.every(e=>bootstrap.plans.some(p=>p.items.some(i=>i.exerciseId===e.id))));assert.ok(bootstrap.plans.every(p=>p.items.every(i=>bootstrap.exercises.some(e=>e.id===i.exerciseId))));
 const poses=(await request('/yoga/poses',coach)).body;assert.equal(poses.length,126);const starters=(await request('/yoga/flows',coach)).body;assert.equal(starters.length,12);
 assert.equal((await request(`/yoga/flows/${starters[8].id}`,coach,'PATCH',{title:'bad'})).status,403);
 let copy=(await request(`/yoga/flows/${starters[8].id}/duplicate`,coach,'POST',{}));assert.equal(copy.status,201);copy=copy.body;assert.equal(copy.status,'Draft');assert.equal(flowSeconds(copy),2700);
 const bad=payload(copy);bad.sections[0].steps[0].hold=-1;assert.equal((await request(`/yoga/flows/${copy.id}`,coach,'PATCH',bad)).status,400);assert.equal(flowSeconds((await request(`/yoga/flows/${copy.id}`,coach)).body),2700);
 assert.equal((await request(`/yoga/flows/${copy.id}/assign`,coach,'POST',{clientId:'client-jamie'})).status,400);
 const published=await request(`/yoga/flows/${copy.id}`,coach,'PATCH',{status:'Published',title:'Yoga test class'});assert.equal(published.status,200);
 assert.equal((await request(`/yoga/flows/${copy.id}`,client)).status,403);
 assert.equal((await request(`/yoga/flows/${copy.id}/assign`,client,'POST',{clientId:'client-jamie'})).status,403);
 const assigned=await request(`/yoga/flows/${copy.id}/assign`,coach,'POST',{clientId:'client-jamie'});assert.equal(assigned.status,201);const a=assigned.body;assert.equal(a.flow.status,'Published');assert.ok(a.poses.length>0);
 assert.equal((await request(`/yoga/assignments/${a.id}`,otherClient)).status,403);assert.equal((await request('/yoga/assignments',otherClient)).body.length,0);
 assert.equal((await request(`/yoga/flows/${copy.id}`,coach,'PATCH',{title:'Edited after assignment',status:'Draft'})).status,200);assert.equal((await request(`/yoga/assignments/${a.id}`,client)).body.flow.title,'Yoga test class');
 assert.equal((await request(`/yoga/assignments/${a.id}/complete`,coach,'POST',{})).status,403);assert.equal((await request(`/yoga/assignments/${a.id}/complete`,client,'POST',{})).status,201);assert.equal((await request(`/yoga/assignments/${a.id}/complete`,client,'POST',{})).status,200);assert.equal((await request(`/yoga/flows/${copy.id}`,coach,'DELETE')).status,409);
 const outsider=(await request('/users',admin,'POST',{name:'Other coach',email:'yoga-other@form.fit',password:'TestPass123!',role:'coach'}));
 assert.equal(outsider.status,201);
{const c=(await request('/auth/login',null,'POST',{email:'yoga-other@form.fit',password:'TestPass123!'})).cookie;assert.equal((await request(`/yoga/flows/${copy.id}`,c)).status,403);}
 const count=(await request('/yoga/poses',coach)).body.length;const p={...poses[0],name:'Coach original pose',aliases:[]};delete p.id;assert.equal((await request('/yoga/poses',coach,'POST',p)).status,201);assert.equal((await request('/yoga/poses',coach,'POST',p)).status,409);assert.equal((await request('/yoga/poses',client,'POST',p)).status,403);
 await f.restart();assert.equal((await request('/yoga/poses',coach)).body.length,count+1);assert.equal((await request('/yoga/completions',client)).body.length,1);assert.equal((await request('/yoga/flows',coach)).body.length,13);
});
test('reusable blocks copy independently, pose archive keeps assigned guidance and rejects new use',async t=>{
 const f=await fixture(t),coach=await f.login('coach'),client=await f.login('jamie');const r=f.request;const templates=(await r('/yoga/blocks',coach)).body;assert.equal(templates.length,7);const b=templates[0];const created=await r('/yoga/blocks',coach,'POST',{name:'Custom sun block',description:'Original',steps:b.steps});assert.equal(created.status,201);assert.equal((await r(`/yoga/blocks/${created.body.id}`,client,'DELETE')).status,403);
 const base=yogaStarterFlows[8];const saved=(await r('/yoga/flows',coach,'POST',{...payload(base),status:'Published'})).body;const a=(await r(`/yoga/flows/${saved.id}/assign`,coach,'POST',{clientId:'client-jamie'})).body;const p=a.poses.find(p=>p.name==='Easy Seat');assert.equal((await r(`/yoga/poses/${p.id}`,coach,'DELETE')).status,200);assert.equal((await r(`/yoga/flows/${saved.id}/assign`,coach,'POST',{clientId:'client-jamie'})).status,400);assert.equal((await r(`/yoga/assignments/${a.id}`,client)).body.poses.find(pose=>pose.id===p.id).active,true);
 const old=b.steps[0].hold;await r(`/yoga/blocks/${created.body.id}`,coach,'PATCH',{name:'Changed',description:'',steps:[{...b.steps[0],hold:80}]});assert.equal((await r('/yoga/blocks',coach)).body.find(t=>t.id===b.id).steps[0].hold,old);
});
test('additive migration preserves existing fitness data and yoga edits; deleted starter templates stay deleted',async t=>{
 const f=await fixture(t),admin=await f.login('admin'),coach=await f.login('coach');const r=f.request;const before=(await r('/bootstrap',admin)).body;
 await r('/yoga/poses/pose-tree',coach,'PATCH',{alignmentCues:'Custom coach alignment',active:false});await r('/yoga/flows/yoga-starter-1',admin,'DELETE');await r('/yoga/blocks/yoga-block-1',admin,'DELETE');await f.restart();
 const after=(await r('/bootstrap',admin)).body;for(const key of ['clients','plans','logs','exercises','templates','weeklyLineups','weeklyAssignments'])assert.deepEqual(after[key],before[key]);const p=(await r('/yoga/poses',coach)).body.find(p=>p.id==='pose-tree');assert.equal(p.alignmentCues,'Custom coach alignment');assert.equal(p.active,false);assert.equal((await r('/yoga/flows',coach)).body.length,11);assert.equal((await r('/yoga/blocks',coach)).body.length,6);if(f.db())assert.equal(f.db().prepare('PRAGMA foreign_key_check').all().length,0);
});
