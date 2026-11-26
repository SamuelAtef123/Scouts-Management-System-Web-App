import { useState } from 'react';
import { ClipboardCheck, KeyRound, Languages, LogOut, Phone } from 'lucide-react';
import { LanguageSwitch, t as tr } from '../i18n.jsx';
import PhoneInput from '../components/PhoneInput.jsx';
import { displayPhone, localPhone } from '../format.js';
import { api, tokenStore } from '../api.js';
import { useAuth } from '../auth.jsx';
import { roleLabel, teamName } from '../constants.js';
import { useApi } from '../hooks.js';
import { Avatar, ErrorBox, Field, Spinner, TeamChip, VerseCard, useToast } from '../components/ui.jsx';
import AttendanceByType from '../components/AttendanceByType.jsx';

function PhoneCard() {
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const [phone, setPhone] = useState(localPhone(user.phone));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await api.put('/auth/me/profile', { phone });
      updateUser(data.user);
      setPhone(localPhone(data.user.phone));
      toast(tr('Mobile number saved'));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card">
      <h2 className="card-title">
        <Phone size={18} /> {tr('Mobile number')}
      </h2>
      <form className="form phone-form" onSubmit={submit}>
        <Field label={tr('Mobile number')} hint={tr('Egyptian mobile, 11 digits')}>
          <PhoneInput value={phone} onChange={setPhone} required />
        </Field>
        {error && <ErrorBox message={error} />}
        <button className="btn btn-primary" disabled={busy || phone === localPhone(user.phone)}>
          {busy ? tr('Saving…') : tr('Save number')}
        </button>
      </form>
    </section>
  );
}

function AttendanceCard() {
  const { data, error, loading } = useApi('/stats/me');
  const a = data?.attendance;
  return (
    <section className="card">
      <h2 className="card-title">
        <ClipboardCheck size={18} /> {tr('My attendance')}
      </h2>
      {loading && !data ? (
        <Spinner />
      ) : error ? (
        <ErrorBox message={error} />
      ) : !a.sessions ? (
        <p className="muted">{tr('No attendance recorded for you yet.')}</p>
      ) : (
        <>
          <div className="attend-rate">
            <div className="rate-ring" style={{ '--p': a.rate ?? 0 }}>
              <span>{a.rate === null ? '–' : `${a.rate}%`}</span>
            </div>
            <div>
              <strong>
                {tr('{n} of {total} sessions attended', { n: a.present, total: a.present + a.absent })}
              </strong>
              <p className="muted">
                {tr('{a} absent · {e} excused', { a: a.absent, e: a.excused })} {tr("(excused sessions don't count against you)")}
              </p>
            </div>
          </div>
          <AttendanceByType byType={a.byType} />
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
      const data = await api.put('/auth/me/password', form);
      // Changing the password signs out other devices; keep this one signed in.
      if (data.token) tokenStore.set(data.token);
      setForm({ currentPassword: '', newPassword: '' });
      toast(tr('Password changed'));
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
        <Avatar person={user} size={88} />
        <h1>{user.name}</h1>
        <p className="muted">
          <bdi dir="ltr">@{user.username}</bdi>
        </p>
        {user.phone && (
          <a className="profile-phone" href={`tel:${user.phone}`} dir="ltr">
            <Phone size={16} /> {displayPhone(user.phone)}
          </a>
        )}
        <div className="profile-tags">
          <span className="role-tag">{roleLabel(user)}</span>
          {user.team && <TeamChip team={user.team} />}
        </div>
        <p className="profile-access">
          {user.permissions.allTeams
            ? tr('You can manage events and tasks of every kadr and of the whole group.')
            : tr('You can manage events and tasks of the {team} kadr.', { team: teamName(user.team) })}
          {user.permissions.attendanceTeam &&
            ` ${tr('You take attendance for the {team} kadr.', { team: teamName(user.permissions.attendanceTeam) })}`}
        </p>
      </section>

      <AttendanceCard />

      <PhoneCard />

      <section className="card">
        <h2 className="card-title">
          <Languages size={18} /> {tr('Language')}
        </h2>
        <LanguageSwitch />
      </section>

      <section className="card">
        <h2 className="card-title">
          <KeyRound size={18} /> {tr('Change password')}
        </h2>
        <form className="form" onSubmit={submit}>
          <Field label={tr('Current password')}>
            <input
              type="password"
              value={form.currentPassword}
              onChange={(e) => setForm((f) => ({ ...f, currentPassword: e.target.value }))}
              autoComplete="current-password"
              required
            />
          </Field>
          <Field label={tr('New password')} hint={tr('At least 8 characters')}>
            <input
              type="password"
              value={form.newPassword}
              onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </Field>
          {error && <ErrorBox message={error} />}
          <button className="btn btn-primary" disabled={busy}>
            {busy ? tr('Saving…') : tr('Update password')}
          </button>
        </form>
      </section>

      <button className="btn btn-ghost btn-block btn-danger-text" onClick={logout}>
        <LogOut size={18} /> {tr('Sign out')}
      </button>

      <VerseCard />
    </div>
  );
}
