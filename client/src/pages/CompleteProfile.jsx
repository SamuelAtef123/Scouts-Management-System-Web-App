import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { LanguageSwitch, t as tr } from '../i18n.jsx';
import { firstName, localPhone } from '../format.js';
import PhoneInput from '../components/PhoneInput.jsx';
import { ErrorBox, Field, Avatar } from '../components/ui.jsx';

/** Shown after signing in while the account has no mobile number or email: both are required. */
export default function CompleteProfile() {
  const { user, updateUser, logout } = useAuth();
  const [phone, setPhone] = useState(localPhone(user.phone));
  const [email, setEmail] = useState(user.email || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await api.put('/auth/me/profile', { phone, email });
      updateUser(data.user);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="onboard">
      <div className="onboard-card">
        <div className="stripe" />
        <img src="/logo.jpg" alt="" className="onboard-logo" />
        <h1>{tr('Welcome, {name}', { name: firstName(user.name) })}</h1>
        <p className="muted">{tr('Complete your profile to continue.')}</p>
        <LanguageSwitch className="login-lang" />

        <Avatar person={user} size={104} />

        <form className="form onboard-form" onSubmit={submit}>
          <Field label={tr('Mobile number')} hint={tr('Egyptian mobile, 11 digits. Shown on your profile so leaders can reach you')}>
            <PhoneInput value={phone} onChange={setPhone} required />
          </Field>
          <Field label={tr('Email')} hint={tr('For notifications about your events and tasks, and to reset a forgotten password')}>
            <input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={120} autoCapitalize="none" autoComplete="email" />
          </Field>
          {error && <ErrorBox message={error} />}
          <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
            {busy ? tr('Saving…') : tr('Continue')}
          </button>
        </form>
        <button type="button" className="link onboard-signout" onClick={logout}>
          {tr('Sign out')}
        </button>
      </div>
    </div>
  );
}
