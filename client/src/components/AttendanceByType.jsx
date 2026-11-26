import { t as tr } from '../i18n.jsx';
import { EVENT_TYPES } from '../constants.js';

/**
 * Attendance rate for each event type that has attendance (Kadr Session, Preparation Meeting,
 * Gawala Session). Rate = present ÷ (present + absent); excused sessions are not counted.
 */
export default function AttendanceByType({ byType = {} }) {
  return (
    <div className="attend-types">
      {EVENT_TYPES.filter((t) => t.attendance).map((t) => {
        const c = byType[t.id] || { present: 0, absent: 0 };
        const total = c.present + c.absent;
        const rate = total ? Math.round((c.present / total) * 100) : null;
        const tone = rate === null ? 'none' : rate >= 75 ? 'good' : rate >= 50 ? 'mid' : 'low';
        return (
          <div key={t.id} className={`attend-type tone-${tone}`}>
            <span className="attend-type-name">{t.label}</span>
            <b className="attend-type-rate">{rate === null ? '–' : `${rate}%`}</b>
            <i className="attend-type-bar" aria-hidden="true">
              <span style={{ width: `${rate ?? 0}%` }} />
            </i>
            <small className="attend-type-count">
              {total ? tr('{n} of {total} attended', { n: c.present, total }) : tr('No sessions yet')}
            </small>
          </div>
        );
      })}
    </div>
  );
}
