// Unified OAuth 2.0 with PKCE handler.
// Handles: authorize redirect → callback → token exchange → token refresh → secure storage.
import crypto from 'node:crypto';
import { getUsers, save } from './store.js';
import { PLATFORM_APIS } from './platforms/index.js';

// In-memory state store — maps state → { userId, platform, codeVerifier, redirectAfter }
const pendingStates = new Map();

const uid = () => crypto.randomUUID();
const base64URL = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
const sha256 = (s) => crypto.createHash('sha256').update(s).digest();

// Generate PKCE code verifier + challenge
function pkceChallenge() {
  const verifier = base64URL(crypto.randomBytes(48));
  const challenge = base64URL(sha256(verifier));
  return { verifier, challenge };
}  // Build the authorize URL for a given platform
export function buildAuthorizeUrl(userId, platformId, redirectBase) {
  const platform = PLATFORM_APIS[platformId];
  if (!platform) throw new Error(`Unknown platform: ${platformId}`);

  const { verifier, challenge } = pkceChallenge();
  const state = uid();
  const creds = getCreds(userId, platformId);
  const redirectUri = `${redirectBase}/api/oauth/${platformId}/callback`;

  pendingStates.set(state, { userId, platform: platformId, verifier, createdAt: Date.now() });

  // Cleanup old states (>10 min)
  for (const [k, v] of pendingStates) {
    if (Date.now() - v.createdAt > 600_000) pendingStates.delete(k);
  }

  // PKCE is only supported by some providers (X, Google, Pinterest, TikTok).
  // Meta (Facebook/Instagram/Threads) and LinkedIn's classic web flow reject the
  // code_challenge params, so skip them unless the platform opts in.
  const usePkce = platform.usePkce !== false;

  // Optional scopes (e.g. LinkedIn w_organization_social) are appended only when
  // the user opted in — requesting an unprovisioned scope makes LinkedIn reject the
  // whole authorization. Mirrors the client's legacy detection: users who already
  // have Company Pages stored from before the opt-in flag existed still count.
  const orgPostingEnabled = creds.extra?.enableOrgPosting === true || (creds.extra?.linkedinOrgPages?.length || 0) > 0;
  let scopes = platform.scopes;
  if (platform.optionalScopes?.length && orgPostingEnabled) {
    scopes = [scopes, ...platform.optionalScopes].filter(Boolean).join(' ');
  }

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: creds.clientId,
    redirect_uri: redirectUri,
    scope: scopes,
    state,
    ...(platform.extraAuthParams || {}),
  });

  if (usePkce) {
    params.set('code_challenge', challenge);
    params.set('code_challenge_method', platform.extraAuthParams?.code_challenge_method || 'S256');
  }

  return `${platform.authorizeUrl}?${params.toString()}`;
}

