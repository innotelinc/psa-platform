// FameForge API server
import express from 'express';
import cors from 'cors';
import crypto from 'node:crypto';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { addUser, getUsers, updateUser, defaultState, PLATFORMS, save } from './store.js';
import * as ai from './aiEngine.js';
import { buildAuthorizeUrl, handleCallback, getConnectionStatus, disconnectPlatform, saveCredentials } from './oauth.js';
import { postToPlatform } from './postEngine.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const PUBLIC_URL = process.env.PUBLIC_URL || `http://localhost:${PORT}`;
const STATIC_DIR = process.env.STATIC_DIR || join(__dirname, 'public');
const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));



// ------------------------------------------------------------------ helpers
const uid = () => crypto.randomUUID();
const hash = (pw, salt) => crypto.scryptSync(pw, salt, 32).toString('hex');
const authed = (req, res, next) => {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const user = Object.values(getUsers()).find((u) => u.token === token);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  req.user = user;
  next();
};

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// ------------------------------------------------------------------ auth
app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
  const existing = Object.values(getUsers()).find((u) => u.email === email.toLowerCase());
  if (existing) return res.status(409).json({ error: 'An account with this email already exists' });
  const salt = uid();
  const user = {
    id: uid(),
    name, email: email.toLowerCase(),
    salt, hash: hash(password, salt),
    token: uid(),
    ...defaultState(name, email),
  };
  addUser(user);
  res.json({ token: user.token, user: publicUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = Object.values(getUsers()).find((u) => u.email === (email || '').toLowerCase());
  if (!user || user.hash !== hash(password || '', user.salt)) return res.status(401).json({ error: 'Invalid email or password' });
  user.token = uid();
  save();
  res.json({ token: user.token, user: publicUser(user) });
});

app.post('/api/auth/forgot-password', (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email is required' });
  const user = Object.values(getUsers()).find((u) => u.email === (email || '').toLowerCase());
  if (!user) return res.status(404).json({ error: 'No account found with that email' });
  // For self-hosted: generate a new random password and return it
  const newPassword = uid().slice(0, 12);
  user.salt = uid();
  user.hash = hash(newPassword, user.salt);
  user.token = uid();
  save();
  res.json({ message: 'Password has been reset', newPassword });
});

app.post('/api/auth/change-password', authed, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current password and new password are required' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });
  if (req.user.hash !== hash(currentPassword, req.user.salt)) return res.status(401).json({ error: 'Current password is incorrect' });
  req.user.salt = uid();
  req.user.hash = hash(newPassword, req.user.salt);
  save();
  res.json({ message: 'Password changed successfully' });
});

app.get('/api/auth/me', authed, (req, res) => res.json({ user: publicUser(req.user) }));

const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email });

// ------------------------------------------------------------------ state
app.get('/api/state', authed, (req, res) => {
  res.json(sanitize(req.user));
});

app.put('/api/state', authed, (req, res) => {
  const { profile, settings, resume, site } = req.body || {};
  if (profile) req.user.profile = { ...req.user.profile, ...profile };
  if (settings) req.user.settings = deepMerge(req.user.settings, settings);
  if (resume) req.user.resume = { ...req.user.resume, ...resume };
  if (site) req.user.site = { ...req.user.site, ...site };
  save();
  res.json(sanitize(req.user));
});

const deepMerge = (a, b) => {
  const out = { ...a };
  for (const k of Object.keys(b || {})) {
    out[k] = b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object'
      ? deepMerge(a[k], b[k]) : b[k];
  }
  return out;
};

const sanitize = (u) => {
  // Mask platform credentials — only show whether they're configured, not the values
  const maskedCreds = {};
  if (u.platformCredentials) {
    for (const [pid, cred] of Object.entries(u.platformCredentials)) {
      maskedCreds[pid] = {
        configured: !!(cred.clientId),
        extra: cred.extra || {},
      };
    }
  }
  // Strip OAuth tokens from channels before sending to client
  const safeChannels = (u.channels || []).map((ch) => {
    const { oauth, ...safe } = ch;
    return safe;
  });
  return {
    id: u.id, name: u.name, email: u.email,
    channels: safeChannels, profile: u.profile, settings: u.settings,
    resume: u.resume, site: u.site, campaigns: u.campaigns, posts: u.posts,
    activity: u.activity, fame: u.fame,
    platformCredentials: maskedCreds,
  };
};

