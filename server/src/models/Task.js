import mongoose from 'mongoose';
import { TASK_STATUSES } from '../constants.js';

const materialSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    storage: { type: String, enum: ['drive', 'local'], required: true },
    // Google Drive file id, or the local file name when Drive is not configured.
    fileId: { type: String, required: true },
    url: { type: String, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: 'uploadedAt', updatedAt: false } }
);

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    event: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
    // Copied from the event so team-scoped queries stay simple.
    team: { type: String, required: true, index: true },
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    dueDate: { type: Date },
    status: { type: String, enum: TASK_STATUSES, default: 'todo' },
    materials: [materialSchema],
  },
  { timestamps: true }
);

export const Task = mongoose.model('Task', taskSchema);
