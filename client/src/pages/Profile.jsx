import { useState } from 'react';
import { KeyRound, LogOut } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { ROLE_LABEL } from '../constants.js';
import { Avatar, ErrorBox, Field, TeamChip, VerseCard, useToast } from '../components/ui.jsx';

export default function Profile() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.put('/auth/me/password', form);
      setForm({ currentPassword: '', newPassword: '' });
      toast('Password changed');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page profile">
      <section className="profile-card">
        <div className="stripe" />
        <Avatar name={user.name} team={user.team} size={72} />
        <h1>{user.name}</h1>
        <p className="muted">@{user.username}</p>
        <div className="profile-tags">
          <span className="role-tag">{ROLE_LABEL[user.role]}</span>
          {user.team && <TeamChip team={user.team} />}
        </div>
        <p className="profile-access">
          {user.permissions.allTeams ? 'You can manage events and tasks of every team.' : `You can manage events and tasks of the ${user.team} team.`}
        </p>
      </section>

      <section className="card">
        <h2 className="card-title">
          <KeyRound size={18} /> Change password
        </h2>
        <form className="form" onSubmit={submit}>
          <Field label="Current password">
            <input
              type="password"
              value={form.currentPassword}
              onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))}
              autoComplete="current-password"
              required
            />
          </Field>
          <Field label="New password" hint="At least 6 characters">
            <input
              type="password"
              value={form.newPassword}
              onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
              autoComplete="new-password"
              minLength={6}
              required
            />
          </Field>
          {error && <ErrorBox message={error} />}
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : 'Update password'}
          </button>
        </form>
      </section>

      <button className="btn btn-ghost btn-block btn-danger-text" onClick={logout}>
        <LogOut size={18} /> Sign out
      </button>

      <VerseCard />
    </div>
  );
}
