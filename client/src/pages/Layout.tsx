import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Megaphone, PenLine, UserRound, FileText, Globe, Settings, LogOut, Sparkles, GitBranch, X } from 'lucide-react';
import { useStore } from '../lib/store';
import { Avatar } from '../components/ui';
import { api } from '../lib/api';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/campaigns', label: 'Campaigns', icon: Megaphone },
  { to: '/composer', label: 'Composer', icon: PenLine },
  { to: '/profile', label: 'Profile & AI Bio', icon: UserRound },
  { to: '/resume', label: 'Resume', icon: FileText },
  { to: '/website', label: 'My Website', icon: Globe },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const DAY_MS = 864e5;

interface BuildInfo {
  commit: string;
  date?: string;
  describe?: string;
  buildTime?: string;
  source?: string;
}

// Age of the running build in days (null when it can't be determined)
function buildAgeDays(info: BuildInfo | null): number | null {
  const at = info?.buildTime || info?.date;
  if (!at) return null;
  const t = new Date(at).getTime();
  if (!t) return null;
  return (Date.now() - t) / DAY_MS;
}

const BANNER_COLORS: Record<'warn' | 'bad', { bg: string; border: string; text: string; dot: string }> = {
  warn: { bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.35)', text: '#fbbf24', dot: '#f59e0b' },
  bad: { bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.35)', text: '#f87171', dot: '#ef4444' },
};

// Warns when the deployed build is stale, dirty, or missing version metadata —
// catches config drift from old Docker images (e.g. the Meta OAuth PKCE fix).
function BuildBanner({ info }: { info: BuildInfo | null }) {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('ff_build_dismissed') || '');
  if (!info) return null;

  const dirty = (info.describe || '').includes('-dirty');
  const missing = !info.commit || info.commit === 'unknown';
  const ageDays = buildAgeDays(info);

  let level: 'ok' | 'warn' | 'bad' = 'ok';
  let title = '';
  let msg = '';
  if (missing) {
    level = 'warn';
    title = 'Deployed build metadata missing';
    msg = 'This image was not built with git version info. Rebuild via scripts/deploy.sh so stale deployments are visible.';
  } else if (dirty) {
    level = 'warn';
    title = `Build ${info.commit} has uncommitted changes`;
    msg = 'The running image was built from a dirty working tree and may not match the repo. Commit and redeploy.';
  } else if (ageDays !== null && ageDays > 30) {
    level = 'bad';
    title = `Deployed build ${info.commit} is ${Math.floor(ageDays)} days old`;
    msg = 'The running image is well behind the repo. Rebuild & redeploy with scripts/deploy.sh to pick up fixes.';
  } else if (ageDays !== null && ageDays > 14) {
    level = 'warn';
    title = `Deployed build ${info.commit} is ${Math.floor(ageDays)} days old`;
    msg = 'Consider rebuilding & redeploying with scripts/deploy.sh.';
  }

  const dismissKey = `${info.commit}${dirty ? '-dirty' : ''}`;
  if (level === 'ok' || dismissed === dismissKey) return null;
  const c = BANNER_COLORS[level];

  return (
    <div style={{ background: c.bg, border: `1px solid ${c.border}`, borderRadius: 12, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
      <span className="badge-dot" style={{ background: c.dot, boxShadow: `0 0 8px ${c.dot}` }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="small" style={{ fontWeight: 600, color: c.text }}>{title}</div>
        <div className="faint small" style={{ lineHeight: 1.5 }}>{msg}</div>
      </div>
      <button className="btn ghost sm" style={{ padding: 6 }} onClick={() => { localStorage.setItem('ff_build_dismissed', dismissKey); setDismissed(dismissKey); }} title="Dismiss">
        <X size={14} />
      </button>
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useStore();
  const nav = useNavigate();
  const [build, setBuild] = useState<BuildInfo | null>(null);

  useEffect(() => {
    api.version().then(setBuild).catch(() => setBuild({ commit: 'unknown' }));
  }, []);

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
        {build && (
          <div className="side-build" title={`Deployed ${build.commit} · built ${build.buildTime || build.date || 'unknown'}`}>
            <GitBranch size={11} />
            <span>{build.commit === 'unknown' ? 'build metadata missing' : build.commit}</span>
          </div>
        )}
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
        <BuildBanner info={build} />
        <Outlet />
      </main>
    </div>
  );
}
