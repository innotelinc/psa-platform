// Platform definitions — OAuth endpoints, scopes, and API posting endpoints.
// Each platform must expose: id, name, authorizeUrl, tokenUrl, scopes, and a post() function.

import crypto from 'node:crypto';
import { getUsers, save } from '../store.js';

// ---- OAuth 1.0a signing helper (for X/Twitter legacy auth) ----

export function percentEncode(str) {
  return encodeURIComponent(str).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

export function oauth1aSignature(method, url, params, consumerSecret, tokenSecret) {
  // Sort params by encoded key, then encoded value
  const sorted = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      acc.push(percentEncode(key) + '=' + percentEncode(params[key]));
      return acc;
    }, [])
    .join('&');

  const baseString = [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(sorted),
  ].join('&');

  const signingKey = percentEncode(consumerSecret) + '&' + percentEncode(tokenSecret || '');
  return crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');
}

export function oauth1aAuthHeader(method, url, params, consumerKey, consumerSecret, token, tokenSecret) {
  const oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 32),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: token,
    oauth_version: '1.0',
  };

  // Combine oauth params with request params for signature
  const sigParams = { ...oauthParams, ...params };
  const signature = oauth1aSignature(method, url, sigParams, consumerSecret, tokenSecret);

  // Build header — oauth params only, with signature
  const headerParams = { ...oauthParams, oauth_signature: signature };
  return 'OAuth ' + Object.keys(headerParams)
    .sort()
    .map((k) => percentEncode(k) + '="' + percentEncode(headerParams[k]) + '"')
    .join(', ');
}

// ---- Platform definitions ----

export const X = {
  id: 'x',
  name: 'X / Twitter',
  authorizeUrl: 'https://twitter.com/i/oauth2/authorize',
  tokenUrl: 'https://api.twitter.com/2/oauth2/token',
  scopes: 'tweet.write users.read offline.access',
  extraAuthParams: { code_challenge_method: 'S256' },
  clientCredentialsInBody: true, // public client — no Basic auth header
  async post(accessToken, text, extra = {}) {
    // --- OAuth 1.0a path (legacy user keys) ---
    if (extra.consumerKey && extra.accessToken) {
      const url = 'https://api.twitter.com/1.1/statuses/update.json';
      const bodyParams = { status: text };
      const authHeader = oauth1aAuthHeader(
        'POST', url, bodyParams,
        extra.consumerKey, extra.consumerSecret || '',
        extra.accessToken, extra.accessTokenSecret || ''
      );
      const r = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(bodyParams).toString(),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.errors?.[0]?.message || err.error || `X API v1.1 error ${r.status}`);
      }
      return r.json();
    }

    // --- OAuth 2.0 path (default Bearer token) ---
    const r = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.detail || err.title || `X API error ${r.status}`);
    }
    return r.json();
  },
};

export const LINKEDIN = {
  id: 'linkedin',
  name: 'LinkedIn',
  authorizeUrl: 'https://www.linkedin.com/oauth/v2/authorization',
  tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
  usePkce: false, // LinkedIn's classic web OAuth flow has no PKCE (only the separate native endpoint)
  clientCredentialsInBody: true, // token endpoint takes client_id/client_secret in the form body
  scopes: 'openid profile email w_member_social',
  optionalScopes: ['w_organization_social'], // appended only when Company Page posting is enabled in Settings
  async post(accessToken, text, extra = {}) {
    // Post as a Company Page (organization) when extra.orgId is set, otherwise as the member
    let author;
    if (extra.orgId) {
      author = `urn:li:organization:${extra.orgId}`;
    } else {
      // Resolve the member URN for personal posts
      const meR = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!meR.ok) throw new Error(`LinkedIn userinfo error ${meR.status}`);
      const me = await meR.json();
      author = `urn:li:person:${me.sub}`;
    }

    const r = await fetch('https://api.linkedin.com/rest/posts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'LinkedIn-Version': '202505',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        author,
        commentary: text,
        visibility: 'PUBLIC',
        lifecycleState: 'PUBLISHED',
        distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] },
      }),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.message || `LinkedIn API error ${r.status}`);
    }
    return r.json();
  },
  // Company Pages the user administers (requires w_organization_social scope)
  async getOrganizationPages(accessToken) {
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'X-Restli-Protocol-Version': '2.0.0',
    };
    const aclR = await fetch(
      'https://api.linkedin.com/rest/organizationalEntityAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED&count=20',
      { headers }
    );
    if (!aclR.ok) return [];
    const acl = await aclR.json();
    const orgIds = (acl.elements || [])
      .map((el) => (el.organizationalTarget || ''))
      .filter((urn) => urn.startsWith('urn:li:organization:'))
      .map((urn) => urn.replace('urn:li:organization:', ''))
      .filter(Boolean);
    const pages = [];
    for (const id of orgIds.slice(0, 10)) {
      try {
        const r = await fetch(
          `https://api.linkedin.com/rest/organizations/${id}?projection=(localizedName,vanityName)`,
          { headers }
        );
        if (r.ok) {
          const org = await r.json();
          pages.push({ id, name: org.localizedName || `Organization ${id}`, vanityName: org.vanityName || '' });
        }
      } catch { /* skip unreadable org */ }
    }
    return pages;
  },
};

