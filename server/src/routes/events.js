import { Router } from 'express';
import mongoose from 'mongoose';
import { Event } from '../models/Event.js';
import { Task } from '../models/Task.js';
import { asyncHandler, badRequest, forbidden, notFound } from '../utils/httpError.js';
import { canManageTeam, visibleTeams } from '../utils/access.js';
import { TEAMS } from '../constants.js';

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
  if (!partial || body.team !== undefined) {
    if (!TEAMS.includes(body.team)) throw badRequest('Choose a team for the event');
    out.team = body.team;
  }
  if (!partial || body.startDate !== undefined) out.startDate = parseDate(body.startDate, 'Start date', { required: true });
  if (body.endDate !== undefined) out.endDate = parseDate(body.endDate, 'End date', { required: false }) ?? null;
  return out;
}

/** Loads an event and checks the user may see it (and optionally manage it). */
export async function loadEvent(id, user, { manage = false } = {}) {
  if (!mongoose.isValidObjectId(id)) throw notFound('Event not found');
  const event = await Event.findById(id);
  if (!event) throw notFound('Event not found');
  if (!canManageTeam(user, event.team)) {
    throw manage ? forbidden('You can only manage events of your own team') : notFound('Event not found');
  }
  return event;
}

// GET /api/events?when=upcoming|past|all&team=Ashbal
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const allowed = visibleTeams(req.user, TEAMS);
    const team = req.query.team ? String(req.query.team) : null;
    if (team && !allowed.includes(team)) throw forbidden('You can only view events of your own team');

    const filter = { team: team ? team : { $in: allowed } };
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
    for (const e of events) {
      const c = byEvent.get(e._id.toString());
      e.taskCount = c?.total ?? 0;
      e.doneCount = c?.done ?? 0;
    }

    res.json({ events });
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
    res.json({ event, tasks });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const fields = readEventFields(req.body, { partial: false });
    if (!canManageTeam(req.user, fields.team)) throw forbidden('You can only create events for your own team');
    const event = await Event.create({ ...fields, createdBy: req.user._id });
    res.status(201).json({ event });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const event = await loadEvent(req.params.id, req.user, { manage: true });
    const fields = readEventFields(req.body, { partial: true });
    if (fields.team && !canManageTeam(req.user, fields.team)) throw forbidden('You can only move events to your own team');

    const teamChanged = fields.team && fields.team !== event.team;
    Object.assign(event, fields);
    await event.save();
    if (teamChanged) await Task.updateMany({ event: event._id }, { team: event.team });
    res.json({ event });
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

export default router;
