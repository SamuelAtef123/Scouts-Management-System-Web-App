import { useMemo, useState } from 'react';
import { api } from '../api.js';
import { useApi } from '../hooks.js';
import { teamName } from '../constants.js';
import { t as tr } from '../i18n.jsx';
import { toDateInput } from '../format.js';
import { ErrorBox, Field, Modal } from './ui.jsx';

/** Create or edit a task of an event. `task` is undefined when creating. */
export default function TaskForm({ event, task, onClose, onSaved }) {
  const { data, loading } = useApi('/users');
  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    assignee: task?.assignee?._id || '',
    dueDate: toDateInput(task?.dueDate),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  // Only members of the event's team can be assigned (any member for a whole-group event).
  const options = useMemo(() => {
    const users = data?.users || [];
    return event.team ? users.filter((u) => u.team === event.team) : users;
  }, [data, event.team]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const body = {
      ...form,
      // End of the chosen day, local time.
      dueDate: form.dueDate ? new Date(`${form.dueDate}T23:59:00`).toISOString() : null,
    };
    try {
      const res = task ? await api.put(`/tasks/${task._id}`, body) : await api.post('/tasks', { ...body, event: event._id });
      onSaved(res.task);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal
      title={task ? tr('Edit task') : tr('New task')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {tr('Cancel')}
          </button>
          <button type="submit" form="task-form" className="btn btn-primary" disabled={busy}>
            {busy ? tr('Saving…') : task ? tr('Save changes') : tr('Create task')}
          </button>
        </>
      }
    >
      <form id="task-form" className="form" onSubmit={submit}>
        <p className="form-context">
          {tr('For')} <strong>{event.title}</strong>
        </p>
        <Field label={tr('Task')}>
          <input value={form.title} onChange={set('title')} placeholder={tr('e.g. Prepare the hymns booklet')} required maxLength={120} />
        </Field>
        <Field label={tr('Assign to')} hint={event.team ? tr('Members of the {team} team', { team: teamName(event.team) }) : tr('Any member of the group')}>
          <select value={form.assignee} onChange={set('assignee')} required disabled={loading}>
            <option value="" disabled>
              {loading ? tr('Loading members…') : options.length ? tr('Choose a member') : tr('No members in this team yet')}
            </option>
            {options.map((u) => (
              <option key={u._id} value={u._id}>
                {u.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={tr('Due date (optional)')}>
          <input type="date" value={form.dueDate} onChange={set('dueDate')} />
        </Field>
        <Field label={tr('Details (optional)')}>
          <textarea value={form.description} onChange={set('description')} rows={3} maxLength={2000} placeholder={tr('What exactly is needed?')} />
        </Field>
        {error && <ErrorBox message={error} />}
      </form>
    </Modal>
  );
}
