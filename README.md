# Light of the World — Scouts Management System

A web app for the leaders (the Gawala team) of the **St. Mary Church, Garden City Scouts** group. Leaders use it to plan events, split the work into tasks, assign the tasks to each other, and upload each task's material to Google Drive.

The app is designed for phones first and also works on a computer.

> فَلْيُضِئْ نُورُكُمْ هَكَذَا قُدَّامَ النَّاسِ، لِكَيْ يَرَوْا أَعْمَالَكُمُ الْحَسَنَةَ، وَيُمَجِّدُوا أَبَاكُمُ الَّذِي فِي السَّمَاوَاتِ. — إنجيل متى 5: 16

## Features (first version)

- **Events**: create, edit and delete events, and see upcoming and past events (grouped by month, with a team filter).
- **Tasks**: add tasks to an event, assign each one to a leader, and set a due date. The person assigned can move the task through *To do → In progress → Done*.
- **Materials**: the person assigned uploads the task's material (a PDF, Word document or image). It goes to Google Drive, sorted into `Team / Date Event title` folders.
- **Event types**: Team Session, Preparation Meeting, Gawala Session and Others. A Gawala Session belongs to the whole group, so everyone sees it; every other type belongs to one team.
- **Attendance**: each event except "Others" has an attendance sheet. Mark each member Present, Absent or Excused; anyone left unmarked is saved as absent. Each member's attendance rate is shown on their Profile.
- **Home**: a personal summary showing open, done and overdue tasks, your next tasks and upcoming events.
- **Members**: every member's details and attendance percentage. The Scouts Leader and Helpers view everyone; the 3 non-privileged Database / Attendance members view their assigned team; the 2 privileged ones can also add accounts, set roles and teams, reset passwords and deactivate members.
- **Profile**: change your own password.

## Who can do what

| Persona | Events and tasks | Sees |
| --- | --- | --- |
| Scouts Leader (1) | Every team | Every team (or a selected team) |
| Scouts Leader Helper (2) | Every team | Every team (or a selected team) |
| Database / Attendance team, **privileged** (2 of 5) | Every team | Every team (or a selected team) |
| Database / Attendance team, others (3 of 5) | Their own team | Their own team |
| Team Leader (5, one per team) | Their own team | Their own team |
| Team Leader Helper (the rest) | Their own team | Their own team |

- Only the person a task is assigned to can upload its material and change its status.
- People with team-only access can assign tasks to members of that team. People with access to every team can assign tasks to anyone.
- **Members page** (details and attendance percentage):
  - Scouts Leader and Scouts Leader Helpers: **view** all members.
  - The 2 privileged Database / Attendance members: view all members, and **add, edit or deactivate** accounts and reset passwords. Only they can edit.
  - The other 3 Database / Attendance members: **view only the members of their assigned team**.
  - Team Leaders and Team Leader Helpers: no Members page.
- **Preparation Meetings** belong to one team. Only the Scouts Leader, the Scouts Leader Helpers, and a Team Leader (for their own team) can create, edit or delete them. Preparation Meetings have **no tasks**.
- **Gawala Sessions** (whole-group events) are created and managed by the leaders who have access to every team.
- The rules live in one place: `server/src/utils/access.js`.

## Attendance

| Event type | Whose attendance is taken |
| --- | --- |
| Team Session | Members of that event's team only (the Gawala team can have Team Sessions too) |
| Preparation Meeting | Members of that event's team only |
| Gawala Session | Members of all teams, grouped by team |
| Others | No attendance |

- Roles only decide permissions. Team membership decides who is on an attendance sheet, so every member belongs to a team. The Scouts Leader, Helpers and the Database team belong to the Gawala team; on its first start, the server moves anyone without a team into Gawala.
- Before a team's section is first saved, it lists the team's current members. On that first save the list is fixed, so later team changes don't alter past sheets. After attendance is taken, the event's type and team can't be changed.
- Who records attendance: **only the 5 Database / Attendance team members, each for one assigned team**. Nobody else can record it, including the Scouts Leader.
  - The assignments are **fixed in the code** in `server/src/attendanceAssignments.js` (username → team), not set from the app. To change them, edit that file and redeploy. **Replace the demo usernames there with the real ones before going live.**
  - On start, the server checks that list and warns about a missing team, an unknown username, or an account that isn't in the Database/Attendance team. The username of an assigned member can't be changed from the Members page.
  - A Team Session or Preparation Meeting is recorded only by the member assigned to the event's team.
  - A Gawala Session (all teams) is recorded only by the member assigned to Gawala. The event page shows which teams' sections are done.
  - A Database / Attendance member sees the Gawala team's events, their assigned team's events, and whole-group events. The 2 privileged members still see and manage every team, but take attendance only for their own team.
  - Anyone who can see an event can view its sheet.
- Profile: attendance rate = present ÷ (present + absent). Excused sessions don't count against the member.

Teams: Ashbal (أشبال), Zahrat (زهرات), Kashafeen (كشافين), Morshedat (مرشدات), Gawala (جوالة). Each team has a colour taken from the logo.

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

3. Create the first account (the Scouts Leader). Add `:demo` to also add sample members, events and tasks, which is useful for trying the app:

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

When an event or task is deleted, its uploaded files **stay in Drive** as an archive. Removing a single file from a task deletes it from Drive.

## Production

```bash
npm run build
```

```bash
NODE_ENV=production npm start
```

The Express server serves the built React app from `client/dist`, so one Node process runs the whole site. Set `NODE_ENV=production`, a strong `JWT_SECRET`, `MONGO_URI` and `TZ=Africa/Cairo`. You can host it on any Node host (Render, Railway, a VPS, …) with MongoDB Atlas. Serve it over HTTPS.

## API overview

All routes except login need an `Authorization: Bearer <token>` header.

| Method | Route | What it does |
| --- | --- | --- |
| POST | `/api/auth/login` | Sign in with username and password |
| GET | `/api/auth/me` | The signed-in user and their permissions |
| PUT | `/api/auth/me/password` | Change your own password |
| GET | `/api/events?when=upcoming\|past\|all&team=` | List events you can see (`team=group` for whole-group events) |
| POST/PUT/DELETE | `/api/events[/:id]` | Manage events |
| GET | `/api/events/:id` | An event with its tasks |
| GET/PUT | `/api/events/:id/attendance` | The attendance sheet, and saving it (`{ records: [{ user, status }] }`) |
| GET | `/api/tasks/mine?status=open\|done\|all` | Tasks assigned to you |
| POST/PUT/DELETE | `/api/tasks[/:id]` | Manage tasks (the assignee can only change the status) |
| POST | `/api/tasks/:id/materials` | Upload material (`multipart/form-data`, field `file`) |
| DELETE | `/api/tasks/:id/materials/:materialId` | Remove an uploaded file |
| GET | `/api/users`, `/api/users/:id`, `/api/users/attendance` | Members, one member's details and attendance, everyone's attendance % |
| POST/PUT | `/api/users[/:id]` | Add or edit members (privileged Database / Attendance members only) |
| GET | `/api/stats/me` | The home screen summary and your attendance |

## Coming later

KPIs for yourself or others (depending on access), plus the other features planned for future versions.
