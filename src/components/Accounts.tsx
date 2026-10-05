import { useState, type FormEvent } from 'react';
import { ArrowRight, Check, Mail, Pencil, Plus, Search, ShieldCheck, UserRound, Users } from 'lucide-react';
import { api } from '../api';
import type { Data, User } from '../types';
import Modal from './Modal';
import './Accounts.css';

interface Props { data: Data; refresh: () => Promise<void>; notify: (message: string) => void; }

export default function Accounts({ data, refresh, notify }: Props) {
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<User | 'new' | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [manageFor, setManageFor] = useState<User | null>(null);
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [assigning, setAssigning] = useState<string | null>(null);
  const staff = data.users.filter(user => user.role === 'admin' || user.role === 'coach');
  const filteredStaff = staff.filter(user => `${user.name} ${user.email} ${user.role}`.toLowerCase().includes(query.toLowerCase()));

  function openEditor(user?: User) {
    setEditing(user || 'new'); setName(user?.name || ''); setEmail(user?.email || ''); setPassword(''); setError('');
  }

  function openAssignments(user: User) {
    setManageFor(user);
    setAssignments(Object.fromEntries(data.clients.map(client => [client.id, client.coachId])));
    setError('');
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) { setError('Enter a name for this account.'); return; }
    setSaving(true); setError('');
    try {
      const body = { name: name.trim(), email: email.trim(), ...(password && (editing === 'new' || editing?.id !== data.user.id) ? { password } : {}), ...(editing === 'new' ? { role: 'coach' } : {}) };
      await api(editing === 'new' ? '/users' : `/users/${(editing as User).id}`, editing === 'new' ? 'POST' : 'PATCH', body);
      await refresh(); setEditing(null);
      notify(editing === 'new' ? 'Coach added. Share their sign-in details securely.' : password ? 'Account updated and password reset. Share the new password securely.' : 'Account updated.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to save this account.'); }
    finally { setSaving(false); }
  }

  async function assignClient(clientId: string) {
    setAssigning(clientId); setError('');
    try {
      await api(`/clients/${clientId}`, 'PATCH', { coachId: assignments[clientId] });
      await refresh();
      notify('Client assignment updated.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to update client assignment.'); }
    finally { setAssigning(null); }
  }

  if (data.user.role !== 'admin') return <div className="panel empty-state"><ShieldCheck size={32} /><h3>Administrator access required</h3><p>Your administrator manages coaching accounts and client assignments.</p></div>;

  return <div className="accounts-page">
    <div className="page-heading"><div><span className="eyebrow">BETTER TOGETHER</span><h1>Your team<span className="heading-dot">.</span></h1><p>Give good coaches the space to do their best work.</p></div><button className="button primary" onClick={() => openEditor()}><Plus size={17} /> Add coach</button></div>
    <div className="accounts-banner panel"><div className="accounts-banner-icon"><ShieldCheck size={25} strokeWidth={1.5} /></div><div><h3>The right access. The right support.</h3><p>Admins care for your library and accounts. Coaches focus on their assigned clients.</p></div><span className="badge sage">{staff.filter(user => user.role === 'coach').length} {staff.filter(user => user.role === 'coach').length === 1 ? 'coach' : 'coaches'}</span></div>
    <div className="toolbar"><div className="search-input"><Search size={18} /><input aria-label="Search team members" placeholder="Find a coach or administrator…" value={query} onChange={event => setQuery(event.target.value)} /></div><span className="muted">{filteredStaff.length} {filteredStaff.length === 1 ? 'team member' : 'team members'}</span></div>
    <div className="accounts-grid">{filteredStaff.map(user => {
      const clients = data.clients.filter(client => client.coachId === user.id);
      return <article className="panel account-card" key={user.id}>
        <div className="account-card-top"><div className={`account-avatar ${user.role}`}>{user.name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase()}</div><span className={`badge ${user.role === 'admin' ? 'accounts-admin-badge' : 'sage'}`}>{user.role === 'admin' ? <ShieldCheck size={12} /> : <UserRound size={12} />}{user.role === 'admin' ? 'Admin' : 'Coach'}</span></div>
        <h2>{user.name}{user.id === data.user.id && <span className="account-you">You</span>}</h2><div className="account-email"><Mail size={13} />{user.email}</div>
        <div className="account-clients"><div className="account-client-heading"><span>Assigned clients</span><strong>{clients.length}</strong></div>{clients.length ? <div className="account-client-preview">{clients.slice(0, 3).map(client => <div key={client.id}><span className="account-mini-avatar" style={{ backgroundColor: client.color }}>{client.name.split(' ').map(part => part[0]).join('').slice(0, 2)}</span><span>{client.name}</span></div>)}{clients.length > 3 && <span className="account-more-clients">+{clients.length - 3} more</span>}</div> : <p className="account-no-clients">Ready for their first client.</p>}</div>
        <div className="account-card-actions"><button className="text-button" onClick={() => openEditor(user)}><Pencil size={13} /> Edit account</button><button className="button secondary small" onClick={() => openAssignments(user)}><Users size={14} /> Assign clients</button></div>
      </article>;
    })}</div>
    {!filteredStaff.length && <div className="empty-state"><Users size={32} /><h3>No team members found</h3><p>Try searching by another name or email.</p></div>}
    <p className="accounts-footnote"><Users size={14} /> Client accounts are created and edited on the Clients page.</p>

    {editing && <Modal title={editing === 'new' ? 'Welcome a new coach' : 'Edit account'} onClose={() => !saving && setEditing(null)}>
      <form onSubmit={save}>
        <p className="modal-intro">{editing === 'new' ? 'Create their coach account, then assign the clients they’ll train.' : editing.id === data.user.id ? 'Keep your name and email up to date.' : 'Update their details or set a new sign-in password.'}</p>
        <div className="form-grid">
          <label className="field">Full name<input required maxLength={100} autoComplete="name" value={name} onChange={event => setName(event.target.value)} placeholder="Alex Morgan" /></label>
          <label className="field">Email address<input required type="email" maxLength={254} autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="alex@example.com" /></label>
          {editing === 'new' || editing.id !== data.user.id ? <label className="field full-width">{editing === 'new' ? 'Initial password' : 'Reset password (optional)'}<input type="password" autoComplete="new-password" required={editing === 'new'} minLength={8} maxLength={200} value={password} onChange={event => setPassword(event.target.value)} /><small>{editing === 'new' ? 'Use at least 8 characters. Share these sign-in details securely outside the app.' : 'Leave blank to keep the current password. Use at least 8 characters for a new password.'}</small></label> : <p className="muted full-width">Change your password in Account settings using your profile in the sidebar.</p>}
        </div>
        <div className="account-access-note"><ShieldCheck size={16} /><span>{editing === 'new' || editing.role === 'coach' ? 'Coach access: assigned clients, assessments, schedules, and workout plans.' : 'Admin access: exercise library, team accounts, and all clients.'}</span></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="modal-actions"><button type="button" className="button secondary" disabled={saving} onClick={() => setEditing(null)}>Cancel</button><button className="button primary" disabled={saving}>{saving ? 'Saving…' : editing === 'new' ? 'Add coach' : 'Save changes'}</button></div>
      </form>
    </Modal>}

    {manageFor && <Modal title={`Client assignments · ${manageFor.name}`} onClose={() => !assigning && setManageFor(null)}><p className="modal-intro">Choose who coaches each client. Coaches can access only their assigned clients.</p>{data.clients.length ? <div className="account-assignment-list">{[...data.clients].sort((a, b) => Number(b.coachId === manageFor.id) - Number(a.coachId === manageFor.id) || a.name.localeCompare(b.name)).map(client => {
      const changed = assignments[client.id] !== client.coachId;
      return <div className="account-assignment-row" key={client.id}><div className="account-assignment-client"><span className="account-mini-avatar" style={{ backgroundColor: client.color }}>{client.name.split(' ').map(part => part[0]).join('').slice(0, 2)}</span><div><strong>{client.name}</strong><small>{client.coachId === manageFor.id ? 'Currently assigned' : staff.find(user => user.id === client.coachId)?.name || 'Unassigned'}</small></div></div><div className="account-assignment-control"><select aria-label={`Coach for ${client.name}`} disabled={!!assigning} value={assignments[client.id] || ''} onChange={event => setAssignments(previous => ({ ...previous, [client.id]: event.target.value }))}>{!assignments[client.id] && <option value="" disabled>Choose a coach</option>}{staff.map(user => <option key={user.id} value={user.id}>{user.name}{user.role === 'admin' ? ' (Admin)' : ''}</option>)}</select><button type="button" className="button primary small" disabled={!changed || !!assigning} onClick={() => assignClient(client.id)} aria-label={`Save coach assignment for ${client.name}`}>{assigning === client.id ? 'Saving…' : changed ? <><ArrowRight size={14} /> Save</> : <Check size={15} />}</button></div></div>;
    })}</div> : <div className="empty-state"><Users size={28} /><h3>No clients yet</h3><p>Add a client on the Clients page, then assign their coach here.</p></div>}{error && <p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button className="button secondary" disabled={!!assigning} onClick={() => setManageFor(null)}>Done</button></div></Modal>}
  </div>;
}
