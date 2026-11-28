import { config } from '../config.js';
import { User } from '../models/User.js';
import { ATTENDANCE_ASSIGNMENTS } from '../attendanceAssignments.js';
import { ATTENDANCE_EVENT_TYPES } from '../constants.js';
import { explain, sendEmail, sendToMany } from './mailer.js';

/*
 * The automatic emails. Each one is short, in Arabic and English, and links to the app.
 * They are sent in the background: saving an event or task never waits for them, and a failed
 * email is only logged.
 */

const KADR_AR = { Ashbal: 'أشبال', Zahrat: 'زهرات', Kashafeen: 'كشافين', Morshedat: 'مرشدات', Gawala: 'جوالة' };
const TYPE = {
  team_session: ['Kadr Session', 'جلسة كدر'],
  preparation_meeting: ['Preparation Meeting', 'اجتماع تحضيري'],
  gawala_session: ['Gawala Session', 'جلسة الجوالة'],
  other: ['Others', 'أخرى'],
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
// Names, titles, file names and notes keep their own direction inside a sentence in the other
// language (an English title inside an Arabic sentence), like the app's <bdi>: Unicode isolates.
const iso = (s) => `\u2068${esc(s)}\u2069`;
const when = (date, locale) =>
  date
    ? new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: process.env.TZ || 'Africa/Cairo' }).format(new Date(date))
    : '';
const firstName = (name) => String(name || '').trim().split(/\s+/)[0];
const link = (path) => `${config.email.appUrl}${path}`;

/** One email: an Arabic block (right to left) above an English block, then a button. */
function layout({ ar, en, button }) {
  const block = (lines, dir) =>
    `<div dir="${dir}" style="text-align:${dir === 'rtl' ? 'right' : 'left'};font-size:15px;line-height:1.6;color:#1a1f36">${lines.map((l) => `<p style="margin:0 0 8px">${l}</p>`).join('')}</div>`;
  const html = `<!doctype html><html><body style="margin:0;background:#f8f9fc;padding:24px;font-family:Arial,Helvetica,sans-serif">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e1e4ef;border-radius:10px;overflow:hidden">
<div style="background:#1f2a5e;color:#ffffff;padding:14px 20px;font-weight:bold">Light of the World · نور العالم</div>
<div style="padding:20px">${block(ar, 'rtl')}<hr style="border:none;border-top:1px dashed #cfc6ea;margin:16px 0">${block(en, 'ltr')}
<p style="text-align:center;margin:22px 0 4px"><a href="${esc(button.href)}" style="display:inline-block;background:#6d3fb5;color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:8px;font-weight:bold">${esc(button.label)}</a></p>
</div></div>
<p style="text-align:center;color:#6b7190;font-size:12px;margin-top:14px">St. Mary Church, Garden City Scouts · You can turn these emails off on your Profile page in the app.</p>
</body></html>`;
  const strip = (l) => l.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  const text = [...ar.map(strip), '', ...en.map(strip), '', `${button.label}: ${button.href}`].join('\n');
  return { html, text };
}

/** People to tell about a new event: its kadr (or everyone for a whole-group event), plus the
 *  Database member who takes that kadr's attendance. Never the person who created it. */
async function eventRecipients(event, creatorId) {
  const base = { isActive: true, email: { $type: 'string' }, 'emailPrefs.events': { $ne: false }, _id: { $ne: creatorId } };
  if (!event.team) return User.find(base).select('name email');
  const recorders = ATTENDANCE_EVENT_TYPES.includes(event.type)
    ? Object.entries(ATTENDANCE_ASSIGNMENTS).filter(([, team]) => team === event.team).map(([u]) => u)
    : [];
  return User.find({ ...base, $or: [{ team: event.team }, { username: { $in: recorders } }] }).select('name email');
}

export async function notifyEventCreated(event, creator) {
  const people = await eventRecipients(event, creator._id);
  const [typeEn, typeAr] = TYPE[event.type] || TYPE.other;
  const forEn = event.team ? `${event.team} kadr` : 'the whole group';
  const forAr = event.team ? `كدر ${KADR_AR[event.team] || event.team}` : 'المجموعة كلها';
  const place = event.location ? iso(event.location) : '';
  const sent = await sendToMany(people, (p) => ({
    subject: `New event: ${event.title} · حدث جديد`,
    ...layout({
      ar: [
        `أهلًا ${iso(firstName(p.name))}،`,
        `أضاف ${iso(creator.name)} حدثًا جديدًا (${typeAr}) لـ${forAr}:`,
        `<b>${iso(event.title)}</b>`,
        `🗓️ ${iso(when(event.startDate, 'ar-EG-u-nu-latn'))}${place ? `<br>📍 ${place}` : ''}`,
      ],
      en: [
        `Hi ${iso(firstName(p.name))},`,
        `${iso(creator.name)} added a new ${typeEn} for ${forEn}:`,
        `<b>${iso(event.title)}</b>`,
        `🗓️ ${iso(when(event.startDate, 'en-GB'))}${place ? `<br>📍 ${place}` : ''}`,
      ],
      button: { label: 'Open the event · افتح الحدث', href: link(`/events/${event._id}`) },
    }),
  }));
  if (sent) console.log(`Emailed ${sent} member(s) about the new event "${event.title}"`);
}

