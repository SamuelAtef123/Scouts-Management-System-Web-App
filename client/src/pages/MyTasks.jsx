import { useState } from 'react';
import { ListChecks, Sparkles } from 'lucide-react';
import { useApi } from '../hooks.js';
import TaskCard from '../components/TaskCard.jsx';
import { EmptyState, ErrorBox, Spinner } from '../components/ui.jsx';

const TABS = [
  { id: 'open', label: 'Open' },
  { id: 'done', label: 'Done' },
];

export default function MyTasks() {
  const [tab, setTab] = useState('open');
  const { data, error, loading, reload, setData } = useApi(`/tasks/mine?status=${tab}`);

  // Keep the list in sync when a task moves between Open and Done.
  const onChange = (task) =>
    setData((d) => {
      const belongs = tab === 'done' ? task.status === 'done' : task.status !== 'done';
      return { tasks: belongs ? d.tasks.map((t) => (t._id === task._id ? task : t)) : d.tasks.filter((t) => t._id !== task._id) };
    });

  // Tasks with the nearest due date first, tasks without a due date last.
  const tasks = [...(data?.tasks || [])].sort((a, b) => {
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate) - new Date(b.dueDate);
  });

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>My tasks</h1>
          <p className="muted">Tasks assigned to you. Upload the material when it is ready.</p>
        </div>
      </header>

      <div className="segmented segmented-lg" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={`seg ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <Spinner />
      ) : error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : tasks.length === 0 ? (
        tab === 'open' ? (
          <EmptyState icon={Sparkles} title="You're all caught up" text="When someone assigns you a task, it shows up here." />
        ) : (
          <EmptyState icon={ListChecks} title="Nothing finished yet" text="Tasks you mark as done appear here." />
        )
      ) : (
        <div className="stack task-grid">
          {tasks.map((t) => (
            <TaskCard key={t._id} task={t} showEvent onChange={onChange} />
          ))}
        </div>
      )}
    </div>
  );
}
