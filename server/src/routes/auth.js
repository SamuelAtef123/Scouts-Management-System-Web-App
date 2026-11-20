import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { User } from '../models/User.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { asyncHandler, badRequest, HttpError } from '../utils/httpError.js';
import { hasGlobalAccess, canManageUsers, canViewAllTeams } from '../utils/access.js';

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
      takeAttendance: user.role === 'database_team',
      manageUsers: canManageUsers(user),
    },
  };
}

router.post(
  '/login',
  loginLimiter,
  asyncHandler(async (req, res) => {
    const username = String(req.body.username || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!username || !password) throw badRequest('Enter your username and password');

    const user = await User.findOne({ username }).select('+passwordHash');
    if (!user || !(await user.checkPassword(password))) {
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
    if (String(newPassword).length < 6) throw badRequest('The new password must be at least 6 characters');

    const user = await User.findById(req.user._id).select('+passwordHash');
    if (!(await user.checkPassword(String(currentPassword)))) throw badRequest('Your current password is wrong');

    await user.setPassword(String(newPassword));
    await user.save();
    res.json({ ok: true });
  })
);

export default router;
