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

const attendanceTeamSchema = new mongoose.Schema(
  {
    team: { type: String, enum: TEAMS, required: true },
    takenAt: { type: Date, required: true },
    takenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { _id: false }
);

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    type: { type: String, enum: EVENT_TYPES, default: 'other', index: true },
    // The team the event belongs to; null = the whole group (a Gawala Session, or a group-wide "Others").
    team: { type: String, enum: [...TEAMS, null], default: null, index: true },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date },
    location: { type: String, trim: true, maxlength: 120, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Google Drive folder holding this event's task materials (created on first upload).
    driveFolderId: { type: String, default: '' },
    // Attendance sheet rows, added team by team. A team's rows are fixed from its membership
    // the first time that team's attendance is saved.
    attendance: { type: [attendanceSchema], default: [] },
    // Which teams' attendance has been taken, when, and by whom (one entry per team).
    attendanceTeams: { type: [attendanceTeamSchema], default: [] },
  },
  { timestamps: true }
);

eventSchema.index({ 'attendance.user': 1 });

eventSchema.pre('validate', function checkEvent() {
  if (this.endDate && this.startDate && this.endDate < this.startDate) {
    this.invalidate('endDate', 'End date must be after the start date');
  }
  if (GROUP_EVENT_TYPES.includes(this.type)) this.team = null;
  if ((this.type === 'team_session' || this.type === 'preparation_meeting') && !this.team) {
    this.invalidate('team', 'Choose the team this event is for');
  }
});

export const Event = mongoose.model('Event', eventSchema);
