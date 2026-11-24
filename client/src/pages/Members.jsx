import { useMemo, useState } from 'react';
import { ClipboardCheck, Pencil, Plus, Search, Shield, Users } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useApi } from '../hooks.js';
import { EVENT_TYPES, ROLES, ROLE_LABEL, TEAMS } from '../constants.js';
import { displayPhone, localPhone } from '../format.js';
import PhoneInput from '../components/PhoneInput.jsx';
import { Avatar, EmptyState, ErrorBox, Field, Modal, Spinner, TeamChip, useToast } from '../components/ui.jsx';

function MemberForm({ member, onClose, onSaved }) {
  const { user } = useAuth();
  const isSelf = member?._id === user._id;
  // The 3 non-privileged Database members manage only their assigned team, and only these roles.
  const limited = !user.permissions.allTeams;
  const teamOptions = TEAMS.filter((t) => (user.permissions.memberTeams || []).includes(t.id));
  const roleOptions = limited ? ROLES.filter((r) => ['team_leader', 'team_leader_helper'].includes(r.id)) : ROLES;
  const [form, setForm] = useState({
    name: member?.name || '',
    username: member?.username || '',
    phone: localPhone(member?.phone),
    role: member?.role || 'team_leader_helper',
    team: member?.team || (limited ? teamOptions[0]?.id || '' : ''),
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
            <PhoneInput value={form.phone} onChange={(phone) => setForm((f) => ({ ...f, phone }))} />
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
              {roleOptions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Team" hint="Decides whose attendance sheet they appear on">
            <select value={form.team} onChange={set('team')} required>
              <option value="">Choose a team</option>
              {teamOptions.map((t) => (
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
        {form.role === 'database_team' && !limited && (
          <label className="check">
            <input type="checkbox" checked={form.isPrivileged} onChange={set('isPrivileged')} />
            <span>
              <strong>Privileged member</strong>
              <small>Can manage events and tasks of every team</small>
            </span>
          </label>
        )}
        <Field label={member ? 'New password (leave empty to keep)' : 'Password'} hint="At least 8 characters">
          <input type="text" value={form.password} onChange={set('password')} minLength={8} required={!member} autoComplete="new-password" />
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

/** Read-only view of a member: details and attendance. */
function MemberDetails({ member, onClose, onEdit }) {
  const { data, error, loading } = useApi(`/users/${member._id}`);
  const a = data?.attendance;
  return (
    <Modal
      title="Member"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          {onEdit && (
            <button type="button" className="btn btn-primary" onClick={onEdit}>
              <Pencil size={16} /> Edit
            </button>
          )}
        </>
      }
    >
      <div className="member-detail-head">
        <Avatar person={member} size={56} />
        <div>
          <h3>{member.name}</h3>
          <p className="muted">@{member.username}</p>
        </div>
      </div>
      <dl className="detail-list">
        <div>
          <dt>Role</dt>
          <dd>
            {ROLE_LABEL[member.role]}
            {member.isPrivileged && ' (privileged)'}
          </dd>
        </div>
        <div>
          <dt>Team</dt>
          <dd>{member.team ? <TeamChip team={member.team} size="sm" /> : '–'}</dd>
        </div>
        {member.attendanceTeam && (
          <div>
            <dt>Takes attendance for</dt>
            <dd>{member.attendanceTeam}</dd>
          </div>
        )}
        <div>
          <dt>Phone</dt>
          <dd>{member.phone ? <a href={`tel:${member.phone}`}>{displayPhone(member.phone)}</a> : '–'}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{member.isActive ? 'Active' : 'Inactive'}</dd>
        </div>
      </dl>

      <h3 className="detail-section">
        <ClipboardCheck size={17} /> Attendance
      </h3>
      {loading && !data ? (
        <Spinner />
      ) : error ? (
        <ErrorBox message={error} />
      ) : !a.sessions ? (
        <p className="muted">No attendance recorded yet.</p>
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
                {a.absent} absent · {a.excused} excused
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
    </Modal>
  );
}

function RateBadge({ rate }) {
  if (rate === null || rate === undefined) return <span className="rate-badge rate-none">–</span>;
  const tone = rate >= 75 ? 'good' : rate >= 50 ? 'mid' : 'low';
  return <span className={`rate-badge rate-${tone}`}>{rate}%</span>;
}

export default function Members() {
  const toast = useToast();
  const { user } = useAuth();
  const canEdit = user.permissions.manageUsers; // only the privileged Database/Attendance members
  // Teams whose members this user can view (one team for the non-privileged Database members).
  const myTeams = user.permissions.memberTeams || [];
  const filterTeams = TEAMS.filter((t) => myTeams.includes(t.id));
  const { data, error, loading, reload, setData } = useApi('/users?scope=members&includeInactive=true');
  const rates = useApi('/users/attendance');
  const [query, setQuery] = useState('');
  const [team, setTeam] = useState('');
  const [viewing, setViewing] = useState(null);
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
          <p className="muted">
            {filterTeams.length === 1 && `${filterTeams[0].id} team · `}
            {data ? `${data.users.filter((u) => u.isActive).length} active members` : 'Loading…'}
            {!canEdit && ' · view only'}
          </p>
        </div>
        {canEdit && (
          <button className="btn btn-primary" onClick={() => setEditing({})}>
            <Plus size={18} /> <span className="desktop-only-inline">Add member</span>
            <span className="mobile-only-inline">Add</span>
          </button>
        )}
      </header>

      <div className="search">
        <Search size={18} />
        <input placeholder="Search by name or username" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {filterTeams.length > 1 && (
      <div className="chips">
        <button className={`chip ${!team ? 'active' : ''}`} onClick={() => setTeam('')}>
          Everyone
        </button>
        {filterTeams.map((t) => (
          <button key={t.id} className={`chip ${team === t.id ? 'active' : ''}`} style={{ '--team': t.color, '--team-soft': t.soft }} onClick={() => setTeam(t.id)}>
            <span className="team-dot" />
            {t.id}
          </button>
        ))}
      </div>
      )}

      {loading && !data ? (
        <Spinner />
      ) : error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : members.length === 0 ? (
        <EmptyState icon={Users} title="No members found" />
      ) : (
        <div className="member-list">
          {members.map((u) => (
            <button key={u._id} className={`member ${u.isActive ? '' : 'inactive'}`} onClick={() => setViewing(u)}>
              <Avatar person={u} />
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
              <span className="member-side">
                {u.team && <TeamChip team={u.team} size="sm" />}
                <RateBadge rate={rates.data?.rates[u._id]?.rate} />
              </span>
            </button>
          ))}
        </div>
      )}

      {viewing && (
        <MemberDetails
          member={viewing}
          onClose={() => setViewing(null)}
          onEdit={
            canEdit
              ? () => {
                  setEditing(viewing);
                  setViewing(null);
                }
              : undefined
          }
        />
      )}

      {editing && canEdit && (
        <MemberForm
          member={editing._id ? editing : undefined}
          onClose={() => setEditing(null)}
          onSaved={(saved, created) => {
            setData((d) => ({
              users: created ? [...d.users, saved].sort((a, b) => a.name.localeCompare(b.name)) : d.users.map((u) => (u._id === saved._id ? saved : u)),
            }));
            setEditing(null);
            toast(created ? 'Member added' : 'Member updated');
          }}
        />
      )}
    </div>
  );
}
