import { isArabic, t } from './i18n.jsx';

// Team colours are taken from the group logo.
export const TEAMS = [
  { id: 'Ashbal', arabic: 'أشبال', color: '#e3a400', soft: '#fff6d6' },
  { id: 'Zahrat', arabic: 'زهرات', color: '#1e9e4a', soft: '#e3f6ea' },
  { id: 'Kashafeen', arabic: 'كشافين', color: '#2b2e8f', soft: '#e7e8f8' },
  { id: 'Morshedat', arabic: 'مرشدات', color: '#d7262e', soft: '#fde7e8' },
  { id: 'Gawala', arabic: 'جوالة', color: '#0f7c86', soft: '#dff3f4' },
];

export const TEAM_BY_ID = Object.fromEntries(TEAMS.map((t) => [t.id, t]));

// Labels are getters so they follow the chosen language.
const item = (id, en, extra = {}) => ({ id, get label() { return t(en); }, ...extra });

export const ROLES = [
  item('scout_leader', 'Group Leader'),
  item('scout_leader_helper', 'Group Leader Helper'),
  item('database_team', 'Database / Attendance'),
  item('team_leader', 'Kadr Leader'),
  item('team_leader_helper', 'Kadr Leader Helper'),
];

const labelMap = (list) => new Proxy({}, { get: (_, id) => list.find((x) => x.id === id)?.label });

export const ROLE_LABEL = labelMap(ROLES);

/** A person's role, naming their kadr for kadr leaders (Ashbal Kadr Leader / قائد كدر أشبال). */
export function roleLabel(person) {
  if (!person) return '';
  if (person.team && person.role === 'team_leader') return t('{team} Kadr Leader', { team: teamName(person.team) });
  if (person.team && person.role === 'team_leader_helper') return t('{team} Kadr Leader Helper', { team: teamName(person.team) });
  return ROLE_LABEL[person.role];
}

export const STATUSES = [item('todo', 'To do'), item('in_progress', 'In progress'), item('done', 'Done')];

export const STATUS_LABEL = labelMap(STATUSES);

/** A team's name in the chosen language (Ashbal / أشبال). */
export const teamName = (id) => (!id ? '' : isArabic() ? TEAM_BY_ID[id]?.arabic || id : id);

export const VERSE = {
  text: 'فَلْيُضِئْ نُورُكُمْ هَكَذَا قُدَّامَ النَّاسِ، لِكَيْ يَرَوْا أَعْمَالَكُمُ الْحَسَنَةَ، وَيُمَجِّدُوا أَبَاكُمُ الَّذِي فِي السَّمَاوَاتِ.',
  ref: 'إنجيل متى 5: 16',
};

export const ACCEPTED_FILES = '.pdf,.doc,.docx,image/*';

// Event types. `group: true` = belongs to the whole group (members of ALL teams on the attendance sheet).
// Preparation Meetings are created only by the Group Leader, Helpers, and a Kadr Leader for their own kadr.
export const EVENT_TYPES = [
  item('team_session', 'Kadr Session', { attendance: true, group: false }),
  item('preparation_meeting', 'Preparation Meeting', { attendance: true, group: false }),
  item('gawala_session', 'Gawala Session', { attendance: true, group: true }),
  item('other', 'Others', { attendance: false, group: false }),
];

export const EVENT_TYPE_BY_ID = Object.fromEntries(EVENT_TYPES.map((t) => [t.id, t]));
// Events created before types existed count as "Others".
export const eventType = (event) => EVENT_TYPE_BY_ID[event?.type] || EVENT_TYPE_BY_ID.other;

const mark = (id, en, letter) => ({ id, get label() { return t(en); }, get short() { return t(letter); } });

export const ATTENDANCE_STATUSES = [mark('present', 'Present', 'P'), mark('absent', 'Absent', 'A'), mark('excused', 'Excused', 'E')];

// Colours for whole-group events (no single team).
export const GROUP_STYLE = { color: '#23277d', soft: '#e7e8f8' };
