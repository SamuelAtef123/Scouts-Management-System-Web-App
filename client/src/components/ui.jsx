import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useMemberPhoto } from '../photos.js';
import { CircleAlert, CircleCheck, LoaderCircle, X } from 'lucide-react';
import { TEAM_BY_ID, STATUS_LABEL, VERSE, eventType } from '../constants.js';
import { t as tr } from '../i18n.jsx';
import { initials } from '../format.js';

export function Spinner({ label = tr('Loading…') }) {
  return (
    <div className="spinner" role="status">
      <LoaderCircle className="spin" size={22} />
      <span>{label}</span>
    </div>
  );
}

export function ErrorBox({ message, onRetry }) {
  return (
    <div className="error-box">
      <CircleAlert size={20} />
      <span>{message}</span>
      {onRetry && (
        <button className="btn btn-ghost btn-sm" onClick={onRetry}>
          {tr('Try again')}
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, action }) {
  return (
    <div className="empty">
      {Icon && (
        <div className="empty-icon">
          <Icon size={26} />
        </div>
      )}
      <p className="empty-title">{title}</p>
      {text && <p className="empty-text">{text}</p>}
      {action}
    </div>
  );
}

export function TeamChip({ team, size }) {
  const t = TEAM_BY_ID[team];
  if (!t) {
    return (
      <span className={`team-chip team-chip-group ${size === 'sm' ? 'team-chip-sm' : ''}`} lang="ar" dir="rtl">
        <span className="team-dot group-dot" />
        المجموعة كلها
      </span>
    );
  }
  return (
    // Team names are always shown in Arabic, as the group uses them.
    <span
      className={`team-chip ${size === 'sm' ? 'team-chip-sm' : ''}`}
      style={{ '--team': t.color, '--team-soft': t.soft }}
      lang="ar"
      dir="rtl"
      title={t.id}
    >
      <span className="team-dot" />
      {t.arabic}
    </span>
  );
}

export function TypeBadge({ event }) {
  const t = eventType(event);
  return <span className={`type-badge type-${t.id}`}>{t.label}</span>;
}

export function StatusPill({ status }) {
  return <span className={`status-pill status-${status}`}>{STATUS_LABEL[status]}</span>;
}

/**
 * A member's photo, or their initials on their team colour when they have none.
 * Pass `person` (any member object with _id, name, team, photoUpdatedAt), or `name` + `team`.
 */
export function Avatar({ person, name = person?.name, team = person?.team, size = 40 }) {
  const color = TEAM_BY_ID[team]?.color || 'var(--navy)';
  const photo = useMemberPhoto(person?._id, person?.photoUpdatedAt);
  const style = { width: size, height: size, fontSize: size * 0.38, background: color };
  if (photo) {
    return <img className="avatar avatar-photo" src={photo} alt="" style={style} aria-hidden="true" />;
  }
  return (
    <span className="avatar" style={style} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

/** Dialog: a bottom sheet on phones, a centred card on larger screens. */
export function Modal({ title, onClose, children, footer }) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    ref.current?.querySelector('input, textarea, select')?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('no-scroll');
    };
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={tr('Close')}>
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, text, confirmLabel = tr('Delete'), onConfirm, onClose }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async () => {
    setBusy(true);
    setError('');
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
            {tr('Cancel')}
          </button>
          <button className="btn btn-danger" onClick={run} disabled={busy}>
            {busy ? tr('Please wait…') : confirmLabel}
          </button>
        </>
      }
    >
      <p className="muted">{text}</p>
      {error && <ErrorBox message={error} />}
    </Modal>
  );
}

export function VerseCard({ compact }) {
  return (
    <figure className={`verse-card ${compact ? 'verse-compact' : ''}`}>
      <div className="stripe" />
      <blockquote lang="ar" dir="rtl">
        {VERSE.text}
      </blockquote>
      <figcaption lang="ar" dir="rtl">
        {VERSE.ref}
      </figcaption>
    </figure>
  );
}

// ---------- Toasts ----------
const ToastContext = createContext(() => {});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const show = useCallback((message, type = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            {t.type === 'error' ? <CircleAlert size={18} /> : <CircleCheck size={18} />}
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
