import { useMemo, useState } from 'react';
import { Activity, ArrowUpRight, Check, Dumbbell, Flame, Heart, Layers3, Pencil, Plus, Search, SlidersHorizontal, StretchHorizontal, Trash2, Video } from 'lucide-react';
import type { Data, Exercise } from '../types';
import { api } from '../api';
import Modal from './Modal';
import './Library.css';

interface Props { data: Data; refresh: () => Promise<void>; notify: (message: string) => void; }
const categories = ['All exercises', 'Strength', 'Mobility', 'Cardio', 'Core'];
const basicEquipment = ['Bodyweight', 'Dumbbells', 'Barbell', 'Bench', 'Resistance bands', 'Kettlebell', 'Cable machine', 'Pull-up bar', 'Yoga mat'];
type Draft = Omit<Exercise, 'id'>;
const blankExercise = (): Draft => ({ name: '', category: 'Strength', muscles: '', equipment: ['Bodyweight'], difficulty: 'Beginner', instructions: '', cues: '', videoUrl: '', alternatives: [], archived: false });

function categoryIcon(category: string, size = 22) {
  if (category === 'Mobility') return <StretchHorizontal size={size} strokeWidth={1.5} />;
  if (category === 'Cardio') return <Flame size={size} strokeWidth={1.5} />;
  if (category === 'Core') return <Activity size={size} strokeWidth={1.5} />;
  return <Dumbbell size={size} strokeWidth={1.5} />;
}

function validVideoUrl(value: string) {
  if (!value.trim()) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(url.hostname);
  } catch { return false; }
}

