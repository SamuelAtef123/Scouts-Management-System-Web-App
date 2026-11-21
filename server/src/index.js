import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import multer from 'multer';
import { config } from './config.js';
import { requireAuth } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import eventRoutes from './routes/events.js';
import taskRoutes from './routes/tasks.js';
import statsRoutes from './routes/stats.js';
import { LOCAL_UPLOAD_DIR, isDriveEnabled } from './services/storage.js';
import { TEAMS } from './constants.js';
import { User } from './models/User.js';
import { Task } from './models/Task.js';
import { fixFileName } from './utils/fileName.js';
import { ATTENDANCE_ASSIGNMENTS } from './attendanceAssignments.js';

const app = express();
const here = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(here, '../../client/dist');

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'same-site' } }));
app.use(cors({ origin: config.clientOrigin }));
app.use(express.json({ limit: '1mb' }));
if (!config.isProduction) app.use(morgan('dev'));

app.get('/api/health', (_req, res) => res.json({ ok: true, drive: isDriveEnabled() }));
app.get('/api/meta', (_req, res) => res.json({ teams: TEAMS }));
app.use('/api/auth', authRoutes);
app.use('/api/users', requireAuth, userRoutes);
app.use('/api/events', requireAuth, eventRoutes);
app.use('/api/tasks', requireAuth, taskRoutes);
app.use('/api/stats', requireAuth, statsRoutes);

// Local file storage fallback (only used when Google Drive is not configured).
app.use('/uploads', express.static(LOCAL_UPLOAD_DIR, { fallthrough: false }));

app.use('/api', (_req, res) => res.status(404).json({ message: 'Not found' }));

// In production the Express server also serves the built React app.
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? `Files must be smaller than ${config.maxUploadMb} MB` : err.message;
    return res.status(400).json({ message });
  }
  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({ message: Object.values(err.errors)[0]?.message || 'Invalid data' });
  }
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ message: status >= 500 ? 'Something went wrong, please try again' : err.message });
});

/** The fixed attendance assignments must name 5 different teams and real Database/Attendance accounts. */
async function checkAttendanceAssignments() {
  const entries = Object.entries(ATTENDANCE_ASSIGNMENTS);
  const teams = entries.map(([, team]) => team);
  const bad = teams.filter((t) => !TEAMS.includes(t));
  if (bad.length) throw new Error(`attendanceAssignments.js: unknown team(s) ${bad.join(', ')}`);
  const dupes = teams.filter((t, i) => teams.indexOf(t) !== i);
  if (dupes.length) throw new Error(`attendanceAssignments.js: ${dupes.join(', ')} assigned to more than one member`);
  const missingTeams = TEAMS.filter((t) => !teams.includes(t));
  if (missingTeams.length) console.warn(`Warning: nobody takes attendance for ${missingTeams.join(', ')} (see attendanceAssignments.js)`);

  const found = await User.find({ username: { $in: entries.map(([u]) => u) } }).select('username role isActive').lean();
  for (const [username, team] of entries) {
    const u = found.find((x) => x.username === username);
    if (!u) console.warn(`Warning: attendanceAssignments.js names "${username}" (${team}), but no such account exists`);
    else if (u.role !== 'database_team') console.warn(`Warning: "${username}" (${team}) is not in the Database/Attendance team, so cannot take attendance`);
    else if (!u.isActive) console.warn(`Warning: "${username}" (${team}) is deactivated, so ${team} attendance cannot be taken`);
  }
}

/** Fixes Arabic file names that were saved scrambled before uploads decoded them correctly. */
async function repairMaterialNames() {
  const tasks = await Task.find({ 'materials.fileName': { $regex: '[\u0080-\u00ff]' } });
  let fixed = 0;
  for (const task of tasks) {
    for (const m of task.materials) {
      const name = fixFileName(m.fileName);
      if (name !== m.fileName) {
        m.fileName = name;
        fixed += 1;
      }
    }
    if (task.isModified()) await task.save();
  }
  if (fixed) console.log(`Fixed ${fixed} uploaded file name(s) with Arabic text`);
}

async function start() {
  try {
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 8000 });
  } catch (err) {
    console.error(`\nCould not connect to MongoDB at ${config.mongoUri.replace(/\/\/[^@]*@/, '//***@')}`);
    console.error('Make sure MongoDB is installed and running, or set MONGO_URI in server/.env to your MongoDB Atlas connection string.\n');
    throw err;
  }

  // Everyone belongs to a team now (it decides attendance sheets). Accounts created before
  // that rule had no team only for group roles, which belong to the Gawala team.
  const moved = await User.updateMany({ $or: [{ team: null }, { team: { $exists: false } }] }, { team: 'Gawala' });
  if (moved.modifiedCount) console.log(`Moved ${moved.modifiedCount} member(s) without a team into the Gawala team`);
  await checkAttendanceAssignments();
  await repairMaterialNames();
  app.listen(config.port, () => {
    console.log(`Server running on http://localhost:${config.port}`);
    console.log(isDriveEnabled() ? 'Uploads go to Google Drive' : `Google Drive not configured: uploads saved in ${LOCAL_UPLOAD_DIR}`);
  });
}

start().catch((err) => {
  console.error('Failed to start the server:', err.message);
  process.exit(1);
});
