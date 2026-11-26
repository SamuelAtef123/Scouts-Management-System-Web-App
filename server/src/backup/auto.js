import { config } from '../config.js';
import { isDriveEnabled } from '../services/storage.js';
import { describeCounts, dumpDatabase } from './data.js';
import { deleteDriveBackup, listDriveBackups, saveToDrive } from './drive.js';

/*
 * Automatic backup. Every AUTO_BACKUP_DAYS (30) the running server saves a dated file,
 * "scouts-backup-automatic-2026-12-01.json.gz", in the "Scouts - backups" folder in Google Drive,
 * then deletes older automatic files so only the newest AUTO_BACKUP_KEEP (3) remain. So damage that
 * goes unnoticed for weeks can still be undone from an older copy.
 * It checks soon after starting (the free host sleeps, so it starts often) and then once a day.
 * Backups made by hand (npm run backup) are never deleted.
 */
export const AUTO_PREFIX = 'scouts-backup-automatic';
const DAY = 24 * 60 * 60 * 1000;
const isAuto = (f) => f.name.startsWith(AUTO_PREFIX) && f.name.endsWith('.json.gz');

export function autoName(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${AUTO_PREFIX}-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json.gz`;
}

let running = false;

/** Makes the automatic backup if it is due. Returns what happened, for the log. `store` is replaceable in tests. */
export async function autoBackupIfDue({ now = new Date(), days = config.autoBackup.days, keep = config.autoBackup.keep, store } = {}) {
  const s = store || { list: listDriveBackups, create: saveToDrive, remove: deleteDriveBackup, dump: dumpDatabase };
  if (running) return 'already running';
  running = true;
  try {
    const newestFirst = (files) => files.filter(isAuto).sort((a, b) => new Date(b.modifiedTime) - new Date(a.modifiedTime));
    const autos = newestFirst(await s.list());
    const age = autos.length ? now - new Date(autos[0].modifiedTime) : Infinity;
    if (age < days * DAY) return `not due (last one ${Math.floor(age / DAY)} day(s) ago)`;

    const name = autoName(now);
    const { buffer, counts } = await s.dump();
    await s.create(name, buffer);
    // Only delete old copies once the new one is safely saved.
    const old = newestFirst(await s.list()).slice(keep);
    for (const f of old) await s.remove(f.id);
    return `saved to Google Drive / Scouts - backups / ${name} (${describeCounts(counts)})${old.length ? `; removed ${old.length} older automatic backup(s)` : ''}`;
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
  const { days, keep } = config.autoBackup;
  console.log(`Automatic backup: every ${days} days to Google Drive / Scouts - backups, keeping the newest ${keep}`);
}
