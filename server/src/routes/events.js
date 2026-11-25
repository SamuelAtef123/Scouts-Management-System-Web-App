import { Router } from 'express';
import mongoose from 'mongoose';
import { Event } from '../models/Event.js';
import { Task } from '../models/Task.js';
import { User } from '../models/User.js';
import { asyncHandler, badRequest, forbidden, notFound } from '../utils/httpError.js';
import { canManageEvent, canManageTeam, canRecordAttendance, canSeeEvent, canViewAllTeams, hasGlobalAccess, recordableTeams, visibleTeams } from '../utils/access.js';
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
    if (out.team && !TEAMS.includes(out.team)) throw badRequest('Choose a valid kadr');
  }
  if (!partial || body.startDate !== undefined) out.startDate = parseDate(body.startDate, 'Start date', { required: true });
  if (body.endDate !== undefined) out.endDate = parseDate(body.endDate, 'End date', { required: false }) ?? null;
  return out;
}

/** Events cannot be planned in the past (one minute of slack for the time it takes to submit the form). */
function checkNotInPast(startDate) {
  if (startDate && startDate.getTime() < Date.now() - 60 * 1000) {
    throw badRequest('The event cannot start in the past');
  }
}

/** Checks that `user` may give an event this type and team; returns the team to store. */
function checkTypeAndTeam(user, type, team) {
  if (GROUP_EVENT_TYPES.includes(type)) {
    if (!hasGlobalAccess(user)) throw forbidden('Only group leaders can create Gawala Sessions');
    return null;
  }
  if ((type === 'team_session' || type === 'preparation_meeting') && !team) throw badRequest('Choose the kadr this event is for');
  if (!canManageEvent(user, { type, team })) {
    if (type === 'preparation_meeting') {
      throw forbidden('Preparation Meetings are created only by the Group Leader, Group Leader Helpers, and a Kadr Leader for their own kadr');
    }
    throw forbidden(team ? 'You can only manage events of your own kadr' : 'Only group leaders can create whole-group events');
  }
  return team;
}

/**
 * Loads an event and checks the user may see it, and optionally manage it:
 * `manage: true` = edit or delete the event itself; `manage: 'tasks'` = add or change its tasks
 * (team rules: the team's leaders and helpers, or group-wide leaders).
 */
export async function loadEvent(id, user, { manage = false } = {}) {
  if (!mongoose.isValidObjectId(id)) throw notFound('Event not found');
  const event = await Event.findById(id);
  if (!event) throw notFound('Event not found');
  if (!canSeeEvent(user, event)) throw notFound('Event not found');
  if (manage === 'tasks' && !canManageTeam(user, event.team)) {
    throw forbidden(event.team ? 'You can only manage tasks of your own kadr' : 'Only group leaders can manage tasks of whole-group events');
  }
  if (manage === true && !canManageEvent(user, event)) {
    throw forbidden(
      event.type === 'preparation_meeting'
        ? "Only the Group Leader, Group Leader Helpers and this kadr's Kadr Leader can change this Preparation Meeting"
        : event.team
          ? 'You can only manage events of your own kadr'
          : 'Only group leaders can manage whole-group events'
    );
  }
  return event;
}

/** Teams whose attendance an event takes: its own team, or all teams for whole-group sessions. */
function expectedTeams(event) {
  if (!ATTENDANCE_EVENT_TYPES.includes(event.type)) return [];
  return event.team ? [event.team] : TEAMS;
}

function attendanceSummary(event) {
  if (!ATTENDANCE_EVENT_TYPES.includes(event.type)) return null;
  const counts = { present: 0, absent: 0, excused: 0 };
  for (const a of event.attendance || []) counts[a.status] += 1;
  const teamsTaken = (event.attendanceTeams || []).map((t) => t.team);
  return {
    taken: teamsTaken.length > 0,
    teamsTaken,
    teamsExpected: expectedTeams(event),
    total: event.attendance?.length || 0,
    ...counts,
  };
}

