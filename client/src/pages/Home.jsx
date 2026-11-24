import { Link } from 'react-router-dom';
import { CalendarDays, CircleAlert, CircleCheck, ListChecks, Sparkles } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { useApi } from '../hooks.js';
import { ROLE_LABEL, TEAM_BY_ID, teamName } from '../constants.js';
import { t as tr } from '../i18n.jsx';
import { firstName, greeting } from '../format.js';
import EventCard from '../components/EventCard.jsx';
import TaskCard from '../components/TaskCard.jsx';
import { EmptyState, ErrorBox, Spinner, TeamChip, VerseCard } from '../components/ui.jsx';

function Stat({ icon: Icon, value, label, tone }) {
  return (
    <div className={`stat stat-${tone}`}>
      <span className="stat-icon">
        <Icon size={18} />
      </span>
      <span className="stat-value">{value ?? '–'}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const stats = useApi('/stats/me');
  const tasks = useApi('/tasks/mine?status=open');
  const events = useApi('/events?when=upcoming&limit=4');

  const s = stats.data;
  const openTasks = tasks.data?.tasks || [];
  const myTeams = user.permissions.teams || [user.team];
  const scope = user.permissions.viewAllTeams ? tr('All teams') : myTeams.map(teamName).join(' · ');

  const updateTask = (t) =>
    tasks.setData((d) => ({ tasks: t.status === 'done' ? d.tasks.filter((x) => x._id !== t._id) : d.tasks.map((x) => (x._id === t._id ? t : x)) }));

  return (
    <div className="page home">
      <section className="hero">
        <img src="/group.jpg" alt="" className="hero-img" />
        <div className="hero-content">
          <p className="eyebrow">{greeting()}</p>
          <h1>{firstName(user.name)}</h1>
          <div className="hero-tags">
            <span className="hero-tag">{ROLE_LABEL[user.role]}</span>
            {user.team && (
              <span className="hero-tag" style={{ '--team': TEAM_BY_ID[user.team]?.color }}>
                <span className="team-dot" /> {teamName(user.team)}
              </span>
            )}
          </div>
          <p className="hero-motto">{tr('One team · Light of the World')}</p>
        </div>
      </section>

      <section className="stats">
        <Stat icon={ListChecks} value={s && s.tasks.todo + s.tasks.inProgress} label={tr('Open tasks')} tone="navy" />
        <Stat icon={CircleCheck} value={s?.tasks.done} label={tr('Done')} tone="green" />
        <Stat icon={CircleAlert} value={s?.tasks.overdue} label={tr('Overdue')} tone="red" />
        <Stat icon={CalendarDays} value={s?.upcomingEvents} label={tr('Upcoming events')} tone="yellow" />
      </section>

      <div className="home-grid">
        <section>
          <div className="section-head">
            <h2>{tr('Your tasks')}</h2>
            <Link to="/tasks" className="link">
              {tr('See all')}
            </Link>
          </div>
          {tasks.loading && !tasks.data ? (
            <Spinner />
          ) : tasks.error ? (
            <ErrorBox message={tasks.error} onRetry={tasks.reload} />
          ) : openTasks.length === 0 ? (
            <EmptyState icon={Sparkles} title={tr("You're all caught up")} text={tr('No open tasks right now.')} />
          ) : (
            <div className="stack">
              {openTasks.slice(0, 3).map((t) => (
                <TaskCard key={t._id} task={t} showEvent onChange={updateTask} />
              ))}
            </div>
          )}
        </section>

        <section>
          <div className="section-head">
            <h2>{tr('Upcoming events')}</h2>
            <span className="section-scope">
              {myTeams.length > 1 ? scope : <TeamChip team={user.team} size="sm" />}
            </span>
          </div>
          {events.loading && !events.data ? (
            <Spinner />
          ) : events.error ? (
            <ErrorBox message={events.error} onRetry={events.reload} />
          ) : events.data.events.length === 0 ? (
            <EmptyState icon={CalendarDays} title={tr('No upcoming events')} text={tr('Create one from the Events page.')} />
          ) : (
            <div className="stack">
              {events.data.events.map((e) => (
                <EventCard key={e._id} event={e} />
              ))}
              <Link to="/events" className="btn btn-ghost btn-block">
                {tr('All events')}
              </Link>
            </div>
          )}
        </section>
      </div>

      <VerseCard />
    </div>
  );
}
