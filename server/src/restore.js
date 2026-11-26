/*
 * Puts a backup back into the database, REPLACING all current members, events, tasks and attendance.
 *
 *   npm run restore                         -> lists the backups in Google Drive
 *   npm run restore -- latest               -> restores the newest one
 *   npm run restore -- <backup name>        -> restores that one (name as listed)
 *   npm run restore -- <path to a file>     -> restores a backup file from this computer
 *
 * Before replacing anything it shows what the backup holds, asks you to type RESTORE, and saves a
 * safety copy of the current data ("scouts-before-restore-…") so a wrong restore can be undone.
 * Stop the server while restoring, then start it again.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline/promises';
import mongoose from 'mongoose';
import { backupName, describeCounts, loadDatabase, readBackupFile } from './backup/data.js';
import { downloadFromDrive, listDriveBackups } from './backup/drive.js';
import { connect, saveBackup } from './backup.js';

const args = process.argv.slice(2).filter((a) => a !== '--yes');
const which = args[0];
const skipQuestion = process.argv.includes('--yes');

async function pickBackup() {
  if (which && (/[\\/]/.test(which) || (await fs.stat(which).then(() => true, () => false)))) {
    return { name: path.basename(which), buffer: await fs.readFile(which), local: true };
  }
  const all = await listDriveBackups();
  if (!which) {
    if (!all.length) console.log('No backups found in Google Drive / Scouts - backups. Make one with: npm run backup');
    else {
      console.log('Backups in Google Drive / Scouts - backups (newest first):');
      for (const f of all) console.log(`  ${f.name}   (${Math.ceil(Number(f.size) / 1024)} KB, saved ${new Date(f.modifiedTime).toLocaleString()})`);
      console.log('\nTo restore one:  npm run restore -- <name>    or    npm run restore -- latest');
    }
    return null;
  }
  // latest = the most recently written backup (by hand or automatic), not a safety copy taken before a restore.
  const found = which === 'latest' ? all.find((f) => f.name.startsWith('scouts-backup-')) ?? all[0] : all.find((f) => f.name === which);
  if (!found) throw new Error(`No backup named "${which}" in Google Drive / Scouts - backups. Run "npm run restore" to list them.`);
  return { name: found.name, buffer: await downloadFromDrive(found.id) };
}

async function main() {
  await connect();
  const picked = await pickBackup();
  if (!picked) return;
  const backup = readBackupFile(picked.buffer);
  console.log(`Backup: ${picked.name}`);
  console.log(`Made on: ${new Date(backup.createdAt).toLocaleString()}`);
  console.log(`Contains ${describeCounts(backup.counts)}.`);
  console.log('\nThis REPLACES all current members, events, tasks and attendance with the backup.');

  if (!skipQuestion) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question('Type RESTORE to continue, or anything else to cancel: ');
    rl.close();
    if (answer.trim() !== 'RESTORE') return console.log('Cancelled. Nothing was changed.');
  }

  // A safety copy of the data as it is now, next to the backups (or next to the file being restored).
  const safety = await saveBackup(backupName('scouts-before-restore'), picked.local ? { to: path.dirname(path.resolve(which)) } : {});
  console.log(`Safety copy of the current data saved: ${safety.where}`);

  try {
    await loadDatabase(backup.collections);
  } catch (err) {
    throw new Error(`${err.message}\nThe restore stopped part-way. Put the data back with: npm run restore -- "${safety.where.split(' / ').pop()}"`);
  }
  console.log(`Restored ${describeCounts(backup.counts)}. Start the server again; everyone signs in as before.`);
}

main()
  .catch((err) => {
    console.error(`Restore failed: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
