import { ATTENDANCE_EVENT_TYPES, ROLES } from '../constants.js';

/*
 * Roles decide what a person may do. Team membership decides which team's
 * events they work on and whose attendance sheet they appear on.
 */

/**
 * Group-wide access: Scouts Leader, Scouts Leader Helpers and the
 * privileged members of the Database/Attendance team.
 * They can manage events and tasks of every team and of the whole group.
 */
export function hasGlobalAccess(user) {
  if (!user) return false;
  if (user.role === ROLES.SCOUT_LEADER || user.role === ROLES.SCOUT_LEADER_HELPER) return true;
  return user.role === ROLES.DATABASE_TEAM && user.isPrivileged === true;
}

/**
 * Everyone else can only manage events and tasks of their own team.
 * `team` null means a whole-group event: only group-wide leaders manage those.
 */
export function canManageTeam(user, team) {
  if (hasGlobalAccess(user)) return true;
  return Boolean(team) && Boolean(user?.team) && user.team === team;
}

/** Teams whose events this user can see (whole-group events are visible to everyone). */
export function visibleTeams(user, allTeams) {
  if (hasGlobalAccess(user)) return allTeams;
  return user?.team ? [user.team] : [];
}

export function canSeeEvent(user, event) {
  return event.team === null || event.team === undefined || canManageTeam(user, event.team) || user?.team === event.team;
}

/**
 * Who records attendance: anyone who manages the event, plus every member
 * of the Database/Attendance team (for any event that takes attendance).
 */
export function canRecordAttendance(user, event) {
  if (!ATTENDANCE_EVENT_TYPES.includes(event.type)) return false;
  return canManageTeam(user, event.team) || user?.role === ROLES.DATABASE_TEAM;
}

/** Who can create, edit and deactivate user accounts. */
export function canManageUsers(user) {
  return hasGlobalAccess(user);
}
