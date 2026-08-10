// Post publish flow tests — immediate publish, multi-channel results, failed status.
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import supertest from 'supertest';

// In-memory store so tests are isolated and don't touch disk
process.env.DB_IN_MEMORY = '1';
const store = await import('../store.js');
const { app } = await import('../index.js');
const request = supertest(app);

function seedUser(id, overrides = {}) {
  const { addUser, defaultState } = store;
  addUser({
    id,
    name: 'Post Tester',
    email: `${id}@test.com`,
    salt: 's',
    hash: 'h',
    token: `tok-${id}`,
    ...defaultState('Post Tester', `${id}@test.com`),
    ...overrides,
  });
}

const channelsFor = (...ids) =>
  ids.map((id) => ({ id, enabled: true, connected: true, handle: `@${id}`, followers: 100, posts: 0 }));

describe('posts — publish flow', () => {
  let oldFetch;

  before(() => {
    seedUser('publish-user', { channels: channelsFor('x', 'linkedin') });
    for (const id of ['fail-user', 'batch-user']) {
      seedUser(id, {
        channels: channelsFor('x'),
        platformCredentials: {
          x: {
            clientId: 'x-id',
            clientSecret: 'x-secret',
            extra: { consumerKey: 'ck', consumerSecret: 'cs', accessToken: 'at', accessTokenSecret: 'ats' },
          },
        },
      });
    }
    oldFetch = globalThis.fetch;
  });

  after(() => {
    globalThis.fetch = oldFetch;
    setTimeout(() => process.exit(0), 50);
  });

  it('createPost without publish stays a draft (scheduling path unchanged)', async () => {
    const res = await request.post('/api/posts')
      .set('Authorization', 'Bearer tok-publish-user')
      .send({ channelIds: ['x'], content: 'Scheduled later' })
      .expect(200);
    assert.strictEqual(res.body.status, 'draft');
    assert.strictEqual(res.body.results, null);
  });

  it('createPost with publish:true sends immediately to EVERY channel with per-channel results', async () => {
    const res = await request.post('/api/posts')
      .set('Authorization', 'Bearer tok-publish-user')
      .send({ channelIds: ['x', 'linkedin'], content: 'Hello all platforms', publish: true })
      .expect(200);
    assert.strictEqual(res.body.status, 'published');
    assert.ok(Array.isArray(res.body.results), 'results array present');
    assert.strictEqual(res.body.results.length, 2, 'one result per channel');
    assert.deepStrictEqual(res.body.results.map((r) => r.channelId).sort(), ['linkedin', 'x']);
    for (const r of res.body.results) {
      assert.strictEqual(r.ok, false, 'no creds → not a real send');
      assert.strictEqual(r.simulated, true, 'falls back to simulation');
      assert.ok(!r.error, 'no error when simulated without creds');
    }
    assert.ok(res.body.publishedAt, 'publishedAt set');
  });

  it('POST /api/posts/:id/publish returns per-channel results (resend path)', async () => {
    const created = await request.post('/api/posts')
      .set('Authorization', 'Bearer tok-publish-user')
      .send({ channelIds: ['x'], content: 'Resend me', publish: true })
      .expect(200);
    const res = await request.post(`/api/posts/${created.body.id}/publish`)
      .set('Authorization', 'Bearer tok-publish-user')
      .expect(200);
    assert.strictEqual(res.body.status, 'published');
    assert.strictEqual(res.body.results.length, 1);
    assert.strictEqual(res.body.results[0].channelId, 'x');
  });

  it('marks a post failed when every channel API call errors', async () => {
    // Stub fetch so X's v1.1 update throws a real API error
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ errors: [{ message: 'Forbidden: tweet blocked' }] }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    try {
      const res = await request.post('/api/posts')
        .set('Authorization', 'Bearer tok-fail-user')
        .send({ channelIds: ['x'], content: 'This will fail', publish: true })
        .expect(200);
      assert.strictEqual(res.body.status, 'failed');
      assert.ok(res.body.results[0].error.includes('Forbidden'));
    } finally {
      globalThis.fetch = oldFetch;
    }
  });

  it('POST /api/posts/resend-failed retries every failed post in one call', async () => {
    const failFetch = async () =>
      new Response(JSON.stringify({ errors: [{ message: 'Forbidden' }] }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });

    // Create two failed posts for the batch user
    for (let i = 0; i < 2; i++) {
      globalThis.fetch = failFetch;
      try {
        const created = await request.post('/api/posts')
          .set('Authorization', 'Bearer tok-batch-user')
          .send({ channelIds: ['x'], content: `Batch retry ${i}`, publish: true })
          .expect(200);
        assert.strictEqual(created.body.status, 'failed');
      } finally {
        globalThis.fetch = oldFetch;
      }
    }

    // API still failing → resend-all keeps them failed
    globalThis.fetch = failFetch;
    try {
      const retry = await request.post('/api/posts/resend-failed')
        .set('Authorization', 'Bearer tok-batch-user')
        .expect(200);
      assert.strictEqual(retry.body.resent, 0);
      assert.strictEqual(retry.body.stillFailed, 2);
    } finally {
      globalThis.fetch = oldFetch;
    }

    // API now succeeds → resend-all publishes both
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ data: { id: '123' } }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    try {
      const retry = await request.post('/api/posts/resend-failed')
        .set('Authorization', 'Bearer tok-batch-user')
        .expect(200);
      assert.strictEqual(retry.body.resent, 2);
      assert.strictEqual(retry.body.stillFailed, 0);
      assert.strictEqual(retry.body.posts.length, 2);
      for (const p of retry.body.posts) {
        assert.strictEqual(p.status, 'published');
        assert.strictEqual(p.results[0].ok, true);
      }
    } finally {
      globalThis.fetch = oldFetch;
    }

    // Nothing left failed → no-op
    const empty = await request.post('/api/posts/resend-failed')
      .set('Authorization', 'Bearer tok-batch-user')
      .expect(200);
    assert.strictEqual(empty.body.resent, 0);
    assert.strictEqual(empty.body.stillFailed, 0);
    assert.deepStrictEqual(empty.body.posts, []);
  });

  it('DELETE /api/posts/:id removes any post (history cleanup)', async () => {
    const created = await request.post('/api/posts')
      .set('Authorization', 'Bearer tok-publish-user')
      .send({ channelIds: ['x'], content: 'Delete me', publish: true })
      .expect(200);
    const res = await request.delete(`/api/posts/${created.body.id}`)
      .set('Authorization', 'Bearer tok-publish-user')
      .expect(200);
    assert.deepStrictEqual(res.body, { ok: true });
  });
});
