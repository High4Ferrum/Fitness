import { useMemo, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Copy, Check, CheckCircle2, ChevronDown, Clock3, Dumbbell, Eye, Plus, Search, Pencil, Trash2, TriangleAlert, X } from 'lucide-react';
import { api } from '../api';
import type { Client, Data, Exercise, Plan, PlanItem, WorkoutLog, WorkoutTemplate } from '../types';
import Modal from './Modal';
import CopyWorkout from './CopyWorkout';
import WeeklyLineups, { addWorkoutDays, workoutDateLabel } from './WeeklyLineups';
import './Workouts.css';

interface Props { data: Data; refresh: () => Promise<void>; notify: (message: string) => void; }
const weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
function localDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function readDate(date: string) { return new Date(`${date}T12:00:00`); }
function startOfWeek(date: Date) { const result = new Date(date); result.setDate(result.getDate() - (result.getDay() + 6) % 7); return localDate(result); }
function addDays(date: string, days: number) { const result = readDate(date); result.setDate(result.getDate() + days); return localDate(result); }
function shortDate(date: string) { return readDate(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
function fullDate(date: string) { return readDate(date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }); }
function missingEquipment(exercise: Exercise | undefined, client: Client | undefined) {
  if (!exercise || !client) return [];
  return exercise.equipment.filter(tag => !client.equipment.some(available => available.trim().toLowerCase() === tag.trim().toLowerCase()));
}

export default function Workouts({ data, refresh, notify }: Props) {
  const isClient = data.user.role === 'client';
  const ownClient = data.clients.find(client => client.id === data.user.clientId || client.userId === data.user.id);
  const [week, setWeek] = useState(() => startOfWeek(new Date()));
  const [clientFilter, setClientFilter] = useState('all');
  const [dayFilter, setDayFilter] = useState<string | null>(null);
  const [builder, setBuilder] = useState<{ plan?: Plan; date: string } | null>(null);
  const [section, setSection] = useState<'week' | 'library' | 'lineups'>('week');
  const [copying, setCopying] = useState<Plan | WorkoutTemplate | null>(null);
  const [logging, setLogging] = useState<Plan | null>(null);
  const [viewing, setViewing] = useState<Plan | null>(null);
  const [deleting, setDeleting] = useState<Plan | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const dates = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(week, index)), [week]);
  const weekPlans = data.plans.filter(plan => plan.date >= week && plan.date <= dates[6] && (isClient ? plan.clientId === ownClient?.id : clientFilter === 'all' || plan.clientId === clientFilter));
  const displayed = weekPlans.filter(plan => !dayFilter || plan.date === dayFilter).sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
  const completedCount = weekPlans.filter(plan => data.logs.some(log => log.planId === plan.id)).length;
  const assignedLineups = data.weeklyAssignments.filter(assignment => assignment.startDate <= dates[6] && addWorkoutDays(assignment.startDate, assignment.weeks * 7 - 1) >= week && (isClient ? assignment.clientId === ownClient?.id : clientFilter === 'all' || assignment.clientId === clientFilter));
  const exerciseById = (id: string) => data.exercises.find(exercise => exercise.id === id);
  const moveWeek = (amount: number) => { setWeek(addDays(week, amount)); setDayFilter(null); };
  async function saved(message: string) { await refresh(); notify(message); }
  async function removePlan() {
    if (!deleting) return;
    setDeleteBusy(true); setDeleteError('');
    try { await api(`/plans/${deleting.id}`, 'DELETE'); await saved('Workout removed.'); setDeleting(null); }
    catch (error) { setDeleteError(error instanceof Error ? error.message : 'Unable to remove this workout.'); }
    finally { setDeleteBusy(false); }
  }

  return <div className="workouts-page">
    <div className="page-heading">
      <div><p className="eyebrow">A LITTLE STRONGER, EVERY WEEK</p><h1>{isClient ? 'Your workouts' : 'Workout planning'}</h1><p className="workouts-subtitle">{isClient ? 'Your plan is here. Show up, make progress, and make it yours.' : 'Build daily routines. Arrange your week. Make it personal.'}</p></div>
      {!isClient && <button className="button primary" onClick={() => setBuilder({ date: dayFilter || week })}><Plus size={18} /> Build a workout</button>}
    </div>
    {!isClient && <><p className="workout-hierarchy">1 Exercise library <ArrowRight size={13} /> 2 Daily routines <ArrowRight size={13} /> 3 Weekly lineups</p><div className="workout-section-tabs" aria-label="Workout views"><button className={section === 'week' ? 'active' : ''} aria-pressed={section === 'week'} onClick={() => setSection('week')}><Clock3 size={16} />Client calendar</button><button className={section === 'library' ? 'active' : ''} aria-pressed={section === 'library'} onClick={() => setSection('library')}><BookOpen size={16} />Daily routines <span>{data.templates.length}</span></button><button className={section === 'lineups' ? 'active' : ''} aria-pressed={section === 'lineups'} onClick={() => setSection('lineups')}><Dumbbell size={16} />Weekly lineups <span>{data.weeklyLineups.length}</span></button></div></>}
    {section === 'library' && !isClient ? <TemplateLibrary data={data} refresh={refresh} notify={notify} onCopy={setCopying} /> : section === 'lineups' && !isClient ? <WeeklyLineups data={data} refresh={refresh} notify={notify} onDailyRoutines={() => setSection('library')} onAssigned={(clientId, date) => { setClientFilter(clientId); setWeek(date); setDayFilter(null); setSection('week'); }} /> : <>
    <div className="workouts-controls">
      <div className="week-navigation">
        <button className="workouts-icon-button" aria-label="Previous week" onClick={() => moveWeek(-7)}><ArrowLeft size={18} /></button>
        <span>{shortDate(week)} <span className="week-range-dash">–</span> {shortDate(dates[6])}, {readDate(dates[6]).getFullYear()}</span>
        <button className="workouts-icon-button" aria-label="Next week" onClick={() => moveWeek(7)}><ArrowRight size={18} /></button>
        <button className="button ghost workouts-today" onClick={() => { setWeek(startOfWeek(new Date())); setDayFilter(null); }}>This week</button>
      </div>
      {!isClient && <label className="workouts-client-filter"><span>Client</span><select aria-label="Filter workouts by client" value={clientFilter} onChange={event => setClientFilter(event.target.value)}><option value="all">All clients</option>{data.clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}</select><ChevronDown size={15} /></label>}
    </div>
    {assignedLineups.length > 0 && <div className="assigned-lineups">{assignedLineups.map(assignment => {
      const plans = data.plans.filter(plan => plan.weeklyAssignmentId === assignment.id);
      const done = plans.filter(plan => data.logs.some(log => log.planId === plan.id)).length;
      return <div className="assigned-lineup panel" key={assignment.id}><div><strong>{assignment.lineupName}</strong><span>{!isClient && `${data.clients.find(client => client.id === assignment.clientId)?.name || 'Client'} · `}{assignment.days.length} days / week · {assignment.weeks} weeks</span><span>{workoutDateLabel(assignment.startDate)} – {workoutDateLabel(addWorkoutDays(assignment.startDate, assignment.weeks * 7 - 1))}</span></div><span>{done} / {plans.length} workouts completed</span></div>;
    })}</div>}
    <div className="workout-week-strip" aria-label="Days of the week">
      {dates.map((date, index) => {
        const plans = weekPlans.filter(plan => plan.date === date);
        const allDone = plans.length > 0 && plans.every(plan => data.logs.some(log => log.planId === plan.id));
        return <button key={date} className={`workout-day ${date === localDate(new Date()) ? 'today' : ''} ${dayFilter === date ? 'selected' : ''}`} onClick={() => setDayFilter(dayFilter === date ? null : date)} aria-pressed={dayFilter === date}>
          <span className="workout-day-name">{weekdays[index].slice(0, 3)}</span><strong>{readDate(date).getDate()}</strong><span className={`workout-day-indicator ${allDone ? 'done' : ''}`}>{allDone ? <Check size={12} /> : plans.length ? `${plans.length} ${plans.length === 1 ? 'workout' : 'workouts'}` : '—'}</span>
        </button>;
      })}
    </div>
    <div className="workouts-list-heading"><div><h2>{dayFilter ? fullDate(dayFilter) : 'The weekly lineup'}</h2><span>{weekPlans.length} {weekPlans.length === 1 ? 'workout' : 'workouts'} planned <span className="workouts-dot">·</span> {completedCount} completed</span></div>{dayFilter && <button className="button ghost" onClick={() => setDayFilter(null)}>Show full week <X size={14} /></button>}</div>
    {displayed.length === 0 ? <div className="empty-state workouts-empty"><div className="workouts-empty-icon"><Dumbbell size={32} /></div><h3>{isClient ? 'Room for your next workout' : 'A fresh start for the week'}</h3><p>{isClient ? 'Your coach will add your workouts here. Use the arrows to explore other weeks.' : !data.clients.length ? 'Build reusable workouts now. Invite a client when you’re ready to assign them.' : dayFilter ? 'No workouts are planned for this day yet.' : 'Build a workout and give your clients a plan to feel good about.'}</p>{!isClient && <button className="button primary" onClick={() => setBuilder({ date: dayFilter || week })}><Plus size={17} /> Build a workout</button>}</div> : <div className="workout-cards">
      {displayed.map(plan => {
        const client = data.clients.find(item => item.id === plan.clientId);
        const log = data.logs.find(item => item.planId === plan.id);
        const equipmentFlags = plan.items.filter(item => missingEquipment(exerciseById(item.exerciseId), client).length > 0);
        return <article className={`workout-card panel ${log ? 'is-complete' : ''}`} key={plan.id}>
          <div className="workout-card-top"><span className="workout-card-date">{readDate(plan.date).toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()} <span>·</span> {shortDate(plan.date)}</span><span className={`badge ${log ? 'workout-completed-badge' : 'workout-planned-badge'}`}>{log ? <CheckCircle2 size={13} /> : <Clock3 size={13} />}{log ? 'Completed' : 'Planned'}</span></div>
          <h3>{plan.name}</h3>
          {plan.weeklyAssignmentId && <p className="workout-lineup-label">{data.weeklyAssignments.find(assignment => assignment.id === plan.weeklyAssignmentId)?.lineupName || 'Weekly lineup'}</p>}
          {!isClient && <div className="workout-client"><span className="workout-client-avatar" style={{ background: client?.color || '#d7e4e0' }}>{client?.name.split(' ').map(part => part[0]).slice(0, 2).join('') || '?'}</span><span>{client?.name || 'Client'}</span></div>}
          <div className="workout-card-exercises">{plan.items.slice(0, 3).map((item, index) => <div key={`${item.exerciseId}-${index}`} className="workout-preview-row"><span className="workout-exercise-icon"><Dumbbell size={16} /></span><div><strong>{exerciseById(item.exerciseId)?.name || 'Exercise'}</strong><span>{item.sets} × {item.reps} reps{item.weight > 0 ? ` · ${item.weight} lb` : ' · Bodyweight'}</span></div></div>)}{plan.items.length > 3 && <span className="workout-more-exercises">+ {plan.items.length - 3} more {plan.items.length - 3 === 1 ? 'exercise' : 'exercises'}</span>}</div>
          {equipmentFlags.length > 0 && <div className="workout-equipment-note"><TriangleAlert size={14} /><span>{equipmentFlags.length} {equipmentFlags.length === 1 ? 'exercise needs' : 'exercises need'} equipment to review</span></div>}
          {!isClient && <div className="workout-reuse-actions"><button className="button ghost" onClick={() => setCopying(plan)}><Copy size={15} />Copy to client</button><SaveToLibrary plan={plan} onSaved={async () => { await saved('Workout saved to your library.'); }} notify={notify} /></div>}
          <div className="workout-card-footer"><span>{plan.items.length} {plan.items.length === 1 ? 'exercise' : 'exercises'}</span><div>{log ? <button className="button secondary" onClick={() => setViewing(plan)}><Eye size={15} /> View results</button> : isClient ? <><button className="button ghost" onClick={() => setViewing(plan)} aria-label={`View ${plan.name}`}><Eye size={17} /></button><button className="button primary" onClick={() => setLogging(plan)}>Log workout <ArrowRight size={15} /></button></> : <><button className="workouts-icon-button" aria-label={`Remove ${plan.name}`} onClick={() => { setDeleting(plan); setDeleteError(''); }}><Trash2 size={16} /></button><button className="button secondary" onClick={() => setBuilder({ plan, date: plan.date })}><Pencil size={14} /> Edit workout</button></>}</div></div>
        </article>;
      })}
    </div>}
    </>}
    {builder && <PlanBuilder data={data} existing={builder.plan} initialDate={builder.date} initialClientId={section !== 'week' ? '' : clientFilter !== 'all' ? clientFilter : data.clients[0]?.id || ''} onClose={() => setBuilder(null)} onSaved={async library => { await saved(library ? 'Daily routine saved to your library.' : builder.plan ? 'Workout updated.' : 'Workout added to the week.'); if (library) setSection('library'); setBuilder(null); }} />}
    {copying && <CopyWorkout data={data} source={copying} initialDate={localDate(new Date())} onClose={() => setCopying(null)} onSaved={async date => { await saved('Workout copied to the client.'); setCopying(null); setWeek(startOfWeek(readDate(date))); setDayFilter(null); setClientFilter('all'); setSection('week'); }} />}
    {logging && ownClient && <LogWorkout data={data} plan={logging} clientId={ownClient.id} onClose={() => setLogging(null)} onSaved={async () => { await saved('Workout complete. Every session counts!'); setLogging(null); }} />}
    {viewing && <WorkoutDetails data={data} plan={viewing} log={data.logs.find(log => log.planId === viewing.id)} onClose={() => setViewing(null)} onLog={isClient && !data.logs.some(log => log.planId === viewing.id) ? () => { setLogging(viewing); setViewing(null); } : undefined} />}
    {deleting && <Modal title="Remove workout?" onClose={() => { if (!deleteBusy) setDeleting(null); }}><p className="workouts-modal-description">Remove “{deleting.name}” from the plan for {shortDate(deleting.date)}? Completed workouts are kept as part of the client's history.</p>{deleteError && <p role="alert" className="workouts-form-error">{deleteError}</p>}<div className="modal-actions"><button className="button secondary" disabled={deleteBusy} onClick={() => setDeleting(null)}>Keep workout</button><button className="button workouts-danger" disabled={deleteBusy} onClick={removePlan}>{deleteBusy ? 'Removing…' : 'Remove workout'}</button></div></Modal>}
  </div>;
}