// ------------------------------------------------------------------ channels
app.put('/api/channels/:id', authed, (req, res) => {
  const ch = req.user.channels.find((c) => c.id === req.params.id);
  if (!ch) return res.status(404).json({ error: 'Channel not found' });
  Object.assign(ch, req.body || {});
  if (req.body?.connected === true && !ch.handle) ch.handle = '@' + (req.user.name || 'you').toLowerCase().replace(/\s+/g, '') + '_' + ch.id.slice(0, 2);
  if (req.body?.connected !== undefined) log(req.user, req.body.connected ? `Connected ${platformName(ch.id)}` : `Disconnected ${platformName(ch.id)}`, 'channel');
  save();
  res.json(ch);
});

app.put('/api/channels', authed, (req, res) => {
  const map = Object.fromEntries((req.body || []).map((c) => [c.id, c]));
  for (const ch of req.user.channels) {
    const patch = map[ch.id];
    if (patch) Object.assign(ch, patch);
  }
  save();
  res.json(req.user.channels);
});

// ------------------------------------------------------------------ OAuth
const REDIRECT_BASE = process.env.OAUTH_REDIRECT_BASE || PUBLIC_URL;

// Start OAuth flow — returns the URL the frontend should redirect to
app.post('/api/oauth/:platform/authorize', authed, (req, res) => {
  const { platform } = req.params;
  try {
    const url = buildAuthorizeUrl(req.user.id, platform, REDIRECT_BASE);
    res.json({ url });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// OAuth callback — the provider redirects here after user authorization
app.get('/api/oauth/:platform/callback', async (req, res) => {
  const { platform } = req.params;
  const { code, state, error, error_description } = req.query;

  // Validate platform param is a known, safe value
  if (!/^[a-z]+$/.test(platform)) {
    return res.status(400).send('Invalid platform');
  }

  if (error) {
    return res.send(`
      <!doctype html><html><head><title>Connection Failed</title>
      <style>body{font-family:system-ui;background:#0b0b18;color:#f5f5fb;display:grid;place-items:center;min-height:100vh;text-align:center}
      h1{color:#f87171}.btn{display:inline-block;margin-top:20px;padding:12px 24px;background:#ff2d78;color:#fff;border-radius:12px;text-decoration:none}
      </style></head><body><div><h1>❌ Connection Failed</h1>
      <p>${error_description || error}</p>
      <a class="btn" href="/">Back to FameForge</a>
      <script>setTimeout(()=>{window.close()},4000)</script></div></body></html>`);
  }

  if (!code || !state) {
    return res.status(400).send(`<!doctype html><html><head><title>Error</title>
      <style>body{font-family:system-ui;background:#0b0b18;color:#f5f5fb;display:grid;place-items:center;min-height:100vh;text-align:center}</style>
      </head><body><div><h1 style="color:#f87171">❌ Invalid Callback</h1>
      <p>Missing authorization code or state parameter. Please try connecting again.</p>
      <script>setTimeout(()=>{window.close()},5000)</script></div></body></html>`);
  }

  try {
    await handleCallback(platform, code, state, REDIRECT_BASE);
    res.send(`
      <!doctype html><html><head><title>Connected!</title>
      <style>body{font-family:system-ui;background:#0b0b18;color:#f5f5fb;display:grid;place-items:center;min-height:100vh;text-align:center}
      .ring{width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,#ff2d78,#a855f7);display:grid;place-items:center;font-size:36px;margin:0 auto 20px;animation:pop .4s cubic-bezier(.34,1.56,.64,1)}
      @keyframes pop{from{transform:scale(0);opacity:0}}
      </style></head><body><div><div class="ring">✅</div>
      <h1 style="color:#34d399">Connected!</h1>
      <p>${platform} is now linked to FameForge.</p>
      <script>
        if (window.opener) {
          window.opener.postMessage({ type: 'OAUTH_SUCCESS', platform: '${platform}' }, '*');
          setTimeout(() => window.close(), 800);
        } else {
          setTimeout(() => { window.location.href = '/'; }, 2000);
        }
      </script></div></body></html>`);
  } catch (e) {
    res.status(400).send(`
      <!doctype html><html><head><title>Error</title>
      <style>body{font-family:system-ui;background:#0b0b18;color:#f5f5fb;display:grid;place-items:center;min-height:100vh;text-align:center}</style>
      </head><body><div><h1 style="color:#f87171">❌ Error</h1><p>${e.message}</p>
      <script>setTimeout(()=>{window.close()},5000)</script></div></body></html>`);
  }
});

// Get OAuth connection status for all platforms
app.get('/api/oauth/status', authed, (req, res) => {
  const statuses = {};
  for (const ch of req.user.channels) {
    statuses[ch.id] = getConnectionStatus(req.user.id, ch.id);
  }
  res.json(statuses);
});

// Disconnect a platform
app.post('/api/oauth/:platform/disconnect', authed, (req, res) => {
  const { platform } = req.params;
  disconnectPlatform(req.user.id, platform);
  log(req.user, `Disconnected ${platformName(platform)} (OAuth tokens cleared)`, 'channel');
  save();
  res.json({ ok: true });
});

// Save platform developer credentials (Client ID + Secret)
app.put('/api/oauth/:platform/credentials', authed, (req, res) => {
  const { platform } = req.params;
  const { clientId, clientSecret, extra } = req.body || {};
  saveCredentials(req.user.id, platform, clientId, clientSecret, extra);
  log(req.user, `Updated ${platformName(platform)} API credentials`, 'settings');
  res.json({ ok: true });
});

// ------------------------------------------------------------------ campaigns
app.post('/api/campaigns', authed, (req, res) => {
  const campaign = {
    id: uid(),
    name: 'Untitled campaign',
    goal: 'promote',
    topic: '', product: '', audience: '',
    channels: req.user.channels.filter((c) => c.enabled && c.id !== 'website' && c.id !== 'resume').map((c) => c.id),
    schedule: { mode: 'recurring', frequency: 'daily', time: '09:00', days: [1, 2, 3, 4, 5], intervalDays: 1 },
    ai: { enabled: true, tone: 'hype', type: 'promo', length: 'medium' },
    active: true,
    autoPilot: true,
    nextRunAt: null,
    postsCreated: 0,
    createdAt: Date.now(),
    ...req.body,
  };
  campaign.nextRunAt = nextRunAt(campaign.schedule, Date.now());
  req.user.campaigns.unshift(campaign);
  log(req.user, `Campaign "${campaign.name}" created`, 'campaign');
  save();
  res.json(campaign);
});

app.put('/api/campaigns/:id', authed, (req, res) => {
  const c = req.user.campaigns.find((x) => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'Campaign not found' });
  const wasActive = c.active;
  Object.assign(c, req.body, { id: c.id });
  if (req.body.schedule) c.nextRunAt = nextRunAt(c.schedule, Date.now());
  if (!wasActive && c.active) c.nextRunAt = nextRunAt(c.schedule, Date.now());
  save();
  res.json(c);
});

app.delete('/api/campaigns/:id', authed, (req, res) => {
  req.user.campaigns = req.user.campaigns.filter((c) => c.id !== req.params.id);
  log(req.user, 'Campaign deleted', 'campaign');
  save();
  res.json({ ok: true });
});

app.post('/api/campaigns/:id/run-now', authed, async (req, res) => {
  const c = req.user.campaigns.find((x) => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'Campaign not found' });
  const posts = await publishCampaignAsync(req.user, c);
  c.nextRunAt = nextRunAt(c.schedule, Date.now());
  save();
  res.json({ posts, nextRunAt: c.nextRunAt });
});

// ------------------------------------------------------------------ posts
app.post('/api/posts', authed, (req, res) => {
  const { channelIds = [], content = '', scheduledAt = null, campaignId = null } = req.body || {};
  if (!channelIds.length || !content) return res.status(400).json({ error: 'Channels and content required' });
  const post = {
    id: uid(),
    channelIds: channelIds.filter((id) => req.user.channels.some((c) => c.id === id)),
    content,
    status: scheduledAt && scheduledAt > Date.now() ? 'scheduled' : 'draft',
    scheduledAt: scheduledAt || null,
    campaignId,
    publishedAt: null,
    engagement: null,
    createdAt: Date.now(),
  };
  req.user.posts.unshift(post);
  save();
  res.json(post);
});

app.delete('/api/posts/:id', authed, (req, res) => {
  req.user.posts = req.user.posts.filter((p) => p.id !== req.params.id);
  save();
  res.json({ ok: true });
});

app.post('/api/posts/:id/publish', authed, async (req, res) => {
  const p = req.user.posts.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Post not found' });
  await publishPost(req.user, p);
  save();
  res.json(p);
});

// ------------------------------------------------------------------ AI
app.post('/api/ai/generate', authed, async (req, res) => {
  const { kind = 'post' } = req.body || {};
  try {
    if (req.user.settings.ai.mode === 'api' && req.user.settings.ai.apiKey) {
      const out = await realAI(req.user.settings.ai, kind, req.body);
      if (out) return res.json(out);
    }
    const out = builtinAI(kind, req.body, req.user);
    res.json(out);
  } catch (e) {
    const out = builtinAI(kind, req.body, req.user);
    res.json(out);
  }
});

async function realAI(aiCfg, kind, payload) {
  const base = (aiCfg.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = aiCfg.model || (aiCfg.provider === 'anthropic' ? 'claude-3-5-sonnet-latest' : 'gpt-4o-mini');
  const system = 'You are a world-class social media growth strategist and copywriter. You write scroll-stopping, click-bait-worthy content that converts, matched to each platform\'s style and limits. Return ONLY valid JSON with the exact keys requested.';
  const userMsg = `Generate ${kind === 'post' ? 'a social media post' : kind === 'bio' ? 'a profile bio' : kind === 'about' ? 'an about section' : 'click-bait headlines'}.\nPayload: ${JSON.stringify(payload)}\nReturn JSON ${
    kind === 'post' ? 'with keys {text, hashtags (array), headline}' :
    kind === 'headlines' ? 'as an array of {title}' :
    kind === 'bio' ? 'with key {text}' : 'with key {text}'}`;
  const r = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aiCfg.apiKey}` },
    body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: userMsg }], temperature: 0.9 }),
  });
  if (!r.ok) return null;
  const data = await r.json();
  const text = data.choices?.[0]?.message?.content || '';
  const json = text.replace(/```json|```/g, '').trim();
  try { return JSON.parse(json); } catch { return null; }
}

const builtinAI = (kind, body, user) => {
  const b = { emoji: user.settings.brand.emoji, signature: user.settings.brand.signature };
  switch (kind) {
    case 'post': return ai.generatePost({ ...body, brand: { ...b, ...(body.brand || {}) } });
    case 'bio': return ai.generateBio({ ...body, profile: user.profile, brand: b });
    case 'about': return { text: ai.generateAbout(user.profile, body.tone || 'professional') };
    case 'headlines': return { headlines: ai.generateHeadlines(body.topic || '', body.count || 5) };
    case 'ideas': return { ideas: ai.generatePostIdeas(body.topic || '', body.audience || '') };
    default: return { text: ai.generatePost({ ...body, brand: b }).text };
  }
};

// ------------------------------------------------------------------ dashboard
app.get('/api/dashboard', authed, (req, res) => {
  const u = req.user;
  const score = fameScore(u);
  const now = Date.now();
  const stats = {
    fameScore: score,
    channelsConnected: u.channels.filter((c) => c.connected).length,
    channelsEnabled: u.channels.filter((c) => c.enabled).length,
    totalFollowers: u.channels.reduce((s, c) => s + (c.followers || 0), 0),
    postsPublished: u.posts.filter((p) => p.status === 'published').length,
    postsScheduled: u.posts.filter((p) => p.status === 'scheduled').length,
    activeCampaigns: u.campaigns.filter((c) => c.active).length,
    reach: u.posts.filter((p) => p.status === 'published').reduce((s, p) => s + (p.engagement?.reach || 0), 0),
    engagementRate: u.posts.filter((p) => p.status === 'published').reduce((s, p) => s + (p.engagement?.rate || 0), 0) / Math.max(1, u.posts.filter((p) => p.status === 'published').length),
    upcoming: u.posts.filter((p) => p.status === 'scheduled').sort((a, b) => (a.scheduledAt || 0) - (b.scheduledAt || 0)).slice(0, 6),
    nextCampaignRuns: u.campaigns.filter((c) => c.active && c.nextRunAt).map((c) => ({ id: c.id, name: c.name, at: c.nextRunAt, channels: c.channels.length })).sort((a, b) => a.at - b.at).slice(0, 6),
    activity: u.activity.slice(0, 12),
    growth: buildGrowth(u),
    lastPost: u.posts.find((p) => p.status === 'published'),
  };
  res.json(stats);
});

function buildGrowth(u) {
  const published = u.posts.filter((p) => p.status === 'published').sort((a, b) => (a.publishedAt || 0) - (b.publishedAt || 0));
  const series = [];
  let total = u.channels.reduce((s, c) => s + (c.followers || 0), 0);
  const start = published[0]?.publishedAt || Date.now() - 30 * 864e5;
  for (let i = 0; i < 14; i++) {
    const day = start + i * 864e5;
    const dayPosts = published.filter((p) => p.publishedAt && p.publishedAt < day + 864e5);
    total += dayPosts.length * (20 + Math.round(Math.random() * 60));
    series.push({ date: day, followers: total, engagement: dayPosts.length * (3 + Math.round(Math.random() * 9)) });
  }
  return series;
}

// ------------------------------------------------------------------ scheduler
const SCHEDULE_MS = 15 * 1000;
function nextRunAt(schedule, from = Date.now()) {
  const { mode = 'recurring', frequency = 'daily', time = '09:00', days = [], intervalDays = 1 } = schedule || {};
  if (mode === 'once') return schedule.at || from;
  const [h, m] = (time || '09:00').split(':').map(Number);
  const base = new Date(from);
  if (frequency === 'hourly') return from + 60 * 60 * 1000;
  if (frequency === 'interval') return from + Math.max(1, Number(intervalDays) || 1) * 864e5;
  for (let i = 0; i < 8; i++) {
    const d = new Date(base.getTime() + i * 864e5);
    d.setHours(h || 9, m || 0, 0, 0);
    if (d.getTime() <= from) continue;
    if (frequency === 'weekly' && days.length && !days.includes(d.getDay())) continue;
    if (frequency === 'daily') return d.getTime();
    return d.getTime();
  }
  return from + 864e5;
}

async function tick() {
  for (const user of Object.values(getUsers())) {
    const now = Date.now();
    let changed = false;
    for (const c of user.campaigns) {
      if (!c.active || !c.nextRunAt || c.nextRunAt > now) continue;
      const posts = await publishCampaignAsync(user, c);
      c.postsCreated += posts.length;
      c.nextRunAt = nextRunAt(c.schedule, now);
      if (c.schedule.mode === 'once') c.active = false;
      changed = true;
    }
    const due = user.posts.filter((p) => p.status === 'scheduled' && p.scheduledAt && p.scheduledAt <= now);
    for (const p of due) { await publishPost(user, p); changed = true; }
    // slow follower growth + daily fame snapshot
    user.channels.forEach((ch) => { if (ch.connected && Math.random() < 0.3) ch.followers += Math.ceil(Math.random() * 3); });
    const lastSnap = user.fame.history[user.fame.history.length - 1];
    if (!lastSnap || now - lastSnap.t > 864e5) {
      user.fame.history.push({ t: now, score: fameScore(user), followers: user.channels.reduce((s, c) => s + c.followers, 0) });
      if (user.fame.history.length > 60) user.fame.history = user.fame.history.slice(-60);
      changed = true;
    }
    if (changed) save();
  }
}

async function publishCampaignAsync(user, campaign) {
  const channels = user.channels.filter((c) => campaign.channels.includes(c.id) && c.enabled);
  if (!channels.length) return [];
  const opts = {
    topic: campaign.topic || campaign.product || campaign.name,
    product: campaign.product, audience: campaign.audience,
    type: campaign.ai.type || 'promo', tone: campaign.ai.tone || 'hype',
    length: campaign.ai.length || 'medium', brand: user.settings.brand,
  };
  const results = [];
  for (const ch of channels) {
    const gen = campaign.ai.enabled ? ai.generatePost({ ...opts, platform: ch.id, seed: Date.now() + Math.floor(Math.random() * 1000) }) : null;
    const content = campaign.content || gen?.text || `${campaign.name} — ${campaign.topic}`;

    // Attempt real posting
    const result = await postToPlatform(user.id, ch.id, content);
    const status = result.real ? 'published (real)' : 'published (simulated)';

    const post = {
      id: uid(), channelIds: [ch.id], content,
      status: 'published', scheduledAt: null, publishedAt: Date.now(),
      campaignId: campaign.id, engagement: mockEngagement(ch), createdAt: Date.now(),
    };
    user.posts.unshift(post);
    ch.posts = (ch.posts || 0) + 1;
    log(user, `Campaign post → ${platformName(ch.id)} ${result.real ? '(API ✅)' : '(simulated)'}`, 'post');
    results.push(post);
  }
  return results;
}

async function publishPost(user, post) {
  post.status = 'published';
  post.publishedAt = Date.now();
  post.scheduledAt = null;
  const ch = user.channels.find((c) => post.channelIds.includes(c.id));

  // Attempt real posting via platform API — falls back to simulation silently
  const result = await postToPlatform(user.id, ch?.id, post.content);
  if (result.real) {
    log(user, `Posted to ${platformName(ch?.id)} via API ✨`, 'post');
  } else if (result.error) {
    log(user, `${platformName(ch?.id)}: ${result.error} (simulated)`, 'post');
  } else {
    log(user, `Published ${platformName(ch?.id)} post (simulated)`, 'post');
  }

  post.engagement = mockEngagement(ch);
  if (ch) { ch.posts = (ch.posts || 0) + 1; }
}

function mockEngagement(ch) {
  const f = (ch?.followers || 500) || 100;
  const likes = Math.round(f * (0.04 + Math.random() * 0.09));
  const comments = Math.round(likes * (0.05 + Math.random() * 0.08));
  const shares = Math.round(likes * (0.02 + Math.random() * 0.05));
  const reach = Math.round(f * (0.3 + Math.random() * 0.7));
  return { likes, comments, shares, reach, rate: clamp(((likes + comments * 2 + shares * 3) / Math.max(1, reach)) * 100, 0, 30) };
}

const platformName = (id) => PLATFORMS.find((p) => p.id === id)?.name || 'social';

function log(user, message, kind) {
  user.activity.unshift({ id: uid(), message, kind, at: Date.now() });
  user.activity = user.activity.slice(0, 50);
}

// ------------------------------------------------------------------ fame score
export function fameScore(user) {
  const connected = user.channels.filter((c) => c.connected).length;
  const followers = user.channels.reduce((s, c) => s + (c.followers || 0), 0);
  const posts7 = user.posts.filter((p) => p.status === 'published' && p.publishedAt > Date.now() - 7 * 864e5).length;
  const pro = user.profile;
  const profileComplete = [
    pro.headline, pro.about, pro.location, pro.website, pro.skills?.length,
    pro.experience?.length, pro.education?.length, pro.services?.length,
  ].filter(Boolean).length;
  const siteLive = user.site.published ? 6 : 0;
  const score = 10
    + connected * 4
    + Math.min(followers / 250, 25)
    + Math.min(posts7 * 2, 20)
    + Math.min(user.campaigns.filter((c) => c.active).length * 2, 10)
    + Math.min(profileComplete * 1.5, 15)
    + siteLive
    + Math.min(user.resume.summary ? 2 : 0, 2);
  return Math.round(clamp(score, 0, 100));
}

// ------------------------------------------------------------------ static (production only)
// Serve the Vite-built frontend from disk. Placed after all API routes
// so the SPA fallback never intercepts /api/* requests.
if (existsSync(join(STATIC_DIR, 'index.html'))) {
  app.use(express.static(STATIC_DIR));
  app.get(/^(?!\/api(\/|$)).*/, (req, res) => {
    res.sendFile(join(STATIC_DIR, 'index.html'));
  });
}

// ------------------------------------------------------------------ boot
export { app };

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  app.listen(PORT, HOST, () => {
    const addr = HOST === '0.0.0.0' ? `0.0.0.0:${PORT} (all interfaces)` : `${HOST}:${PORT}`;
    console.log(`🎉 FameForge API → http://${addr}`);
    if (HOST === '0.0.0.0') {
      console.log(`   Local:   http://localhost:${PORT}`);
      console.log(`   Public:  ${PUBLIC_URL}`);
    }
  });
  setInterval(tick, SCHEDULE_MS);
  tick();
}