export const FACEBOOK = {
  id: 'facebook',
  name: 'Facebook',
  authorizeUrl: 'https://www.facebook.com/v26.0/dialog/oauth',
  tokenUrl: 'https://graph.facebook.com/v26.0/oauth/access_token',
  usePkce: false, // Meta's OAuth dialog rejects code_challenge/code_challenge_method params
  clientCredentialsInBody: true, // Meta's token endpoint expects client_id/client_secret in the body, not Basic auth
  // pages_read_engagement is no longer accepted by Meta's use-case-based apps (it was
  // flagged as an invalid scope alongside the legacy instagram_* names); pages_manage_posts
  // + pages_show_list cover feed posting and listing the user's Pages.
  scopes: 'pages_manage_posts pages_show_list',
  async post(accessToken, text, extra = {}) {
    // Facebook requires a page ID and page access token
    const pageId = extra.pageId;
    const pageToken = extra.pageToken || accessToken;
    if (!pageId) throw new Error('Facebook page ID required. Connect a Facebook Page in Settings.');

    const r = await fetch(`https://graph.facebook.com/v26.0/${pageId}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text, access_token: pageToken }),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.error?.message || `Facebook API error ${r.status}`);
    }
    return r.json();
  },
  // After getting user token, fetch pages they manage
  async getPages(accessToken) {
    const r = await fetch(`https://graph.facebook.com/v26.0/me/accounts?access_token=${accessToken}`);
    if (!r.ok) return [];
    const data = await r.json();
    return (data.data || []).map((p) => ({ id: p.id, name: p.name, token: p.access_token }));
  },
};

export const INSTAGRAM = {
  id: 'instagram',
  name: 'Instagram',
  authorizeUrl: 'https://www.facebook.com/v26.0/dialog/oauth',
  tokenUrl: 'https://graph.facebook.com/v26.0/oauth/access_token',
  usePkce: false, // Meta's OAuth dialog rejects code_challenge/code_challenge_method params
  clientCredentialsInBody: true, // Meta's token endpoint expects client_id/client_secret in the body, not Basic auth
  // Meta deprecated the legacy instagram_basic / instagram_content_publish / pages_read_engagement
  // scope names (deadline Jan 27, 2025); the dialog now accepts instagram_business_basic +
  // instagram_business_content_publish for this flow. pages_show_list stays for listing Pages and
  // pages_read_user_content is the current page-read permission (was pages_read_engagement) used
  // to resolve the IG Business Account linked to a Page.
  scopes: 'instagram_business_basic instagram_business_content_publish pages_read_user_content pages_show_list',
  async post(accessToken, text, extra = {}) {
    // Instagram requires an IG Business Account ID
    const igUserId = extra.igUserId;
    if (!igUserId) throw new Error('Instagram Business Account ID required. Connect Instagram in Settings.');

    // Instagram only supports media posts, not text-only. For text, we create a story mention or return an error.
    // Since we don't have image upload yet, we note this limitation.
    throw new Error(
      'Instagram API requires an image or video. Use the Composer to attach media, or post to other platforms. ' +
        'Text-only posts are not supported by the Instagram Graph API.'
    );
  },
  async getIGAccounts(accessToken, pageId) {
    const r = await fetch(
      `https://graph.facebook.com/v26.0/${pageId}?fields=instagram_business_account{id,username}&access_token=${accessToken}`
    );
    if (!r.ok) return null;
    const data = await r.json();
    return data.instagram_business_account || null;
  },
};

export const THREADS = {
  id: 'threads',
  name: 'Threads',
  authorizeUrl: 'https://www.facebook.com/v26.0/dialog/oauth',
  tokenUrl: 'https://graph.facebook.com/v26.0/oauth/access_token',
  usePkce: false, // Meta's OAuth dialog rejects code_challenge/code_challenge_method params
  clientCredentialsInBody: true, // Meta's token endpoint expects client_id/client_secret in the body, not Basic auth
  scopes: 'threads_basic threads_content_publish',
  async post(accessToken, text, extra = {}) {
    const threadsUserId = extra.threadsUserId;
    if (!threadsUserId) throw new Error('Threads user ID required. Connect Threads in Settings.');

    // Step 1: Create media container
    const container = await fetch(`https://graph.facebook.com/v26.0/${threadsUserId}/threads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ media_type: 'TEXT', text, access_token: accessToken }),
    });
    if (!container.ok) {
      const err = await container.json().catch(() => ({}));
      throw new Error(err.error?.message || `Threads container error ${container.status}`);
    }
    const { id: containerId } = await container.json();

    // Step 2: Publish the container
    const pub = await fetch(`https://graph.facebook.com/v26.0/${threadsUserId}/threads_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ creation_id: containerId, access_token: accessToken }),
    });
    if (!pub.ok) {
      const err = await pub.json().catch(() => ({}));
      throw new Error(err.error?.message || `Threads publish error ${pub.status}`);
    }
    return pub.json();
  },
};

