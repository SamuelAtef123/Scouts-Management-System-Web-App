import { Router } from 'express';
import mongoose from 'mongoose';
import { Event } from '../models/Event.js';
import { Task } from '../models/Task.js';
import { User } from '../models/User.js';
import { asyncHandler, badRequest, forbidden, notFound } from '../utils/httpError.js';
import { canManageTeam, canRecordAttendance, canSeeEvent, hasGlobalAccess, visibleTeams } from '../utils/access.js';
import { ATTENDANCE_EVENT_TYPES, ATTENDANCE_STATUSES, EVENT_TYPES, GROUP_EVENT_TYPES, TEAMS } from '../constants.js';

const router = Router();

function parseDate(value, label, { required }) {
  if (value === undefined || value === null || value === '') {
    if (required) throw badRequest(`${label} is required`);
    return undefined;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw badRequest(`${label} is not a valid date`);
  return date;
}

function readEventFields(body, { partial }) {
  const out = {};
  if (!partial || body.title !== undefined) {
    out.title = String(body.title || '').trim();
    if (!out.title) throw badRequest('Event title is required');
  }
  if (body.description !== undefined) out.description = String(body.description || '').trim();
  if (body.location !== undefined) out.location = String(body.location || '').trim();
  if (!partial || body.type !== undefined) {
    if (!EVENT_TYPES.includes(body.type)) throw badRequest('Choose the type of event');
    out.type = body.type;
  }
  if (!partial || body.team !== undefined) {
    out.team = body.team || null;
    if (out.team && !TEAMS.includes(out.team)) throw badRequest('Choose a valid team');
  }
  if (!partial || body.startDate !== undefined) out.startDate = parseDate(body.startDate, 'Start date', { required: true });
  if (body.endDate !== undefined) out.endDate = parseDate(body.endDate, 'End date', { required: false }) ?? null;
  return out;
}

/** Checks that `user` may give an event this type and team. */
function checkTypeAndTeam(user, type, team) {
  if (GROUP_EVENT_TYPES.includes(type)) {
    if (!hasGlobalAccess(user)) throw forbidden('Only group leaders can create Preparation Meetings and Gawala Sessions');
    return null;
  }
  if (type === 'team_session' && !team) throw badRequest('Choose the team this session is for');
  if (!canManageTeam(user, team)) {
    throw forbidden(team ? 'You can only manage events of your own team' : 'Only group leaders can create whole-group events');
  }
  return team;
}

/** Loads an event and checks the user may see it (and optionally manage it). */
export async function loadEvent(id, user, { manage = false } = {}) {
  if (!mongoose.isValidObjectId(id)) throw notFound('Event not found');
  const event = await Event.findById(id);
  if (!event) throw notFound('Event not found');
  if (!canSeeEvent(user, event)) throw notFound('Event not found');
  if (manage && !canManageTeam(user, event.team)) {
    throw forbidden(event.team ? 'You can only manage events of your own team' : 'Only group leaders can manage whole-group events');
  }
  return event;
}

function attendanceSummary(event) {
  if (!ATTENDANCE_EVENT_TYPES.includes(event.type)) return null;
  const counts = { present: 0, absent: 0, excused: 0 };
  for (const a of event.attendance || []) counts[a.status] += 1;
  return { taken: Boolean(event.attendanceTakenAt), total: event.attendance?.length || 0, ...counts };
}

/** Lean event as the client sees it: no raw attendance list, just its summary. */
function eventForClient(event) {
  const e = typeof event.toObject === 'function' ? event.toObject() : { ...event };
  e.attendanceSummary = attendanceSummary(e);
  delete e.attendance;
  return e;
}

// GET /api/events?when=upcoming|past|all&team=Ashbal|group
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const allowed = visibleTeams(req.user, TEAMS);
    const team = req.query.team ? String(req.query.team) : null;

    const filter = {};
    if (team === 'group') filter.team = null;
    else if (team) {
      if (!allowed.includes(team)) throw forbidden('You can only view events of your own team');
      filter.team = team;
    } else if (!hasGlobalAccess(req.user)) {
      // Own team's events plus whole-group events.
      filter.team = { $in: [...allowed, null] };
    }

    // An event counts as upcoming until the end of its last day.
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const when = req.query.when || 'upcoming';
    let sort = { startDate: 1 };
    if (when === 'upcoming') {
      filter.$or = [{ startDate: { $gte: startOfToday } }, { endDate: { $gte: startOfToday } }];
    } else if (when === 'past') {
      filter.startDate = { $lt: startOfToday };
      filter.$or = [{ endDate: null }, { endDate: { $lt: startOfToday } }];
      sort = { startDate: -1 };
    }

    const limit = Math.min(Number(req.query.limit) || 100, 200);
    const events = await Event.find(filter).sort(sort).limit(limit).populate('createdBy', 'name').lean();

    // Task progress for each event card.
    const counts = await Task.aggregate([
      { $match: { event: { $in: events.map((e) => e._id) } } },
      { $group: { _id: '$event', total: { $sum: 1 }, done: { $sum: { $cond: [{ $eq: ['$status', 'done'] }, 1, 0] } } } },
    ]);
    const byEvent = new Map(counts.map((c) => [c._id.toString(), c]));
    const out = events.map((e) => {
      const c = byEvent.get(e._id.toString());
      return { ...eventForClient(e), taskCount: c?.total ?? 0, doneCount: c?.done ?? 0 };
    });

    res.json({ events: out });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const event = await loadEvent(req.params.id, req.user);
    await event.populate('createdBy', 'name');
    const tasks = await Task.find({ event: event._id })
      .sort({ createdAt: 1 })
      .populate('assignee', 'name username team')
      .populate('createdBy', 'name')
      .populate('materials.uploadedBy', 'name');
    res.json({
      event: { ...eventForClient(event), canRecordAttendance: canRecordAttendance(req.user, event) },
      tasks,
    });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const fields = readEventFields(req.body, { partial: false });
    fields.team = checkTypeAndTeam(req.user, fields.type, fields.team);
    const event = await Event.create({ ...fields, createdBy: req.user._id });
    res.status(201).json({ event: eventForClient(event) });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const event = await loadEvent(req.params.id, req.user, { manage: true });
    const fields = readEventFields(req.body, { partial: true });
    const type = fields.type ?? event.type;
    const team = fields.team !== undefined ? fields.team : event.team;

    if (event.attendanceTakenAt && (type !== event.type || (team || null) !== (event.team || null))) {
      throw badRequest('Attendance was already taken for this event, so its type and team cannot change');
    }
    fields.team = checkTypeAndTeam(req.user, type, team);

    const teamChanged = fields.team !== event.team;
    Object.assign(event, fields);
    await event.save();
    if (teamChanged) await Task.updateMany({ event: event._id }, { team: event.team });
    res.json({ event: { ...eventForClient(event), canRecordAttendance: canRecordAttendance(req.user, event) } });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const event = await loadEvent(req.params.id, req.user, { manage: true });
    // Uploaded materials stay in Google Drive as an archive; only the records are removed.
    await Task.deleteMany({ event: event._id });
    await event.deleteOne();
    res.json({ ok: true });
  })
);

