import { useState } from 'react';
import { Megaphone, Plus, Trash2, Play, Sparkles, Pencil, Loader2 } from 'lucide-react';
import { useStore } from '../lib/store';
import { api } from '../lib/api';
import { Btn, Modal, Field, Toggle, Chip, Empty, PlatGlyph } from '../components/ui';
import { platName, fmtTime } from '../lib/platforms';
import type { Campaign } from '../lib/types';

const GOALS = [
  { id: 'promote', label: 'Promote', emoji: '📢' },
  { id: 'sell', label: 'Sell', emoji: '💰' },
  { id: 'launch', label: 'Launch', emoji: '🚀' },
  { id: 'awareness', label: 'Awareness', emoji: '👀' },
  { id: 'grow', label: 'Grow', emoji: '📈' },
];
const TONES = ['hype', 'pro', 'witty', 'warm', 'bold', 'mysterious', 'minimal'];
const TYPES = ['promo', 'education', 'behind', 'motivation', 'engagement', 'hook', 'tip', 'story', 'event', 'testimonial', 'quote'];
const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function emptyCampaign(): Campaign {
  return {
    id: '', name: '', goal: 'promote', topic: '', product: '', audience: '',
    channels: [], schedule: { mode: 'recurring', frequency: 'daily', time: '09:00', days: [1, 2, 3, 4, 5], intervalDays: 1, at: null },
    ai: { enabled: true, tone: 'hype', type: 'promo', length: 'medium' },
    active: true, autoPilot: true, nextRunAt: null, postsCreated: 0, createdAt: Date.now(),
  };
}

