import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ROLE_VALUES, TEAMS } from '../constants.js';
import { ATTENDANCE_ASSIGNMENTS } from '../attendanceAssignments.js';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9._-]{3,30}$/, 'Username must be 3-30 characters: letters, numbers, dot, dash or underscore'],
    },
    phone: { type: String, trim: true, maxlength: 20 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLE_VALUES, required: true },
    // The team this person belongs to; it decides whose attendance sheet they appear on.
    team: { type: String, enum: [...TEAMS, null], default: null },
    // Only meaningful for the Database/Attendance team: the 2 members with extra privileges.
    isPrivileged: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.methods.setPassword = async function setPassword(plain) {
  this.passwordHash = await bcrypt.hash(plain, 10);
};

userSchema.methods.checkPassword = function checkPassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    // Read-only: which team's attendance this member takes (fixed in attendanceAssignments.js).
    ret.attendanceTeam = ret.role === 'database_team' ? (ATTENDANCE_ASSIGNMENTS[ret.username] ?? null) : null;
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

export const User = mongoose.model('User', userSchema);
