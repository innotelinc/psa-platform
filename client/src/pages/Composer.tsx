import { useMemo, useState } from 'react';
import { Sparkles, Send, CalendarClock, Wand2, Hash, Loader2, Copy, Check, Trash2, Zap, AlertTriangle, RefreshCcw } from 'lucide-react';
import { useStore } from '../lib/store';
import { api } from '../lib/api';
import { fallbackPost, fallbackHeadlines } from '../lib/ai';
import { Btn, Field, Chip, Empty, PlatGlyph, Avatar, Modal } from '../components/ui';
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
  const [resultPost, setResultPost] = useState<Post | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [resendingAll, setResendingAll] = useState(false);
  const [publishingDrafts, setPublishingDrafts] = useState(false);

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
    setPublishing(true);
    try {
      // publish:true makes the server actually send immediately (mode 'now');
      // otherwise the post stays queued as scheduled/draft.
      const created = await api.createPost({
        channelIds, content, scheduledAt,
        campaignId: mode === 'campaign' ? campaignId : null,
        publish: !scheduledAt && mode === 'now',
      });
      if (scheduledAt) {
        toast(`Queued for ${fmtTime(scheduledAt)} 🕐`);
      } else if (mode === 'campaign') {
        toast('Saved to campaign queue 🎯');
      } else {
        showResult(created);
      }
      setContent(''); setChannelIds([]); setGen([]);
      await refresh(); await refreshDash();
    } catch (e: any) {
      toast(e?.message || 'Publish failed', 'bad');
    } finally {
      setPublishing(false);
    }
  };

  // Per-channel confirmation after a publish/resend attempt
  const showResult = (post: Post) => {
    setResultPost(post);
    const results = post.results || [];
    const sent = results.filter((r) => r.ok).length;
    const simulated = results.filter((r) => !r.ok && !r.error).length;
    const failed = results.filter((r) => r.error).length;
    const summary = [sent && `${sent} sent`, simulated && `${simulated} simulated`, failed && `${failed} failed`].filter(Boolean).join(', ');
    const nothingSent = sent === 0 && simulated === 0;
    toast(summary ? `Post: ${summary}` : 'Post not sent', failed || nothingSent ? 'bad' : 'good');
  };

  const deletePost = async (p: Post) => {
    if ((p.status === 'published' || p.status === 'failed') && !confirm('Remove this post from your history? (Already-sent posts stay live on the platform.)')) return;
    await api.deletePost(p.id);
    if (resultPost?.id === p.id) setResultPost(null);
    toast('Post deleted');
    await refresh(); await refreshDash();
  };

  // Publish/resend a queued or previously-published post, then show the confirmation
  const publishNow = async (p: Post) => {
    try {
      const updated = await api.publishPost(p.id);
      showResult(updated);
      await refresh(); await refreshDash();
    } catch (e: any) {
      toast(e?.message || 'Publish failed', 'bad');
    }
  };

  // Full post history — scheduled first, then newest first; every post is resendable/deletable
  const history = useMemo(() => {
    const all = [...user.posts];
    return all.sort((a, b) => {
      const aSched = a.status === 'scheduled' ? a.scheduledAt || Infinity : Infinity;
      const bSched = b.status === 'scheduled' ? b.scheduledAt || Infinity : Infinity;
      if (aSched !== bSched) return aSched - bSched;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }, [user]);

  const failedPosts = useMemo(() => history.filter((p) => p.status === 'failed'), [history]);
  const draftPosts = useMemo(() => history.filter((p) => p.status === 'draft'), [history]);

  // Publish every draft post in one go
  const publishAllDrafts = async () => {
    if (!draftPosts.length) return;
    if (!confirm(`Publish ${draftPosts.length} draft${draftPosts.length === 1 ? '' : 's'} now?`)) return;
    setPublishingDrafts(true);
    try {
      const { published, failed } = await api.publishDrafts();
      await refresh(); await refreshDash();
      if (published) toast(`Published ${published} post${published === 1 ? '' : 's'} ✅`, 'good');
      if (failed) toast(`${failed} failed — check the errors below`, 'bad');
      if (!published && !failed) toast('No drafts to publish');
    } catch (e: any) {
      toast(e?.message || 'Publish failed', 'bad');
    } finally {
      setPublishingDrafts(false);
    }
  };

  // Retry every failed post in one go (batch endpoint on the server)
  const resendAllFailed = async () => {
    if (!failedPosts.length) return;
    if (!confirm(`Resend ${failedPosts.length} failed post${failedPosts.length === 1 ? '' : 's'} now?`)) return;
    setResendingAll(true);
    try {
      const { resent, stillFailed } = await api.resendFailedPosts();
      await refresh(); await refreshDash();
      if (resent) toast(`Resent ${resent} post${resent === 1 ? '' : 's'} ✅`, 'good');
      if (stillFailed) toast(`${stillFailed} still failed — check the errors below`, 'bad');
      if (!resent && !stillFailed) toast('No failed posts to resend');
    } catch (e: any) {
      toast(e?.message || 'Resend failed', 'bad');
    } finally {
      setResendingAll(false);
    }
  };

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
            <Btn variant="primary" size="lg" className="mt-4" style={{ width: '100%' }} onClick={publish} disabled={!channelIds.length || !content.trim() || publishing}>
              {publishing ? <Loader2 className="spin" size={17} /> : <Send size={17} />} {mode === 'later' ? 'Schedule Post' : mode === 'campaign' ? 'Queue to Campaign' : `Publish to ${channelIds.length || 0} channel${channelIds.length === 1 ? '' : 's'}`}
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
            <div className="between" style={{ alignItems: 'flex-start' }}>
              <div className="card-title" style={{ marginBottom: 0 }}>Posts & history <span className="chip sm" style={{ marginLeft: 8 }}>{history.length}</span></div>
              <div className="row" style={{ gap: 6 }}>
                {draftPosts.length > 0 && (
                  <Btn variant="primary" size="sm" onClick={publishAllDrafts} disabled={publishingDrafts} title={`Publish ${draftPosts.length} draft${draftPosts.length === 1 ? '' : 's'} now`}>
                    {publishingDrafts ? <Loader2 className="spin" size={13} /> : <Send size={13} />} Publish {draftPosts.length} draft{draftPosts.length === 1 ? '' : 's'}
                  </Btn>
                )}
                {failedPosts.length > 0 && (
                  <Btn variant="primary" size="sm" onClick={resendAllFailed} disabled={resendingAll} title={`Retry ${failedPosts.length} failed post${failedPosts.length === 1 ? '' : 's'}`}>
                    {resendingAll ? <Loader2 className="spin" size={13} /> : <RefreshCcw size={13} />} Resend {failedPosts.length} failed
                  </Btn>
                )}
              </div>
            </div>
            <div className="card-sub">Scheduled, drafts and published — resend or delete any post.</div>
            <div className="col mt-3">
              {history.length === 0 && <Empty icon="🕐" title="No posts yet" sub="Scheduled & draft posts will show up here." />}
              {history.map((p) => {
                const dotTone =
                  p.status === 'published' ? 'rgba(52,211,153,0.14)' :
                  p.status === 'failed' ? 'rgba(239,68,68,0.14)' :
                  p.status === 'scheduled' ? 'rgba(34,211,238,0.14)' : 'rgba(255,255,255,0.08)';
                const dotColor =
                  p.status === 'published' ? 'var(--green)' :
                  p.status === 'failed' ? '#f87171' :
                  p.status === 'scheduled' ? 'var(--cyan)' : 'var(--muted)';
                return (
                  <div key={p.id} className="tl-item">
                    <div className="tl-dot" style={{ background: dotTone, color: dotColor }}>
                      {p.status === 'published' ? <Check size={15} /> : p.status === 'failed' ? <AlertTriangle size={15} /> : <CalendarClock size={15} />}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="tl-text" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.content.slice(0, 80)}</div>
                      <div className="row small mt-2 wrap" style={{ gap: 4 }}>
                        {p.channelIds.map((id) => {
                          const r = p.results?.find((x) => x.channelId === id);
                          const tone = !r ? 'blue' : r.ok ? 'green' : r.error ? 'red' : 'orange';
                          return (
                            <span key={id} className={`chip ${tone}`} style={{ padding: '2px 7px', fontSize: 10 }} title={r?.error || ''}>
                              {r ? (r.ok ? '✅' : r.error ? '❌' : '⚠️') : '•'} {platName(id)}
                            </span>
                          );
                        })}
                        <span className="faint" style={{ marginLeft: 'auto' }}>
                          {p.status === 'scheduled' ? fmtTime(p.scheduledAt) : p.publishedAt ? timeAgo(p.publishedAt) : timeAgo(p.createdAt)}
                        </span>
                      </div>
                      <div className="row mt-2" style={{ gap: 6 }}>
                        {(p.status === 'scheduled' || p.status === 'draft') && (
                          <Btn variant="primary" size="sm" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => publishNow(p)}>Post now</Btn>
                        )}
                        {p.status === 'failed' && (
                          <Btn variant="primary" size="sm" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => publishNow(p)}><RefreshCcw size={11} /> Resend</Btn>
                        )}
                        {p.status === 'published' && (
                          <Btn variant={p.results?.some((r) => r.error) ? 'primary' : 'ghost'} size="sm" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => publishNow(p)}>
                            <RefreshCcw size={11} /> {p.results?.some((r) => r.error) ? 'Resend' : 'Repost'}
                          </Btn>
                        )}
                        <Btn variant="ghost" size="sm" style={{ padding: '4px 8px' }} onClick={() => deletePost(p)}><Trash2 size={12} /></Btn>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* post result confirmation — per-channel sent/simulated/failed + resend/delete */}
      {resultPost && (
        <Modal
          title={<span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <Send size={16} style={{ color: resultPost.status === 'failed' ? '#f87171' : 'var(--pink)' }} />
            Post {resultPost.status === 'failed' ? 'failed' : 'result'}
          </span>}
          onClose={() => setResultPost(null)}
          wide
        >
          <div className="small" style={{ whiteSpace: 'pre-wrap', background: 'var(--panel)', border: '1px solid var(--stroke)', borderRadius: 10, padding: '10px 12px', marginBottom: 14, maxHeight: 120, overflow: 'auto' }}>
            {resultPost.content}
          </div>
          <div className="col" style={{ gap: 8 }}>
            {(resultPost.results || []).map((r) => (
              <div key={r.channelId} className="row" style={{ background: 'var(--panel)', border: '1px solid var(--stroke)', borderRadius: 10, padding: '10px 12px' }}>
                <PlatGlyph id={r.channelId} size={15} />
                <span style={{ fontWeight: 600, fontSize: 13.5 }}>{platName(r.channelId)}</span>
                <span style={{ marginLeft: 'auto' }}>
                  {r.ok
                    ? <Chip tone="green">✅ Sent via API</Chip>
                    : r.error
                      ? <Chip tone="red">❌ Failed</Chip>
                      : <Chip tone="orange">⚠️ Simulated</Chip>}
                </span>
              </div>
            ))}
          </div>
          {(resultPost.results || []).some((r) => r.error) && (
            <div className="small mt-3" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 10, padding: '10px 12px', lineHeight: 1.6 }}>
              {(resultPost.results || []).filter((r) => r.error).map((r) => (
                <div key={r.channelId} style={{ color: 'var(--muted)' }}>
                  <b style={{ color: '#fca5a5' }}>{platName(r.channelId)}:</b> {r.error}
                </div>
              ))}
            </div>
          )}
          <div className="faint small mt-3">⚠️ Simulated = no live API credentials (or media-only platform), so nothing was actually posted there.</div>
          <div className="row mt-3" style={{ justifyContent: 'flex-end', gap: 8 }}>
            {(resultPost.status === 'failed' || (resultPost.results || []).some((r) => r.error)) && (
              <Btn variant="primary" size="sm" onClick={() => publishNow(resultPost)}><RefreshCcw size={13} /> Resend</Btn>
            )}
            <Btn variant="ghost" size="sm" onClick={() => deletePost(resultPost)}><Trash2 size={13} /> Delete post</Btn>
            <Btn variant="ghost" size="sm" onClick={() => setResultPost(null)}>Done</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
