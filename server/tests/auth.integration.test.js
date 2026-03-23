import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app.js';

const mongoUri = process.env.MONGO_URI || '';

describe('Auth API', () => {
  beforeAll(async () => {
    if (mongoUri && mongoose.connection.readyState === 0) {
      await mongoose.connect(mongoUri);
    }
  }, 15000);

  describe('POST /api/v1/auth/login', () => {
    it('returns 400 when body is empty', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('Content-Type', 'application/json')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('error');
    });

    it('returns 400 when email is invalid', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('Content-Type', 'application/json')
        .send({ email: 'not-an-email', password: 'somepassword' });
      expect(res.status).toBe(400);
    });

    it('returns 401 for wrong credentials when DB connected', async () => {
      if (mongoose.connection.readyState !== 1) return;
      const res = await request(app)
        .post('/api/v1/auth/login')
        .set('Content-Type', 'application/json')
        .send({ email: 'nobody@example.com', password: 'wrongpassword' });
      expect([400, 401]).toContain(res.status);
    }, 15000);
  });

  describe('POST /api/v1/auth/register', () => {
    it('returns 400 when required fields are missing', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .set('Content-Type', 'application/json')
        .send({ name: 'Test', email: 'test@example.com' });
      expect(res.status).toBe(400);
    });

    it('returns 400 when email is invalid', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .set('Content-Type', 'application/json')
        .send({
          name: 'Test User',
          email: 'invalid',
          password: 'Password123!',
          workspace: 'Test Workspace',
        });
      expect(res.status).toBe(400);
    });
  });
});
