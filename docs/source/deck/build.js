const path = require('path');
const pptxgen = require('pptxgenjs');
const React = require('react');
const ReactDOMServer = require('react-dom/server');
const sharp = require('sharp');
const lu = require('react-icons/lu');
// Optional: the pptx skill's apply_theme.js writes the theme colours into the file (set APPLY_THEME to its path).
const applyTheme = process.env.APPLY_THEME ? require(process.env.APPLY_THEME).applyTheme : null;

const IMG = path.resolve(__dirname, '../report');
const OUT = process.argv[2] || path.resolve(__dirname, '../../Scouts-Project-Presentation.pptx');

// Colours from the group logo.
const THEME = {
  name: 'Light of the World',
  headFontFace: 'Rockwell',
  bodyFontFace: 'Calibri',
  colors: {
    dk1: '2B2418', lt1: 'FFFFFF', dk2: '2D5A3E', lt2: 'F2ECDD',
    accent1: '2D5A3E', accent2: '1E8A43', accent3: 'C8352B', accent4: 'D99A16', accent5: '0F7C86', accent6: 'F3C84B',
    hlink: '2D5A3E', folHlink: '0F7C86',
  },
};
// Scout field-kit palette (matches the app): forest green and khaki on canvas, logo colours as accents.
// Palette of the app: white, navy and purple. ok/wait are meaning colours; KADR are the logo's kadr colours.
const HEX = { navy: '1F2A5E', forestDeep: '141C44', green: '3B4A8F', red: '52298F', gold: '8A5CD0', teal: '6D3FB5', yellow: 'C9B6F2', ink: '1A1F36', muted: '6B7190', border: 'E1E4EF', tint: 'FFFFFF', canvas: 'F8F9FC', khaki: 'B9A3E0', stitch: 'CFC6EA', ok: '1E7A3C', wait: 'B07800' };
const KADR = { Ashbal: 'E3A400', Zahrat: '1E9E4A', Kashafeen: '2B2E8F', Morshedat: 'D7262E', Gawala: '0F7C86' };
const ASSETS = path.resolve(__dirname, 'assets');

async function icon(name, color = 'FFFFFF') {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(lu[name], { color: `#${color}`, size: 256 }));
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return 'image/png;base64,' + buf.toString('base64');
}

