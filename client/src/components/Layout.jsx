import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { api } from '../api.js';
import { CalendarDays, House, ListChecks, LogOut, UserRound, Users } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { t as tr } from '../i18n.jsx';
import { roleLabel } from '../constants.js';
import { Avatar, VerseCard } from './ui.jsx';

/** Files waiting for this reviewer, refreshed whenever the page changes. */
function useReviewCount() {
  const { user } = useAuth();
  const { pathname, search } = useLocation();
  const [count, setCount] = useState(0);
  const reviewer = user?.permissions.reviewMaterials;
  useEffect(() => {
    if (!reviewer) return;
    let live = true;
    api
      .get('/tasks/reviews/count')
      .then((d) => live && setCount(d.count))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [reviewer, pathname, search]);
  return reviewer ? count : 0;
}

export function useNavItems() {
  const { user } = useAuth();
  const reviews = useReviewCount();
  const items = [
    { to: '/', label: tr('Home'), icon: House, end: true },
    { to: '/events', label: tr('Events'), icon: CalendarDays },
    { to: '/tasks', label: tr('My tasks'), icon: ListChecks, badge: reviews },
  ];
  if (user?.permissions.viewMembers) items.push({ to: '/members', label: tr('Members'), icon: Users });
  items.push({ to: '/profile', label: tr('Profile'), icon: UserRound });
  return items;
}

export default function Layout() {
  const { user, logout } = useAuth();
  const items = useNavItems();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <img src="/logo.jpg" alt="" className="brand-logo" />
          <div>
            <div className="brand-title">{tr('Light of the World')}</div>
            <div className="brand-sub">{tr('St. Mary Church · Garden City')}</div>
          </div>
        </div>
        <nav className="side-nav">
          {items.map(({ to, label, icon: Icon, end, badge }) => (
            <NavLink key={to} to={to} end={end} className="side-link">
              <Icon size={20} />
              {label}
              {badge > 0 && <NavBadge n={badge} />}
            </NavLink>
          ))}
        </nav>
        <div className="side-bottom">
          <VerseCard compact />
          <div className="side-user">
            <Avatar person={user} size={36} />
            <div className="side-user-text">
              <strong>{user.name}</strong>
              <span>{roleLabel(user)}</span>
            </div>
            <button className="icon-btn" onClick={logout} aria-label={tr('Sign out')} title={tr('Sign out')}>
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      <header className="topbar">
        <img src="/logo.jpg" alt="" className="topbar-logo" />
        <span className="topbar-title">{tr('Light of the World')}</span>
      </header>

      <main className="main">
        <Outlet />
      </main>

      <nav className="bottom-nav" style={{ '--count': items.length }}>
        {items.map(({ to, label, icon: Icon, end, badge }) => (
          <NavLink key={to} to={to} end={end} className="bottom-link">
            <Icon size={22} />
            <span>{label}</span>
            {badge > 0 && <NavBadge n={badge} />}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function NavBadge({ n }) {
  return (
    <span className="nav-badge" aria-label={tr('{n} files to review', { n })} title={tr('{n} files to review', { n })}>
      {n > 99 ? '99+' : n}
    </span>
  );
}
