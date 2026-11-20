import { Router } from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { requireUserAdmin } from '../middleware/auth.js';
import { asyncHandler, badRequest, notFound } from '../utils/httpError.js';
import { hasGlobalAccess } from '../utils/access.js';
import { ROLES, ROLE_VALUES, TEAMS } from '../constants.js';

const router = Router();

/** Validates and normalises the editable fields of a user. */
function readUserFields(body, { partial }) {
  const out = {};
  if (!partial || body.name !== undefined) {
    out.name = String(body.name || '').trim();
    if (!out.name) throw badRequest('Name is required');
  }
  if (!partial || body.username !== undefined) out.username = String(body.username || '').trim().toLowerCase();
  if (body.phone !== undefined) out.phone = String(body.phone || '').trim();
  if (!partial || body.role !== undefined) {
    if (!ROLE_VALUES.includes(body.role)) throw badRequest('Choose a valid role');
    out.role = body.role;
  }
  if (body.team !== undefined) out.team = body.team || null;
  if (out.team && !TEAMS.includes(out.team)) throw badRequest('Choose a valid team');
  if (body.isPrivileged !== undefined) out.isPrivileged = Boolean(body.isPrivileged);
  if (body.attendanceTeam !== undefined) {
    out.attendanceTeam = body.attendanceTeam || null;
    if (out.attendanceTeam && !TEAMS.includes(out.attendanceTeam)) throw badRequest('Choose a valid team for attendance');
  }
  if (body.isActive !== undefined) out.isActive = Boolean(body.isActive);
  return out;
}

async function checkRoleTeam(user) {
  if (user.role !== ROLES.DATABASE_TEAM) {
    user.isPrivileged = false;
    user.attendanceTeam = null;
  } else if (user.isActive) {
    // Each Database/Attendance member takes attendance for exactly one team, and each team has one such member.
    if (!user.attendanceTeam) throw badRequest('Choose the team this member takes attendance for');
    const other = await User.findOne({
      _id: { $ne: user._id },
      role: ROLES.DATABASE_TEAM,
      isActive: true,
      attendanceTeam: user.attendanceTeam,
    }).select('name');
    if (other) throw badRequest(`${other.name} already takes attendance for the ${user.attendanceTeam} team`);
  }
  // Everyone belongs to a team: it decides whose attendance sheet they appear on.
  // Scouts Leader, Helpers and the Database team are normally in the Gawala team.
  if (!user.team) throw badRequest('Choose the team this member belongs to');
}

/**
 * List members. Everyone can list the members they could assign a task to:
 * group-wide users see everyone, others see their own team.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = {};
    const showInactive = req.query.includeInactive === 'true' && hasGlobalAccess(req.user);
    if (!showInactive) filter.isActive = true;

    if (req.query.team) filter.team = String(req.query.team);
    if (!hasGlobalAccess(req.user)) filter.team = req.user.team;

    const users = await User.find(filter).sort({ name: 1 });
    res.json({ users });
  })
);

router.post(
  '/',
  requireUserAdmin,
  asyncHandler(async (req, res) => {
    const fields = readUserFields(req.body, { partial: false });
    const password = String(req.body.password || '');
    if (password.length < 6) throw badRequest('The password must be at least 6 characters');
    if (await User.exists({ username: fields.username })) throw badRequest('This username is already taken');

    const user = new User(fields);
    await checkRoleTeam(user);
    await user.setPassword(password);
    await user.save();
    res.status(201).json({ user });
  })
);

router.put(
  '/:id',
  requireUserAdmin,
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw notFound('Member not found');
    const user = await User.findById(req.params.id);
    if (!user) throw notFound('Member not found');

    const fields = readUserFields(req.body, { partial: true });
    if (fields.username && fields.username !== user.username) {
      if (await User.exists({ username: fields.username })) throw badRequest('This username is already taken');
    }
    if (user._id.equals(req.user._id) && (fields.isActive === false || (fields.role && fields.role !== user.role))) {
      throw badRequest('You cannot deactivate yourself or change your own role');
    }

    Object.assign(user, fields);
    await checkRoleTeam(user);
    if (req.body.password) {
      if (String(req.body.password).length < 6) throw badRequest('The password must be at least 6 characters');
      await user.setPassword(String(req.body.password));
    }
    await user.save();
    res.json({ user });
  })
);

export default router;
