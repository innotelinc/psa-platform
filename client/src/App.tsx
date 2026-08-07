import { Routes, Route, Navigate } from 'react-router-dom';
import { useStore } from './lib/store';
import Login from './pages/Login';
import Layout from './pages/Layout';
import Dashboard from './pages/Dashboard';
import Campaigns from './pages/Campaigns';
import Composer from './pages/Composer';
import ProfileHub from './pages/ProfileHub';
import Resume from './pages/Resume';
import Website from './pages/Website';
import Settings from './pages/Settings';
import PublicSite from './pages/PublicSite';

function Splash() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="logo-mark" style={{ width: 64, height: 64, fontSize: 30, margin: '0 auto 18px' }}>🔥</div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 24 }}>FameForge</div>
        <div className="muted small mt-2">Igniting your personal brand…</div>
      </div>
    </div>
  );
}

export default function App() {
  const { user, loading } = useStore();
  if (loading) return <Splash />;

  return (
    <Routes>
      <Route path="/site" element={<PublicSite />} />
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route element={user ? <Layout /> : <Navigate to="/login" />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/campaigns" element={<Campaigns />} />
        <Route path="/composer" element={<Composer />} />
        <Route path="/profile" element={<ProfileHub />} />
        <Route path="/resume" element={<Resume />} />
        <Route path="/website" element={<Website />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to={user ? '/' : '/login'} />} />
    </Routes>
  );
}
