import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { asyncHandler, badRequest, HttpError } from '../utils/httpError.js';
import { normalizePhone } from '../utils/phone.js';
import { normalizeEmail } from '../utils/email.js';
import { inBackground, sendPasswordReset } from '../services/notify.js';
import crypto from 'node:crypto';
import { hasGlobalAccess, isReviewer, canManageUsers, canViewAllTeams, canViewMembers, memberTeams, attendanceTeamOf, visibleTeams } from '../utils/access.js';
import { TEAMS } from '../constants.js';
import { config } from '../config.js';

const router = Router();

// Per internet address. Only failed attempts count: leaders on the same church Wi-Fi share one
// address, so counting successful sign-ins would lock people out at a meeting.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 50,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { message: 'Too many sign-in attempts, please try again in a few minutes' },
});

/** The user object the client works with, including what they are allowed to do. */
export function publicUser(user) {
  return {
    ...user.toJSON(),
    maxUploadMb: config.maxUploadMb, // checked in the browser before a file is uploaded
    permissions: {
      allTeams: hasGlobalAccess(user), // manage events and tasks of every team
      viewAllTeams: canViewAllTeams(user), // see every team's events
      teams: visibleTeams(user, TEAMS), // teams whose events they see (plus whole-group events)
      attendanceTeam: attendanceTeamOf(user), // the team they take attendance for, if any
      viewMembers: canViewMembers(user), // Members page: details and attendance %
      memberTeams: memberTeams(user), // teams whose members they can view there
      manageUsers: canManageUsers(user), // add / edit / deactivate members
      reviewMaterials: isReviewer(user), // reviews uploaded files before they go to Google Drive
    },
  };
}

// A second limit per username, whatever address the attempts come from (stops password
// guessing spread over many IPs). Only failed attempts count.
const accountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `user:${String(req.body?.username || '').trim().toLowerCase()}`,
  message: { message: 'Too many wrong passwords for this account. Try again in 15 minutes.' },
});

// Compared against when the username does not exist, so a wrong username takes as long as a wrong password.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

router.post(
  '/login',
  loginLimiter,
  accountLimiter,
  asyncHandler(async (req, res) => {
    const username = String(req.body.username || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!username || !password) throw badRequest('Enter your username and password');

    const user = await User.findOne({ username }).select('+passwordHash');
    const ok = user ? await user.checkPassword(password) : (await bcrypt.compare(password, DUMMY_HASH), false);
    if (!ok) {
      throw new HttpError(401, 'Wrong username or password');
    }
    if (!user.isActive) throw new HttpError(403, 'Your account has been deactivated');

    res.json({ token: signToken(user), user: publicUser(user) });
  })
);

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.put(
  '/me/password',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { currentPassword = '', newPassword = '' } = req.body;
    if (String(newPassword).length < 8) throw badRequest('The new password must be at least 8 characters');

    const user = await User.findById(req.user._id).select('+passwordHash');
    if (!(await user.checkPassword(String(currentPassword)))) throw badRequest('Your current password is wrong');

    await user.setPassword(String(newPassword));
    await user.save();
    // Other sessions are now signed out; this device gets a fresh session.
    res.json({ ok: true, token: signToken(user) });
  })
);

// Update your own mobile number and/or email (asked on first sign-in, editable on the Profile page).
router.put(
  '/me/profile',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.body.phone === undefined && req.body.email === undefined) throw badRequest('Nothing to update');
    if (req.body.phone !== undefined) req.user.phone = normalizePhone(req.body.phone, { required: true });
    if (req.body.email !== undefined) {
      const email = normalizeEmail(req.body.email, { required: true });
      if (email !== req.user.email && (await User.exists({ email, _id: { $ne: req.user._id } }))) {
        throw badRequest('This email is already used by another member');
      }
      req.user.email = email;
    }
    await req.user.save();
    res.json({ user: publicUser(req.user) });
  })
);

// Which automatic emails you want: { events, tasks, reviews } (true or false each).
router.put(
  '/me/email-prefs',
  requireAuth,
  asyncHandler(async (req, res) => {
    for (const key of ['events', 'tasks', 'reviews']) {
      if (req.body[key] !== undefined) req.user.emailPrefs[key] = Boolean(req.body[key]);
    }
    await req.user.save();
    res.json({ user: publicUser(req.user) });
  })
);

// ---------- Forgot password ----------
// A one-time link, valid for RESET_MINUTES, is emailed to the account's address. The link holds a
// random secret; only its hash is stored, so the database alone cannot be used to reset a password.
const RESET_MINUTES = 60;
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// Per internet address (leaders at church share one), every 15 minutes. The link's secret cannot
// be guessed, so these limits only stop someone flooding inboxes or the server.
const limitPer15Min = (limit) =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message: 'Too many requests. Try again in 15 minutes.' },
  });
const forgotLimiter = limitPer15Min(10);
const resetLimiter = limitPer15Min(20);

// POST /api/auth/forgot { login: username or email }. Always answers the same, so it does not
// reveal which usernames or emails exist.
router.post(
  '/forgot',
  forgotLimiter,
  asyncHandler(async (req, res) => {
    const login = String(req.body.login || '').trim().toLowerCase();
    if (!login) throw badRequest('Enter your username or email');
    const user = await User.findOne({ $or: [{ username: login }, { email: login }], isActive: true, email: { $type: 'string' } });
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      user.resetTokenHash = hashToken(token);
      user.resetTokenExpires = new Date(Date.now() + RESET_MINUTES * 60 * 1000);
      await user.save();
      inBackground(sendPasswordReset(user, token, RESET_MINUTES));
    }
    res.json({ ok: true });
  })
);

// POST /api/auth/reset { token, newPassword }: sets the new password and signs the person in.
router.post(
  '/reset',
  resetLimiter,
  asyncHandler(async (req, res) => {
    const token = String(req.body.token || '');
    const newPassword = String(req.body.newPassword || '');
    if (newPassword.length < 8) throw badRequest('The new password must be at least 8 characters');
    const user = token
      ? await User.findOne({ resetTokenHash: hashToken(token), resetTokenExpires: { $gt: new Date() }, isActive: true }).select('+passwordHash')
      : null;
    if (!user) throw badRequest('This link is not valid or has expired. Ask for a new one.');
    await user.setPassword(newPassword); // also cancels the link and signs out other devices
    await user.save();
    res.json({ token: signToken(user), user: publicUser(user) });
  })
);

export default router;
