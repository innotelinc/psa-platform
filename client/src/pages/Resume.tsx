import { useState } from 'react';
import { Download, Printer, Sparkles, Loader2, FileText } from 'lucide-react';
import { useStore } from '../lib/store';
import { api } from '../lib/api';
import { Btn, Chip, Avatar, Segmented, Field } from '../components/ui';
import { plat } from '../lib/platforms';

const ACCENTS = ['#ff2d78', '#a855f7', '#0A66C2', '#34d399', '#f59e0b', '#22d3ee'];

export default function Resume() {
  const { user, refresh, toast } = useStore();
  const [genBusy, setGenBusy] = useState(false);

  if (!user) return null;
  const r = user.resume;
  const p = user.profile;

  const patch = async (patch: any) => {
    await api.updateState({ resume: { ...r, ...patch } });
    await refresh();
  };

  const genSummary = async () => {
    setGenBusy(true);
    try {
      const res = await api.generate({ kind: 'about', tone: 'professional' });
      await patch({ summary: res.text });
      toast('AI wrote your professional summary ✨');
    } catch (e: any) { toast(e.message, 'bad'); }
    setGenBusy(false);
  };

  const connectedSocials = user.channels.filter((c) => c.connected && c.id !== 'website' && c.id !== 'resume');

  const download = () => {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${p.name || 'Resume'} — Resume</title>
<style>
body{font-family:Georgia,'Times New Roman',serif;color:#1a1a2e;max-width:760px;margin:40px auto;padding:0 24px;line-height:1.55}
h1{font-size:30px;margin:0 0 2px} h2{font-size:14px;text-transform:uppercase;letter-spacing:.1em;border-bottom:2px solid ${r.accent};padding-bottom:6px;margin:26px 0 12px}
a{color:${r.accent}} .head{color:#555} .job{margin-bottom:10px} .job b{display:block}
</style></head><body>
<h1>${p.name || ''}</h1>
<div class="head">${p.headline || ''}${p.location ? ' · ' + p.location : ''}${p.email ? ' · ' + p.email : ''}${p.phone ? ' · ' + p.phone : ''}${p.website ? ' · ' + p.website : ''}</div>
${r.sections.summary && (r.summary || p.about) ? `<h2>Summary</h2><p>${r.summary || p.about}</p>` : ''}
${r.sections.skills && p.skills.length ? `<h2>Skills</h2><p>${p.skills.join(', ')}</p>` : ''}
${r.sections.experience && p.experience.length ? `<h2>Experience</h2>${p.experience.map((e) => `<div class="job"><b>${e.role} — ${e.company}</b><span class="head">${e.period}</span>${e.points.length ? '<ul>' + e.points.map((pt) => `<li>${pt}</li>`).join('') + '</ul>' : ''}</div>`).join('')}` : ''}
${r.sections.education && p.education.length ? `<h2>Education</h2>${p.education.map((e) => `<div class="job"><b>${e.degree} — ${e.school}</b><span class="head">${e.period}</span></div>`).join('')}` : ''}
${r.sections.services && p.services.length ? `<h2>Services</h2><ul>${p.services.map((s) => `<li><b>${s.name}</b>${s.price ? ' — ' + s.price : ''}${s.desc ? ': ' + s.desc : ''}</li>`).join('')}</ul>` : ''}
${r.sections.socials && connectedSocials.length ? `<h2>Find Me</h2><p>${connectedSocials.map((c) => { const pl = plat(c.id); return `<a href="#">${pl?.name}: ${c.handle}</a>`; }).join(' · ')}</p>` : ''}
</body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(p.name || 'my').toLowerCase().replace(/\s+/g, '-')}-resume.html`;
    a.click();
    toast('Resume downloaded — open in any browser & print to PDF 📄');
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">Resume</h1>
          <div className="page-sub">Built automatically from your profile — always up to date.</div>
        </div>
        <div className="row">
          <Btn variant="ghost" onClick={() => window.print()}><Printer size={16} /> Print / PDF</Btn>
          <Btn variant="primary" onClick={download}><Download size={16} /> Download</Btn>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.7fr)', alignItems: 'start' }}>
        <div className="col">
          <div className="card">
            <div className="card-title"><FileText size={16} style={{ color: 'var(--pink)' }} /> Template</div>
            <div className="mt-3">
              <Segmented value={r.template} onChange={(v) => patch({ template: v })} options={[
                { value: 'modern', label: 'Modern' }, { value: 'minimal', label: 'Minimal' }, { value: 'bold', label: 'Bold' },
              ]} />
            </div>
            <div className="field mt-4">
              <label>Accent color</label>
              <div className="row wrap" style={{ gap: 8 }}>
                {ACCENTS.map((c) => (
                  <button key={c} className="day-pill" style={{ width: 34, height: 34, borderRadius: 10, background: c, border: r.accent === c ? '2px solid #fff' : '1px solid transparent' }} onClick={() => patch({ accent: c })} />
                ))}
              </div>
            </div>
            <Field label="Target role">
              <input className="input" placeholder="e.g. Head of Growth" value={r.targetRole} onChange={(e) => patch({ targetRole: e.target.value })} />
            </Field>
          </div>

          <div className="card">
            <div className="card-title">Professional summary</div>
            <div className="card-sub">Lead with a punch — recruiters read 6 seconds.</div>
            <textarea className="textarea mt-3" style={{ minHeight: 110 }} value={r.summary || p.about || ''} onChange={(e) => patch({ summary: e.target.value })} placeholder="Your summary…" />
            <Btn variant="gradient2" size="sm" className="mt-2" onClick={genSummary} disabled={genBusy}>
              {genBusy ? <Loader2 className="spin" size={14} /> : <Sparkles size={14} />} Write with AI
            </Btn>
          </div>

          <div className="card">
            <div className="card-title">Sections</div>
            <div className="col mt-3">
              {Object.entries(r.sections).map(([k, v]) => (
                <div key={k} className="between">
                  <span style={{ textTransform: 'capitalize', fontSize: 13.5 }}>{k}</span>
                  <label className="toggle">
                    <input type="checkbox" checked={!!v} onChange={(e) => patch({ sections: { ...r.sections, [k]: e.target.checked } })} />
                    <span className="track" />
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="col no-print">
          <div className="card" style={{ background: 'transparent', border: 'none', padding: 0 }}>
            <div className="between mb-3" style={{ marginBottom: 12 }}>
              <div className="card-title">Live preview</div>
              <Chip tone="green"><span className="badge-dot" /> auto-updating</Chip>
            </div>
            <div className={`resume-paper ${r.template}`} style={{ borderColor: r.accent }}>
              <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
                <Avatar avatar={p.avatar} size={84} round={18} />
                <div style={{ flex: 1 }}>
                  <h1>{p.name || 'Your Name'}</h1>
                  <div style={{ fontSize: 15, marginTop: 4 }}>{r.targetRole || p.headline || 'Headline goes here'}</div>
                  <div style={{ fontSize: 12.5, color: '#666', marginTop: 6 }}>
                    {[p.location, p.email, p.phone, p.website].filter(Boolean).join(' · ') || 'Location · email · phone'}
                  </div>
                </div>
              </div>
              {r.sections.summary && (r.summary || p.about) && (
                <>
                  <h2 style={{ color: r.accent }}>Summary</h2>
                  <p>{r.summary || p.about || 'Your professional summary appears here.'}</p>
                </>
              )}
              {r.sections.skills && (
                <>
                  <h2 style={{ color: r.accent }}>Skills</h2>
                  <p>{p.skills.length ? p.skills.join(' · ') : 'Add skills in Profile → they appear here instantly.'}</p>
                </>
              )}
              {r.sections.experience && (
                <>
                  <h2 style={{ color: r.accent }}>Experience</h2>
                  {p.experience.length ? p.experience.map((e, i) => (
                    <div key={i} style={{ marginBottom: 10 }}>
                      <b>{e.role} — {e.company}</b> <span style={{ color: '#666', fontSize: 12.5 }}>{e.period}</span>
                      {e.points.length > 0 && <ul style={{ margin: '6px 0 0 18px' }}>{e.points.map((pt, j) => <li key={j}>{pt}</li>)}</ul>}
                    </div>
                  )) : <p className="faint">Add experience in Profile → Experience.</p>}
                </>
              )}
              {r.sections.education && (
                <>
                  <h2 style={{ color: r.accent }}>Education</h2>
                  {p.education.length ? p.education.map((e, i) => (
                    <div key={i}><b>{e.degree} — {e.school}</b> <span style={{ color: '#666', fontSize: 12.5 }}>{e.period}</span></div>
                  )) : <p className="faint">Add education in Profile → Experience.</p>}
                </>
              )}
              {r.sections.services && p.services.length > 0 && (
                <>
                  <h2 style={{ color: r.accent }}>Services</h2>
                  <ul style={{ marginLeft: 18 }}>{p.services.map((s, i) => <li key={i}><b>{s.name}</b>{s.price ? ` — ${s.price}` : ''}{s.desc ? `: ${s.desc}` : ''}</li>)}</ul>
                </>
              )}
              {r.sections.socials && connectedSocials.length > 0 && (
                <>
                  <h2 style={{ color: r.accent }}>Find Me</h2>
                  <p>{connectedSocials.map((c) => `${plat(c.id)?.name} (${c.handle})`).join(' · ')}</p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
