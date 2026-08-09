// Build info & health endpoint tests
import { describe, it, after } from 'node:test';
import assert from 'node:assert';
import supertest from 'supertest';

// Use in-memory store so tests are isolated and don't touch disk
const { app } = await import('../index.js');
const request = supertest(app);

describe('GET /health', () => {
  it('returns ok with service + build info (no auth required)', async () => {
    const res = await request.get('/health').expect(200);
    assert.strictEqual(res.body.ok, true);
    assert.strictEqual(res.body.service, 'fameforge');
    assert.ok(typeof res.body.build === 'string' && res.body.build.length > 0);
    assert.ok(typeof res.body.uptime === 'number');
  });
});

describe('GET /api/version', () => {
  it('returns build metadata (no auth required)', async () => {
    const res = await request.get('/api/version').expect(200);
    assert.ok(typeof res.body.commit === 'string' && res.body.commit.length > 0);
  });

  it('never exposes sensitive data', async () => {
    const res = await request.get('/api/version').expect(200);
    const keys = Object.keys(res.body);
    for (const k of keys) {
      assert.ok(['commit', 'date', 'describe', 'buildTime', 'source'].includes(k), `unexpected key: ${k}`);
    }
  });
});

// Force exit after tests — imported modules keep the event loop open
after(() => {
  setTimeout(() => process.exit(0), 50);
});
