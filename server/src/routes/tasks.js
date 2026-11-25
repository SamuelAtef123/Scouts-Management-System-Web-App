import { Router } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { Task } from '../models/Task.js';
import { Event } from '../models/Event.js';
import { User } from '../models/User.js';
import { loadEvent } from './events.js';
import { asyncHandler, badRequest, forbidden, notFound } from '../utils/httpError.js';
import { canManageTeam, canReviewMaterials, reviewTaskFilter } from '../utils/access.js';
import { approveMaterial, readMaterial, storeMaterial, removeMaterial } from '../services/storage.js';
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
    .populate('materials.reviewedBy', 'name')
    .populate('event', 'title type team startDate endDate location');

const idOf = (ref) => String(ref?._id ?? ref ?? '');

/**
 * A task as `user` may see it. Files that are not approved yet are private: only their uploader and
 * the reviewers can open them (through /materials/:id/file), and nobody gets their storage link.
 */
export function taskForClient(task, user) {
  const json = task.toJSON ? task.toJSON() : task;
  const canReview = canReviewMaterials(user, json.team ?? null);
  json.canReview = canReview;
  json.materials = (json.materials || []).map((m) => {
    const status = m.reviewStatus || 'approved';
    if (status === 'approved') return { ...m, reviewStatus: status, fileId: undefined, canOpen: true };
    const own = idOf(m.uploadedBy) === idOf(user._id);
    return { ...m, fileId: undefined, url: undefined, canOpen: status === 'pending' && (own || canReview) };
  });
  return json;
}

const sendTask = async (res, id, user, status = 200) => res.status(status).json({ task: taskForClient(await populateTask(Task.findById(id)), user) });

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
    res.json({ tasks: tasks.map((t) => taskForClient(t, req.user)) });
  })
);

// GET /api/tasks/reviews — tasks with files waiting for this user's review.
router.get(
  '/reviews',
  asyncHandler(async (req, res) => {
    const filter = reviewTaskFilter(req.user);
    if (!filter) return res.json({ tasks: [] });
    const tasks = await populateTask(Task.find({ ...filter, 'materials.reviewStatus': 'pending' }).sort({ updatedAt: 1 }).limit(200));
    res.json({ tasks: tasks.map((t) => taskForClient(t, req.user)) });
  })
);

// GET /api/tasks/reviews/count — the number of files waiting for this user's review (menu badge).
router.get(
  '/reviews/count',
  asyncHandler(async (req, res) => {
    res.json({ count: await countReviews(req.user) });
  })
);

export async function countReviews(user) {
  const filter = reviewTaskFilter(user);
  if (!filter) return 0;
  const [row] = await Task.aggregate([
    { $match: { ...filter, 'materials.reviewStatus': 'pending' } },
    { $unwind: '$materials' },
    { $match: { 'materials.reviewStatus': 'pending' } },
    { $count: 'n' },
  ]);
  return row?.n || 0;
}

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const task = await loadTask(req.params.id);
    if (!isAssignee(task, req.user) && !canManageTeam(req.user, task.team)) throw notFound('Task not found');
    await sendTask(res, task._id, req.user);
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
    await sendTask(res, task._id, req.user, 201);
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
      if (req.body.status === 'done' && task.materials.some((m) => m.reviewStatus === 'pending' || m.reviewStatus === 'changes')) {
        throw badRequest('This task has files waiting for review or sent back, so it cannot be marked done yet');
      }
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
    await sendTask(res, task._id, req.user);
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const task = await loadTask(req.params.id);
    if (!canManageTeam(req.user, task.team)) throw forbidden('You can only delete tasks of your own kadr');
    // Approved materials stay in Google Drive as an archive; files still waiting for review are deleted.
    await Promise.all(task.materials.filter((m) => m.reviewStatus === 'pending').map(removeMaterial));
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
    // A reviewer's own upload needs no review; everyone else's waits in a private folder until approved.
    const approved = canReviewMaterials(req.user, task.team);
    const stored = await storeMaterial({ file: req.file, event, task, uploader: req.user, approved });
    // A new upload answers earlier "sent back" notes.
    task.materials = task.materials.filter((m) => m.reviewStatus !== 'changes');
    task.materials.push({
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedBy: req.user._id,
      ...stored,
      reviewStatus: approved ? 'approved' : 'pending',
      ...(approved ? { reviewedBy: req.user._id, reviewedAt: new Date() } : {}),
    });
    if (task.status !== 'in_progress' && (task.status === 'todo' || !approved)) task.status = 'in_progress';
    await task.save();
    await sendTask(res, task._id, req.user, 201);
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
    await sendTask(res, task._id, req.user);
  })
);

/** Loads a task and one of its files that waits for review, checking that `user` reviews it. */
async function loadPendingForReview(req) {
  const task = await loadTask(req.params.id);
  const material = task.materials.id(req.params.materialId);
  if (!material) throw notFound('File not found');
  if (!canReviewMaterials(req.user, task.team)) {
    throw forbidden("Only the Group Leader, Group Leader Helpers and this kadr's Kadr Leader can review this file");
  }
  if (material.reviewStatus !== 'pending') throw badRequest('This file is not waiting for review');
  return { task, material };
}

// Open a file: its uploader and the reviewers can open files that wait for review.
router.get(
  '/:id/materials/:materialId/file',
  asyncHandler(async (req, res) => {
    const task = await loadTask(req.params.id);
    const material = task.materials.id(req.params.materialId);
    if (!material || !material.fileId) throw notFound('File not found');
    const own = material.uploadedBy.equals(req.user._id);
    const allowed = own || canReviewMaterials(req.user, task.team) || (material.reviewStatus === 'approved' && canManageTeam(req.user, task.team));
    if (!allowed) throw notFound('File not found');

    const stream = await readMaterial(material);
    res.setHeader('Content-Type', material.mimeType);
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(material.fileName)}`);
    res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'");
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    stream.on('error', () => res.destroy());
    stream.pipe(res);
  })
);

// Approve: the file moves into the event's Google Drive folder.
router.post(
  '/:id/materials/:materialId/approve',
  asyncHandler(async (req, res) => {
    const { task, material } = await loadPendingForReview(req);
    const event = await Event.findById(task.event);
    if (!event) throw notFound('Event not found');
    Object.assign(material, await approveMaterial(material, event));
    material.reviewStatus = 'approved';
    material.reviewedBy = req.user._id;
    material.reviewedAt = new Date();
    material.reviewNote = '';
    await task.save();
    await sendTask(res, task._id, req.user);
  })
);

// Send back: the file is deleted and the uploader sees the note, then uploads a new version.
router.post(
  '/:id/materials/:materialId/send-back',
  asyncHandler(async (req, res) => {
    const { task, material } = await loadPendingForReview(req);
    const note = String(req.body.note || '').trim();
    if (!note) throw badRequest('Write what should be changed');
    if (note.length > 500) throw badRequest('The note can be at most 500 characters');
    await removeMaterial(material);
    material.reviewStatus = 'changes';
    material.reviewNote = note;
    material.reviewedBy = req.user._id;
    material.reviewedAt = new Date();
    material.fileId = '';
    material.url = '';
    if (task.status === 'done') task.status = 'in_progress';
    await task.save();
    await sendTask(res, task._id, req.user);
  })
);

export default router;
