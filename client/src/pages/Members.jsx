import { useMemo, useState } from 'react';
import { Plus, Search, Shield, Users } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useApi } from '../hooks.js';
import { ROLES, ROLE_LABEL, TEAMS } from '../constants.js';
import { Avatar, EmptyState, ErrorBox, Field, Modal, Spinner, TeamChip, useToast } from '../components/ui.jsx';

function MemberForm({ member, onClose, onSaved }) {
  const { user } = useAuth();
  const isSelf = member?._id === user._id;
  const [form, setForm] = useState({
    name: member?.name || '',
    username: member?.username || '',
    phone: member?.phone || '',
    role: member?.role || 'team_leader_helper',
    team: member?.team || '',
    isPrivileged: member?.isPrivileged || false,
    isActive: member?.isActive ?? true,
    password: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const body = { ...form, team: form.team || null };
    if (member && !body.password) delete body.password;
    try {
      const res = member ? await api.put(`/users/${member._id}`, body) : await api.post('/users', body);
      onSaved(res.user, !member);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };


  return (
    <Modal
      title={member ? 'Edit member' : 'Add member'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="member-form" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : member ? 'Save changes' : 'Add member'}
          </button>
        </>
      }
    >
      <form id="member-form" className="form" onSubmit={submit}>
        <Field label="Full name">
          <input value={form.name} onChange={set('name')} required maxLength={80} />
        </Field>
        <div className="form-row">
          <Field label="Username" hint="Used to sign in">
            <input value={form.username} onChange={set('username')} required autoCapitalize="none" pattern="[A-Za-z0-9._\-]{3,30}" />
          </Field>
          <Field label="Phone (optional)">
            <input value={form.phone} onChange={set('phone')} inputMode="tel" maxLength={20} />
          </Field>
        </div>
        <div className="form-row">
          <Field label="Role">
            <select
              value={form.role}
              onChange={(e) => {
                const role = e.target.value;
                // Scouts Leader, Helpers and the Database team belong to the Gawala team.
                const gawala = ['scout_leader', 'scout_leader_helper', 'database_team'].includes(role);
                setForm((f) => ({ ...f, role, team: gawala && !f.team ? 'Gawala' : f.team }));
              }}
              disabled={isSelf}
            >
              {ROLES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Team" hint="Decides whose attendance sheet they appear on">
            <select value={form.team} onChange={set('team')} required>
              <option value="">Choose a team</option>
              {TEAMS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.id}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {form.role === 'database_team' && (
          <p className="form-context">
            {member?.attendanceTeam ? (
              <>
                Takes attendance for the <strong>{member.attendanceTeam}</strong> team.
              </>
            ) : (
              'Not assigned to take any team\'s attendance.'
            )}{' '}
            This is fixed by the system and can't be changed here.
          </p>
        )}
        {form.role === 'database_team' && (
          <label className="check">
            <input type="checkbox" checked={form.isPrivileged} onChange={set('isPrivileged')} />
            <span>
              <strong>Privileged member</strong>
              <small>Can manage events and tasks of every team</small>
            </span>
          </label>
        )}
        <Field label={member ? 'New password (leave empty to keep)' : 'Password'} hint="At least 6 characters">
          <input type="text" value={form.password} onChange={set('password')} minLength={6} required={!member} autoComplete="new-password" />
        </Field>
        {member && !isSelf && (
          <label className="check">
            <input type="checkbox" checked={form.isActive} onChange={set('isActive')} />
            <span>
              <strong>Active</strong>
              <small>Inactive members cannot sign in or receive tasks</small>
            </span>
          </label>
        )}
        {error && <ErrorBox message={error} />}
      </form>
    </Modal>
  );
}

export default function Members() {
  const toast = useToast();
  const { data, error, loading, reload, setData } = useApi('/users?includeInactive=true');
  const [query, setQuery] = useState('');
  const [team, setTeam] = useState('');
  const [editing, setEditing] = useState(null); // {} for new

  const members = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.users || []).filter(
      (u) => (!team || u.team === team) && (!q || u.name.toLowerCase().includes(q) || u.username.includes(q))
    );
  }, [data, query, team]);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Members</h1>
          <p className="muted">{data ? `${data.users.filter((u) => u.isActive).length} active members` : 'Gawala team accounts'}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setEditing({})}>
          <Plus size={18} /> <span className="desktop-only-inline">Add member</span>
          <span className="mobile-only-inline">Add</span>
        </button>
      </header>

      <div className="search">
        <Search size={18} />
        <input placeholder="Search by name or username" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="chips">
        <button className={`chip ${!team ? 'active' : ''}`} onClick={() => setTeam('')}>
          Everyone
        </button>
        {TEAMS.map((t) => (
          <button key={t.id} className={`chip ${team === t.id ? 'active' : ''}`} style={{ '--team': t.color, '--team-soft': t.soft }} onClick={() => setTeam(t.id)}>
            <span className="team-dot" />
            {t.id}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <Spinner />
      ) : error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : members.length === 0 ? (
        <EmptyState icon={Users} title="No members found" />
      ) : (
        <div className="member-list">
          {members.map((u) => (
            <button key={u._id} className={`member ${u.isActive ? '' : 'inactive'}`} onClick={() => setEditing(u)}>
              <Avatar name={u.name} team={u.team} />
              <span className="member-text">
                <strong>
                  {u.name}
                  {u.isPrivileged && <Shield size={14} className="privileged" aria-label="Privileged" />}
                </strong>
                <span>
                  {ROLE_LABEL[u.role]}
                  {u.attendanceTeam && ` · attendance: ${u.attendanceTeam}`} · @{u.username}
                  {!u.isActive && ' · Inactive'}
                </span>
              </span>
              {u.team && <TeamChip team={u.team} size="sm" />}
            </button>
          ))}
        </div>
      )}

      {editing && (
        <MemberForm
          member={editing._id ? editing : undefined}
          onClose={() => setEditing(null)}
          onSaved={(user, created) => {
            setData((d) => ({
              users: created ? [...d.users, user].sort((a, b) => a.name.localeCompare(b.name)) : d.users.map((u) => (u._id === user._id ? user : u)),
            }));
            setEditing(null);
            toast(created ? 'Member added' : 'Member updated');
          }}
        />
      )}
    </div>
  );
}
