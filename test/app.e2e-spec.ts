import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { createTestApp } from './utils/create-test-app';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp({
      controllers: [AppController],
      providers: [AppService],
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/health', () => {
    it('retorna 200 con status ok', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/health')
        .expect(200);

      expect(res.body.status).toBe('ok');
      expect(res.body.timestamp).toBeDefined();
      expect(res.body.version).toBeDefined();
    });

    it('no requiere Authorization header', () => {
      return request(app.getHttpServer()).get('/api/health').expect(200);
    });
  });
});