function SaveToLibrary({ plan, onSaved, notify }: { plan: Plan; onSaved: () => Promise<void>; notify: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try { await api(`/plans/${plan.id}/template`, 'POST', {}); await onSaved(); }
    catch (error) { notify((error as Error).message); }
    finally { setBusy(false); }
  }
  return <button className="button ghost" disabled={busy} onClick={save}><BookOpen size={15} />{busy ? 'Saving…' : 'Save to library'}</button>;
}

function TemplateLibrary({ data, refresh, notify, onCopy }: Props & { onCopy: (template: WorkoutTemplate) => void }) {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<WorkoutTemplate | null>(null);
  const [duplicating, setDuplicating] = useState<WorkoutTemplate | null>(null);
  const [deleting, setDeleting] = useState<WorkoutTemplate | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const templates = data.templates.filter(template => template.name.toLowerCase().includes(search.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name));
  async function remove() {
    if (!deleting) return;
    setBusy(true); setError('');
    try { await api(`/templates/${deleting.id}`, 'DELETE'); await refresh(); setDeleting(null); notify('Workout removed from the library. Client copies are kept.'); }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }
  return <section className="workout-template-library">
    <div className="workouts-list-heading"><div><h2>Your daily routines</h2><span>Build Chest day, Legs, or a combined split. Reuse them in weekly lineups or copy to a client.</span></div></div>
    <label className="workout-library-search"><Search size={17} /><input aria-label="Search daily routines" placeholder="Search your workouts" value={search} onChange={event => setSearch(event.target.value)} /></label>
    {!data.clients.length && <p className="workout-coaching-note">You can build and save workouts now. Add or invite a client to start assigning copies.</p>}
    {templates.length ? <div className="workout-cards">{templates.map(template => <article className="workout-card panel" key={template.id}>
      <div className="workout-card-top"><span className="badge sage"><BookOpen size={13} />Reusable workout</span>{data.user.role === 'admin' && <span className="workout-template-owner">{data.users.find(user => user.id === template.ownerId)?.name || 'Coach'}</span>}</div>
      <h3>{template.name}</h3>
      <div className="workout-card-exercises">{template.items.map((item, index) => <div className="workout-preview-row" key={index}><span className="workout-exercise-icon"><Dumbbell size={16} /></span><div><strong>{data.exercises.find(exercise => exercise.id === item.exerciseId)?.name || 'Exercise'}</strong><span>{item.sets} × {item.reps} reps · {item.weight ? `${item.weight} lb` : 'Bodyweight'} · {item.rest}s rest</span>{item.notes && <small>{item.notes}</small>}</div></div>)}</div>
      {template.notes && <p className="workout-coaching-note">{template.notes}</p>}
      <div className="workout-reuse-actions"><button className="button primary" onClick={() => onCopy(template)}><Copy size={15} />Copy to client</button><button className="button secondary" onClick={() => setEditing(template)}><Pencil size={14} />Edit workout</button><button className="button ghost" onClick={() => setDuplicating(template)}><Copy size={14} />Duplicate routine</button><button className="workouts-icon-button" aria-label={`Remove ${template.name}`} onClick={() => { setDeleting(template); setError(''); }}><Trash2 size={16} /></button></div>
    </article>)}</div> : <div className="empty-state workouts-empty"><BookOpen size={28} /><h3>{search ? 'No matching workouts' : 'Start your daily routine library'}</h3><p>{search ? 'Try a different search.' : 'Use Build a workout and choose Daily routine library to save a reusable plan. No client or date is needed.'}</p></div>}
    {editing && <PlanBuilder data={data} template={editing} initialDate={localDate(new Date())} initialClientId="" onClose={() => setEditing(null)} onSaved={async () => { await refresh(); setEditing(null); notify('Library workout updated. Existing client copies are kept.'); }} />}
    {duplicating && <PlanBuilder data={data} startingRoutine={duplicating} initialDate={localDate(new Date())} initialClientId="" onClose={() => setDuplicating(null)} onSaved={async () => { await refresh(); setDuplicating(null); notify('Routine copy saved.'); }} />}
    {deleting && <Modal title="Remove library workout?" onClose={() => !busy && setDeleting(null)}><p className="workouts-modal-description">Remove “{deleting.name}” from your library? Workouts already copied to clients remain in their plans.</p>{error && <p className="workouts-form-error" role="alert">{error}</p>}<div className="modal-actions"><button className="button secondary" disabled={busy} onClick={() => setDeleting(null)}>Keep workout</button><button className="button workouts-danger" disabled={busy} onClick={remove}>{busy ? 'Removing…' : 'Remove workout'}</button></div></Modal>}
  </section>;
}

