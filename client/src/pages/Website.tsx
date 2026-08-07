import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Globe, Download, Eye, Rocket, Loader2, Check } from 'lucide-react';
import { useStore } from '../lib/store';
import { api } from '../lib/api';
import { Btn, Field, Chip, Avatar, PlatGlyph } from '../components/ui';
import { plat, platName, fmtNum } from '../lib/platforms';

const ACCENTS = ['#ff2d78', '#a855f7', '#22d3ee', '#34d399', '#f59e0b', '#ff7a18'];

export default function Website() {
  const { user, refresh, toast } = useStore();
  const [publishing, setPublishing] = useState(false);

  if (!user) return null;
  const s = user.site;
  const p = user.profile;

  const patch = async (patch: any) => {
    await api.updateState({ site: { ...s, ...patch } });
    await refresh();
  };

  const publish = async () => {
    setPublishing(true);
    setTimeout(async () => {
      const slug = (s.slug || (p.name || 'me').toLowerCase().replace(/\s+/g, '-'));
      await patch({ published: !s.published, slug });
      setPublishing(false);
      toast(s.published ? 'Website unpublished' : 'Your website is LIVE 🚀 — share the link everywhere!');
    }, 1100);
  };

  const download = () => {
    const socials = user.channels.filter((c) => c.connected && c.id !== 'website' && c.id !== 'resume');
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${p.name} — ${s.headline || 'Welcome'}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:#07070f;color:#f5f5fb;line-height:1.6}
.wrap{max-width:900px;margin:0 auto;padding:0 24px}
.hero{padding:110px 24px 70px;text-align:center}
.avatar{width:110px;height:110px;border-radius:30px;margin:0 auto 28px;background:linear-gradient(135deg,${p.avatar.from},${p.avatar.to});display:grid;place-items:center;font-size:44px;font-weight:700}
h1{font-size:clamp(40px,7vw,72px);letter-spacing:-.03em;line-height:1}
.sub{font-size:18px;color:#9b9bb4;max-width:620px;margin:18px auto 0}
.cta{display:inline-block;margin-top:30px;padding:14px 34px;border-radius:14px;background:linear-gradient(100deg,${s.accent},${s.accent}99);color:#fff;font-weight:700;text-decoration:none}
section{padding:60px 24px;max-width:900px;margin:0 auto}
h2{font-size:30px;text-align:center;margin-bottom:24px}
p{color:#c9c9dd}
.services{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px}
.svc{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:24px}
.socials{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;margin-top:26px}
.pill{display:flex;align-items:center;gap:9px;padding:11px 20px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);font-weight:600;text-decoration:none;color:#f5f5fb}
.pill:hover{border-color:${s.accent}}
.footer{text-align:center;color:#6b6b88;padding:50px 24px;font-size:13px}
</style></head><body>
<div class="hero"><div class="avatar">${p.avatar.style === 'emoji' ? p.avatar.emoji : p.avatar.label}</div>
<h1>${s.headline || p.name || 'Welcome'}</h1><p class="sub">${s.subheadline || p.headline || 'Building something worth following.'}</p>
${s.ctaLink ? `<a class="cta" href="${s.ctaLink}">${s.ctaText}</a>` : ''}</div>
${s.sections.about && p.about ? `<section><h2>About</h2><p>${p.about}</p></section>` : ''}
${s.sections.services && p.services.length ? `<section><h2>What I Do</h2><div class="services">${p.services.map((sv) => `<div class="svc"><h3>${sv.name}</h3><p style="margin-top:8px">${sv.desc}</p><p style="margin-top:10px;color:${s.accent};font-weight:700">${sv.price}</p></div>`).join('')}</div></section>` : ''}
${s.sections.socials ? `<section><h2>Find Me Everywhere</h2><div class="socials">${socials.map((c) => `<a class="pill" href="#">${plat(c.id)?.name} · ${c.handle}</a>`).join('')}</div></section>` : ''}
${s.sections.contact ? `<section style="text-align:center"><h2>Let's Talk</h2><p>${p.email ? `Email: ${p.email}` : 'Contact me'}</p></section>` : ''}
<div class="footer">Made with 🔥 FameForge · ${new Date().getFullYear()}</div>
</body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(s.slug || 'my-site')}.html`;
    a.click();
    toast('Website exported as a standalone HTML file 🌐');
  };

  const connectedSocials = user.channels.filter((c) => c.connected && c.id !== 'website' && c.id !== 'resume');
  const shareUrl = `${window.location.origin}/site${s.slug ? `?slug=${s.slug}` : ''}`;

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">My Website</h1>
          <div className="page-sub">Your personal HQ — auto-generated, always current, linked to all your socials.</div>
        </div>
        <div className="row">
          <Btn variant="ghost" onClick={download}><Download size={16} /> Export HTML</Btn>
          <Btn variant="primary" onClick={publish} disabled={publishing}>
            {publishing ? <Loader2 className="spin" size={16} /> : s.published ? <Check size={16} /> : <Rocket size={16} />}
            {s.published ? 'Unpublish' : 'Go Live'}
          </Btn>
        </div>
      </div>

      {s.published && (
        <div className="card" style={{ borderColor: 'rgba(52,211,153,0.4)', background: 'rgba(52,211,153,0.06)', marginBottom: 16 }}>
          <div className="between">
            <div className="row" style={{ gap: 10 }}>
              <span className="badge-dot" style={{ background: 'var(--green)', boxShadow: '0 0 10px var(--green)' }} />
              <b>Your site is live!</b>
              <span className="muted small">{shareUrl}</span>
            </div>
            <div className="row">
              <button className="btn ghost sm" onClick={() => { navigator.clipboard?.writeText(shareUrl).catch(() => {}); toast('Link copied 📋'); }}>Copy link</button>
              <Link to="/site" className="btn primary sm"><Eye size={14} /> View live</Link>
            </div>
          </div>
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr)', alignItems: 'start' }}>
        <div className="col">
          <div className="card">
            <div className="card-title"><Globe size={16} style={{ color: 'var(--violet)' }} /> Hero</div>
            <Field label="Big headline">
              <input className="input" placeholder="e.g. I Make Brands Famous" value={s.headline} onChange={(e) => patch({ headline: e.target.value })} />
            </Field>
            <Field label="Sub-headline">
              <input className="input" placeholder="One line that makes people want to know you" value={s.subheadline} onChange={(e) => patch({ subheadline: e.target.value })} />
            </Field>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <Field label="CTA button">
                <input className="input" value={s.ctaText} onChange={(e) => patch({ ctaText: e.target.value })} />
              </Field>
              <Field label="CTA link">
                <input className="input" placeholder="https://…" value={s.ctaLink} onChange={(e) => patch({ ctaLink: e.target.value })} />
              </Field>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Style</div>
            <div className="field mt-3">
              <label>Accent color</label>
              <div className="row wrap" style={{ gap: 8 }}>
                {ACCENTS.map((c) => (
                  <button key={c} className="day-pill" style={{ width: 34, height: 34, borderRadius: 10, background: c, border: s.accent === c ? '2px solid #fff' : '1px solid transparent' }} onClick={() => patch({ accent: c })} />
                ))}
              </div>
            </div>
            <Field label="Custom URL slug">
              <input className="input" placeholder="my-awesome-brand" value={s.slug} onChange={(e) => patch({ slug: e.target.value.replace(/[^a-z0-9-]/gi, '').toLowerCase() })} />
            </Field>
          </div>

          <div className="card">
            <div className="card-title">Sections</div>
            <div className="col mt-3">
              {Object.entries(s.sections).map(([k, v]) => (
                <div key={k} className="between">
                  <span style={{ textTransform: 'capitalize', fontSize: 13.5 }}>{k}</span>
                  <label className="toggle">
                    <input type="checkbox" checked={!!v} onChange={(e) => patch({ sections: { ...s.sections, [k]: e.target.checked } })} />
                    <span className="track" />
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-title">Social links</div>
            <div className="card-sub">Auto-added from your connected channels</div>
            <div className="row wrap mt-3" style={{ gap: 7 }}>
              {connectedSocials.length === 0 && <span className="muted small">Connect channels on the Dashboard to add them here.</span>}
              {connectedSocials.map((c) => (
                <span key={c.id} className="chip"><PlatGlyph id={c.id} size={12} /> {platName(c.id)} · {c.handle} <span className="faint">({fmtNum(c.followers)})</span></span>
              ))}
            </div>
          </div>
        </div>

        {/* live preview */}
        <div className="card" style={{ background: 'transparent', border: 'none', padding: 0 }}>
          <div className="between" style={{ marginBottom: 12 }}>
            <div className="card-title">Live preview</div>
            <Link to="/site" className="btn ghost sm"><Eye size={14} /> Open full site</Link>
          </div>
          <div style={{ border: '1px solid var(--stroke)', borderRadius: 20, overflow: 'hidden', background: '#07070f', maxHeight: 720, overflowY: 'auto' }}>
            <div className="site-hero" style={{ padding: '60px 24px 40px' }}>
              <div className="site-avatar" style={{ background: `linear-gradient(135deg, ${p.avatar.from}, ${p.avatar.to})`, display: 'grid', placeItems: 'center', fontSize: 40 }}>
                {p.avatar.style === 'emoji' ? p.avatar.emoji : p.avatar.label}
              </div>
              <h1 style={{ fontSize: 40 }}>{s.headline || p.name || 'Your headline'}</h1>
              <div className="sub" style={{ fontSize: 15 }}>{s.subheadline || p.headline || 'Your tagline goes here'}</div>
              {s.ctaLink && <button className="btn primary lg mt-4" style={{ pointerEvents: 'none' }}>{s.ctaText}</button>}
            </div>
            {s.sections.about && p.about && (
              <div className="site-section" style={{ padding: '30px 24px' }}>
                <h2 style={{ fontSize: 22 }}>About</h2>
                <p className="muted" style={{ textAlign: 'center', fontSize: 14 }}>{p.about}</p>
              </div>
            )}
            {s.sections.services && p.services.length > 0 && (
              <div className="site-section" style={{ padding: '30px 24px' }}>
                <h2 style={{ fontSize: 22 }}>What I Do</h2>
                <div className="service-grid">
                  {p.services.map((sv) => (
                    <div key={sv.id} className="service-card" style={{ padding: 18 }}>
                      <b>{sv.name}</b>
                      <div className="muted small mt-2">{sv.desc}</div>
                      <div style={{ color: s.accent, fontWeight: 700, marginTop: 8 }}>{sv.price}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {s.sections.socials && connectedSocials.length > 0 && (
              <div className="site-section" style={{ padding: '26px 24px' }}>
                <div className="social-row">
                  {connectedSocials.map((c) => (
                    <span key={c.id} className="social-pill"><PlatGlyph id={c.id} size={15} /> {platName(c.id)}</span>
                  ))}
                </div>
              </div>
            )}
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--faint)', fontSize: 12 }}>Made with 🔥 FameForge</div>
          </div>
        </div>
      </div>
    </div>
  );
}
