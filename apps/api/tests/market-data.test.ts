import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
describe('GET /market-data/history', () => {
  it('returns 400 for missing symbol', async () => {
    const app = createApp();
    const res = await request(app).get('/market-data/history');
    expect(res.status).toBe(400);
  });
  it('returns 400 for invalid symbol', async () => {
    const app = createApp();
    const res = await request(app).get('/market-data/history?symbol=DOGEUSDT');
    expect(res.status).toBe(400);
  });
});
