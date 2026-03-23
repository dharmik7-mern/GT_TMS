import request from 'supertest';
import app from '../app.js';

describe('Health endpoints', () => {
  describe('GET /healthz', () => {
    it('returns 200 and { ok: true }', async () => {
      const res = await request(app).get('/healthz');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ ok: true });
    });
  });

  describe('GET /readyz', () => {
    it('returns JSON with ok and db fields', async () => {
      const res = await request(app).get('/readyz');
      expect([200, 503]).toContain(res.status);
      expect(res.body).toHaveProperty('ok');
      expect(typeof res.body.ok).toBe('boolean');
      if (res.status === 200) {
        expect(res.body.db).toBe('connected');
      } else {
        expect(res.body.db).toBe('disconnected');
      }
    });
  });
});
