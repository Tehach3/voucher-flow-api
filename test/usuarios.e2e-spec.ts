import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { UsuariosController } from '../src/modules/usuarios/usuarios.controller';
import { UsuariosService } from '../src/modules/usuarios/usuarios.service';
import { ApiKeyGuard } from '../src/common/guards/api-key.guard';
import { createTestApp, TEST_API_KEY, authHeader } from './utils/create-test-app';

const mockUsuariosService = {
  findAll: jest.fn(),
  findByCedula: jest.fn(),
  updateUsuario: jest.fn(),
};

describe('UsuariosController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.API_KEY = TEST_API_KEY;

    app = await createTestApp({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      controllers: [UsuariosController],
      providers: [
        ApiKeyGuard,
        { provide: UsuariosService, useValue: mockUsuariosService },
      ],
    });
  });

  afterAll(async () => {
    await app.close();
    delete process.env.API_KEY;
  });

  beforeEach(() => jest.clearAllMocks());

  // ── Auth ─────────────────────────────────────────────────────────────────

  describe('Guard de autenticación', () => {
    it('GET /api/usuarios → 401 sin Authorization header', () => {
      return request(app.getHttpServer()).get('/api/usuarios').expect(401);
    });

    it('GET /api/usuarios → 401 con API Key inválida', () => {
      return request(app.getHttpServer())
        .get('/api/usuarios')
        .set('Authorization', 'Bearer invalid-key')
        .expect(401);
    });

    it('GET /api/usuarios → 401 con formato Bearer incorrecto', () => {
      return request(app.getHttpServer())
        .get('/api/usuarios')
        .set('Authorization', TEST_API_KEY)
        .expect(401);
    });
  });

  // ── GET /api/usuarios ─────────────────────────────────────────────────────

  describe('GET /api/usuarios', () => {
    it('retorna lista paginada con API Key válida', async () => {
      const mockResult = { data: [], total: 0, page: 1, limit: 20 };
      mockUsuariosService.findAll.mockResolvedValue(mockResult);

      const res = await request(app.getHttpServer())
        .get('/api/usuarios')
        .set(authHeader())
        .expect(200);

      expect(res.body).toMatchObject({ total: 0, page: 1 });
      expect(mockUsuariosService.findAll).toHaveBeenCalledTimes(1);
    });

    it('pasa parámetros de paginación al servicio', async () => {
      mockUsuariosService.findAll.mockResolvedValue({
        data: [],
        total: 0,
        page: 2,
        limit: 10,
      });

      await request(app.getHttpServer())
        .get('/api/usuarios?page=2&limit=10')
        .set(authHeader())
        .expect(200);

      expect(mockUsuariosService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2, limit: 10 }),
      );
    });
  });

  // ── GET /api/usuarios/:cedula ─────────────────────────────────────────────

  describe('GET /api/usuarios/:cedula', () => {
    it('retorna el usuario cuando existe', async () => {
      const usuario = {
        cedula: '12345678',
        nombre: 'Juan Perez',
        cupones_acumulados: 5,
      };
      mockUsuariosService.findByCedula.mockResolvedValue(usuario);

      const res = await request(app.getHttpServer())
        .get('/api/usuarios/12345678')
        .set(authHeader())
        .expect(200);

      expect(res.body.cedula).toBe('12345678');
    });

    it('retorna 404 cuando el usuario no existe', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      mockUsuariosService.findByCedula.mockRejectedValue(
        new NotFoundException('Usuario no encontrado'),
      );

      const res = await request(app.getHttpServer())
        .get('/api/usuarios/99999999')
        .set(authHeader())
        .expect(404);

      expect(res.body.statusCode).toBe(404);
    });
  });

  // ── PATCH /api/usuarios/:cedula ───────────────────────────────────────────

  describe('PATCH /api/usuarios/:cedula', () => {
    it('retorna usuario actualizado', async () => {
      const updated = {
        cedula: '12345678',
        nombre: 'Nuevo Nombre',
        cupones_acumulados: 5,
      };
      mockUsuariosService.updateUsuario.mockResolvedValue(updated);

      const res = await request(app.getHttpServer())
        .patch('/api/usuarios/12345678')
        .set(authHeader())
        .send({ nombre: 'Nuevo Nombre' })
        .expect(200);

      expect(res.body.nombre).toBe('Nuevo Nombre');
    });

    it('rechaza campos no permitidos por el DTO (400)', async () => {
      await request(app.getHttpServer())
        .patch('/api/usuarios/12345678')
        .set(authHeader())
        .send({ nombre: 'Test', campoExtra: 'no permitido' })
        .expect(400);
    });
  });
});
