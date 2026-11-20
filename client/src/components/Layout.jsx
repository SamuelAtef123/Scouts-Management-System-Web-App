import { NavLink, Outlet } from 'react-router-dom';
import { CalendarDays, House, ListChecks, LogOut, UserRound, Users } from 'lucide-react';
import { useAuth } from '../auth.jsx';
import { ROLE_LABEL } from '../constants.js';
import { Avatar, VerseCard } from './ui.jsx';

export function useNavItems() {
  const { user } = useAuth();
  const items = [
    { to: '/', label: 'Home', icon: House, end: true },
    { to: '/events', label: 'Events', icon: CalendarDays },
    { to: '/tasks', label: 'My tasks', icon: ListChecks },
  ];
  if (user?.permissions.viewMembers) items.push({ to: '/members', label: 'Members', icon: Users });
  items.push({ to: '/profile', label: 'Profile', icon: UserRound });
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
            <div className="brand-title">Light of the World</div>
            <div className="brand-sub">St. Mary Church · Garden City</div>
          </div>
        </div>
        <nav className="side-nav">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="side-link">
              <Icon size={20} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="side-bottom">
          <VerseCard compact />
          <div className="side-user">
            <Avatar name={user.name} team={user.team} size={36} />
            <div className="side-user-text">
              <strong>{user.name}</strong>
              <span>{ROLE_LABEL[user.role]}</span>
            </div>
            <button className="icon-btn" onClick={logout} aria-label="Sign out" title="Sign out">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      <header className="topbar">
        <img src="/logo.jpg" alt="" className="topbar-logo" />
        <span className="topbar-title">Light of the World</span>
      </header>

      <main className="main">
        <Outlet />
      </main>

      <nav className="bottom-nav" style={{ '--count': items.length }}>
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="bottom-link">
            <Icon size={22} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
