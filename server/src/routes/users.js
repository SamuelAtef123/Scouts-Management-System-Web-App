import { Router } from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { requireMemberViewer, requireUserAdmin } from '../middleware/auth.js';
import { attendanceRates, attendanceStats } from './stats.js';
import { asyncHandler, badRequest, forbidden, notFound } from '../utils/httpError.js';
import { TEAM_LEVEL_ROLES, canViewMembers, hasGlobalAccess, memberTeams } from '../utils/access.js';
import { ROLES, ROLE_VALUES, TEAMS } from '../constants.js';
import { ATTENDANCE_ASSIGNMENTS } from '../attendanceAssignments.js';
import { normalizePhone } from '../utils/phone.js';

const router = Router();

/** Validates and normalises the editable fields of a user. */
function readUserFields(body, { partial }) {
  const out = {};
  if (!partial || body.name !== undefined) {
    out.name = String(body.name || '').trim();
    if (!out.name) throw badRequest('Name is required');
  }
  if (!partial || body.username !== undefined) out.username = String(body.username || '').trim().toLowerCase();
  if (body.phone !== undefined) out.phone = normalizePhone(body.phone);
  if (!partial || body.role !== undefined) {
    if (!ROLE_VALUES.includes(body.role)) throw badRequest('Choose a valid role');
    out.role = body.role;
  }
  if (body.team !== undefined) out.team = body.team || null;
  if (out.team && !TEAMS.includes(out.team)) throw badRequest('Choose a valid kadr');
  if (body.isPrivileged !== undefined) out.isPrivileged = Boolean(body.isPrivileged);
  if (body.isActive !== undefined) out.isActive = Boolean(body.isActive);
  return out;
}

/**
 * A non-privileged Database member manages only their assigned team: the member must be
 * (and stay) in that team, and can only be a Team Leader or Team Leader Helper.
 */
function checkManagerScope(manager, member, { before } = {}) {
  if (hasGlobalAccess(manager)) return;
  const teams = memberTeams(manager);
  if (before && !teams.includes(before.team)) throw notFound('Member not found');
  if (before && !TEAM_LEVEL_ROLES.includes(before.role)) {
    throw forbidden('Only the Group Leaders and privileged Database members can edit this member');
  }
  if (!teams.includes(member.team)) throw forbidden('You can only manage members of the kadr assigned to you');
  if (!TEAM_LEVEL_ROLES.includes(member.role)) throw forbidden('You can only add Kadr Leaders and Kadr Leader Helpers');
  if (member.isPrivileged) throw forbidden('You cannot make a member privileged');
}

function checkRoleTeam(user) {
  if (user.role !== ROLES.DATABASE_TEAM) user.isPrivileged = false;
  // Everyone belongs to a team: it decides whose attendance sheet they appear on.
  // Scouts Leader, Helpers and the Database team are normally in the Gawala team.
  if (!user.team) throw badRequest('Choose the kadr this member belongs to');
}

/**
 * List members. Everyone can list the members they could assign a task to:
 * group-wide users see everyone, others see their own team.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = {};
    // scope=members: the Members page (only teams this user may view there).
    const membersPage = req.query.scope === 'members';
    if (membersPage && !canViewMembers(req.user)) throw forbidden('You cannot view members');
    const showInactive = membersPage && req.query.includeInactive === 'true';
    if (!showInactive) filter.isActive = true;

    if (req.query.team) filter.team = String(req.query.team);
    if (membersPage) {
      if (!hasGlobalAccess(req.user)) filter.team = { $in: memberTeams(req.user) };
    } else if (!hasGlobalAccess(req.user)) {
      // For assigning tasks: team-only leaders see their own team.
      filter.team = req.user.team;
    }

    // For assigning tasks, only what the picker needs (no phone numbers or account details).
    const fields = membersPage ? undefined : 'name username team role';
    const users = await User.find(filter, fields).sort({ name: 1 });
    res.json({ users });
  })
);

// Attendance percentage of every member, for the Members page.
router.get(
  '/attendance',
  requireMemberViewer,
  asyncHandler(async (req, res) => {
    const rates = await attendanceRates();
    if (hasGlobalAccess(req.user)) return res.json({ rates });
    // Limited viewers only get the rates of members of the teams they may view.
    const ids = await User.find({ team: { $in: memberTeams(req.user) } }).distinct('_id');
    const allowed = new Set(ids.map(String));
    res.json({ rates: Object.fromEntries(Object.entries(rates).filter(([id]) => allowed.has(id))) });
  })
);

// One member's details and attendance breakdown (view only).
router.get(
  '/:id',
  requireMemberViewer,
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw notFound('Member not found');
    const user = await User.findById(req.params.id);
    if (!user || !memberTeams(req.user).includes(user.team)) throw notFound('Member not found');
    res.json({ user, attendance: await attendanceStats(user._id) });
  })
);

router.post(
  '/',
  requireUserAdmin,
  asyncHandler(async (req, res) => {
    const fields = readUserFields(req.body, { partial: false });
    const password = String(req.body.password || '');
    if (password.length < 8) throw badRequest('The password must be at least 8 characters');
    if (await User.exists({ username: fields.username })) throw badRequest('This username is already taken');

    const user = new User(fields);
    checkRoleTeam(user);
    checkManagerScope(req.user, user);
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

    const before = { team: user.team, role: user.role };
    checkManagerScope(req.user, user, { before });
    const fields = readUserFields(req.body, { partial: true });
    if (fields.username && fields.username !== user.username && ATTENDANCE_ASSIGNMENTS[user.username]) {
      throw badRequest('This username is used in the fixed attendance assignments, so it cannot be changed from the app');
    }
    if (fields.username && fields.username !== user.username) {
      if (await User.exists({ username: fields.username })) throw badRequest('This username is already taken');
    }
    if (user._id.equals(req.user._id) && (fields.isActive === false || (fields.role && fields.role !== user.role))) {
      throw badRequest('You cannot deactivate yourself or change your own role');
    }

    Object.assign(user, fields);
    checkRoleTeam(user);
    checkManagerScope(req.user, user, { before });
    if (req.body.password) {
      if (String(req.body.password).length < 8) throw badRequest('The password must be at least 8 characters');
      await user.setPassword(String(req.body.password));
    }
    await user.save();
    res.json({ user });
  })
);

export default router;
