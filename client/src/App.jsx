import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import Layout from './components/Layout.jsx';
import { Spinner } from './components/ui.jsx';
import Login from './pages/Login.jsx';
import CompleteProfile from './pages/CompleteProfile.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import Home from './pages/Home.jsx';
import Events from './pages/Events.jsx';
import EventDetail from './pages/EventDetail.jsx';
import MyTasks from './pages/MyTasks.jsx';
import Members from './pages/Members.jsx';
import Profile from './pages/Profile.jsx';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="splash">
        <img src="/logo.jpg" alt="" />
        <Spinner />
      </div>
    );
  }

  // "Forgot password?" link from an email: works whether or not someone is signed in on this device.
  if (window.location.pathname === '/reset-password') return <ResetPassword />;
  if (!user) return <Login />;
  // The mobile number and a confirmed email must be added, and a password set by someone else replaced, before using the app.
  if (!user.phone || !user.email || !user.emailVerified || user.mustChangePassword) return <CompleteProfile />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="events" element={<Events />} />
        <Route path="events/:id" element={<EventDetail />} />
        <Route path="tasks" element={<MyTasks />} />
        {user.permissions.viewMembers && <Route path="members" element={<Members />} />}
        <Route path="profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
