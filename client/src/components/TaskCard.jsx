import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Check, ExternalLink, FileText, Hourglass, Image, MessageSquareWarning, Pencil, Trash2, Undo2, Upload, X } from 'lucide-react';
import { api, openProtectedFile } from '../api.js';
import { useAuth } from '../auth.jsx';
import { t as tr } from '../i18n.jsx';
import { ACCEPTED_FILES, STATUSES, TEAM_BY_ID } from '../constants.js';
import { daysUntil, fileSize, relativeDay } from '../format.js';
import { Avatar, ConfirmDialog, ErrorBox, Modal, TeamChip, useToast } from './ui.jsx';

/** "today", "tomorrow", "in 3 days", or a date — reads naturally after "Due". */
function dueLabel(date) {
  const label = relativeDay(date);
  return Math.abs(daysUntil(date)) < 7 ? label.charAt(0).toLowerCase() + label.slice(1) : label;
}

function canManage(user, team) {
  // team null = a whole-group event, managed by group-wide leaders only.
  return user.permissions.allTeams || (Boolean(team) && user.team === team);
}

/**
 * One task. Shows the assignee's controls (status, upload) to the assignee,
 * and edit/delete to people who manage the team.
 */
export default function TaskCard({ task, onChange, onEdit, onDelete, showEvent, showAssignee }) {
  const { user } = useAuth();
  const toast = useToast();
  const fileInput = useRef(null);
  const [progress, setProgress] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [sendBack, setSendBack] = useState(null);

  const mine = task.assignee?._id === user._id;
  const manager = canManage(user, task.team);
  const overdue = task.dueDate && task.status !== 'done' && daysUntil(task.dueDate) < 0;

  const setStatus = async (status) => {
    if (status === task.status) return;
    try {
      const res = await api.put(`/tasks/${task._id}`, { status });
      onChange(res.task);
      if (status === 'done') toast(tr('Task marked as done. Well done!'));
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    // Checked before uploading, so a big file is refused at once instead of after the whole upload.
    const maxMb = user.maxUploadMb || 25;
    if (file.size > maxMb * 1024 * 1024) return toast(`Files must be smaller than ${maxMb} MB`, 'error');
    setProgress(0);
    try {
      const res = await api.upload(`/tasks/${task._id}/materials`, file, setProgress);
      onChange(res.task);
      const added = res.task.materials?.[res.task.materials.length - 1];
      toast(added?.reviewStatus === 'pending' ? tr('Material uploaded. It goes to Google Drive after it is reviewed.') : tr('Material uploaded'));
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setProgress(null);
    }
  };

  const removeMaterial = async (m) => {
    const res = await api.del(`/tasks/${task._id}/materials/${m._id}`);
    onChange(res.task);
    toast(tr('File removed'));
  };

  const approve = async (m) => {
    try {
      const res = await api.post(`/tasks/${task._id}/materials/${m._id}/approve`);
      onChange(res.task);
      toast(tr('Approved and saved to Google Drive'));
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const open = (m) => openProtectedFile(`/tasks/${task._id}/materials/${m._id}/file`).catch((err) => toast(err.message, 'error'));

  const askRemove = (m) =>
    setConfirm({
      title: tr('Remove this file?'),
      text:
        m.reviewStatus === 'approved'
          ? tr('"{name}" will be deleted from the task and from Google Drive.', { name: m.fileName })
          : tr('"{name}" will be removed from the task.', { name: m.fileName }),
      confirmLabel: tr('Remove'),
      run: () => removeMaterial(m),
    });

  return (
    <article className={`task-card ${task.status === 'done' ? 'is-done' : ''}`} style={{ '--team': TEAM_BY_ID[task.team]?.color }}>
      <div className="task-top">
        <div className="task-main">
          {showEvent && task.event && (
            <Link to={`/events/${task.event._id}`} className="task-event">
              <TeamChip team={task.team} size="sm" />
              <span>{task.event.title}</span>
            </Link>
          )}
          <h3 className="task-title">{task.title}</h3>
          {task.description && <p className="task-desc">{task.description}</p>}
        </div>
        {/* A rubber stamp on finished tasks */}
        {task.status === 'done' && <span className="done-stamp">{tr('Done')}</span>}
        {manager && (onEdit || onDelete) && (
          <div className="task-actions">
            {onEdit && (
              <button className="icon-btn" onClick={() => onEdit(task)} aria-label={tr('Edit task')}>
                <Pencil size={17} />
              </button>
            )}
            {onDelete && (
              <button
                className="icon-btn"
                aria-label={tr('Delete task')}
                onClick={() =>
                  setConfirm({
                    title: tr('Delete this task?'),
                    text: tr('"{title}" will be removed. Files already uploaded stay in Google Drive.', { title: task.title }),
                    run: async () => {
                      await api.del(`/tasks/${task._id}`);
                      onDelete(task);
                      toast(tr('Task deleted'));
                    },
                  })
                }
              >
                <Trash2 size={17} />
              </button>
            )}
          </div>
        )}
      </div>

      <div className="task-meta">
        {(!showEvent || showAssignee) && (
          <span className="meta-item">
            <Avatar person={task.assignee} size={22} />
            {mine ? tr('You') : task.assignee?.name}
          </span>
        )}
        {task.dueDate && (
          <span className={`meta-item ${overdue ? 'overdue' : ''}`}>
            <CalendarDays size={15} />
            {overdue ? tr('Overdue · {when}', { when: relativeDay(task.dueDate) }) : tr('Due {when}', { when: dueLabel(task.dueDate) })}
          </span>
        )}
        {/* finished tasks show the stamp instead */}
        {!mine && task.status !== 'done' && <span className={`status-pill status-${task.status}`}>{STATUSES.find((s) => s.id === task.status)?.label}</span>}
      </div>

      {mine && (
        <div className="segmented" role="group" aria-label={tr('Task status')}>
          {STATUSES.map((s) => (
            <button key={s.id} className={`seg ${task.status === s.id ? `active seg-${s.id}` : ''}`} onClick={() => setStatus(s.id)}>
              {s.label}
            </button>
          ))}
        </div>
      )}

      {(task.materials?.length > 0 || mine) && (
        <div className="materials">
          {task.materials?.map((m) => (
            <MaterialItem
              key={m._id}
              m={m}
              canRemove={m.uploadedBy?._id === user._id}
              canReview={task.canReview}
              onOpen={() => open(m)}
              onRemove={() => askRemove(m)}
              onApprove={() => approve(m)}
              onSendBack={() => setSendBack(m)}
            />
          ))}

          {mine && (
            <>
              <input ref={fileInput} type="file" accept={ACCEPTED_FILES} hidden onChange={upload} />
              {progress === null ? (
                <button className="upload-btn" onClick={() => fileInput.current.click()}>
                  <Upload size={18} />
                  {tr('Upload material')}
                  <small>{tr('PDF, Word or image')}</small>
                </button>
              ) : (
                <div className="upload-progress">
                  <div className="bar">
                    <div style={{ width: `${progress}%` }} />
                  </div>
                  <span>{progress < 100 ? tr('Uploading… {p}%', { p: progress }) : task.canReview ? tr('Saving to Google Drive…') : tr('Sending for review…')}</span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {sendBack && (
        <SendBackDialog
          material={sendBack}
          onClose={() => setSendBack(null)}
          onSend={async (note) => {
            const res = await api.post(`/tasks/${task._id}/materials/${sendBack._id}/send-back`, { note });
            onChange(res.task);
            toast(tr('Sent back to {name}', { name: sendBack.uploadedBy?.name || '' }));
          }}
        />
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          text={confirm.text}
          confirmLabel={confirm.confirmLabel}
          onConfirm={confirm.run}
          onClose={() => setConfirm(null)}
        />
      )}
    </article>
  );
}

/**
 * One uploaded file. Approved files open from Google Drive. Files waiting for review are private:
 * their uploader and the reviewers open them through the app, and reviewers approve or send them back.
 */
function MaterialItem({ m, canRemove, canReview, onOpen, onRemove, onApprove, onSendBack }) {
  const [busy, setBusy] = useState(false);
  const status = m.reviewStatus || 'approved';
  const icon = m.mimeType.startsWith('image/') ? <Image size={18} /> : <FileText size={18} />;
  const reviewer = m.reviewedBy?.name;
  const reviewedByOther = reviewer && m.reviewedBy?._id !== m.uploadedBy?._id;

  return (
    <div className={`material-item material-${status}`}>
      <div className="material">
        <span className="material-icon">{icon}</span>
        {status === 'approved' ? (
          <a href={m.url} target="_blank" rel="noreferrer" className="material-name">
            {m.fileName}
            <ExternalLink size={13} />
          </a>
        ) : m.canOpen ? (
          <button type="button" className="material-name material-open" onClick={onOpen}>
            {m.fileName}
            <ExternalLink size={13} />
          </button>
        ) : (
          <span className="material-name">{m.fileName}</span>
        )}
        <span className="material-size">{fileSize(m.size)}</span>
        {canRemove && (
          <button className="icon-btn icon-btn-sm" aria-label={tr('Remove {name}', { name: m.fileName })} onClick={onRemove}>
            <X size={15} />
          </button>
        )}
      </div>

      {status === 'approved' && reviewedByOther && (
        <p className="review-line">
          <Check size={14} /> {tr('Approved by {name}', { name: reviewer })}
        </p>
      )}

      {status === 'pending' && (
        <div className="review-bar">
          <span className="review-tag">
            <Hourglass size={14} /> {tr('Waiting for review')}
          </span>
          {canReview && (
            <div className="review-actions">
              <button className="btn btn-sm btn-ghost" onClick={onSendBack} disabled={busy}>
                <Undo2 size={15} />
                {tr('Send back')}
              </button>
              <button
                className="btn btn-sm btn-primary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await onApprove();
                  setBusy(false);
                }}
              >
                <Check size={15} />
                {busy ? tr('Please wait…') : tr('Approve')}
              </button>
            </div>
          )}
        </div>
      )}

      {status === 'changes' && (
        <div className="review-note">
          <span className="review-tag review-tag-back">
            <MessageSquareWarning size={14} /> {tr('Sent back')}
            {reviewer && <span className="review-by"> · {reviewer}</span>}
          </span>
          <p>{m.reviewNote}</p>
        </div>
      )}
    </div>
  );
}

function SendBackDialog({ material, onSend, onClose }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const send = async () => {
    if (!note.trim()) return setError(tr('Write what should be changed'));
    setBusy(true);
    setError('');
    try {
      await onSend(note.trim());
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <Modal
      title={tr('Send this file back?')}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
            {tr('Cancel')}
          </button>
          <button className="btn btn-primary" onClick={send} disabled={busy}>
            {busy ? tr('Please wait…') : tr('Send back')}
          </button>
        </>
      }
    >
      <p className="muted">
        {tr('Tell {name} what to change in "{file}". The file is deleted, and they can upload a new version.', {
          name: material.uploadedBy?.name || '',
          file: material.fileName,
        })}
      </p>
      <div className="field">
        <textarea rows={4} maxLength={500} value={note} autoFocus onChange={(e) => setNote(e.target.value)} placeholder={tr('What should be changed?')} />
      </div>
      {error && <ErrorBox message={error} />}
    </Modal>
  );
}
