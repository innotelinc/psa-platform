// Platform definitions — OAuth endpoints, scopes, and API posting endpoints.
// Each platform must expose: id, name, authorizeUrl, tokenUrl, scopes, and a post() function.

export const X = {
  id: 'x',
  name: 'X / Twitter',
  authorizeUrl: 'https://twitter.com/i/oauth2/authorize',
  tokenUrl: 'https://api.twitter.com/2/oauth2/token',
  scopes: 'tweet.write users.read offline.access',
  extraAuthParams: { code_challenge_method: 'S256' },
  clientCredentialsInBody: true, // public client — no Basic auth header
  async post(accessToken, text) {
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
  scopes: 'openid profile email w_member_social',
  async post(accessToken, text) {
    // First get the member URN
    const meR = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!meR.ok) throw new Error(`LinkedIn userinfo error ${meR.status}`);
    const me = await meR.json();
    const personUrn = `urn:li:person:${me.sub}`;

    const r = await fetch('https://api.linkedin.com/rest/posts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'LinkedIn-Version': '202505',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        author: personUrn,
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
};

export const FACEBOOK = {
  id: 'facebook',
  name: 'Facebook',
  authorizeUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
  tokenUrl: 'https://graph.facebook.com/v21.0/oauth/access_token',
  scopes: 'pages_manage_posts pages_read_engagement pages_show_list',
  async post(accessToken, text, extra = {}) {
    // Facebook requires a page ID and page access token
    const pageId = extra.pageId;
    const pageToken = extra.pageToken || accessToken;
    if (!pageId) throw new Error('Facebook page ID required. Connect a Facebook Page in Settings.');

    const r = await fetch(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
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
    const r = await fetch(`https://graph.facebook.com/v21.0/me/accounts?access_token=${accessToken}`);
    if (!r.ok) return [];
    const data = await r.json();
    return (data.data || []).map((p) => ({ id: p.id, name: p.name, token: p.access_token }));
  },
};

export const INSTAGRAM = {
  id: 'instagram',
  name: 'Instagram',
  authorizeUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
  tokenUrl: 'https://graph.facebook.com/v21.0/oauth/access_token',
  scopes: 'instagram_basic instagram_content_publish pages_read_engagement pages_show_list',
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
      `https://graph.facebook.com/v21.0/${pageId}?fields=instagram_business_account{id,username}&access_token=${accessToken}`
    );
    if (!r.ok) return null;
    const data = await r.json();
    return data.instagram_business_account || null;
  },
};

export const THREADS = {
  id: 'threads',
  name: 'Threads',
  authorizeUrl: 'https://www.facebook.com/v21.0/dialog/oauth',
  tokenUrl: 'https://graph.facebook.com/v21.0/oauth/access_token',
  scopes: 'threads_basic threads_content_publish',
  async post(accessToken, text, extra = {}) {
    const threadsUserId = extra.threadsUserId;
    if (!threadsUserId) throw new Error('Threads user ID required. Connect Threads in Settings.');

    // Step 1: Create media container
    const container = await fetch(`https://graph.facebook.com/v21.0/${threadsUserId}/threads`, {
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
    const pub = await fetch(`https://graph.facebook.com/v21.0/${threadsUserId}/threads_publish`, {
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