export default function Campaigns() {
  const { user, refresh, toast } = useStore();
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState<string | null>(null);

  if (!user) return null;
  const campaigns = user.campaigns;
  const socialChannels = user.channels.filter((c) => c.id !== 'website' && c.id !== 'resume');

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim()) return toast('Give your campaign a name', 'bad');
    if (!editing.channels.length) return toast('Pick at least one channel', 'bad');
    setSaving(true);
    try {
      if (editing.id) await api.updateCampaign(editing.id, editing);
      else await api.createCampaign(editing);
      toast('Campaign saved — the machine is armed 🚀');
      setEditing(null);
      await refresh();
    } catch (e: any) { toast(e.message, 'bad'); }
    setSaving(false);
  };

  const del = async (c: Campaign) => {
    if (!confirm(`Delete campaign "${c.name}"?`)) return;
    await api.deleteCampaign(c.id);
    toast('Campaign deleted', 'bad');
    refresh();
  };

  const runNow = async (c: Campaign) => {
    setRunning(c.id);
    try {
      const r = await api.runCampaignNow(c.id);
      toast(`Posted to ${r.posts.length} channel${r.posts.length > 1 ? 's' : ''} with AI content ⚡`);
      await refresh();
    } catch (e: any) { toast(e.message, 'bad'); }
    setRunning(null);
  };

  const toggleActive = async (c: Campaign, v: boolean) => {
    await api.updateCampaign(c.id, { active: v });
    toast(v ? `Campaign "${c.name}" is live` : `Campaign "${c.name}" paused`);
    refresh();
  };

  const scheduleLabel = (c: Campaign) => {
    const s = c.schedule;
    if (s.mode === 'once') return `Once · ${fmtTime(s.at)}`;
    if (s.frequency === 'hourly') return 'Every hour';
    if (s.frequency === 'interval') return `Every ${s.intervalDays} day${s.intervalDays > 1 ? 's' : ''} · ${s.time}`;
    if (s.frequency === 'weekly') return `Weekly · ${s.days.length ? s.days.map((d) => DAYS[d]).join(', ') : 'every day'} · ${s.time}`;
    return `Daily · ${s.time}`;
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">Campaigns</h1>
          <div className="page-sub">Set it once, let AI create, schedule & post on autopilot.</div>
        </div>
        <Btn variant="primary" onClick={() => setEditing(emptyCampaign())}><Plus size={17} /> New Campaign</Btn>
      </div>

      {campaigns.length === 0 && (
        <div className="card" style={{ borderStyle: 'dashed' }}>
          <Empty icon="📣" title="No campaigns yet" sub="Create your first campaign — FameForge's AI will generate content and post it on your schedule." />
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
            <Btn variant="primary" onClick={() => setEditing(emptyCampaign())}><Sparkles size={16} /> Create a Campaign</Btn>
          </div>
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
        {campaigns.map((c) => (
          <div className="card hoverable" key={c.id}>
            <div className="between">
              <div className="row" style={{ gap: 9 }}>
                <span style={{ fontSize: 22 }}>{GOALS.find((g) => g.id === c.goal)?.emoji}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</div>
                  <div className="faint small">{GOALS.find((g) => g.id === c.goal)?.label}</div>
                </div>
              </div>
              <Toggle checked={c.active} onChange={(v) => toggleActive(c, v)} />
            </div>

            <div className="row wrap mt-3" style={{ gap: 6 }}>
              <Chip tone={c.active ? 'green' : 'red'}>{c.active ? '● LIVE' : '○ PAUSED'}</Chip>
              <Chip>{scheduleLabel(c)}</Chip>
              {c.autoPilot && <Chip tone="violet"><Sparkles size={11} /> AI autopilot</Chip>}
            </div>

            {(c.topic || c.product) && (
              <div className="muted small mt-3" style={{ lineHeight: 1.5 }}>
                <b className="faint">{c.product ? 'Product: ' : 'Topic: '}</b>
                {c.product || c.topic}
                {c.audience && <><br /><b className="faint">Audience: </b>{c.audience}</>}
              </div>
            )}

            <div className="row wrap mt-3" style={{ gap: 5 }}>
              {c.channels.slice(0, 8).map((id) => (
                <span key={id} className="chip" style={{ padding: '4px 9px', fontSize: 11 }}><PlatGlyph id={id} size={11} /> {platName(id)}</span>
              ))}
              {c.channels.length > 8 && <Chip>+{c.channels.length - 8}</Chip>}
            </div>

            <div className="divider" style={{ margin: '14px 0' }} />
            <div className="between small">
              <span className="muted">Next run: <b style={{ color: 'var(--text)' }}>{c.nextRunAt ? fmtTime(c.nextRunAt) : '—'}</b></span>
              <span className="muted">{c.postsCreated} posts sent</span>
            </div>
            <div className="row mt-3">
              <Btn variant="gradient2" size="sm" style={{ flex: 1 }} disabled={running === c.id} onClick={() => runNow(c)}>
                {running === c.id ? <Loader2 className="spin" size={14} /> : <Play size={14} />} Run now
              </Btn>
              <Btn variant="ghost" size="sm" onClick={() => setEditing({ ...c })}><Pencil size={14} /></Btn>
              <Btn variant="ghost" size="sm" style={{ color: '#f87171' }} onClick={() => del(c)}><Trash2 size={14} /></Btn>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <Modal title={editing.id ? <span>Edit campaign</span> : <span><Sparkles size={17} style={{ color: 'var(--pink)' }} /> New campaign</span>}
          onClose={() => setEditing(null)} wide
          footer={<>
            <Btn variant="ghost" onClick={() => setEditing(null)}>Cancel</Btn>
            <Btn variant="primary" onClick={save} disabled={saving}>{saving ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />} {editing.id ? 'Save changes' : 'Launch campaign'}</Btn>
          </>}>
          <Field label="Campaign name">
            <input className="input" placeholder="e.g. Summer Product Push" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          </Field>

          <div className="field">
            <label>Goal</label>
            <div className="row wrap" style={{ gap: 8 }}>
              {GOALS.map((g) => (
                <button key={g.id} className={`day-pill ${editing.goal === g.id ? 'on' : ''}`} style={{ width: 'auto', padding: '0 14px' }}
                  onClick={() => setEditing({ ...editing, goal: g.id as any })}>{g.emoji} {g.label}</button>
              ))}
            </div>
          </div>

          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <Field label="Topic / theme">
              <input className="input" placeholder="e.g. personal branding, fitness, SaaS" value={editing.topic} onChange={(e) => setEditing({ ...editing, topic: e.target.value })} />
            </Field>
            <Field label="Product / service (optional)">
              <input className="input" placeholder="e.g. The FameForge Course" value={editing.product} onChange={(e) => setEditing({ ...editing, product: e.target.value })} />
            </Field>
          </div>
          <Field label="Target audience">
            <input className="input" placeholder="e.g. ambitious creators, local business owners" value={editing.audience} onChange={(e) => setEditing({ ...editing, audience: e.target.value })} />
          </Field>

          <div className="field">
            <label>Channels</label>
            <div className="row wrap" style={{ gap: 7 }}>
              {socialChannels.map((ch) => {
                const on = editing.channels.includes(ch.id);
                return (
                  <button key={ch.id} className={`chip ${on ? 'grad' : ''}`} style={{ cursor: 'pointer', opacity: ch.enabled ? 1 : 0.4 }}
                    onClick={() => setEditing({ ...editing, channels: on ? editing.channels.filter((x) => x !== ch.id) : [...editing.channels, ch.id] })}>
                    <PlatGlyph id={ch.id} size={12} /> {platName(ch.id)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="divider" />

          <div className="between">
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Schedule</div>
              <div className="faint small mt-2">When should this campaign fire?</div>
            </div>
            <div className="tabs">
              <button className={`tab ${editing.schedule.mode === 'recurring' ? 'active' : ''}`} onClick={() => setEditing({ ...editing, schedule: { ...editing.schedule, mode: 'recurring' } })}>Recurring</button>
              <button className={`tab ${editing.schedule.mode === 'once' ? 'active' : ''}`} onClick={() => setEditing({ ...editing, schedule: { ...editing.schedule, mode: 'once' } })}>Once</button>
            </div>
          </div>

          {editing.schedule.mode === 'recurring' ? (
            <div className="col mt-3">
              <div className="row">
                <Field label="Frequency" hint="">
                  <select className="select" value={editing.schedule.frequency} onChange={(e) => setEditing({ ...editing, schedule: { ...editing.schedule, frequency: e.target.value } })}>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly (pick days)</option>
                    <option value="interval">Every N days</option>
                    <option value="hourly">Hourly</option>
                  </select>
                </Field>
                <Field label="Time">
                  <input className="input" type="time" value={editing.schedule.time} onChange={(e) => setEditing({ ...editing, schedule: { ...editing.schedule, time: e.target.value } })} />
                </Field>
                {editing.schedule.frequency === 'interval' && (
                  <Field label="Every (days)">
                    <input className="input" type="number" min={1} max={30} value={editing.schedule.intervalDays} onChange={(e) => setEditing({ ...editing, schedule: { ...editing.schedule, intervalDays: +e.target.value } })} />
                  </Field>
                )}
              </div>
              {editing.schedule.frequency === 'weekly' && (
                <div className="row" style={{ gap: 6 }}>
                  {DAYS.map((d, i) => {
                    const on = editing.schedule.days.includes(i);
                    return (
                      <button key={i} className={`day-pill ${on ? 'on' : ''}`} onClick={() => setEditing({
                        ...editing,
                        schedule: { ...editing.schedule, days: on ? editing.schedule.days.filter((x) => x !== i) : [...editing.schedule.days, i] },
                      })}>{d}</button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="mt-3">
              <Field label="Fire at">
                <input className="input" type="datetime-local" onChange={(e) => setEditing({ ...editing, schedule: { ...editing.schedule, at: new Date(e.target.value).getTime() } })} />
              </Field>
            </div>
          )}

          <div className="divider" />

          <div className="between">
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>AI content</div>
              <div className="faint small mt-2">Let the engine write scroll-stopping posts per platform.</div>
            </div>
            <Toggle checked={editing.ai.enabled} onChange={(v) => setEditing({ ...editing, ai: { ...editing.ai, enabled: v } })} />
          </div>
          {editing.ai.enabled && (
            <div className="grid mt-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <Field label="Tone">
                <select className="select" value={editing.ai.tone} onChange={(e) => setEditing({ ...editing, ai: { ...editing.ai, tone: e.target.value } })}>
                  {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Post style">
                <select className="select" value={editing.ai.type} onChange={(e) => setEditing({ ...editing, ai: { ...editing.ai, type: e.target.value } })}>
                  {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
