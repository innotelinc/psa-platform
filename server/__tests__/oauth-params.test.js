// OAuth parameter tests — PKCE opt-out (Meta + LinkedIn) and optional scopes.
// Meta (FB/IG/Threads) and LinkedIn's classic web flow reject PKCE params, so the
// authorize URL and token exchange must not send code_challenge/code_verifier for them.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';

let oauth;
let store;
let buildAuthorizeUrl;
let handleCallback;

async function seedUser(id, linkedinExtra = {}) {
  const { addUser, defaultState } = store;
  addUser({
    id,
    name: 'OAuth Params',
    email: `${id}@test.com`,
    salt: 's',
    hash: 'h',
    token: 't',
    ...defaultState('OAuth Params', `${id}@test.com`),
    platformCredentials: {
      facebook: { clientId: 'fb-id', clientSecret: 'fb-secret', extra: {} },
      instagram: { clientId: 'ig-id', clientSecret: 'ig-secret', extra: {} },
      threads: { clientId: 'th-id', clientSecret: 'th-secret', extra: {} },
      linkedin: { clientId: 'li-id', clientSecret: 'li-secret', extra: linkedinExtra },
      x: { clientId: 'x-id', clientSecret: 'x-secret', extra: {} },
    },
  });
}

describe('buildAuthorizeUrl — per-platform PKCE behavior', () => {
  before(async () => {
    process.env.DB_IN_MEMORY = '1';
    store = await import('../store.js');
    await seedUser('oauth-params-user');
    ({ buildAuthorizeUrl } = await import('../oauth.js'));
  });

  it('omits code_challenge for facebook, instagram, threads and linkedin', () => {
    for (const pid of ['facebook', 'instagram', 'threads', 'linkedin']) {
      const url = buildAuthorizeUrl('oauth-params-user', pid, 'https://example.com');
      assert.ok(!url.includes('code_challenge'), `${pid} must not send code_challenge: ${url}`);
      assert.ok(!url.includes('code_verifier'), `${pid} must not send code_verifier: ${url}`);
    }
  });

  it('still sends PKCE for platforms that support it (x)', () => {
    const url = buildAuthorizeUrl('oauth-params-user', 'x', 'https://example.com');
    assert.ok(url.includes('code_challenge='), `x should send code_challenge: ${url}`);
    assert.ok(url.includes('code_challenge_method=S256'), `x should use S256: ${url}`);
  });
});

describe('buildAuthorizeUrl — Meta scope names (Instagram + Facebook)', () => {
  before(async () => {
    process.env.DB_IN_MEMORY = '1';
    store = await import('../store.js');
    await seedUser('meta-scopes-user');
    ({ buildAuthorizeUrl } = await import('../oauth.js'));
  });

  it('instagram requests the current instagram_business_* scopes, not the deprecated legacy names', () => {
    const url = buildAuthorizeUrl('meta-scopes-user', 'instagram', 'https://example.com');
    assert.ok(url.includes('instagram_business_basic'), `should request instagram_business_basic: ${url}`);
    assert.ok(url.includes('instagram_business_content_publish'), `should request instagram_business_content_publish: ${url}`);
    assert.ok(url.includes('pages_read_user_content'), 'should request the current page-read permission');
    assert.ok(url.includes('pages_show_list'), 'should request pages_show_list');
    assert.ok(!url.includes('instagram_basic'), 'must not request the deprecated instagram_basic');
    assert.ok(!url.includes('instagram_content_publish'), 'must not request the deprecated instagram_content_publish');
    assert.ok(!url.includes('pages_read_engagement'), 'must not request the rejected pages_read_engagement');
  });

  it('facebook no longer requests pages_read_engagement', () => {
    const url = buildAuthorizeUrl('meta-scopes-user', 'facebook', 'https://example.com');
    assert.ok(url.includes('pages_manage_posts'), 'should request pages_manage_posts');
    assert.ok(url.includes('pages_show_list'), 'should request pages_show_list');
    assert.ok(!url.includes('pages_read_engagement'), 'must not request pages_read_engagement');
  });
});

describe('buildAuthorizeUrl — LinkedIn optional w_organization_social scope', () => {
  before(async () => {
    process.env.DB_IN_MEMORY = '1';
    store = await import('../store.js');
    await seedUser('li-default-user');
    await seedUser('li-org-user', { enableOrgPosting: true });
    ({ buildAuthorizeUrl } = await import('../oauth.js'));
  });

  it('does not request w_organization_social by default', () => {
    const url = buildAuthorizeUrl('li-default-user', 'linkedin', 'https://example.com');
    assert.ok(!url.includes('w_organization_social'), `default scope should exclude it: ${url}`);
    assert.ok(url.includes('w_member_social'), 'member scope stays by default');
  });

  it('requests w_organization_social only when Company Page posting is enabled', () => {
    const url = buildAuthorizeUrl('li-org-user', 'linkedin', 'https://example.com');
    assert.ok(url.includes('w_organization_social'), `enabled user should request the scope: ${url}`);
  });

  it('still requests the scope for legacy users who already have pages stored (no flag yet)', async () => {
    await seedUser('li-legacy-user', { linkedinOrgPages: [{ id: '123', name: 'Innotel' }], orgId: '123' });
    const url = buildAuthorizeUrl('li-legacy-user', 'linkedin', 'https://example.com');
    assert.ok(url.includes('w_organization_social'), `legacy pages should count as enabled: ${url}`);
  });
});

describe('handleCallback — token exchange omits code_verifier for non-PKCE platforms', () => {
  let oldFetch;
  let calls = [];

  before(async () => {
    process.env.DB_IN_MEMORY = '1';
    store = await import('../store.js');
    await seedUser('callback-user');
    ({ handleCallback, buildAuthorizeUrl } = await import('../oauth.js'));

    oldFetch = globalThis.fetch;
    calls = [];
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify({ access_token: 'll-token', expires_in: 5000000 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };
  });

  after(() => {
    globalThis.fetch = oldFetch;
    setTimeout(() => process.exit(0), 50);
  });

  async function exchange(platformId) {
    calls = [];
    const url = buildAuthorizeUrl('callback-user', platformId, 'https://example.com');
    const state = new URL(url).searchParams.get('state');
    await handleCallback(platformId, 'auth-code', state, 'https://example.com');
    // First call is the code→token exchange; subsequent calls are platform-specific
    // extras (e.g. Meta's long-lived token exchange).
    return calls[0];
  }

  it('facebook: no code_verifier, client_secret in body, no Basic auth', async () => {
    const call = await exchange('facebook');
    const body = call.init.body.toString();
    assert.ok(!body.includes('code_verifier'), `no code_verifier for facebook: ${body}`);
    assert.ok(body.includes('client_secret=fb-secret'), `client_secret in body: ${body}`);
    assert.ok(!call.init.headers.Authorization, 'no Basic auth header for facebook');
  });

  it('instagram: no code_verifier', async () => {
    const call = await exchange('instagram');
    assert.ok(!call.init.body.toString().includes('code_verifier'));
  });

  it('linkedin: no code_verifier, client_secret in body', async () => {
    const call = await exchange('linkedin');
    const body = call.init.body.toString();
    assert.ok(!body.includes('code_verifier'), `no code_verifier for linkedin: ${body}`);
    assert.ok(body.includes('client_secret=li-secret'), `client_secret in body: ${body}`);
    assert.ok(!call.init.headers.Authorization, 'no Basic auth header for linkedin');
  });

  it('x: still sends code_verifier', async () => {
    const call = await exchange('x');
    assert.ok(call.init.body.toString().includes('code_verifier'), 'x keeps the PKCE verifier');
  });
});
