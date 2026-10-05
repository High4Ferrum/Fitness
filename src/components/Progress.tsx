import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Activity, ArrowUpRight, Check, ChevronDown, ClipboardCheck, Plus, Scale, TrendingUp, X } from 'lucide-react';
import type { Data, Measurement } from '../types';
import { api } from '../api';
import Modal from './Modal';
import './Progress.css';

interface Props { data: Data; refresh: () => Promise<void>; notify: (message: string) => void; }
const today = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
const dateLabel = (date: string, short = false) => new Date(`${date.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: short ? 'short' : 'long', day: 'numeric', ...(short ? {} : { year: 'numeric' }) });
const bmi = (m: Measurement) => m.height > 0 && m.weight > 0 ? m.weight / ((m.height / 100) ** 2) : null;
const ratio = (m: Measurement) => m.hip > 0 && m.waist > 0 ? m.waist / m.hip : null;

export default function Progress({ data, refresh, notify }: Props) {
  const isClient = data.user.role === 'client';
  const [clientId, setClientId] = useState(isClient ? data.user.clientId || '' : data.clients[0]?.id || '');
  const [exerciseId, setExerciseId] = useState('');
  const [modal, setModal] = useState<'measurement' | 'assessment' | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (isClient) setClientId(data.user.clientId || '');
    else if (!data.clients.some(c => c.id === clientId)) setClientId(data.clients[0]?.id || '');
  }, [data.clients, data.user.clientId, isClient, clientId]);
  const client = data.clients.find(c => c.id === clientId);
  const measurements = useMemo(() => data.measurements.filter(m => m.clientId === clientId).reverse().sort((a, b) => b.date.localeCompare(a.date)), [data.measurements, clientId]);
  const assessments = useMemo(() => data.assessments.filter(a => a.clientId === clientId).reverse().sort((a, b) => b.date.localeCompare(a.date)), [data.assessments, clientId]);
  const logs = useMemo(() => data.logs.filter(l => l.clientId === clientId).sort((a, b) => a.date.localeCompare(b.date)), [data.logs, clientId]);
  const loggedExercises = data.exercises.filter(e => logs.some(l => l.items.some(i => i.exerciseId === e.id)));
  const selectedExerciseId = loggedExercises.some(e => e.id === exerciseId) ? exerciseId : loggedExercises[0]?.id || '';
  const exercise = data.exercises.find(e => e.id === selectedExerciseId);
  const points = useMemo(() => {
    const dates = new Map<string, number>();
    logs.forEach(l => l.items.filter(i => i.exerciseId === selectedExerciseId).forEach(i => dates.set(l.date.slice(0, 10), Math.max(dates.get(l.date.slice(0, 10)) ?? 0, i.weight))));
    return Array.from(dates, ([date, weight]) => ({ date, weight })).sort((a, b) => a.date.localeCompare(b.date));
  }, [logs, selectedExerciseId]);
  const latest = measurements[0];
  const latestBmi = latest ? bmi(latest) : null;
  const latestRatio = latest ? ratio(latest) : null;
  const gain = points.length > 1 ? points[points.length - 1].weight - points[0].weight : 0;
  function openModal(type: 'measurement' | 'assessment') { setError(''); setModal(type); }
  async function submitMeasurement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('');
    const values = new FormData(event.currentTarget);
    try {
      await api('/measurements', 'POST', { clientId, date: String(values.get('date')), height: Number(values.get('height')), weight: Number(values.get('weight')), waist: Number(values.get('waist')), hip: Number(values.get('hip')) });
      await refresh(); setModal(null); notify('Measurements recorded. Progress takes shape, one check-in at a time.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save measurements.'); }
    finally { setSaving(false); }
  }
  async function submitAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('');
    const values = new FormData(event.currentTarget);
    try {
      await api('/assessments', 'POST', { clientId, date: String(values.get('date')), name: String(values.get('name')).trim(), result: Number(values.get('result')), unit: String(values.get('unit')), notes: String(values.get('notes')).trim() });
      await refresh(); setModal(null); notify('Assessment recorded.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save the assessment.'); }
    finally { setSaving(false); }
  }
  return <div className="progress-page">
    <div className="page-heading"><div><span className="eyebrow">THE BIGGER PICTURE</span><h1>Progress</h1><p>Small steps. Measurable change.</p></div><div className="pg-heading-actions">
      {!isClient && data.clients.length > 0 && <label className="pg-client-select"><span className="sr-only">Select client</span><select value={clientId} onChange={e => setClientId(e.target.value)}>{data.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select><ChevronDown size={16} /></label>}
      <button className="button primary" disabled={!client} onClick={() => openModal('measurement')}><Plus size={16} />Record measurements</button>
    </div></div>
    {!client ? <div className="panel empty-state"><Activity size={30} /><h3>No client selected</h3><p>Add a client to start tracking measurements and assessments.</p></div> : <>
      <div className="pg-stats">
        <div className="panel pg-stat"><span className="pg-stat-icon"><Scale size={18} /></span><p>Body weight</p><div><strong>{latest ? latest.weight.toFixed(1) : '—'}</strong>{latest && <span>kg</span>}</div><small>{latest ? `Recorded ${dateLabel(latest.date, true)}` : 'Record a first measurement'}</small></div>
        <div className="panel pg-stat"><span className="pg-stat-icon"><Activity size={18} /></span><p>Body mass index</p><div><strong>{latestBmi !== null ? latestBmi.toFixed(1) : '—'}</strong>{latestBmi !== null && <span>kg/m²</span>}</div><small>Calculated from height and weight</small></div>
        <div className="panel pg-stat"><span className="pg-stat-icon"><TrendingUp size={18} /></span><p>Waist-to-hip ratio</p><div><strong>{latestRatio !== null ? latestRatio.toFixed(2) : '—'}</strong></div><small>Waist circumference ÷ hip circumference</small></div>
        <div className="panel pg-stat"><span className="pg-stat-icon"><Check size={18} /></span><p>Workouts completed</p><div><strong>{logs.length}</strong><span>sessions</span></div><small>Every completed session counts</small></div>
      </div>
      <section className="panel pg-chart-panel">
        <div className="pg-section-heading"><div><span className="eyebrow">PUTTING IN THE WORK</span><h2>Strength over time</h2><p>Highest logged load for each workout, in pounds.</p></div>{loggedExercises.length > 0 && <label className="pg-exercise-select"><span className="sr-only">Exercise for progress chart</span><select value={selectedExerciseId} onChange={e => setExerciseId(e.target.value)}>{loggedExercises.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>}</div>
        {points.length ? <><div className="pg-chart-summary"><strong>{points[points.length - 1].weight}<span> lb</span></strong><span className={`pg-gain ${gain < 0 ? 'pg-gain-neutral' : ''}`}><ArrowUpRight size={15} />{points.length > 1 ? `${gain >= 0 ? '+' : ''}${gain} lb since first log` : 'Your first recorded workout'}</span></div><StrengthChart points={points} name={exercise?.name || 'Exercise'} /></> : <div className="pg-chart-empty"><TrendingUp size={28} /><h3>Your progress starts with a workout</h3><p>Complete a workout and log your sets to see strength trends here.</p></div>}
      </section>
      <div className="pg-detail-grid">
        <section className="panel pg-history-panel"><div className="pg-section-heading"><div><span className="eyebrow">REGULAR CHECK-INS</span><h2>Body measurements</h2></div><button className="button ghost" onClick={() => openModal('measurement')} aria-label="Add measurements"><Plus size={18} /></button></div>
          {measurements.length ? <div className="pg-table-wrap"><table className="pg-table"><thead><tr><th>Date</th><th>Weight</th><th>Waist / Hip</th><th>BMI</th><th>Ratio</th></tr></thead><tbody>{measurements.map(m => <tr key={m.id}><td>{dateLabel(m.date, true)}</td><td>{m.weight.toFixed(1)} <small>kg</small></td><td>{m.waist} / {m.hip} <small>cm</small></td><td>{bmi(m)?.toFixed(1) ?? '—'}</td><td>{ratio(m)?.toFixed(2) ?? '—'}</td></tr>)}</tbody></table></div> : <div className="pg-mini-empty"><Scale size={25} /><p>No measurements yet.</p><button className="button secondary" onClick={() => openModal('measurement')}>Record your first check-in</button></div>}
          <p className="pg-measurement-note">BMI and waist-to-hip ratio are reference measures. Review them alongside goals, performance, and your coach’s guidance.</p>
        </section>
        <section className="panel pg-assessment-panel"><div className="pg-section-heading"><div><span className="eyebrow">A STARTING POINT. A NEXT STEP.</span><h2>Fitness assessments</h2></div>{!isClient && <button className="button secondary" onClick={() => openModal('assessment')}><Plus size={15} />Add</button>}</div>
          {assessments.length ? <div className="pg-assessment-list">{assessments.map(a => <div className="pg-assessment" key={a.id}><span className="pg-assessment-icon"><ClipboardCheck size={19} /></span><div><h3>{a.name}</h3><p>{dateLabel(a.date, true)}{a.notes && <span> · {a.notes}</span>}</p></div><strong>{a.result}<small>{a.unit}</small></strong></div>)}</div> : <div className="pg-mini-empty"><ClipboardCheck size={25} /><p>No assessments recorded.</p><small>{isClient ? 'Your coach can record a baseline at your next session.' : 'Record push-ups, squats, a plank, or a custom test.'}</small>{!isClient && <button className="button secondary" onClick={() => openModal('assessment')}>Add an assessment</button>}</div>}
        </section>
      </div>
    </>}
    {modal === 'measurement' && <Modal title="Record measurements" onClose={() => !saving && setModal(null)}><p className="pg-modal-intro">A check-in for {client?.name}. Use centimeters and kilograms for consistent calculations.</p><form onSubmit={submitMeasurement}><div className="form-grid"><label className="field pg-full">Date<input name="date" type="date" required defaultValue={today()} max={today()} /></label><label className="field">Height <span>cm</span><input name="height" type="number" step="0.1" min="50" max="250" required defaultValue={latest?.height} placeholder="170" /></label><label className="field">Weight <span>kg</span><input name="weight" type="number" step="0.1" min="1" max="500" required defaultValue={latest?.weight} placeholder="70" /></label><label className="field">Waist <span>cm</span><input name="waist" type="number" step="0.1" min="1" max="300" required defaultValue={latest?.waist} placeholder="80" /></label><label className="field">Hip <span>cm</span><input name="hip" type="number" step="0.1" min="1" max="300" required defaultValue={latest?.hip} placeholder="95" /></label></div>{error && <p className="pg-form-error" role="alert"><X size={15} />{error}</p>}<div className="pg-modal-footer"><button type="button" className="button secondary" onClick={() => setModal(null)} disabled={saving}>Cancel</button><button type="submit" className="button primary" disabled={saving}>{saving ? 'Saving…' : 'Save measurements'}</button></div></form></Modal>}
    {modal === 'assessment' && !isClient && <Modal title="Add fitness assessment" onClose={() => !saving && setModal(null)}><p className="pg-modal-intro">Record a consistent baseline for {client?.name}, then repeat the same test to track change.</p><form onSubmit={submitAssessment}><div className="form-grid"><label className="field pg-full">Assessment name<input name="name" list="assessment-options" required maxLength={100} placeholder="e.g. Push-ups" /><datalist id="assessment-options"><option value="Push-ups" /><option value="Bodyweight squats" /><option value="Plank hold" /><option value="Sit and reach" /><option value="Resting heart rate" /></datalist></label><label className="field pg-full">Date<input name="date" type="date" required defaultValue={today()} max={today()} /></label><label className="field">Result<input name="result" type="number" min="0" step="0.1" required placeholder="12" /></label><label className="field">Unit<select name="unit" defaultValue="reps"><option value="reps">Repetitions</option><option value="seconds">Seconds</option><option value="minutes">Minutes</option><option value="cm">Centimeters</option><option value="bpm">Beats per minute</option><option value="lbs">Pounds</option></select></label><label className="field pg-full">Notes <span>optional</span><textarea name="notes" rows={3} maxLength={1000} placeholder="Technique, test conditions, or coaching observations" /></label></div>{error && <p className="pg-form-error" role="alert"><X size={15} />{error}</p>}<div className="pg-modal-footer"><button type="button" className="button secondary" onClick={() => setModal(null)} disabled={saving}>Cancel</button><button type="submit" className="button primary" disabled={saving}>{saving ? 'Saving…' : 'Save assessment'}</button></div></form></Modal>}
  </div>;
}

function StrengthChart({ points, name }: { points: { date: string; weight: number }[]; name: string }) {
  const width = 700, height = 230, left = 42, right = 20, top = 16, bottom = 35;
  const maximum = Math.max(10, Math.ceil(Math.max(...points.map(p => p.weight)) / 10) * 10 + 10);
  const x = (index: number) => points.length === 1 ? (width + left - right) / 2 : left + index * (width - left - right) / (points.length - 1);
  const y = (weight: number) => top + (1 - weight / maximum) * (height - top - bottom);
  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(p.weight)}`).join(' ');
  const area = `${line} L ${x(points.length - 1)} ${height - bottom} L ${x(0)} ${height - bottom} Z`;
  const ticks = [0, 1, 2, 3, 4].map(t => t * maximum / 4);
  return <div className="pg-chart"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${name} strength progress: ${points.map(p => `${dateLabel(p.date, true)}, ${p.weight} pounds`).join('; ')}`}><defs><linearGradient id="strength-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#729660" stopOpacity=".2" /><stop offset="100%" stopColor="#729660" stopOpacity=".01" /></linearGradient></defs>{ticks.map(t => <g key={t}><line x1={left} y1={y(t)} x2={width - right} y2={y(t)} stroke="#e8eee1" strokeDasharray="3 5" /><text x={left - 12} y={y(t) + 4} textAnchor="end" className="pg-chart-label">{Math.round(t)}</text></g>)}{points.length > 1 && <path d={area} fill="url(#strength-fill)" />}<path d={line} fill="none" stroke="#557a47" strokeWidth="2.5" strokeLinejoin="round" />{points.map((p, i) => <g key={p.date}><circle cx={x(i)} cy={y(p.weight)} r="4.5" fill="#557a47" stroke="white" strokeWidth="2"><title>{dateLabel(p.date)}: {p.weight} lb</title></circle>{(points.length < 7 || i === 0 || i === points.length - 1 || i % Math.ceil(points.length / 5) === 0) && <text x={x(i)} y={height - 10} textAnchor="middle" className="pg-chart-label">{dateLabel(p.date, true)}</text>}</g>)}</svg></div>;
}
