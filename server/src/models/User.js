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
    // Required for everyone: asked on the next sign-in when missing. Used for notifications and
    // "Forgot password?". Unique, so a reset link always goes to exactly one account.
    email: { type: String, trim: true, lowercase: true, maxlength: 120 },
    // The email is confirmed with a 6-digit code sent to it. Only confirmed emails get notifications
    // and "Forgot password?" links, so a mistyped address never receives anything sensitive.
    emailVerified: { type: Boolean, default: false },
    // An address waiting for its code (first sign-in, or a change on the Profile page). The current
    // email stays until the code is entered.
    pendingEmail: { type: String, trim: true, lowercase: true, maxlength: 120 },
    emailCodeHash: { type: String, select: false },
    emailCodeExpires: { type: Date, select: false },
    emailCodeSentAt: { type: Date, select: false },
    emailCodeTries: { type: Number, default: 0, select: false },
    // "Forgot password?": a hash of the one-time link's secret, valid until resetTokenExpires.
    resetTokenHash: { type: String, select: false },
    resetTokenExpires: { type: Date, select: false },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLE_VALUES, required: true },
    // The team this person belongs to; it decides whose attendance sheet they appear on.
    team: { type: String, enum: [...TEAMS, null], default: null },
    // Only meaningful for the Database/Attendance team: the 2 members with extra privileges.
    isPrivileged: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    // The password was set by someone else (a new account, or a reset by a Database member):
    // the person must choose their own on their next sign-in.
    mustChangePassword: { type: Boolean, default: false },
    // Sessions issued before this moment are rejected (set when the password changes).
    passwordChangedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: 'string' } } });

userSchema.methods.setPassword = async function setPassword(plain) {
  this.passwordHash = await bcrypt.hash(plain, 10);
  // A new password also cancels any "Forgot password?" link that was not used yet.
  this.resetTokenHash = undefined;
  this.resetTokenExpires = undefined;
  // Sign out every existing session. One second back so the new token issued right now stays valid.
  this.passwordChangedAt = new Date(Date.now() - 1000);
};

userSchema.methods.checkPassword = function checkPassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    // Read-only: which team's attendance this member takes (fixed in attendanceAssignments.js).
    ret.attendanceTeam = ret.role === 'database_team' ? (ATTENDANCE_ASSIGNMENTS[ret.username] ?? null) : null;
    delete ret.passwordHash;
    delete ret.passwordChangedAt;
    delete ret.resetTokenHash;
    delete ret.emailCodeHash;
    delete ret.emailCodeExpires;
    delete ret.emailCodeSentAt;
    delete ret.emailCodeTries;
    delete ret.resetTokenExpires;
    delete ret.__v;
    return ret;
  },
});

export const User = mongoose.model('User', userSchema);
