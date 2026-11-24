import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { EVENT_TYPES, TEAMS, teamName } from '../constants.js';
import { isArabic, t as tr } from '../i18n.jsx';
import { toLocalInput } from '../format.js';
import { ErrorBox, Field, Modal } from './ui.jsx';

/** Create or edit an event. `event` is undefined when creating. */
export default function EventForm({ event, defaultTeam, onClose, onSaved }) {
  const { user } = useAuth();
  const allTeams = user.permissions.allTeams;
  // Preparation Meetings: Scouts Leader and Helpers for any team, a Team Leader for their own team.
  const groupLeader = ['scout_leader', 'scout_leader_helper'].includes(user.role);
  const canPrep = groupLeader || user.role === 'team_leader';
  // Gawala Sessions (whole group) are for group-wide leaders only.
  const types = EVENT_TYPES.filter((t) => (t.group ? allTeams : t.id !== 'preparation_meeting' || canPrep));
  const teamsFor = (type) => {
    if (type === 'preparation_meeting') return groupLeader ? TEAMS.map((t) => t.id) : [user.team];
    return allTeams ? TEAMS.map((t) => t.id) : [user.team];
  };
  const locked = Boolean(event?.attendanceSummary?.taken); // type and team are fixed once attendance is taken

  const [form, setForm] = useState({
    title: event?.title || '',
    type: event?.type || 'team_session',
    team: event ? event.team || '' : defaultTeam && defaultTeam !== 'group' ? defaultTeam : teamsFor('team_session')[0],
    startDate: toLocalInput(event?.startDate),
    endDate: toLocalInput(event?.endDate),
    location: event?.location || '',
    description: event?.description || '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  // Events cannot start in the past. When editing, an unchanged past date is still allowed.
  const nowInput = toLocalInput(new Date());
  const keptPastDate = event && form.startDate === toLocalInput(event.startDate);
  const startMin = keptPastDate ? undefined : nowInput;
  const typeInfo = EVENT_TYPES.find((t) => t.id === form.type);
  const teams = teamsFor(form.type);
  // "Others" can belong to the whole group too, for group-wide leaders.
  const allowWholeGroup = allTeams && form.type === 'other';

  const pickType = (id) =>
    setForm((f) => {
      const next = EVENT_TYPES.find((t) => t.id === id);
      const allowed = teamsFor(id);
      let team = f.team;
      if (next.group) team = '';
      else if (!allowed.includes(team) && !(id === 'other' && allTeams && team === '')) team = allowed[0];
      return { ...f, type: id, team };
    });

  const submit = async (e) => {
    e.preventDefault();
    if (!keptPastDate && form.startDate && new Date(form.startDate) < new Date(Date.now() - 60000)) {
      setError(tr('The event cannot start in the past'));
      return;
    }
    setBusy(true);
    setError('');
    const body = {
      ...form,
      team: typeInfo.group ? null : form.team || null,
      startDate: form.startDate ? new Date(form.startDate).toISOString() : '',
      endDate: form.endDate ? new Date(form.endDate).toISOString() : null,
    };
    try {
      const data = event ? await api.put(`/events/${event._id}`, body) : await api.post('/events', body);
      onSaved(data.event);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal
      title={event ? tr('Edit event') : tr('New event')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {tr('Cancel')}
          </button>
          <button type="submit" form="event-form" className="btn btn-primary" disabled={busy}>
            {busy ? tr('Saving…') : event ? tr('Save changes') : tr('Create event')}
          </button>
        </>
      }
    >
      <form id="event-form" className="form" onSubmit={submit}>
        <Field label={tr('Title')}>
          <input value={form.title} onChange={set('title')} placeholder={tr('e.g. Weekly meeting')} required maxLength={120} />
        </Field>

        <div className="field">
          <span className="field-label">{tr('Type')}</span>
          <div className="type-picker">
            {types.map((t) => (
              <button
                type="button"
                key={t.id}
                className={`type-option ${form.type === t.id ? 'active' : ''}`}
                onClick={() => pickType(t.id)}
                disabled={locked && form.type !== t.id}
              >
                <strong>{t.label}</strong>
              </button>
            ))}
          </div>
        </div>

        {typeInfo.group ? null : (
          <div className="field">
            <span className="field-label">{tr('Team')}</span>
            <div className="team-picker">
              {allowWholeGroup && (
                <button
                  type="button"
                  className={`team-option ${form.team === '' ? 'active' : ''}`}
                  style={{ '--team': '#23277d', '--team-soft': '#e7e8f8' }}
                  onClick={() => setForm((f) => ({ ...f, team: '' }))}
                  disabled={locked}
                >
                  <span className="team-dot group-dot" />
                  {tr('Whole group')}
                </button>
              )}
              {teams.map((id) => {
                const t = TEAMS.find((x) => x.id === id);
                return (
                  <button
                    type="button"
                    key={id}
                    className={`team-option ${form.team === id ? 'active' : ''}`}
                    style={{ '--team': t.color, '--team-soft': t.soft }}
                    onClick={() => setForm((f) => ({ ...f, team: id }))}
                    disabled={teams.length === 1 || (locked && form.team !== id)}
                  >
                    <span className="team-dot" />
                    {teamName(id)}
                    <small lang={isArabic() ? 'en' : 'ar'}>{isArabic() ? id : t.arabic}</small>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {locked && <p className="field-hint">{tr("Attendance was already taken, so the type and team can't change.")}</p>}

        <div className="form-row">
          <Field label={tr('Starts')}>
            <input
              type="datetime-local"
              value={form.startDate}
              onChange={set('startDate')}
              min={startMin}
              required
            />
          </Field>
          <Field label={tr('Ends (optional)')}>
            <input type="datetime-local" value={form.endDate} onChange={set('endDate')} min={form.startDate || undefined} />
          </Field>
        </div>

        <Field label={tr('Location (optional)')}>
          <input value={form.location} onChange={set('location')} placeholder={tr('e.g. Church yard')} maxLength={120} />
        </Field>
        <Field label={tr('Details (optional)')}>
          <textarea value={form.description} onChange={set('description')} rows={3} maxLength={2000} placeholder={tr('What is this event about?')} />
        </Field>
        {error && <ErrorBox message={error} />}
      </form>
    </Modal>
  );
}
