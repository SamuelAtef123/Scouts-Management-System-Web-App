import { config } from '../config.js';
import { isDriveEnabled } from '../services/storage.js';
import { describeCounts, dumpDatabase } from './data.js';
import { findDriveBackup, replaceDriveBackup, saveToDrive } from './drive.js';

/*
 * Automatic backup. The running server keeps ONE file, "scouts-backup-automatic.json.gz", in the
 * "Scouts - backups" folder in Google Drive and replaces it when it is older than AUTO_BACKUP_DAYS
 * (30). It checks soon after starting (the free host sleeps, so it starts often) and then once a day.
 * Backups made by hand (npm run backup) have their own dated files and are never replaced.
 */
export const AUTO_NAME = 'scouts-backup-automatic.json.gz';
const DAY = 24 * 60 * 60 * 1000;

let running = false;

/** Makes the automatic backup if it is due. Returns what happened, for the log. `store` is replaceable in tests. */
export async function autoBackupIfDue({ now = new Date(), days = config.autoBackup.days, store } = {}) {
  const s = store || { find: findDriveBackup, replace: replaceDriveBackup, create: saveToDrive, dump: dumpDatabase };
  if (running) return 'already running';
  running = true;
  try {
    const existing = await s.find(AUTO_NAME);
    const age = existing ? now - new Date(existing.modifiedTime) : Infinity;
    if (age < days * DAY) return `not due (last one ${Math.floor(age / DAY)} day(s) ago)`;
    const { buffer, counts } = await s.dump();
    if (existing) await s.replace(existing.id, buffer);
    else await s.create(AUTO_NAME, buffer);
    return `saved to Google Drive / Scouts - backups / ${AUTO_NAME} (${describeCounts(counts)})`;
  } finally {
    running = false;
  }
}

/** Starts the checks. Does nothing when automatic backups are off or Google Drive is not set up. */
export function startAutoBackup() {
  if (!config.autoBackup.enabled) return;
  if (!isDriveEnabled()) {
    console.warn('Automatic backup is on, but Google Drive is not set up, so no automatic backups are made.');
    return;
  }
  const check = () =>
    autoBackupIfDue()
      .then((result) => result.startsWith('saved') && console.log(`Automatic backup ${result}`))
      .catch((err) => console.error(`Automatic backup failed: ${err.message}`));
  setTimeout(check, 60 * 1000).unref(); // a minute after starting, so waking up stays fast
  setInterval(check, DAY).unref();
  console.log(`Automatic backup: every ${config.autoBackup.days} days to Google Drive / Scouts - backups / ${AUTO_NAME}`);
}
