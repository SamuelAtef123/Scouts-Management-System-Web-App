import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { VERSE } from '../constants.js';
import { ErrorBox } from '../components/ui.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

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
        <img src="/group.jpg" alt="The Gawala team together at St. Mary Church, Garden City" />
        <div className="login-photo-text">
          <p className="eyebrow">Together we serve</p>
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
        <img src="/logo.jpg" alt="St. Mary Church Garden City Scout logo" className="login-logo" />
        <h1>Light of the World</h1>
        <p className="muted">St. Mary Church · Garden City Scouts</p>

        <form className="form login-form" onSubmit={submit}>
          <label className="field">
            <span className="field-label">Username</span>
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
            <span className="field-label">Password</span>
            <div className="password-input">
              <input
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <button type="button" className="icon-btn" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          {error && <ErrorBox message={error} />}
          <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="login-help">Forgot your password? Ask the Scouts Leader or the Database team to reset it.</p>
      </section>
    </div>
  );
}
