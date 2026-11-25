import mongoose from 'mongoose';
import { REVIEW_STATUSES, TASK_STATUSES } from '../constants.js';

function isKept() {
  return this.reviewStatus !== 'changes';
}

const materialSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    storage: { type: String, enum: ['drive', 'local'], required: true },
    // Google Drive file id, or the local file name when Drive is not configured.
    // Empty once a file is sent back (the file itself is deleted, the note stays).
    fileId: { type: String, required: isKept },
    url: { type: String, required: isKept },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // pending: waiting for review, kept out of the event's Drive folder;
    // approved: in the event's folder; changes: sent back to the uploader with a note.
    reviewStatus: { type: String, enum: REVIEW_STATUSES, default: 'approved' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    reviewNote: { type: String, trim: true, maxlength: 500, default: '' },
  },
  { timestamps: { createdAt: 'uploadedAt', updatedAt: false } }
);

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    // Copied from the event so team-scoped queries stay simple (null = whole-group event).
    team: { type: String, default: null, index: true },
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    dueDate: { type: Date },
    status: { type: String, enum: TASK_STATUSES, default: 'todo' },
    materials: [materialSchema],
  },
  { timestamps: true }
);

export const Task = mongoose.model('Task', taskSchema);
