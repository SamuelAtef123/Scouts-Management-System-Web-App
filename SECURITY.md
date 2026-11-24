# Security assessment

Pre-deployment review of the Scouts Management System, 24 November 2026.

**Result:** 4 confirmed issues and 6 hardening gaps were found; all are fixed except one, an access-rule decision for the owner (finding 3). No known-vulnerable dependencies.

## Scope and method

- **Code review** of every server route (sign-in, members, events, tasks, attendance, uploads, photos), the access rules in `server/src/utils/access.js`, configuration, and the React client.
- **Dependency audit:** `npm audit` on the server and the client: 0 known vulnerabilities.
- **Attack tests** against the real code: disguised file uploads, password guessing with faked IP addresses, and the browser security policy loaded against the built app.
- **Not tested here:** the live database and Google Drive (not reachable from the test environment), and the hosting set-up, which does not exist yet.

## Findings

| # | Severity | Finding | Status |
| --- | --- | --- | --- |
| 1 | **High** | **Disguised web page upload.** Uploads trusted the type the browser claimed. A web page labelled as a PDF was stored and served from the app's own address as a live page, whose script could read a member's sign-in token. Only when Google Drive is not configured (local storage). | **Fixed.** The real type is detected from the file's content; only PDF, Word and images are accepted; stored names are random with the verified extension; served files are sandboxed. Re-tested: rejected. |
| 2 | **High** | **Unlimited password guessing.** The sign-in limit (20 tries in 15 minutes) trusted the `X-Forwarded-For` header, so a new fake address on every try gave unlimited guesses (tested: 40 of 40 allowed). | **Fixed.** Proxy trust is now a setting (`TRUST_PROXY`, off by default), and a second limit allows 8 failed tries per account in 15 minutes whatever the address. Re-tested: 8 of 40 allowed. |
| 3 | **Medium** | **Privileged Database members can take over higher accounts.** They can reset the password of, deactivate, or change the role of the Scouts Leader and Helpers, and can create new Scouts Leader accounts. | **Open: owner decision.** Recommended: only the Scouts Leader manages Scouts Leader and Helper accounts; Database members manage everyone else. |
| 4 | **Medium** | **Sessions survived a password reset.** A stolen sign-in kept working for up to 7 days after the password was changed. | **Fixed.** Changing or resetting a password signs out all existing sessions; the member's current device gets a fresh one. |
| 5 | Medium | **No browser security policy.** With the sign-in token kept in the browser, any injected script could steal it. | **Fixed.** A strict Content Security Policy now allows only the app's own scripts. Tested: all pages load, nothing blocked. |
| 6 | Medium | **Weak signing secret accepted.** The production server started with any `JWT_SECRET`, including the example value `change-me`. | **Fixed.** In production the server refuses secrets shorter than 32 characters or containing "change-me". |
| 7 | Low | **Short passwords.** The minimum was 6 characters. | **Fixed.** Minimum is now 8 characters. |
| 8 | Low | **Phone numbers over-shared.** The member list used to assign tasks sent full member records (including phone numbers) to every Team Leader and Helper. | **Fixed.** It now sends only names, team, role and photo. |
| 9 | Low | **Usernames could be guessed from timing.** A wrong username answered faster than a wrong password. | **Fixed.** Both now take the same time. |
| 10 | Low | **Demo data on the live system.** `seed --demo` (accounts with a shared known password) could run in production. | **Fixed.** Refused when `NODE_ENV=production`. |

## Protections confirmed in place

- Every permission is enforced by the server, not only hidden in the app.
- Passwords are stored as bcrypt hashes and never returned by the API.
- No raw HTML rendering in the app (React escapes all text). Clickjacking is blocked (`frame-ancestors 'none'`), and file types can't be guessed by the browser (`nosniff`).
- Sign-in uses a bearer token, not cookies, so cross-site request forgery does not apply. Cross-origin requests are limited to `CLIENT_ORIGIN`.
- Database queries only use validated values, so no query injection. IDs are checked, and only whitelisted fields can be edited.
- Server errors are hidden from users. Google Drive errors are logged for the admin only.
- Secrets live in `server/.env`, which is excluded from git.

## Remaining recommendations

- Deploy only over **HTTPS**, and follow the security checklist in the README.
- Decide **finding 3**.
- Restrict MongoDB Atlas Network Access to the host's address once it is known, and use a strong database password.
- Keep Google Drive configured in production, so materials never use local storage.
- Re-run `npm audit` in `server` and `client` before each release.
- Later, consider: an audit log of member and attendance changes, and keeping the sign-in token in an HttpOnly cookie instead of browser storage.
