# Light of the World — Scouts Management System

A web app for the leaders (the Gawala kadr) of the **St. Mary Church, Garden City Scouts** group. Leaders use it to plan events, split the work into tasks, assign the tasks to each other, and upload each task's material to Google Drive.

The app is designed for phones first and also works on a computer.

> فَلْيُضِئْ نُورُكُمْ هَكَذَا قُدَّامَ النَّاسِ، لِكَيْ يَرَوْا أَعْمَالَكُمُ الْحَسَنَةَ، وَيُمَجِّدُوا أَبَاكُمُ الَّذِي فِي السَّمَاوَاتِ. — إنجيل متى 5: 16

## Features (first version)

- **Events**: create, edit and delete events (never starting in the past), and see upcoming and past events (grouped by month, with a kadr filter).
- **Tasks**: add tasks to an event, assign each one to a leader, and set a due date. The person assigned can move the task through *To do → In progress → Done*.
- **Materials**: the person assigned uploads the task's material (a PDF, Word document or image). A leader reviews it first; once approved it goes to Google Drive, sorted into `Kadr / Date Event title` folders (whole-group events under `Whole group`).
- **Event types**: Kadr Session, Preparation Meeting, Gawala Session and Others. A Gawala Session belongs to the whole group, so everyone sees it; every other type belongs to one kadr.
- **Attendance**: each event except "Others" has an attendance sheet. Mark each member Present, Absent or Excused; anyone left unmarked is saved as absent. Each member's attendance rate is shown on their Profile.
- **Language**: English or Arabic, chosen on the sign-in screen or the Profile page and remembered on each phone. Arabic switches the whole app (texts, dates, server messages) to a right-to-left layout with Arabic fonts. Translations live in `client/src/i18n-ar.js`.
- **Home**: a personal summary showing open, done and overdue tasks, your next tasks and upcoming events.
- **Members**: every member's details and attendance percentage. The Group Leader and Helpers view everyone; all 5 Database / Attendance members can add accounts (email and password optional: an empty password means `scouts123`, or `DEFAULT_MEMBER_PASSWORD`), edit them, reset passwords and deactivate members (the 3 non-privileged ones only for their assigned kadr).
- **Profile**: your mobile number and email (both editable), your badges, your attendance, and changing your password. Members are shown by their initials on their kadr's colour (there are no profile photos). On first sign-in, anyone without a mobile number or email must add them before using the app, and anyone whose password was set by someone else (a new account, including the default `scouts123`, or a reset by a Database member) must choose their own.
- **Emails** (in Arabic and English, sent from the group's Gmail): a new event for your kadr (whole-group events: everyone, plus the Database member who takes that kadr's attendance), a task assigned to you, and your uploaded file approved or sent back (with the note). The person who did the action is not emailed; everyone else concerned always gets them.
- **Confirmed emails**: an email only counts once its owner enters the 6-digit code emailed to it (on first sign-in, or when changing it on the Profile page, where the old address stays until the new one is confirmed). The code works for 15 minutes, allows 5 tries and can be resent after a minute; "Wrong email? Change it" fixes a typo. Common misspellings (`@gmial.com`, `@gmail.con` …) get a "Did you mean …?" hint while typing. Only confirmed emails receive notifications and password-reset links, and an email typed or changed by a Database member is confirmed by the person at their next sign-in.
- **Forgot password?** on the sign-in screen emails a link to choose a new password. It works once, for 1 hour, and signs out other devices. Every member needs a unique email: it can be left empty when a Database member adds them, and they are then asked for it on first sign-in. Only Egyptian mobile numbers are accepted: 11 digits starting with 010, 011, 012 or 015, stored as +20.

- **Scout badges**: the Group Leader and Helpers give any member a badge, and a Kadr Leader gives members of their own kadr one: a short word (with suggestions such as Leadership or Teamwork) and an optional reason. Badges appear as shiny pills on the member's Profile ("My badges") and in their member details, with a count in the Members list; the member is emailed. Whoever gave a badge, or the Group Leader and Helpers, can remove it.
## Who can do what

