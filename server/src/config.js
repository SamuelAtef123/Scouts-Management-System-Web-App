import 'dotenv/config';
import dns from 'node:dns';

// Some home routers/ISPs cannot answer the SRV/TXT DNS lookups that "mongodb+srv://" Atlas
// connection strings need ("querySrv/queryTxt ETIMEOUT"). DNS_SERVERS lets Node use public DNS instead.
if (process.env.DNS_SERVERS) {
  const servers = process.env.DNS_SERVERS.split(',').map((s) => s.trim()).filter(Boolean);
  dns.setServers(servers);
  dns.promises.setServers(servers);
}

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const isProduction = process.env.NODE_ENV === 'production';

// In production the token-signing secret must be long and random: anyone who knows it can sign in as anyone.
if (isProduction) {
  const secret = process.env.JWT_SECRET || '';
  if (secret.length < 32 || /change-?me/i.test(secret)) {
    throw new Error('JWT_SECRET must be a random string of at least 32 characters in production (see .env.example)');
  }
}

export const config = {
  isProduction,
  port: Number(process.env.PORT) || 5000,
  mongoUri: required('MONGO_URI', isProduction ? undefined : 'mongodb://127.0.0.1:27017/scouts'),
  jwtSecret: required('JWT_SECRET', isProduction ? undefined : 'dev-only-secret-change-me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  // Number of reverse proxies in front of the app (0 = none). See index.js.
  trustProxy: Number(process.env.TRUST_PROXY) || 0,
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB) || 25,
  drive: {
    rootFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID || '',
    // Where uploads wait until they are reviewed. Optional: by default a private folder in the Google
    // account's own Drive (OAuth), or a "_Waiting for review" folder inside the root folder (service account).
    reviewFolderId: process.env.GOOGLE_DRIVE_REVIEW_FOLDER_ID || '',
    // Option A: OAuth client + refresh token of a normal Google account (files count against that account).
    oauthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
    oauthClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
    oauthRefreshToken: process.env.GOOGLE_OAUTH_REFRESH_TOKEN || '',
    // Option B: service account (the root folder must be inside a Shared Drive).
    serviceAccountKeyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || '',
    serviceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '',
  },
};
