import { Link } from 'react-router-dom';
import { ChevronRight, MapPin } from 'lucide-react';
import { GROUP_STYLE, TEAM_BY_ID } from '../constants.js';
import { daysUntil, formatShortMonth, formatTime, relativeDay, dateRange } from '../format.js';
import { TeamChip, TypeBadge } from './ui.jsx';
import { t as tr } from '../i18n.jsx';

export default function EventCard({ event }) {
  const team = TEAM_BY_ID[event.team] || GROUP_STYLE;
  const start = new Date(event.startDate);
  const soon = daysUntil(start) >= 0 && daysUntil(start) <= 2;
  const progress = event.taskCount ? Math.round((event.doneCount / event.taskCount) * 100) : 0;

  return (
    <Link to={`/events/${event._id}`} className="event-card" style={{ '--team': team?.color, '--team-soft': team?.soft }}>
      <div className="date-badge">
        <span className="date-month">{formatShortMonth(start)}</span>
        <span className="date-day">{start.getDate()}</span>
      </div>
      <div className="event-body">
        <div className="event-top">
          <TeamChip team={event.team} size="sm" />
          <TypeBadge event={event} />
          {soon && <span className="soon">{relativeDay(start)}</span>}
        </div>
        <h3 className="event-title">{event.title}</h3>
        <div className="event-meta">
          <span>
            {dateRange(event.startDate, event.endDate)} · {formatTime(start)}
          </span>
          {event.location && (
            <span>
              <MapPin size={13} /> {event.location}
            </span>
          )}
        </div>
        {event.attendanceSummary?.taken && (
          <span className="attend-line">
            {tr('{n}/{total} attended', { n: event.attendanceSummary.present, total: event.attendanceSummary.total })}
          </span>
        )}
        {event.taskCount > 0 && (
          <div className="mini-progress" title={tr('{done} of {total} tasks done', { done: event.doneCount, total: event.taskCount })}>
            <div className="bar">
              <div style={{ width: `${progress}%` }} />
            </div>
            <span>
              {tr('{done}/{total} tasks', { done: event.doneCount, total: event.taskCount })}
            </span>
          </div>
        )}
      </div>
      <ChevronRight className="event-chevron" size={20} />
    </Link>
  );
}
