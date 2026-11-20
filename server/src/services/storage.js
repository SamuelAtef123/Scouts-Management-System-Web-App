import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { google } from 'googleapis';
import { config } from '../config.js';
import { HttpError } from '../utils/httpError.js';

/*
 * Task materials go to Google Drive, organised as:
 *   <GOOGLE_DRIVE_FOLDER_ID>/<Team>/<YYYY-MM-DD Event title>/<file>
 *
 * When Drive is not configured (local development), files are saved
 * to server/uploads instead so the app still works end to end.
 */

const FOLDER_MIME = 'application/vnd.google-apps.folder';
export const LOCAL_UPLOAD_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../uploads');

let driveClient;

function getDrive() {
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
function logDriveError(err) {
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

async function findOrCreateFolder(drive, name, parentId) {
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
  const teamFolder = await findOrCreateFolder(drive, event.team, config.drive.rootFolderId);
  const eventFolder = await findOrCreateFolder(drive, eventFolderName(event), teamFolder);
  event.driveFolderId = eventFolder;
  await event.save();
  return eventFolder;
}

function safeFileName(original) {
  const base = path.basename(original).replace(/[^\p{L}\p{N}._ ()-]/gu, '_');
  return base.slice(-120) || 'file';
}

/**
 * Stores an uploaded file for a task.
 * @returns {Promise<{storage, fileId, url}>}
 */
export async function storeMaterial({ file, event, task, uploader }) {
  const drive = getDrive();
  const name = safeFileName(file.originalname);

  if (drive) {
    try {
      const folderId = await ensureEventFolder(drive, event);
      const { data } = await drive.files.create({
        requestBody: {
          name: `${task.title.slice(0, 60)} - ${uploader.name} - ${name}`,
          parents: [folderId],
        },
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

  await fs.mkdir(LOCAL_UPLOAD_DIR, { recursive: true });
  const localName = `${crypto.randomUUID()}-${name}`;
  await fs.writeFile(path.join(LOCAL_UPLOAD_DIR, localName), file.buffer);
  return { storage: 'local', fileId: localName, url: `/uploads/${encodeURIComponent(localName)}` };
}

export async function removeMaterial(material) {
  try {
    if (material.storage === 'drive') {
      const drive = getDrive();
      if (drive) await drive.files.delete({ fileId: material.fileId, ...ALL_DRIVES });
    } else {
      await fs.unlink(path.join(LOCAL_UPLOAD_DIR, path.basename(material.fileId)));
    }
  } catch (err) {
    // The record is removed either way; a file already deleted by hand is not an error for the user.
    console.warn(`Could not delete stored file ${material.fileId}: ${err.message}`);
  }
}
