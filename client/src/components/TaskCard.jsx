import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, ExternalLink, FileText, Image, Pencil, Trash2, Upload, X } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { ACCEPTED_FILES, STATUSES } from '../constants.js';
import { daysUntil, fileSize, relativeDay } from '../format.js';
import { Avatar, ConfirmDialog, TeamChip, useToast } from './ui.jsx';

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
export default function TaskCard({ task, onChange, onEdit, onDelete, showEvent }) {
  const { user } = useAuth();
  const toast = useToast();
  const fileInput = useRef(null);
  const [progress, setProgress] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const mine = task.assignee?._id === user._id;
  const manager = canManage(user, task.team);
  const overdue = task.dueDate && task.status !== 'done' && daysUntil(task.dueDate) < 0;

  const setStatus = async (status) => {
    if (status === task.status) return;
    try {
      const res = await api.put(`/tasks/${task._id}`, { status });
      onChange(res.task);
      if (status === 'done') toast('Task marked as done. Well done!');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setProgress(0);
    try {
      const res = await api.upload(`/tasks/${task._id}/materials`, file, setProgress);
      onChange(res.task);
      toast('Material uploaded');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setProgress(null);
    }
  };

  const removeMaterial = async (m) => {
    const res = await api.del(`/tasks/${task._id}/materials/${m._id}`);
    onChange(res.task);
    toast('File removed');
  };

  return (
    <article className={`task-card ${task.status === 'done' ? 'is-done' : ''}`}>
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
        {manager && (onEdit || onDelete) && (
          <div className="task-actions">
            {onEdit && (
              <button className="icon-btn" onClick={() => onEdit(task)} aria-label="Edit task">
                <Pencil size={17} />
              </button>
            )}
            {onDelete && (
              <button
                className="icon-btn"
                aria-label="Delete task"
                onClick={() =>
                  setConfirm({
                    title: 'Delete this task?',
                    text: `"${task.title}" will be removed. Files already uploaded stay in Google Drive.`,
                    run: async () => {
                      await api.del(`/tasks/${task._id}`);
                      onDelete(task);
                      toast('Task deleted');
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
        {!showEvent && (
          <span className="meta-item">
            <Avatar person={task.assignee} size={22} />
            {mine ? 'You' : task.assignee?.name}
          </span>
        )}
        {task.dueDate && (
          <span className={`meta-item ${overdue ? 'overdue' : ''}`}>
            <CalendarDays size={15} />
            {overdue ? `Overdue · ${relativeDay(task.dueDate)}` : `Due ${dueLabel(task.dueDate)}`}
          </span>
        )}
        {!mine && <span className={`status-pill status-${task.status}`}>{STATUSES.find((s) => s.id === task.status)?.label}</span>}
      </div>

      {mine && (
        <div className="segmented" role="group" aria-label="Task status">
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
            <div key={m._id} className="material">
              <span className="material-icon">{m.mimeType.startsWith('image/') ? <Image size={18} /> : <FileText size={18} />}</span>
              <a href={m.url} target="_blank" rel="noreferrer" className="material-name">
                {m.fileName}
                <ExternalLink size={13} />
              </a>
              <span className="material-size">{fileSize(m.size)}</span>
              {(mine || manager) && (
                <button
                  className="icon-btn icon-btn-sm"
                  aria-label={`Remove ${m.fileName}`}
                  onClick={() =>
                    setConfirm({
                      title: 'Remove this file?',
                      text: `"${m.fileName}" will be deleted from the task and from Google Drive.`,
                      confirmLabel: 'Remove',
                      run: () => removeMaterial(m),
                    })
                  }
                >
                  <X size={15} />
                </button>
              )}
            </div>
          ))}

          {mine && (
            <>
              <input ref={fileInput} type="file" accept={ACCEPTED_FILES} hidden onChange={upload} />
              {progress === null ? (
                <button className="upload-btn" onClick={() => fileInput.current.click()}>
                  <Upload size={18} />
                  Upload material
                  <small>PDF, Word or image</small>
                </button>
              ) : (
                <div className="upload-progress">
                  <div className="bar">
                    <div style={{ width: `${progress}%` }} />
                  </div>
                  <span>{progress < 100 ? `Uploading… ${progress}%` : 'Saving to Google Drive…'}</span>
                </div>
              )}
            </>
          )}
        </div>
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
