import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Megaphone, PenLine, Users, CalendarClock, TrendingUp, Heart, Eye, Share2, MessageCircle, Rocket, Check, Loader2, Globe, Shield, ExternalLink, RefreshCw, Film } from 'lucide-react';
import { useStore } from '../lib/store';
import { api } from '../lib/api';
import { Btn, Toggle, Chip, Empty, Modal, PlatGlyph } from '../components/ui';
import { AreaChart, Donut, BarRow } from '../components/charts';
import { plat, platName, fmtNum, timeAgo, fmtTime } from '../lib/platforms';
import type { Channel } from '../lib/types';

export default function Dashboard() {
  const { user, dashboard, refresh, refreshDash, toast } = useStore();
  const nav = useNavigate();
  const [connectId, setConnectId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [busyToggle, setBusyToggle] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const growth = useMemo(() => (dashboard?.growth || []).map((g) => ({ label: new Date(g.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), value: g.followers })), [dashboard]);
  const eng = useMemo(() => (dashboard?.growth || []).map((g) => ({ label: new Date(g.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), value: g.engagement })), [dashboard]);

  const toggleChannel = async (ch: Channel, v: boolean) => {
    setBusyToggle(ch.id);
    try {
      await api.updateChannel(ch.id, { enabled: v });
      await refresh();
      if (v && !ch.connected) setConnectId(ch.id);
    } catch (e: any) { toast(e.message, 'bad'); }
    setBusyToggle(null);
  };

  const startOAuth = async () => {
    setConnecting(true);
    try {
      const { url } = await api.oauthAuthorize(connectId!);
      const popup = window.open(url, 'oauth-popup', 'width=600,height=700');
      if (!popup) {
        toast('Popup blocked! Allow popups for OAuth.', 'bad');
        setConnecting(false);
        return;
      }
      const timeout = setTimeout(() => {
        window.removeEventListener('message', handler);
        if (!popup.closed) popup.close();
        setConnecting(false);
        toast('OAuth timed out — please try again', 'bad');
      }, 180_000);
      const handler = (e: MessageEvent) => {
        if (e.data?.type === 'OAUTH_SUCCESS' && e.data?.platform === connectId) {
          window.removeEventListener('message', handler);
          clearTimeout(timeout);
          popup.close();
          setConnecting(false);
          setConnectId(null);
          refresh(); refreshDash();
          toast(`${platName(connectId!)} connected via OAuth 🔐`);
        }
      };
      window.addEventListener('message', handler);
    } catch (e: any) {
      toast(e.message, 'bad');
      setConnecting(false);
    }
  };

  const isOAuth1a = (pid: string) => {
    const extra = user?.platformCredentials?.[pid]?.extra;
    return !!(extra?.consumerKey && extra?.accessToken);
  };

  const connect = async () => {
    const creds = user?.platformCredentials?.[connectId!];
    // OAuth 1.0a: tokens are provided directly — skip popup, mark connected
    if (creds?.configured && !isOAuth1a(connectId!)) {
      await startOAuth();
      return;
    }
    setConnecting(true);
    setTimeout(async () => {
      try {
        await api.updateChannel(connectId!, { connected: true });
        // Attempt to fetch real profile data (silently fails if no OAuth token)
        try { await api.oauthAutoConfigure(connectId!); } catch {}
        await refresh(); await refreshDash();
        toast(platName(connectId!) + ' connected \u26a1');
        setConnectId(null);
      } catch (e: any) { toast(e.message, 'bad'); }
      setConnecting(false);
    }, 1600);
  };

  const resync = async (id: string) => {
    setSyncingId(id);
    try {
      await api.oauthAutoConfigure(id);
      await refresh(); await refreshDash();
      toast(`${platName(id)} profile synced 🔄`);
    } catch (e: any) { toast(e.message || 'Sync failed', 'bad'); }
    setSyncingId(null);
  };

  const disconnect = async (id: string) => {
    const creds = user?.platformCredentials?.[id];
    // OAuth 1.0a doesn't use OAuth 2.0 tokens — just mark disconnected
    if (creds?.configured && !isOAuth1a(id)) {
      await api.oauthDisconnect(id);
    } else {
      await api.updateChannel(id, { connected: false });
    }
    await refresh(); await refreshDash();
    toast(`${platName(id)} disconnected`, 'bad');
  };

  if (!user || !dashboard) return <Empty icon="⏳" title="Loading your empire…" />;

  const connectCh = user.channels.find((c) => c.id === connectId);
  const socialChannels = user.channels;
  const firstName = user.name.split(' ')[0];
  const isRealOAuth = !!(connectCh && user.platformCredentials?.[connectCh.id]?.configured && !isOAuth1a(connectCh.id));
  const isOAuth1aConfigured = !!(connectCh && user.platformCredentials?.[connectCh.id]?.configured && isOAuth1a(connectCh.id));
  const MEDIA_ONLY_IDS = ['tiktok', 'instagram', 'pinterest', 'youtube'];
  const isMediaOnly = !!(connectCh && MEDIA_ONLY_IDS.includes(connectCh.id) && user.platformCredentials?.[connectCh.id]?.configured);

  return (
    <div>
      <div className="hero fade-up">
        <div className="row" style={{ gap: 10, marginBottom: 12 }}>
          <Chip tone="grad"><Rocket size={12} /> AUTOPILOT READY</Chip>
          {dashboard.activeCampaigns > 0 && <Chip tone="green"><span className="badge-dot" /> {dashboard.activeCampaigns} live campaign{dashboard.activeCampaigns > 1 ? 's' : ''}</Chip>}
        </div>
        <h1>Welcome back, {firstName} <span className="sparkle">✨</span></h1>
        <p>
          Your fame engine is running — {dashboard.channelsConnected} of {dashboard.channelsEnabled} channels connected,
          {dashboard.postsScheduled} posts queued, {dashboard.totalFollowers.toLocaleString()} followers and counting.
        </p>
        <div className="hero-actions">
          <Btn variant="primary" onClick={() => nav('/campaigns')}><Megaphone size={17} /> New Campaign</Btn>
          <Btn variant="gradient2" onClick={() => nav('/composer')}><PenLine size={17} /> Quick Post</Btn>
          <Btn variant="ghost" onClick={() => nav('/website')}><Globe size={17} /> My Website</Btn>
        </div>
      </div>

      {/* stats */}
      <div className="grid stats fade-up" style={{ animationDelay: '0.08s' }}>
        <div className="card stat-card hoverable">
          <div className="stat-icon" style={{ background: 'var(--grad)', color: '#fff' }}><TrendingUp size={18} /></div>
          <div className="stat-value">{dashboard.fameScore}<span style={{ fontSize: 16, color: 'var(--pink)' }}>%</span></div>
          <div className="stat-label">Fame Score</div>
        </div>
        <div className="card stat-card hoverable">
          <div className="stat-icon" style={{ background: '#0A66C2', color: '#fff' }}><Users size={18} /></div>
          <div className="stat-value">{fmtNum(dashboard.totalFollowers)}</div>
          <div className="stat-label">Total Audience</div>
        </div>
        <div className="card stat-card hoverable">
          <div className="stat-icon" style={{ background: '#34d399', color: '#0b0b18' }}><Eye size={18} /></div>
          <div className="stat-value">{fmtNum(dashboard.reach)}</div>
          <div className="stat-label">Content Reach</div>
        </div>
        <div className="card stat-card hoverable">
          <div className="stat-icon" style={{ background: '#a855f7', color: '#fff' }}><Heart size={18} /></div>
          <div className="stat-value">{dashboard.engagementRate.toFixed(1)}%</div>
          <div className="stat-label">Engagement Rate</div>
        </div>
        <div className="card stat-card hoverable">
          <div className="stat-icon" style={{ background: '#ff7a18', color: '#fff' }}><CalendarClock size={18} /></div>
          <div className="stat-value">{dashboard.postsScheduled}</div>
          <div className="stat-label">Posts Scheduled</div>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 1fr)', marginTop: 16 }}>
        {/* growth chart */}
        <div className="card">
          <div className="between">
            <div>
              <div className="card-title">Audience Growth</div>
              <div className="card-sub">Followers across all platforms · last 14 days</div>
            </div>
            <Chip tone="grad"><span className="badge-dot" style={{ background: '#fff' }} /> live</Chip>
          </div>
          <div className="mt-4"><AreaChart data={growth} height={150} color="#ff2d78" format={fmtNum} /></div>
          <div className="divider" />
          <div className="between small">
            <span className="muted">Engagement (likes + comments + shares)</span>
            <b className="muted">per day</b>
          </div>
          <div className="mt-3"><AreaChart data={eng} height={70} color="#22d3ee" /></div>
        </div>

        {/* fame score */}
        <div className="card">
          <div className="card-title">Your Fame Score</div>
          <div className="card-sub">Built from connections, content, & profile completeness</div>
          <div className="fame-wrap mt-4" style={{ justifyContent: 'center', padding: '12px 0' }}>
            <Donut value={dashboard.fameScore}>
              <div>
                <b>{dashboard.fameScore}</b>
                <span>fame</span>
              </div>
            </Donut>
          </div>
          <div className="mt-4" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { l: 'Channels connected', v: dashboard.channelsConnected },
              { l: 'Posts published', v: dashboard.postsPublished },
              { l: 'Active campaigns', v: dashboard.activeCampaigns },
              { l: 'Engagement rate', v: dashboard.engagementRate.toFixed(1) + '%' },
            ].map((s) => (
              <div key={s.l} style={{ background: 'var(--panel)', border: '1px solid var(--stroke)', borderRadius: 12, padding: '10px 12px' }}>
                <div className="faint small">{s.l}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 19 }}>{s.v}</div>
              </div>
            ))}
          </div>
          <Btn variant="primary" className="mt-4" style={{ width: '100%' }} onClick={() => nav('/composer')}>
            <PenLine size={16} /> Post to Boost Your Score
          </Btn>
        </div>
      </div>

      {/* channels */}
      <div className="page-head" style={{ marginBottom: 14 }}>
        <div>
          <h3 style={{ fontSize: 20 }}>Your Channels</h3>
          <div className="muted small mt-2">Toggle any channel on or off — scheduling & campaigns follow your switches instantly.</div>
        </div>
      </div>
      <div className="grid channels">
        {user.channels.map((ch) => {
          const p = plat(ch.id);
          const hasApi = user.platformCredentials?.[ch.id]?.configured;
          return (
            <div className={`card channel-card ${ch.enabled ? '' : ''}`} key={ch.id} style={{ opacity: ch.enabled ? 1 : 0.55 }}>
              <div className="channel-top">
                <PlatGlyph id={ch.id} size={20} />
                <div className="channel-meta">
                  <div className="channel-name">{p?.name}
                    {ch.connected && <span className="badge-dot" style={{ background: hasApi ? 'var(--cyan)' : 'var(--green)', boxShadow: hasApi ? '0 0 8px var(--cyan)' : '0 0 8px var(--green)' }} />}
                    {hasApi && !ch.connected && <span className="chip sm" style={{ marginLeft: 6, fontSize: 9, padding: '2px 7px' }}>API ready</span>}
                  </div>
                  <div className="channel-handle">{ch.handle || p?.handleType || 'Not connected'}</div>
                </div>
                {busyToggle === ch.id ? <Loader2 className="spin" size={18} style={{ color: 'var(--muted)' }} /> : (
                  <Toggle checked={ch.enabled} onChange={(v) => toggleChannel(ch, v)} />
                )}
              </div>
              <div className="channel-foot">
                <span className="channel-followers"><Users size={13} /> {fmtNum(ch.followers)} followers</span>
                <div className="row" style={{ gap: 6 }}>
                  {ch.connected && hasApi && (
                    <button
                      className="btn ghost sm"
                      style={{ fontSize: 11 }}
                      disabled={syncingId === ch.id}
                      onClick={() => resync(ch.id)}
                      title="Re-fetch profile & stats from API"
                    >
                      {syncingId === ch.id ? <Loader2 className="spin" size={12} /> : <RefreshCw size={12} />}
                    </button>
                  )}
                  {ch.connected ? (
                    <Btn variant="ghost" size="sm" onClick={() => disconnect(ch.id)}>Disconnect</Btn>
                  ) : (
                    <Btn variant="primary" size="sm" disabled={!ch.enabled} onClick={() => setConnectId(ch.id)}>Connect</Btn>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)', marginTop: 16 }}>
        {/* upcoming */}
        <div className="card">
          <div className="between">
            <div className="card-title"><CalendarClock size={16} style={{ color: 'var(--cyan)' }} /> Up Next</div>
            <Btn variant="ghost" size="sm" onClick={() => nav('/composer')}>Schedule</Btn>
          </div>
          <div className="mt-3 col">
            {dashboard.upcoming.length === 0 && dashboard.nextCampaignRuns.length === 0 && (
              <Empty icon="🗓️" title="Nothing queued yet" sub="Create a campaign or schedule a post to start the buzz." />
            )}
            {dashboard.upcoming.map((p) => (
              <div key={p.id} className="tl-item">
                <div className="tl-dot" style={{ background: 'rgba(34,211,238,0.14)', color: 'var(--cyan)' }}><CalendarClock size={15} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="tl-text" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.content.slice(0, 90)}</div>
                  <div className="row small mt-2">
                    {p.channelIds.map((id) => <span key={id} className="chip sm" style={{ padding: '3px 8px' }}><PlatGlyph id={id} size={11} /> {platName(id)}</span>)}
                    <span className="faint" style={{ marginLeft: 'auto' }}>{fmtTime(p.scheduledAt)}</span>
                  </div>
                </div>
              </div>
            ))}
            {dashboard.nextCampaignRuns.map((c) => (
              <div key={c.id} className="tl-item">
                <div className="tl-dot" style={{ background: 'rgba(255,45,120,0.14)', color: 'var(--pink)' }}><Megaphone size={15} /></div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="tl-text">Campaign <b>{c.name}</b> fires <b>{fmtTime(c.at)}</b></div>
                  <div className="faint small mt-2">Auto-posting to {c.channels} channel{c.channels > 1 ? 's' : ''} · AI content</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* activity */}
        <div className="card">
          <div className="card-title"><TrendingUp size={16} style={{ color: 'var(--pink)' }} /> Activity Feed</div>
          <div className="card-sub">Everything your fame machine is doing</div>
          <div className="timeline mt-3">
            {dashboard.activity.length === 0 && <Empty icon="📡" title="No activity yet" sub="Connect a channel or run a campaign." />}
            {dashboard.activity.map((a) => (
              <div key={a.id} className="tl-item">
                <div className="tl-dot" style={{ background: a.kind === 'post' ? 'rgba(52,211,153,0.14)' : 'rgba(168,85,247,0.14)', color: a.kind === 'post' ? 'var(--green)' : 'var(--violet)' }}>
                  {a.kind === 'post' ? <Check size={15} /> : <Rocket size={15} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div className="tl-text">{a.message}</div>
                  <div className="tl-time">{timeAgo(a.at)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* channel breakdown */}
      <div className="card mt-4">
        <div className="card-title">Audience Breakdown</div>
        <div className="card-sub">Followers per connected platform</div>
        <div className="mt-4" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px 28px' }}>
          {socialChannels.map((ch) => (
            <BarRow key={ch.id} label={platName(ch.id)} value={ch.followers} max={Math.max(...socialChannels.map((c) => c.followers), 1)}
              color={plat(ch.id)?.color} icon={<PlatGlyph id={ch.id} size={13} />} />
          ))}
        </div>
      </div>

      {/* connect modal */}
      {connectCh && (
        <Modal title={<span style={{ display: 'flex', alignItems: 'center', gap: 9 }}><PlatGlyph id={connectCh.id} size={17} /> Connect {platName(connectCh.id)}</span>} onClose={() => setConnectId(null)}>
          {!connecting ? (
            <div className="col">
              <div className="card" style={{ background: 'rgba(255,255,255,0.03)' }}>
                {isRealOAuth ? (
                  <>
                    <div className="card-title"><Shield size={14} style={{ color: 'var(--cyan)' }} /> Real OAuth connection</div>
                    <div className="card-sub" style={{ lineHeight: 1.7 }}>
                      FameForge will open <b>{platName(connectCh.id)}'s official authorization page</b> in a popup. After you approve, FameForge can post directly to your {platName(connectCh.id)} account via their API.
                    </div>
                    <div className="divider" />
                    <div className="col small muted">
                      <span>🔐 <b>OAuth 2.0</b> — industry-standard secure authorization</span>
                      <span>✅ <b>Post</b> — create tweets, posts, and updates on your behalf</span>
                      <span>🔒 <b>Revocable</b> — disconnect anytime; we never see your password</span>
                    </div>
                  </>
                ) : isMediaOnly ? (
                  <>
                    <div className="card-title">
                      <Film size={14} style={{ color: 'var(--amber)' }} /> {platName(connectCh.id)} media-only platform
                    </div>
                    <div className="card-sub" style={{ lineHeight: 1.7 }}>
                      <b>{platName(connectCh.id)}</b> is connected via OAuth, but text-only posts aren't supported{connectCh.id === 'tiktok' ? ' — TikTok requires video files.' : connectCh.id === 'instagram' ? ' — Instagram requires images or videos.' : connectCh.id === 'pinterest' ? ' — Pinterest requires images or links.' : ' — the YouTube Community Posts API is not publicly available for text.'} FameForge can still <b>fetch your profile info, follower count, and analytics</b> automatically.
                    </div>
                    <div className="divider" />
                    <div className="col small muted">
                      {connectCh.id === 'tiktok' && (
                        <>
                          <span>🎬 <b>Video-first</b> — TikTok's Content Posting API requires a video file; text-only posts aren't supported</span>
                          <span>🧪 <b>Sandbox mode</b> — TikTok developer apps are limited to 5 test accounts until passing TikTok's audit</span>
                        </>
                      )}
                      {connectCh.id === 'instagram' && (
                        <span>📸 <b>Image/video required</b> — Instagram's Graph API doesn't support text-only posts</span>
                      )}
                      {connectCh.id === 'pinterest' && (
                        <span>📌 <b>Pin requires media</b> — Pins need an image URL or link; text-only Pins aren't supported</span>
                      )}
                      {connectCh.id === 'youtube' && (
                        <span>▶️ <b>Community Posts</b> — the YouTube v3 Community Posts API endpoint is not publicly available</span>
                      )}
                      <span>📊 <b>Profile sync</b> — auto-fetches your handle, followers, and stats on connect</span>
                      <span>🔄 <b>Re-sync anytime</b> — use the refresh button on your channel card to pull latest stats</span>
                    </div>
                  </>
                ) : isOAuth1aConfigured ? (
                  <>
                    <div className="card-title"><Shield size={14} style={{ color: 'var(--cyan)' }} /> OAuth 1.0a keys configured</div>
                    <div className="card-sub" style={{ lineHeight: 1.7 }}>
                      Your <b>OAuth 1.0a Consumer Key & Access Token</b> are configured for {platName(connectCh.id)}. No browser authorization is needed — FameForge will sign API requests directly using your keys.
                    </div>
                    <div className="divider" />
                    <div className="col small muted">
                      <span>🔑 <b>OAuth 1.0a</b> — legacy user-key authentication</span>
                      <span>✅ <b>Post tweets</b> — using your configured API keys & tokens</span>
                      <span>🔒 <b>Stored locally</b> — keys never leave your server</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="card-sub" style={{ lineHeight: 1.7 }}>
                      You're about to connect <b>{platName(connectCh.id)}</b> to FameForge. This simulates the official OAuth flow —
                      in production this grants FameForge permission to post on your behalf and read your analytics.
                    </div>
                    <div className="divider" />
                    <div className="col small muted">
                      <span>✅ <b>Read</b> — profile, followers, post analytics</span>
                      <span>✅ <b>Write</b> — create & schedule posts, update your bio</span>
                      <span>🔒 <b>Never</b> — we don't access messages or change your password</span>
                    </div>
                    <div className="mt-3" style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.25)', borderRadius: 10, padding: 10 }}>
                      <div className="small muted" style={{ lineHeight: 1.5 }}>
                        💡 <b>Want to post for real?</b> Add your {platName(connectCh.id)} developer app credentials in <b>Settings → Platform API Keys</b> to enable real OAuth posting.
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="between">
                <Btn variant="ghost" onClick={() => setConnectId(null)}>Cancel</Btn>
                <Btn variant="primary" onClick={connect}>
                  {isRealOAuth ? <><ExternalLink size={16} /> Authorize via {platName(connectCh.id)}</> : isMediaOnly ? <><Check size={16} /> Connect & Sync {platName(connectCh.id)}</> : <><Check size={16} /> Connect {platName(connectCh.id)}</>}
                </Btn>
              </div>
            </div>
          ) : (
            <div className="empty">
              <Loader2 className="spin" size={38} style={{ color: 'var(--pink)', margin: '0 auto 14px' }} />
              <div style={{ fontWeight: 600 }}>{isRealOAuth ? `Opening ${platName(connectCh.id)} authorization…` : isMediaOnly ? `Syncing ${platName(connectCh.id)} profile…` : isOAuth1aConfigured ? `Connecting ${platName(connectCh.id)} with your keys…` : `Connecting to ${platName(connectCh.id)}…`}</div>
              <div className="muted small mt-2">
                {isRealOAuth ? 'Complete the authorization in the popup window' : isMediaOnly ? <>Fetching your profile & latest stats from {platName(connectCh.id)} <span className="dot-flash" /></> : isOAuth1aConfigured ? <>Authenticating with your OAuth 1.0a tokens <span className="dot-flash" /></> : <>Handshaking with {platName(connectCh.id)} servers <span className="dot-flash" /></>}
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
