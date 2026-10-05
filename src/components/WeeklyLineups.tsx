import { useState, type FormEvent } from 'react';
import { CalendarDays, Copy, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../api';
import type { Data, WeeklyLineup, WeeklyLineupDay } from '../types';
import Modal from './Modal';
import './WeeklyLineups.css';

export const lineupWeekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export function addWorkoutDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function workoutDateLabel(date: string) { return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
function currentMonday() {
  const date = new Date(); date.setDate(date.getDate() - (date.getDay() + 6) % 7);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
interface Props { data: Data; refresh: () => Promise<void>; notify: (message: string) => void; onAssigned: (clientId: string, startDate: string) => void; onDailyRoutines: () => void; }

export default function WeeklyLineups({ data, refresh, notify, onAssigned, onDailyRoutines }: Props) {
  const [editor, setEditor] = useState<{ lineup?: WeeklyLineup; duplicate?: boolean } | null>(null);
  const [assigning, setAssigning] = useState<WeeklyLineup | null>(null);
  const [removing, setRemoving] = useState<WeeklyLineup | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lineups = [...data.weeklyLineups].sort((a, b) => a.name.localeCompare(b.name));
  async function remove() {
    if (!removing) return;
    setBusy(true); setError('');
    try { await api(`/weekly-lineups/${removing.id}`, 'DELETE'); await refresh(); setRemoving(null); notify('Weekly lineup removed. Assigned client workouts are kept.'); }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  return <section className="weekly-lineups-page">
    <div className="weekly-library-heading"><div><h2>Weekly lineups</h2><p>Arrange daily routines into 3–5 training days. Assign the same week for 2–4 weeks.</p></div><button className="button primary" disabled={!data.templates.length} onClick={() => setEditor({})}><Plus size={16} />Build a weekly lineup</button></div>
    {!data.templates.length ? <div className="empty-state workouts-empty"><CalendarDays size={30} /><h3>Start with your daily routines</h3><p>Build routines such as Chest & arms, Legs, and Back from the exercise library, then arrange them into a week.</p><button className="button secondary" onClick={onDailyRoutines}>Open daily routines</button></div> : lineups.length ? <div className="workout-cards">{lineups.map(lineup => <article className="panel weekly-lineup-card" key={lineup.id}>
      <div className="workout-card-top"><span className="badge sage">{lineup.days.length} training days / week</span>{data.user.role === 'admin' && <span className="workout-template-owner">{data.users.find(user => user.id === lineup.ownerId)?.name || 'Coach'}</span>}</div>
      <h3>{lineup.name}</h3>
      <div className="weekly-lineup-days">{lineupWeekdays.map((name, weekday) => {
        const day = lineup.days.find(day => day.weekday === weekday), routine = data.templates.find(template => template.id === day?.templateId);
        return <div className={`weekly-day-summary ${day ? 'training' : 'rest'}`} key={name}><strong>{name.slice(0, 3)}</strong><span>{day ? routine?.name || 'Daily routine' : 'Rest day'}</span>{routine && <small>{routine.items.length} exercises</small>}</div>;
      })}</div>
      {lineup.notes && <p className="workout-coaching-note">{lineup.notes}</p>}
      <div className="workout-reuse-actions"><button className="button primary" onClick={() => setAssigning(lineup)}><CalendarDays size={15} />Assign to client</button><button className="button secondary" onClick={() => setEditor({ lineup })}><Pencil size={14} />Edit lineup</button><button className="button ghost" onClick={() => setEditor({ lineup, duplicate: true })}><Copy size={14} />Duplicate lineup</button><button className="workouts-icon-button" aria-label={`Remove ${lineup.name}`} onClick={() => { setRemoving(lineup); setError(''); }}><Trash2 size={16} /></button></div>
    </article>)}</div> : <div className="empty-state workouts-empty"><CalendarDays size={30} /><h3>Build your first weekly lineup</h3><p>For example: Monday Chest & arms, Wednesday Legs, and Friday Back & shoulders. Choose your own training and rest days.</p><button className="button secondary" onClick={() => setEditor({})}>Build a weekly lineup</button></div>}
    {editor && <WeeklyLineupEditor data={data} lineup={editor.lineup} duplicate={editor.duplicate} onClose={() => setEditor(null)} onSaved={async () => { await refresh(); setEditor(null); notify('Weekly lineup saved.'); }} />}
    {assigning && <AssignWeeklyLineup data={data} lineup={assigning} onClose={() => setAssigning(null)} onSaved={async (clientId, date, count) => { await refresh(); setAssigning(null); notify(`${count} workouts assigned to the client.`); onAssigned(clientId, date); }} />}
    {removing && <Modal title="Remove weekly lineup?" onClose={() => !busy && setRemoving(null)}><p className="workouts-modal-description">Remove “{removing.name}” from the weekly library? All workouts already assigned to clients remain on their calendars.</p>{error && <p className="workouts-form-error" role="alert">{error}</p>}<div className="modal-actions"><button className="button secondary" disabled={busy} onClick={() => setRemoving(null)}>Keep lineup</button><button className="button workouts-danger" disabled={busy} onClick={remove}>{busy ? 'Removing…' : 'Remove lineup'}</button></div></Modal>}
  </section>;
}

function DailySelections({ data, days, onChange, ownerId }: { data: Data; days: WeeklyLineupDay[]; onChange: (days: WeeklyLineupDay[]) => void; ownerId?: string }) {
  const coachOwned = ownerId && data.users.find(user => user.id === ownerId)?.role === 'coach';
  const routines = data.templates.filter(template => !coachOwned || template.ownerId === ownerId);
  function choose(weekday: number, templateId: string) {
    const next = days.filter(day => day.weekday !== weekday);
    if (templateId) next.push({ weekday, templateId });
    onChange(next.sort((a, b) => a.weekday - b.weekday));
  }
  return <div className="weekly-routine-selectors">{lineupWeekdays.map((day, weekday) => <label className="field weekly-routine-selector" key={day}><span>{day}</span><select aria-label={`${day} routine`} value={days.find(day => day.weekday === weekday)?.templateId || ''} onChange={event => choose(weekday, event.target.value)}><option value="">Rest day</option>{routines.map(routine => <option key={routine.id} value={routine.id}>{routine.name}</option>)}</select></label>)}</div>;
}

function WeeklyLineupEditor({ data, lineup, duplicate, onClose, onSaved }: { data: Data; lineup?: WeeklyLineup; duplicate?: boolean; onClose: () => void; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(lineup ? lineup.name + (duplicate ? ' copy' : '') : '');
  const [notes, setNotes] = useState(lineup?.notes || '');
  const [days, setDays] = useState<WeeklyLineupDay[]>(lineup?.days.map(day => ({ ...day })) || []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { await api(lineup && !duplicate ? `/weekly-lineups/${lineup.id}` : '/weekly-lineups', lineup && !duplicate ? 'PATCH' : 'POST', { name: name.trim(), notes: notes.trim(), days }); await onSaved(); }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  return <Modal title={duplicate ? 'Duplicate weekly lineup' : lineup ? 'Edit weekly lineup' : 'Build a weekly lineup'} onClose={() => !busy && onClose()}><form onSubmit={submit}>
    <p className="workouts-modal-description">Choose 3–5 training days from your daily routines. Leave the other days as rest days. This lineup can be reused across clients and weeks.</p>
    <fieldset disabled={busy} className="workout-form-fieldset"><label className="field">Weekly lineup name<input required maxLength={120} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. 4-day strength split" /></label><DailySelections data={data} days={days} onChange={setDays} ownerId={lineup && !duplicate ? lineup.ownerId : data.user.id} /><p className="weekly-day-count">{days.length} training days · {7 - days.length} rest days. Choose 3–5 training days.</p><label className="field">Lineup notes<textarea rows={3} maxLength={2000} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Focus, progression, or instructions for the week" /></label></fieldset>
    {error && <p className="workouts-form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>Cancel</button><button className="button primary" disabled={busy || days.length < 3 || days.length > 5}>{busy ? 'Saving…' : 'Save weekly lineup'}</button></div>
  </form></Modal>;
}

function AssignWeeklyLineup({ data, lineup, onClose, onSaved }: { data: Data; lineup: WeeklyLineup; onClose: () => void; onSaved: (clientId: string, date: string, count: number) => Promise<void> }) {
  const [clientId, setClientId] = useState(data.clients[0]?.id || '');
  const [startDate, setStartDate] = useState(currentMonday);
  const [weeks, setWeeks] = useState(4);
  const [days, setDays] = useState(lineup.days.map(day => ({ ...day })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const validStart = /^\d{4}-\d{2}-\d{2}$/.test(startDate) && new Date(`${startDate}T12:00:00Z`).getUTCDay() === 1;
  const client = data.clients.find(client => client.id === clientId);
  const equipment = [...new Set(days.flatMap(day => data.templates.find(template => template.id === day.templateId)?.items.flatMap(item => data.exercises.find(exercise => exercise.id === item.exerciseId)?.equipment.filter(tag => client && !client.equipment.some(available => available.toLowerCase() === tag.toLowerCase())) || []) || []))];
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { const result = await api<{ planCount: number }>(`/weekly-lineups/${lineup.id}/assign`, 'POST', { clientId, startDate, weeks, days }); await onSaved(clientId, startDate, result.planCount); }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  return <Modal title="Assign weekly lineup" onClose={() => !busy && onClose()}>{!data.clients.length ? <><p className="workouts-modal-description">“{lineup.name}” is saved. Add or invite a client from My clients before assigning it.</p><div className="modal-actions"><button className="button secondary" onClick={onClose}>Close</button></div></> : <form onSubmit={submit}>
    <p className="workouts-modal-description">Assign “{lineup.name}”. Customize the daily routines below for this client; the saved weekly lineup stays the same.</p>
    <fieldset disabled={busy} className="workout-form-fieldset"><label className="field">Client<select required value={clientId} onChange={event => setClientId(event.target.value)}>{data.clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label><div className="form-grid"><label className="field">Week starting (Monday)<input required type="date" value={startDate} onChange={event => setStartDate(event.target.value)} /></label><label className="field">Repeat for<select value={weeks} onChange={event => setWeeks(Number(event.target.value))}><option value={2}>2 weeks</option><option value={3}>3 weeks</option><option value={4}>4 weeks</option></select></label></div><DailySelections data={data} days={days} onChange={setDays} ownerId={data.user.id} /></fieldset>
    {startDate && !validStart && <p className="workouts-form-error">Choose a Monday for the first week.</p>}
    {validStart && <div className="weekly-assignment-preview"><strong>{days.length * weeks} workouts across {weeks} weeks</strong><p>{workoutDateLabel(startDate)} – {workoutDateLabel(addWorkoutDays(startDate, weeks * 7 - 1))}</p>{Array.from({ length: weeks }, (_, week) => <div key={week}><strong>Week {week + 1}</strong><span>{days.map(day => `${lineupWeekdays[day.weekday].slice(0, 3)} ${workoutDateLabel(addWorkoutDays(startDate, week * 7 + day.weekday))}`).join(' · ')}</span></div>)}</div>}
    <p className="workout-coaching-note">Existing workouts on the chosen training dates are kept. If dates overlap, choose different weeks or training days. You can edit each assigned workout independently afterward.</p>
    {equipment.length > 0 && <p className="workout-equipment-note">Review equipment for {client?.name}: {equipment.join(', ')}.</p>}
    {error && <p className="workouts-form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>Cancel</button><button className="button primary" disabled={busy || !validStart || days.length < 3 || days.length > 5}>{busy ? 'Assigning…' : `Assign ${days.length * weeks} workouts`}</button></div>
  </form>}</Modal>;
}
