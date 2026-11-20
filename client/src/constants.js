// Team colours are taken from the group logo.
export const TEAMS = [
  { id: 'Ashbal', arabic: 'أشبال', color: '#e3a400', soft: '#fff6d6' },
  { id: 'Zahrat', arabic: 'زهرات', color: '#1e9e4a', soft: '#e3f6ea' },
  { id: 'Kashafeen', arabic: 'كشافين', color: '#2b2e8f', soft: '#e7e8f8' },
  { id: 'Morshedat', arabic: 'مرشدات', color: '#d7262e', soft: '#fde7e8' },
  { id: 'Gawala', arabic: 'جوالة', color: '#0f7c86', soft: '#dff3f4' },
];

export const TEAM_BY_ID = Object.fromEntries(TEAMS.map((t) => [t.id, t]));

export const ROLES = [
  { id: 'scout_leader', label: 'Scouts Leader' },
  { id: 'scout_leader_helper', label: 'Scouts Leader Helper' },
  { id: 'database_team', label: 'Database / Attendance' },
  { id: 'team_leader', label: 'Team Leader' },
  { id: 'team_leader_helper', label: 'Team Leader Helper' },
];

export const ROLE_LABEL = Object.fromEntries(ROLES.map((r) => [r.id, r.label]));

export const STATUSES = [
  { id: 'todo', label: 'To do' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'done', label: 'Done' },
];

export const STATUS_LABEL = Object.fromEntries(STATUSES.map((s) => [s.id, s.label]));

export const VERSE = {
  text: 'فَلْيُضِئْ نُورُكُمْ هَكَذَا قُدَّامَ النَّاسِ، لِكَيْ يَرَوْا أَعْمَالَكُمُ الْحَسَنَةَ، وَيُمَجِّدُوا أَبَاكُمُ الَّذِي فِي السَّمَاوَاتِ.',
  ref: 'إنجيل متى 5: 16',
};

export const ACCEPTED_FILES = '.pdf,.doc,.docx,image/*';

// Event types. `group: true` = belongs to the whole group (members of ALL teams on the attendance sheet).
export const EVENT_TYPES = [
  { id: 'team_session', label: 'Team Session', hint: "Attendance of the team's members", attendance: true, group: false },
  { id: 'preparation_meeting', label: 'Preparation Meeting', hint: 'Whole group · attendance of all teams', attendance: true, group: true },
  { id: 'gawala_session', label: 'Gawala Session', hint: 'Whole group · attendance of all teams', attendance: true, group: true },
  { id: 'other', label: 'Others', hint: 'No attendance', attendance: false, group: false },
];

export const EVENT_TYPE_BY_ID = Object.fromEntries(EVENT_TYPES.map((t) => [t.id, t]));
// Events created before types existed count as "Others".
export const eventType = (event) => EVENT_TYPE_BY_ID[event?.type] || EVENT_TYPE_BY_ID.other;

export const ATTENDANCE_STATUSES = [
  { id: 'present', label: 'Present', short: 'P' },
  { id: 'absent', label: 'Absent', short: 'A' },
  { id: 'excused', label: 'Excused', short: 'E' },
];

// Colours for whole-group events (no single team).
export const GROUP_STYLE = { color: '#23277d', soft: '#e7e8f8' };
