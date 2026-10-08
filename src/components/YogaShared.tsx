import { useState } from 'react';
import { Leaf } from 'lucide-react';
import type { YogaFlow, YogaPose, YogaStep } from '../yoga-types';
export const defaultSections=['Centering & Breathwork','Warm-Up','Sun Salutations','Standing Flow','Balance / Peak Pose','Floor Work & Cool-Down','Savasana / Closing'];
export const styles=['Hatha','Vinyasa','Yin','Restorative','Power','Gentle'];
export const difficulties=['Beginner','Intermediate','Advanced'];
export const positions=['Standing','Seated','Supine','Prone','Kneeling','Inversion'];
export const categories=['Standing','Seated','Supine','Prone','Kneeling','Balance','Backbends','Forward Folds','Twists','Hip Openers','Restorative','Inversion','Strength','Warm-Up'];
export const newFlow=():YogaFlow=>({title:'Untitled yoga flow',theme:'',quote:'',quoteAttribution:'',style:'Hatha',difficulty:'Beginner',targetMinutes:45,description:'',targetAreas:'Whole body',equipment:['Yoga mat'],openingIntention:'',closingReflection:'',instructorNotes:'',status:'Draft',references:[],sections:defaultSections.map(title=>({title,steps:[]}))});
export const newStep=(pose?:YogaPose,kind:YogaStep['kind']='Pose'):YogaStep=>({poseId:pose?.id??null,kind:pose?'Pose':kind,label:pose?.name??(kind==='Breathing'?'Guided Breathing':'Pause'),hold:pose?.recommendedHold??60,unit:'seconds',secondsPerBreath:6,side:'Center',repetitions:1,transitionSeconds:10,restSeconds:0,overrideSeconds:null,transitionNotes:'',cues:''});
export const duration=(seconds:number)=>`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
export const minutes=(seconds:number)=>`${(seconds/60).toFixed(seconds%60?1:0)} min`;
export const flowPayload=(flow:YogaFlow)=>{return Object.fromEntries(['title','theme','quote','quoteAttribution','description','style','difficulty','targetMinutes','targetAreas','equipment','openingIntention','closingReflection','instructorNotes','status','references','sections'].map(key=>[key,flow[key as keyof YogaFlow]]));};
export function PoseArt({pose}:{pose?:YogaPose}) {const [failed,setFailed]=useState('');return pose?.imageUrl&&failed!==pose.imageUrl?<img className="yoga-art" src={pose.imageUrl} alt={pose.name} onError={()=>setFailed(pose.imageUrl)}/>:<div className="yoga-art yoga-placeholder"><Leaf aria-hidden="true"/><span>{pose?'Image to come':'Breathe & rest'}</span></div>;}
export function Tags({flow}:{flow:YogaFlow}) {return <div className="yoga-tags">{[`${flow.targetMinutes} min target`,flow.style,flow.difficulty,flow.theme,flow.status].filter(Boolean).map((t,i)=><span className={`badge ${t==='Published'?'sage':''}`} key={i}>{t}</span>)}</div>;}
export function move<T>(items:T[],from:number,to:number) {if(to<0||to>=items.length)return items;const next=[...items];next.splice(to,0,next.splice(from,1)[0]);return next;}
