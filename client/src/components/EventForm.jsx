import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { EVENT_TYPES, TEAMS } from '../constants.js';
import { toLocalInput } from '../format.js';
import { ErrorBox, Field, Modal } from './ui.jsx';

/** Create or edit an event. `event` is undefined when creating. */
export default function EventForm({ event, defaultTeam, onClose, onSaved }) {
  const { user } = useAuth();
  const allTeams = user.permissions.allTeams;
  const teams = allTeams ? TEAMS.map((t) => t.id) : [user.team];
  // Whole-group types (Preparation Meeting, Gawala Session) are for group-wide leaders only.
  const types = EVENT_TYPES.filter((t) => allTeams || !t.group);
  const locked = Boolean(event?.attendanceSummary?.taken); // type and team are fixed once attendance is taken

  const [form, setForm] = useState({
    title: event?.title || '',
    type: event?.type || 'team_session',
    team: event ? event.team || '' : defaultTeam && defaultTeam !== 'group' ? defaultTeam : teams[0],
    startDate: toLocalInput(event?.startDate),
    endDate: toLocalInput(event?.endDate),
    location: event?.location || '',
    description: event?.description || '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const typeInfo = EVENT_TYPES.find((t) => t.id === form.type);
  // "Others" can belong to the whole group too, for group-wide leaders.
  const allowWholeGroup = allTeams && form.type === 'other';

  const pickType = (id) =>
    setForm((f) => {
      const next = EVENT_TYPES.find((t) => t.id === id);
      let team = f.team;
      if (next.group) team = '';
      else if (!team) team = teams[0];
      return { ...f, type: id, team };
    });

  const submit = async (e) => {
    e.preventDefault();
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
      title={event ? 'Edit event' : 'New event'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="event-form" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : event ? 'Save changes' : 'Create event'}
          </button>
        </>
      }
    >
      <form id="event-form" className="form" onSubmit={submit}>
        <Field label="Title">
          <input value={form.title} onChange={set('title')} placeholder="e.g. Weekly meeting" required maxLength={120} />
        </Field>

        <div className="field">
          <span className="field-label">Type</span>
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
                <small>{t.hint}</small>
              </button>
            ))}
          </div>
        </div>

        {typeInfo.group ? (
          <p className="form-context">
            This is a <strong>whole-group</strong> event: everyone can see it, and the attendance sheet lists the members of all teams.
          </p>
        ) : (
          <div className="field">
            <span className="field-label">Team</span>
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
                  Whole group
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
                    {id}
                    <small lang="ar">{t.arabic}</small>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {locked && <p className="field-hint">Attendance was already taken, so the type and team can't change.</p>}

        <div className="form-row">
          <Field label="Starts">
            <input type="datetime-local" value={form.startDate} onChange={set('startDate')} required />
          </Field>
          <Field label="Ends (optional)">
            <input type="datetime-local" value={form.endDate} onChange={set('endDate')} min={form.startDate || undefined} />
          </Field>
        </div>

        <Field label="Location (optional)">
          <input value={form.location} onChange={set('location')} placeholder="e.g. Church yard" maxLength={120} />
        </Field>
        <Field label="Details (optional)">
          <textarea value={form.description} onChange={set('description')} rows={3} maxLength={2000} placeholder="What is this event about?" />
        </Field>
        {error && <ErrorBox message={error} />}
      </form>
    </Modal>
  );
}
