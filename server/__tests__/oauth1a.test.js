// OAuth 1.0a tests — signing helpers + postEngine routing
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';

// ------------------------------------------------------------------ Unit: signing helpers
import { percentEncode, oauth1aSignature, oauth1aAuthHeader } from '../platforms/index.js';

describe('percentEncode', () => {
  it('should encode spaces as %20 (not +)', () => {
    assert.strictEqual(percentEncode('hello world'), 'hello%20world');
  });

  it('should not double-encode already-encoded characters', () => {
    assert.strictEqual(percentEncode('abc123_-.'), 'abc123_-.');
  });

  it('should encode RFC 3986 reserved characters that encodeURIComponent misses', () => {
    // encodeURIComponent does NOT encode: ! ' ( ) *
    // Our percentEncode should encode them
    const result = percentEncode("!'()*");
    // Each char gets its hex code
    assert.ok(result.includes('%21'), `Expected %21 for !, got: ${result}`);
    assert.ok(result.includes('%27'), `Expected %27 for ', got: ${result}`);
    assert.ok(result.includes('%28'), `Expected %28 for (, got: ${result}`);
    assert.ok(result.includes('%29'), `Expected %29 for ), got: ${result}`);
    assert.ok(result.includes('%2A'), `Expected %2A for *, got: ${result}`);
  });

  it('should encode = as %3D', () => {
    assert.strictEqual(percentEncode('a=b'), 'a%3Db');
  });

  it('should encode & as %26', () => {
    assert.strictEqual(percentEncode('a&b'), 'a%26b');
  });
});

describe('oauth1aSignature', () => {
  it('should produce a valid base64 HMAC-SHA1 signature', () => {
    const sig = oauth1aSignature(
      'POST',
      'https://api.twitter.com/2/tweets',
      { oauth_consumer_key: 'ck', oauth_nonce: 'nonce', oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: '1234567890', oauth_token: 'tk', oauth_version: '1.0' },
      'csecret',
      'tsecret'
    );
    // Should be a non-empty base64 string
    assert.ok(sig, 'signature should not be empty');
    assert.strictEqual(typeof sig, 'string');
    // Base64 regex: [A-Za-z0-9+/]+={0,2}
    assert.ok(/^[A-Za-z0-9+/]+={0,2}$/.test(sig), `Invalid base64: ${sig}`);
  });

  it('should produce deterministic output for fixed inputs', () => {
    const sig1 = oauth1aSignature('POST', 'http://x.com/a', { k: 'v' }, 'cs', 'ts');
    const sig2 = oauth1aSignature('POST', 'http://x.com/a', { k: 'v' }, 'cs', 'ts');
    assert.strictEqual(sig1, sig2, 'same inputs should produce same signature');
  });

  it('should produce different signatures for different URLs', () => {
    const sig1 = oauth1aSignature('POST', 'http://x.com/a', { k: 'v' }, 'cs', 'ts');
    const sig2 = oauth1aSignature('POST', 'http://x.com/b', { k: 'v' }, 'cs', 'ts');
    assert.notStrictEqual(sig1, sig2, 'different URLs should produce different signatures');
  });

  it('should produce different signatures for different methods', () => {
    const sig1 = oauth1aSignature('GET', 'http://x.com/a', { k: 'v' }, 'cs', 'ts');
    const sig2 = oauth1aSignature('POST', 'http://x.com/a', { k: 'v' }, 'cs', 'ts');
    assert.notStrictEqual(sig1, sig2, 'different methods should produce different signatures');
  });

  it('should produce different signatures for different params', () => {
    const sig1 = oauth1aSignature('POST', 'http://x.com/a', { k: 'v1' }, 'cs', 'ts');
    const sig2 = oauth1aSignature('POST', 'http://x.com/a', { k: 'v2' }, 'cs', 'ts');
    assert.notStrictEqual(sig1, sig2, 'different params should produce different signatures');
  });
});

