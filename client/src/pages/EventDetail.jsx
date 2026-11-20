import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Check, ChevronLeft, ClipboardCheck, Clock, ListChecks, MapPin, Pencil, Plus, Trash2, UserRound } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { useApi } from '../hooks.js';
import { GROUP_STYLE, TEAM_BY_ID, eventType } from '../constants.js';
import { formatFullDate, formatTime, relativeDay } from '../format.js';
import EventForm from '../components/EventForm.jsx';
import TaskForm from '../components/TaskForm.jsx';
import TaskCard from '../components/TaskCard.jsx';
import AttendanceSheet from '../components/AttendanceSheet.jsx';
import { ConfirmDialog, EmptyState, ErrorBox, Spinner, TeamChip, TypeBadge, useToast } from '../components/ui.jsx';

export default function EventDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const { data, error, loading, reload, setData } = useApi(`/events/${id}`);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [taskForm, setTaskForm] = useState(null); // {} for new, task for edit
  const [attendanceOpen, setAttendanceOpen] = useState(false);

  if (loading && !data) return <div className="page"><Spinner /></div>;
  if (error) {
    return (
      <div className="page">
        <Link to="/events" className="back-link">
          <ChevronLeft size={18} /> Events
        </Link>
        <ErrorBox message={error} onRetry={reload} />
      </div>
    );
  }

  const { event, tasks } = data;
  const team = TEAM_BY_ID[event.team] || GROUP_STYLE;
  const type = eventType(event);
  const attendance = event.attendanceSummary;
  // Has the current user (a Database/Attendance member) already taken their team's part?
  const myPartDone = Boolean(attendance?.teamsTaken?.includes(user.permissions.attendanceTeam));
  const canManage = user.permissions.allTeams || (Boolean(event.team) && user.team === event.team);
  const done = tasks.filter((t) => t.status === 'done').length;
  const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  const upsertTask = (task) =>
    setData((d) => ({
      ...d,
      tasks: d.tasks.some((t) => t._id === task._id) ? d.tasks.map((t) => (t._id === task._id ? task : t)) : [...d.tasks, task],
    }));
  const removeTask = (task) => setData((d) => ({ ...d, tasks: d.tasks.filter((t) => t._id !== task._id) }));

  return (
    <div className="page">
      <Link to="/events" className="back-link">
        <ChevronLeft size={18} /> Events
      </Link>

      <section className="event-hero" style={{ '--team': team.color, '--team-soft': team.soft }}>
        <div className="event-hero-top">
          <TeamChip team={event.team} />
          <TypeBadge event={event} />
          <span className="soon">{relativeDay(event.startDate)}</span>
        </div>
        <h1>{event.title}</h1>
        <ul className="event-facts">
          <li>
            <Clock size={17} />
            <span>
              {formatFullDate(event.startDate)} · {formatTime(event.startDate)}
              {event.endDate && (
                <>
                  <br />
                  until {formatFullDate(event.endDate)} · {formatTime(event.endDate)}
                </>
              )}
            </span>
          </li>
          {event.location && (
            <li>
              <MapPin size={17} />
              <span>{event.location}</span>
            </li>
          )}
          <li>
            <UserRound size={17} />
            <span>Created by {event.createdBy?.name}</span>
          </li>
        </ul>
        {event.description && <p className="event-desc">{event.description}</p>}
        {canManage && (
          <div className="event-hero-actions">
            <button className="btn btn-light" onClick={() => setEditing(true)}>
              <Pencil size={16} /> Edit
            </button>
            <button className="btn btn-light btn-light-danger" onClick={() => setDeleting(true)}>
              <Trash2 size={16} /> Delete
            </button>
          </div>
        )}
      </section>

      {type.attendance && (
        <section className="card attend-card">
          <div className="attend-card-head">
            <span className="attend-icon">
              <ClipboardCheck size={20} />
            </span>
            <div>
              <h2>Attendance</h2>
              <p className="muted">
                {type.group ? 'Members of all teams' : `Members of the ${event.team} team`}
              </p>
            </div>
            {(event.canRecordAttendance || attendance?.taken) && (
              <button className={`btn btn-sm ${myPartDone || !event.canRecordAttendance ? 'btn-ghost' : 'btn-primary'}`} onClick={() => setAttendanceOpen(true)}>
                {event.canRecordAttendance ? (myPartDone ? 'Edit' : 'Take attendance') : 'View'}
              </button>
            )}
          </div>
          {type.group && attendance && (
            <div className="teams-taken">
              {attendance.teamsExpected.map((t) => (
                <span key={t} className={`team-taken ${attendance.teamsTaken.includes(t) ? 'done' : ''}`}>
                  {attendance.teamsTaken.includes(t) ? <Check size={13} /> : <span className="pending-dot" />}
                  {t}
                </span>
              ))}
            </div>
          )}
          {attendance?.taken ? (
            <div className="attend-summary">
              <div className="attend-bar" aria-hidden="true">
                <span className="seg-present" style={{ flex: attendance.present }} />
                <span className="seg-excused" style={{ flex: attendance.excused }} />
                <span className="seg-absent" style={{ flex: attendance.absent }} />
              </div>
              <div className="attend-counts">
                <span className="ac ac-present"><b>{attendance.present}</b> Present</span>
                <span className="ac ac-absent"><b>{attendance.absent}</b> Absent</span>
                <span className="ac ac-excused"><b>{attendance.excused}</b> Excused</span>
              </div>
            </div>
          ) : (
            <p className="muted attend-empty">Not taken yet.</p>
          )}
        </section>
      )}

      <div className="section-head">
        <h2>Tasks</h2>
        {canManage && (
          <button className="btn btn-primary btn-sm" onClick={() => setTaskForm({})}>
            <Plus size={16} /> Add task
          </button>
        )}
      </div>

      {tasks.length > 0 && (
        <div className="progress-line">
          <div className="bar">
            <div style={{ width: `${progress}%` }} />
          </div>
          <span>
            {done} of {tasks.length} done
          </span>
        </div>
      )}

      {tasks.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No tasks yet"
          text={canManage ? 'Split the work: add tasks and assign them to leaders.' : 'Tasks for this event will appear here.'}
          action={
            canManage && (
              <button className="btn btn-primary" onClick={() => setTaskForm({})}>
                <Plus size={18} /> Add the first task
              </button>
            )
          }
        />
      ) : (
        <div className="stack">
          {tasks.map((t) => (
            <TaskCard key={t._id} task={t} onChange={upsertTask} onEdit={(task) => setTaskForm(task)} onDelete={removeTask} />
          ))}
        </div>
      )}

      {editing && (
        <EventForm
          event={event}
          onClose={() => setEditing(false)}
          onSaved={(updated) => {
            setData((d) => ({ ...d, event: { ...updated, createdBy: d.event.createdBy } }));
            setEditing(false);
            toast('Event updated');
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete this event?"
          text={`"${event.title}" and its ${tasks.length} task(s) will be deleted. Files already uploaded stay in Google Drive.`}
          onConfirm={async () => {
            await api.del(`/events/${event._id}`);
            toast('Event deleted');
            navigate('/events', { replace: true });
          }}
          onClose={() => setDeleting(false)}
        />
      )}
      {attendanceOpen && (
        <AttendanceSheet
          event={event}
          onClose={() => setAttendanceOpen(false)}
          onSaved={(summary) => {
            setData((d) => ({ ...d, event: { ...d.event, attendanceSummary: summary } }));
            setAttendanceOpen(false);
            toast('Attendance saved');
          }}
        />
      )}
      {taskForm && (
        <TaskForm
          event={event}
          task={taskForm._id ? taskForm : undefined}
          onClose={() => setTaskForm(null)}
          onSaved={(task) => {
            upsertTask(task);
            toast(taskForm._id ? 'Task updated' : 'Task created and assigned');
            setTaskForm(null);
          }}
        />
      )}
    </div>
  );
}
