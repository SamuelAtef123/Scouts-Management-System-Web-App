/*
 * WHO TAKES WHOSE ATTENDANCE — fixed in the code on purpose.
 *
 * Each of the 5 Database/Attendance team members takes attendance for exactly one team,
 * and each team has exactly one such member. This is NOT editable from the app:
 * to change it, edit this list (by the member's username) and redeploy the server.
 *
 * - Kadr Sessions and Preparation Meetings: recorded by the member assigned to the event's kadr.
 * - Gawala Sessions (all teams on one sheet): recorded by the member assigned to Gawala.
 *
 * The usernames below are the demo accounts from `npm run seed:demo`.
 * Replace them with the real usernames of the Database/Attendance team before going live.
 */
export const ATTENDANCE_ASSIGNMENTS = Object.freeze({
  marina: 'Gawala',
  kirollos: 'Ashbal',
  verina: 'Zahrat',
  bishoy: 'Kashafeen',
  mariam: 'Morshedat',
});
