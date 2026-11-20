import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { User } from '../models/User.js';
import { HttpError, asyncHandler } from '../utils/httpError.js';
import { canManageUsers, canViewMembers } from '../utils/access.js';

export function signToken(user) {
  return jwt.sign({ sub: user._id.toString() }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new HttpError(401, 'Please sign in');

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    throw new HttpError(401, 'Your session has expired, please sign in again');
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) throw new HttpError(401, 'Your account is not active');
  req.user = user;
  next();
});

export function requireUserAdmin(req, _res, next) {
  if (!canManageUsers(req.user)) return next(new HttpError(403, 'Only the Database/Attendance team can add or edit members'));
  next();
}

export function requireMemberViewer(req, _res, next) {
  if (!canViewMembers(req.user)) return next(new HttpError(403, 'You cannot view member details'));
  next();
}
