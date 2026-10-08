import { useState, type FormEvent } from 'react';
import type { Client } from '../types';
import type { YogaFlow } from '../yoga-types';
import { api } from '../api';
import Modal from './Modal';

export default function YogaAssignmentModal({flow,clients,onClose,onAssigned}:{flow:YogaFlow;clients:Client[];onClose:()=>void;onAssigned:()=>Promise<void>}) {
 const [prepared,setPrepared]=useState(flow),[clientId,setClientId]=useState(clients[0]?.id??''),[date,setDate]=useState(()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const needsCopy=prepared.ownerId===null;
 async function assign(event:FormEvent){event.preventDefault();setBusy(true);setError('');try{
   let next=prepared;
   if(next.ownerId===null){next=await api<YogaFlow>(`/yoga/flows/${next.id}/duplicate`,'POST',{});setPrepared(next);}
   if(next.status!=='Published'){next=await api<YogaFlow>(`/yoga/flows/${next.id}`,'PATCH',{status:'Published'});setPrepared(next);}
   await api(`/yoga/flows/${next.id}/assign`,'POST',{clientId,date});
   await onAssigned();
 }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <Modal title="Assign yoga flow" onClose={()=>!busy&&onClose()}><form onSubmit={assign}><h3>{flow.title}</h3><p>The entire sequence and its pose instructions will appear in the client's calendar and My yoga.</p>{needsCopy?<p>A personal copy of this starter template will be published and assigned. The starter template stays unchanged.</p>:prepared.status==='Draft'?<p>This draft will be published before it is assigned. Review the sequence before confirming.</p>:null}<label className="field">Trainee<select required value={clientId} onChange={e=>setClientId(e.target.value)} disabled={busy}>{clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label className="field">Calendar date<input type="date" required value={date} onChange={e=>setDate(e.target.value)} disabled={busy}/></label>{!clients.length&&<p>Add or invite a client before assigning a yoga class.</p>}{error&&<p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>Cancel</button><button className="button primary" disabled={busy||!clientId||!date}>{busy?'Assigning…':needsCopy||prepared.status==='Draft'?'Publish & assign':'Confirm assignment'}</button></div></form></Modal>;
}
