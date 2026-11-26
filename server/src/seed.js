/*
 * Creates the first account (the Group Leader) so someone can sign in
 * and add the other members from the Members page.
 *
 *   npm run seed                 -> creates the Group Leader account
 *   npm run seed -- --demo       -> also adds demo members, events and tasks (for trying the app)
 *
 * The Group Leader login is read from SEED_ADMIN_USERNAME / SEED_ADMIN_PASSWORD / SEED_ADMIN_NAME.
 */
import mongoose from 'mongoose';
import { config } from './config.js';
import { User } from './models/User.js';
import { Event } from './models/Event.js';
import { Task } from './models/Task.js';
import { ROLES, TEAMS } from './constants.js';
import { ATTENDANCE_ASSIGNMENTS } from './attendanceAssignments.js';

const DEMO_PASSWORD = 'scouts123';

async function upsertUser({ password, ...fields }) {
  let user = await User.findOne({ username: fields.username });
  if (user) return { user, created: false };
  user = new User(fields);
  await user.setPassword(password);
  await user.save();
  return { user, created: true };
}

function daysFromNow(days, hour = 17) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d;
}

async function seedDemo(leader) {
  // The Group Leader, Helpers and the Database team belong to the Gawala kadr.
  const members = [
    { name: 'Mina Leader Helper', username: 'mina', role: ROLES.SCOUT_LEADER_HELPER, team: 'Gawala' },
    // The 5 Database/Attendance members (2 privileged). Whose attendance each takes is fixed in attendanceAssignments.js.
    { name: 'Marina Database', username: 'marina', role: ROLES.DATABASE_TEAM, isPrivileged: true, team: 'Gawala' },
    { name: 'Kirollos Database', username: 'kirollos', role: ROLES.DATABASE_TEAM, team: 'Gawala' },
    { name: 'Verina Database', username: 'verina', role: ROLES.DATABASE_TEAM, isPrivileged: true, team: 'Gawala' },
    { name: 'Bishoy Database', username: 'bishoy', role: ROLES.DATABASE_TEAM, team: 'Gawala' },
    { name: 'Mariam Database', username: 'mariam', role: ROLES.DATABASE_TEAM, team: 'Gawala' },
  ];
  TEAMS.forEach((team) => {
    const t = team.toLowerCase();
    members.push({ name: `${team} Kadr Leader`, username: `${t}.leader`, role: ROLES.TEAM_LEADER, team });
    members.push({ name: `${team} Helper One`, username: `${t}.helper1`, role: ROLES.TEAM_LEADER_HELPER, team });
    members.push({ name: `${team} Helper Two`, username: `${t}.helper2`, role: ROLES.TEAM_LEADER_HELPER, team });
  });

  const users = {};
  for (const m of members) {
    const { user } = await upsertUser({ ...m, password: DEMO_PASSWORD });
    users[m.username] = user;
  }

  if (await Event.exists({})) {
    console.log('Events already exist, demo events were not added.');
    return;
  }

  // team null = a whole-group event (Preparation Meeting, Gawala Session).
  const plan = [
    { type: 'team_session', team: 'Ashbal', title: 'Weekly meeting: knots & first aid', start: 2, location: 'Church yard', tasks: ['Prepare knots worksheet', 'First aid kit check'] },
    { type: 'team_session', team: 'Zahrat', title: 'Saint Mary celebration rehearsal', start: 5, location: 'Main hall', tasks: ['Hymns booklet', 'Costumes list'] },
    { type: 'other', team: 'Kashafeen', title: 'Camping trip', start: 12, end: 14, location: 'Wadi Degla', tasks: ['Camp schedule', 'Equipment list', 'Permission forms'] },
    { type: 'team_session', team: 'Morshedat', title: 'Leadership workshop', start: 8, location: 'Room 3', tasks: ['Workshop slides'] },
    { type: 'team_session', team: 'Gawala', title: 'Gawala kadr session', start: 6, location: 'Room 1', tasks: [] },
    { type: 'gawala_session', team: null, title: 'Gawala monthly gathering', start: 3, location: 'Church yard', tasks: ['Agenda', 'Photos of last month'] },
    { type: 'preparation_meeting', team: 'Kashafeen', title: 'Preparation meeting for the camp', start: 1, location: 'Main hall', tasks: [] },
    { type: 'team_session', team: 'Ashbal', title: 'Bible competition', start: -10, location: 'Main hall', tasks: ['Questions sheet'], attendance: true },
    { type: 'preparation_meeting', team: 'Ashbal', title: 'Preparation meeting for the Bible competition', start: -14, location: 'Main hall', tasks: [], attendance: true },
    { type: 'gawala_session', team: null, title: 'Gawala session: serving together', start: -7, location: 'Church yard', tasks: [], attendance: true },
  ];

  const statuses = ['present', 'present', 'present', 'absent', 'excused'];
  for (const p of plan) {
    const owner = p.team ? p.team.toLowerCase() : 'gawala';
    const event = new Event({
      type: p.type,
      title: p.title,
      team: p.team,
      description: p.team ? `Demo event for the ${p.team} kadr.` : 'Demo event for the whole group.',
      location: p.location,
      startDate: daysFromNow(p.start),
      endDate: p.end ? daysFromNow(p.end) : undefined,
      createdBy: p.team ? users[`${owner}.leader`]._id : leader._id,
    });
    if (p.attendance) {
      // A team's attendance is taken by its Database/Attendance member; a Gawala Session's by the Gawala one.
      const dbByTeam = Object.fromEntries(
        Object.entries(ATTENDANCE_ASSIGNMENTS).filter(([username]) => users[username]).map(([username, team]) => [team, users[username]])
      );
      for (const team of p.team ? [p.team] : TEAMS) {
        const sheet = await User.find({ isActive: true, team }).sort({ name: 1 });
        sheet.forEach((u, i) => event.attendance.push({ user: u._id, team, status: statuses[i % statuses.length] }));
        const recorder = dbByTeam[p.type === 'gawala_session' ? 'Gawala' : team] || leader;
        event.attendanceTeams.push({ team, takenAt: daysFromNow(p.start, 19), takenBy: recorder._id });
      }
    }
    await event.save();

    for (const [i, title] of p.tasks.entries()) {
      await Task.create({
        title,
        event: event._id,
        team: event.team,
        assignee: users[i % 2 === 0 ? `${owner}.helper1` : `${owner}.helper2`]._id,
        createdBy: event.createdBy,
        dueDate: daysFromNow(p.start - 1),
        status: p.start < 0 ? 'done' : 'todo',
      });
    }
  }
  // Give the Group Leader one task too, so their home screen is not empty.
  const gathering = await Event.findOne({ type: 'gawala_session' });
  await Task.create({
    title: 'Opening word for the gathering',
    event: gathering._id,
    team: null,
    assignee: leader._id,
    createdBy: users.marina._id,
    dueDate: daysFromNow(2),
  });

  console.log(`Demo data added. Every demo member's password is "${DEMO_PASSWORD}" (e.g. username "ashbal.leader").`);
}

async function main() {
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 8000 }).catch((err) => {
    throw new Error(`Could not connect to MongoDB (${err.message}). Make sure MongoDB is running, or set MONGO_URI in server/.env.`);
  });

  const username = (process.env.SEED_ADMIN_USERNAME || 'leader').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || (config.isProduction ? '' : 'leader1234');
  if (password.length < 8) throw new Error('Set SEED_ADMIN_PASSWORD (at least 8 characters)');

  const { user: leader, created } = await upsertUser({
    name: process.env.SEED_ADMIN_NAME || 'Group Leader',
    username,
    password,
    role: ROLES.SCOUT_LEADER,
    team: 'Gawala',
  });
  console.log(created ? `Created the Group Leader account "${username}" (name: "${leader.name}"; set SEED_ADMIN_NAME to use the real name).` : `Account "${username}" already exists, left unchanged.`);

  if (process.argv.includes('--demo')) {
    // Demo accounts share a known password; never create them on the live system.
    if (config.isProduction) throw new Error('Demo data cannot be added when NODE_ENV=production');
    await seedDemo(leader);
  }
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err.message);
  await mongoose.disconnect();
  process.exit(1);
});
