import { useMemo, useState } from 'react';
import { api } from '../api.js';
import { useApi } from '../hooks.js';
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
      title={task ? 'Edit task' : 'New task'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="task-form" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : task ? 'Save changes' : 'Create task'}
          </button>
        </>
      }
    >
      <form id="task-form" className="form" onSubmit={submit}>
        <p className="form-context">
          For <strong>{event.title}</strong>
        </p>
        <Field label="Task">
          <input value={form.title} onChange={set('title')} placeholder="e.g. Prepare the hymns booklet" required maxLength={120} />
        </Field>
        <Field label="Assign to" hint={event.team ? `Members of the ${event.team} team` : 'Any member of the group'}>
          <select value={form.assignee} onChange={set('assignee')} required disabled={loading}>
            <option value="" disabled>
              {loading ? 'Loading members…' : options.length ? 'Choose a member' : 'No members in this team yet'}
            </option>
            {options.map((u) => (
              <option key={u._id} value={u._id}>
                {u.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Due date (optional)">
          <input type="date" value={form.dueDate} onChange={set('dueDate')} />
        </Field>
        <Field label="Details (optional)">
          <textarea value={form.description} onChange={set('description')} rows={3} maxLength={2000} placeholder="What exactly is needed?" />
        </Field>
        {error && <ErrorBox message={error} />}
      </form>
    </Modal>
  );
}
