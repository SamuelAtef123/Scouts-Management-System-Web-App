import { config } from '../config.js';

/*
 * Sends one email through Brevo's API (https://api.brevo.com), over HTTPS, so it also works on hosts
 * that block email ports. Without BREVO_API_KEY (local development) the email is written to the
 * server log instead, links included, so the flows can be tried without sending anything.
 */
export const isEmailEnabled = () => Boolean(config.email.brevoApiKey && config.email.from);

export async function sendEmail({ to, subject, html, text }) {
  if (!isEmailEnabled()) {
    // On the live site never log the body: it can hold a password-reset link.
    if (config.isProduction) console.warn(`Email not sent (BREVO_API_KEY or EMAIL_FROM not set): ${subject}`);
    else console.log(`[email not sent: BREVO_API_KEY or EMAIL_FROM not set] To: ${to} | ${subject}\n${text}\n`);
    return { logged: true };
  }
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': config.email.brevoApiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      sender: { email: config.email.from, name: config.email.fromName },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Brevo answered ${res.status}: ${detail.slice(0, 300)}`);
  }
  return res.json().catch(() => ({}));
}

/** Sends the same email to many people, one at a time, without ever stopping the caller. */
export async function sendToMany(recipients, build) {
  let sent = 0;
  for (const person of recipients) {
    try {
      await sendEmail({ to: person.email, ...build(person) });
      sent += 1;
    } catch (err) {
      console.error(`Email to ${person.email} failed: ${err.message}`);
    }
  }
  return sent;
}
