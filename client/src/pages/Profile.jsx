import { useState } from 'react';
import { ClipboardCheck, KeyRound, LogOut } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { EVENT_TYPES, ROLE_LABEL } from '../constants.js';
import { useApi } from '../hooks.js';
import { Avatar, ErrorBox, Field, Spinner, TeamChip, VerseCard, useToast } from '../components/ui.jsx';

function AttendanceCard() {
  const { data, error, loading } = useApi('/stats/me');
  const a = data?.attendance;
  return (
    <section className="card">
      <h2 className="card-title">
        <ClipboardCheck size={18} /> My attendance
      </h2>
      {loading && !data ? (
        <Spinner />
      ) : error ? (
        <ErrorBox message={error} />
      ) : !a.sessions ? (
        <p className="muted">No attendance recorded for you yet.</p>
      ) : (
        <>
          <div className="attend-rate">
            <div className="rate-ring" style={{ '--p': a.rate ?? 0 }}>
              <span>{a.rate === null ? '–' : `${a.rate}%`}</span>
            </div>
            <div>
              <strong>
                {a.present} of {a.present + a.absent} sessions attended
              </strong>
              <p className="muted">
                {a.absent} absent · {a.excused} excused (excused sessions don't count against you)
              </p>
            </div>
          </div>
          <div className="attend-types">
            {EVENT_TYPES.filter((t) => t.attendance && a.byType[t.id]).map((t) => {
              const c = a.byType[t.id];
              return (
                <div key={t.id} className="attend-type">
                  <span>{t.label}</span>
                  <b>
                    {c.present}/{c.present + c.absent}
                  </b>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

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
          {user.permissions.allTeams
            ? 'You can manage events and tasks of every team and of the whole group.'
            : `You can manage events and tasks of the ${user.team} team.`}
        </p>
      </section>

      <AttendanceCard />

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