// Handle OAuth callback — exchange code for tokens
export async function handleCallback(platformId, code, state, redirectBase) {
  const pending = pendingStates.get(state);
  if (!pending || pending.platform !== platformId) {
    throw new Error('Invalid or expired OAuth state. Please try connecting again.');
  }
  pendingStates.delete(state);

  const platform = PLATFORM_APIS[platformId];
  if (!platform) throw new Error(`Unknown platform: ${platformId}`);

  const creds = getCreds(pending.userId, platformId);
  const base = redirectBase || process.env.OAUTH_REDIRECT_BASE || process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`;
  const redirectUri = `${base}/api/oauth/${platformId}/callback`;

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: creds.clientId,
  });

  // Only send the PKCE verifier to providers that actually use PKCE (see buildAuthorizeUrl)
  if (platform.usePkce !== false) {
    body.set('code_verifier', pending.verifier);
  }

  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };

  // Some platforms (X, TikTok) use client credentials in body instead of Basic auth
  if (!platform.clientCredentialsInBody) {
    const basic = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString('base64');
    headers['Authorization'] = `Basic ${basic}`;
  } else if (creds.clientSecret) {
    // For X API: include client_secret in body (though public clients omit it)
    body.set('client_secret', creds.clientSecret);
  }

  const r = await fetch(platform.tokenUrl, {
    method: 'POST',
    headers,
    body: body.toString(),
  });

  if (!r.ok) {
    const errText = await r.text().catch(() => '');
    throw new Error(`Token exchange failed (${r.status}): ${errText.slice(0, 200)}`);
  }

  const data = await r.json();
  const tokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || null,
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : null,
    scope: data.scope || platform.scopes,
  };

  // Meta platforms (Facebook / Instagram / Threads): exchange short-lived
  // user token (~2h) for a long-lived token (~60 days) via fb_exchange_token.
  if (platform.tokenUrl.includes('graph.facebook.com') && tokens.accessToken) {
    try {
      const llBody = new URLSearchParams({
        grant_type: 'fb_exchange_token',
        fb_exchange_token: tokens.accessToken,
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
      });
      const llR = await fetch(platform.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: llBody.toString(),
      });
      if (llR.ok) {
        const llData = await llR.json();
        tokens.accessToken = llData.access_token;
        tokens.expiresAt = llData.expires_in
          ? Date.now() + llData.expires_in * 1000
          : Date.now() + 60 * 864e5; // fallback: ~60 days
        // Store the long-lived token as refresh_token so it can be re-exchanged later
        tokens.refreshToken = llData.access_token;
      }
    } catch { /* long-lived exchange is best-effort; short-lived token still works */ }
  }

  // Store tokens on the channel
  storeTokens(pending.userId, platformId, tokens);
  return { platformId, tokens, userId: pending.userId };
}

// Refresh an expired access token
export async function refreshToken(userId, platformId) {
  const platform = PLATFORM_APIS[platformId];
  if (!platform) return null;

  const tokens = getStoredTokens(userId, platformId);
  if (!tokens?.refreshToken) return null;

  const creds = getCreds(userId, platformId);
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: tokens.refreshToken,
    client_id: creds.clientId,
  });

  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
  if (!platform.clientCredentialsInBody) {
    const basic = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString('base64');
    headers['Authorization'] = `Basic ${basic}`;
  } else if (creds.clientSecret) {
    // Meta / LinkedIn style token endpoints expect client_secret as a form body param
    body.set('client_secret', creds.clientSecret);
  }

  try {
    const r = await fetch(platform.tokenUrl, { method: 'POST', headers, body: body.toString() });
    if (!r.ok) return null;
    const data = await r.json();
    const newTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || tokens.refreshToken,
      expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : null,
      scope: data.scope || tokens.scope,
    };
    storeTokens(userId, platformId, newTokens);
    return newTokens.accessToken;
  } catch {
    return null;
  }
}

// Get a valid access token (refreshing if needed)
export async function getValidAccessToken(userId, platformId) {
  const tokens = getStoredTokens(userId, platformId);
  if (!tokens?.accessToken) return null;

  // If not expired or no expiry info, use as-is
  if (!tokens.expiresAt || tokens.expiresAt > Date.now() + 60_000) {
    return tokens.accessToken;
  }

  // Try refresh
  const fresh = await refreshToken(userId, platformId);
  return fresh || tokens.accessToken; // fall back to potentially expired token
}

// ---- Storage helpers (tokens live on the channel object) ----

function getCreds(userId, platformId) {
  const users = getUsers();
  const user = users[userId];
  if (!user) return { clientId: '', clientSecret: '' };
  const creds = user.platformCredentials?.[platformId] || {};
  return {
    clientId: creds.clientId || process.env[`${platformId.toUpperCase()}_CLIENT_ID`] || '',
    clientSecret: creds.clientSecret || process.env[`${platformId.toUpperCase()}_CLIENT_SECRET`] || '',
    extra: creds.extra || {},
  };
}

function getStoredTokens(userId, platformId) {
  const users = getUsers();
  const user = users[userId];
  if (!user) return null;
  const ch = user.channels?.find((c) => c.id === platformId);
  return ch?.oauth || null;
}

function storeTokens(userId, platformId, tokens) {
  const users = getUsers();
  const user = users[userId];
  if (!user) return;
  const ch = user.channels?.find((c) => c.id === platformId);
  if (ch) {
    ch.oauth = tokens;
    ch.connected = true;
    save();
  }
}

export function disconnectPlatform(userId, platformId) {
  const users = getUsers();
  const user = users[userId];
  if (!user) return;
  const ch = user.channels?.find((c) => c.id === platformId);
  if (ch) {
    delete ch.oauth;
    ch.connected = false;
    save();
  }
}

export function getConnectionStatus(userId, platformId) {
  const tokens = getStoredTokens(userId, platformId);
  const creds = getCreds(userId, platformId);
  return {
    configured: !!creds.clientId,
    connected: !!tokens?.accessToken,
    expiresAt: tokens?.expiresAt || null,
    hasRefresh: !!tokens?.refreshToken,
  };
}

// Save platform developer credentials. Fields left undefined keep their stored
// value (PUT patch semantics), and `extra` is merged — so saving just a page ID or
// board selection never wipes the Client ID/Secret. Pass `replaceExtra: true` to
// replace the whole extra object instead (used when clearing credentials).
export function saveCredentials(userId, platformId, clientId, clientSecret, extra = {}, replaceExtra = false) {
  const users = getUsers();
  const user = users[userId];
  if (!user) return;
  if (!user.platformCredentials) user.platformCredentials = {};
  const existing = user.platformCredentials[platformId] || {};
  user.platformCredentials[platformId] = {
    clientId: clientId !== undefined ? clientId : existing.clientId,
    clientSecret: clientSecret !== undefined ? clientSecret : existing.clientSecret,
    extra: replaceExtra ? (extra || {}) : { ...(existing.extra || {}), ...(extra || {}) },
  };
  save();
}

// Periodic cleanup of expired pending states
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of pendingStates) {
    if (now - v.createdAt > 600_000) pendingStates.delete(k);
  }
}, 120_000);
