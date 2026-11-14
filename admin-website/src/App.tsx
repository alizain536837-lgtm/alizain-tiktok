import { useEffect } from 'react';
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuth } from './auth';
import { LoginScreen, SetupScreen } from './pages/AuthScreens';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Videos from './pages/Videos';
import Comments from './pages/Comments';
import Reports from './pages/Reports';
import Live from './pages/Live';
import Music from './pages/Music';
import Hashtags from './pages/Hashtags';
import Creators from './pages/Creators';
import Notifications from './pages/Notifications';
import Settings from './pages/Settings';
import Storage from './pages/Storage';
import AuditLogs from './pages/AuditLogs';

const NAV = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/users', label: 'Users' },
  { to: '/videos', label: 'Videos' },
  { to: '/comments', label: 'Comments' },
  { to: '/reports', label: 'Reports' },
  { to: '/live', label: 'Live Streaming' },
  { to: '/music', label: 'Music' },
  { to: '/hashtags', label: 'Hashtags' },
  { to: '/creators', label: 'Creators' },
  { to: '/notifications', label: 'Notifications' },
  { to: '/storage', label: 'Storage' },
];
// Super-admin only sections (hidden from the `admin` role entirely).
const SUPER_NAV = [
  { to: '/settings', label: 'App Settings' },
  { to: '/audit-logs', label: 'Audit Logs' },
];

const TITLES: Record<string, string> = {
  '/': 'Dashboard', '/users': 'Users Management', '/videos': 'Video Management',
  '/comments': 'Comments Management', '/reports': 'Reports Management',
  '/live': 'Live Streaming Management', '/music': 'Music Management',
  '/hashtags': 'Hashtag Management', '/creators': 'Creator Management',
  '/notifications': 'Notifications', '/settings': 'App Settings',
  '/storage': 'Storage Statistics', '/audit-logs': 'Audit Logs',
};

export default function App() {
  const { admin, ready, logout } = useAuth();
  const navigate = useNavigate();

  // If the stored token is rejected (401) by any call, the pages show the
  // error; a global 401 listener is not wired here because fetch calls go
  // through api.ts — expired sessions surface as a login prompt via logout.
  useEffect(() => {
    const onUnauth = () => logout();
    window.addEventListener('alizain-admin-unauthorized', onUnauth);
    return () => window.removeEventListener('alizain-admin-unauthorized', onUnauth);
  }, [logout]);

  if (!ready) return <p className="loading" style={{ padding: 24 }}>Loading admin panel…</p>;
  if (!admin) {
    // First-use setup is offered from the login screen; the setup screen
    // itself is reachable there so an existing super admin never sees it
    // as the default view.
    return <LoginScreen />;
  }

  const isSuper = admin.role === 'super_admin';
  const path = window.location.hash.replace(/^#/, '') || '/';
  const title = TITLES[path] ?? 'Admin Panel';

  return (
    <div className="layout">
      <aside className="sidebar">
        <p className="brand">ALIZAIN <span>TIKTOK</span></p>
        <p className="brand-sub">Admin Panel</p>
        <nav>
          <div className="nav-section">Manage</div>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>{n.label}</NavLink>
          ))}
          {isSuper ? (
            <>
              <div className="nav-section">Super Admin</div>
              {SUPER_NAV.map((n) => (
                <NavLink key={n.to} to={n.to} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>{n.label}</NavLink>
              ))}
            </>
          ) : null}
        </nav>
        <div style={{ marginTop: 24 }}>
          <p className="who">{admin.name}<br />{admin.email}<br />Role: {admin.role}</p>
          <button className="btn btn-ghost" onClick={() => { logout(); navigate('/'); }}>Log out</button>
        </div>
      </aside>
      <main className="main">
        <div className="topbar"><h1>{title}</h1></div>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/users" element={<Users />} />
          <Route path="/videos" element={<Videos />} />
          <Route path="/comments" element={<Comments />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/live" element={<Live />} />
          <Route path="/music" element={<Music />} />
          <Route path="/hashtags" element={<Hashtags />} />
          <Route path="/creators" element={<Creators />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/storage" element={<Storage />} />
          <Route path="/settings" element={isSuper ? <Settings /> : <Navigate to="/" replace />} />
          <Route path="/audit-logs" element={isSuper ? <AuditLogs /> : <Navigate to="/" replace />} />
          <Route path="/setup" element={<SetupScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
