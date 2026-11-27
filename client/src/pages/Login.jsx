import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { LanguageSwitch, t as tr } from '../i18n.jsx';
import { VERSE } from '../constants.js';
import { ErrorBox, Field, Modal } from '../components/ui.jsx';
import { api } from '../api.js';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [forgot, setForgot] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(username, password);
      // Always start on the Home page after signing in.
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="login">
      <section className="login-photo">
        <img src="/group.jpg" alt={tr('The Gawala kadr together at St. Mary Church, Garden City')} />
        <div className="login-photo-text">
          <p className="eyebrow">{tr('Together we serve')}</p>
          <blockquote lang="ar" dir="rtl">
            {VERSE.text}
          </blockquote>
          <cite lang="ar" dir="rtl">
            {VERSE.ref}
          </cite>
        </div>
      </section>

      <section className="login-panel">
        <div className="stripe" />
        <img src="/logo.jpg" alt={tr('St. Mary Church Garden City Scout logo')} className="login-logo" />
        <h1>{tr('Light of the World')}</h1>
        <p className="muted">{tr('St. Mary Church · Garden City Scouts')}</p>
        <LanguageSwitch className="login-lang" />

        <form className="form login-form" onSubmit={submit}>
          <label className="field">
            <span className="field-label">{tr('Username')}</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              required
            />
          </label>
          <label className="field">
            <span className="field-label">{tr('Password')}</span>
            <div className="password-input">
              <input
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button type="button" className="icon-btn" onClick={() => setShow((s) => !s)} aria-label={show ? tr('Hide password') : tr('Show password')}>
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          {error && <ErrorBox message={error} />}
          <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
            {busy ? tr('Signing in…') : tr('Sign in')}
          </button>
        </form>
        <button type="button" className="link login-forgot" onClick={() => setForgot(true)}>
          {tr('Forgot your password?')}
        </button>
        {forgot && <ForgotDialog initial={username} onClose={() => setForgot(false)} />}
      </section>
    </div>
  );
}

/** Asks for a username or email and emails a link to choose a new password. */
function ForgotDialog({ initial, onClose }) {
  const [login, setLogin] = useState(initial || '');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/auth/forgot', { login });
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={tr('Forgot your password?')}
      onClose={onClose}
      footer={
        sent ? (
          <button type="button" className="btn btn-primary" onClick={onClose}>
            {tr('OK')}
          </button>
        ) : (
          <>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              {tr('Cancel')}
            </button>
            <button type="submit" form="forgot-form" className="btn btn-primary" disabled={busy}>
              {busy ? tr('Please wait…') : tr('Send link')}
            </button>
          </>
        )
      }
    >
      {sent ? (
        <p className="muted">
          {tr('If an account matches, we have emailed it a link to choose a new password. The link works once, for 1 hour. Check your spam folder too.')}
        </p>
      ) : (
        <form id="forgot-form" className="form" onSubmit={submit}>
          <p className="muted">{tr('Enter your username or email. We will email you a link to choose a new password.')}</p>
          <Field label={tr('Username or email')}>
            <input value={login} onChange={(e) => setLogin(e.target.value)} required dir="ltr" autoCapitalize="none" autoCorrect="off" autoComplete="username" />
          </Field>
          {error && <ErrorBox message={error} />}
          <p className="field-hint">{tr('No email on your account? Ask a Database / Attendance member to reset your password.')}</p>
        </form>
      )}
    </Modal>
  );
}
