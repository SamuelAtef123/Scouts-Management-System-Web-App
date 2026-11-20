import { ATTENDANCE_EVENT_TYPES, ROLES, TEAMS } from '../constants.js';
import { ATTENDANCE_ASSIGNMENTS } from '../attendanceAssignments.js';

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
  const teams = [user?.team, attendanceTeamOf(user)].filter(Boolean);
  return allTeams.filter((t) => teams.includes(t));
}

export function canSeeEvent(user, event) {
  if (event.team === null || event.team === undefined) return true;
  return canViewAllTeams(user) || user?.team === event.team || attendanceTeamOf(user) === event.team;
}

/**
 * The team whose attendance this user takes, or null. ONLY Database/Attendance members take
 * attendance; their teams are fixed in `attendanceAssignments.js`, not set from the app.
 */
export function attendanceTeamOf(user) {
  if (user?.role !== ROLES.DATABASE_TEAM || !user.isActive) return null;
  return ATTENDANCE_ASSIGNMENTS[user.username] ?? null;
}

/**
 * Teams on this event's sheet that this user may record:
 * - a Team Session or Preparation Meeting: only the member assigned to the event's team;
 * - a Gawala Session (members of all teams): only the member assigned to Gawala, for every team.
 */
export function recordableTeams(user, event, allTeams) {
  if (!ATTENDANCE_EVENT_TYPES.includes(event.type)) return [];
  const team = attendanceTeamOf(user);
  if (!team) return [];
  if (event.type === 'gawala_session') return team === 'Gawala' ? allTeams : [];
  return event.team === team ? [team] : [];
}

export function canRecordAttendance(user, event) {
  return recordableTeams(user, event, TEAMS).length > 0;
}

/**
 * Preparation Meetings are created, edited and deleted only by the Scouts Leader,
 * the Scouts Leader Helpers, and a Team Leader for their own team.
 */
export function canManagePreparation(user, team) {
  if (user?.role === ROLES.SCOUT_LEADER || user?.role === ROLES.SCOUT_LEADER_HELPER) return true;
  return user?.role === ROLES.TEAM_LEADER && Boolean(team) && user.team === team;
}

/** Can create, edit or delete this event (an object with `type` and `team`). */
export function canManageEvent(user, event) {
  if (event.type === 'preparation_meeting') return canManagePreparation(user, event.team);
  return canManageTeam(user, event.team);
}

/**
 * Who can add, edit and deactivate member accounts: all 5 Database/Attendance members.
 * The 2 privileged ones manage every team; the other 3 only the team they are assigned to
 * (see memberTeams). The Scouts Leader and Helpers can only view members.
 */
export function canManageUsers(user) {
  return user?.role === ROLES.DATABASE_TEAM && memberTeams(user).length > 0;
}

/** Limited managers (the 3 non-privileged Database members) may only give these roles. */
export const TEAM_LEVEL_ROLES = [ROLES.TEAM_LEADER, ROLES.TEAM_LEADER_HELPER];

/**
 * Teams whose members this user can view on the Members page (details and attendance %):
 * - Scouts Leader, Helpers and the 2 privileged Database members: every team;
 * - the other 3 Database/Attendance members: only the team they take attendance for;
 * - everyone else: none (no Members page).
 */
export function memberTeams(user) {
  if (hasGlobalAccess(user)) return TEAMS;
  const team = attendanceTeamOf(user);
  return team ? [team] : [];
}

/** Who can open the Members page. */
export function canViewMembers(user) {
  return memberTeams(user).length > 0;
}
