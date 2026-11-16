import { Router } from 'express';
import { Task } from '../models/Task.js';
import { Event } from '../models/Event.js';
import { asyncHandler } from '../utils/httpError.js';
import { visibleTeams } from '../utils/access.js';
import { TEAMS } from '../constants.js';

const router = Router();

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
      Event.countDocuments({ team: { $in: visibleTeams(req.user, TEAMS) }, startDate: { $gte: startOfToday } }),
    ]);

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
    });
  })
);

export default router;
