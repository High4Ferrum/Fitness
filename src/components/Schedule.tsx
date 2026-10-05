import { useState } from 'react';
import { ArrowUpRight, CalendarCheck, CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin, Pencil, Plus, Trash2, Video } from 'lucide-react';
import { api } from '../api';
import type { Client, Data, Session } from '../types';
import Modal from './Modal';
import './Schedule.css';

interface Props { data: Data; refresh: () => Promise<void>; notify: (message: string) => void }
interface SessionDraft { clientId: string; date: string; time: string; duration: number; type: Session['type']; location: string; notes: string }

const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const parseDate = (value: string) => { const [year, month, day] = value.split('-').map(Number); return new Date(year, month - 1, day, 12); };
const addDays = (date: Date, days: number) => { const next = new Date(date); next.setDate(next.getDate() + days); return next; };
const startOfWeek = (date: Date) => addDays(date, -((date.getDay() + 6) % 7));
const displayTime = (time: string) => { const [hours, minutes] = time.split(':').map(Number); return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`; };
const endTime = (session: Session) => { const [hours, minutes] = session.time.split(':').map(Number); const total = hours * 60 + minutes + session.duration; return displayTime(`${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`); };
const initials = (name: string) => name.split(' ').filter(Boolean).map(part => part[0]).slice(0, 2).join('').toUpperCase();
const safeMeetingUrl = (value: string) => { try { const url = new URL(value); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; } };

export default function Schedule({ data, refresh, notify }: Props) {
  const today = dateKey(new Date());
  const [week, setWeek] = useState(() => startOfWeek(parseDate(today)));
  const [selectedDate, setSelectedDate] = useState(today);
  const [editor, setEditor] = useState<{ session?: Session; date: string } | null>(null);
  const canManage = data.user.role !== 'client';
  const sessions = data.sessions.filter(session => canManage || session.clientId === data.user.clientId).sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  const days = Array.from({ length: 7 }, (_, index) => addDays(week, index));
  const weekStart = dateKey(week);
  const weekEnd = dateKey(days[6]);
  const isCurrentWeek = today >= weekStart && today <= weekEnd;
  const weekSessions = sessions.filter(session => session.date >= weekStart && session.date <= weekEnd);
  const agenda = sessions.filter(session => session.date === selectedDate);
  const upcoming = sessions.filter(session => session.date >= today).slice(0, 3);
  const clientFor = (id: string) => data.clients.find(client => client.id === id);
  const weekLabel = `${week.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${days[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  const moveWeek = (direction: number) => { setWeek(addDays(week, direction * 7)); setSelectedDate(dateKey(addDays(parseDate(selectedDate), direction * 7))); };
  const showToday = () => { setWeek(startOfWeek(parseDate(today))); setSelectedDate(today); };
  const saved = async (message: string) => {
    setEditor(null);
    notify(message);
    try { await refresh(); } catch { notify('Your change was saved. Reload the page to update the calendar.'); }
  };

  return <div className="schedule-page">
    <div className="page-heading">
      <div><div className="eyebrow">YOUR TRAINING, IN RHYTHM</div><h1>Schedule</h1><p>{canManage ? 'Plan the week. Keep everyone moving.' : 'Make time for your next step forward.'}</p></div>
      {canManage && <button className="button primary" disabled={!data.clients.length} onClick={() => setEditor({ date: selectedDate })}><Plus size={17} /> Schedule session</button>}
    </div>

    {canManage && !data.clients.length && <p className="schedule-time-note">Sessions need a client. Add or invite a client from My clients, then schedule their session here.</p>}
    <div className="schedule-layout">
      <div className="schedule-main">
        <section className="panel schedule-calendar" aria-label="Weekly training calendar">
          <div className="schedule-calendar-toolbar">
            <div className="schedule-week-title"><CalendarDays size={19} /><h2>{weekLabel}</h2></div>
            <div className="schedule-navigation">
              <button className="button secondary schedule-today" onClick={showToday}>Today</button>
              <button className="schedule-icon-button" aria-label="Previous week" onClick={() => moveWeek(-1)}><ChevronLeft size={19} /></button>
              <button className="schedule-icon-button" aria-label="Next week" onClick={() => moveWeek(1)}><ChevronRight size={19} /></button>
            </div>
          </div>
          <div className="schedule-week-grid">
            {days.map(day => {
              const key = dateKey(day);
              const daySessions = weekSessions.filter(session => session.date === key);
              return <div key={key} className={`schedule-day ${key === selectedDate ? 'is-selected' : ''} ${key === today ? 'is-today' : ''}`}>
                <button className="schedule-day-heading" onClick={() => setSelectedDate(key)} aria-pressed={key === selectedDate} aria-label={`View ${day.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}, ${daySessions.length} sessions`}>
                  <span>{day.toLocaleDateString('en-US', { weekday: 'short' })}</span><strong>{day.getDate()}</strong>
                  <span className="schedule-mobile-dots" aria-hidden="true">{daySessions.slice(0, 3).map(session => <i key={session.id} className={session.type === 'Online' ? 'online' : ''} />)}</span>
                </button>
                <div className="schedule-day-events">
                  {daySessions.slice(0, 3).map(session => <button key={session.id} className={`schedule-mini-session ${session.type === 'Online' ? 'online' : ''}`} onClick={() => { setSelectedDate(key); if (canManage) setEditor({ session, date: key }); }} title={`${clientFor(session.clientId)?.name || 'Training'} · ${displayTime(session.time)} · ${session.type}`}>
                    <span>{displayTime(session.time)}</span><strong>{canManage ? clientFor(session.clientId)?.name.split(' ')[0] || 'Client' : session.type}</strong>
                    <small>{session.type === 'Online' ? <Video size={11} /> : <MapPin size={11} />}{session.duration} min</small>
                  </button>)}
                  {daySessions.length > 3 && <button className="schedule-more" onClick={() => setSelectedDate(key)}>+{daySessions.length - 3} more</button>}
                  {!daySessions.length && <span className="schedule-day-clear" aria-hidden="true">—</span>}
                </div>
              </div>;
            })}
          </div>
          <div className="schedule-calendar-footer"><div className="schedule-legend"><span><i /> In person</span><span><i className="online" /> Online</span></div><span>Session times are local to your coach</span></div>
        </section>

        <section className="panel schedule-agenda" aria-label="Selected day's appointments">
          <div className="schedule-section-heading"><div><span className="eyebrow">DAILY AGENDA</span><h2>{parseDate(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</h2></div><span className="badge">{agenda.length} {agenda.length === 1 ? 'session' : 'sessions'}</span></div>
          {agenda.length ? <div className="schedule-agenda-list">{agenda.map(session => {
            const client = clientFor(session.clientId);
            const joinUrl = session.type === 'Online' ? safeMeetingUrl(session.location) : '';
            return <article key={session.id} className="schedule-agenda-item">
              <div className="schedule-time"><strong>{displayTime(session.time)}</strong><span>{endTime(session)}</span></div>
              <div className={`schedule-session-mark ${session.type === 'Online' ? 'online' : ''}`}>{session.type === 'Online' ? <Video size={19} /> : <MapPin size={19} />}</div>
              <div className="schedule-session-details"><h3>{canManage ? client?.name || 'Client session' : `${session.type} training`}</h3><div className="schedule-session-meta"><span>{session.type}</span><span>·</span><span>{session.duration} min</span>{session.location && !joinUrl && <><span>·</span><span>{session.location}</span></>}</div>{session.notes && <p>{session.notes}</p>}</div>
              <div className="schedule-session-actions">{joinUrl && <a className="button secondary schedule-join" href={joinUrl} target="_blank" rel="noopener noreferrer">Join <ArrowUpRight size={15} /></a>}{canManage && <button className="schedule-icon-button" aria-label={`Edit ${client?.name || 'client'} session at ${displayTime(session.time)}`} onClick={() => setEditor({ session, date: selectedDate })}><Pencil size={16} /></button>}</div>
            </article>;
          })}</div> : <div className="schedule-empty"><div className="schedule-empty-icon"><CalendarDays size={25} /></div><h3>A little breathing room</h3><p>{canManage ? 'No sessions planned for this day. Make space for your next training session.' : 'No training sessions scheduled for this day.'}</p>{canManage && data.clients.length > 0 && <button className="button secondary" onClick={() => setEditor({ date: selectedDate })}><Plus size={15} /> Add a session</button>}{canManage && !data.clients.length && <p>Add a client to start scheduling sessions.</p>}</div>}
        </section>
      </div>

      <aside className="schedule-sidebar">
        <section className="panel schedule-week-summary"><div className="schedule-summary-icon"><CalendarCheck size={21} /></div><span className="eyebrow">{isCurrentWeek ? 'THIS WEEK' : 'SELECTED WEEK'}</span><div className="schedule-summary-number">{weekSessions.length}<span>scheduled {weekSessions.length === 1 ? 'session' : 'sessions'}</span></div><div className="schedule-summary-breakdown"><span><MapPin size={14} />{weekSessions.filter(session => session.type === 'In person').length} in person</span><span><Video size={14} />{weekSessions.filter(session => session.type === 'Online').length} online</span></div></section>
        <section className="panel schedule-upcoming"><div className="schedule-section-heading"><h2>Coming up</h2><Clock3 size={17} /></div>{upcoming.length ? <div className="schedule-upcoming-list">{upcoming.map(session => {
          const client = clientFor(session.clientId);
          return <button className="schedule-upcoming-item" key={session.id} onClick={() => { setWeek(startOfWeek(parseDate(session.date))); setSelectedDate(session.date); }}>
            <span className="schedule-client-avatar" style={{ backgroundColor: client?.color || '#e8eadf' }}>{canManage ? initials(client?.name || 'Client') : session.type === 'Online' ? <Video size={16} /> : <MapPin size={16} />}</span><span><strong>{canManage ? client?.name || 'Client session' : 'Training session'}</strong><small>{session.date === today ? 'Today' : parseDate(session.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {displayTime(session.time)}</small><small>{session.type}</small></span><ChevronRight size={15} />
          </button>;
        })}</div> : <p className="schedule-sidebar-empty">Your upcoming sessions will appear here.</p>}</section>
        <div className="schedule-note"><span className="schedule-note-rule" /><p>{canManage ? 'Consistency starts with a plan. A regular training rhythm helps your clients build lasting habits.' : 'Show up for yourself. Every session is another step toward your goals.'}</p></div>
      </aside>
    </div>

    {editor && <SessionEditor clients={data.clients} session={editor.session} date={editor.date} onClose={() => setEditor(null)} onSaved={saved} />}
  </div>;
}

function SessionEditor({ clients, session, date, onClose, onSaved }: { clients: Client[]; session?: Session; date: string; onClose: () => void; onSaved: (message: string) => Promise<void> }) {
  const [draft, setDraft] = useState<SessionDraft>(() => session ? { clientId: session.clientId, date: session.date, time: session.time, duration: session.duration, type: session.type, location: session.location, notes: session.notes } : { clientId: clients[0]?.id || '', date, time: '09:00', duration: 60, type: 'In person', location: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const update = <K extends keyof SessionDraft>(key: K, value: SessionDraft[K]) => setDraft(current => ({ ...current, [key]: value }));
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setError('');
    if (!draft.clientId) { setError('Choose a client for this session.'); return; }
    if (draft.type === 'Online' && draft.location && !safeMeetingUrl(draft.location)) { setError('Enter a complete meeting link starting with https://.'); return; }
    setSaving(true);
    try { await api(session ? `/sessions/${session.id}` : '/sessions', session ? 'PATCH' : 'POST', draft); await onSaved(session ? 'Session updated.' : 'Session scheduled.'); } catch (err) { setError(err instanceof Error ? err.message : 'Could not save this session.'); } finally { setSaving(false); }
  };
  const remove = async () => {
    if (!session) return;
    setSaving(true); setError('');
    try { await api(`/sessions/${session.id}`, 'DELETE'); await onSaved('Session deleted.'); } catch (err) { setError(err instanceof Error ? err.message : 'Could not delete this session.'); } finally { setSaving(false); }
  };
  return <Modal title={session ? 'Edit session' : 'Schedule a session'} onClose={() => { if (!saving) onClose(); }}><form onSubmit={save} className="schedule-session-form">
    <p className="schedule-form-intro">A dedicated time to move forward, together.</p>
    <label className="field">Client<select required value={draft.clientId} onChange={event => update('clientId', event.target.value)} disabled={saving}><option value="" disabled>Select a client</option>{clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
    <div className="form-grid"><label className="field">Date<input type="date" required value={draft.date} onChange={event => update('date', event.target.value)} disabled={saving} /></label><label className="field">Start time<input type="time" required value={draft.time} onChange={event => update('time', event.target.value)} disabled={saving} /></label></div>
    <div className="form-grid"><label className="field">Duration (minutes)<input type="number" required min={5} max={480} step={5} value={draft.duration} onChange={event => update('duration', Number(event.target.value))} disabled={saving} /></label><label className="field">Session type<select value={draft.type} onChange={event => { update('type', event.target.value as Session['type']); update('location', ''); }} disabled={saving}><option>In person</option><option>Online</option></select></label></div>
    <label className="field">{draft.type === 'Online' ? 'Meeting link' : 'Location'}<input type={draft.type === 'Online' ? 'url' : 'text'} value={draft.location} placeholder={draft.type === 'Online' ? 'https://meet.google.com/…' : 'Gym, studio, or meeting point'} onChange={event => update('location', event.target.value)} maxLength={500} disabled={saving} /></label>
    <label className="field">Session notes <span className="schedule-optional">Optional · visible to your client</span><textarea value={draft.notes} placeholder="What to bring, session focus, or anything to prepare." onChange={event => update('notes', event.target.value)} rows={3} maxLength={2000} disabled={saving} /></label>
    <p className="schedule-time-note"><Clock3 size={13} /> Session times are local to your coach.</p>
    {error && <div className="schedule-form-error" role="alert">{error}</div>}
    {confirmDelete && <div className="schedule-delete-confirm"><p>Delete this session? It will be removed from your client's calendar.</p><div><button type="button" className="button secondary" onClick={() => setConfirmDelete(false)} disabled={saving}>Keep session</button><button type="button" className="button schedule-danger" onClick={remove} disabled={saving}>{saving ? 'Deleting…' : 'Delete session'}</button></div></div>}
    {!confirmDelete && <div className="modal-actions schedule-modal-actions">{session && <button type="button" className="schedule-delete-button" onClick={() => setConfirmDelete(true)} disabled={saving}><Trash2 size={15} /> Delete</button>}<button type="button" className="button secondary" onClick={onClose} disabled={saving}>Cancel</button><button className="button primary" type="submit" disabled={saving}>{saving ? 'Saving…' : session ? 'Save changes' : 'Schedule session'}</button></div>}
  </form></Modal>;
}