/** Lean event as the client sees it: no raw attendance list, just its summary. */
function eventForClient(event) {
  const e = typeof event.toObject === 'function' ? event.toObject() : { ...event };
  e.attendanceSummary = attendanceSummary(e);
  delete e.attendance;
  delete e.attendanceTeams;
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
      if (!allowed.includes(team)) throw forbidden('You can only view events of your own kadr');
      filter.team = team;
    } else if (!canViewAllTeams(req.user)) {
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
      .populate('assignee', 'name username team photoUpdatedAt')
      .populate('createdBy', 'name')
      .populate('materials.uploadedBy', 'name');
    res.json({
      event: { ...eventForClient(event), canRecordAttendance: canRecordAttendance(req.user, event), canManage: canManageEvent(req.user, event) },
      tasks,
    });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const fields = readEventFields(req.body, { partial: false });
    fields.team = checkTypeAndTeam(req.user, fields.type, fields.team);
    checkNotInPast(fields.startDate);
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

    if (event.attendanceTeams.length && (type !== event.type || (team || null) !== (event.team || null))) {
      throw badRequest('Attendance was already taken for this event, so its type and kadr cannot change');
    }
    fields.team = checkTypeAndTeam(req.user, type, team);

    if (type === 'preparation_meeting' && event.type !== 'preparation_meeting' && (await Task.exists({ event: event._id }))) {
      throw badRequest('Preparation Meetings do not have tasks. Delete this event\'s tasks first, or keep its type.');
    }

    const teamChanged = fields.team !== event.team;
    // A changed start date cannot be in the past; other details of past events can still be edited.
    if (fields.startDate && fields.startDate.getTime() !== event.startDate.getTime()) checkNotInPast(fields.startDate);
    Object.assign(event, fields);
    await event.save();
    if (teamChanged) await Task.updateMany({ event: event._id }, { team: event.team });
    res.json({ event: { ...eventForClient(event), canRecordAttendance: canRecordAttendance(req.user, event), canManage: canManageEvent(req.user, event) } });
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
//
// Only Database/Attendance members record attendance, each for their one assigned team.
// A Team Session or Preparation Meeting sheet has one section (its team), taken by that
// team's member. A Gawala Session sheet has a section per team, all taken by the member
// assigned to Gawala.

const teamOrder = (team) => TEAMS.indexOf(team);

/** Current active members of a team, for a section that has not been taken yet. */
function currentMembers(team) {
  return User.find({ isActive: true, team }).select('name username team photoUpdatedAt').sort({ name: 1 }).lean();
}

async function attendanceSheet(event, user) {
  await event.populate([
    { path: 'attendance.user', select: 'name username team photoUpdatedAt' },
    { path: 'attendanceTeams.takenBy', select: 'name' },
  ]);
  const mine = recordableTeams(user, event, TEAMS);

  const sections = [];
  for (const team of expectedTeams(event)) {
    const log = event.attendanceTeams.find((t) => t.team === team);
    let rows;
    if (log) {
      rows = event.attendance
        .filter((a) => a.team === team && a.user) // a.user is null if the account was deleted
        .map((a) => ({ user: a.user.toJSON(), team, status: a.status }));
    } else {
      rows = (await currentMembers(team)).map((u) => ({ user: u, team, status: null }));
    }
    rows.sort((a, b) => a.user.name.localeCompare(b.user.name));
    sections.push({
      team,
      taken: Boolean(log),
      takenAt: log?.takenAt ?? null,
      takenBy: log?.takenBy?.name ? { name: log.takenBy.name } : null,
      canRecord: mine.includes(team),
      rows,
    });
  }
  sections.sort((a, b) => teamOrder(a.team) - teamOrder(b.team));
  return { sections };
}

router.get(
  '/:id/attendance',
  asyncHandler(async (req, res) => {
    const event = await loadEvent(req.params.id, req.user);
    if (!ATTENDANCE_EVENT_TYPES.includes(event.type)) throw badRequest('Attendance is not taken for this type of event');
    res.json(await attendanceSheet(event, req.user));
  })
);

// PUT /api/events/:id/attendance  { records: [{ user, status }] }
// Saves the sections this user records. Members of those teams left unmarked are saved as absent.
router.put(
  '/:id/attendance',
  asyncHandler(async (req, res) => {
    const event = await loadEvent(req.params.id, req.user);
    if (!ATTENDANCE_EVENT_TYPES.includes(event.type)) throw badRequest('Attendance is not taken for this type of event');
    const teams = recordableTeams(req.user, event, TEAMS);
    if (!teams.length) {
      throw forbidden(
        event.type === 'gawala_session'
          ? 'Only the Database/Attendance member assigned to Gawala takes Gawala Session attendance'
          : 'Only the Database/Attendance member assigned to this kadr can take its attendance'
      );
    }

    const records = Array.isArray(req.body.records) ? req.body.records : [];
    const statusByUser = new Map();
    for (const r of records) {
      if (!ATTENDANCE_STATUSES.includes(r?.status)) throw badRequest('Each member must be present, absent or excused');
      statusByUser.set(String(r.user), r.status);
    }

    for (const team of teams) {
      const log = event.attendanceTeams.find((t) => t.team === team);
      if (!log) {
        // First time for this team: its member list is fixed from team membership right now.
        const members = await currentMembers(team);
        for (const u of members) {
          event.attendance.push({ user: u._id, team, status: statusByUser.get(u._id.toString()) || 'absent' });
        }
        event.attendanceTeams.push({ team, takenAt: new Date(), takenBy: req.user._id });
      } else {
        for (const a of event.attendance) {
          if (a.team !== team) continue;
          const status = statusByUser.get(a.user.toString());
          if (status) a.status = status;
        }
        log.takenAt = new Date();
        log.takenBy = req.user._id;
      }
    }
    await event.save();

    res.json({ ...(await attendanceSheet(event, req.user)), summary: attendanceSummary(event) });
  })
);

export default router;
