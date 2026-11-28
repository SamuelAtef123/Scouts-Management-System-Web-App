import { Router } from 'express';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { requireMemberViewer, requireUserAdmin } from '../middleware/auth.js';
import { attendanceRates, attendanceStats } from './stats.js';
import { asyncHandler, badRequest, forbidden, notFound } from '../utils/httpError.js';
import { TEAM_LEVEL_ROLES, canViewMembers, hasGlobalAccess, memberTeams } from '../utils/access.js';
import { ROLES, ROLE_LIMITS, ROLE_VALUES, TEAMS } from '../constants.js';
import { ATTENDANCE_ASSIGNMENTS } from '../attendanceAssignments.js';
import { normalizePhone } from '../utils/phone.js';
import { normalizeEmail } from '../utils/email.js';
import { config } from '../config.js';

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
  // Optional here: a member without an email is asked for it on their next sign-in.
  if (body.email !== undefined) out.email = normalizeEmail(body.email);
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

const LIMIT_MESSAGES = {
  scout_leader: 'There can only be 1 active Group Leader. Deactivate the current one first.',
  scout_leader_helper: 'There can only be 2 active Group Leader Helpers. Deactivate one first.',
  database_team: 'There can only be 5 active Database / Attendance members. Deactivate one first.',
  team_leader: 'There can only be 5 active Kadr Leaders. Deactivate one first.',
};

/** Keeps the number of active accounts per role within ROLE_LIMITS (and one Kadr Leader per kadr). */
async function checkRoleLimits(user) {
  if (!user.isActive) return;
  const others = { _id: { $ne: user._id }, isActive: true };
  if (user.role === ROLES.TEAM_LEADER && (await User.exists({ ...others, role: ROLES.TEAM_LEADER, team: user.team }))) {
    throw badRequest('This kadr already has an active Kadr Leader. Deactivate them first, or choose Kadr Leader Helper.');
  }
  const limit = ROLE_LIMITS[user.role];
  if (limit && (await User.countDocuments({ ...others, role: user.role })) >= limit) throw badRequest(LIMIT_MESSAGES[user.role]);
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
    // Optional: without one, the account starts with the default password (scouts123).
    const password = String(req.body.password || '') || config.defaultMemberPassword;
    if (password.length < 8) throw badRequest('The password must be at least 8 characters');
    if (await User.exists({ username: fields.username })) throw badRequest('This username is already taken');
    if (fields.email && (await User.exists({ email: fields.email }))) throw badRequest('This email is already used by another member');

    const user = new User(fields);
    checkRoleTeam(user);
    checkManagerScope(req.user, user);
    await checkRoleLimits(user);
    await user.setPassword(password);
    user.mustChangePassword = true; // they choose their own on first sign-in
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
    if (fields.email && fields.email !== user.email) {
      if (await User.exists({ email: fields.email, _id: { $ne: user._id } })) throw badRequest('This email is already used by another member');
    }
    if (user._id.equals(req.user._id) && (fields.isActive === false || (fields.role && fields.role !== user.role))) {
      throw badRequest('You cannot deactivate yourself or change your own role');
    }

    Object.assign(user, fields);
    if (user.isModified('email')) user.emailVerified = false; // confirmed by the person at their next sign-in
    checkRoleTeam(user);
    checkManagerScope(req.user, user, { before });
    // Only when this edit could add one more active account to a limited role.
    if (user.isModified('role') || user.isModified('team') || user.isModified('isActive')) await checkRoleLimits(user);
    if (req.body.password) {
      if (String(req.body.password).length < 8) throw badRequest('The password must be at least 8 characters');
      await user.setPassword(String(req.body.password));
      // A password reset by someone else is temporary: they choose their own on next sign-in.
      if (!user._id.equals(req.user._id)) user.mustChangePassword = true;
    }
    await user.save();
    res.json({ user });
  })
);

export default router;
