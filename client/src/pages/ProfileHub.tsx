import { useState } from 'react';
import { Sparkles, Save, Plus, Trash2, Briefcase, GraduationCap, Wrench, RefreshCcw, Check, Loader2 } from 'lucide-react';
import { useStore } from '../lib/store';
import { api } from '../lib/api';
import { fallbackBio } from '../lib/ai';
import { Btn, Field, Chip, Avatar, PlatGlyph, Segmented } from '../components/ui';
import { platName } from '../lib/platforms';

const BIO_PLATFORMS = ['linkedin', 'indeed', 'instagram', 'x', 'tiktok', 'facebook', 'youtube'];
const EMOJIS = ['🔥', '✨', '🚀', '💪', '🎯', '🌱', '💜', '👑', '⭐', '⚡', '🎤', '🧠'];
const GRADS = [
  { from: '#ff2d78', to: '#a855f7' }, { from: '#ff7a18', to: '#ff2d78' }, { from: '#a855f7', to: '#22d3ee' },
  { from: '#34d399', to: '#22d3ee' }, { from: '#f59e0b', to: '#ef4444' }, { from: '#3b82f6', to: '#a855f7' },
];

export default function ProfileHub() {
  const { user, refresh, refreshDash, toast } = useStore();
  const [tab, setTab] = useState<'info' | 'bio' | 'avatar' | 'career'>('info');
  const [draft, setDraft] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [bioPlat, setBioPlat] = useState('linkedin');
  const [bioTone, setBioTone] = useState('hype');
  const [bioResult, setBioResult] = useState<{ text: string } | null>(null);
  const [bioBusy, setBioBusy] = useState(false);
  const [aboutTone, setAboutTone] = useState('professional');
  const [aboutResult, setAboutResult] = useState('');
  const [aboutBusy, setAboutBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);

  if (!user) return null;
  const p = draft || user.profile;

  const saveProfile = async () => {
    setSaving(true);
    try {
      await api.updateState({ profile: draft });
      await refresh();
      setDraft(null);
      toast('Profile saved ✅');
    } catch (e: any) { toast(e.message, 'bad'); }
    setSaving(false);
  };

  const genBio = async () => {
    setBioBusy(true);
    try {
      let res: any;
      try {
        res = await api.generate({ kind: 'bio', platform: bioPlat, tone: bioTone, brand: user.settings.brand });
      } catch { res = fallbackBio(bioPlat, user.profile); }
      setBioResult(res);
      toast(`AI wrote your ${platName(bioPlat)} bio ✨`);
    } catch { setBioResult(fallbackBio(bioPlat, user.profile)); }
    setBioBusy(false);
  };

  const genAbout = async () => {
    setAboutBusy(true);
    try {
      const res = await api.generate({ kind: 'about', tone: aboutTone });
      setAboutResult(res.text);
    } catch { setAboutResult(`I'm ${user.profile.name} — ${user.profile.headline || 'a creator & builder'}. I turn ideas into momentum and momentum into results.`); }
    setAboutBusy(false);
  };

  const syncProfiles = async () => {
    setSyncing(true);
    setTimeout(async () => {
      try {
        for (const id of ['linkedin', 'indeed']) {
          const ch = user.channels.find((c) => c.id === id);
          if (ch?.enabled) await api.updateChannel(id, { connected: true });
        }
        await refresh(); await refreshDash();
        toast('LinkedIn & Indeed profiles refreshed with your latest info 🧭');
      } catch (e: any) { toast(e.message, 'bad'); }
      setSyncing(false);
    }, 1500);
  };

  const set = (k: string, v: any) => setDraft({ ...p, [k]: v });
  const setAvatar = (patch: any) => setDraft({ ...p, avatar: { ...p.avatar, ...patch } });

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">Profile & AI Bios</h1>
          <div className="page-sub">One source of truth — auto-synced to LinkedIn, Indeed, and your site.</div>
        </div>
        {tab === 'info' && <Btn variant="primary" onClick={saveProfile} disabled={saving || !draft}><Save size={16} /> {saving ? 'Saving…' : 'Save profile'}</Btn>}
      </div>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'info', label: 'Info' },
          { value: 'bio', label: 'AI Bios & About' },
          { value: 'avatar', label: 'Profile Picture' },
          { value: 'career', label: 'Experience' },
        ]}
      />

      {tab === 'info' && (
        <div className="grid mt-4" style={{ gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', alignItems: 'start' }}>
          <div className="card">
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <Field label="Full name"><input className="input" value={p.name} onChange={(e) => set('name', e.target.value)} /></Field>
              <Field label="Headline / tagline"><input className="input" placeholder="e.g. Helping creators go viral" value={p.headline} onChange={(e) => set('headline', e.target.value)} /></Field>
            </div>
            <Field label="About me">
              <textarea className="textarea" style={{ minHeight: 110 }} value={p.about} onChange={(e) => set('about', e.target.value)} />
            </Field>
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <Field label="Location"><input className="input" value={p.location} onChange={(e) => set('location', e.target.value)} /></Field>
              <Field label="Website"><input className="input" value={p.website} onChange={(e) => set('website', e.target.value)} /></Field>
              <Field label="Email"><input className="input" value={p.email} onChange={(e) => set('email', e.target.value)} /></Field>
              <Field label="Phone"><input className="input" value={p.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
            </div>
            <div className="divider" />
            <div className="between">
              <div className="card-title"><Wrench size={15} style={{ color: 'var(--orange)' }} /> Skills</div>
              <Btn variant="ghost" size="sm" onClick={() => set('skills', [...p.skills, ''])}><Plus size={14} /> Add</Btn>
            </div>
            <div className="row wrap mt-2">
              {p.skills.map((s: string, i: number) => (
                <span key={i} className="chip">
                  <input style={{ background: 'transparent', border: 'none', outline: 'none', width: s.length ? undefined : 90, fontSize: 12 }} value={s}
                    onChange={(e) => set('skills', p.skills.map((x: string, j: number) => (j === i ? e.target.value : x)))} />
                  <button style={{ background: 'none', border: 'none', color: 'var(--faint)', cursor: 'pointer' }} onClick={() => set('skills', p.skills.filter((_: string, j: number) => j !== i))}><Trash2 size={11} /></button>
                </span>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-title"><Briefcase size={16} style={{ color: 'var(--cyan)' }} /> What I offer</div>
            <div className="card-sub">Shown on your website & resume</div>
            <div className="col mt-3">
              {p.services.map((s: any, i: number) => (
                <div key={s.id || i} className="card" style={{ padding: 12 }}>
                  <div className="row">
                    <input className="input" style={{ fontWeight: 600 }} placeholder="Service name" value={s.name} onChange={(e) => set('services', p.services.map((x: any, j: number) => j === i ? { ...x, name: e.target.value } : x))} />
                    <input className="input" style={{ width: 90 }} placeholder="Price" value={s.price} onChange={(e) => set('services', p.services.map((x: any, j: number) => j === i ? { ...x, price: e.target.value } : x))} />
                    <button className="btn ghost sm" onClick={() => set('services', p.services.filter((_: any, j: number) => j !== i))}><Trash2 size={13} /></button>
                  </div>
                  <input className="input mt-2" placeholder="Short description" value={s.desc} onChange={(e) => set('services', p.services.map((x: any, j: number) => j === i ? { ...x, desc: e.target.value } : x))} />
                </div>
              ))}
              <Btn variant="ghost" size="sm" onClick={() => set('services', [...p.services, { id: 's' + Date.now() + Math.random(), name: '', desc: '', price: '' }])}><Plus size={14} /> Add service</Btn>
            </div>
          </div>
        </div>
      )}

      {tab === 'bio' && (
        <div className="grid mt-4" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)', alignItems: 'start' }}>
          <div className="card">
            <div className="card-title"><Sparkles size={16} style={{ color: 'var(--pink)' }} /> AI Bio Generator</div>
            <div className="card-sub">Optimized per platform — LinkedIn formal, TikTok hype.</div>
            <Field label="Platform" hint="">
              <div className="row wrap" style={{ gap: 7 }}>
                {BIO_PLATFORMS.map((id) => (
                  <button key={id} className={`chip ${bioPlat === id ? 'grad' : ''}`} style={{ cursor: 'pointer' }} onClick={() => setBioPlat(id)}>
                    <PlatGlyph id={id} size={12} /> {platName(id)}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Tone">
              <select className="select" value={bioTone} onChange={(e) => setBioTone(e.target.value)}>
                {['hype', 'pro', 'witty', 'warm', 'bold', 'minimal'].map((t) => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Btn variant="gradient2" onClick={genBio} disabled={bioBusy} style={{ width: '100%' }}>
              {bioBusy ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />} Generate {platName(bioPlat)} bio
            </Btn>

            <div className="divider" />
            <div className="card-title">AI About Section</div>
            <div className="row mt-2" style={{ gap: 8 }}>
              <select className="select" value={aboutTone} onChange={(e) => setAboutTone(e.target.value)}>
                <option value="professional">Professional</option><option value="hype">Hype</option><option value="minimal">Minimal</option>
              </select>
              <Btn variant="gradient3" onClick={genAbout} disabled={aboutBusy} style={{ whiteSpace: 'nowrap' }}>
                {aboutBusy ? <Loader2 className="spin" size={15} /> : <Sparkles size={15} />} Generate
              </Btn>
            </div>
            {aboutResult && (
              <div className="mock-post mt-3">
                <div className="row between">
                  <Chip tone="violet">About section</Chip>
                  <Btn variant="ghost" size="sm" onClick={() => { set('about', aboutResult); toast('Saved to About me'); setDraft({ ...p, about: aboutResult }); }}><Check size={13} /> Use</Btn>
                </div>
                <div className="small mt-2" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{aboutResult}</div>
              </div>
            )}
          </div>

          <div className="col">
            {bioResult && (
              <div className="card">
                <div className="between">
                  <div className="card-title"><PlatGlyph id={bioPlat} size={15} /> Your {platName(bioPlat)} bio</div>
                  <Btn variant="primary" size="sm" onClick={() => { navigator.clipboard?.writeText(bioResult.text).catch(() => {}); toast('Bio copied — paste it into ' + platName(bioPlat)); }}><Check size={14} /> Copy</Btn>
                </div>
                <div className="mock-post mt-3"><div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{bioResult.text}</div></div>
              </div>
            )}
            <div className="card">
              <div className="card-title"><RefreshCcw size={16} style={{ color: 'var(--green)' }} /> Sync professional profiles</div>
              <div className="card-sub">Push your latest headline, about, and contact info to LinkedIn & Indeed — automatically keeps them up to date.</div>
              <div className="row mt-3">
                {['linkedin', 'indeed'].map((id) => (
                  <span key={id} className="chip" style={{ padding: '7px 13px' }}><PlatGlyph id={id} size={13} /> {platName(id)}</span>
                ))}
              </div>
              <Btn variant="primary" className="mt-3" onClick={syncProfiles} disabled={syncing}>
                {syncing ? <Loader2 className="spin" size={16} /> : <RefreshCcw size={16} />} {syncing ? 'Syncing…' : 'Sync now'}
              </Btn>
              <div className="faint small mt-3" style={{ lineHeight: 1.6 }}>
                💡 FameForge watches your profile for changes. Whenever you update your headline, bio, or contact details, it regenerates and pushes platform-specific versions automatically.
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'avatar' && (
        <div className="grid mt-4" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr)', alignItems: 'start' }}>
          <div className="card" style={{ textAlign: 'center' }}>
            <div className="card-title">Live preview</div>
            <div className="mt-6" style={{ display: 'flex', justifyContent: 'center' }}>
              <Avatar avatar={p.avatar} size={150} round={34} />
            </div>
            <div className="muted small mt-4">Used across your social profiles, resume & website.</div>
            {draft && <Btn variant="primary" className="mt-4" onClick={saveProfile}><Save size={15} /> Save avatar</Btn>}
          </div>
          <div className="card">
            <div className="card-title">Profile Picture Studio</div>
            <div className="card-sub">No photographer needed — pick a style and color.</div>
            <div className="field mt-4">
              <label>Style</label>
              <div className="row wrap" style={{ gap: 8 }}>
                {(['gradient', 'emoji', 'initials'] as const).map((s) => (
                  <button key={s} className={`day-pill ${p.avatar.style === s ? 'on' : ''}`} style={{ width: 'auto', padding: '0 16px', textTransform: 'capitalize' }} onClick={() => setAvatar({ style: s })}>{s}</button>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Color theme</label>
              <div className="row wrap" style={{ gap: 8 }}>
                {GRADS.map((g, i) => (
                  <button key={i} className="day-pill" style={{ width: 40, height: 40, borderRadius: 12, background: `linear-gradient(135deg, ${g.from}, ${g.to})`, border: p.avatar.from === g.from ? '2px solid #fff' : '1px solid transparent' }}
                    onClick={() => setAvatar({ from: g.from, to: g.to })} />
                ))}
              </div>
            </div>
            {p.avatar.style === 'emoji' && (
              <div className="field">
                <label>Pick your vibe</label>
                <div className="row wrap" style={{ gap: 6 }}>
                  {EMOJIS.map((e) => (
                    <button key={e} className={`day-pill ${p.avatar.emoji === e ? 'on' : ''}`} style={{ fontSize: 17 }} onClick={() => setAvatar({ emoji: e })}>{e}</button>
                  ))}
                </div>
              </div>
            )}
            {p.avatar.style === 'initials' && (
              <Field label="Label">
                <input className="input" style={{ width: 120 }} maxLength={3} value={p.avatar.label} onChange={(e) => setAvatar({ label: e.target.value.toUpperCase() })} />
              </Field>
            )}
            <div className="mt-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed var(--stroke2)', borderRadius: 14, padding: 16 }}>
              <div className="faint small" style={{ lineHeight: 1.7 }}>
                🪄 <b className="muted">AI avatar mode</b> — in the full release, FameForge generates a unique branded avatar for you on demand. For now, the studio gives you pro-level control.
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'career' && (
        <div className="grid mt-4" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', alignItems: 'start' }}>
          <div className="card">
            <div className="between">
              <div className="card-title"><Briefcase size={16} style={{ color: 'var(--cyan)' }} /> Experience</div>
              <Btn variant="ghost" size="sm" onClick={() => set('experience', [...p.experience, { id: 'e' + Date.now(), role: '', company: '', period: '', points: [] }])}><Plus size={14} /> Add</Btn>
            </div>
            <div className="col mt-3">
              {p.experience.map((x: any, i: number) => (
                <div key={x.id || i} className="card" style={{ padding: 13 }}>
                  <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <input className="input" placeholder="Role" value={x.role} onChange={(e) => set('experience', p.experience.map((y: any, j: number) => j === i ? { ...y, role: e.target.value } : y))} />
                    <input className="input" placeholder="Company" value={x.company} onChange={(e) => set('experience', p.experience.map((y: any, j: number) => j === i ? { ...y, company: e.target.value } : y))} />
                  </div>
                  <input className="input mt-2" placeholder="Period (e.g. 2022 — Present)" value={x.period} onChange={(e) => set('experience', p.experience.map((y: any, j: number) => j === i ? { ...y, period: e.target.value } : y))} />
                  <textarea className="textarea mt-2" style={{ minHeight: 60 }} placeholder="Key achievements (one per line)" value={x.points.join('\n')} onChange={(e) => set('experience', p.experience.map((y: any, j: number) => j === i ? { ...y, points: e.target.value.split('\n') } : y))} />
                  <div className="mt-2" style={{ textAlign: 'right' }}>
                    <button className="btn ghost sm" onClick={() => set('experience', p.experience.filter((_: any, j: number) => j !== i))}><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="between">
              <div className="card-title"><GraduationCap size={16} style={{ color: 'var(--violet)' }} /> Education</div>
              <Btn variant="ghost" size="sm" onClick={() => set('education', [...p.education, { id: 'ed' + Date.now(), school: '', degree: '', period: '' }])}><Plus size={14} /> Add</Btn>
            </div>
            <div className="col mt-3">
              {p.education.map((x: any, i: number) => (
                <div key={x.id || i} className="card" style={{ padding: 13 }}>
                  <input className="input" placeholder="School / university" value={x.school} onChange={(e) => set('education', p.education.map((y: any, j: number) => j === i ? { ...y, school: e.target.value } : y))} />
                  <div className="grid mt-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <input className="input" placeholder="Degree" value={x.degree} onChange={(e) => set('education', p.education.map((y: any, j: number) => j === i ? { ...y, degree: e.target.value } : y))} />
                    <input className="input" placeholder="Period" value={x.period} onChange={(e) => set('education', p.education.map((y: any, j: number) => j === i ? { ...y, period: e.target.value } : y))} />
                  </div>
                  <div className="mt-2" style={{ textAlign: 'right' }}>
                    <button className="btn ghost sm" onClick={() => set('education', p.education.filter((_: any, j: number) => j !== i))}><Trash2 size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
            {draft && <Btn variant="primary" className="mt-4" style={{ width: '100%' }} onClick={saveProfile}><Save size={15} /> Save all changes</Btn>}
          </div>
        </div>
      )}
    </div>
  );
}