| Persona | Events and tasks | Sees |
| --- | --- | --- |
| Group Leader (1) | Every kadr | Every kadr (or a selected kadr) |
| Group Leader Helper (2) | Every kadr | Every kadr (or a selected kadr) |
| Database / Attendance team, **privileged** (2 of 5) | Every kadr | Every kadr (or a selected kadr) |
| Database / Attendance team, others (3 of 5) | Their own kadr | Their own kadr |
| Kadr Leader (5, one per kadr) | Their own kadr | Their own kadr |
| Kadr Leader Helper (the rest) | Their own kadr | Their own kadr |

The app keeps to these numbers of **active** accounts: 1 Group Leader, 2 Group Leader Helpers, 5 Database / Attendance members and 5 Kadr Leaders (one per kadr); Kadr Leader Helpers have no limit. Adding a member, changing a role or kadr, or re-activating an account beyond that is refused (deactivate the old account first); full roles show "(full)" in the member form.

- Only the person a task is assigned to can upload its material and change its status. Only the person who **uploaded** a file can remove it (waiting, approved or sent back); reviewers send a file back instead. Files over the upload limit (25 MB) are refused before they upload.
- **Reviewing uploaded files.** A file uploaded for a task waits as *Waiting for review* in a private place and is not in the event's Drive folder yet. It can be reviewed by:
  - the Group Leader and the Group Leader Helpers, for every event;
  - the Kadr Leader of the event's kadr (the Gawala Kadr Leader for whole-group events).

  Reviewers find these files under **My tasks → To review**, with a count on Home and in the menu. **Approve** moves the file into the event's Drive folder. **Send back** deletes it and shows the uploader a note, so they can upload a new version. A reviewer's own upload is approved straight away. Until then, only the uploader and the reviewers can open the file, and the task cannot be marked Done.
- A task can only be assigned to a member of its event's kadr, whoever creates it. Whole-group events (Gawala Sessions, and whole-group Others events) can be assigned to any member.
- An event can move to another kadr only if none of its tasks are assigned to members of a different kadr (reassign or delete them first).
- Events cannot start in the past. Past events can still be edited, as long as their date is not moved.
- **Members page** (details and attendance percentage):
  - Group Leader and Group Leader Helpers: **view** all members.
  - The 2 privileged Database / Attendance members: view all members, and **add, edit or deactivate** accounts and reset passwords.
  - The other 3 Database / Attendance members: view, **add, edit or deactivate** members of **their assigned kadr only**. They can only give the Kadr Leader or Kadr Leader Helper role, and can't move a member out of their kadr.
  - Kadr Leaders: **view** the members of their own kadr (details, attendance and badges), to give them badges. No editing.
  - Kadr Leader Helpers: no Members page.
- **Preparation Meetings** belong to one kadr. Only the Group Leader, the Group Leader Helpers, and a Kadr Leader (for their own kadr) can create, edit or delete them. Preparation Meetings have **no tasks**.
- **Gawala Sessions** (whole-group events) are created and managed by the leaders who have access to every kadr.
- The rules live in one place: `server/src/utils/access.js`.

## Attendance

| Event type | Whose attendance is taken |
| --- | --- |
| Kadr Session | Members of that event's kadr only (the Gawala kadr can have Kadr Sessions too) |
| Preparation Meeting | Members of that event's kadr only |
| Gawala Session | Members of all kadrs, grouped by kadr |
| Others | No attendance |

