import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { LanguageSwitch, t as tr } from '../i18n.jsx';
import { ErrorBox, Field } from '../components/ui.jsx';

/** Opened from the "Forgot password?" email: choose a new password, then go into the app. */
export default function ResetPassword() {
  const { signInWith } = useAuth();
  const token = new URLSearchParams(window.location.search).get('token') || '';
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const leave = () => window.location.replace('/');

  const submit = async (e) => {
    e.preventDefault();
    if (password !== again) return setError(tr('The two passwords are not the same'));
    setBusy(true);
    setError('');
    try {
      const data = await api.post('/auth/reset', { token, newPassword: password });
      signInWith(data.token, data.user);
      leave();
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
        <h1>{tr('Choose a new password')}</h1>
        <p className="muted">{tr('At least 8 characters. You will be signed in right after.')}</p>
        <LanguageSwitch className="login-lang" />
        {!token ? (
          <ErrorBox message={tr('This link is not valid or has expired. Ask for a new one.')} />
        ) : (
          <form className="form onboard-form" onSubmit={submit}>
            <Field label={tr('New password')}>
              <div className="password-input">
                <input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required autoComplete="new-password" />
                <button type="button" className="icon-btn" onClick={() => setShow((s) => !s)} aria-label={show ? tr('Hide password') : tr('Show password')}>
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </Field>
            <Field label={tr('Write the new password again')}>
              <input type={show ? 'text' : 'password'} value={again} onChange={(e) => setAgain(e.target.value)} minLength={8} required autoComplete="new-password" />
            </Field>
            {error && <ErrorBox message={error} />}
            <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
              {busy ? tr('Saving…') : tr('Save and sign in')}
            </button>
          </form>
        )}
        <button type="button" className="link onboard-signout" onClick={leave}>
          {tr('Back to sign in')}
        </button>
      </div>
    </div>
  );
}