(async () => {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5
  pres.title = 'Scouts Management System — Project Report and User Guide';
  pres.author = 'Gawala kadr';
  pres.subject = 'Light of the World scouts app';
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
  const C = pres.SchemeColor;
  const W = 13.333;

  // ---------- Layouts ----------
  pres.defineSlideMaster({
    title: 'Title Dark',
    background: { color: HEX.navy },
    objects: [
      { placeholder: { options: { name: 'title', type: 'title', x: 0.8, y: 3.35, w: 9.5, h: 1.3, fontSize: 44, bold: true, color: C.background1, valign: 'bottom', align: 'left', margin: 0 }, text: '' } },
      { placeholder: { options: { name: 'body', type: 'body', x: 0.8, y: 4.75, w: 9.5, h: 0.6, fontSize: 20, color: C.background1, align: 'left', margin: 0 }, text: '' } },
    ],
  });
  pres.defineSlideMaster({
    title: 'Content',
    background: { path: path.join(ASSETS, 'canvas-topo.png') },
    margin: [0.5, 0.6, 0.6, 0.6],
    objects: [
      { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 0.3, w: 12.1, h: 0.85, fontSize: 28, bold: true, color: C.text2, valign: 'middle', align: 'left', margin: 0 }, text: '' } },
      { image: { x: 0.6, y: 1.13, w: 12.1, h: 0.1, path: path.join(ASSETS, 'rope.png') } },
      { image: { x: 0.6, y: 6.95, w: 0.32, h: 0.32, path: path.join(IMG, 'logo.jpg'), rounding: true } },
      { text: { text: 'Scouts Management System  ·  Light of the World', options: { x: 1.0, y: 6.95, w: 6, h: 0.32, fontSize: 10, color: C.text1, transparency: 40, valign: 'middle', margin: 0 } } },
    ],
    slideNumber: { x: 12.2, y: 6.95, w: 0.5, h: 0.32, fontSize: 10, color: HEX.muted, align: 'right' },
  });
  pres.defineSlideMaster({
    title: 'Closing Dark',
    background: { color: HEX.navy },
    objects: [
      { placeholder: { options: { name: 'title', type: 'title', x: 0.8, y: 0.6, w: 11.7, h: 0.9, fontSize: 36, bold: true, color: C.background1, margin: 0 }, text: '' } },
    ],
  });

  const ic = {};
  for (const n of ['LuLockKeyhole', 'LuSmartphone', 'LuCalendarDays', 'LuShapes', 'LuListChecks', 'LuUpload', 'LuClipboardCheck', 'LuUsers', 'LuHouse', 'LuUserRound', 'LuCrown', 'LuFlag', 'LuHandHelping', 'LuDatabase', 'LuServer', 'LuLayoutDashboard', 'LuFolderOpen', 'LuRocket', 'LuKeyRound', 'LuFileCode', 'LuHardDrive', 'LuGlobe', 'LuBan', 'LuUserPlus', 'LuEye', 'LuPencil', 'LuShieldCheck', 'LuFileCheck2', 'LuDatabaseBackup', 'LuMail']) {
    ic[n] = await icon(n);
  }

  // Icon in a coloured circle — the deck's motif.
  const badge = (slide, name, x, y, d, color) => {
    slide.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color }, line: { color, width: 0 }, objectName: `icon circle ${name}` });
    const r = d * 0.07;
    slide.addShape(pres.shapes.OVAL, { x: x + r, y: y + r, w: d - 2 * r, h: d - 2 * r, fill: { type: 'none' }, line: { color: 'FFFFFF', width: 0.75, dashType: 'dash', transparency: 25 }, objectName: `badge stitching ${name}` });
    const p = d * 0.26;
    slide.addImage({ data: ic[name], x: x + p, y: y + p, w: d - 2 * p, h: d - 2 * p, altText: name.replace('Lu', ''), objectName: `icon ${name}` });
  };
  const card = (slide, x, y, w, h, name = 'card') => {
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.1, fill: { color: HEX.tint }, line: { color: HEX.border, width: 0.75 }, objectName: name });
    // stitched edge, like an embroidered patch
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 0.07, y: y + 0.07, w: w - 0.14, h: h - 0.14, rectRadius: 0.07, fill: { type: 'none' }, line: { color: HEX.stitch, width: 1, dashType: 'dash' }, objectName: `${name} stitching` });
  };
  const phone = (slide, file, x, y, h, caption) => {
    const w = h * (390 / 844);
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x - 0.09, y: y - 0.09, w: w + 0.18, h: h + 0.18, rectRadius: 0.22, fill: { color: HEX.ink }, line: { color: HEX.ink, width: 0 }, shadow: { type: 'outer', blur: 8, offset: 3, angle: 90, color: '000000', opacity: 0.25 }, objectName: 'phone frame' });
    slide.addImage({ path: path.join(IMG, file), x, y, w, h, altText: caption, objectName: `screenshot ${caption}` });
    slide.addText(caption, { x: x - 0.3, y: y + h + 0.15, w: w + 0.6, h: 0.3, fontSize: 11, color: HEX.muted, align: 'center', isTextBox: true, margin: 0 });
  };
  const steps = (slide, items, x, y, w, color, gap = 0.82, size = 15) => {
    items.forEach((t, i) => {
      const yy = y + i * gap;
      slide.addShape(pres.shapes.OVAL, { x, y: yy, w: 0.42, h: 0.42, fill: { color }, line: { color, width: 0 }, objectName: `step ${i + 1}` });
      slide.addText(String(i + 1), { x, y: yy, w: 0.42, h: 0.42, fontSize: 14, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle', isTextBox: true, margin: 0 });
      slide.addText(t, { x: x + 0.6, y: yy - 0.04, w: w - 0.6, h: gap - 0.06, fontSize: size, color: HEX.ink, valign: 'top', isTextBox: true, margin: 0 });
    });
  };
  const R = (text, opts = {}) => ({ text, options: opts });

  // ===== 1. Title =====
  pres.addSection({ title: 'Overview' });
  let s = pres.addSlide({ masterName: 'Title Dark', sectionTitle: 'Overview' });
  s.addImage({ path: path.join(IMG, 'group.jpg'), x: 0, y: 0, w: W, h: W * (554 / 974), altText: 'The Gawala kadr together at St. Mary Church', objectName: 'group photo', sizing: { type: 'cover', w: W, h: 7.5 } });
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: W, h: 7.5, fill: { color: HEX.forestDeep, transparency: 30 }, line: { color: HEX.forestDeep, width: 0 }, objectName: 'photo overlay' });
  s.addImage({ path: path.join(ASSETS, 'deckle.png'), x: 0, y: 7.0, w: W, h: 0.5, altText: '', objectName: 'torn paper edge' });
  s.addShape(pres.shapes.OVAL, { x: 0.72, y: 1.37, w: 1.76, h: 1.76, fill: { color: 'FFFFFF' }, line: { color: HEX.khaki, width: 3 }, objectName: 'logo ring' });
  s.addImage({ path: path.join(IMG, 'logo.jpg'), x: 0.8, y: 1.45, w: 1.6, h: 1.6, rounding: true, altText: 'St. Mary Church Garden City Scout logo', objectName: 'logo' });
  s.addText('Scouts Management System', { placeholder: 'title' });
  s.addText('Project report and user guide  ·  Light of the World', { placeholder: 'body' });
  s.addText('St. Mary Church, Garden City Scouts  ·  24 November 2026', { x: 0.8, y: 5.45, w: 9.5, h: 0.4, fontSize: 14, color: 'FFFFFF', transparency: 15, isTextBox: true, margin: 0 });
  s.addNotes('A web app for the 60 Gawala leaders to plan events, share tasks, take attendance and store task materials in Google Drive.');

  // ===== 2. At a glance =====
  s = pres.addSlide({ masterName: 'Content', sectionTitle: 'Overview' });
  s.addText('One app for planning, tasks and attendance', { placeholder: 'title' });
  s.addText('The 60 Gawala leaders plan events, share out tasks, take attendance and keep task materials in Google Drive. Built for phones first, and it works on a computer too.', { x: 0.6, y: 1.35, w: 12.1, h: 0.8, fontSize: 17, color: HEX.ink, isTextBox: true, margin: 0 });
  const stats = [['60', 'leaders using the app', HEX.navy], ['5', 'kadrs in the group', HEX.green], ['5', 'roles, each with its own rights', HEX.red], ['4', 'types of event', HEX.gold]];
  stats.forEach(([n, l, c], i) => {
    const x = 0.6 + i * 3.1;
    card(s, x, 2.45, 2.85, 2.05, `stat ${l}`);
    s.addText(n, { x: x + 0.3, y: 2.6, w: 2.3, h: 1.1, fontSize: 60, bold: true, color: c, isTextBox: true, margin: 0, valign: 'middle' });
    s.addText(l, { x: x + 0.3, y: 3.7, w: 2.4, h: 0.6, fontSize: 14, color: HEX.muted, isTextBox: true, margin: 0, valign: 'top' });
  });
  const teams = [['Ashbal', 'أشبال', KADR.Ashbal], ['Zahrat', 'زهرات', KADR.Zahrat], ['Kashafeen', 'كشافين', KADR.Kashafeen], ['Morshedat', 'مرشدات', KADR.Morshedat], ['Gawala', 'جوالة', KADR.Gawala]];
  s.addText('The five kadrs', { x: 0.6, y: 4.95, w: 4, h: 0.4, fontSize: 16, bold: true, color: HEX.ink, isTextBox: true, margin: 0 });
  teams.forEach(([en, ar, c], i) => {
    const x = 0.6 + i * 2.46;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 5.45, w: 2.26, h: 0.95, rectRadius: 0.12, fill: { color: c }, line: { color: c, width: 0 }, objectName: `kadr ${en}` });
    s.addText([R(en, { bold: true, fontSize: 17, breakLine: true }), R(ar, { fontSize: 15, fontFace: 'Arial', rtlMode: true })], { x, y: 5.45, w: 2.26, h: 0.95, color: 'FFFFFF', align: 'center', valign: 'middle', isTextBox: true, margin: 0 });
  });
  s.addNotes('Every member belongs to one kadr. The Group Leader, the Helpers and the Database / Attendance team belong to Gawala.');

  // ===== 3. What has been built =====
  pres.addSection({ title: 'What has been built' });
  s = pres.addSlide({ masterName: 'Content', sectionTitle: 'What has been built' });
  s.addText('Everything planned for version 1 is built', { placeholder: 'title' });
  const feats = [
    ['LuLockKeyhole', 'Sign-in', 'Username and password; Forgot password? by email', HEX.navy],
    ['LuSmartphone', 'First sign-in', 'Asks for a mobile number and an email', HEX.teal],
    ['LuCalendarDays', 'Events', 'Upcoming and past, filter by kadr', HEX.navy],
    ['LuShapes', 'Event types', 'Four types, each with its own rules', HEX.gold],
    ['LuListChecks', 'Tasks', 'Assign, set due dates, track progress', HEX.green],
    ['LuUpload', 'Materials', 'PDF, Word or photo, reviewed, then saved to Google Drive', HEX.red],
    ['LuClipboardCheck', 'Attendance', 'Present, Absent or Excused per member', HEX.green],
    ['LuUsers', 'Members', 'Attendance %, scout badges, account management', HEX.teal],
    ['LuMail', 'Emails', 'New events, tasks and file reviews, in Arabic and English', HEX.gold],
    ['LuUserRound', 'Profile', 'Mobile, email, badges, attendance, password, language', HEX.navy],
  ];
  feats.forEach(([icn, t, d, c], i) => {
    const col = i % 5, row = Math.floor(i / 5);
    const x = 0.6 + col * 2.46, y = 1.45 + row * 2.6;
    card(s, x, y, 2.26, 2.35, `feature ${t}`);
    badge(s, icn, x + 0.25, y + 0.25, 0.7, c);
    s.addText(t, { x: x + 0.25, y: y + 1.07, w: 1.9, h: 0.4, fontSize: 17, bold: true, color: HEX.ink, isTextBox: true, margin: 0 });
    s.addText(d, { x: x + 0.25, y: y + 1.5, w: 1.85, h: 0.75, fontSize: 12, color: HEX.muted, isTextBox: true, margin: 0, valign: 'top' });
  });
  s.addNotes('Every permission is checked by the server, not only hidden in the app, so no rule can be bypassed from outside the app.');

  // ===== 4. Roles and permissions =====
  pres.addSection({ title: 'Roles and permissions' });
  s = pres.addSlide({ masterName: 'Content', sectionTitle: 'Roles and permissions' });
  s.addText('Five roles, each with clear rights', { placeholder: 'title' });
  const hd = (t) => ({ text: t, options: { bold: true, color: 'FFFFFF', fill: { color: HEX.navy } } });
  const yes = (t) => ({ text: t, options: { color: HEX.ok, bold: true } });
  const no = (t) => ({ text: t, options: { color: HEX.muted } });
  const b = (t) => ({ text: t, options: { bold: true } });
  const rows = [
    [hd('Role (count)'), hd('Events and tasks'), hd('Preparation Meetings'), hd('Attendance'), hd('Members page')],
    [b('Group Leader (1)'), 'Every kadr and Gawala Sessions', yes('Any kadr'), no('View only'), 'View all'],
    [b('Group Leader Helper (2)'), 'Every kadr and Gawala Sessions', yes('Any kadr'), no('View only'), 'View all'],
    [b('Database / Attendance, privileged (2)'), 'Every kadr and Gawala Sessions', no('No'), yes('Takes it for one fixed kadr'), 'View, add, edit all'],
    [b('Database / Attendance, others (3)'), 'Own kadr', no('No'), yes('Takes it for one fixed kadr'), 'View, add, edit their kadr'],
    [b('Kadr Leader (5)'), 'Own kadr', yes('Own kadr'), no('View only'), 'View own kadr, give badges'],
    [b('Kadr Leader Helper (about 47)'), 'Own kadr', no('No'), no('View only'), no('No')],
  ];
  s.addTable(rows, { x: 0.6, y: 1.4, w: 12.1, colW: [3.0, 2.7, 2.0, 2.4, 2.0], fontSize: 13, color: HEX.ink, border: { type: 'solid', pt: 0.75, color: HEX.border }, fill: { color: 'FFFFFF' }, rowH: 0.56, valign: 'middle', margin: [0.04, 0.1, 0.04, 0.1], objectName: 'roles table' });
  s.addText([R('Only the person a task is assigned to uploads its material and changes its status; a leader reviews each file before it goes to Google Drive.', { bullet: true, breakLine: true }), R('Which kadr each Database member covers is fixed in the system, not chosen in the app.', { bullet: true })], { x: 0.6, y: 5.55, w: 12.1, h: 0.9, fontSize: 14, color: HEX.ink, paraSpaceAfter: 4, isTextBox: true, margin: 0 });

  // ===== 5. Event types =====
  s = pres.addSlide({ masterName: 'Content', sectionTitle: 'Roles and permissions' });
  s.addText('Four event types', { placeholder: 'title' });
  const types = [
    ['LuUsers', 'Kadr Session', 'One kadr', "That kadr's members", 'Tasks: yes', HEX.green],
    ['LuClipboardCheck', 'Preparation Meeting', 'One kadr', "That kadr's members", 'Tasks: no', HEX.gold],
    ['LuGlobe', 'Gawala Session', 'The whole group', 'All kadrs, grouped by kadr', 'Tasks: yes', HEX.teal],
    ['LuShapes', 'Others', 'One kadr or the whole group', 'No attendance', 'Tasks: yes', HEX.navy],
  ];
  types.forEach(([icn, t, belongs, sheet, tasks, c], i) => {
    const x = 0.6 + i * 3.1;
    card(s, x, 1.45, 2.85, 4.1, `type ${t}`);
    badge(s, icn, x + 0.3, 1.75, 0.85, c);
    s.addText(t, { x: x + 0.3, y: 2.8, w: 2.4, h: 0.5, fontSize: 19, bold: true, color: HEX.ink, isTextBox: true, margin: 0 });
    s.addText([R('Belongs to', { fontSize: 11, color: HEX.muted, breakLine: true }), R(belongs, { fontSize: 14, bold: true, breakLine: true }), R(' ', { fontSize: 6, breakLine: true }), R('Attendance sheet', { fontSize: 11, color: HEX.muted, breakLine: true }), R(sheet, { fontSize: 14, bold: true, breakLine: true }), R(' ', { fontSize: 6, breakLine: true }), R(tasks, { fontSize: 14, color: c, bold: true })], { x: x + 0.3, y: 3.4, w: 2.4, h: 2.0, color: HEX.ink, valign: 'top', isTextBox: true, margin: 0 });
  });
  s.addText('A Kadr Session or Preparation Meeting is taken by the Database member of that kadr; a Gawala Session only by the one assigned to Gawala, and for Gawala members it also counts as their Kadr Session.', { x: 0.6, y: 5.85, w: 12.1, h: 0.6, fontSize: 14, color: HEX.ink, isTextBox: true, margin: 0 });

  // ===== 6. Getting started =====
  pres.addSection({ title: 'User guide' });
  s = pres.addSlide({ masterName: 'Content', sectionTitle: 'User guide' });
  s.addText('Getting started (everyone)', { placeholder: 'title' });
  steps(s, [
    'Open the app on your phone and sign in with the username and password from the Database team.',
    'On first sign-in, enter your Egyptian mobile number: 11 digits starting with 010, 011, 012 or 015, your email and your own password, then the code emailed to you.',
    'Prefer Arabic? Tap العربية on the sign-in screen or in your Profile.',
    'Add it to your home screen to open it like an app.',
    'Forgot your password? Tap Forgot your password? on the sign-in screen; a link arrives by email.',
  ], 0.6, 1.5, 8.4, HEX.navy, 0.82);
  phone(s, 'onboard.png', 10.0, 1.3, 5.05, 'First sign-in screen');

  // ===== 7. Doing your tasks =====
  s = pres.addSlide({ masterName: 'Content', sectionTitle: 'User guide' });
  s.addText('Doing your tasks (everyone)', { placeholder: 'title' });
  steps(s, [
    'Open My tasks, or Home, to see what is assigned to you.',
    'Tap To do, In progress or Done to update a task as you work.',
    'When the material is ready, tap Upload material and pick a PDF, Word file or photo.',
    "It waits for a leader's review, then goes to the group's Google Drive, in the kadr and event folder.",
    'Sent back? Read the note and upload a new version. Only the uploader can remove a file.',
  ], 0.6, 1.55, 8.4, HEX.green, 0.95);
  phone(s, 'home.png', 10.0, 1.3, 5.05, 'Home screen');

  // ===== 8. Scouts Leader and Helpers =====
  s = pres.addSlide({ masterName: 'Content', sectionTitle: 'User guide' });
  s.addText('Group Leader and Group Leader Helpers', { placeholder: 'title' });
  const sl = [
    ['LuCalendarDays', 'Create events', 'Events → + New event: title, type, kadr, dates (today or later), place.'],
    ['LuListChecks', 'Add tasks', "Open the event → Add task: a member of the event's kadr, optional due date."],
    ['LuPencil', 'Edit or delete', 'Pencil and bin buttons; uploaded files stay in Google Drive.'],
    ['LuFileCheck2', 'Review files', 'My tasks → To review: open, then Approve (to Google Drive) or Send back with a note.'],
    ['LuEye', 'See attendance', 'Tap View on the Attendance card; you cannot take or change it.'],
    ['LuUsers', 'Members and badges', 'Attendance % per member; tap one to see or give badges.'],
  ];
  sl.forEach(([icn, t, d], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.6 + col * 6.15, y = 1.45 + row * 1.7;
    card(s, x, y, 5.95, 1.5, `leader ${t}`);
    badge(s, icn, x + 0.3, y + 0.35, 0.8, HEX.navy);
    s.addText(t, { x: x + 1.35, y: y + 0.22, w: 4.4, h: 0.45, fontSize: 17, bold: true, color: HEX.ink, isTextBox: true, margin: 0 });
    s.addText(d, { x: x + 1.35, y: y + 0.68, w: 4.4, h: 0.7, fontSize: 14, color: HEX.muted, isTextBox: true, margin: 0, valign: 'top' });
  });

  // ===== 9. Team Leader vs Helper =====
  s = pres.addSlide({ masterName: 'Content', sectionTitle: 'User guide' });
  s.addText('Kadr Leader and Kadr Leader Helper', { placeholder: 'title' });
  const cols = [
    ['LuFlag', 'Kadr Leader', HEX.gold, ['Create your kadr’s Kadr Sessions, Preparation Meetings and Others events', 'Add tasks and assign them to members of your kadr', 'Edit or delete your kadr’s events and tasks, including Preparation Meetings', 'See your kadr’s attendance and members; give them badges', 'Review files sent for your kadr’s tasks (Gawala: whole-group events too)']],
    ['LuHandHelping', 'Kadr Leader Helper', HEX.green, ['Create, edit and delete your kadr’s Kadr Sessions and Others events', 'Add tasks and assign them to members of your kadr', 'See Preparation Meetings, but not create, edit or delete them', 'See your kadr’s attendance (view only)']],
  ];
  cols.forEach(([icn, t, c, items], i) => {
    const x = 0.6 + i * 6.15;
    card(s, x, 1.45, 5.95, 4.95, `role ${t}`);
    badge(s, icn, x + 0.35, 1.75, 0.85, c);
    s.addText(t, { x: x + 1.4, y: 1.85, w: 4.3, h: 0.65, fontSize: 22, bold: true, color: HEX.ink, isTextBox: true, margin: 0, valign: 'middle' });
    s.addText(items.map((it, j) => R(it, { bullet: true, breakLine: j < items.length - 1 })), { x: x + 0.4, y: 2.95, w: 5.2, h: 3.2, fontSize: 16, color: HEX.ink, paraSpaceAfter: 10, valign: 'top', isTextBox: true, margin: 0 });
  });

  // ===== 10. Database: taking attendance =====
  s = pres.addSlide({ masterName: 'Content', sectionTitle: 'User guide' });
  s.addText('Database / Attendance team: taking attendance', { placeholder: 'title' });
  s.addText('Each of the five members covers one fixed kadr; your kadr is shown on your Profile.', { x: 0.6, y: 1.3, w: 9.0, h: 0.45, fontSize: 15, color: HEX.muted, isTextBox: true, margin: 0 });
  steps(s, [
    'Open Events and tap a Kadr Session or Preparation Meeting of your kadr (Gawala member: also Gawala Sessions).',
    'On the Attendance card, tap Take attendance.',
    'Tap P (Present), A (Absent) or E (Excused); Mark the rest present fills the others.',
    'Tap Save attendance; anyone left unmarked is saved as absent.',
    'To correct it later, tap Edit on the Attendance card.',
  ], 0.6, 2.0, 8.6, HEX.red, 0.88);
  phone(s, 'b-sheet.png', 10.0, 1.3, 5.05, 'Attendance sheet');

  // ===== 11. Database: managing members =====
  s = pres.addSlide({ masterName: 'Content', sectionTitle: 'User guide' });
  s.addText('Database / Attendance team: managing members', { placeholder: 'title' });
  const mm = [
    ['LuUserPlus', 'Add a member', 'Members → Add member: name, username, role, kadr. Password optional (scouts123); they choose their own on first sign-in.'],
    ['LuKeyRound', 'Reset a password', 'Tap the member → Edit → new password → Save changes.'],
    ['LuBan', 'Deactivate a member', 'Tap the member → Edit → untick Active. Their past records stay.'],
  ];
  mm.forEach(([icn, t, d], i) => {
    const y = 1.45 + i * 1.35;
    card(s, 0.6, y, 8.6, 1.2, `members ${t}`);
    badge(s, icn, 0.85, y + 0.22, 0.75, HEX.teal);
    s.addText(t, { x: 1.85, y: y + 0.15, w: 7.1, h: 0.42, fontSize: 17, bold: true, color: HEX.ink, isTextBox: true, margin: 0 });
    s.addText(d, { x: 1.85, y: y + 0.57, w: 7.1, h: 0.55, fontSize: 14, color: HEX.muted, isTextBox: true, margin: 0, valign: 'top' });
  });
  s.addText([R('Who manages whom: ', { bold: true }), R('the 2 privileged members manage everyone; the other 3 manage only their assigned kadr, as Kadr Leaders or Kadr Leader Helpers.')], { x: 0.6, y: 5.6, w: 8.6, h: 0.8, fontSize: 14, color: HEX.ink, isTextBox: true, margin: 0, valign: 'top' });
  phone(s, 'm2-detail.png', 10.0, 1.3, 5.05, 'Member details');

  // ===== 12. Running the system =====
  pres.addSection({ title: 'Running the system' });
  s = pres.addSlide({ masterName: 'Content', sectionTitle: 'Running the system' });
  s.addText('How it runs', { placeholder: 'title' });
  const tech = [
    ['LuDatabase', 'Database', 'MongoDB Atlas, free cluster', 'Connected', HEX.ok],
    ['LuServer', 'Server and API', 'Node.js and Express', 'Not online yet', HEX.wait],
    ['LuLayoutDashboard', 'Website', 'React, served by the same server', 'Built', HEX.ok],
    ['LuFolderOpen', 'Materials', 'Google Drive through a Google Cloud OAuth client', 'Uploading', HEX.ok],
  ];
  tech.forEach(([icn, t, d, st, c], i) => {
    const x = 0.6 + i * 3.1;
    card(s, x, 1.45, 2.85, 2.6, `tech ${t}`);
    badge(s, icn, x + 0.3, 1.7, 0.75, HEX.navy);
    s.addText(t, { x: x + 0.3, y: 2.55, w: 2.4, h: 0.42, fontSize: 17, bold: true, color: HEX.ink, isTextBox: true, margin: 0 });
    s.addText(d, { x: x + 0.3, y: 2.97, w: 2.4, h: 0.6, fontSize: 12, color: HEX.muted, isTextBox: true, margin: 0, valign: 'top' });
    s.addText(st, { x: x + 0.3, y: 3.6, w: 2.4, h: 0.32, fontSize: 13, bold: true, color: c, isTextBox: true, margin: 0 });
  });
  const notes = [
    ['LuFileCode', 'Attendance assignments are set by username in attendanceAssignments.js; change them there and restart.'],
    ['LuHardDrive', 'Google Drive keeps working while the Google app stays published and its token is in use.'],
    ['LuShieldCheck', 'Security reviewed (SECURITY.md); secrets stay in server/.env; serve over HTTPS and follow the security checklist.'],
    ['LuDatabaseBackup', 'The server backs up the database monthly to a private Google Drive folder; npm run restore puts it back.'],
  ];
  notes.forEach(([icn, t], i) => {
    const y = 4.25 + i * 0.64;
    badge(s, icn, 0.6, y, 0.55, HEX.teal);
    s.addText(t, { x: 1.35, y, w: 11.3, h: 0.55, fontSize: 15, color: HEX.ink, valign: 'middle', isTextBox: true, margin: 0 });
  });

  // ===== 13. Next steps =====
  s = pres.addSlide({ masterName: 'Content', sectionTitle: 'Running the system' });
  s.addText('Five steps to go live', { placeholder: 'title' });
  const next = [
    ['Set the real attendance assignments', 'Done: the 5 real usernames are set'],
    ['Clean out the demo data', 'Remove demo accounts and events'],
    ['Create the 60 accounts', 'Setup makes the first two; the rest from the Members page'],
    ['Put the app online', 'Over HTTPS, reachable from anywhere'],
    ['Pilot, then launch', 'One kadr for a week, then everyone'],
  ];
  s.addShape(pres.shapes.LINE, { x: 1.1, y: 2.35, w: 11.1, h: 0, line: { color: HEX.border, width: 3 }, objectName: 'timeline line' });
  next.forEach(([t, d], i) => {
    const x = 0.6 + i * 2.46;
    s.addShape(pres.shapes.OVAL, { x: x + 0.63, y: 1.85, w: 1.0, h: 1.0, fill: { color: HEX.navy }, line: { color: 'FFFFFF', width: 3 }, objectName: `step ${i + 1}` });
    s.addText(String(i + 1), { x: x + 0.63, y: 1.85, w: 1.0, h: 1.0, fontSize: 28, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle', isTextBox: true, margin: 0 });
    card(s, x, 3.15, 2.26, 2.2, `next ${t}`);
    s.addText(t, { x: x + 0.2, y: 3.35, w: 1.86, h: 0.95, fontSize: 16, bold: true, color: HEX.ink, isTextBox: true, margin: 0, valign: 'top' });
    s.addText(d, { x: x + 0.2, y: 4.3, w: 1.86, h: 0.9, fontSize: 13, color: HEX.muted, isTextBox: true, margin: 0, valign: 'top' });
  });
  s.addText('Planned next: KPIs for members and kadrs, once the access rules for them are decided.', { x: 0.6, y: 5.75, w: 12.1, h: 0.5, fontSize: 15, italic: true, color: HEX.muted, isTextBox: true, margin: 0 });

  // ===== 14. Closing =====
  s = pres.addSlide({ masterName: 'Closing Dark', sectionTitle: 'Running the system' });
  s.addText('Light of the World', { placeholder: 'title' });
  s.addShape(pres.shapes.OVAL, { x: 5.57, y: 1.65, w: 2.2, h: 2.2, fill: { color: 'FFFFFF' }, line: { color: HEX.khaki, width: 3 }, objectName: 'logo ring' });
  s.addImage({ path: path.join(IMG, 'logo.jpg'), x: 5.67, y: 1.75, w: 2.0, h: 2.0, rounding: true, altText: 'Scout logo', objectName: 'logo' });
  s.addText('فَلْيُضِئْ نُورُكُمْ هَكَذَا قُدَّامَ النَّاسِ، لِكَيْ يَرَوْا أَعْمَالَكُمُ الْحَسَنَةَ، وَيُمَجِّدُوا أَبَاكُمُ الَّذِي فِي السَّمَاوَاتِ.', { x: 1.2, y: 4.15, w: 10.9, h: 1.3, fontSize: 24, fontFace: 'Arial', color: 'FFFFFF', align: 'center', valign: 'middle', rtlMode: true, lang: 'ar-EG', isTextBox: true, margin: 0 });
  s.addText('إنجيل متى 5: 16', { x: 1.2, y: 5.5, w: 10.9, h: 0.5, fontSize: 18, fontFace: 'Arial', color: HEX.yellow, align: 'center', rtlMode: true, lang: 'ar-EG', isTextBox: true, margin: 0 });
  s.addText('St. Mary Church  ·  Garden City Scouts', { x: 1.2, y: 6.5, w: 10.9, h: 0.4, fontSize: 14, color: 'FFFFFF', transparency: 25, align: 'center', isTextBox: true, margin: 0 });

  await pres.writeFile({ fileName: OUT });
  if (applyTheme) await applyTheme(OUT, THEME);
  console.log('written', OUT);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
