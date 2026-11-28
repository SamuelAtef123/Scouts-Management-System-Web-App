import { useMemo, useState } from 'react';
import { ClipboardCheck, Pencil, Plus, Search, Shield, Users } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useApi } from '../hooks.js';
import { ROLES, roleLabel, TEAMS, teamName } from '../constants.js';
import { t as tr, isArabic } from '../i18n.jsx';
import { displayPhone, localPhone } from '../format.js';
import PhoneInput from '../components/PhoneInput.jsx';
import { Avatar, EmptyState, ErrorBox, Field, Modal, Spinner, TeamChip, useToast } from '../components/ui.jsx';
import AttendanceByType from '../components/AttendanceByType.jsx';

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
    email: member?.email || '',
    role: member?.role || 'team_leader_helper',
    team: member?.team || (limited ? teamOptions[0]?.id || '' : ''),
    isPrivileged: member?.isPrivileged || false,
    isActive: member?.isActive ?? true,
    password: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  // Whose attendance this member takes follows their username (fixed in the server's list), shown as you type.
  const attendanceKadr = user.permissions.attendanceAssignments?.[form.username.trim().toLowerCase()] ?? member?.attendanceTeam ?? null;

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
      title={member ? tr('Edit member') : tr('Add member')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {tr('Cancel')}
          </button>
          <button type="submit" form="member-form" className="btn btn-primary" disabled={busy}>
            {busy ? tr('Saving…') : member ? tr('Save changes') : tr('Add member')}
          </button>
        </>
      }
    >
      <form id="member-form" className="form" onSubmit={submit}>
        <Field label={tr('Full name')}>
          <input value={form.name} onChange={set('name')} required maxLength={80} />
        </Field>
        <div className="form-row">
          <Field label={tr('Username')} hint={tr('Used to sign in')}>
            <input value={form.username} onChange={set('username')} required autoCapitalize="none" pattern="[A-Za-z0-9._\-]{3,30}" />
          </Field>
          <Field label={tr('Phone (optional)')}>
            <PhoneInput value={form.phone} onChange={(phone) => setForm((f) => ({ ...f, phone }))} />
          </Field>
        </div>
        <Field label={tr('Email (optional)')} hint={tr('If empty, they are asked for it the first time they sign in')}>
          <input type="email" dir="ltr" value={form.email} onChange={set('email')} maxLength={120} autoCapitalize="none" autoComplete="off" />
        </Field>
        <div className="form-row">
          <Field label={tr('Role')}>
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
          <Field label={tr('Kadr')} hint={tr('Decides whose attendance sheet they appear on')}>
            <select value={form.team} onChange={set('team')} required>
              <option value="">{tr('Choose a kadr')}</option>
              {teamOptions.map((t) => (
                <option key={t.id} value={t.id} lang="ar">
                  {t.arabic}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {form.role === 'database_team' && (
          <p className="form-context">
            {attendanceKadr ? (
              <>
                {tr('Takes attendance for the')} <strong>{teamName(attendanceKadr)}</strong>
                {isArabic() ? tr('kadr.') : ` ${tr('kadr.')}`}
              </>
            ) : (
              tr("This username is not on the attendance list, so they won't take any kadr's attendance.")
            )}{' '}
            {tr("This is fixed by the system and can't be changed here.")}
          </p>
        )}
        {form.role === 'database_team' && !limited && (
          <label className="check">
            <input type="checkbox" checked={form.isPrivileged} onChange={set('isPrivileged')} />
            <span>
              <strong>{tr('Privileged member')}</strong>
              <small>{tr('Can manage events and tasks of every kadr')}</small>
            </span>
          </label>
        )}
        <Field
          label={member ? tr('New password (leave empty to keep)') : tr('Password (optional)')}
          hint={member ? tr('At least 8 characters') : tr('At least 8 characters. If empty, the password is {password}', { password: 'scouts123' })}
        >
          <input type="text" value={form.password} onChange={set('password')} minLength={8} autoComplete="new-password" />
        </Field>
        {member && !isSelf && (
          <label className="check">
            <input type="checkbox" checked={form.isActive} onChange={set('isActive')} />
            <span>
              <strong>{tr('Active')}</strong>
              <small>{tr('Inactive members cannot sign in or receive tasks')}</small>
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
      title={tr('Member')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {tr('Close')}
          </button>
          {onEdit && (
            <button type="button" className="btn btn-primary" onClick={onEdit}>
              <Pencil size={16} /> {tr('Edit')}
            </button>
          )}
        </>
      }
    >
      <div className="member-detail-head">
        <Avatar person={member} size={56} />
        <div>
          <h3>{member.name}</h3>
          <p className="muted">
            <bdi dir="ltr">@{member.username}</bdi>
          </p>
        </div>
      </div>
      <dl className="detail-list">
        <div>
          <dt>{tr('Role')}</dt>
          <dd>
            {roleLabel(member)}
            {member.isPrivileged && ` (${tr('privileged')})`}
          </dd>
        </div>
        <div>
          <dt>{tr('Kadr')}</dt>
          <dd>{member.team ? <TeamChip team={member.team} size="sm" /> : '–'}</dd>
        </div>
        {member.attendanceTeam && (
          <div>
            <dt>{tr('Takes attendance for')}</dt>
            <dd>{teamName(member.attendanceTeam)}</dd>
          </div>
        )}
        <div>
          <dt>{tr('Phone')}</dt>
          <dd>{member.phone ? <a href={`tel:${member.phone}`} dir="ltr">{displayPhone(member.phone)}</a> : '–'}</dd>
        </div>
        <div className="detail-wide">
          <dt>{tr('Email')}</dt>
          <dd>{member.email ? <a href={`mailto:${member.email}`} dir="ltr" className="detail-email">{member.email}</a> : '–'}</dd>
        </div>
        <div>
          <dt>{tr('Status')}</dt>
          <dd>{member.isActive ? tr('Active') : tr('Inactive')}</dd>
        </div>
      </dl>

      <h3 className="detail-section">
        <ClipboardCheck size={17} /> {tr('Attendance')}
      </h3>
      {loading && !data ? (
        <Spinner />
      ) : error ? (
        <ErrorBox message={error} />
      ) : !a.sessions ? (
        <p className="muted">{tr('No attendance recorded yet.')}</p>
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
                {tr('{a} absent · {e} excused', { a: a.absent, e: a.excused })}
              </p>
            </div>
          </div>
          <AttendanceByType byType={a.byType} />
        </>
      )}
    </Modal>
  );
}

function RateBadge({ rate }) {
  if (rate === null || rate === undefined) return <span className="rate-badge rate-none">–</span>;
  const tone = rate >= 75 ? 'good' : rate >= 50 ? 'mid' : 'low';
  return (
    <span className={`rate-badge rate-${tone}`} title={tr('Attendance')}>
      <b>{rate}%</b>
      <i aria-hidden="true">
        <span style={{ width: `${rate}%` }} />
      </i>
    </span>
  );
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
          <h1>{tr('Members')}</h1>
          <p className="muted">
            {filterTeams.length === 1 && `${tr('{team} kadr', { team: teamName(filterTeams[0].id) })} · `}
            {data ? tr('{n} active members', { n: data.users.filter((u) => u.isActive).length }) : tr('Loading…')}
            {!canEdit && ` · ${tr('view only')}`}
          </p>
        </div>
        {canEdit && (
          <button className="btn btn-primary" onClick={() => setEditing({})}>
            <Plus size={18} /> <span className="desktop-only-inline">{tr('Add member')}</span>
            <span className="mobile-only-inline">{tr('Add')}</span>
          </button>
        )}
      </header>

      <div className="search">
        <Search size={18} />
        <input placeholder={tr('Search by name or username')} value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {filterTeams.length > 1 && (
      <div className="chips">
        <button className={`chip ${!team ? 'active' : ''}`} onClick={() => setTeam('')}>
          {tr('Everyone')}
        </button>
        {filterTeams.map((t) => (
          <button key={t.id} className={`chip ${team === t.id ? 'active' : ''}`} style={{ '--team': t.color, '--team-soft': t.soft }} onClick={() => setTeam(t.id)}>
            <span className="team-dot" />
            <span lang="ar">{t.arabic}</span>
          </button>
        ))}
      </div>
      )}

      {loading && !data ? (
        <Spinner />
      ) : error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : members.length === 0 ? (
        <EmptyState icon={Users} title={tr('No members found')} />
      ) : (
        <div className="member-list">
          {members.map((u) => (
            <button key={u._id} className={`member ${u.isActive ? '' : 'inactive'}`} onClick={() => setViewing(u)}>
              <Avatar person={u} />
              <span className="member-text">
                <strong>
                  {u.name}
                  {u.isPrivileged && <Shield size={14} className="privileged" aria-label={tr('Privileged')} />}
                </strong>
                <span>
                  {roleLabel(u)}
                  {u.attendanceTeam && ` · ${tr('attendance: {team}', { team: teamName(u.attendanceTeam) })}`} · <bdi dir="ltr">@{u.username}</bdi>
                  {!u.isActive && ` · ${tr('Inactive')}`}
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
            toast(created ? tr('Member added') : tr('Member updated'));
          }}
        />
      )}
    </div>
  );
}
