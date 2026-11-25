import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FileCheck2, ListChecks, Sparkles } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { useApi } from '../hooks.js';
import { t as tr } from '../i18n.jsx';
import TaskCard from '../components/TaskCard.jsx';
import { EmptyState, ErrorBox, Spinner } from '../components/ui.jsx';

const TABS = [
  { id: 'open', label: 'Open' },
  { id: 'done', label: 'Done' },
];

const waiting = (task) => task.materials?.filter((m) => m.reviewStatus === 'pending').length || 0;

export default function MyTasks() {
  const { user } = useAuth();
  const reviewer = user.permissions.reviewMaterials;
  const [params, setParams] = useSearchParams();
  const [tab, setTabState] = useState(params.get('tab') === 'review' && reviewer ? 'review' : 'open');
  const setTab = (id) => {
    setTabState(id);
    setParams(id === 'review' ? { tab: 'review' } : {}, { replace: true });
  };
  const { data, error, loading, reload, setData } = useApi(tab === 'review' ? '/tasks/reviews' : `/tasks/mine?status=${tab}`);
  const reviews = useApi(reviewer ? '/tasks/reviews' : null);
  const reviewCount = (tab === 'review' ? data : reviews.data)?.tasks.reduce((n, t) => n + waiting(t), 0) || 0;

  // Keep the list in sync when a task moves between Open and Done, or has nothing left to review.
  const onChange = (task) =>
    setData((d) => {
      const belongs = tab === 'review' ? waiting(task) > 0 : tab === 'done' ? task.status === 'done' : task.status !== 'done';
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
          <h1>{tr('My tasks')}</h1>
          <p className="muted">
            {tab === 'review'
              ? tr('Files sent for tasks you review. Approve them to save them to Google Drive, or send them back with a note.')
              : tr('Tasks assigned to you. Upload the material when it is ready.')}
          </p>
        </div>
      </header>

      <div className="segmented segmented-lg" role="tablist">
        {(reviewer ? [...TABS, { id: 'review', label: 'To review' }] : TABS).map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={`seg ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {tr(t.label)}
            {t.id === 'review' && reviewCount > 0 && <span className="nav-badge">{reviewCount}</span>}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <Spinner />
      ) : error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : tasks.length === 0 ? (
        tab === 'review' ? (
          <EmptyState icon={FileCheck2} title={tr('Nothing to review')} text={tr('Files uploaded for tasks you review appear here until you approve them.')} />
        ) : tab === 'open' ? (
          <EmptyState icon={Sparkles} title={tr("You're all caught up")} text={tr('When someone assigns you a task, it shows up here.')} />
        ) : (
          <EmptyState icon={ListChecks} title={tr('Nothing finished yet')} text={tr('Tasks you mark as done appear here.')} />
        )
      ) : (
        <div className="stack task-grid">
          {tasks.map((t) => (
            <TaskCard key={t._id} task={t} showEvent showAssignee={tab === 'review'} onChange={onChange} />
          ))}
        </div>
      )}
    </div>
  );
}