// ---------- Attendance ----------

/**
 * Who is on the sheet before attendance is first recorded:
 * a Team Session lists its team's members; Preparation Meetings and
 * Gawala Sessions list members of ALL teams. Inactive members are left out.
 */
async function currentMembers(event) {
  const filter = { isActive: true, team: event.type === 'team_session' ? event.team : { $in: TEAMS } };
  return User.find(filter).select('name username team role').sort({ name: 1 }).lean();
}

const teamOrder = (team) => TEAMS.indexOf(team);

async function attendanceSheet(event) {
  let rows;
  if (event.attendanceTakenAt) {
    await event.populate('attendance.user', 'name username team role');
    rows = event.attendance
      .filter((a) => a.user) // a member whose account was removed from the database
      .map((a) => ({ user: a.user.toJSON(), team: a.team, status: a.status }));
    await event.populate('attendanceTakenBy', 'name');
  } else {
    rows = (await currentMembers(event)).map((u) => ({ user: u, team: u.team, status: null }));
  }
  rows.sort((a, b) => teamOrder(a.team) - teamOrder(b.team) || a.user.name.localeCompare(b.user.name));
  return {
    taken: Boolean(event.attendanceTakenAt),
    takenAt: event.attendanceTakenAt,
    takenBy: event.attendanceTakenBy?.name ? { name: event.attendanceTakenBy.name } : null,
    rows,
  };
}

router.get(
  '/:id/attendance',
  asyncHandler(async (req, res) => {
    const event = await loadEvent(req.params.id, req.user);
    if (!ATTENDANCE_EVENT_TYPES.includes(event.type)) throw badRequest('Attendance is not taken for this type of event');
    res.json({ ...(await attendanceSheet(event)), canRecord: canRecordAttendance(req.user, event) });
  })
);

// PUT /api/events/:id/attendance  { records: [{ user, status }] }
// Members left unmarked are saved as absent.
router.put(
  '/:id/attendance',
  asyncHandler(async (req, res) => {
    const event = await loadEvent(req.params.id, req.user);
    if (!ATTENDANCE_EVENT_TYPES.includes(event.type)) throw badRequest('Attendance is not taken for this type of event');
    if (!canRecordAttendance(req.user, event)) throw forbidden('You cannot record attendance for this event');

    const records = Array.isArray(req.body.records) ? req.body.records : [];
    const statusByUser = new Map();
    for (const r of records) {
      if (!ATTENDANCE_STATUSES.includes(r?.status)) throw badRequest('Each member must be present, absent or excused');
      statusByUser.set(String(r.user), r.status);
    }

    if (!event.attendanceTakenAt) {
      // First time: the sheet's member list is fixed from team membership right now.
      const members = await currentMembers(event);
      event.attendance = members.map((u) => ({
        user: u._id,
        team: u.team,
        status: statusByUser.get(u._id.toString()) || 'absent',
      }));
      event.attendanceTakenAt = new Date();
    } else {
      for (const a of event.attendance) {
        const status = statusByUser.get(a.user.toString());
        if (status) a.status = status;
      }
    }
    event.attendanceTakenBy = req.user._id;
    await event.save();

    res.json({ ...(await attendanceSheet(event)), canRecord: true, summary: attendanceSummary(event) });
  })
);

export default router;
