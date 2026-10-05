import { useState, type FormEvent } from 'react';
import { Copy, TriangleAlert } from 'lucide-react';
import type { Data, Plan, WorkoutTemplate } from '../types';
import { api } from '../api';
import Modal from './Modal';

export default function CopyWorkout({ data, source, initialDate, onClose, onSaved }: { data: Data; source: Plan | WorkoutTemplate; initialDate: string; onClose: () => void; onSaved: (date: string) => Promise<void> }) {
  const [clientId, setClientId] = useState(data.clients[0]?.id || '');
  const [date, setDate] = useState(initialDate);
  const [name, setName] = useState(source.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const client = data.clients.find(client => client.id === clientId);
  const missing = [...new Set(source.items.flatMap(item => data.exercises.find(exercise => exercise.id === item.exerciseId)?.equipment.filter(tag => client && !client.equipment.some(available => available.toLowerCase() === tag.toLowerCase())) || []))];
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await api('ownerId' in source ? `/templates/${source.id}/assign` : `/plans/${source.id}/copy`, 'POST', { clientId, date, name: name.trim() });
      await onSaved(date);
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  return <Modal title="Copy workout to client" onClose={() => !busy && onClose()}>
    {!data.clients.length ? <><p className="workouts-modal-description">Add or invite a client from My clients first. “{source.name}” is saved and ready in your workout library.</p><div className="modal-actions"><button className="button secondary" onClick={onClose}>Close</button></div></> : <form onSubmit={submit}>
      <p className="workouts-modal-description">Copy “{source.name}” with all exercises, sets, reps, loads, rest, and notes. This creates a separate workout you can edit for your client.</p>
      <fieldset disabled={busy} className="workout-form-fieldset"><div className="form-grid"><label className="field">Client<select required value={clientId} onChange={event => setClientId(event.target.value)}>{data.clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label><label className="field">Workout date<input required type="date" value={date} onChange={event => setDate(event.target.value)} /></label></div><label className="field">Workout name<input required maxLength={100} value={name} onChange={event => setName(event.target.value)} /></label></fieldset>
      {missing.length > 0 && <p className="workout-equipment-note"><TriangleAlert size={15} />Review equipment for {client?.name}: {missing.join(', ')}. You can edit the copy after assigning it.</p>}
      {error && <p className="workouts-form-error" role="alert">{error}</p>}
      <div className="modal-actions"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" className="button primary" disabled={busy}>{busy ? 'Copying…' : 'Copy workout'}<Copy size={15} /></button></div>
    </form>}
  </Modal>;
}