export const YOUTUBE = {
  id: 'youtube',
  name: 'YouTube',
  authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  scopes: 'https://www.googleapis.com/auth/youtube.upload openid profile',
  extraAuthParams: { access_type: 'offline', prompt: 'consent' },
  // YouTube Community posts require channel access
  async post(accessToken, text) {
    // YouTube posting = Community tab posts (not video uploads, which need media)
    // Get the channel first
    const chR = await fetch('https://www.googleapis.com/youtube/v3/channels?part=id&mine=true', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!chR.ok) throw new Error(`YouTube channels error ${chR.status}`);
    const chData = await chR.json();
    const channelId = chData.items?.[0]?.id;
    if (!channelId) throw new Error('No YouTube channel found for this account.');

    // YouTube doesn't have a Community Posts API endpoint in v3 for text posts.
    // It's only available through the older liveBroadcasts/playlists APIs.
    throw new Error(
      'YouTube Community Posts API is not publicly available for text posts. ' +
        'Video uploads require media files. FameForge supports this through simulated posting.'
    );
  },
};

export const PINTEREST = {
  id: 'pinterest',
  name: 'Pinterest',
  authorizeUrl: 'https://www.pinterest.com/oauth/',
  tokenUrl: 'https://api.pinterest.com/v5/oauth/token',
  scopes: 'pins:write,boards:read,user_accounts:read',
  async post(accessToken, text, extra = {}) {
    // Pinterest requires a board ID and either an image or a link for a Pin
    const boardId = extra.boardId;
    if (!boardId) throw new Error('Pinterest board ID required. Select a board in Settings.');

    if (!extra.imageUrl && !extra.link) {
      throw new Error(
        'Pinterest Pins require an image URL or link. Text-only Pins are not supported.'
      );
    }

    const body = {
      board_id: boardId,
      title: text.slice(0, 100),
      description: text,
    };
    if (extra.link) body.link = extra.link;
    if (extra.imageUrl) body.media_source = { source_type: 'image_url', url: extra.imageUrl };

    const r = await fetch('https://api.pinterest.com/v5/pins', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.message || `Pinterest API error ${r.status}`);
    }
    return r.json();
  },
  async getBoards(accessToken) {
    const r = await fetch('https://api.pinterest.com/v5/boards?page_size=25', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!r.ok) return [];
    const data = await r.json();
    return (data.items || []).map((b) => ({ id: b.id, name: b.name }));
  },
};

