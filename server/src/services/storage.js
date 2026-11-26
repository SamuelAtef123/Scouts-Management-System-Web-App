import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';
import { config } from '../config.js';
import { HttpError } from '../utils/httpError.js';

/*
 * Task materials go to Google Drive, organised as:
 *   <GOOGLE_DRIVE_FOLDER_ID>/<Kadr>/<YYYY-MM-DD Event title>/<file>
 *
 * Files from members who are not reviewers wait in a private folder until a reviewer approves
 * them (see getReviewFolder); only then are they moved into the event's folder.
 *
 * When Drive is not configured (local development), files are saved
 * to server/uploads instead so the app still works end to end.
 */

const FOLDER_MIME = 'application/vnd.google-apps.folder';
export const LOCAL_UPLOAD_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads');

let driveClient;

export function getDrive() {
  if (driveClient !== undefined) return driveClient;
  const d = config.drive;
  let auth = null;

  if (d.oauthClientId && d.oauthClientSecret && d.oauthRefreshToken) {
    auth = new google.auth.OAuth2(d.oauthClientId, d.oauthClientSecret);
    auth.setCredentials({ refresh_token: d.oauthRefreshToken });
  } else if (d.serviceAccountKeyFile || d.serviceAccountJson) {
    auth = new google.auth.GoogleAuth({
      keyFile: d.serviceAccountKeyFile || undefined,
      credentials: d.serviceAccountJson ? JSON.parse(d.serviceAccountJson) : undefined,
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
  }

  driveClient = auth && d.rootFolderId ? google.drive({ version: 'v3', auth }) : null;
  return driveClient;
}

/** Logs a Google Drive failure with a hint for whoever runs the server; users only see a plain message. */
export function logDriveError(err) {
  const code = err?.response?.data?.error || err?.code || '';
  const hints = {
    unauthorized_client:
      'The refresh token was made for a different OAuth client. Make GOOGLE_OAUTH_CLIENT_ID/SECRET match the client used in the OAuth Playground ("Use your own OAuth credentials"), get a new refresh token, and restart.',
    invalid_grant:
      'The refresh token expired or was revoked (app still in "Testing", access removed, or unused for 6 months). Get a new refresh token and restart.',
    invalid_client: 'GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET is wrong.',
    404: 'GOOGLE_DRIVE_FOLDER_ID was not found, or the signed-in Google account cannot access it.',
    403: 'The Google account has no permission to write to the folder, or the Drive API is not enabled.',
  };
  console.error(`Google Drive upload failed (${code || 'unknown error'}): ${err?.message}`);
  const hint = hints[code];
  if (hint) console.error(`  -> ${hint}`);
}

export function isDriveEnabled() {
  return Boolean(getDrive());
}

// Shared Drive support flags, harmless for a normal "My Drive" folder.
const ALL_DRIVES = { supportsAllDrives: true };

function escapeQuery(value) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

export async function findOrCreateFolder(drive, name, parentId) {
  const q = `name = '${escapeQuery(name)}' and '${parentId}' in parents and mimeType = '${FOLDER_MIME}' and trashed = false`;
  const { data } = await drive.files.list({
    q,
    fields: 'files(id)',
    pageSize: 1,
    includeItemsFromAllDrives: true,
    ...ALL_DRIVES,
  });
  if (data.files?.length) return data.files[0].id;

  const created = await drive.files.create({
    requestBody: { name, mimeType: FOLDER_MIME, parents: [parentId] },
    fields: 'id',
    ...ALL_DRIVES,
  });
  return created.data.id;
}

function eventFolderName(event) {
  const day = new Date(event.startDate).toISOString().slice(0, 10);
  const title = event.title.replace(/[\\/]/g, '-').slice(0, 80);
  return `${day} ${title}`;
}

/** Makes sure the event has a Drive folder and returns its id (saves it on the event). */
async function ensureEventFolder(drive, event) {
  if (event.driveFolderId) return event.driveFolderId;
  // Whole-group events (no kadr) get their own folder.
  const teamFolder = await findOrCreateFolder(drive, event.team || 'Whole group', config.drive.rootFolderId);
  const eventFolder = await findOrCreateFolder(drive, eventFolderName(event), teamFolder);
  event.driveFolderId = eventFolder;
  await event.save();
  return eventFolder;
}

function safeFileName(original) {
  const base = path.basename(original).replace(/[^\p{L}\p{N}._ ()-]/gu, '_');
  return base.slice(-120) || 'file';
}

/** The Drive name of a task's file: "<task> - <uploader> - <file>". */
function storedName(file, task, uploader) {
  // The extension always matches the real file type detected from its content.
  const base = safeFileName(file.originalname).replace(/\.[^.]*$/, '') || 'file';
  const name = file.extension ? `${base}.${file.extension}` : safeFileName(file.originalname);
  return { name, driveName: `${task.title.slice(0, 60)} - ${uploader.name} - ${name}` };
}

let reviewFolderId;

/**
 * The Drive folder where files wait for review. It must not be shared with the group, so by default it is
 * a folder in the Google account's own Drive (OAuth). A service account has no Drive space of its own,
 * so it uses a "_Waiting for review" folder inside the root folder instead.
 */
async function getReviewFolder(drive) {
  if (reviewFolderId) return reviewFolderId;
  const d = config.drive;
  if (d.reviewFolderId) reviewFolderId = d.reviewFolderId;
  else if (d.oauthRefreshToken) reviewFolderId = await findOrCreateFolder(drive, 'Scouts - waiting for review', 'root');
  else reviewFolderId = await findOrCreateFolder(drive, '_Waiting for review', d.rootFolderId);
  return reviewFolderId;
}

/** Local files waiting for review: NOT under /uploads, so they are never served publicly. */
export const LOCAL_PENDING_DIR = path.resolve(LOCAL_UPLOAD_DIR, '../uploads-pending');
const localPath = (material) =>
  path.join(material.reviewStatus === 'pending' ? LOCAL_PENDING_DIR : LOCAL_UPLOAD_DIR, path.basename(material.fileId));

/**
 * Stores an uploaded file for a task: straight into the event's folder when `approved`,
 * otherwise in the private waiting folder until a reviewer approves it.
 * @returns {Promise<{storage, fileId, url}>}
 */
export async function storeMaterial({ file, event, task, uploader, approved = true }) {
  const drive = getDrive();
  const { driveName } = storedName(file, task, uploader);

  if (drive) {
    try {
      const folderId = approved ? await ensureEventFolder(drive, event) : await getReviewFolder(drive);
      const { data } = await drive.files.create({
        requestBody: { name: driveName, parents: [folderId] },
        media: { mimeType: file.mimetype, body: Readable.from(file.buffer) },
        fields: 'id, webViewLink',
        ...ALL_DRIVES,
      });
      return { storage: 'drive', fileId: data.id, url: data.webViewLink };
    } catch (err) {
      logDriveError(err);
      throw new HttpError(502, 'The file could not be saved to Google Drive. Please tell the Database team.');
    }
  }

  const dir = approved ? LOCAL_UPLOAD_DIR : LOCAL_PENDING_DIR;
  await fs.mkdir(dir, { recursive: true });
  // Local files get a random name with only the verified extension: nothing from the uploader's file name.
  const localName = `${crypto.randomUUID()}.${file.extension || 'bin'}`;
  await fs.writeFile(path.join(dir, localName), file.buffer);
  return { storage: 'local', fileId: localName, url: approved ? `/uploads/${encodeURIComponent(localName)}` : `pending:${localName}` };
}

/** Moves an approved file from the waiting folder into the event's folder. Returns its new { fileId, url }. */
export async function approveMaterial(material, event) {
  if (material.storage === 'drive') {
    const drive = getDrive();
    if (!drive) throw new HttpError(502, 'Google Drive is not connected, so the file cannot be approved now. Please tell the Database team.');
    try {
      const folderId = await ensureEventFolder(drive, event);
      const { data: current } = await drive.files.get({ fileId: material.fileId, fields: 'parents', ...ALL_DRIVES });
      const { data } = await drive.files.update({
        fileId: material.fileId,
        addParents: folderId,
        removeParents: (current.parents || []).join(','),
        fields: 'id, webViewLink',
        ...ALL_DRIVES,
      });
      return { fileId: data.id, url: data.webViewLink };
    } catch (err) {
      logDriveError(err);
      throw new HttpError(502, 'The file could not be moved to Google Drive. Please tell the Database team.');
    }
  }
  const name = path.basename(material.fileId);
  await fs.mkdir(LOCAL_UPLOAD_DIR, { recursive: true });
  await fs.rename(path.join(LOCAL_PENDING_DIR, name), path.join(LOCAL_UPLOAD_DIR, name));
  return { fileId: name, url: `/uploads/${encodeURIComponent(name)}` };
}

/** Opens a stored file for reading (used to show files that wait for review). */
export async function readMaterial(material) {
  try {
    if (material.storage === 'drive') {
      const drive = getDrive();
      if (!drive) throw new Error('Drive not configured');
      const res = await drive.files.get({ fileId: material.fileId, alt: 'media', ...ALL_DRIVES }, { responseType: 'stream' });
      return res.data;
    }
    const file = localPath(material);
    await fs.access(file);
    return createReadStream(file);
  } catch (err) {
    console.warn(`Could not read stored file ${material.fileId}: ${err.message}`);
    throw new HttpError(404, 'The file could not be opened. It may have been deleted.');
  }
}

export async function removeMaterial(material) {
  if (!material.fileId) return; // a file sent back is already deleted
  try {
    if (material.storage === 'drive') {
      const drive = getDrive();
      if (drive) await drive.files.delete({ fileId: material.fileId, ...ALL_DRIVES });
    } else {
      await fs.unlink(localPath(material));
    }
  } catch (err) {
    // The record is removed either way; a file already deleted by hand is not an error for the user.
    console.warn(`Could not delete stored file ${material.fileId}: ${err.message}`);
  }
}
