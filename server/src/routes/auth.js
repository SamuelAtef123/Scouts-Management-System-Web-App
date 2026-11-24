import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import multer from 'multer';
import { asyncHandler, badRequest, HttpError } from '../utils/httpError.js';
import { normalizePhone } from '../utils/phone.js';
import { detectFileType } from '../utils/fileType.js';
import { hasGlobalAccess, canManageUsers, canViewAllTeams, canViewMembers, memberTeams, attendanceTeamOf, visibleTeams } from '../utils/access.js';
import { TEAMS } from '../constants.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many sign-in attempts, please try again in a few minutes' },
});

/** The user object the client works with, including what they are allowed to do. */
export function publicUser(user) {
  return {
    ...user.toJSON(),
    permissions: {
      allTeams: hasGlobalAccess(user), // manage events and tasks of every team
      viewAllTeams: canViewAllTeams(user), // see every team's events
      teams: visibleTeams(user, TEAMS), // teams whose events they see (plus whole-group events)
      attendanceTeam: attendanceTeamOf(user), // the team they take attendance for, if any
      viewMembers: canViewMembers(user), // Members page: details and attendance %
      memberTeams: memberTeams(user), // teams whose members they can view there
      manageUsers: canManageUsers(user), // add / edit / deactivate members
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

// Update your own mobile number (asked on first sign-in, editable on the Profile page).
router.put(
  '/me/profile',
  requireAuth,
  asyncHandler(async (req, res) => {
    req.user.phone = normalizePhone(req.body.phone, { required: true });
    await req.user.save();
    res.json({ user: publicUser(req.user) });
  })
);

// Your own profile photo. The browser resizes it first, so it stays small.
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (PHOTO_TYPES.includes(file.mimetype)) return cb(null, true);
    cb(badRequest('The photo must be a JPEG, PNG or WebP image'));
  },
});

router.put(
  '/me/photo',
  requireAuth,
  photoUpload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw badRequest('Choose a photo');
    const real = detectFileType(req.file.buffer);
    if (!real || !PHOTO_TYPES.includes(real.mime)) throw badRequest('The photo must be a JPEG, PNG or WebP image');
    req.user.photo = req.file.buffer;
    req.user.photoType = real.mime;
    req.user.photoUpdatedAt = new Date();
    await req.user.save();
    res.json({ user: publicUser(req.user) });
  })
);

router.delete(
  '/me/photo',
  requireAuth,
  asyncHandler(async (req, res) => {
    req.user.photo = undefined;
    req.user.photoType = undefined;
    req.user.photoUpdatedAt = null;
    await req.user.save();
    res.json({ user: publicUser(req.user) });
  })
);

export default router;
