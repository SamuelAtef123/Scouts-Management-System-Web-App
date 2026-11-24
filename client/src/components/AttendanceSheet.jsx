import { useEffect, useMemo, useState } from 'react';
import { CheckCheck, Lock } from 'lucide-react';
import { api } from '../api.js';
import { ATTENDANCE_STATUSES } from '../constants.js';
import { formatDay, formatTime } from '../format.js';
import { teamName } from '../constants.js';
import { t as tr } from '../i18n.jsx';
import { Avatar, ErrorBox, Modal, Spinner, TeamChip } from './ui.jsx';

/**
 * The attendance sheet of an event, one section per team.
 * Team Session / Preparation Meeting: one section, filled by the Database/Attendance member
 * assigned to that team. Gawala Session: a section per team, all filled by the member
 * assigned to Gawala. Everyone else sees the sheet read-only.
 */
export default function AttendanceSheet({ event, onClose, onSaved }) {
  const [sheet, setSheet] = useState(null);
  const [marks, setMarks] = useState({}); // userId -> status, for the editable section only
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get(`/events/${event._id}/attendance`)
      .then((data) => {
        setSheet(data);
        const rows = data.sections.filter((s) => s.canRecord).flatMap((s) => s.rows);
        setMarks(Object.fromEntries(rows.filter((r) => r.status).map((r) => [r.user._id, r.status])));
      })
      .catch((err) => setError(err.message));
  }, [event._id]);

  const mySections = useMemo(() => (sheet ? sheet.sections.filter((s) => s.canRecord) : []), [sheet]);
  const myRows = useMemo(() => mySections.flatMap((s) => s.rows), [mySections]);
  const canRecord = mySections.length > 0;

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, excused: 0, unmarked: 0 };
    for (const r of myRows) c[marks[r.user._id] || 'unmarked'] += 1;
    return c;
  }, [myRows, marks]);

  const mark = (userId, status) => setMarks((m) => ({ ...m, [userId]: status }));
  const markRest = (status) =>
    setMarks((m) => {
      const next = { ...m };
      for (const r of myRows) if (!next[r.user._id]) next[r.user._id] = status;
      return next;
    });

  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const records = Object.entries(marks).map(([user, status]) => ({ user, status }));
      const data = await api.put(`/events/${event._id}/attendance`, { records });
      onSaved(data.summary);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  // Your own section first, then the others in team order.
  const sections = sheet ? [...sheet.sections].sort((a, b) => Number(b.canRecord) - Number(a.canRecord)) : [];

  return (
    <Modal
      title={tr('Attendance')}
      onClose={onClose}
      footer={
        canRecord ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              {tr('Cancel')}
            </button>
            <button type="button" className="btn btn-primary" onClick={save} disabled={busy || !myRows.length}>
              {busy ? tr('Saving…') : mySections.length === 1 ? tr('Save {team} attendance', { team: teamName(mySections[0].team) }) : tr('Save attendance')}
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {tr('Close')}
          </button>
        )
      }
    >
      <p className="form-context">
        <strong>{event.title}</strong> · {formatDay(event.startDate)}
      </p>

      {error && <ErrorBox message={error} />}
      {!sheet && !error && <Spinner />}

      {sheet && !canRecord && (
        <p className="field-hint attend-note">
          <Lock size={14} />
          {event.type === 'gawala_session'
            ? tr('Gawala Session attendance is taken by the Database/Attendance member assigned to Gawala.')
            : tr("This team's attendance is taken by its Database/Attendance member.")}{' '}
          {tr('You can view it here.')}
        </p>
      )}

      {canRecord && (
        <>
          <div className="attend-counts">
            <span className="ac ac-present">
              <b>{counts.present}</b> {tr('Present')}
            </span>
            <span className="ac ac-absent">
              <b>{counts.absent}</b> {tr('Absent')}
            </span>
            <span className="ac ac-excused">
              <b>{counts.excused}</b> {tr('Excused')}
            </span>
            {counts.unmarked > 0 && (
              <span className="ac">
                <b>{counts.unmarked}</b> {tr('Not marked')}
              </span>
            )}
          </div>
          {counts.unmarked > 0 && (
            <div className="attend-tools">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => markRest('present')}>
                <CheckCheck size={16} /> {tr('Mark the rest present')}
              </button>
              <span className="field-hint">{tr('Anyone not marked is saved as absent.')}</span>
            </div>
          )}
          {mySections.some((s) => !s.taken) && (
            <p className="field-hint">{tr('The list comes from current team membership and is fixed when you first save.')}</p>
          )}
        </>
      )}

      {sections.map((section) => (
        <section key={section.team} className={`attend-group ${section.canRecord && mySections.length === 1 ? 'is-mine' : ''}`}>
          <h3 className="attend-team">
            <TeamChip team={section.team} size="sm" />
            <span>
              {section.rows.length === 1 ? tr('1 member') : tr('{n} members', { n: section.rows.length })}

            </span>
            <span className={`attend-state ${section.taken ? 'done' : ''}`}>
              {section.taken
                ? section.takenBy
                  ? tr('Taken {day}, {time} by {name}', { day: formatDay(section.takenAt), time: formatTime(section.takenAt), name: section.takenBy.name })
                  : tr('Taken {day}, {time}', { day: formatDay(section.takenAt), time: formatTime(section.takenAt) })
                : tr('Not taken yet')}
            </span>
          </h3>

          {section.rows.length === 0 ? (
            <p className="field-hint">{tr('No active members belong to this team.')}</p>
          ) : !section.canRecord && !section.taken ? null : (
            <div className="attend-list">
              {section.rows.map((r) => {
                const status = section.canRecord ? marks[r.user._id] : r.status;
                return (
                  <div key={r.user._id} className={`attend-row ${status ? `is-${status}` : ''}`}>
                    <Avatar person={r.user} team={r.team} size={34} />
                    <span className="attend-name">{r.user.name}</span>
                    <div className="attend-marks" role="group" aria-label={tr('Attendance of {name}', { name: r.user.name })}>
                      {ATTENDANCE_STATUSES.map((s) => (
                        <button
                          type="button"
                          key={s.id}
                          className={`mark mark-${s.id} ${status === s.id ? 'active' : ''}`}
                          onClick={() => mark(r.user._id, s.id)}
                          disabled={!section.canRecord}
                          aria-pressed={status === s.id}
                          title={s.label}
                        >
                          {s.short}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ))}
    </Modal>
  );
}