function PlanBuilder({ data, existing, template, startingRoutine, initialDate, initialClientId, onClose, onSaved }: { data: Data; existing?: Plan; template?: WorkoutTemplate; startingRoutine?: WorkoutTemplate; initialDate: string; initialClientId: string; onClose: () => void; onSaved: (library: boolean) => Promise<void> }) {
  const [clientId, setClientId] = useState(existing?.clientId || initialClientId);
  const [name, setName] = useState(existing?.name || template?.name || (startingRoutine ? `${startingRoutine.name} copy` : ''));
  const [date, setDate] = useState(existing?.date || initialDate);
  const [notes, setNotes] = useState(existing?.notes || template?.notes || startingRoutine?.notes || '');
  const [items, setItems] = useState<PlanItem[]>((existing || template || startingRoutine)?.items.map(item => ({ ...item })) || []);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const client = data.clients.find(item => item.id === clientId);
  const availableExercises = data.exercises.filter(exercise => !exercise.archived && `${exercise.name} ${exercise.category} ${exercise.equipment.join(' ')}`.toLowerCase().includes(search.toLowerCase()));
  function addExercise(exercise: Exercise) { setItems(current => [...current, { exerciseId: exercise.id, sets: 3, reps: 10, weight: 0, rest: 60, notes: '' }]); setError(''); }
  function updateItem(index: number, key: keyof PlanItem, value: number | string) { setItems(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item)); }
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    if (!items.length) { setError('Add at least one exercise to this workout.'); return; }
    setBusy(true);
    try {
      const library = !clientId;
      await api(library ? template ? `/templates/${template.id}` : '/templates' : existing ? `/plans/${existing.id}` : '/plans', existing || template ? 'PATCH' : 'POST', library ? { name: name.trim(), items, notes: notes.trim() } : { clientId, name: name.trim(), date, items, notes: notes.trim() });
      await onSaved(library);
    }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save the workout.'); }
    finally { setBusy(false); }
  }
  return <Modal title={existing || template ? 'Edit workout' : 'Build a workout'} onClose={() => { if (!busy) onClose(); }}><form onSubmit={submit} className="workout-builder">
    <p className="workouts-modal-description">Choose your movements, set the intention, and make it personal.</p>
    <fieldset disabled={busy} className="workout-form-fieldset">
      {!template && <div className="form-grid"><label className="field">Client<select disabled={!!existing?.weeklyAssignmentId} value={clientId} onChange={event => setClientId(event.target.value)}>{!existing && <option value="">Daily routine library · assign later</option>}{data.clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>{clientId && <label className="field">Workout date<input required type="date" value={date} onChange={event => setDate(event.target.value)} /></label>}</div>}
      {!clientId && <p className="workout-coaching-note">This daily routine stays in your library. Add it to weekly lineups or copy it to a client when you’re ready.</p>}
      <label className="field">Workout name<input required maxLength={100} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Upper body · strength foundations" /></label>
      <div className="workout-builder-section-title"><h3>Exercises</h3><span>{items.length} added</span></div>
      {items.length === 0 && <div className="workout-builder-placeholder"><Dumbbell size={22} /><p>Your workout starts with one movement.<br />Choose an exercise from the library below.</p></div>}
      <div className="workout-builder-items">{items.map((item, index) => {
        const exercise = data.exercises.find(exercise => exercise.id === item.exerciseId);
        const missing = missingEquipment(exercise, client);
        const alternatives = exercise?.alternatives.map(id => data.exercises.find(exercise => exercise.id === id)).filter((candidate): candidate is Exercise => !!candidate && !candidate.archived && missingEquipment(candidate, client).length === 0 && !items.some(item => item.exerciseId === candidate.id)) || [];
        return <div className="workout-builder-item" key={`${item.exerciseId}-${index}`}><div className="workout-builder-item-title"><span className="workout-item-number">{String(index + 1).padStart(2, '0')}</span><div><strong>{exercise?.name || 'Exercise'}</strong><span>{exercise?.equipment.join(' + ') || 'No equipment needed'}</span></div><button className="workouts-icon-button" type="button" aria-label={`Remove ${exercise?.name || 'exercise'}`} onClick={() => setItems(current => current.filter((_, itemIndex) => itemIndex !== index))}><X size={17} /></button></div>
          <div className="workout-prescription-grid">{([{ key: 'sets', label: 'Sets', min: 1, max: 50 }, { key: 'reps', label: 'Reps', min: 1, max: 1000 }, { key: 'weight', label: 'Weight (lb)', min: 0, max: 2000 }, { key: 'rest', label: 'Rest (sec)', min: 0, max: 3600 }] as const).map(field => <label className="field" key={field.key}>{field.label}<input aria-label={`${exercise?.name || 'Exercise'} ${field.label}`} type="number" required min={field.min} max={field.max} step={field.key === 'weight' ? '0.5' : '1'} value={item[field.key]} onChange={event => updateItem(index, field.key, Number(event.target.value))} /></label>)}</div>
          <label className="field workout-item-note-label">Coaching note<input maxLength={500} value={item.notes} placeholder="Optional cue or modification" onChange={event => updateItem(index, 'notes', event.target.value)} /></label>
          {exercise?.archived && <p className="workouts-form-error">This exercise is archived. Remove it and add an active exercise from the library.</p>}
          {missing.length > 0 && <div className="workout-equipment-warning"><TriangleAlert size={15} /><div><strong>Equipment to review: {missing.join(', ')}</strong><p>{client?.name.split(' ')[0]} hasn't listed this equipment. You can keep it if you've arranged access.</p>{alternatives.length > 0 && <div className="workout-alternative-buttons"><span>Available alternatives:</span>{alternatives.map(alternative => <button className="button ghost" type="button" key={alternative.id} onClick={() => updateItem(index, 'exerciseId', alternative.id)}>{alternative.name} <ArrowRight size={12} /></button>)}</div>}</div></div>}
        </div>;
      })}</div>
      <div className="workout-library-picker"><div className="workout-builder-section-title"><h3>Add from your library</h3><span>{data.exercises.filter(exercise => !exercise.archived).length} movements</span></div><label className="workout-library-search"><Search size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search exercises or equipment" aria-label="Search exercises to add" /></label>{items.length >= 40 && <p className="workout-coaching-note">A workout can contain up to 40 exercises.</p>}<div className="workout-library-options">{availableExercises.length ? availableExercises.map(exercise => { const added = items.some(item => item.exerciseId === exercise.id); const missing = missingEquipment(exercise, client); return <button type="button" className="workout-library-option" key={exercise.id} disabled={added || items.length >= 40} onClick={() => addExercise(exercise)}><span className="workout-exercise-icon"><Dumbbell size={17} /></span><span className="workout-library-option-info"><strong>{exercise.name}</strong><span>{exercise.equipment.join(' + ') || 'Bodyweight'}{missing.length > 0 && <TriangleAlert size={12} aria-label="Missing equipment" />}</span></span>{added ? <Check size={17} /> : <Plus size={17} />}</button>; }) : <p className="workout-library-no-results">No matching exercises. Try a different search.</p>}</div></div>
      <label className="field workout-session-notes">Workout notes<textarea maxLength={2000} rows={3} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Warm-up, focus for the session, or anything your client should know…" /></label>
    </fieldset>
    {error && <p className="workouts-form-error" role="alert">{error}</p>}
    <div className="modal-actions"><button type="button" className="button secondary" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" className="button primary" disabled={busy}>{busy ? 'Saving…' : existing || template ? 'Save changes' : 'Save workout'} <Check size={16} /></button></div>
  </form></Modal>;
}