export const TIKTOK = {
  id: 'tiktok',
  name: 'TikTok',
  authorizeUrl: 'https://www.tiktok.com/v2/auth/authorize/',
  tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
  scopes: 'user.info.basic,video.publish',
  extraAuthParams: {},
  clientCredentialsInBody: true,
  async post(accessToken, text) {
    // TikTok Direct Post requires a video file. Text-only is not supported.
    // The Content Posting API uses video upload, not text posts.
    throw new Error(
      'TikTok API requires a video file for posting. Text-only posts are not supported. ' +
        'In dev mode, posts are private and limited to 5 accounts until your app passes TikTok audit.'
    );
  },
};

// ---- Post-OAuth auto-configuration: fetch pages / boards / accounts ----

/**
 * After a successful OAuth connection, automatically fetch platform-specific
 * configuration (Facebook pages, Pinterest boards, Threads user ID, Instagram
 * business account) and store them in the platform's extra credentials.
 */
export async function autoConfigurePlatform(userId, platformId) {
  // Dynamic import to avoid circular dependency (oauth.js <-> platforms/index.js)
  const { getValidAccessToken } = await import('../oauth.js');

  const users = getUsers();
  const user = users[userId];
  if (!user) return;
  if (!user.platformCredentials) user.platformCredentials = {};

  // Check for OAuth 1.0a creds on X (no OAuth 2.0 token needed)
  const xCreds = user.platformCredentials.x?.extra || {};
  const hasOAuth1a = platformId === 'x' && xCreds.consumerKey && xCreds.accessToken;

  const token = hasOAuth1a ? 'oauth1a' : await getValidAccessToken(userId, platformId);
  if (!token) return;

  const platform = PLATFORM_APIS[platformId];
  if (!platform) return;

  const mergeExtra = (pid, extra) => {
    if (!user.platformCredentials[pid]) return;
    user.platformCredentials[pid].extra = { ...user.platformCredentials[pid].extra, ...extra };
  };

  // X/Twitter: fetch authenticated user profile -> update channel handle & followers
  if (platformId === 'x') {
    if (hasOAuth1a) {
      // OAuth 1.0a: use v1.1 account/verify_credentials.json
      try {
        const url = 'https://api.twitter.com/1.1/account/verify_credentials.json';
        const authHeader = oauth1aAuthHeader(
          'GET', url, {},
          xCreds.consumerKey, xCreds.consumerSecret || '',
          xCreds.accessToken, xCreds.accessTokenSecret || ''
        );
        const r = await fetch(url, {
          headers: { Authorization: authHeader },
        });
        if (r.ok) {
          const profile = await r.json();
          const ch = user.channels?.find((c) => c.id === 'x');
          if (ch && profile) {
            if (profile.screen_name) ch.handle = '@' + profile.screen_name;
            if (profile.followers_count != null) {
              ch.followers = profile.followers_count;
            }
          }
        }
      } catch { /* profile fetch may fail */ }
    } else {
      // OAuth 2.0: use v2 users/me
      try {
        const r = await fetch('https://api.twitter.com/2/users/me?user.fields=public_metrics', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r.ok) {
          const { data } = await r.json();
          const ch = user.channels?.find((c) => c.id === 'x');
          if (ch && data) {
            if (data.username) ch.handle = '@' + data.username;
            if (data.public_metrics?.followers_count != null) {
              ch.followers = data.public_metrics.followers_count;
            }
          }
        }
      } catch { /* profile fetch may fail if users.read scope missing */ }
    }
  }

  // LinkedIn: fetch member profile → update channel handle
  if (platformId === 'linkedin') {
    try {
      const r = await fetch('https://api.linkedin.com/v2/userinfo', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const me = await r.json();
        const ch = user.channels?.find((c) => c.id === 'linkedin');
        if (ch && me.name) {
          ch.handle = '/in/' + me.name.toLowerCase().replace(/\s+/g, '-');
        }
      }
    } catch { /* profile fetch may fail */ }

    // LinkedIn: fetch Company Pages the user administers → store for the "post as" picker.
    // Only runs when Company Page posting is enabled (the opt-in w_organization_social scope);
    // otherwise posts go out as the member and stale org targets are left untouched.
    // Legacy users with pages stored from before the opt-in flag existed still count.
    const liExtra = user.platformCredentials.linkedin?.extra || {};
    const orgPostingEnabled = liExtra.enableOrgPosting === true || (liExtra.linkedinOrgPages?.length || 0) > 0;
    if (orgPostingEnabled) {
      try {
        const pages = await LINKEDIN.getOrganizationPages(token);
        const current = user.platformCredentials.linkedin?.extra?.orgId;
        const keep = current === '' || (current && pages.some((p) => p.id === current));
        mergeExtra('linkedin', {
          linkedinOrgPages: pages,
          ...(keep ? {} : { orgId: pages.length ? pages[0].id : '' }),
        });
      } catch { /* org pages fetch may fail if w_organization_social scope missing */ }
    }
  }

  // Instagram: fetch pages → get IG business account from first page.
  // Also cross-populate Facebook's pageId if not already set.
  if (platformId === 'instagram') {
    try {
      const pages = await FACEBOOK.getPages(token);
      if (pages.length > 0) {
        mergeExtra('facebook', { pageId: pages[0].id, pageToken: pages[0].token });
        const ig = await INSTAGRAM.getIGAccounts(token, pages[0].id);
        if (ig) mergeExtra('instagram', { igUserId: ig.id });
      }
    } catch { /* pages or IG account may not be available */ }
  }

  // Facebook: fetch pages → store pageId + pageToken. Also cross-populate Instagram.
  if (platformId === 'facebook') {
    try {
      const pages = await FACEBOOK.getPages(token);
      if (pages.length > 0) {
        mergeExtra('facebook', { pageId: pages[0].id, pageToken: pages[0].token });
        // Try to find Instagram business account connected to the first page
        try {
          const ig = await INSTAGRAM.getIGAccounts(token, pages[0].id);
          if (ig) mergeExtra('instagram', { igUserId: ig.id });
        } catch { /* Instagram may not be connected to any page */ }
      }
    } catch { /* pages fetch may fail if permissions missing */ }
  }

  // YouTube: fetch channel snippet & stats → update handle & subscribers
  if (platformId === 'youtube') {
    try {
      const r = await fetch(
        'https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (r.ok) {
        const data = await r.json();
        const ch = user.channels?.find((c) => c.id === 'youtube');
        const item = data.items?.[0];
        if (ch && item) {
          if (item.snippet?.customUrl) ch.handle = item.snippet.customUrl;
          else if (item.snippet?.title) ch.handle = '/channel/' + item.snippet.title;
          if (item.statistics?.subscriberCount != null) {
            ch.followers = parseInt(item.statistics.subscriberCount, 10) || 0;
          }
        }
      }
    } catch { /* channel fetch may fail */ }
  }

  // TikTok: fetch creator info → update channel handle & followers
  if (platformId === 'tiktok') {
    try {
      const r = await fetch('https://open.tiktokapis.com/v2/user/info/', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        const { data } = await r.json();
        const info = data?.user;
        const ch = user.channels?.find((c) => c.id === 'tiktok');
        if (ch && info) {
          if (info.display_name) ch.handle = '@' + info.display_name.replace(/\s+/g, '');
          if (info.follower_count != null) ch.followers = info.follower_count;
        }
      }
    } catch { /* user info fetch may fail */ }
  }

  // Threads: fetch user ID from /me
  if (platformId === 'threads') {
    try {
      const r = await fetch(`https://graph.facebook.com/v26.0/me?fields=id&access_token=${token}`);
      if (r.ok) {
        const data = await r.json();
        if (data.id) mergeExtra('threads', { threadsUserId: data.id });
      }
    } catch { /* may fail if token lacks threads_basic scope */ }
  }

  // Pinterest: fetch boards → store first board's ID
  if (platformId === 'pinterest') {
    try {
      const boards = await PINTEREST.getBoards(token);
      if (boards.length > 0) mergeExtra('pinterest', { boardId: boards[0].id });
    } catch { /* boards fetch may fail */ }
  }

  save();
}

// Map of all real-platform integrations keyed by channel ID
export const PLATFORM_APIS = {
  x: X,
  linkedin: LINKEDIN,
  facebook: FACEBOOK,
  instagram: INSTAGRAM,
  threads: THREADS,
  youtube: YOUTUBE,
  pinterest: PINTEREST,
  tiktok: TIKTOK,
};

// Platforms that can actually post text (even with limitations noted)
export const TEXT_POSTABLE = ['x', 'linkedin', 'facebook', 'threads'];
// Platforms that need media
export const MEDIA_ONLY = ['instagram', 'tiktok', 'pinterest', 'youtube'];
// Platforms with no API at all
export const SIMULATED_ONLY = ['snapchat', 'indeed', 'website', 'resume'];