describe('oauth1aAuthHeader', () => {
  it('should start with "OAuth "', () => {
    const header = oauth1aAuthHeader('POST', 'http://x.com', {}, 'ck', 'cs', 'tk', 'ts');
    assert.ok(header.startsWith('OAuth '), `Header should start with "OAuth ", got: ${header.slice(0, 20)}`);
  });

  it('should contain all required OAuth parameters', () => {
    const header = oauth1aAuthHeader('POST', 'http://x.com', {}, 'ck', 'cs', 'tk', 'ts');
    assert.ok(header.includes('oauth_consumer_key='), 'should contain oauth_consumer_key');
    assert.ok(header.includes('oauth_nonce='), 'should contain oauth_nonce');
    assert.ok(header.includes('oauth_signature_method='), 'should contain oauth_signature_method');
    assert.ok(header.includes('oauth_signature='), 'should contain oauth_signature');
    assert.ok(header.includes('oauth_timestamp='), 'should contain oauth_timestamp');
    assert.ok(header.includes('oauth_token='), 'should contain oauth_token');
    assert.ok(header.includes('oauth_version='), 'should contain oauth_version');
  });

  it('should use HMAC-SHA1 as the signature method', () => {
    const header = oauth1aAuthHeader('POST', 'http://x.com', {}, 'ck', 'cs', 'tk', 'ts');
    assert.ok(header.includes('oauth_signature_method%3D%22HMAC-SHA1%22') ||
      header.includes('oauth_signature_method="HMAC-SHA1"'),
      `should use HMAC-SHA1, got: ${header}`);
  });

  it('should include consumer key in the header', () => {
    const header = oauth1aAuthHeader('POST', 'http://x.com', {}, 'myConsumerKey', 'cs', 'tk', 'ts');
    assert.ok(header.includes('myConsumerKey'), `header should contain consumer key, got: ${header}`);
  });

  it('should include access token in the header', () => {
    const header = oauth1aAuthHeader('POST', 'http://x.com', {}, 'ck', 'cs', 'myToken', 'ts');
    assert.ok(header.includes('myToken'), `header should contain token, got: ${header}`);
  });

  it('should produce different nonces each call', () => {
    const h1 = oauth1aAuthHeader('POST', 'http://x.com', {}, 'ck', 'cs', 'tk', 'ts');
    const h2 = oauth1aAuthHeader('POST', 'http://x.com', {}, 'ck', 'cs', 'tk', 'ts');
    const nonce1 = h1.match(/oauth_nonce="([^"]+)"/)?.[1];
    const nonce2 = h2.match(/oauth_nonce="([^"]+)"/)?.[1];
    assert.notStrictEqual(nonce1, nonce2, 'nonces should be different between calls');
  });
});

