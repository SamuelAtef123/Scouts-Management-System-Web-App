import zlib from 'node:zlib';
import mongoose from 'mongoose';

/*
 * A backup is one gzip-compressed JSON file holding every document of every collection
 * (members with their password hashes, events with attendance, tasks with file records).
 * Extended JSON keeps ids and dates exactly as they are stored.
 * Uploaded task files are not in it: they live in Google Drive already.
 */
const { EJSON } = mongoose.mongo.BSON;
const FORMAT = 'scouts-backup';

/** Reads the whole database. Returns { buffer, counts }. */
export async function dumpDatabase() {
  const db = mongoose.connection.db;
  const names = (await db.listCollections({}, { nameOnly: true }).toArray())
    .map((c) => c.name)
    .filter((n) => !n.startsWith('system.'))
    .sort();
  const collections = {};
  const counts = {};
  for (const name of names) {
    collections[name] = await db.collection(name).find({}).toArray();
    counts[name] = collections[name].length;
  }
  const json = EJSON.stringify({ format: FORMAT, version: 1, createdAt: new Date(), collections }, { relaxed: false });
  return { buffer: zlib.gzipSync(json), counts };
}

/** Opens a backup file. Returns { createdAt, collections, counts }; throws if it is not a backup. */
export function readBackupFile(buffer) {
  let data;
  try {
    data = EJSON.parse(zlib.gunzipSync(buffer).toString('utf8'), { relaxed: false });
  } catch {
    throw new Error('This file is not a readable backup (it may be damaged or not a .json.gz backup).');
  }
  if (data?.format !== FORMAT || !data.collections) throw new Error('This file is not a Scouts backup.');
  const counts = Object.fromEntries(Object.entries(data.collections).map(([n, docs]) => [n, docs.length]));
  return { createdAt: data.createdAt, collections: data.collections, counts };
}

/** Replaces the contents of every collection in the backup with the backup's documents. */
export async function loadDatabase(collections) {
  const db = mongoose.connection.db;
  for (const [name, docs] of Object.entries(collections)) {
    const col = db.collection(name);
    await col.deleteMany({});
    for (let i = 0; i < docs.length; i += 500) await col.insertMany(docs.slice(i, i + 500), { ordered: true });
  }
}

/** "users: 60, events: 120, tasks: 300" */
export const describeCounts = (counts) =>
  Object.entries(counts)
    .map(([n, c]) => `${n}: ${c}`)
    .join(', ');

/** A backup file name with the local date and time: scouts-backup-2026-11-26_20-15.json.gz */
export function backupName(prefix = 'scouts-backup') {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${prefix}-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}.json.gz`;
}
