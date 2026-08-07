import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Rocket, Loader2, Flame, Zap, Crown } from 'lucide-react';
import { useStore } from '../lib/store';
import { Btn, Field, PlatGlyph } from '../components/ui';
import { PLATFORMS } from '../lib/platforms';

export default function Login() {
  const { login, register, toast } = useStore();
  const nav = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'register') await register(name, email, password);
      else await login(email, password);
      toast('Welcome to the spotlight 🎉');
      nav('/');
    } catch (err: any) {
      toast(err.message || 'Something went wrong', 'bad');
    } finally {
      setBusy(false);
    }
  };

  const marquee = [...PLATFORMS, ...PLATFORMS];

  return (
    <div className="login-wrap">
      <div className="aurora" />
      <div className="grid-bg" />
      <div className="login-left">
        <div className="logo" style={{ padding: 0, marginBottom: 40 }}>
          <div className="logo-mark">🔥</div>
          <div className="logo-name">Fame<span>Forge</span></div>
        </div>
        <div className="giant">
          Become
          <em className="line2 shimmer" style={{ display: 'block' }}>FAMOUS.</em>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: 16, maxWidth: 480, lineHeight: 1.6 }}>
          One dashboard. Every platform. Your AI personal-brand engine posts for you,
          keeps your professional profiles razor sharp, and auto-builds your resume & website —
          all on autopilot. <span className="sparkle" style={{ color: 'var(--pink)' }}>✦</span>
        </p>
        <div className="floating-chips">
          {PLATFORMS.slice(0, 8).map((p) => (
            <div className="float-chip" key={p.id}>
              <PlatGlyph id={p.id} size={15} /> {p.name}
            </div>
          ))}
          <div className="float-chip" style={{ background: 'var(--grad2)', border: 'none', color: '#fff' }}>
            <Sparkles size={15} /> AI Generated
          </div>
        </div>
        <div className="marquee mt-6" style={{ margin: '44px -60px 0', maskImage: 'none' }}>
          <div className="marquee-track" style={{ animationDuration: '24s' }}>
            {marquee.map((p, i) => (
              <div className="marquee-item" key={i} style={{ color: p.color === '#e7e9ea' ? '#fff' : p.color, borderColor: `${p.color}44`, background: `${p.color}0f` }}>
                <PlatGlyph id={p.id} size={14} /> {p.name} · POSTED <Zap size={11} />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="login-right">
        <form className="login-card" onSubmit={submit}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{ fontSize: 30, marginBottom: 8 }}><Flame style={{ color: 'var(--orange)' }} size={34} /></div>
            <h2 style={{ fontSize: 22 }}>{mode === 'register' ? 'Create your empire' : 'Welcome back, star'}</h2>
            <p className="muted small mt-2">
              {mode === 'register' ? 'Free forever. Your fame machine starts now.' : 'The spotlight missed you.'}
            </p>
          </div>

          <div className="tabs" style={{ width: '100%', marginBottom: 20, justifyContent: 'center' }}>
            <button type="button" className={`tab ${mode === 'login' ? 'active' : ''}`} onClick={() => setMode('login')}>Sign in</button>
            <button type="button" className={`tab ${mode === 'register' ? 'active' : ''}`} onClick={() => setMode('register')}>Sign up</button>
          </div>

          {mode === 'register' && (
            <Field label="Your name">
              <input className="input" placeholder="e.g. Alex Star" value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
          )}
          <Field label="Email">
            <input className="input" type="email" placeholder="you@famous.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Password">
            <input className="input" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </Field>

          <Btn type="submit" variant="primary" size="lg" className="mt-4" style={{ width: '100%' }} disabled={busy}>
            {busy ? <Loader2 className="spin" size={18} /> : <Rocket size={18} />}
            {mode === 'register' ? 'Launch My Fame Machine' : 'Back to the Spotlight'}
          </Btn>

          <div className="row mt-4" style={{ justifyContent: 'center', gap: 16, fontSize: 12, color: 'var(--faint)' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Crown size={13} style={{ color: 'var(--orange)' }} /> AI content engine</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Zap size={13} style={{ color: 'var(--cyan)' }} /> Auto-scheduling</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><Sparkles size={13} style={{ color: 'var(--pink)' }} /> All platforms</span>
          </div>
          <p className="faint small" style={{ textAlign: 'center', marginTop: 18, lineHeight: 1.5 }}>
            Demo mode — connections & analytics are simulated. Plug in real platform & AI keys anytime in Settings.
          </p>
        </form>
      </div>
    </div>
  );
}
