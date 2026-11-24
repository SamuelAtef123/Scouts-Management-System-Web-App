import { useRef, useState } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import { squarePhoto } from '../photos.js';
import { t as tr } from '../i18n.jsx';
import { Avatar, ErrorBox } from './ui.jsx';

/** Shows your photo with buttons to add, change or remove it. Saves straight away. */
export default function PhotoPicker({ size = 96, onChange }) {
  const { user, updateUser } = useAuth();
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const blob = await squarePhoto(file);
      const data = await api.upload('/auth/me/photo', blob, null, { method: 'PUT', fileName: 'photo.jpg' });
      updateUser(data.user);
      onChange?.(tr('Photo saved'));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError('');
    try {
      const data = await api.del('/auth/me/photo');
      updateUser(data.user);
      onChange?.(tr('Photo removed'));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="photo-picker">
      <button type="button" className="photo-frame" onClick={() => input.current.click()} disabled={busy} aria-label={tr('Choose a photo')}>
        <Avatar person={user} size={size} />
        <span className="photo-badge">
          <Camera size={16} />
        </span>
      </button>
      <input ref={input} type="file" accept="image/*" hidden onChange={upload} />
      <div className="photo-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => input.current.click()} disabled={busy}>
          <Camera size={16} /> {busy ? tr('Saving…') : user.photoUpdatedAt ? tr('Change photo') : tr('Add a photo')}
        </button>
        {user.photoUpdatedAt && (
          <button type="button" className="btn btn-ghost btn-sm btn-danger-text" onClick={remove} disabled={busy}>
            <Trash2 size={16} /> {tr('Remove')}
          </button>
        )}
      </div>
      {error && <ErrorBox message={error} />}
    </div>
  );
}
