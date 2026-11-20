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

/**
 * Can view the events of every team. Group-wide leaders, plus all 5 Database/Attendance
 * members, who take attendance for every team's sessions (viewing is not managing).
 */
export function canViewAllTeams(user) {
  return hasGlobalAccess(user) || user?.role === ROLES.DATABASE_TEAM;
}

/** Teams whose events this user can see (whole-group events are visible to everyone). */
export function visibleTeams(user, allTeams) {
  if (canViewAllTeams(user)) return allTeams;
  return user?.team ? [user.team] : [];
}

export function canSeeEvent(user, event) {
  if (event.team === null || event.team === undefined) return true;
  return canViewAllTeams(user) || user?.team === event.team;
}

/**
 * Who records attendance: ONLY the 5 members of the Database/Attendance team
 * (privileged or not), for any event that takes attendance. No other role can.
 */
export function canRecordAttendance(user, event) {
  if (!ATTENDANCE_EVENT_TYPES.includes(event.type)) return false;
  return user?.role === ROLES.DATABASE_TEAM;
}

/** Who can create, edit and deactivate user accounts. */
export function canManageUsers(user) {
  return hasGlobalAccess(user);
}
