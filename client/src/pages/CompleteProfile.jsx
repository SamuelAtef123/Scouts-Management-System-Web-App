import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { api, tokenStore } from '../api.js';
import { useAuth } from '../auth.jsx';
import { LanguageSwitch, t as tr } from '../i18n.jsx';
import { firstName, localPhone } from '../format.js';
import PhoneInput from '../components/PhoneInput.jsx';
import { ErrorBox, Field, Avatar } from '../components/ui.jsx';

/**
 * Shown after signing in while the account has no mobile number or email, or still has a password
 * someone else set (a new account or a reset): all of these are needed before using the app.
 */
export default function CompleteProfile() {
  const { user, updateUser, logout } = useAuth();
  const [phone, setPhone] = useState(localPhone(user.phone));
  const [email, setEmail] = useState(user.email || '');
  const needPassword = Boolean(user.mustChangePassword);
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (needPassword && password !== again) {
        setError(tr('The two passwords are not the same'));
        setBusy(false);
        return;
      }
      const data = await api.put('/auth/me/profile', { phone, email, ...(needPassword ? { newPassword: password } : {}) });
      if (data.token) tokenStore.set(data.token);
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
          {needPassword && (
            <>
              <Field label={tr('Choose your own password')} hint={tr('Replaces the password you were given. At least 8 characters.')}>
                <div className="password-input">
                  <input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required autoComplete="new-password" />
                  <button type="button" className="icon-btn" onClick={() => setShow((v) => !v)} aria-label={show ? tr('Hide password') : tr('Show password')}>
                    {show ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </Field>
              <Field label={tr('Write the new password again')}>
                <input type={show ? 'text' : 'password'} value={again} onChange={(e) => setAgain(e.target.value)} minLength={8} required autoComplete="new-password" />
              </Field>
            </>
          )}
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
