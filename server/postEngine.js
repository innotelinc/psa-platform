// Post engine — routes publishing to real APIs or simulated fallback.
import { getValidAccessToken } from './oauth.js';
import { PLATFORM_APIS, TEXT_POSTABLE, MEDIA_ONLY, SIMULATED_ONLY } from './platforms/index.js';
import { getUsers } from './store.js';

/**
 * Attempt to post content to a platform via its real API.
 * Falls back to simulation if no credentials/tokens, or if the platform
 * doesn't support text-only posting.
 *
 * Returns { success, real, result?, error?, simulated? }
 */
export async function postToPlatform(userId, channelId, text) {
  // Simulated-only platforms
  if (SIMULATED_ONLY.includes(channelId)) {
    return { success: true, real: false, simulated: true };
  }

  const platform = PLATFORM_APIS[channelId];
  if (!platform) {
    return { success: true, real: false, simulated: true };
  }

  // If platform only supports media, we can't post text — simulate with clear note
  if (MEDIA_ONLY.includes(channelId)) {
    return {
      success: true,
      real: false,
      simulated: true,
      error: `${platform.name} requires media (image/video). Post was simulated — attach media to post for real.`,
    };
  }

  // Get platform-specific extra config (page ID, board ID, OAuth 1.0a keys, etc.)
  const users = getUsers();
  const user = users[userId];
  const creds = user?.platformCredentials?.[channelId]?.extra || {};

  // X/Twitter OAuth 1.0a: uses consumer keys directly, no OAuth2 bearer token needed
  const hasOAuth1a = channelId === 'x' && creds.consumerKey && creds.accessToken;

  // Get a valid access token (only needed for OAuth 2.0 flows)
  const token = hasOAuth1a ? 'oauth1a' : await getValidAccessToken(userId, channelId);
  if (!token) {
    return { success: true, real: false, simulated: true };
  }

  try {
    const result = await platform.post(token, text, creds);
    return { success: true, real: true, result };
  } catch (err) {
    return {
      success: true, // Don't break the flow — fall back silently
      real: false,
      simulated: true,
      error: err.message,
    };
  }
}

/**
 * Post to multiple platforms. Returns per-platform results.
 */
export async function postToPlatforms(userId, channelIds, text) {
  const results = {};
  for (const cid of channelIds) {
    results[cid] = await postToPlatform(userId, cid, text);
  }
  return results;
}

/**
 * Check if a real post is possible (credentials configured + valid token).
 */
export async function canPostReal(userId, channelId) {
  if (SIMULATED_ONLY.includes(channelId)) return false;
  if (MEDIA_ONLY.includes(channelId)) return false; // needs media
  const token = await getValidAccessToken(userId, channelId);
  return !!token;
}
