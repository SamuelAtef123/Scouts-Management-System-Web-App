import { Router } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { Task } from '../models/Task.js';
import { Event } from '../models/Event.js';
import { User } from '../models/User.js';
import { loadEvent } from './events.js';
import { asyncHandler, badRequest, forbidden, notFound } from '../utils/httpError.js';
import { canManageTeam } from '../utils/access.js';
import { storeMaterial, removeMaterial } from '../services/storage.js';
import { ALLOWED_MATERIAL_TYPES, TASK_STATUSES } from '../constants.js';
import { config } from '../config.js';
import { fixFileName } from '../utils/fileName.js';
import { detectFileType } from '../utils/fileType.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    file.originalname = fixFileName(file.originalname); // keep Arabic names readable
    if (ALLOWED_MATERIAL_TYPES[file.mimetype]) return cb(null, true);
    cb(badRequest('Only PDF, Word documents and images can be uploaded'));
  },
});

const populateTask = (query) =>
  query
    .populate('assignee', 'name username team photoUpdatedAt')
    .populate('createdBy', 'name')
    .populate('materials.uploadedBy', 'name')
    .populate('event', 'title type team startDate endDate location');

async function loadTask(id) {
  if (!mongoose.isValidObjectId(id)) throw notFound('Task not found');
  const task = await Task.findById(id);
  if (!task) throw notFound('Task not found');
  return task;
}

const isAssignee = (task, user) => task.assignee.equals(user._id);

/**
 * Checks the person a task is assigned to: an active member of the event's team, for everyone
 * including group-wide leaders. Whole-group events (no team) can be assigned to any active member.
 */
async function checkAssignee(assigneeId, event) {
  if (!mongoose.isValidObjectId(assigneeId)) throw badRequest('Choose who the task is assigned to');
  const assignee = await User.findOne({ _id: assigneeId, isActive: true });
  if (!assignee) throw badRequest('This member was not found or is not active');
  if (event.team && assignee.team !== event.team) {
    throw badRequest('Tasks of this event can only be assigned to members of its kadr');
  }
  return assignee;
}

function parseDueDate(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw badRequest('Due date is not a valid date');
  return date;
}

// GET /api/tasks/mine?status=open|done|all — tasks assigned to me.
router.get(
  '/mine',
  asyncHandler(async (req, res) => {
    const filter = { assignee: req.user._id };
    const status = req.query.status || 'open';
    if (status === 'open') filter.status = { $ne: 'done' };
    else if (status === 'done') filter.status = 'done';

    const tasks = await populateTask(Task.find(filter).sort({ dueDate: 1, createdAt: -1 }).limit(200));
    res.json({ tasks });
  })
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const task = await loadTask(req.params.id);
    if (!isAssignee(task, req.user) && !canManageTeam(req.user, task.team)) throw notFound('Task not found');
    res.json({ task: await populateTask(Task.findById(task._id)) });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const event = await loadEvent(req.body.event, req.user, { manage: 'tasks' });
    if (event.type === 'preparation_meeting') throw badRequest('Preparation Meetings do not have tasks');
    const title = String(req.body.title || '').trim();
    if (!title) throw badRequest('Task title is required');
    const assignee = await checkAssignee(req.body.assignee, event);

    const task = await Task.create({
      title,
      description: String(req.body.description || '').trim(),
      event: event._id,
      team: event.team,
      assignee: assignee._id,
      createdBy: req.user._id,
      dueDate: parseDueDate(req.body.dueDate) ?? undefined,
    });
    res.status(201).json({ task: await populateTask(Task.findById(task._id)) });
  })
);

router.put(
  '/:id',
  asyncHandler(async (req, res) => {
    const task = await loadTask(req.params.id);
    const manager = canManageTeam(req.user, task.team);
    if (!manager && !isAssignee(task, req.user)) throw forbidden('You cannot edit this task');

    if (req.body.status !== undefined) {
      if (!TASK_STATUSES.includes(req.body.status)) throw badRequest('Invalid status');
      task.status = req.body.status;
    }

    // Everything except the status is only editable by people who manage the team.
    const managedFields = ['title', 'description', 'assignee', 'dueDate'];
    if (managedFields.some((f) => req.body[f] !== undefined)) {
      if (!manager) throw forbidden('You can only change the status of a task assigned to you');
      if (req.body.title !== undefined) {
        task.title = String(req.body.title || '').trim();
        if (!task.title) throw badRequest('Task title is required');
      }
      if (req.body.description !== undefined) task.description = String(req.body.description || '').trim();
      if (req.body.dueDate !== undefined) task.dueDate = parseDueDate(req.body.dueDate);
      if (req.body.assignee !== undefined && String(req.body.assignee) !== task.assignee.toString()) {
        const event = await loadEvent(task.event, req.user, { manage: 'tasks' });
        task.assignee = (await checkAssignee(req.body.assignee, event))._id;
      }
    }

    await task.save();
    res.json({ task: await populateTask(Task.findById(task._id)) });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const task = await loadTask(req.params.id);
    if (!canManageTeam(req.user, task.team)) throw forbidden('You can only delete tasks of your own kadr');
    // Uploaded materials stay in Google Drive as an archive.
    await task.deleteOne();
    res.json({ ok: true });
  })
);

// Upload material — only the person the task is assigned to.
router.post(
  '/:id/materials',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const task = await loadTask(req.params.id);
    if (!isAssignee(task, req.user)) throw forbidden('Only the person assigned to this task can upload its material');
    if (!req.file) throw badRequest('Choose a file to upload');
    // Trust the file's real content, not the type the browser claims.
    const real = detectFileType(req.file.buffer);
    if (!real || !ALLOWED_MATERIAL_TYPES[real.mime]) throw badRequest('Only PDF, Word documents and images can be uploaded');
    req.file.mimetype = real.mime;
    req.file.extension = real.ext;

    // The assignee may be from another team than the event, so the event is loaded without the visibility check.
    const event = await Event.findById(task.event);
    if (!event) throw notFound('Event not found');
    const stored = await storeMaterial({ file: req.file, event, task, uploader: req.user });
    task.materials.push({
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedBy: req.user._id,
      ...stored,
    });
    if (task.status === 'todo') task.status = 'in_progress';
    await task.save();
    res.status(201).json({ task: await populateTask(Task.findById(task._id)) });
  })
);

router.delete(
  '/:id/materials/:materialId',
  asyncHandler(async (req, res) => {
    const task = await loadTask(req.params.id);
    const material = task.materials.id(req.params.materialId);
    if (!material) throw notFound('File not found');
    if (!isAssignee(task, req.user) && !canManageTeam(req.user, task.team)) throw forbidden('You cannot remove this file');

    await removeMaterial(material);
    material.deleteOne();
    await task.save();
    res.json({ task: await populateTask(Task.findById(task._id)) });
  })
);

export default router;
