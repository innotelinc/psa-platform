import { Link } from 'react-router-dom';
import { useStore } from '../lib/store';
import { PlatGlyph } from '../components/ui';
import { platName, fmtNum } from '../lib/platforms';

export default function PublicSite() {
  const { user } = useStore();
  if (!user) {
    return (
      <div className="site-shell" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
        <div className="aurora" />
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 60, marginBottom: 16 }}>🌐</div>
          <h1 style={{ fontSize: 30 }}>This site belongs to someone famous.</h1>
          <p className="muted mt-3">Sign in to FameForge to claim your personal HQ.</p>
          <Link to="/login" className="btn primary mt-4" style={{ display: 'inline-flex' }}>Sign in</Link>
        </div>
      </div>
    );
  }

  const p = user.profile;
  const s = user.site;
  const socials = user.channels.filter((c) => c.connected && c.id !== 'website' && c.id !== 'resume');

  return (
    <div className="site-shell fade-up">
      <div className="aurora" />
      <div className="grid-bg" />
      <div className="site-hero">
        <div className="site-avatar" style={{ background: `linear-gradient(135deg, ${p.avatar.from}, ${p.avatar.to})`, display: 'grid', placeItems: 'center', fontSize: 46, fontWeight: 700 }}>
          {p.avatar.style === 'emoji' ? p.avatar.emoji : p.avatar.label}
        </div>
        <h1>{s.headline || p.name || 'Welcome'}</h1>
        <div className="sub">{s.subheadline || p.headline || 'Building something worth following.'}</div>
        {s.ctaLink && (
          <a href={s.ctaLink} target="_blank" rel="noreferrer" className="btn primary lg" style={{ marginTop: 28, display: 'inline-flex' }}>{s.ctaText}</a>
        )}
        <div className="social-row" style={{ marginTop: 34 }}>
          {socials.map((c) => (
            <span key={c.id} className="social-pill">
              <PlatGlyph id={c.id} size={16} /> {platName(c.id)}
              <span style={{ color: 'var(--faint)', fontWeight: 500 }}>{fmtNum(c.followers)}</span>
            </span>
          ))}
          {socials.length === 0 && <span className="muted">Social links appear here once channels are connected.</span>}
        </div>
      </div>

      {s.sections.about && p.about && (
        <div className="site-section">
          <h2>About</h2>
          <p className="muted" style={{ textAlign: 'center', fontSize: 16, lineHeight: 1.8 }}>{p.about}</p>
          {p.skills.length > 0 && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: 22 }}>
              {p.skills.map((sk) => <span key={sk} className="chip">{sk}</span>)}
            </div>
          )}
        </div>
      )}

      {s.sections.services && p.services.length > 0 && (
        <div className="site-section">
          <h2>What I Do</h2>
          <div className="service-grid">
            {p.services.map((sv) => (
              <div key={sv.id} className="service-card">
                <b style={{ fontSize: 17 }}>{sv.name}</b>
                <div className="muted small mt-2" style={{ lineHeight: 1.6 }}>{sv.desc}</div>
                {sv.price && <div style={{ color: s.accent, fontWeight: 700, marginTop: 12, fontSize: 16 }}>{sv.price}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {s.sections.contact && (
        <div className="site-section">
          <div className="site-cta fade-up">
            <h2 style={{ color: '#fff', marginBottom: 10 }}>Let's Talk</h2>
            <p style={{ color: 'rgba(255,255,255,0.85)', marginBottom: 20 }}>Got a project, collab, or just want to say hi?</p>
            <a href={`mailto:${p.email}`} className="btn" style={{ background: '#fff', color: '#111', border: 'none', display: 'inline-flex' }}>Email Me</a>
          </div>
        </div>
      )}

      <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--faint)', fontSize: 13 }}>
        Made with 🔥 <Link to="/login" style={{ color: 'var(--pink)' }}>FameForge</Link> · {new Date().getFullYear()}
      </div>
    </div>
  );
}
