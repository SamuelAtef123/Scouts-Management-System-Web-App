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
- **Members**: every member's details and attendance percentage. The Group Leader and Helpers view everyone; all 5 Database / Attendance members can add accounts, edit them, reset passwords and deactivate members (the 3 non-privileged ones only for their assigned kadr).
- **Profile**: your mobile number and photo (both editable), your attendance, and changing your password. On first sign-in, anyone without a mobile number must add one (a photo is optional) before using the app. Only Egyptian mobile numbers are accepted: 11 digits starting with 010, 011, 012 or 015, stored as +20.

## Who can do what

| Persona | Events and tasks | Sees |
| --- | --- | --- |
| Group Leader (1) | Every kadr | Every kadr (or a selected kadr) |
| Group Leader Helper (2) | Every kadr | Every kadr (or a selected kadr) |
| Database / Attendance team, **privileged** (2 of 5) | Every kadr | Every kadr (or a selected kadr) |
| Database / Attendance team, others (3 of 5) | Their own kadr | Their own kadr |
| Kadr Leader (5, one per kadr) | Their own kadr | Their own kadr |
| Kadr Leader Helper (the rest) | Their own kadr | Their own kadr |

- Only the person a task is assigned to can upload its material and change its status.
- **Reviewing uploaded files.** A file uploaded for a task waits as *Waiting for review* in a private place and is not in the event's Drive folder yet. It can be reviewed by:
  - the Group Leader and the Group Leader Helpers, for every event;
  - the Kadr Leader of the event's kadr (the Gawala Kadr Leader for whole-group events).

  Reviewers find these files under **My tasks → To review**, with a count on Home and in the menu. **Approve** moves the file into the event's Drive folder. **Send back** deletes it and shows the uploader a note, so they can upload a new version. A reviewer's own upload is approved straight away. Until then, only the uploader and the reviewers can open the file, and the task cannot be marked Done.
- A task can only be assigned to a member of its event's kadr, whoever creates it. Whole-group events (Gawala Sessions, and whole-group Others events) can be assigned to any member.
- Events cannot start in the past. Past events can still be edited, as long as their date is not moved.
- **Members page** (details and attendance percentage):
  - Group Leader and Group Leader Helpers: **view** all members.
  - The 2 privileged Database / Attendance members: view all members, and **add, edit or deactivate** accounts and reset passwords.
  - The other 3 Database / Attendance members: view, **add, edit or deactivate** members of **their assigned kadr only**. They can only give the Kadr Leader or Kadr Leader Helper role, and can't move a member out of their kadr.
  - Kadr Leaders and Kadr Leader Helpers: no Members page.
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
  - The assignments are **fixed in the code** in `server/src/attendanceAssignments.js` (username → kadr), not set from the app. To change them, edit that file and redeploy. **Replace the demo usernames there with the real ones before going live.**
  - On start, the server checks that list and warns about a missing kadr, an unknown username, or an account that isn't in the Database/Attendance team. The username of an assigned member can't be changed from the Members page.
  - A Kadr Session or Preparation Meeting is recorded only by the member assigned to the event's kadr.
  - A Gawala Session (all kadrs) is recorded only by the member assigned to Gawala. The event page shows which kadrs' sections are done.
  - A Database / Attendance member sees the Gawala kadr's events, their assigned kadr's events, and whole-group events. The 2 privileged members still see and manage every kadr, but take attendance only for their own kadr.
  - Anyone who can see an event can view its sheet.
- Profile: attendance rate = present ÷ (present + absent). Excused sessions don't count against the member.

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

   Edit `server/.env`. At minimum, set `MONGO_URI`, `JWT_SECRET` and `SEED_ADMIN_PASSWORD`.

3. Create the first account (the Group Leader). Add `:demo` to also add sample members, events and tasks, which is useful for trying the app:

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

## Connecting Google Drive

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project and enable the **Google Drive API**.
2. Create the folder that will hold all materials in Google Drive. Copy its id (the part of the folder's URL after `/folders/`) into `GOOGLE_DRIVE_FOLDER_ID`.
3. Choose one of the two ways to sign in:
   - **Option A: a normal Google account (recommended).** Create an *OAuth client ID* of type "Web application" and add `https://developers.google.com/oauthplayground` as a redirect URI. In the [OAuth Playground](https://developers.google.com/oauthplayground), open the settings (⚙), choose "Use your own OAuth credentials", authorise the `https://www.googleapis.com/auth/drive` scope with the account that owns the folder, and exchange the code for a refresh token. Then fill in `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` and `GOOGLE_OAUTH_REFRESH_TOKEN`.
   - **Option B: a service account.** This only works with Google Workspace Shared Drives, because service accounts have no storage of their own. Create a service account and a JSON key. Add the service account's email as a member of the Shared Drive. Then set `GOOGLE_SERVICE_ACCOUNT_KEY_FILE` (or `GOOGLE_SERVICE_ACCOUNT_JSON`).
4. Restart the server. It prints `Uploads go to Google Drive`, and `GET /api/health` returns `"drive": true`.
5. Files waiting for review are kept out of the shared folder. With Option A they wait in a private folder, **Scouts - waiting for review**, in the signed-in account's own Drive. With Option B they wait in a **_Waiting for review** folder inside the main folder; restrict who can open it, or set `GOOGLE_DRIVE_REVIEW_FOLDER_ID` to a private folder. Without Google Drive (local development) they wait in `server/uploads-pending`, which is never served publicly.

When an event or task is deleted, its approved files **stay in Drive** as an archive; files still waiting for review are deleted. Removing a single file from a task deletes it from Drive.

## Production

```bash
npm run build
```

```bash
NODE_ENV=production npm start
```

The Express server serves the built React app from `client/dist`, so one Node process runs the whole site. You can host it on any Node host (Render, Railway, a VPS, …) with MongoDB Atlas.

### Security checklist before going live

- [ ] Serve the site **only over HTTPS**.
- [ ] `NODE_ENV=production`, `TZ=Africa/Cairo`, `MONGO_URI` and `CLIENT_ORIGIN` (the site's own https address).
- [ ] `JWT_SECRET`: a random string of at least 32 characters (the server refuses to start with a weak one).
- [ ] `TRUST_PROXY`: `1` on hosts such as Render or Railway that put one proxy in front of the app; `0` if Node is reached directly.
- [ ] MongoDB Atlas: a database user with a strong password, and Network Access limited to the host's address where possible.
- [ ] Remove the demo accounts and events (`seed --demo` is refused in production).
- [ ] Put the real usernames in `server/src/attendanceAssignments.js`.
- [ ] Google Drive is configured, so materials do not use the local `uploads/` folder.

See [SECURITY.md](SECURITY.md) for the security assessment and the protections in place.

## API overview

All routes except login need an `Authorization: Bearer <token>` header.

| Method | Route | What it does |
| --- | --- | --- |
| POST | `/api/auth/login` | Sign in with username and password |
| GET | `/api/auth/me` | The signed-in user and their permissions |
| PUT | `/api/auth/me/password` | Change your own password |
| PUT | `/api/auth/me/profile` | Set your own mobile number |
| PUT/DELETE | `/api/auth/me/photo` | Set (`multipart/form-data`, field `file`) or remove your photo |
| GET | `/api/users/:id/photo` | A member's photo |
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
