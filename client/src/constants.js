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
