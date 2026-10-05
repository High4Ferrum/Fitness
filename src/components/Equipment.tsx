import { useEffect, useState } from 'react';
import { Accessibility, Bike, Check, ChevronDown, Circle, CircleCheck, Dumbbell, Footprints, Info, Minus, MoveHorizontal, Plus, Save, StretchHorizontal, TrendingUp, Triangle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Data } from '../types';
import { api } from '../api';
import './Equipment.css';

interface Props { data: Data; refresh: () => Promise<void>; notify: (message: string) => void; }
const OPTIONS: { name: string; description: string; icon: LucideIcon; category: string }[] = [
  { name: 'Dumbbells', description: 'Free weights, fixed or adjustable', icon: Dumbbell, category: 'Strength' },
  { name: 'Barbell', description: 'Bar and weight plates', icon: MoveHorizontal, category: 'Strength' },
  { name: 'Bench', description: 'Flat or adjustable workout bench', icon: Minus, category: 'Strength' },
  { name: 'Resistance bands', description: 'Loop or tube resistance bands', icon: StretchHorizontal, category: 'Strength' },
  { name: 'Kettlebell', description: 'Single or multiple kettlebells', icon: Circle, category: 'Strength' },
  { name: 'Pull-up bar', description: 'Wall, doorway, or freestanding bar', icon: Accessibility, category: 'Strength' },
  { name: 'Cable machine', description: 'Adjustable pulley resistance', icon: Triangle, category: 'Strength' },
  { name: 'Treadmill', description: 'Indoor walking and running', icon: Footprints, category: 'Cardio & recovery' },
  { name: 'Stationary bike', description: 'Indoor cycling equipment', icon: Bike, category: 'Cardio & recovery' },
  { name: 'Yoga mat', description: 'A comfortable surface for floor work', icon: StretchHorizontal, category: 'Cardio & recovery' },
];
export default function Equipment({ data, refresh, notify }: Props) {
  const isClient = data.user.role === 'client';
  const [clientId, setClientId] = useState(isClient ? data.user.clientId || '' : data.clients[0]?.id || '');
  const client = data.clients.find(c => c.id === clientId);
  const [selected, setSelected] = useState<string[]>(client?.equipment || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (isClient) setClientId(data.user.clientId || '');
    else if (!data.clients.some(c => c.id === clientId)) setClientId(data.clients[0]?.id || '');
  }, [isClient, data.user.clientId, data.clients, clientId]);
  useEffect(() => { setSelected(client?.equipment || []); setError(''); }, [clientId, client?.equipment]);
  const dirty = JSON.stringify([...selected].sort()) !== JSON.stringify([...(client?.equipment || [])].sort());
  const customEquipment = [...new Set([...data.exercises.flatMap(exercise => exercise.equipment), ...selected])].filter(name => !OPTIONS.some(option => option.name === name)).sort((a, b) => a.localeCompare(b));
  const availableExercises = data.exercises.filter(e => !e.archived && e.equipment.every(item => selected.includes(item))).length;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const upcomingExerciseIds = [...new Set(data.plans.filter(p => p.clientId === clientId && p.date >= today).flatMap(p => p.items.map(i => i.exerciseId)))];
  const flagged = data.exercises.filter(e => upcomingExerciseIds.includes(e.id) && !e.equipment.every(item => selected.includes(item)));
  function toggle(name: string) { setSelected(previous => previous.includes(name) ? previous.filter(item => item !== name) : [...previous, name]); setError(''); }
  async function save() {
    if (!client || !dirty) return;
    setSaving(true); setError('');
    try { await api(`/clients/${client.id}`, 'PATCH', { equipment: selected }); await refresh(); notify('Equipment updated. Your next workout can fit what you have.'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to update equipment.'); }
    finally { setSaving(false); }
  }
  return <div className="equipment-page">
    <div className="page-heading"><div><span className="eyebrow">MAKE IT WORK FOR YOU</span><h1>{isClient ? 'My equipment' : 'Client equipment'}</h1><p>Great workouts start with what you have.</p></div>{!isClient && data.clients.length > 0 && <label className="eq-client-select"><span className="sr-only">Select client</span><select value={clientId} onChange={e => setClientId(e.target.value)} disabled={saving}>{data.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><ChevronDown size={16} /></label>}</div>
    {!client ? <div className="panel empty-state"><Dumbbell size={30} /><h3>No client selected</h3><p>Add a client to set up their available equipment.</p></div> : <>
      <section className="eq-banner"><div className="eq-banner-icon"><Dumbbell size={24} /></div><div><span className="eyebrow">YOUR SPACE. YOUR POSSIBILITIES.</span><h2>{selected.length ? `${selected.length} pieces of equipment. Plenty of possibilities.` : 'No equipment? There’s still a place to start.'}</h2><p>Select the equipment {isClient ? 'you can' : `${client.name.split(' ')[0]} can`} use. {isClient ? 'Your coach' : 'You'} can build a routine around it and choose alternatives when needed.</p></div><span className="eq-banner-count"><strong>{availableExercises}</strong><span>compatible exercises</span></span></section>
      <div className="eq-library-heading"><div><h2>Available equipment</h2><p>{isClient ? 'Choose everything you have access to, at home or at the gym.' : `Update the equipment available to ${client.name}.`}</p></div><span className="badge">{selected.length} selected</span></div>
      <div className="eq-bodyweight panel"><span className="eq-bodyweight-icon"><Accessibility size={25} /></span><div><h3>Bodyweight</h3><p>Always available. Your body is your starting point.</p></div><span className="eq-included"><Check size={14} />Included</span></div>
      {['Strength', 'Cardio & recovery'].map(category => <section className="eq-category" key={category}><h3>{category}</h3><div className="eq-grid">{OPTIONS.filter(item => item.category === category).map(({ name, description, icon: Icon }) => { const checked = selected.includes(name); return <button key={name} type="button" className={`eq-card panel ${checked ? 'eq-selected' : ''}`} aria-pressed={checked} onClick={() => toggle(name)} disabled={saving}><span className="eq-card-icon"><Icon size={28} strokeWidth={1.4} /></span><span className="eq-card-copy"><strong>{name}</strong><small>{description}</small></span><span className="eq-card-check">{checked ? <Check size={13} /> : <Plus size={13} />}</span></button>; })}</div></section>)}
      {customEquipment.length > 0 && <section className="eq-custom-equipment"><h3>More equipment from your exercise library</h3><div>{customEquipment.map(name => <button type="button" className={`tag eq-custom-tag ${selected.includes(name) ? 'eq-custom-selected' : ''}`} key={name} aria-pressed={selected.includes(name)} onClick={() => toggle(name)} disabled={saving}>{selected.includes(name) ? <Check size={12} /> : <Plus size={12} />}{name}</button>)}</div></section>}
      {flagged.length > 0 && <section className="eq-flagged panel"><Info size={20} /><div><h3>Some planned exercises need a second look</h3><p>{flagged.map(e => e.name).join(', ')} {flagged.length === 1 ? 'requires' : 'require'} equipment that isn’t selected. {isClient ? 'Ask your coach for an alternative.' : 'Choose an alternative in the weekly workout plan.'}</p></div><span className="badge">{flagged.length} flagged</span></section>}
      <div className="eq-footer"><div className="eq-footer-note"><CircleCheck size={16} /><span>{dirty ? 'You have unsaved changes.' : 'Equipment is up to date.'}</span></div><div><button type="button" className="button secondary" disabled={!dirty || saving} onClick={() => { setSelected(client.equipment); setError(''); }}>Reset changes</button><button type="button" className="button primary" onClick={save} disabled={!dirty || saving}><Save size={15} />{saving ? 'Saving…' : 'Save equipment'}</button></div></div>
      {error && <p className="eq-error" role="alert">{error}</p>}
      <p className="eq-bottom-note"><TrendingUp size={14} />Equipment helps match exercises. Your coach will also consider your experience, goals, and individual needs.</p>
    </>}
  </div>;
}
