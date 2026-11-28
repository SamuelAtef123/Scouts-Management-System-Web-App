import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { isArabic, t as tr } from '../i18n.jsx';
import { ErrorBox, Field } from './ui.jsx';

/*
 * Typing an email: a hint for common misspellings ("@gmial.com" -> "Did you mean …@gmail.com?").
 * Confirming it: a 6-digit code emailed to the address.
 */
// Common providers misspellings are matched against; KNOWN are real ones that must never be "corrected".
const DOMAINS = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com', 'live.com', 'msn.com'];
const KNOWN = [...DOMAINS, 'mail.com', 'email.com', 'ymail.com', 'aol.com', 'googlemail.com', 'protonmail.com', 'proton.me', 'me.com', 'yahoo.co.uk', 'hotmail.co.uk'];

function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1), i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1] ? d[i - 2][j - 2] + 1 : Infinity);
  return d[a.length][b.length];
}

/** "sam@gmial.com" -> "sam@gmail.com"; null when the address looks fine. */
export function suggestEmail(value) {
  const m = String(value || '').trim().toLowerCase().match(/^([^\s@]+)@([^\s@]+)$/);
  if (!m) return null;
  const [, user, domain] = m;
  if (KNOWN.includes(domain)) return null;
  // gmail.con, gmail.co, gmail.cm, gmailcom …
  const base = domain.replace(/\.(con|cm|co|cmo|om|comm|c)$/, '.com').replace(/(gmail|yahoo|hotmail|outlook|icloud)com$/, '$1.com');
  const best = DOMAINS.map((d) => [d, distance(base, d)]).sort((x, y) => x[1] - y[1])[0];
  return best && best[1] <= 2 && best[0] !== domain ? `${user}@${best[0]}` : null;
}

/** An email field with the typo hint under it. */
export function EmailField({ label, hint, value, onChange, required = true, autoComplete = 'email' }) {
  const suggestion = suggestEmail(value);
  return (
    <Field label={label} hint={hint}>
      <input type="email" dir="ltr" value={value} onChange={(e) => onChange(e.target.value)} required={required} maxLength={120} autoCapitalize="none" autoCorrect="off" autoComplete={autoComplete} />
      {suggestion && (
        <button type="button" className="email-hint" onClick={() => onChange(suggestion)}>
          {tr('Did you mean')} <bdi dir="ltr">{suggestion}</bdi>
          {isArabic() ? '؟' : '?'}
        </button>
      )}
    </Field>
  );
}

/** "Enter the code we sent to …": confirms the waiting email. */
export function EmailCodeForm({ email, onConfirmed, onChangeEmail }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [wait, setWait] = useState(60); // seconds before "Resend code"

  useEffect(() => {
    if (wait <= 0) return undefined;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setInfo('');
    try {
      const data = await api.post('/auth/me/email-code', { code });
      onConfirmed(data.user);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const resend = async () => {
    setError('');
    try {
      await api.post('/auth/me/email-code/resend');
      setInfo(tr('A new code was sent.'));
      setWait(60);
      setCode('');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form className="form email-code" onSubmit={submit}>
      <p className="muted">
        {tr('We sent a 6-digit code to')} <bdi dir="ltr" className="email-code-to">{email}</bdi>. {tr('Enter it to confirm your email. Check your spam folder too.')}
      </p>
      <Field label={tr('Confirmation code')}>
        <input
          className="code-input"
          dir="ltr"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          required
          autoFocus
        />
      </Field>
      {error && <ErrorBox message={error} />}
      {info && <p className="field-hint">{info}</p>}
      <button className="btn btn-primary btn-block" disabled={busy || code.length !== 6}>
        {busy ? tr('Please wait…') : tr('Confirm email')}
      </button>
      <div className="email-code-links">
        <button type="button" className="link" onClick={resend} disabled={wait > 0}>
          {wait > 0 ? tr('Resend code ({s}s)', { s: wait }) : tr('Resend code')}
        </button>
        <button type="button" className="link" onClick={onChangeEmail}>
          {tr('Wrong email? Change it')}
        </button>
      </div>
    </form>
  );
}
