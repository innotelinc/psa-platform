// Credentials & store migration tests.
// saveCredentials must never wipe stored Client ID/Secret when only extra fields
// (page IDs, boards, OAuth 1.0a keys) are updated, and legacy db.json records
// must be back-filled so old users don't crash endpoints.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';

let store;
let oauth;

before(async () => {
  process.env.DB_IN_MEMORY = '1';
  store = await import('../store.js');
  oauth = await import('../oauth.js');
  const { addUser, defaultState } = store;
  addUser({
    id: 'creds-user',
    name: 'Creds Tester',
    email: 'creds@test.com',
    salt: 's',
    hash: 'h',
    token: 't',
    ...defaultState('Creds Tester', 'creds@test.com'),
  });
});

after(() => {
  setTimeout(() => process.exit(0), 50);
});

describe('saveCredentials — partial updates preserve stored values', () => {
  it('stores initial clientId, clientSecret and extra', () => {
    oauth.saveCredentials('creds-user', 'facebook', 'ABC123', 'SEC456', { pageId: '111' });
    const c = store.getUsers()['creds-user'].platformCredentials.facebook;
    assert.strictEqual(c.clientId, 'ABC123');
    assert.strictEqual(c.clientSecret, 'SEC456');
    assert.strictEqual(c.extra.pageId, '111');
  });

  it('extra-only update keeps clientId/clientSecret and merges extra', () => {
    oauth.saveCredentials('creds-user', 'facebook', undefined, undefined, { pageToken: 'tok' });
    const c = store.getUsers()['creds-user'].platformCredentials.facebook;
    assert.strictEqual(c.clientId, 'ABC123', 'clientId must be preserved');
    assert.strictEqual(c.clientSecret, 'SEC456', 'clientSecret must be preserved');
    assert.strictEqual(c.extra.pageToken, 'tok');
    assert.strictEqual(c.extra.pageId, '111', 'previous extra is merged, not replaced');
  });

  it('explicit empty strings clear credentials; replaceExtra replaces the extra object', () => {
    oauth.saveCredentials('creds-user', 'facebook', '', '', { pageId: '222' }, true);
    const c = store.getUsers()['creds-user'].platformCredentials.facebook;
    assert.strictEqual(c.clientId, '');
    assert.strictEqual(c.clientSecret, '');
    assert.strictEqual(c.extra.pageId, '222');
    assert.strictEqual(c.extra.pageToken, undefined, 'replaceExtra drops the old extra keys');
  });
});

describe('store migrate — legacy records get backfilled', () => {
  it('fills missing top-level state, arrays and nested objects', () => {
    const db = { users: { legacy: { id: 'legacy', name: 'Old', email: 'old@test.com', channels: [], campaigns: 'not-an-array' } } };
    store.migrate(db);
    const u = db.users.legacy;
    assert.ok(u.settings && typeof u.settings === 'object', 'settings backfilled');
    assert.ok(u.profile && typeof u.profile === 'object', 'profile backfilled');
    assert.ok(u.resume && typeof u.resume === 'object', 'resume backfilled');
    assert.ok(u.site && typeof u.site === 'object', 'site backfilled');
    assert.ok(u.fame && Array.isArray(u.fame.history), 'fame backfilled');
    assert.strictEqual(u.channels.length, 12, 'empty channels backfilled to all platforms');
    assert.ok(Array.isArray(u.campaigns), 'campaigns normalized');
    assert.ok(Array.isArray(u.posts), 'posts backfilled');
    assert.ok(Array.isArray(u.activity), 'activity backfilled');
    assert.ok(u.platformCredentials && typeof u.platformCredentials === 'object', 'platformCredentials backfilled');
  });

  it('is idempotent — existing values are never overwritten', () => {
    const db = {
      users: {
        legacy: {
          id: 'legacy', name: 'Old', email: 'old@test.com',
          channels: [{ id: 'x', enabled: true }],
          settings: { brand: { voice: 'pro' } },
        },
      },
    };
    store.migrate(db);
    const u = db.users.legacy;
    assert.strictEqual(u.channels.length, 1, 'non-empty channels untouched');
    assert.strictEqual(u.settings.brand.voice, 'pro', 'existing settings untouched');
    assert.ok(u.settings.ai && typeof u.settings.ai === 'object', 'nested settings merge keeps missing keys');
  });
});