// ------------------------------------------------------------------ Integration: postEngine OAuth 1.0a routing
describe('postEngine — OAuth 1.0a detection', () => {
  let postToPlatform;
  let oldFetch;
  let fetchCalls;

  before(async () => {
    // Set in-memory store so we don't touch disk
    process.env.DB_IN_MEMORY = '1';

    // Import the store and bootstrap a user with OAuth 1.0a creds
    const store = await import('../store.js');
    const { addUser, defaultState, defaultChannels, getUsers } = store;

    const uid = 'test-user-oauth1a';
    const user = {
      id: uid,
      name: 'OAuth1a Tester',
      email: 'oauth1a@test.com',
      salt: 'salt',
      hash: 'hash',
      token: 'test-token',
      ...defaultState('OAuth1a Tester', 'oauth1a@test.com'),
      // Set up OAuth 1.0a credentials for X
      platformCredentials: {
        x: {
          clientId: '',           // no OAuth 2.0
          clientSecret: '',
          extra: {
            consumerKey: 'test-ck',
            consumerSecret: 'test-cs',
            accessToken: 'test-at',
            accessTokenSecret: 'test-ats',
          },
        },
      },
    };
    addUser(user);

    // Mock fetch to capture the outgoing request
    oldFetch = globalThis.fetch;
    fetchCalls = [];
    globalThis.fetch = async (url, init) => {
      fetchCalls.push({ url, init });
      return new Response(JSON.stringify({ ok: true, id_str: '12345' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };

    // Now import postEngine (fetch mock is in place)
    const engine = await import('../postEngine.js');
    postToPlatform = engine.postToPlatform;
  });

  after(() => {
    globalThis.fetch = oldFetch;
    // Force exit to avoid hanging on event loop
    setTimeout(() => process.exit(0), 100);
  });

  it('should detect OAuth 1.0a and use the v2 /2/tweets endpoint (v1.1 is retired)', async () => {
    const result = await postToPlatform('test-user-oauth1a', 'x', 'Hello OAuth1a test!');

    // Should succeed (real: true since we mocked fetch to return 200)
    assert.ok(result.success, 'post should succeed');
    assert.ok(result.real, 'should be a real post attempt');

    // Verify the fetch was called
    assert.ok(fetchCalls.length >= 1, 'fetch should have been called');
    const call = fetchCalls[0];

    // OAuth 1.0a keys now sign the v2 endpoint — v1.1 statuses/update.json is retired (404)
    assert.strictEqual(call.url, 'https://api.twitter.com/2/tweets');
    assert.ok(!call.url.includes('1.1'), 'must not use the retired v1.1 endpoint');

    // Should have an OAuth Authorization header (not Bearer)
    const authHeader = call.init.headers?.Authorization || call.init.headers?.authorization || '';
    assert.ok(authHeader.startsWith('OAuth '), `should use OAuth header, got: ${authHeader.slice(0, 50)}`);

    // v2 posts send a JSON body with { text }, not form-encoded status
    assert.deepStrictEqual(JSON.parse(call.init.body), { text: 'Hello OAuth1a test!' });
  });

  it('should NOT require OAuth 2.0 bearer token when OAuth 1.0a is configured', async () => {
    fetchCalls.length = 0; // reset
    // This user has no OAuth2 clientId and no OAuth2 token — only OAuth 1.0a keys
    const result = await postToPlatform('test-user-oauth1a', 'x', 'Another test');

    assert.ok(result.success, 'should still succeed with OAuth 1.0a only');
    assert.ok(result.real, 'should attempt real post');

    // Verify no Bearer auth was used
    const call = fetchCalls[0];
    const authHeader = call.init.headers?.Authorization || call.init.headers?.authorization || '';
    assert.ok(!authHeader.startsWith('Bearer'), `should not use Bearer auth, got: ${authHeader.slice(0, 50)}`);
  });

  it('should pass extra creds (consumerKey, consumerSecret, accessToken, accessTokenSecret) to X.post', async () => {
    fetchCalls.length = 0;

    const result = await postToPlatform('test-user-oauth1a', 'x', 'Checking creds');
    assert.ok(result.real);

    // The OAuth 1.0a path constructs an auth header with consumerKey and accessToken
    const call = fetchCalls[0];
    const authHeader = call.init.headers?.Authorization || call.init.headers?.authorization || '';

    // Should contain the consumer key
    assert.ok(authHeader.includes('test-ck'), `should contain consumer key, got header`);
    // Should contain the access token
    assert.ok(authHeader.includes('test-at'), `should contain access token`);
  });

  it('should fall back to simulated when OAuth 1.0a keys are missing', async () => {
    // Add a second user without OAuth 1.0a keys
    const store = await import('../store.js');
    const { addUser, defaultState } = store;

    addUser({
      id: 'test-user-no-keys',
      name: 'No Keys',
      email: 'nokeys@test.com',
      salt: 's2',
      hash: 'h2',
      token: 't2',
      ...defaultState('No Keys', 'nokeys@test.com'),
      platformCredentials: { x: { clientId: '', clientSecret: '', extra: {} } },
    });

    const result = await postToPlatform('test-user-no-keys', 'x', 'Should simulate');
    assert.ok(result.success, 'simulated post should succeed');
    assert.strictEqual(result.real, false, 'should be simulated when no OAuth 2.0 token or OAuth 1.0a keys');
    assert.ok(result.simulated, 'simulated flag should be set');
  });
});
