import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CalendarDays, CalendarPlus, Plus } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { useApi } from '../hooks.js';
import { TEAMS } from '../constants.js';
import { formatMonth } from '../format.js';
import EventCard from '../components/EventCard.jsx';
import EventForm from '../components/EventForm.jsx';
import { EmptyState, ErrorBox, Spinner, useToast } from '../components/ui.jsx';

export default function Events() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const when = params.get('when') === 'past' ? 'past' : 'upcoming';
  const team = params.get('team') || '';
  const [creating, setCreating] = useState(false);
  // Teams whose events this user sees (a Database/Attendance member also sees the team they take attendance for).
  const myTeams = user.permissions.teams || [user.team];
  const filterTeams = TEAMS.filter((t) => myTeams.includes(t.id));

  const query = `/events?when=${when}${team ? `&team=${team}` : ''}`;
  const { data, error, loading, reload } = useApi(query);

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  // Group events by month for easier scanning.
  const groups = useMemo(() => {
    const map = new Map();
    for (const e of data?.events || []) {
      const key = formatMonth(e.startDate);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    }
    return [...map.entries()];
  }, [data]);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Events</h1>
          <p className="muted">{user.permissions.viewAllTeams ? 'All teams of the group' : `${myTeams.join(' and ')} ${myTeams.length > 1 ? 'teams' : 'team'}, and whole-group events`}</p>
        </div>
        <button className="btn btn-primary desktop-only" onClick={() => setCreating(true)}>
          <Plus size={18} /> New event
        </button>
      </header>

      <div className="segmented segmented-lg" role="tablist">
        {['upcoming', 'past'].map((w) => (
          <button key={w} role="tab" aria-selected={when === w} className={`seg ${when === w ? 'active' : ''}`} onClick={() => setParam('when', w === 'upcoming' ? '' : w)}>
            {w === 'upcoming' ? 'Upcoming' : 'Past'}
          </button>
        ))}
      </div>

      {filterTeams.length > 1 && (
        <div className="chips" role="group" aria-label="Filter by team">
          <button className={`chip ${!team ? 'active' : ''}`} onClick={() => setParam('team', '')}>
            {user.permissions.viewAllTeams ? 'All teams' : 'All'}
          </button>
          <button
            className={`chip ${team === 'group' ? 'active' : ''}`}
            style={{ '--team': '#23277d', '--team-soft': '#e7e8f8' }}
            onClick={() => setParam('team', 'group')}
          >
            <span className="team-dot group-dot" />
            Whole group
          </button>
          {filterTeams.map((t) => (
            <button
              key={t.id}
              className={`chip ${team === t.id ? 'active' : ''}`}
              style={{ '--team': t.color, '--team-soft': t.soft }}
              onClick={() => setParam('team', t.id)}
            >
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
      ) : groups.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={when === 'past' ? 'No past events' : 'No upcoming events'}
          text={when === 'past' ? 'Events appear here after they end.' : 'Plan the next activity for your team.'}
          action={
            when === 'upcoming' && (
              <button className="btn btn-primary" onClick={() => setCreating(true)}>
                <CalendarPlus size={18} /> Create an event
              </button>
            )
          }
        />
      ) : (
        groups.map(([month, events]) => (
          <section key={month} className="month-group">
            <h2 className="month-title">{month}</h2>
            <div className="stack">
              {events.map((e) => (
                <EventCard key={e._id} event={e} />
              ))}
            </div>
          </section>
        ))
      )}

      <button className="fab" onClick={() => setCreating(true)} aria-label="New event">
        <Plus size={26} />
      </button>

      {creating && (
        <EventForm
          defaultTeam={team || undefined}
          onClose={() => setCreating(false)}
          onSaved={(event) => {
            toast('Event created');
            navigate(`/events/${event._id}`);
          }}
        />
      )}
    </div>
  );
}
