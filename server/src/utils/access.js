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

/** Can view the events of every team: only group-wide leaders. */
export function canViewAllTeams(user) {
  return hasGlobalAccess(user);
}

/**
 * Teams whose events this user can see (whole-group events are visible to everyone).
 * A Database/Attendance member also sees the team they take attendance for.
 */
export function visibleTeams(user, allTeams) {
  if (canViewAllTeams(user)) return allTeams;
  const teams = [user?.team, user?.role === ROLES.DATABASE_TEAM ? user.attendanceTeam : null].filter(Boolean);
  return allTeams.filter((t) => teams.includes(t));
}

export function canSeeEvent(user, event) {
  if (event.team === null || event.team === undefined) return true;
  return canViewAllTeams(user) || user?.team === event.team || (user?.role === ROLES.DATABASE_TEAM && user.attendanceTeam === event.team);
}

/**
 * The team whose attendance this user takes, or null.
 * ONLY Database/Attendance members take attendance, each for their one assigned team.
 */
export function attendanceTeamOf(user) {
  return user?.role === ROLES.DATABASE_TEAM && user.attendanceTeam ? user.attendanceTeam : null;
}

/**
 * Can record attendance on this event: a Team Session of their assigned team, or their
 * team's section of a whole-group sheet (Preparation Meeting, Gawala Session).
 */
export function canRecordAttendance(user, event) {
  if (!ATTENDANCE_EVENT_TYPES.includes(event.type)) return false;
  const team = attendanceTeamOf(user);
  if (!team) return false;
  return event.team === null || event.team === undefined || event.team === team;
}

/** Who can create, edit and deactivate user accounts. */
export function canManageUsers(user) {
  return hasGlobalAccess(user);
}
