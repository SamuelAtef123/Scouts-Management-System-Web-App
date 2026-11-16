import { ROLES } from '../constants.js';

/**
 * Group-wide access: Scouts Leader, Scouts Leader Helpers and the
 * privileged members of the Database/Attendance team.
 * They can manage events and tasks of every team.
 */
export function hasGlobalAccess(user) {
  if (!user) return false;
  if (user.role === ROLES.SCOUT_LEADER || user.role === ROLES.SCOUT_LEADER_HELPER) return true;
  return user.role === ROLES.DATABASE_TEAM && user.isPrivileged === true;
}

/** Everyone else can only manage events and tasks of their own team. */
export function canManageTeam(user, team) {
  if (hasGlobalAccess(user)) return true;
  return Boolean(user?.team) && user.team === team;
}

/** Teams this user is allowed to see. */
export function visibleTeams(user, allTeams) {
  if (hasGlobalAccess(user)) return allTeams;
  return user?.team ? [user.team] : [];
}

/** Who can create, edit and deactivate user accounts. */
export function canManageUsers(user) {
  return hasGlobalAccess(user);
}
