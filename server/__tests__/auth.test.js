// Auth endpoint tests — forgot-password flow
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import supertest from 'supertest';

// Use in-memory store so tests are isolated and don't touch disk
const { app } = await import('../index.js');
const request = supertest(app);

describe('POST /api/auth/forgot-password', () => {
  before(async () => {
    // Seed a known user via the register endpoint so the store has a real entry
    await request
      .post('/api/auth/register')
      .send({ name: 'Test User', email: 'test@example.com', password: 'oldpass123' })
      .expect(200);
  });

  it('should reset password for a known email and return new credentials', async () => {
    const res = await request
      .post('/api/auth/forgot-password')
      .send({ email: 'test@example.com' })
      .expect(200);

    assert.ok(res.body.message);
    assert.ok(res.body.newPassword);
    assert.strictEqual(typeof res.body.newPassword, 'string');
    assert.ok(res.body.newPassword.length >= 1, 'new password should not be empty');
  });

  it('should return 400 when email is missing', async () => {
    const res = await request
      .post('/api/auth/forgot-password')
      .send({})
      .expect(400);

    assert.ok(res.body.error);
  });

  it('should return 400 when email is empty string', async () => {
    const res = await request
      .post('/api/auth/forgot-password')
      .send({ email: '' })
      .expect(400);

    assert.ok(res.body.error);
  });

  it('should return 404 for an email that does not exist', async () => {
    const res = await request
      .post('/api/auth/forgot-password')
      .send({ email: 'nobody@nowhere.com' })
      .expect(404);

    assert.ok(res.body.error);
  });

  it('should be case-insensitive for email lookup', async () => {
    const res = await request
      .post('/api/auth/forgot-password')
      .send({ email: 'Test@Example.Com' })
      .expect(200);

    assert.ok(res.body.newPassword);
  });

  it('should invalidate old token after password reset', async () => {
    // Register a fresh user so we have a clean state
    await request
      .post('/api/auth/register')
      .send({ name: 'Token Test', email: 'token-test@example.com', password: 'secret123' })
      .expect(200);

    // Login to get a valid token
    const loginRes = await request
      .post('/api/auth/login')
      .send({ email: 'token-test@example.com', password: 'secret123' })
      .expect(200);

    const oldToken = loginRes.body.token;

    // Reset password
    await request
      .post('/api/auth/forgot-password')
      .send({ email: 'token-test@example.com' })
      .expect(200);

    // The old token should not work anymore
    const authRes = await request
      .get('/api/state')
      .set('Authorization', `Bearer ${oldToken}`)
      .expect(401);
    assert.ok(authRes.body.error);
  });

  it('should allow login with the new password after reset', async () => {
    // Register a fresh user for this test
    await request
      .post('/api/auth/register')
      .send({ name: 'Login Test', email: 'login-test@example.com', password: 'before123' })
      .expect(200);

    const resetRes = await request
      .post('/api/auth/forgot-password')
      .send({ email: 'login-test@example.com' })
      .expect(200);

    const newPassword = resetRes.body.newPassword;

    // Login with new password should succeed
    const loginRes = await request
      .post('/api/auth/login')
      .send({ email: 'login-test@example.com', password: newPassword })
      .expect(200);

    assert.ok(loginRes.body.token);
  });

  // Force exit after tests — imported modules keep the event loop open
  after(() => {
    setTimeout(() => process.exit(0), 50);
  });
});