export async function notifyTaskAssigned(task, event, assigner) {
  const p = await User.findOne({ _id: task.assignee, isActive: true, email: { $type: 'string' }, 'emailPrefs.tasks': { $ne: false } }).select('name email');
  if (!p || p._id.equals(assigner._id)) return;
  const due = task.dueDate ? new Date(task.dueDate) : null;
  const dueOpts = { weekday: 'long', day: 'numeric', month: 'long', timeZone: process.env.TZ || 'Africa/Cairo' };
  await sendEmail({
    to: p.email,
    subject: `New task for you: ${task.title} · مهمة جديدة لك`,
    ...layout({
      ar: [
        `أهلًا ${iso(firstName(p.name))}،`,
        `أسند إليك ${iso(assigner.name)} مهمة جديدة:`,
        `<b>${iso(task.title)}</b>`,
        `الحدث: ${iso(event.title)}${due ? `<br>التسليم: ${iso(new Intl.DateTimeFormat('ar-EG-u-nu-latn', dueOpts).format(due))}` : ''}`,
      ],
      en: [
        `Hi ${iso(firstName(p.name))},`,
        `${iso(assigner.name)} assigned you a new task:`,
        `<b>${iso(task.title)}</b>`,
        `Event: ${iso(event.title)}${due ? `<br>Due: ${iso(new Intl.DateTimeFormat('en-GB', dueOpts).format(due))}` : ''}`,
      ],
      button: { label: 'Open the task · افتح المهمة', href: link(`/events/${event._id}`) },
    }),
  });
}

export async function notifyFileReviewed(task, material, reviewer, approved) {
  const p = await User.findOne({ _id: material.uploadedBy, isActive: true, email: { $type: 'string' }, 'emailPrefs.reviews': { $ne: false } }).select('name email');
  if (!p || p._id.equals(reviewer._id)) return;
  const file = iso(material.fileName);
  const note = iso(material.reviewNote);
  await sendEmail({
    to: p.email,
    subject: approved ? `Your file was approved: ${material.fileName} · تم اعتماد ملفك` : `Your file was sent back: ${material.fileName} · أُعيد ملفك للتعديل`,
    ...layout({
      ar: approved
        ? [`أهلًا ${iso(firstName(p.name))}،`, `اعتمد ${iso(reviewer.name)} ملفك <b>${file}</b> لمهمة «${iso(task.title)}»، وتم حفظه في Google Drive.`]
        : [`أهلًا ${iso(firstName(p.name))}،`, `أعاد ${iso(reviewer.name)} ملفك <b>${file}</b> لمهمة «${iso(task.title)}» للتعديل:`, `«${note}»`, 'برجاء رفع نسخة جديدة.'],
      en: approved
        ? [`Hi ${iso(firstName(p.name))},`, `${iso(reviewer.name)} approved your file <b>${file}</b> for the task "${iso(task.title)}". It is now saved in Google Drive.`]
        : [`Hi ${iso(firstName(p.name))},`, `${iso(reviewer.name)} sent your file <b>${file}</b> for the task "${iso(task.title)}" back:`, `“${note}”`, 'Please upload a new version.'],
      button: { label: 'Open the task · افتح المهمة', href: link(`/events/${task.event}`) },
    }),
  });
}

export async function sendPasswordReset(user, token, minutes) {
  await sendEmail({
    to: user.email,
    subject: 'Reset your password · إعادة تعيين كلمة المرور',
    ...layout({
      ar: [`أهلًا ${iso(firstName(user.name))}،`, `طلب أحدهم إعادة تعيين كلمة المرور لحسابك (<b>${iso(user.username)}</b>).`, `الرابط صالح لمدة ${minutes} دقيقة ولمرة واحدة فقط. إن لم تطلب ذلك فتجاهل هذه الرسالة.`],
      en: [`Hi ${iso(firstName(user.name))},`, `Someone asked to reset the password of your account (<b>${iso(user.username)}</b>).`, `The link works once, for ${minutes} minutes. If it was not you, ignore this email.`],
      button: { label: 'Choose a new password · اختر كلمة مرور جديدة', href: link(`/reset-password?token=${token}`) },
    }),
  });
}

/** Runs a notification in the background: never delays or breaks the request that caused it. */
export const inBackground = (promise) => promise.catch((err) => console.error(`Email failed: ${explain(err)}`));
