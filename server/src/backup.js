/*
 * Saves a copy of the whole database.
 *
 *   npm run backup                      -> to the private "Scouts - backups" folder in Google Drive
 *   npm run backup -- --to <folder>     -> to a folder on this computer instead
 *
 * Restore one with `npm run restore` (see restore.js).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { config } from './config.js';
import { backupName, describeCounts, dumpDatabase } from './backup/data.js';
import { saveToDrive } from './backup/drive.js';

/** Saves a backup and returns where it went. Used by restore.js for its safety copy too. */
export async function saveBackup(name, { to } = {}) {
  const { buffer, counts } = await dumpDatabase();
  let where;
  if (to) {
    await fs.mkdir(to, { recursive: true });
    where = path.resolve(to, name);
    await fs.writeFile(where, buffer);
  } else {
    await saveToDrive(name, buffer);
    where = `Google Drive / Scouts - backups / ${name}`;
  }
  return { where, counts, size: buffer.length };
}

export async function connect() {
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 10000 }).catch((err) => {
    throw new Error(`Could not connect to MongoDB (${err.message}). Check MONGO_URI in server/.env.`);
  });
}

const kb = (n) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`);

async function main() {
  const i = process.argv.indexOf('--to');
  const to = i > -1 ? process.argv[i + 1] : undefined;
  if (i > -1 && !to) throw new Error('Write the folder after --to, for example: npm run backup -- --to C:\\Backups');
  await connect();
  const { where, counts, size } = await saveBackup(backupName(), { to });
  console.log(`Backup saved (${kb(size)}): ${where}`);
  console.log(`Contains ${describeCounts(counts)}.`);
}

// Only run when started as `npm run backup`, not when imported by restore.js.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
    .catch((err) => {
      console.error(`Backup failed: ${err.message}`);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}
