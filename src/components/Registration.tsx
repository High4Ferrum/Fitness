import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { api } from '../api';
import Brand from './Brand';

interface Invitation { name: string; email: string; goal: string; coachName: string; expiresAt: number; demoMode: boolean }
export interface RegistrationLink { kind: 'register' | 'setup' | 'reset'; token: string }

export function registrationLink(): RegistrationLink | null {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  for (const kind of ['register', 'setup', 'reset'] as const) if (hash.has(kind)) return { kind, token: hash.get(kind) || '' };
  return null;
}

export default function Registration({ link, onComplete, onCancel }: { link: RegistrationLink; onComplete: () => Promise<void>; onCancel: () => void }) {
  const owner = link.kind === 'setup';
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [ready, setReady] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [name, setName] = useState(''), [email, setEmail] = useState(''), [goal, setGoal] = useState('');
  useEffect(() => {
    let active = true;
    api<Invitation>(owner ? `/auth/setup/${encodeURIComponent(link.token)}` : `/auth/invitations/${encodeURIComponent(link.token)}`)
      .then(value => { if (!active) return; if (!owner) { setInvitation(value); setName(value.name); setEmail(value.email); setGoal(value.goal); } setReady(true); })
      .catch(failure => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [link.token, owner]);
  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    if (values.get('password') !== values.get('confirm')) { setError('Your passwords don’t match.'); return; }
    setBusy(true); setError('');
    try {
      await api(owner ? '/auth/setup' : '/auth/register', 'POST', { token: link.token, name, password: values.get('password'), ...(owner ? { email } : { goal }) });
      await onComplete();
    } catch (failure) { setError((failure as Error).message); }
    finally { setBusy(false); }
  }
  return <div className="registration-layout"><div className="registration-card panel"><Brand /><span className="eyebrow">{owner ? 'YOUR COACHING HOME' : 'LET’S GET STARTED'}</span><h1>{owner ? 'Set up your workspace' : 'Create your client account'}</h1><p className="registration-intro">{owner ? 'Create your own administrator account. You can coach clients, send invitations, and manage your team.' : invitation ? `${invitation.coachName} invited you to train together. Choose your password and start your journey.` : 'Checking your invitation…'}</p>{invitation?.demoMode && <p className="registration-demo-note">This invitation is for the shared demo. Use sample details to try registration.</p>}
    {ready && <form onSubmit={register}><fieldset disabled={busy} className="registration-fields"><label className="field">Full name<input required maxLength={120} autoComplete="name" value={name} onChange={event => setName(event.target.value)} /></label><label className="field">Email address<input required type="email" maxLength={254} autoComplete="email" readOnly={!owner} value={email} onChange={event => setEmail(event.target.value)} />{!owner && <small>Your coach invited this email address.</small>}</label>{!owner && <label className="field">Training goal<textarea rows={2} maxLength={2000} value={goal} onChange={event => setGoal(event.target.value)} /></label>}<label className="field">Choose a password<input required name="password" type="password" minLength={8} maxLength={256} autoComplete="new-password" /><small>At least 8 characters.</small></label><label className="field">Confirm password<input required name="confirm" type="password" minLength={8} maxLength={256} autoComplete="new-password" /></label><button className="button primary login-submit" disabled={busy}>{busy ? 'Creating account…' : owner ? 'Create my workspace' : 'Create my account'}<ArrowRight size={17} /></button></fieldset></form>}
    {error && <p className="form-error" role="alert">{error}</p>}<button type="button" className="text-button registration-back" disabled={busy} onClick={onCancel}>Back to sign in</button><p className="login-note"><ShieldCheck size={14} />{owner ? 'Your workspace starts without sample accounts.' : 'Your account connects only to your assigned coach.'}</p></div></div>;
}
