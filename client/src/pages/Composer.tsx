import { useMemo, useState } from 'react';
import { Sparkles, Send, CalendarClock, Wand2, Hash, Loader2, Copy, Check, Trash2, Zap } from 'lucide-react';
import { useStore } from '../lib/store';
import { api } from '../lib/api';
import { fallbackPost, fallbackHeadlines } from '../lib/ai';
import { Btn, Field, Chip, Empty, PlatGlyph, Avatar } from '../components/ui';
import { platName, plat, fmtTime, timeAgo } from '../lib/platforms';
import type { Post } from '../lib/types';

const TONES = ['hype', 'pro', 'witty', 'warm', 'bold', 'mysterious', 'minimal'];
const TYPES = ['promo', 'education', 'behind', 'motivation', 'engagement', 'hook', 'tip', 'story', 'event', 'testimonial', 'quote'];

export default function Composer() {
  const { user, refresh, refreshDash, toast } = useStore();
  const [channelIds, setChannelIds] = useState<string[]>([]);
  const [content, setContent] = useState('');
  const [mode, setMode] = useState<'now' | 'later' | 'campaign'>('now');
  const [at, setAt] = useState('');
  const [campaignId, setCampaignId] = useState('');

  // AI panel
  const [topic, setTopic] = useState('');
  const [product, setProduct] = useState('');
  const [audience, setAudience] = useState('');
  const [tone, setTone] = useState('hype');
  const [type, setType] = useState('promo');
  const [length, setLength] = useState('medium');
  const [gen, setGen] = useState<any[]>([]);
  const [genBusy, setGenBusy] = useState(false);
  const [headlines, setHeadlines] = useState<string[]>([]);
  const [headBusy, setHeadBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  if (!user) return null;
  const available = user.channels.filter((c) => c.enabled && (c.connected || c.id === 'website' || c.id === 'resume'));
  const minLimit = channelIds.length ? Math.min(...channelIds.map((id) => plat(id)?.charLimit || 280)) : 280;

  const toggleChannel = (id: string) => setChannelIds((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  const generate = async () => {
    if (!topic.trim() && !product.trim()) return toast('Add a topic or product first', 'bad');
    setGenBusy(true);
    try {
      let res: any;
      try {
        res = await api.generate({ kind: 'post', topic, product, audience, tone, type, length, platform: 'instagram', count: 3, brand: user.settings.brand });
      } catch {
        res = [fallbackPost({ topic, product, audience, tone, type, length, platform: 'instagram' })];
      }
      setGen(Array.isArray(res) ? res : [res]);
      toast('AI cooked up 3 fresh posts ✨');
    } catch { setGen([fallbackPost({ topic, product, audience, tone, type, length })]); }
    setGenBusy(false);
  };

  const getHeadlines = async () => {
    setHeadBusy(true);
    try {
      let hs: string[];
      try {
        const r = await api.generate({ kind: 'headlines', topic, count: 6 });
        hs = (r.headlines || []).map((h: any) => (typeof h === 'string' ? h : h.title));
      } catch {
        hs = fallbackHeadlines(topic || 'This', 6);
      }
      setHeadlines(hs);
    } catch { setHeadlines(fallbackHeadlines(topic || 'This', 6)); }
    setHeadBusy(false);
  };

  const copy = async (t: string) => {
    try { await navigator.clipboard.writeText(t); } catch {}
    setCopied(t.slice(0, 24));
    setTimeout(() => setCopied(null), 1500);
  };

  const publish = async () => {
    if (!channelIds.length) return toast('Pick at least one channel', 'bad');
    if (!content.trim()) return toast('Write something first', 'bad');
    const scheduledAt = mode === 'later' && at ? new Date(at).getTime() : null;
    await api.createPost({ channelIds, content, scheduledAt, campaignId: mode === 'campaign' ? campaignId : null });
    toast(scheduledAt ? `Queued for ${fmtTime(scheduledAt)} 🕐` : 'Published across all channels 🎉');
    setContent(''); setChannelIds([]); setGen([]);
    await refresh(); await refreshDash();
  };

  const deletePost = async (p: Post) => {
    await api.deletePost(p.id);
    await refresh(); await refreshDash();
  };

  const publishNow = async (p: Post) => {
    await api.publishPost(p.id);
    toast('Post published now ⚡');
    await refresh(); await refreshDash();
  };

  const queue = useMemo(() => [...user.posts].filter((p) => p.status !== 'published').sort((a, b) => (a.scheduledAt || 0) - (b.scheduledAt || 0)), [user]);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="page-title">Composer</h1>
          <div className="page-sub">Write once, post everywhere — or let AI write it for you.</div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 1fr)', alignItems: 'start' }}>
        {/* left: composer */}
        <div className="col">
          <div className="card">
            <div className="card-title"><Wand2 size={16} style={{ color: 'var(--pink)' }} /> AI Content Lab</div>
            <div className="card-sub">Feed the engine a topic — it writes the hook, the body, and the hashtags.</div>
            <div className="grid mt-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <Field label="Topic / hook">
                <input className="input" placeholder="e.g. my new course" value={topic} onChange={(e) => setTopic(e.target.value)} />
              </Field>
              <Field label="Product / service">
                <input className="input" placeholder="e.g. The Fame Course" value={product} onChange={(e) => setProduct(e.target.value)} />
              </Field>
            </div>
            <Field label="Target audience">
              <input className="input" placeholder="e.g. busy entrepreneurs" value={audience} onChange={(e) => setAudience(e.target.value)} />
            </Field>
            <div className="row wrap" style={{ gap: 8 }}>
              <Field label="Tone">
                <select className="select" value={tone} onChange={(e) => setTone(e.target.value)}>
                  {TONES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Style">
                <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
                  {TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </Field>
              <Field label="Length">
                <select className="select" value={length} onChange={(e) => setLength(e.target.value)}>
                  <option value="short">Short</option><option value="medium">Medium</option><option value="long">Long</option>
                </select>
              </Field>
            </div>
            <div className="row mt-2">
              <Btn variant="gradient2" onClick={generate} disabled={genBusy}>
                {genBusy ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />} Generate posts
              </Btn>
              <Btn variant="ghost" onClick={getHeadlines} disabled={headBusy}>
                {headBusy ? <Loader2 className="spin" size={16} /> : <Zap size={16} />} Click-bait headlines
              </Btn>
            </div>

            {headlines.length > 0 && (
              <div className="mt-3">
                <div className="faint small mb-2" style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}>Headline ideas</div>
                <div className="col" style={{ gap: 7 }}>
                  {headlines.map((h, i) => (
                    <div key={i} className="row" style={{ background: 'var(--panel)', border: '1px solid var(--stroke)', borderRadius: 10, padding: '9px 12px', fontSize: 13.5 }}>
                      <span className="grow">{h}</span>
                      <Btn variant="ghost" size="sm" style={{ padding: 5 }} onClick={() => { setContent((c) => c + h + '\n\n'); toast('Headline added'); }}>
                        {copied === h ? <Check size={14} style={{ color: 'var(--green)' }} /> : <Copy size={14} />}
                      </Btn>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {gen.length > 0 && (
              <div className="col mt-3">
                {gen.map((g, i) => (
                  <div key={i} className="card" style={{ background: 'rgba(255,255,255,0.03)' }}>
                    <div className="between small">
                      <Chip tone="violet"><Sparkles size={11} /> {g.type} · {g.tone}</Chip>
                      <Btn variant="ghost" size="sm" onClick={() => copy(g.text)}>
                        {copied ? <Check size={13} style={{ color: 'var(--green)' }} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}
                      </Btn>
                    </div>
                    <div className="small mt-2" style={{ lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{g.text}</div>
                    {g.hashtags?.length > 0 && (
                      <div className="row wrap mt-2" style={{ gap: 5 }}>
                        {g.hashtags.map((h: string) => <span key={h} className="chip" style={{ color: 'var(--cyan)', fontSize: 11 }}>{h}</span>)}
                      </div>
                    )}
                    <Btn variant="gradient2" size="sm" className="mt-2" onClick={() => { setContent(g.text + (g.hashtags?.length ? '\n\n' + g.hashtags.join(' ') : '')); toast('Variant loaded into editor'); }}>
                      <Send size={13} /> Use this one
                    </Btn>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-title">Your post</div>
            <textarea className="textarea" style={{ minHeight: 130 }} placeholder="Type your post, or load an AI variant above…" value={content} onChange={(e) => setContent(e.target.value)} />
            <div className="between mt-2">
              <span className="faint small"><Hash size={12} style={{ verticalAlign: '-2px' }} /> {content.length} chars · {channelIds.length ? `shortest limit ${minLimit}` : 'pick channels below'}</span>
              {content.length > minLimit && <Chip tone="red">exceeds limit</Chip>}
            </div>

            <div className="divider" />
            <div className="field">
              <label>Post to</label>
              <div className="row wrap" style={{ gap: 7 }}>
                {available.map((ch) => {
                  const on = channelIds.includes(ch.id);
                  return (
                    <button key={ch.id} className={`chip ${on ? 'grad' : ''}`} style={{ cursor: 'pointer' }} onClick={() => toggleChannel(ch.id)}>
                      <PlatGlyph id={ch.id} size={12} /> {platName(ch.id)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="between">
              <div className="tabs">
                <button className={`tab ${mode === 'now' ? 'active' : ''}`} onClick={() => setMode('now')}>Now</button>
                <button className={`tab ${mode === 'later' ? 'active' : ''}`} onClick={() => setMode('later')}>Schedule</button>
                <button className={`tab ${mode === 'campaign' ? 'active' : ''}`} onClick={() => setMode('campaign')}>Campaign</button>
              </div>
              {mode === 'later' && <input className="input" type="datetime-local" style={{ width: 210 }} value={at} onChange={(e) => setAt(e.target.value)} />}
              {mode === 'campaign' && (
                <select className="select" style={{ width: 210 }} value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
                  <option value="">Attach to campaign…</option>
                  {user.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
            </div>
            <Btn variant="primary" size="lg" className="mt-4" style={{ width: '100%' }} onClick={publish} disabled={!channelIds.length || !content.trim()}>
              <Send size={17} /> {mode === 'later' ? 'Schedule Post' : mode === 'campaign' ? 'Queue to Campaign' : `Publish to ${channelIds.length || 0} channel${channelIds.length === 1 ? '' : 's'}`}
            </Btn>
          </div>
        </div>

        {/* right: preview + queue */}
        <div className="col">
          <div className="card">
            <div className="card-title"><CalendarClock size={16} style={{ color: 'var(--cyan)' }} /> Live preview</div>
            <div className="card-sub">How your post looks on each platform</div>
            <div className="col mt-3">
              {(channelIds.length ? channelIds : user.channels.filter((c) => c.enabled).slice(0, 1).map((c) => c.id)).map((id) => (
                <div className="mock-post" key={id}>
                  <div className="mp-head">
                    <Avatar avatar={user.profile.avatar} size={36} round={11} />
                    <div>
                      <div className="mp-name">{user.name}</div>
                      <div className="mp-handle">{user.channels.find((c) => c.id === id)?.handle || plat(id)?.handleType}</div>
                    </div>
                    <span className="chip" style={{ marginLeft: 'auto', fontSize: 10 }}><PlatGlyph id={id} size={10} /> {platName(id)}</span>
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{content || <span className="faint">Your post preview appears here as you type…</span>}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-title">Queue & drafts <span className="chip sm" style={{ marginLeft: 8 }}>{queue.length}</span></div>
            <div className="col mt-3">
              {queue.length === 0 && <Empty icon="🕐" title="Queue is empty" sub="Scheduled & draft posts will show up here." />}
              {queue.map((p) => (
                <div key={p.id} className="tl-item">
                  <div className="tl-dot" style={{ background: p.status === 'scheduled' ? 'rgba(34,211,238,0.14)' : 'rgba(255,255,255,0.08)', color: p.status === 'scheduled' ? 'var(--cyan)' : 'var(--muted)' }}>
                    <CalendarClock size={15} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="tl-text" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.content.slice(0, 80)}</div>
                    <div className="row small mt-2">
                      {p.channelIds.slice(0, 3).map((id) => <span key={id} className="chip" style={{ padding: '2px 7px', fontSize: 10 }}>{platName(id)}</span>)}
                      <span className="faint" style={{ marginLeft: 'auto' }}>{p.status === 'scheduled' ? fmtTime(p.scheduledAt) : timeAgo(p.createdAt)}</span>
                    </div>
                    <div className="row mt-2" style={{ gap: 6 }}>
                      {p.status === 'scheduled' && <Btn variant="primary" size="sm" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => publishNow(p)}>Post now</Btn>}
                      <Btn variant="ghost" size="sm" style={{ padding: '4px 8px' }} onClick={() => deletePost(p)}><Trash2 size={12} /></Btn>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
