import { Readable } from 'node:stream';
import { config } from '../config.js';
import { findOrCreateFolder, getDrive, logDriveError } from '../services/storage.js';

/*
 * Backups go to a private "Scouts - backups" folder in the Google Drive the app already uses
 * (the account of GOOGLE_OAUTH_REFRESH_TOKEN), outside the folder shared with the group.
 * GOOGLE_DRIVE_BACKUP_FOLDER_ID can name another folder instead.
 */
const ALL_DRIVES = { supportsAllDrives: true };

export function requireDrive() {
  const drive = getDrive();
  if (!drive) {
    throw new Error(
      'Google Drive is not set up in server/.env (GOOGLE_DRIVE_FOLDER_ID and the GOOGLE_OAUTH_... keys), so the "Scouts - backups" folder cannot be used. ' +
        'To back up to this computer instead: npm run backup -- --to <folder>. To restore a file from this computer: npm run restore -- <path to the file>.'
    );
  }
  return drive;
}

let folderId;
export async function backupFolder(drive) {
  if (folderId) return folderId;
  const d = config.drive;
  if (d.backupFolderId) folderId = d.backupFolderId;
  else if (d.oauthRefreshToken) folderId = await findOrCreateFolder(drive, 'Scouts - backups', 'root');
  // A service account has no Drive of its own: a folder inside the main folder (restrict who can open it).
  else folderId = await findOrCreateFolder(drive, '_Backups', d.rootFolderId);
  return folderId;
}

async function withDrive(fn) {
  const drive = requireDrive();
  try {
    return await fn(drive);
  } catch (err) {
    logDriveError(err);
    throw new Error(`Google Drive: ${err.message}`);
  }
}

export const saveToDrive = (name, buffer) =>
  withDrive(async (drive) => {
    const { data } = await drive.files.create({
      requestBody: { name, parents: [await backupFolder(drive)] },
      media: { mimeType: 'application/gzip', body: Readable.from(buffer) },
      fields: 'id, webViewLink',
      ...ALL_DRIVES,
    });
    return data;
  });

/** Backups in the folder, most recently written first: [{ id, name, size, createdTime, modifiedTime }]. */
export const listDriveBackups = () =>
  withDrive(async (drive) => {
    const parent = await backupFolder(drive);
    const files = [];
    let pageToken;
    do {
      const { data } = await drive.files.list({
        q: `'${parent}' in parents and trashed = false and name contains '.json.gz'`,
        fields: 'nextPageToken, files(id, name, size, createdTime, modifiedTime)',
        orderBy: 'modifiedTime desc',
        pageSize: 100,
        pageToken,
        includeItemsFromAllDrives: true,
        ...ALL_DRIVES,
      });
      files.push(...data.files);
      pageToken = data.nextPageToken;
    } while (pageToken);
    return files;
  });

export const downloadFromDrive = (fileId) =>
  withDrive(async (drive) => {
    const res = await drive.files.get({ fileId, alt: 'media', ...ALL_DRIVES }, { responseType: 'arraybuffer' });
    return Buffer.from(res.data);
  });

/** The file with this exact name in the backups folder, or null: { id, name, modifiedTime }. */
export const findDriveBackup = (name) =>
  withDrive(async (drive) => {
    const parent = await backupFolder(drive);
    const { data } = await drive.files.list({
      q: `'${parent}' in parents and trashed = false and name = '${name.replace(/'/g, "\\'")}'`,
      fields: 'files(id, name, modifiedTime)',
      pageSize: 1,
      includeItemsFromAllDrives: true,
      ...ALL_DRIVES,
    });
    return data.files[0] || null;
  });

/** Replaces the contents of an existing backup file (same name, same place). */
export const replaceDriveBackup = (fileId, buffer) =>
  withDrive((drive) =>
    drive.files.update({ fileId, media: { mimeType: 'application/gzip', body: Readable.from(buffer) }, fields: 'id', ...ALL_DRIVES })
  );
