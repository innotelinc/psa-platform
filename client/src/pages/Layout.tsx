import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Megaphone, PenLine, UserRound, FileText, Globe, Settings, LogOut, Sparkles } from 'lucide-react';
import { useStore } from '../lib/store';
import { Avatar } from '../components/ui';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/campaigns', label: 'Campaigns', icon: Megaphone },
  { to: '/composer', label: 'Composer', icon: PenLine },
  { to: '/profile', label: 'Profile & AI Bio', icon: UserRound },
  { to: '/resume', label: 'Resume', icon: FileText },
  { to: '/website', label: 'My Website', icon: Globe },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function Layout() {
  const { user, logout } = useStore();
  const nav = useNavigate();

  return (
    <div className="app">
      <div className="aurora" />
      <div className="grid-bg" />
      <aside className="sidebar">
        <div className="logo" onClick={() => nav('/')} style={{ cursor: 'pointer' }}>
          <div className="logo-mark">🔥</div>
          <div className="logo-name">Fame<span>Forge</span></div>
        </div>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <n.icon size={18} /> {n.label}
          </NavLink>
        ))}
        <div className="spacer" />
        <div className="side-user">
          <Avatar avatar={user?.profile.avatar} size={36} round={10} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: 13.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.name}</div>
            <div className="faint small">Fame level: <Sparkles size={11} style={{ color: 'var(--pink)', verticalAlign: '-1px' }} /> rising</div>
          </div>
          <button className="btn ghost sm" onClick={logout} title="Log out" style={{ padding: 7, marginLeft: 'auto' }}>
            <LogOut size={15} />
          </button>
        </div>
      </aside>

      <div className="mobile-nav">
        <div className="logo-mark" style={{ width: 30, height: 30, fontSize: 15, marginRight: 6 }}>🔥</div>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `mnav-item ${isActive ? 'active' : ''}`}>
            {n.label}
          </NavLink>
        ))}
      </div>

      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
