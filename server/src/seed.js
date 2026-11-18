/*
 * Creates the first account (the Scouts Leader) so someone can sign in
 * and add the other members from the Members page.
 *
 *   npm run seed                 -> creates the Scouts Leader account
 *   npm run seed -- --demo       -> also adds demo members, events and tasks (for trying the app)
 *
 * The Scouts Leader login is read from SEED_ADMIN_USERNAME / SEED_ADMIN_PASSWORD / SEED_ADMIN_NAME.
 */
import mongoose from 'mongoose';
import { config } from './config.js';
import { User } from './models/User.js';
import { Event } from './models/Event.js';
import { Task } from './models/Task.js';
import { ROLES, TEAMS } from './constants.js';

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
  const members = [
    { name: 'Mina Leader Helper', username: 'mina', role: ROLES.SCOUT_LEADER_HELPER },
    { name: 'Marina Database', username: 'marina', role: ROLES.DATABASE_TEAM, isPrivileged: true, team: 'Gawala' },
    { name: 'Kirollos Database', username: 'kirollos', role: ROLES.DATABASE_TEAM, team: 'Gawala' },
  ];
  TEAMS.forEach((team) => {
    const t = team.toLowerCase();
    members.push({ name: `${team} Team Leader`, username: `${t}.leader`, role: ROLES.TEAM_LEADER, team });
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

  const plan = [
    { team: 'Ashbal', title: 'Weekly meeting: knots & first aid', start: 2, location: 'Church yard', tasks: ['Prepare knots worksheet', 'First aid kit check'] },
    { team: 'Zahrat', title: 'Saint Mary celebration rehearsal', start: 5, location: 'Main hall', tasks: ['Hymns booklet', 'Costumes list'] },
    { team: 'Kashafeen', title: 'Camping trip', start: 12, end: 14, location: 'Wadi Degla', tasks: ['Camp schedule', 'Equipment list', 'Permission forms'] },
    { team: 'Morshedat', title: 'Leadership workshop', start: 8, location: 'Room 3', tasks: ['Workshop slides'] },
    { team: 'Gawala', title: 'Gawala monthly gathering', start: 3, location: 'Church yard', tasks: ['Agenda', 'Photos of last month'] },
    { team: 'Ashbal', title: 'Bible competition', start: -10, location: 'Main hall', tasks: ['Questions sheet'] },
  ];

  for (const p of plan) {
    const t = p.team.toLowerCase();
    const event = await Event.create({
      title: p.title,
      team: p.team,
      description: `Demo event for the ${p.team} team.`,
      location: p.location,
      startDate: daysFromNow(p.start),
      endDate: p.end ? daysFromNow(p.end) : undefined,
      createdBy: users[`${t}.leader`]._id,
    });
    for (const [i, title] of p.tasks.entries()) {
      await Task.create({
        title,
        event: event._id,
        team: p.team,
        assignee: users[i % 2 === 0 ? `${t}.helper1` : `${t}.helper2`]._id,
        createdBy: users[`${t}.leader`]._id,
        dueDate: daysFromNow(p.start - 1),
        status: p.start < 0 ? 'done' : 'todo',
      });
    }
  }
  // Give the Scouts Leader one task too, so their home screen is not empty.
  const gathering = await Event.findOne({ team: 'Gawala' });
  await Task.create({
    title: 'Opening word for the gathering',
    event: gathering._id,
    team: 'Gawala',
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
  const password = process.env.SEED_ADMIN_PASSWORD || (config.isProduction ? '' : 'leader123');
  if (password.length < 6) throw new Error('Set SEED_ADMIN_PASSWORD (at least 6 characters)');

  const { user: leader, created } = await upsertUser({
    name: process.env.SEED_ADMIN_NAME || 'Scouts Leader',
    username,
    password,
    role: ROLES.SCOUT_LEADER,
  });
  console.log(created ? `Created the Scouts Leader account "${username}".` : `Account "${username}" already exists, left unchanged.`);

  if (process.argv.includes('--demo')) await seedDemo(leader);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err.message);
  await mongoose.disconnect();
  process.exit(1);
});
