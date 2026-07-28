import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { hashPassword } from '@cryptoai/database';
import { createApp } from '../src/app.js';

import { InMemoryAuthStore } from '../src/auth/inMemorySessionStore.js';
import { InMemoryRateLimiter } from '../src/auth/rateLimiter.js';

const authConfig = {
  appOrigin: 'http://localhost:3001',
  apiBaseUrl: 'http://localhost:4000',
  sessionTtlSeconds: 3600,
  sessionCookieSecure: false,
  loginRateLimitMaxAttempts: 5,
  loginRateLimitWindowSeconds: 60,
};

async function buildApp() {
  const store = new InMemoryAuthStore();
  store.addUser({
    id: 'user-1',
    username: 'owner',
    passwordHash: await hashPassword('password'),
    role: 'OWNER',
  });
  return createApp({
    authStore: store,
    authConfig,
    rateLimiter: new InMemoryRateLimiter(5, 60_000),
  });
}

async function login(app: ReturnType<typeof createApp>): Promise<string> {
  const response = await request(app)
    .post('/auth/login')
    .send({ username: 'owner', password: 'password' });
  const cookies = response.headers['set-cookie'];
  const cookie = Array.isArray(cookies) ? cookies[0] : cookies;
  if (!cookie) throw new Error('Login did not set a session cookie');
  return cookie.split(';')[0] ?? '';
}

describe('GET /market-data/history', () => {
  it('requires the owner session', async () => {
    const app = await buildApp();
    const res = await request(app).get('/market-data/history');
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing symbol after authentication', async () => {
    const app = await buildApp();
    const res = await request(app)
      .get('/market-data/history')
      .set('Cookie', await login(app));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid symbol after authentication', async () => {
    const app = await buildApp();
    const res = await request(app)
      .get('/market-data/history?symbol=DOGEUSDT')
      .set('Cookie', await login(app));
    expect(res.status).toBe(400);
  });
});
