import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { FacturasController } from '../src/modules/facturas/facturas.controller';
import { FacturasService } from '../src/modules/facturas/facturas.service';
import { ApiKeyGuard } from '../src/common/guards/api-key.guard';
import { createTestApp, TEST_API_KEY, authHeader } from './utils/create-test-app';

// Buffer JPEG mínimo válido (magic bytes FF D8 FF) para pasar FileTypeValidator de NestJS 10.4+
const FAKE_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]);

const mockFacturasService = {
  cargarFactura: jest.fn(),
  getCuponesByCedulaEvento: jest.fn(),
  getFacturaById: jest.fn(),
};

describe('FacturasController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.API_KEY = TEST_API_KEY;

    app = await createTestApp({
      imports: [ConfigModule.forRoot({ isGlobal: true })],
      controllers: [FacturasController],
      providers: [
        ApiKeyGuard,
        { provide: FacturasService, useValue: mockFacturasService },
      ],
    });
  });

  afterAll(async () => {
    await app.close();
    delete process.env.API_KEY;
  });

  beforeEach(() => jest.clearAllMocks());

  // ── Auth ──────────────────────────────────────────────────────────────────

  it('POST /api/facturas → 401 sin Authorization header', () => {
    return request(app.getHttpServer()).post('/api/facturas').expect(401);
  });

  // ── POST /api/facturas ────────────────────────────────────────────────────

  describe('POST /api/facturas', () => {
    const validBody = {
      cedula: '12345678',
      nombre: 'Juan Perez',
      evento_id: '1',
      numero_factura: 'FAC-001',
      sku: '1kg',
      cantidad: '2',
    };

    it('retorna la respuesta de carga con cupones calculados', async () => {
      const serviceResponse = {
        success: true,
        cedula: '12345678',
        evento_id: 1,
        cupones_generados: 10,
        cupones_totales: 20,
        foto_url: 'http://stub/foto.jpg',
        numero_factura: 'FAC-001',
      };
      mockFacturasService.cargarFactura.mockResolvedValue(serviceResponse);

      const res = await request(app.getHttpServer())
        .post('/api/facturas')
        .set(authHeader())
        .field(validBody)
        .attach('foto', FAKE_JPEG, {
          filename: 'factura.jpg',
          contentType: 'image/jpeg',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.cupones_generados).toBe(10);
      expect(mockFacturasService.cargarFactura).toHaveBeenCalledTimes(1);
    });

    it('retorna 400 cuando falta el archivo foto', async () => {
      await request(app.getHttpServer())
        .post('/api/facturas')
        .set(authHeader())
        .field(validBody)
        .expect(400);
    });

    it('retorna 400 con sku inválido', async () => {
      await request(app.getHttpServer())
        .post('/api/facturas')
        .set(authHeader())
        .field({ ...validBody, sku: '2kg' })
        .attach('foto', FAKE_JPEG, {
          filename: 'factura.jpg',
          contentType: 'image/jpeg',
        })
        .expect(400);
    });

    it('retorna 400 cuando cedula no tiene 8 dígitos', async () => {
      await request(app.getHttpServer())
        .post('/api/facturas')
        .set(authHeader())
        .field({ ...validBody, cedula: '123' })
        .attach('foto', FAKE_JPEG, {
          filename: 'factura.jpg',
          contentType: 'image/jpeg',
        })
        .expect(400);
    });

    it('retorna 409 cuando la factura ya existe', async () => {
      const { ConflictException } = await import('@nestjs/common');
      mockFacturasService.cargarFactura.mockRejectedValue(
        new ConflictException('Factura ya existe'),
      );

      await request(app.getHttpServer())
        .post('/api/facturas')
        .set(authHeader())
        .field(validBody)
        .attach('foto', FAKE_JPEG, {
          filename: 'factura.jpg',
          contentType: 'image/jpeg',
        })
        .expect(409);
    });
  });

  // ── GET /api/facturas/:cedula/evento/:eventoId ────────────────────────────

  describe('GET /api/facturas/:cedula/evento/:eventoId', () => {
    it('retorna cupones y facturas del usuario en el evento', async () => {
      const mockResponse = {
        cedula: '12345678',
        evento_id: 1,
        cupones_acumulados: 10,
        total_facturas: 1,
        facturas: [],
      };
      mockFacturasService.getCuponesByCedulaEvento.mockResolvedValue(mockResponse);

      const res = await request(app.getHttpServer())
        .get('/api/facturas/12345678/evento/1')
        .set(authHeader())
        .expect(200);

      expect(res.body.cedula).toBe('12345678');
      expect(res.body.evento_id).toBe(1);
      expect(res.body.cupones_acumulados).toBe(10);
    });
  });

  // ── GET /api/facturas/id/:id ──────────────────────────────────────────────

  describe('GET /api/facturas/id/:id', () => {
    it('retorna factura por id', async () => {
      const factura = { id: 1, numero_factura: 'FAC-001', sku: '1kg' };
      mockFacturasService.getFacturaById.mockResolvedValue(factura);

      const res = await request(app.getHttpServer())
        .get('/api/facturas/id/1')
        .set(authHeader())
        .expect(200);

      expect(res.body.id).toBe(1);
    });

    it('retorna 404 cuando la factura no existe', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      mockFacturasService.getFacturaById.mockRejectedValue(
        new NotFoundException('Factura no encontrada'),
      );

      await request(app.getHttpServer())
        .get('/api/facturas/id/999')
        .set(authHeader())
        .expect(404);
    });
  });
});
