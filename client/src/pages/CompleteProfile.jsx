import { useState } from 'react';
import { Phone } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { firstName } from '../format.js';
import PhotoPicker from '../components/PhotoPicker.jsx';
import { ErrorBox, Field } from '../components/ui.jsx';

/** Shown after signing in while the account has no mobile number: number required, photo optional. */
export default function CompleteProfile() {
  const { user, updateUser, logout } = useAuth();
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await api.put('/auth/me/profile', { phone });
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
        <h1>Welcome, {firstName(user.name)}</h1>
        <p className="muted">Complete your profile to continue.</p>

        <PhotoPicker size={104} />
        <p className="field-hint onboard-hint">A photo is optional. You can add or change it later from your Profile.</p>

        <form className="form onboard-form" onSubmit={submit}>
          <Field label="Mobile number" hint="Shown on your profile so leaders can reach you">
            <div className="input-icon">
              <Phone size={18} />
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="01001234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
            </div>
          </Field>
          {error && <ErrorBox message={error} />}
          <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
            {busy ? 'Saving…' : 'Continue'}
          </button>
        </form>
        <button type="button" className="link onboard-signout" onClick={logout}>
          Sign out
        </button>
      </div>
    </div>
  );
}
