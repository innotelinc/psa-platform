// LinkedIn Company Page tests — org-author posting + admin page discovery
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';

describe('LINKEDIN.post — Company Page authoring', () => {
  let oldFetch;
  let calls = [];

  before(() => {
    oldFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      if (String(url).includes('/v2/userinfo')) {
        return new Response(JSON.stringify({ sub: 'person-123', name: 'Test User' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ id: 'post-1' }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      });
    };
  });

  after(() => {
    globalThis.fetch = oldFetch;
  });

  it('posts as an organization when extra.orgId is set', async () => {
    const { LINKEDIN } = await import('../platforms/index.js');
    calls = [];
    await LINKEDIN.post('tok', 'Hello from Innotel', { orgId: '98765' });
    const postCall = calls.find((c) => c.url.includes('/rest/posts'));
    assert.ok(postCall, 'should call the rest/posts endpoint');
    const body = JSON.parse(postCall.init.body);
    assert.strictEqual(body.author, 'urn:li:organization:98765');
    assert.strictEqual(body.commentary, 'Hello from Innotel');
  });

  it('posts as the person when no orgId is set (backwards compatible)', async () => {
    const { LINKEDIN } = await import('../platforms/index.js');
    calls = [];
    await LINKEDIN.post('tok', 'Hello world');
    const postCall = calls.find((c) => c.url.includes('/rest/posts'));
    assert.ok(postCall, 'should call the rest/posts endpoint');
    const body = JSON.parse(postCall.init.body);
    assert.strictEqual(body.author, 'urn:li:person:person-123');
  });

  it('sends the Restli protocol header on the posts request', async () => {
    const { LINKEDIN } = await import('../platforms/index.js');
    calls = [];
    await LINKEDIN.post('tok', 'Header check', { orgId: '1' });
    const postCall = calls.find((c) => c.url.includes('/rest/posts'));
    assert.strictEqual(postCall.init.headers['X-Restli-Protocol-Version'], '2.0.0');
  });
});

describe('LINKEDIN.getOrganizationPages', () => {
  let oldFetch;
  let calls = [];

  before(() => {
    oldFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      calls.push({ url: String(url), init });
      if (String(url).includes('/organizationalEntityAcls')) {
        return new Response(JSON.stringify({
          elements: [
            { organizationalTarget: 'urn:li:organization:123' },
            { organizationalTarget: 'urn:li:organization:456' },
            { organizationalTarget: 'not-an-org' },
          ],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      if (String(url).includes('/rest/organizations/123')) {
        return new Response(JSON.stringify({ localizedName: 'Innotel', vanityName: 'innotel' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (String(url).includes('/rest/organizations/456')) {
        return new Response('Not found', { status: 404 });
      }
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
  });

  after(() => {
    globalThis.fetch = oldFetch;
  });

  it('returns the pages the user administers, skipping unreadable ones', async () => {
    const { LINKEDIN } = await import('../platforms/index.js');
    const pages = await LINKEDIN.getOrganizationPages('tok');
    assert.deepStrictEqual(pages, [{ id: '123', name: 'Innotel', vanityName: 'innotel' }]);
    // The acl call must carry the Restli header
    const aclCall = calls.find((c) => c.url.includes('/organizationalEntityAcls'));
    assert.strictEqual(aclCall.init.headers['X-Restli-Protocol-Version'], '2.0.0');
  });

  it('returns [] when the acl call fails (no w_organization_social scope)', async () => {
    const { LINKEDIN } = await import('../platforms/index.js');
    globalThis.fetch = async () => new Response('Forbidden', { status: 403 });
    const pages = await LINKEDIN.getOrganizationPages('bad-token');
    assert.deepStrictEqual(pages, []);
    globalThis.fetch = oldFetch;
  });
});

// ------------------------------------------------------------------ API: posting-target selection round trip
describe('POST /api/oauth/:platform/extra — posting target selection', () => {
  let request;

  before(async () => {
    const supertest = (await import('supertest')).default;
    const { app } = await import('../index.js');
    request = supertest(app);
  });

  it('stores an empty orgId (personal profile) and keeps client creds intact', async () => {
    const reg = await request
      .post('/api/auth/register')
      .send({ name: 'Org Tester', email: 'org-target@test.com', password: 'pass1234' })
      .expect(200);
    const token = reg.body.token;

    // Save creds with an org target
    await request
      .put('/api/oauth/linkedin/credentials')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientId: 'cli', clientSecret: 'sec', extra: { orgId: '123', linkedinOrgPages: [{ id: '123', name: 'Innotel' }] } })
      .expect(200);

    // Switch back to personal profile — the '' must survive (the client sends '' so the key isn't dropped)
    await request
      .post('/api/oauth/linkedin/extra')
      .set('Authorization', `Bearer ${token}`)
      .send({ extra: { orgId: '' } })
      .expect(200);

    const state = await request.get('/api/state').set('Authorization', `Bearer ${token}`).expect(200);
    assert.strictEqual(state.body.platformCredentials.linkedin.extra.orgId, '', 'orgId should be reset to personal');
    assert.strictEqual(state.body.platformCredentials.linkedin.configured, true, 'clientId must survive the extra update');
  });

  it('switches to an organization target', async () => {
    const reg = await request
      .post('/api/auth/register')
      .send({ name: 'Org Tester 2', email: 'org-target2@test.com', password: 'pass1234' })
      .expect(200);
    const token = reg.body.token;

    await request
      .put('/api/oauth/linkedin/credentials')
      .set('Authorization', `Bearer ${token}`)
      .send({ clientId: 'cli', clientSecret: 'sec', extra: {} })
      .expect(200);

    await request
      .post('/api/oauth/linkedin/extra')
      .set('Authorization', `Bearer ${token}`)
      .send({ extra: { orgId: '98765' } })
      .expect(200);

    const state = await request.get('/api/state').set('Authorization', `Bearer ${token}`).expect(200);
    assert.strictEqual(state.body.platformCredentials.linkedin.extra.orgId, '98765');
  });

  it('rejects a request without an extra object', async () => {
    const reg = await request
      .post('/api/auth/register')
      .send({ name: 'Org Tester 3', email: 'org-target3@test.com', password: 'pass1234' })
      .expect(200);
    const res = await request
      .post('/api/oauth/linkedin/extra')
      .set('Authorization', `Bearer ${reg.body.token}`)
      .send({})
      .expect(400);
    assert.ok(res.body.error);
  });

  after(() => {
    setTimeout(() => process.exit(0), 50);
  });
});
