import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { TEAMS } from '../constants.js';
import { toLocalInput } from '../format.js';
import { ErrorBox, Field, Modal } from './ui.jsx';

/** Create or edit an event. `event` is undefined when creating. */
export default function EventForm({ event, defaultTeam, onClose, onSaved }) {
  const { user } = useAuth();
  const teams = user.permissions.allTeams ? TEAMS.map((t) => t.id) : [user.team];
  const [form, setForm] = useState({
    title: event?.title || '',
    team: event?.team || defaultTeam || teams[0],
    startDate: toLocalInput(event?.startDate),
    endDate: toLocalInput(event?.endDate),
    location: event?.location || '',
    description: event?.description || '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const body = {
      ...form,
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
          <span className="field-label">Team</span>
          <div className="team-picker">
            {teams.map((id) => {
              const t = TEAMS.find((x) => x.id === id);
              return (
                <button
                  type="button"
                  key={id}
                  className={`team-option ${form.team === id ? 'active' : ''}`}
                  style={{ '--team': t.color, '--team-soft': t.soft }}
                  onClick={() => setForm((f) => ({ ...f, team: id }))}
                  disabled={teams.length === 1}
                >
                  <span className="team-dot" />
                  {id}
                  <small lang="ar">{t.arabic}</small>
                </button>
              );
            })}
          </div>
        </div>

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
