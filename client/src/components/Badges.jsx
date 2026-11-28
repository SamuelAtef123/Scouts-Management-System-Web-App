import { useState } from 'react';
import { Award, Plus, X } from 'lucide-react';
import { api } from '../api.js';
import { t as tr } from '../i18n.jsx';
import { formatDay } from '../format.js';
import { ConfirmDialog, ErrorBox, Field, Modal, useToast } from './ui.jsx';

/** One badge: a shiny word with a badge icon. */
export function BadgePill({ badge, onRemove }) {
  const title = [badge.reason, badge.givenBy?.name && tr('Given by {name}', { name: badge.givenBy.name })].filter(Boolean).join(' · ');
  return (
    <span className="scout-badge" title={title}>
      <Award size={16} aria-hidden="true" />
      <bdi>{badge.title}</bdi>
      {onRemove && (
        <button type="button" className="scout-badge-x" onClick={onRemove} aria-label={tr('Remove the badge {name}', { name: badge.title })}>
          <X size={13} />
        </button>
      )}
    </span>
  );
}

/** A member's badges, newest first, with who gave each and why. */
export function BadgeList({ badges, onRemoved, empty }) {
  const toast = useToast();
  const [confirm, setConfirm] = useState(null);
  if (!badges?.length) return <p className="muted">{empty}</p>;
  return (
    <>
      <ul className="badge-list">
        {badges.map((b) => (
          <li key={b._id}>
            <BadgePill badge={b} onRemove={b.canRemove && onRemoved ? () => setConfirm(b) : null} />
            <span className="badge-meta">
              {b.reason && <span className="badge-reason">{b.reason}</span>}
              <span className="muted">
                {tr('Given by {name}', { name: b.givenBy?.name || '–' })} · {formatDay(b.givenAt)}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {confirm && (
        <ConfirmDialog
          title={tr('Remove this badge?')}
          text={tr('"{name}" will be removed from this member.', { name: confirm.title })}
          confirmLabel={tr('Remove')}
          onConfirm={async () => {
            await api.del(`/badges/${confirm._id}`);
            onRemoved(confirm);
            toast(tr('Badge removed'));
          }}
          onClose={() => setConfirm(null)}
        />
      )}
    </>
  );
}

/** Give a member a badge: a short word (with suggestions) and an optional reason. */
export function GiveBadgeDialog({ member, suggestions = [], onClose, onGiven }) {
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await api.post('/badges', { user: member._id, title, reason });
      onGiven(res.badge);
      toast(tr('Badge given to {name}', { name: member.name }));
      onClose();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <Modal
      title={tr('Give a badge')}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {tr('Cancel')}
          </button>
          <button type="submit" form="badge-form" className="btn btn-primary" disabled={busy}>
            {busy ? tr('Please wait…') : tr('Give badge')}
          </button>
        </>
      }
    >
      <form id="badge-form" className="form" onSubmit={submit}>
        <p className="muted">
          {tr('To')}: <bdi>{member.name}</bdi>
        </p>
        <Field label={tr('Badge')} hint={tr('A short word, e.g. Leadership or Teamwork')}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={30} list="badge-suggestions" autoFocus />
          <datalist id="badge-suggestions">
            {suggestions.map((s) => (
              <option key={s} value={tr(s)} />
            ))}
          </datalist>
        </Field>
        <div className="badge-suggest">
          {suggestions.map((s) => (
            <button type="button" key={s} className="chip" onClick={() => setTitle(tr(s))}>
              {tr(s)}
            </button>
          ))}
        </div>
        <Field label={tr('Reason (optional)')}>
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={120} placeholder={tr('e.g. for leading the camp setup')} />
        </Field>
        {title.trim() && (
          <p className="badge-preview">
            {tr('Preview')}: <BadgePill badge={{ title: title.trim() }} />
          </p>
        )}
        {error && <ErrorBox message={error} />}
      </form>
    </Modal>
  );
}

/** The badges section of a member's details: list, and "Give a badge" for those allowed. */
export function MemberBadges({ member, data, setData }) {
  const [giving, setGiving] = useState(false);
  if (!data) return null;
  return (
    <>
      <h3 className="detail-section">
        <Award size={17} /> {tr('Badges')}
        {data.canGive && (
          <button type="button" className="btn btn-sm btn-primary detail-section-action" onClick={() => setGiving(true)}>
            <Plus size={15} /> {tr('Give a badge')}
          </button>
        )}
      </h3>
      <BadgeList
        badges={data.badges}
        empty={tr('No badges yet.')}
        onRemoved={(b) => setData((d) => ({ ...d, badges: d.badges.filter((x) => x._id !== b._id) }))}
      />
      {giving && (
        <GiveBadgeDialog
          member={member}
          suggestions={data.suggestions}
          onClose={() => setGiving(false)}
          onGiven={(b) => setData((d) => ({ ...d, badges: [b, ...d.badges] }))}
        />
      )}
    </>
  );
}

export { Award };