export default function Library({ data, refresh, notify }: Props) {
  const isAdmin = data.user.role === 'admin';
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All exercises');
  const [equipmentFilter, setEquipmentFilter] = useState('All equipment');
  const [selected, setSelected] = useState<Exercise | null>(null);
  const [editing, setEditing] = useState<Exercise | 'new' | null>(null);
  const [draft, setDraft] = useState<Draft>(blankExercise);
  const [customEquipment, setCustomEquipment] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [archiveConfirm, setArchiveConfirm] = useState(false);
  const exercises = data.exercises.filter(exercise => !exercise.archived);
  const equipmentOptions = useMemo(() => [...new Set([...basicEquipment, ...data.exercises.flatMap(exercise => exercise.equipment)])].sort(), [data.exercises]);
  const visible = exercises.filter(exercise => {
    const text = [exercise.name, exercise.muscles, exercise.category, ...(exercise.equipment.length ? exercise.equipment : ['Bodyweight'])].join(' ').toLowerCase();
    return text.includes(search.toLowerCase().trim()) && (category === 'All exercises' || exercise.category === category) && (equipmentFilter === 'All equipment' || (equipmentFilter === 'Bodyweight' ? exercise.equipment.length === 0 : exercise.equipment.includes(equipmentFilter)));
  });
  const equipmentCount = new Set(exercises.flatMap(exercise => exercise.equipment)).size;
  const alternativeLabel = (id: string) => data.exercises.find(exercise => exercise.id === id)?.name || id;

  function openEditor(exercise?: Exercise) {
    setEditing(exercise || 'new');
    setDraft(exercise ? { name: exercise.name, category: exercise.category, muscles: exercise.muscles, equipment: exercise.equipment.length ? [...exercise.equipment] : ['Bodyweight'], difficulty: exercise.difficulty, instructions: exercise.instructions, cues: exercise.cues, videoUrl: exercise.videoUrl, alternatives: [...exercise.alternatives], archived: exercise.archived } : blankExercise());
    setCustomEquipment('');
    setError('');
    setSelected(null);
  }

  function toggleEquipment(equipment: string) {
    setDraft(previous => {
      if (equipment === 'Bodyweight') return { ...previous, equipment: ['Bodyweight'] };
      const selectedEquipment = previous.equipment.filter(item => item !== 'Bodyweight');
      const next = selectedEquipment.includes(equipment) ? selectedEquipment.filter(item => item !== equipment) : [...selectedEquipment, equipment];
      return { ...previous, equipment: next.length ? next : ['Bodyweight'] };
    });
  }

  function addEquipment() {
    const value = customEquipment.trim();
    if (value && !draft.equipment.some(item => item.toLowerCase() === value.toLowerCase())) setDraft(previous => ({ ...previous, equipment: [...previous.equipment.filter(item => item !== 'Bodyweight'), value] }));
    setCustomEquipment('');
  }

  async function saveExercise(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (!draft.name.trim() || !draft.muscles.trim() || !draft.instructions.trim()) { setError('Add a name, target muscles, and instructions before saving.'); return; }
    if (!validVideoUrl(draft.videoUrl)) { setError('Use a secure YouTube video or YouTube search link.'); return; }
    setBusy(true);
    try {
      const payload = { ...draft, equipment: draft.equipment.filter(item => item !== 'Bodyweight'), name: draft.name.trim(), muscles: draft.muscles.trim(), instructions: draft.instructions.trim(), cues: draft.cues.trim(), videoUrl: draft.videoUrl.trim() };
      await api(editing === 'new' ? '/exercises' : `/exercises/${(editing as Exercise).id}`, editing === 'new' ? 'POST' : 'PATCH', payload);
      await refresh();
      notify(editing === 'new' ? 'Exercise added to your library.' : 'Exercise updated.');
      setEditing(null);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to save exercise.'); }
    finally { setBusy(false); }
  }

  async function archiveExercise() {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      await api(`/exercises/${selected.id}`, 'DELETE');
      await refresh();
      notify('Exercise archived. Existing workout records are preserved.');
      setSelected(null);
      setArchiveConfirm(false);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to archive exercise.'); }
    finally { setBusy(false); }
  }

  function viewExercise(exercise: Exercise) { setSelected(exercise); setArchiveConfirm(false); setError(''); }

  return <div className="library-page">
    <div className="page-heading">
      <div><p className="eyebrow">THE BUILDING BLOCKS</p><h1>Exercise library</h1><p>Good movement starts here. Find the right exercise for every body.</p></div>
      {isAdmin && <button className="button primary" onClick={() => openEditor()}><Plus size={18} /> Add exercise</button>}
    </div>

    <div className="library-intro panel">
      <div className="library-intro-icon"><Layers3 size={30} strokeWidth={1.4} /></div>
      <div><span className="eyebrow">YOUR MOVEMENT COLLECTION</span><h3>Thoughtfully selected. Ready to coach.</h3><p>Clear instructions, equipment tags, and demonstrations—all in one place.</p></div>
      <div className="library-intro-stat"><strong>{exercises.length}</strong><span>exercises</span></div>
      <div className="library-intro-stat"><strong>{equipmentCount}</strong><span>equipment types</span></div>
    </div>

    <div className="library-toolbar">
      <div className="library-search"><Search size={18} /><input className="search-input" aria-label="Search exercises" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search exercises, muscles, equipment..." /></div>
      <div className="library-equipment-filter"><SlidersHorizontal size={16} /><select aria-label="Filter by equipment" value={equipmentFilter} onChange={event => setEquipmentFilter(event.target.value)}><option>All equipment</option>{equipmentOptions.map(item => <option key={item}>{item}</option>)}</select></div>
    </div>
    <div className="library-category-row">
      <div className="library-categories" aria-label="Exercise categories">{categories.map(item => <button key={item} className={`library-category ${category === item ? 'active' : ''}`} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</div>
      <span className="library-count">{visible.length} {visible.length === 1 ? 'exercise' : 'exercises'}</span>
    </div>

    {visible.length ? <div className="card-grid library-grid">{visible.map((exercise, index) => <article className="exercise-card" key={exercise.id}>
      <button className={`exercise-art category-${exercise.category.toLowerCase()}`} onClick={() => viewExercise(exercise)} aria-label={`View ${exercise.name}`}>
        <div className="exercise-art-orbit" /><div className="exercise-art-orbit second" />
        <span className="exercise-art-category">{exercise.category}</span>
        <div className="exercise-art-symbol">{categoryIcon(exercise.category, 72)}</div>
        <span className="exercise-art-index">{String(index + 1).padStart(2, '0')}</span>
        {exercise.videoUrl && <span className="exercise-video-badge"><Video size={13} /> YouTube</span>}
      </button>
      <div className="exercise-card-body">
        <div className="exercise-card-title"><button onClick={() => viewExercise(exercise)}><h3>{exercise.name}</h3></button><button className="exercise-detail-button" aria-label={`Open ${exercise.name} details`} onClick={() => viewExercise(exercise)}><ArrowUpRight size={20} /></button></div>
        <p className="exercise-muscles">{exercise.muscles}</p>
        <div className="exercise-equipment-tags">{(exercise.equipment.length ? exercise.equipment : ['Bodyweight']).slice(0, 3).map(item => <span className="tag" key={item}>{item}</span>)}{exercise.equipment.length > 3 && <span className="tag">+{exercise.equipment.length - 3}</span>}</div>
        <div className="exercise-card-footer"><span><span className={`difficulty-dot ${exercise.difficulty.toLowerCase()}`} />{exercise.difficulty}</span>{isAdmin ? <button onClick={() => openEditor(exercise)} aria-label={`Edit ${exercise.name}`}><Pencil size={13} /> Edit exercise</button> : <span className="exercise-ready"><Check size={13} /> Ready to use</span>}</div>
      </div>
    </article>)}</div> : <div className="panel empty-state"><Search size={32} /><h3>No exercises found</h3><p>Try a different search or equipment filter.</p><button className="button secondary" onClick={() => { setSearch(''); setCategory('All exercises'); setEquipmentFilter('All equipment'); }}>Reset filters</button></div>}

    <div className="library-footnote"><Heart size={15} /> A little variety. A lot of intention.</div>

    {selected && <Modal title={selected.name} onClose={() => !busy && setSelected(null)}>
      <div className="exercise-detail-meta"><span className="badge">{selected.category}</span><span className="tag">{selected.difficulty}</span><span className="muted">{selected.muscles}</span></div>
      <div className={`exercise-detail-art category-${selected.category.toLowerCase()}`}>{categoryIcon(selected.category, 64)}<div><span className="eyebrow">MOVE WITH CONFIDENCE</span><h3>Focus on form. Build from there.</h3></div></div>
      <div className="exercise-detail-section"><h4>Required equipment</h4><div className="exercise-equipment-tags">{(selected.equipment.length ? selected.equipment : ['Bodyweight']).map(item => <span className="tag" key={item}>{item}</span>)}</div></div>
      <div className="exercise-detail-section"><h4>How to perform</h4><p className="preserve-lines">{selected.instructions}</p></div>
      {selected.cues && <div className="exercise-coaching-cues"><span className="eyebrow">COACHING CUES</span><p className="preserve-lines">{selected.cues}</p></div>}
      {selected.alternatives.length > 0 && <div className="exercise-detail-section"><h4>Alternative movements</h4><div className="exercise-equipment-tags">{selected.alternatives.map(id => <span className="tag" key={id}>{alternativeLabel(id)}</span>)}</div></div>}
      {selected.videoUrl ? <a className="button secondary library-video-link" href={selected.videoUrl} target="_blank" rel="noreferrer"><Video size={17} /> {selected.videoUrl.includes('/results?') ? 'Find a video on YouTube' : 'Watch on YouTube'} <ArrowUpRight size={16} /></a> : <p className="muted">A demonstration hasn’t been added yet.</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {isAdmin && <div className="modal-actions library-detail-actions">
        {archiveConfirm ? <div className="library-archive-confirm"><p>Archive this exercise? Past workouts will keep their records.</p><button className="button secondary" disabled={busy} onClick={() => setArchiveConfirm(false)}>Cancel</button><button className="button danger" disabled={busy} onClick={archiveExercise}>{busy ? 'Archiving...' : 'Confirm archive'}</button></div> : <><button className="button ghost danger-text" onClick={() => setArchiveConfirm(true)}><Trash2 size={16} /> Archive</button><button className="button primary" onClick={() => openEditor(selected)}><Pencil size={16} /> Edit exercise</button></>}
      </div>}
    </Modal>}

    {editing && <Modal title={editing === 'new' ? 'Add an exercise' : 'Edit exercise'} onClose={() => !busy && setEditing(null)}>
      <form onSubmit={saveExercise} className="exercise-editor">
        <p className="muted">Give your coaches a clear, useful movement to work with.</p>
        <div className="form-grid">
          <label className="field library-full-width"><span>Exercise name</span><input required maxLength={120} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} placeholder="e.g. Dumbbell bench press" /></label>
          <label className="field"><span>Category</span><select value={draft.category} onChange={event => setDraft({ ...draft, category: event.target.value })}>{categories.slice(1).map(item => <option key={item}>{item}</option>)}</select></label>
          <label className="field"><span>Difficulty</span><select value={draft.difficulty} onChange={event => setDraft({ ...draft, difficulty: event.target.value })}><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></label>
          <label className="field library-full-width"><span>Target muscles</span><input required maxLength={200} value={draft.muscles} onChange={event => setDraft({ ...draft, muscles: event.target.value })} placeholder="e.g. Chest, shoulders, triceps" /></label>
          <fieldset className="library-equipment-fieldset library-full-width"><legend>Required equipment</legend><p>Select everything needed. Choose Bodyweight for equipment-free exercises.</p><div className="library-equipment-options">{[...new Set([...equipmentOptions, ...draft.equipment])].map(item => <label className={`library-equipment-option ${draft.equipment.includes(item) ? 'selected' : ''}`} key={item}><input type="checkbox" checked={draft.equipment.includes(item)} onChange={() => toggleEquipment(item)} />{draft.equipment.includes(item) && <Check size={13} />}<span>{item}</span></label>)}</div><div className="library-custom-equipment"><input aria-label="Custom equipment name" maxLength={60} value={customEquipment} onChange={event => setCustomEquipment(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addEquipment(); } }} placeholder="Add another equipment tag" /><button type="button" className="button secondary" onClick={addEquipment} disabled={!customEquipment.trim()}><Plus size={16} /> Add</button></div></fieldset>
          <label className="field library-full-width"><span>Instructions</span><textarea required rows={4} maxLength={4000} value={draft.instructions} onChange={event => setDraft({ ...draft, instructions: event.target.value })} placeholder="Explain the setup and movement, step by step." /></label>
          <label className="field library-full-width"><span>Coaching cues <small>Optional</small></span><textarea rows={2} maxLength={2000} value={draft.cues} onChange={event => setDraft({ ...draft, cues: event.target.value })} placeholder="Short reminders for safe, effective form." /></label>
          <label className="field library-full-width"><span>YouTube link <small>Optional</small></span><input type="url" value={draft.videoUrl} maxLength={2000} onChange={event => setDraft({ ...draft, videoUrl: event.target.value })} placeholder="https://www.youtube.com/watch?v=..." /><small>Link to a demonstration or YouTube search. Videos open on YouTube.</small></label>
          <fieldset className="library-equipment-fieldset library-full-width"><legend>Alternative movements <small>Optional</small></legend><div className="library-alternative-options">{exercises.filter(exercise => typeof editing !== 'object' || exercise.id !== editing?.id).map(exercise => <label key={exercise.id}><input type="checkbox" checked={draft.alternatives.includes(exercise.id)} onChange={() => setDraft(previous => ({ ...previous, alternatives: previous.alternatives.includes(exercise.id) ? previous.alternatives.filter(id => id !== exercise.id) : [...previous.alternatives, exercise.id] }))} /><span>{exercise.name}</span></label>)}</div></fieldset>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions"><button type="button" className="button secondary" disabled={busy} onClick={() => setEditing(null)}>Cancel</button><button type="submit" className="button primary" disabled={busy}>{busy ? 'Saving...' : editing === 'new' ? 'Add exercise' : 'Save changes'}</button></div>
      </form>
    </Modal>}
  </div>;
}
