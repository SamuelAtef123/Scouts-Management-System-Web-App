import { google } from 'googleapis';
import { config } from '../config.js';

/*
 * Sends email from the group's Gmail through the Gmail API (over HTTPS, so it also works on hosts that
 * block email ports). It uses the Google OAuth client of Google Drive and a refresh token of the Gmail
 * account that includes the "https://www.googleapis.com/auth/gmail.send" permission.
 *
 * Nothing is sent, and the email is written to the server log instead, when:
 * - sending is off (EMAIL=off) or no token is set (a computer used for testing);
 * - the address is a made-up test one (example.com, .test, .invalid …): those would bounce.
 */
const TEST_ADDRESS = /@(example\.(com|org|net)|[^@]+\.(test|invalid|example|localhost))$/i;

const SEND_SCOPES = ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/gmail.compose', 'https://www.googleapis.com/auth/gmail.modify', 'https://mail.google.com/'];

let auth;
let gmail;
function getGmail() {
  if (gmail !== undefined) return gmail;
  const { oauthClientId, oauthClientSecret } = config.drive;
  const { enabled, refreshToken } = config.email;
  if (!enabled || !oauthClientId || !oauthClientSecret || !refreshToken) return (gmail = null);
  auth = new google.auth.OAuth2(oauthClientId, oauthClientSecret);
  auth.setCredentials({ refresh_token: refreshToken });
  return (gmail = google.gmail({ version: 'v1', auth }));
}

export const isEmailEnabled = () => Boolean(getGmail());

/** The permissions the refresh token was given (read from Google, without sending anything). */
async function tokenScopes() {
  const { token } = await auth.getAccessToken();
  const info = await auth.getTokenInfo(token);
  return info.scopes || [];
}

let sender; // { name, address }, worked out once
/**
 * The sender's address: EMAIL_FROM, or the Google account itself. A send-only Gmail permission cannot
 * read the account's address, so it is read through Google Drive (the same account and token).
 */
async function getSender() {
  if (sender) return sender;
  let address = config.email.from;
  if (!address) {
    try {
      const { data } = await google.drive({ version: 'v3', auth }).about.get({ fields: 'user(emailAddress)' });
      address = data.user?.emailAddress;
    } catch {
      /* no Drive permission on this token: EMAIL_FROM is needed */
    }
  }
  if (!address) throw new Error('set EMAIL_FROM to the sending Gmail address');
  sender = { address, name: config.email.fromName };
  return sender;
}

/** RFC 2047: non-English text in a header (subject, sender name). */
const encodeHeader = (text) => `=?UTF-8?B?${Buffer.from(text, 'utf8').toString('base64')}?=`;
const base64Lines = (text) => Buffer.from(text, 'utf8').toString('base64').replace(/.{76}(?=.)/g, '$&\r\n');

/** A complete email (text and HTML versions) in the format the Gmail API expects. */
export function buildRawEmail({ from, to, subject, html, text }) {
  const boundary = `scouts-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const message = [
    `From: ${encodeHeader(from.name)} <${from.address}>`,
    `To: <${to}>`,
    `Subject: ${encodeHeader(subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64Lines(text),
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64Lines(html),
    `--${boundary}--`,
    '',
  ].join('\r\n');
  return Buffer.from(message, 'utf8').toString('base64url');
}

function logInstead(to, subject, text, reason) {
  // On the live site never log the body: it can hold a password-reset link.
  if (config.isProduction) console.warn(`Email not sent (${reason}): ${subject}`);
  else console.log(`[email not sent: ${reason}] To: ${to} | ${subject}\n${text}\n`);
  return { logged: true };
}

export async function sendEmail({ to, subject, html, text }) {
  if (TEST_ADDRESS.test(to)) return logInstead(to, subject, text, 'test address');
  const api = getGmail();
  if (!api) return logInstead(to, subject, text, 'email sending is not set up');
  const from = await getSender();
  await api.users.messages.send({ userId: 'me', requestBody: { raw: buildRawEmail({ from, to, subject, html, text }) } });
  return { sent: true };
}

/** Sends the same email to many people, one at a time, without ever stopping the caller. */
export async function sendToMany(recipients, build) {
  let sent = 0;
  for (const person of recipients) {
    try {
      await sendEmail({ to: person.email, ...build(person) });
      sent += 1;
    } catch (err) {
      console.error(`Email to ${person.email} failed: ${explain(err)}`);
    }
  }
  return sent;
}

/** A readable reason for a Gmail failure, with what to do about it. */
export function explain(err) {
  const code = err?.response?.data?.error || err?.code;
  const message = err?.response?.data?.error?.message || err?.message || String(err);
  if (code === 'invalid_client') return 'GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_CLIENT_SECRET is wrong';
  if (code === 'unauthorized_client') return 'the refresh token was made with a different OAuth client: get it again in the OAuth Playground with your own credentials';
  if (code === 'invalid_grant') return 'the Google refresh token expired or was revoked: get a new one (with Drive and Gmail send) and restart';
  if (/insufficient|scope/i.test(message)) return 'the Google refresh token has no permission to send email: get a new one that includes gmail.send';
  if (/has not been used|disabled/i.test(message)) return 'the Gmail API is not enabled in the Google Cloud project: enable it and try again';
  return message;
}

/** On start-up: checks the account can send, so a problem shows at once instead of at the first email. */
export async function checkEmailSetup() {
  if (!config.email.enabled) return console.log('Emails are turned off (EMAIL=off)');
  const api = getGmail();
  if (!api) return console.log('Emails are not set up (no Google refresh token): they are written to this log instead');
  try {
    const scopes = await tokenScopes();
    if (!scopes.some((x) => SEND_SCOPES.includes(x))) {
      return console.warn('Warning: emails cannot be sent: the Google refresh token has no permission to send email: get a new one that includes gmail.send');
    }
    const from = await getSender();
    console.log(`Emails are sent from ${from.address} (Gmail)`);
  } catch (err) {
    console.warn(`Warning: emails cannot be sent: ${explain(err)}`);
  }
}