- Roles only decide permissions. Kadr membership decides who is on an attendance sheet, so every member belongs to a kadr. The Group Leader, Helpers and the Database team belong to the Gawala kadr; on its first start, the server moves anyone without a kadr into Gawala.
- Before a kadr's section is first saved, it lists the kadr's current members. On that first save the list is fixed, so later kadr changes don't alter past sheets. After attendance is taken, the event's type and kadr can't be changed.
- Who records attendance: **only the 5 Database / Attendance team members, each for one assigned kadr**. Nobody else can record it, including the Group Leader.
  - The assignments are **fixed in the code** in `server/src/attendanceAssignments.js` (username → kadr), not set from the app. To change them, edit that file and redeploy. The real usernames are already set: `michael.gamil` (Gawala), `lavy.hani` (Ashbal), `sandra.rafaat` (Zahrat), `ramez.samy` (Kashafeen) and `marina.maged` (Morshedat); `michael.gamil` and `ramez.samy` are the 2 privileged members.
  - On start, the server checks that list and warns about a missing kadr, an unknown username, or an account that isn't in the Database/Attendance team. The username of an assigned member can't be changed from the Members page.
  - A Kadr Session or Preparation Meeting is recorded only by the member assigned to the event's kadr.
  - A Gawala Session (all kadrs) is recorded only by the member assigned to Gawala. The event page shows which kadrs' sections are done.
  - A Database / Attendance member sees the Gawala kadr's events, their assigned kadr's events, and whole-group events. The 2 privileged members still see and manage every kadr, but take attendance only for their own kadr.
  - Anyone who can see an event can view its sheet.
- Profile and member details: attendance rate = present ÷ (present + absent), overall and for each event type (Kadr Session, Preparation Meeting, Gawala Session). Excused sessions don't count against the member. For members of the Gawala kadr, a Gawala Session also counts as their Kadr Session: their mark there appears in both percentages, while the overall rate counts it once.

Kadrs: Ashbal (أشبال), Zahrat (زهرات), Kashafeen (كشافين), Morshedat (مرشدات), Gawala (جوالة). Each kadr has a colour taken from the logo.

## Tech stack (MERN)

- **MongoDB** with Mongoose
- **Express** REST API, with JWT sign-in and bcrypt-hashed passwords
- **React** 19 with Vite, React Router and lucide icons, styled with hand-written CSS (no UI framework)
- **Node.js** 20 or later
- **Google Drive API** (`googleapis`) for task materials

```
├── client/          React app (Vite)
│   ├── public/      logo.jpg, group.jpg, manifest
│   └── src/
│       ├── pages/       Login, Home, Events, EventDetail, MyTasks, Members, Profile
│       └── components/  Layout, EventCard, EventForm, TaskCard, TaskForm, ui
└── server/          Express API
    └── src/
        ├── models/      User, Event, Task
        ├── routes/      auth, users, events, tasks, stats
        ├── services/    storage.js (Google Drive / local fallback)
        ├── utils/       access.js (permissions)
        └── seed.js      creates the first account (+ optional demo data)
```

## Running it locally

You need Node.js 20 or later and MongoDB. MongoDB can run on your machine, or you can use a free MongoDB Atlas cluster.

1. Install the dependencies:

   ```bash
   npm run install:all
   ```

2. Create the server settings:

   ```bash
   cp server/.env.example server/.env
   ```

   Edit `server/.env`. At minimum, set `MONGO_URI` and `JWT_SECRET`. For a real database also set the first two accounts (passwords of at least 8 characters):
   - `SEED_ADMIN_NAME`, `SEED_ADMIN_USERNAME`, `SEED_ADMIN_PASSWORD`: the Group Leader (use the real full name: Home greets them by first name).
   - `SEED_DB_NAME`, `SEED_DB_USERNAME`, `SEED_DB_PASSWORD`: the first privileged Database / Attendance member. Only Database members can add members, so this person adds everyone else from the Members page.

3. Create those first accounts. `seed:demo` instead adds sample members, events and tasks for trying the app (with built-in passwords; refused when `NODE_ENV=production`):

   ```bash
   npm run seed
   ```

   ```bash
   npm run seed:demo
   ```

   Every demo member has the password `scouts123` (for example, user `ashbal.leader`).

4. Start the API and the React app together:

   ```bash
   npm run dev
   ```

   Open http://localhost:5173 on your computer. To try it on your phone, open `http://<your-computer-ip>:5173` while the phone is on the same Wi-Fi (run `npm run dev --prefix client -- --host`).

