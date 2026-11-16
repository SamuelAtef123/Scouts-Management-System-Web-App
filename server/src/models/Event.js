import mongoose from 'mongoose';
import { TEAMS } from '../constants.js';

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    team: { type: String, enum: TEAMS, required: true, index: true },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date },
    location: { type: String, trim: true, maxlength: 120, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Google Drive folder holding this event's task materials (created on first upload).
    driveFolderId: { type: String, default: '' },
  },
  { timestamps: true }
);

eventSchema.pre('validate', function checkDates() {
  if (this.endDate && this.startDate && this.endDate < this.startDate) {
    this.invalidate('endDate', 'End date must be after the start date');
  }
});

export const Event = mongoose.model('Event', eventSchema);
