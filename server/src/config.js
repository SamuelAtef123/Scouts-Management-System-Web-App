import 'dotenv/config';

function required(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const isProduction = process.env.NODE_ENV === 'production';

export const config = {
  isProduction,
  port: Number(process.env.PORT) || 5000,
  mongoUri: required('MONGO_URI', isProduction ? undefined : 'mongodb://127.0.0.1:27017/scouts'),
  jwtSecret: required('JWT_SECRET', isProduction ? undefined : 'dev-only-secret-change-me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB) || 25,
  drive: {
    rootFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID || '',
    // Option A: OAuth client + refresh token of a normal Google account (files count against that account).
    oauthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
    oauthClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
    oauthRefreshToken: process.env.GOOGLE_OAUTH_REFRESH_TOKEN || '',
    // Option B: service account (the root folder must be inside a Shared Drive).
    serviceAccountKeyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE || '',
    serviceAccountJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '',
  },
};