If Google Drive is not configured, uploaded files are saved in `server/uploads/` so that everything still works during development.

## Setting up emails (the group's Gmail)

Emails are sent from the group's Gmail through the **Gmail API**, with the same Google Cloud project and OAuth client as Google Drive (set that up first, see below). It works over HTTPS, so hosts that block email ports are fine, and Gmail allows about 500 emails a day (a whole-group event sends about 60).

1. In Google Cloud Console → **APIs & Services → Library**, enable the **Gmail API** (next to the Google Drive API).
2. In the [OAuth Playground](https://developers.google.com/oauthplayground) (⚙ → "Use your own OAuth credentials"), select **both** `https://www.googleapis.com/auth/drive` and `https://www.googleapis.com/auth/gmail.send`, sign in with the **group's Gmail** (the account that owns the Drive folder), and exchange the code for a refresh token.
3. Put that token in `GOOGLE_OAUTH_REFRESH_TOKEN` (one token for Drive and email). Optional: `EMAIL_FROM_NAME` (the sender's name), `APP_URL` (the site's https address for the links in emails; it defaults to `CLIENT_ORIGIN`). If the sending Gmail is a different account from the Drive one, put its token in `GMAIL_REFRESH_TOKEN` instead.
4. Restart. The server prints `Emails are sent from …@gmail.com (Gmail)`, or a warning that says what to fix (for example a token without the Gmail permission).

Without a token nothing is sent: on a computer used for testing each email is printed in the server log instead, links included. `EMAIL=off` turns sending off. Made-up test addresses (`@example.com`, `.test`, `.invalid`, such as the demo accounts' emails) are never sent to, only logged, so testing cannot cause bounced emails.

## Connecting Google Drive

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project and enable the **Google Drive API**.
2. Create the folder that will hold all materials in Google Drive. Copy its id (the part of the folder's URL after `/folders/`) into `GOOGLE_DRIVE_FOLDER_ID`.
3. Choose one of the two ways to sign in:
   - **Option A: a normal Google account (recommended).** Create an *OAuth client ID* of type "Web application" and add `https://developers.google.com/oauthplayground` as a redirect URI. In the [OAuth Playground](https://developers.google.com/oauthplayground), open the settings (⚙), choose "Use your own OAuth credentials", authorise the `https://www.googleapis.com/auth/drive` scope (plus `https://www.googleapis.com/auth/gmail.send` for emails) with the account that owns the folder, and exchange the code for a refresh token. Then fill in `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` and `GOOGLE_OAUTH_REFRESH_TOKEN`.
   - **Option B: a service account.** This only works with Google Workspace Shared Drives, because service accounts have no storage of their own. Create a service account and a JSON key. Add the service account's email as a member of the Shared Drive. Then set `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` (or `GOOGLE_SERVICE_ACCOUNT_JSON`).
4. Restart the server. It prints `Uploads go to Google Drive`, and `GET /api/health` returns `"drive": true`.
5. Files waiting for review are kept out of the shared folder. With Option A they wait in a private folder, **Scouts - waiting for review**, in the signed-in account's own Drive. With Option B they wait in a **_Waiting for review** folder inside the main folder; restrict who can open it, or set `GOOGLE_DRIVE_REVIEW_FOLDER_ID` to a private folder. Without Google Drive (local development) they wait in `server/uploads-pending`, which is never served publicly.

When an event or task is deleted, its approved files **stay in Drive** as an archive; files still waiting for review are deleted. When the uploader removes a file, it is deleted from Drive.

## Production

```bash
npm run build
```

```bash
NODE_ENV=production npm start
```

The Express server serves the built React app from `client/dist`, so one Node process runs the whole site. You can host it on any Node host (Render, Railway, a VPS, …) with MongoDB Atlas.

### Deploying on Render (free plan)

1. **Database:** use a separate, empty database for the live site: change the name in the Atlas connection string (for example `…mongodb.net/scouts_live?…`). In Atlas → Network Access allow `0.0.0.0/0` (Render's free plan has no fixed address) and use a database user with a strong password.
2. **Attendance:** the real Database members' usernames are already in `server/src/attendanceAssignments.js`; create their accounts with exactly those usernames.
3. **Web service:** on render.com → New → Web Service → this repository, branch `main`, region Frankfurt (closest to Egypt; ideally the Atlas cluster is in Frankfurt too), plan Free, health check path `/api/health`.
   - Build command: `npm install --prefix server && npm install --prefix client --include=dev && npm run build` (`--include=dev` is needed: with `NODE_ENV=production` npm would skip the build tools).
   - Start command: `npm start`
   - Environment: `NODE_ENV=production`, `TZ=Africa/Cairo`, `MONGO_URI` (the live database), a **new** `JWT_SECRET`, `CLIENT_ORIGIN=https://<app-name>.onrender.com`, `TRUST_PROXY=1`, the `GOOGLE_DRIVE_FOLDER_ID` and `GOOGLE_OAUTH_…` values, with a refresh token that also allows Gmail sending (see [Setting up emails](#setting-up-emails-the-groups-gmail)). Not `PORT` (Render sets it) and not `DNS_SERVERS`.
4. **First accounts:** on your computer, point `server/.env` at the live database, fill in the `SEED_ADMIN_…` and `SEED_DB_…` values (with their `…_EMAIL`, so "Forgot password?" works for them from the start), and run `npm run seed --prefix server`. Then point `.env` back at the test database.
5. **Check:** `https://<app-name>.onrender.com/api/health` shows `"ok":true,"drive":true`; sign in, add a test member with your own email (an event and a task for them should arrive by email), try "Forgot password?", upload and approve a file, take attendance, and a minute after start-up a `scouts-backup-automatic-…` file appears in Google Drive. Remove the test data, then share the link.

Every push to `main` redeploys automatically. On the free plan the site sleeps after 15 minutes without visitors and takes 30–60 seconds to wake.

### Security checklist before going live

- [ ] Serve the site **only over HTTPS**.
- [ ] `NODE_ENV=production`, `TZ=Africa/Cairo`, `MONGO_URI` and `CLIENT_ORIGIN` (the site's own https address).
- [ ] `JWT_SECRET`: a random string of at least 32 characters (the server refuses to start with a weak one).
- [ ] `TRUST_PROXY`: `1` on hosts such as Render or Railway that put one proxy in front of the app; `0` if Node is reached directly. Sign-in limits only count wrong passwords (50 per address and 8 per account every 15 minutes), so many leaders can sign in from the same church Wi-Fi.
- [ ] MongoDB Atlas: a database user with a strong password, and Network Access limited to the host's address where possible.
- [ ] Remove the demo accounts and events (`seed --demo` is refused in production).
- [x] Put the real usernames in `server/src/attendanceAssignments.js`.
- [ ] Make a first backup with `npm run backup` and check it appears in Google Drive (see [Backups](#backups)).
- [ ] Google Drive is configured, so materials do not use the local `uploads/` folder.

See [SECURITY.md](SECURITY.md) for the security assessment and the protections in place.

## Backups

The free MongoDB Atlas plan keeps no backups, so make your own copy regularly (for example every week, and always before a big change). Run these in the project folder (or in `server`) on a computer that has the project and `server/.env`:

```bash
npm run backup
```

This saves one file, such as `scouts-backup-2026-11-26_20-15-03.json.gz`, in a private **Scouts - backups** folder in the Google Drive the app already uses (the account of `GOOGLE_OAUTH_REFRESH_TOKEN`), outside the folder shared with the group. It holds every member (with photos and password hashes), event, attendance record and task. Uploaded task files are not in it, because they are already in Google Drive. Keep the folder private. `GOOGLE_DRIVE_BACKUP_FOLDER_ID` can name another folder.

To put a backup back (this **replaces** all current data; stop the server first, then start it again afterwards):

```bash
npm run restore
```

```bash
npm run restore -- latest
```

```bash
npm run restore -- scouts-backup-2026-11-26_20-15-03.json.gz
```

The first lists the backups, the second restores the newest, the third restores the one you name. It shows what the backup holds and asks you to type `RESTORE`. Before replacing anything it saves a safety copy of the current data (`scouts-before-restore-…`), so a wrong restore can be undone by restoring that copy.

**Automatic monthly backup.** The live server also saves a dated backup, such as `scouts-backup-automatic-2026-12-01.json.gz`, in the same folder every 30 days (`AUTO_BACKUP_DAYS`), and keeps only the newest 3 automatic ones (`AUTO_BACKUP_KEEP`), so damage noticed weeks later can still be undone. It checks soon after starting and then once a day; on the free host the server sleeps when nobody uses the app, but it checks again each time it wakes, so the backup is made within about a day of being due. It is on by default when `NODE_ENV=production` and off on computers used for testing (`AUTO_BACKUP=on` or `off` changes that). Backups made by hand are never deleted. Once a month, check that a recent automatic file is in the folder: if the Google keys stop working, the server log shows `Automatic backup failed` and no new files appear.

Without Google Drive, use a folder or a file on the computer instead: `npm run backup -- --to <folder>` and `npm run restore -- <path to the file>`.

## API overview

All routes except login need an `Authorization: Bearer <token>` header.

| Method | Route | What it does |
| --- | --- | --- |
| POST | `/api/auth/login` | Sign in with username and password |
| GET | `/api/auth/me` | The signed-in user and their permissions |
| PUT | `/api/auth/me/password` | Change your own password |
| PUT | `/api/auth/me/profile` | Set your own mobile number and/or email (a new email gets a confirmation code) |
| POST/DELETE | `/api/auth/me/email-code` | Confirm the waiting email with its `code`, or cancel the change |
| POST | `/api/auth/me/email-code/resend` | Send a new code (after a minute) |
| POST | `/api/auth/forgot` | Email a password-reset link (`login`: username or email); always answers the same |
| POST | `/api/auth/reset` | Set a new password with the link's `token`; signs you in |
| GET | `/api/badges/mine`, `/api/badges/user/:id`, `/api/badges/counts` | Your badges, a member's badges (and whether you can give one), badge counts for the Members list |
| POST/DELETE | `/api/badges[/:id]` | Give a badge (`user`, `title`, optional `reason`) or remove one |
| GET | `/api/events?when=upcoming\|past\|all&team=` | List events you can see (`team=group` for whole-group events) |
| POST/PUT/DELETE | `/api/events[/:id]` | Manage events |
| GET | `/api/events/:id` | An event with its tasks |
| GET/PUT | `/api/events/:id/attendance` | The attendance sheet, and saving it (`{ records: [{ user, status }] }`) |
| GET | `/api/tasks/mine?status=open\|done\|all` | Tasks assigned to you |
| POST/PUT/DELETE | `/api/tasks[/:id]` | Manage tasks (the assignee can only change the status) |
| POST | `/api/tasks/:id/materials` | Upload material (`multipart/form-data`, field `file`) |
| DELETE | `/api/tasks/:id/materials/:materialId` | Remove an uploaded file |
| GET | `/api/tasks/reviews`, `/api/tasks/reviews/count` | Tasks with files waiting for your review, and how many files |
| GET | `/api/tasks/:id/materials/:materialId/file` | Open a file waiting for review (its uploader and the reviewers) |
| POST | `/api/tasks/:id/materials/:materialId/approve` | Approve a file: it moves into the event's Drive folder |
| POST | `/api/tasks/:id/materials/:materialId/send-back` | Send a file back with a `note`; the file is deleted |
| GET | `/api/users`, `/api/users/:id`, `/api/users/attendance` | Members, one member's details and attendance, everyone's attendance % |
| POST/PUT | `/api/users[/:id]` | Add or edit members (Database / Attendance team; the 3 non-privileged ones for their assigned kadr only) |
| GET | `/api/stats/me` | The home screen summary and your attendance |

## Coming later

KPIs for yourself or others (depending on access), plus the other features planned for future versions.
