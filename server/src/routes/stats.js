import { Router } from 'express';
import { Task } from '../models/Task.js';
import { Event } from '../models/Event.js';
import { asyncHandler } from '../utils/httpError.js';
import { visibleTeams } from '../utils/access.js';
import { TEAMS } from '../constants.js';

const router = Router();

/**
 * A member's attendance across every sheet they are on.
 * Rate = present / (present + absent); excused sessions are not counted against them.
 */
export async function attendanceStats(userId) {
  const rows = await Event.aggregate([
    { $match: { 'attendance.user': userId } },
    { $unwind: '$attendance' },
    { $match: { 'attendance.user': userId } },
    { $group: { _id: { type: '$type', status: '$attendance.status' }, n: { $sum: 1 } } },
  ]);
  const empty = () => ({ present: 0, absent: 0, excused: 0 });
  const total = empty();
  const byType = {};
  for (const r of rows) {
    total[r._id.status] += r.n;
    byType[r._id.type] ??= empty();
    byType[r._id.type][r._id.status] += r.n;
  }
  const counted = total.present + total.absent;
  return { ...total, sessions: counted + total.excused, rate: counted ? Math.round((total.present / counted) * 100) : null, byType };
}

// Small personal summary for the home screen. Full KPIs come later.
router.get(
  '/me',
  asyncHandler(async (req, res) => {
    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const [byStatus, overdue, upcomingEvents] = await Promise.all([
      Task.aggregate([{ $match: { assignee: req.user._id } }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
      Task.countDocuments({ assignee: req.user._id, status: { $ne: 'done' }, dueDate: { $lt: startOfToday } }),
      Event.countDocuments({ team: { $in: [...visibleTeams(req.user, TEAMS), null] }, startDate: { $gte: startOfToday } }),
    ]);
    const attendance = await attendanceStats(req.user._id);

    const counts = Object.fromEntries(byStatus.map((s) => [s._id, s.n]));
    const total = byStatus.reduce((sum, s) => sum + s.n, 0);
    res.json({
      tasks: {
        total,
        todo: counts.todo || 0,
        inProgress: counts.in_progress || 0,
        done: counts.done || 0,
        overdue,
      },
      upcomingEvents,
      attendance,
    });
  })
);

export default router;