function LogWorkout({ data, plan, clientId, onClose, onSaved }: { data: Data; plan: Plan; clientId: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const [items, setItems] = useState(plan.items.map(({ exerciseId, sets, reps, weight }) => ({ exerciseId, sets, reps, weight })));
  const [notes, setNotes] = useState('');
  const [date, setDate] = useState(localDate(new Date()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { await api('/logs', 'POST', { clientId, planId: plan.id, date, items, notes: notes.trim() }); await onSaved(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save your workout.'); }
    finally { setBusy(false); }
  }
  return <Modal title="Log your workout" onClose={() => { if (!busy) onClose(); }}><form onSubmit={submit}><p className="workouts-modal-description">{plan.name}. Record what you did so your coach can see your progress.</p><fieldset disabled={busy} className="workout-form-fieldset"><label className="field">Completed on<input type="date" required max={localDate(new Date())} value={date} onChange={event => setDate(event.target.value)} /></label><div className="workout-log-items">{items.map((item, index) => { const exercise = data.exercises.find(exercise => exercise.id === item.exerciseId); const prescribed = plan.items[index]; return <div className="workout-log-item" key={`${item.exerciseId}-${index}`}><div className="workout-log-item-heading"><span className="workout-item-number">{String(index + 1).padStart(2, '0')}</span><div><h3>{exercise?.name || 'Exercise'}</h3><p>Planned: {prescribed.sets} × {prescribed.reps} reps · {prescribed.weight ? `${prescribed.weight} lb` : 'Bodyweight'}</p></div></div>{prescribed.notes && <p className="workout-coaching-note">{prescribed.notes}</p>}<div className="workout-log-grid">{([{ key: 'sets', label: 'Actual sets', min: 1, max: 50 }, { key: 'reps', label: 'Reps per set', min: 1, max: 1000 }, { key: 'weight', label: 'Weight (lb)', min: 0, max: 2000 }] as const).map(field => <label className="field" key={field.key}>{field.label}<input type="number" required aria-label={`${exercise?.name || 'Exercise'} ${field.label}`} min={field.min} max={field.max} step={field.key === 'weight' ? '0.5' : '1'} value={item[field.key]} onChange={event => setItems(current => current.map((entry, itemIndex) => itemIndex === index ? { ...entry, [field.key]: Number(event.target.value) } : entry))} /></label>)}</div></div>; })}</div><label className="field">How did it feel?<textarea rows={3} maxLength={2000} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Energy, a new personal best, or something to discuss with your coach…" /></label></fieldset>{error && <p role="alert" className="workouts-form-error">{error}</p>}<div className="modal-actions"><button className="button secondary" type="button" disabled={busy} onClick={onClose}>Cancel</button><button className="button primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Mark complete'} <CheckCircle2 size={16} /></button></div></form></Modal>;
}

function WorkoutDetails({ data, plan, log, onClose, onLog }: { data: Data; plan: Plan; log?: WorkoutLog; onClose: () => void; onLog?: () => void }) {
  const client = data.clients.find(client => client.id === plan.clientId);
  return <Modal title={plan.name} onClose={onClose}><div className="workout-details"><p className="workouts-modal-description">{client?.name} <span className="workouts-dot">·</span> {fullDate(plan.date)}</p>{log && <div className="workout-results-banner"><CheckCircle2 size={20} /><div><strong>Workout completed</strong><span>Logged {fullDate(log.date)}</span></div></div>}{plan.notes && <div className="workout-detail-notes"><strong>Your coach's notes</strong><p>{plan.notes}</p></div>}<div className="workout-detail-exercises">{plan.items.map((item, index) => { const exercise = data.exercises.find(exercise => exercise.id === item.exerciseId); const actual = log?.items.find(entry => entry.exerciseId === item.exerciseId); const missing = missingEquipment(exercise, client); return <div className="workout-detail-exercise" key={`${item.exerciseId}-${index}`}><div className="workout-detail-exercise-heading"><span className="workout-item-number">{String(index + 1).padStart(2, '0')}</span><div><h3>{exercise?.name || 'Exercise'}</h3><span>{exercise?.equipment.join(' + ') || 'Bodyweight'}</span></div></div><div className="workout-detail-stats"><div><span>Prescribed</span><strong>{item.sets} × {item.reps} reps · {item.weight ? `${item.weight} lb` : 'Bodyweight'}</strong></div>{actual ? <div className="workout-actual-stat"><span>Completed</span><strong>{actual.sets} × {actual.reps} reps · {actual.weight ? `${actual.weight} lb` : 'Bodyweight'}</strong></div> : <div><span>Rest between sets</span><strong>{item.rest} seconds</strong></div>}</div>{item.notes && <p className="workout-coaching-note">{item.notes}</p>}{!log && missing.length > 0 && <p className="workout-equipment-note"><TriangleAlert size={14} /> Equipment to discuss with your coach: {missing.join(', ')}</p>}{exercise?.instructions && <p className="workout-exercise-instructions">{exercise.instructions}</p>}{exercise?.cues && <p className="workout-exercise-cues"><strong>Focus:</strong> {exercise.cues}</p>}{exercise?.videoUrl && /^https?:\/\//i.test(exercise.videoUrl) && <a className="button ghost workout-video-link" href={exercise.videoUrl} target="_blank" rel="noopener noreferrer">{exercise.videoUrl.includes('/results?') ? 'Find a video on YouTube' : 'Watch demonstration'} <ArrowRight size={14} /></a>}</div>; })}</div>{log?.notes && <div className="workout-detail-notes"><strong>Client's reflection</strong><p>{log.notes}</p></div>}<div className="modal-actions"><button className="button secondary" onClick={onClose}>Close</button>{onLog && <button className="button primary" onClick={onLog}>Log workout <ArrowRight size={16} /></button>}</div></div></Modal>;
}
