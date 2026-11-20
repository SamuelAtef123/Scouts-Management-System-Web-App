import mongoose from 'mongoose';
import { ATTENDANCE_STATUSES, EVENT_TYPES, GROUP_EVENT_TYPES, TEAMS } from '../constants.js';

// One line of an attendance sheet. `team` is the member's team when attendance was recorded.
const attendanceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    team: { type: String, enum: TEAMS, required: true },
    status: { type: String, enum: ATTENDANCE_STATUSES, required: true },
  },
  { _id: false }
);

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    type: { type: String, enum: EVENT_TYPES, default: 'other', index: true },
    // The team the event belongs to; null = the whole group (Preparation Meeting, Gawala Session, or a group-wide "Others").
    team: { type: String, enum: [...TEAMS, null], default: null, index: true },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date },
    location: { type: String, trim: true, maxlength: 120, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Google Drive folder holding this event's task materials (created on first upload).
    driveFolderId: { type: String, default: '' },
    // Attendance sheet. Empty until attendance is first recorded; the member list is fixed at that moment.
    attendance: { type: [attendanceSchema], default: [] },
    attendanceTakenAt: { type: Date, default: null },
    attendanceTakenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

eventSchema.index({ 'attendance.user': 1 });

eventSchema.pre('validate', function checkEvent() {
  if (this.endDate && this.startDate && this.endDate < this.startDate) {
    this.invalidate('endDate', 'End date must be after the start date');
  }
  if (GROUP_EVENT_TYPES.includes(this.type)) this.team = null;
  if (this.type === 'team_session' && !this.team) {
    this.invalidate('team', 'Choose the team this session is for');
  }
});

export const Event = mongoose.model('Event', eventSchema);
