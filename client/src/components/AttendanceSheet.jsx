import { useEffect, useMemo, useState } from 'react';
import { CheckCheck, Lock } from 'lucide-react';
import { api } from '../api.js';
import { ATTENDANCE_STATUSES } from '../constants.js';
import { formatDay, formatTime } from '../format.js';
import { Avatar, ErrorBox, Modal, Spinner, TeamChip } from './ui.jsx';

/**
 * The attendance sheet of an event, one section per team.
 * Only the Database/Attendance member assigned to a team can fill in that team's section;
 * everyone else sees it read-only.
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
        const mine = data.sections.find((s) => s.canRecord);
        setMarks(Object.fromEntries((mine?.rows || []).filter((r) => r.status).map((r) => [r.user._id, r.status])));
      })
      .catch((err) => setError(err.message));
  }, [event._id]);

  const mySection = sheet?.sections.find((s) => s.canRecord);

  const counts = useMemo(() => {
    const c = { present: 0, absent: 0, excused: 0, unmarked: 0 };
    for (const r of mySection?.rows || []) c[marks[r.user._id] || 'unmarked'] += 1;
    return c;
  }, [mySection, marks]);

  const mark = (userId, status) => setMarks((m) => ({ ...m, [userId]: status }));
  const markRest = (status) =>
    setMarks((m) => {
      const next = { ...m };
      for (const r of mySection.rows) if (!next[r.user._id]) next[r.user._id] = status;
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
      title="Attendance"
      onClose={onClose}
      footer={
        mySection ? (
          <>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={save} disabled={busy || !mySection.rows.length}>
              {busy ? 'Saving…' : `Save ${mySection.team} attendance`}
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

      {sheet && !mySection && (
        <p className="field-hint attend-note">
          <Lock size={14} /> Each team's attendance is taken by its Database/Attendance member. You can view it here.
        </p>
      )}

      {sections.map((section) => (
        <section key={section.team} className={`attend-group ${section.canRecord ? 'is-mine' : ''}`}>
          <h3 className="attend-team">
            <TeamChip team={section.team} size="sm" />
            <span>
              {section.rows.length} {section.rows.length === 1 ? 'member' : 'members'}
              {section.canRecord && ' · your team'}
            </span>
            <span className={`attend-state ${section.taken ? 'done' : ''}`}>
              {section.taken ? `Taken ${formatDay(section.takenAt)}, ${formatTime(section.takenAt)}${section.takenBy ? ` by ${section.takenBy.name}` : ''}` : 'Not taken yet'}
            </span>
          </h3>

          {section.canRecord && (
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
              {counts.unmarked > 0 && (
                <div className="attend-tools">
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => markRest('present')}>
                    <CheckCheck size={16} /> Mark the rest present
                  </button>
                  <span className="field-hint">Anyone not marked is saved as absent.</span>
                </div>
              )}
              {!section.taken && <p className="field-hint">The list comes from current team membership and is fixed when you first save.</p>}
            </>
          )}

          {section.rows.length === 0 ? (
            <p className="field-hint">No active members belong to this team.</p>
          ) : !section.canRecord && !section.taken ? null : (
            <div className="attend-list">
              {section.rows.map((r) => {
                const status = section.canRecord ? marks[r.user._id] : r.status;
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
