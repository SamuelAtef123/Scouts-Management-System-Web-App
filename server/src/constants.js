// The five teams of the scouts group.
export const TEAMS = ['Ashbal', 'Zahrat', 'Kashafeen', 'Morshedat', 'Gawala'];

// User roles (personas).
export const ROLES = {
  SCOUT_LEADER: 'scout_leader',
  SCOUT_LEADER_HELPER: 'scout_leader_helper',
  DATABASE_TEAM: 'database_team',
  TEAM_LEADER: 'team_leader',
  TEAM_LEADER_HELPER: 'team_leader_helper',
};

export const ROLE_VALUES = Object.values(ROLES);

export const TASK_STATUSES = ['todo', 'in_progress', 'done'];

// Material types a user can upload for a task (PDF, Word, images).
export const ALLOWED_MATERIAL_TYPES = {
  'application/pdf': 'PDF',
  'application/msword': 'Word',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
  'image/jpeg': 'Image',
  'image/png': 'Image',
  'image/webp': 'Image',
  'image/gif': 'Image',
  'image/heic': 'Image',
  'image/heif': 'Image',
};

// Event types. Attendance is taken for every type except "other".
export const EVENT_TYPES = ['team_session', 'preparation_meeting', 'gawala_session', 'other'];
// A Gawala Session belongs to the whole group (no single team) and lists members of ALL teams on its sheet.
// Every other type, including a Preparation Meeting, belongs to one team and lists only that team.
export const GROUP_EVENT_TYPES = ['gawala_session'];
export const ATTENDANCE_EVENT_TYPES = ['team_session', 'preparation_meeting', 'gawala_session'];
export const ATTENDANCE_STATUSES = ['present', 'absent', 'excused'];
