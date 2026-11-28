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
 * These are the real usernames of the Database/Attendance team (lowercase, as stored).
 * ramez.samy and michael.gamil are the 2 privileged members (set on their accounts, not here).
 * `npm run seed:demo` creates demo accounts with these usernames on a test database.
 */
export const ATTENDANCE_ASSIGNMENTS = Object.freeze({
  'michael.gamil': 'Gawala',
  'lavy.hani': 'Ashbal',
  'sandra.rafaat': 'Zahrat',
  'ramez.samy': 'Kashafeen',
  'marina.maged': 'Morshedat',
});
