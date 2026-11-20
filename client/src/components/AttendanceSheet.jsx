import { useEffect, useMemo, useState } from 'react';
import { CheckCheck } from 'lucide-react';
import { api } from '../api.js';
import { ATTENDANCE_STATUSES, TEAMS } from '../constants.js';
import { formatDay, formatTime } from '../format.js';
import { Avatar, EmptyState, ErrorBox, Modal, Spinner, TeamChip } from './ui.jsx';

/**
 * The attendance sheet of an event, grouped by team.
 * Before the first save it lists current team members; after that, the saved list.
 */
export default function AttendanceSheet({ event, onClose, onSaved }) {
  const [sheet, setSheet] = useState(null);
  const [marks, setMarks] = useState({}); // userId -> status
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get(`/events/${event._id}/attendance`)
      .then((data) => {
        setSheet(data);
        setMarks(Object.fromEntries(data.rows.filter((r) => r.status).map((r) => [r.user._id, r.status])));
      })
      .catch((err) => setError(err.message));
  }, [event._id]);

  const groups = useMemo(() => {
    if (!sheet) return [];
    return TEAMS.map((t) => ({ team: t.id, rows: sheet.rows.filter((r) => r.team === t.id) })).filter((g) => g.rows.length);
  }, [sheet]);

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, excused: 0, unmarked: 0 };
    for (const r of sheet?.rows || []) c[marks[r.user._id] || 'unmarked'] += 1;
    return c;
  }, [sheet, marks]);

  const canRecord = sheet?.canRecord;
  const mark = (userId, status) => canRecord && setMarks((m) => ({ ...m, [userId]: status }));
  const markRest = (status) =>
    setMarks((m) => {
      const next = { ...m };
      for (const r of sheet.rows) if (!next[r.user._id]) next[r.user._id] = status;
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

  const multiTeam = groups.length > 1;

  return (
    <Modal
      title="Attendance"
      onClose={onClose}
      footer={
        canRecord ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={save} disabled={busy || !sheet?.rows.length}>
              {busy ? 'Saving…' : 'Save attendance'}
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        )
      }
    >
      <p className="form-context">
        <strong>{event.title}</strong> · {formatDay(event.startDate)}
      </p>

      {error && <ErrorBox message={error} />}
      {!sheet && !error && <Spinner />}

      {sheet && (
        <>
          <div className="attend-counts">
            <span className="ac ac-present">
              <b>{counts.present}</b> Present
            </span>
            <span className="ac ac-absent">
              <b>{counts.absent}</b> Absent
            </span>
            <span className="ac ac-excused">
              <b>{counts.excused}</b> Excused
            </span>
            {counts.unmarked > 0 && (
              <span className="ac">
                <b>{counts.unmarked}</b> Not marked
              </span>
            )}
          </div>

          {canRecord && counts.unmarked > 0 && (
            <div className="attend-tools">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => markRest('present')}>
                <CheckCheck size={16} /> Mark the rest present
              </button>
              <span className="field-hint">Anyone not marked is saved as absent.</span>
            </div>
          )}

          {sheet.taken ? (
            <p className="field-hint">
              List fixed when attendance was first taken. Last saved {formatDay(sheet.takenAt)}, {formatTime(sheet.takenAt)}
              {sheet.takenBy ? ` by ${sheet.takenBy.name}` : ''}.
            </p>
          ) : (
            <p className="field-hint">The list comes from current team membership and is fixed when you first save.</p>
          )}

          {sheet.rows.length === 0 ? (
            <EmptyState title="No members to list" text="No active members belong to this team yet." />
          ) : (
            groups.map((g) => (
              <section key={g.team} className="attend-group">
                {multiTeam && (
                  <h3 className="attend-team">
                    <TeamChip team={g.team} size="sm" />
                    <span>{g.rows.length} members</span>
                  </h3>
                )}
                <div className="attend-list">
                  {g.rows.map((r) => {
                    const status = marks[r.user._id];
                    return (
                      <div key={r.user._id} className={`attend-row ${status ? `is-${status}` : ''}`}>
                        <Avatar name={r.user.name} team={r.team} size={34} />
                        <span className="attend-name">{r.user.name}</span>
                        <div className="attend-marks" role="group" aria-label={`Attendance of ${r.user.name}`}>
                          {ATTENDANCE_STATUSES.map((s) => (
                            <button
                              type="button"
                              key={s.id}
                              className={`mark mark-${s.id} ${status === s.id ? 'active' : ''}`}
                              onClick={() => mark(r.user._id, s.id)}
                              disabled={!canRecord}
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
              </section>
            ))
          )}
        </>
      )}
    </Modal>
  );
}
