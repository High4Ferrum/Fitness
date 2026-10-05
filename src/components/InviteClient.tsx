import { useState, type FormEvent } from 'react';
import { Check, Copy, Link, Send } from 'lucide-react';
import { api } from '../api';
import type { Data } from '../types';
import Modal from './Modal';

export default function InviteClient({ data, refresh, onClose }: { data: Data; refresh: () => Promise<void>; onClose: () => void }) {
  const [name, setName] = useState(''), [email, setEmail] = useState(''), [goal, setGoal] = useState(''), [coachId, setCoachId] = useState(data.user.id);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [copied, setCopied] = useState(false);
  const [invitation, setInvitation] = useState<{ url: string; expiresAt: number } | null>(null);
  async function create(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = await api<{ token: string; expiresAt: number }>('/invitations', 'POST', { name, email, goal, coachId });
      setInvitation({ url: `${window.location.origin}${window.location.pathname}#register=${result.token}`, expiresAt: result.expiresAt });
      await refresh();
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(invitation!.url); setCopied(true); }
    catch { setError('Select the signup link and copy it to share with your client.'); }
  }
  return <Modal title={invitation ? 'Your client’s signup link' : 'Invite a client'} onClose={() => !busy && onClose()}>
    {invitation ? <><div className="invitation-ready"><Link size={27} /><h3>Ready to welcome {name.split(' ')[0]}.</h3><p>Share this link with <strong>{email}</strong>. Your client chooses their own password and joins the assigned coach.</p></div><label className="field">Signup link<input readOnly value={invitation.url} onFocus={event => event.target.select()} /></label><p className="invitation-expiry">One use · Expires {new Date(invitation.expiresAt).toLocaleDateString()} · No email has been sent automatically.</p><div className="modal-actions"><button className="button secondary" onClick={onClose}>Done</button><button className="button primary" onClick={copy}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? 'Link copied' : 'Copy signup link'}</button></div></> : <form onSubmit={create}><p className="modal-intro">Send your client a signup link. They’ll create their account with their own password.</p>{data.demoMode && <p className="registration-demo-note">You’re in the shared demo. Use sample client details here.</p>}<fieldset disabled={busy} className="registration-fields"><div className="form-grid"><label className="field">Full name<input required maxLength={120} autoComplete="off" value={name} onChange={event => setName(event.target.value)} /></label><label className="field">Email address<input required type="email" maxLength={254} autoComplete="off" value={email} onChange={event => setEmail(event.target.value)} /></label>{data.user.role === 'admin' && <label className="field full-width">Assigned coach<select value={coachId} onChange={event => setCoachId(event.target.value)}>{data.users.filter(user => user.role !== 'client').map(user => <option key={user.id} value={user.id}>{user.name}{user.id === data.user.id ? ' (You)' : ''}</option>)}</select></label>}<label className="field full-width">Training goal<textarea rows={3} maxLength={2000} value={goal} onChange={event => setGoal(event.target.value)} placeholder="What would they like to work towards?" /></label></div><div className="modal-actions"><button className="button secondary" type="button" disabled={busy} onClick={onClose}>Cancel</button><button className="button primary" disabled={busy}><Send size={16} />{busy ? 'Creating…' : 'Create signup link'}</button></div></fieldset></form>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </Modal>;
}
