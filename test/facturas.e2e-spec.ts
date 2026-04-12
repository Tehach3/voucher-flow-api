import { INestApplication, NotFoundException, ConflictException, BadRequestException, HttpStatus } from '@nestjs/common';
import request from 'supertest';
import { FacturasController } from '../src/modules/facturas/facturas.controller';
import { FacturasService } from '../src/modules/facturas/facturas.service';
import { ApiKeyGuard } from '../src/common/guards/api-key.guard';
import { createTestApp, TEST_API_KEY, authHeader } from './utils/create-test-app';

// JPEG mínimo válido (magic bytes FF D8 FF) para pasar FileTypeValidator
const FAKE_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
]);

const mockFacturasService = {
  registrarParticipacion: jest.fn(),
  getCuponesByCedula: jest.fn(),
  getCuponesByCedulaEvento: jest.fn(),
  getFacturaById: jest.fn(),
  findAllTickets: jest.fn(),
  getPendientes: jest.fn(),
  reintentarTodosPendientes: jest.fn(),
  reintentarTicketPendiente: jest.fn(),
};

describe('FacturasController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.API_KEY = TEST_API_KEY;

    app = await createTestApp({
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

  it('POST /api/tickets → 401 sin x-api-key', () => {
    return request(app.getHttpServer()).post('/api/tickets').expect(401);
  });

  it('GET /api/tickets → 401 sin x-api-key', () => {
    return request(app.getHttpServer()).get('/api/tickets').expect(401);
  });

  // ── GET /api/tickets ──────────────────────────────────────────────────────

  describe('GET /api/tickets', () => {
    const mockPaginado = {
      data: [
        {
          id: 1,
          cedula: '12345678',
          nombre: 'Juan Perez',
          ciudad: 'Caracas',
          eventoId: 1,
          eventoNombre: 'Campaña Test',
          numeroTicket: 'TKT-001',
          sku: '1kg',
          cantidad: 2,
          cuponesGenerados: 10,
          fotoUrl: 'https://res.cloudinary.com/demo/sample.jpg',
          fechaCarga: new Date().toISOString(),
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    };

    it('retorna listado paginado con 200', async () => {
      mockFacturasService.findAllTickets.mockResolvedValue(mockPaginado);

      const res = await request(app.getHttpServer())
        .get('/api/tickets')
        .set(authHeader())
        .expect(200);

      expect(res.body.total).toBe(1);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].cedula).toBe('12345678');
    });

    it('pasa los filtros de query al service', async () => {
      mockFacturasService.findAllTickets.mockResolvedValue({ data: [], total: 0, page: 1, limit: 10 });

      await request(app.getHttpServer())
        .get('/api/tickets')
        .set(authHeader())
        .query({ cedula: '12345678', ciudad: 'Caracas', fechaDesde: '2024-01-01', fechaHasta: '2024-12-31', page: 1, limit: 10 })
        .expect(200);

      expect(mockFacturasService.findAllTickets).toHaveBeenCalledWith(
        expect.objectContaining({
          cedula: '12345678',
          ciudad: 'Caracas',
          fechaDesde: '2024-01-01',
          fechaHasta: '2024-12-31',
          page: 1,
          limit: 10,
        }),
      );
    });

    it('retorna 400 cuando cedula tiene formato inválido', async () => {
      await request(app.getHttpServer())
        .get('/api/tickets')
        .set(authHeader())
        .query({ cedula: '123' }) // menos de 6 dígitos
        .expect(400);
    });

    it('retorna 400 cuando fechaDesde no es una fecha ISO válida', async () => {
      await request(app.getHttpServer())
        .get('/api/tickets')
        .set(authHeader())
        .query({ fechaDesde: 'no-es-fecha' })
        .expect(400);
    });
  });

  // ── POST /api/tickets (multipart/form-data) ───────────────────────────────

  describe('POST /api/tickets', () => {
    const attachFoto = (req: request.Test) =>
      req.attach('foto', FAKE_JPEG, { filename: 'ticket.jpg', contentType: 'image/jpeg' });

    const validFields = {
      cedula: '12345678',
      nombre: 'Juan Perez',
      celular: '04141234567',
      ciudad: 'Caracas',
      eventoId: '1',
      numeroTicket: 'TKT-001',
      productos: JSON.stringify([{ sku: '1kg', cantidad: 2 }]),
    };

    const mockResponse = {
      mensaje: 'Cupones agregados al participante existente',
      esUsuarioNuevo: false,
      cedula: '12345678',
      nombre: 'Juan Perez',
      eventoId: 1,
      numeroTicket: 'TKT-001',
      fotoUrl: 'https://res.cloudinary.com/demo/sample.jpg',
      productos: [{ sku: '1kg', cantidad: 2, cuponesGenerados: 10 }],
      cuponesGenerados: 10,
      cuponesAcumulados: 25,
    };

    const postWithFields = (fields: Record<string, string>) =>
      attachFoto(
        request(app.getHttpServer())
          .post('/api/tickets')
          .set(authHeader()),
      ).field(fields);

    it('registra participación y retorna 201 con cupones calculados', async () => {
      mockFacturasService.registrarParticipacion.mockResolvedValue(mockResponse);

      const res = await postWithFields(validFields).expect(201);

      expect(res.body.cuponesGenerados).toBe(10);
      expect(res.body.esUsuarioNuevo).toBe(false);
      expect(mockFacturasService.registrarParticipacion).toHaveBeenCalledTimes(1);
    });

    it('acepta cédula de 6 dígitos', async () => {
      mockFacturasService.registrarParticipacion.mockResolvedValue({ ...mockResponse, cedula: '654321' });

      await postWithFields({ ...validFields, cedula: '654321' }).expect(201);
    });

    it('acepta cédula de 10 dígitos', async () => {
      mockFacturasService.registrarParticipacion.mockResolvedValue({ ...mockResponse, cedula: '1234567890' });

      await postWithFields({ ...validFields, cedula: '1234567890' }).expect(201);
    });

    it('acepta múltiples productos como JSON string', async () => {
      mockFacturasService.registrarParticipacion.mockResolvedValue({
        ...mockResponse,
        productos: [
          { sku: '1kg', cantidad: 1, cuponesGenerados: 5 },
          { sku: '5kg', cantidad: 1, cuponesGenerados: 15 },
        ],
        cuponesGenerados: 20,
      });

      const res = await postWithFields({
        ...validFields,
        productos: JSON.stringify([{ sku: '1kg', cantidad: 1 }, { sku: '5kg', cantidad: 1 }]),
      }).expect(201);

      expect(res.body.cuponesGenerados).toBe(20);
      expect(res.body.productos).toHaveLength(2);
    });

    it('retorna 400 cuando falta la foto', async () => {
      await request(app.getHttpServer())
        .post('/api/tickets')
        .set(authHeader())
        .field(validFields)
        .expect(400);
    });

    it('retorna 400 cuando falta eventoId', async () => {
      const { eventoId: _omit, ...fields } = validFields;
      await postWithFields(fields).expect(400);
    });

    it('retorna 400 cuando productos está vacío', async () => {
      await postWithFields({ ...validFields, productos: '[]' }).expect(400);
    });

    it('retorna 400 cuando cedula tiene menos de 6 dígitos', async () => {
      await postWithFields({ ...validFields, cedula: '12345' }).expect(400);
    });

    it('retorna 400 cuando cedula tiene más de 10 dígitos', async () => {
      await postWithFields({ ...validFields, cedula: '12345678901' }).expect(400);
    });

    it('retorna 400 cuando sku no es un valor permitido', async () => {
      await postWithFields({
        ...validFields,
        productos: JSON.stringify([{ sku: '2kg', cantidad: 1 }]),
      }).expect(400);
    });

    it('retorna 400 cuando cantidad es 0', async () => {
      await postWithFields({
        ...validFields,
        productos: JSON.stringify([{ sku: '1kg', cantidad: 0 }]),
      }).expect(400);
    });

    it('retorna 409 cuando el ticket ya está registrado', async () => {
      mockFacturasService.registrarParticipacion.mockRejectedValue(
        new ConflictException('Ticket duplicado'),
      );

      await postWithFields(validFields).expect(409);
    });

    it('retorna 400 cuando la campaña no está activa', async () => {
      mockFacturasService.registrarParticipacion.mockRejectedValue(
        new BadRequestException('La campaña no está activa'),
      );

      await postWithFields(validFields).expect(400);
    });
  });

  // ── GET /api/tickets/pendientes ──────────────────────────────────────────

  describe('GET /api/tickets/pendientes', () => {
    const mockPendientesPaginados = {
      data: [
        {
          id: 1,
          datosFormulario: { cedula: '12345678', eventoId: 1, numeroTicket: 'TKT-001', productos: [{ sku: '1kg', cantidad: 2 }] },
          fotoUrl: null,
          estado: 'pendiente',
          etapaError: 'upload_imagen',
          intentos: 0,
          fechaRegistro: new Date().toISOString(),
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    };

    it('retorna listado paginado de pendientes con 200', async () => {
      mockFacturasService.getPendientes.mockResolvedValue(mockPendientesPaginados);

      const res = await request(app.getHttpServer())
        .get('/api/tickets/pendientes')
        .set(authHeader())
        .expect(200);

      expect(res.body.total).toBe(1);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].estado).toBe('pendiente');
    });

    it('pasa filtros al service correctamente', async () => {
      mockFacturasService.getPendientes.mockResolvedValue({ data: [], total: 0, page: 1, limit: 10 });

      await request(app.getHttpServer())
        .get('/api/tickets/pendientes')
        .set(authHeader())
        .query({ estado: 'pendiente', cedula: '12345678', eventoId: 1, page: 1, limit: 10 })
        .expect(200);

      expect(mockFacturasService.getPendientes).toHaveBeenCalledWith(
        expect.objectContaining({
          estado: 'pendiente',
          cedula: '12345678',
          eventoId: 1,
          page: 1,
          limit: 10,
        }),
      );
    });

    it('retorna 400 cuando estado no es un valor válido', async () => {
      await request(app.getHttpServer())
        .get('/api/tickets/pendientes')
        .set(authHeader())
        .query({ estado: 'invalido' })
        .expect(400);
    });

    it('retorna 401 sin x-api-key', () => {
      return request(app.getHttpServer()).get('/api/tickets/pendientes').expect(401);
    });
  });

  // ── POST /api/tickets/pendientes/reintentar-todos ─────────────────────────

  describe('POST /api/tickets/pendientes/reintentar-todos', () => {
    it('procesa el lote y retorna resumen con 200', async () => {
      const mockResumen = {
        procesados: 3,
        exitosos: 2,
        fallidos: 1,
        resultados: [
          { id: 1, exito: true },
          { id: 2, exito: true },
          { id: 3, exito: false, error: 'Evento expirado' },
        ],
      };
      mockFacturasService.reintentarTodosPendientes.mockResolvedValue(mockResumen);

      const res = await request(app.getHttpServer())
        .post('/api/tickets/pendientes/reintentar-todos')
        .set(authHeader())
        .expect(200);

      expect(res.body.procesados).toBe(3);
      expect(res.body.exitosos).toBe(2);
      expect(res.body.fallidos).toBe(1);
      expect(res.body.resultados).toHaveLength(3);
    });

    it('retorna 200 con ceros cuando no hay pendientes', async () => {
      mockFacturasService.reintentarTodosPendientes.mockResolvedValue({
        procesados: 0,
        exitosos: 0,
        fallidos: 0,
        resultados: [],
      });

      const res = await request(app.getHttpServer())
        .post('/api/tickets/pendientes/reintentar-todos')
        .set(authHeader())
        .expect(200);

      expect(res.body.procesados).toBe(0);
    });

    it('retorna 401 sin x-api-key', () => {
      return request(app.getHttpServer())
        .post('/api/tickets/pendientes/reintentar-todos')
        .expect(401);
    });
  });

  // ── POST /api/tickets/pendientes/:id/reintentar ───────────────────────────

  describe('POST /api/tickets/pendientes/:id/reintentar', () => {
    it('reintenta el ticket y retorna resultado exitoso con 200', async () => {
      const mockResultado = {
        id: 1,
        exito: true,
        mensaje: 'Ticket procesado correctamente',
      };
      mockFacturasService.reintentarTicketPendiente.mockResolvedValue(mockResultado);

      const res = await request(app.getHttpServer())
        .post('/api/tickets/pendientes/1/reintentar')
        .set(authHeader())
        .expect(200);

      expect(res.body.exito).toBe(true);
      expect(res.body.id).toBe(1);
      expect(mockFacturasService.reintentarTicketPendiente).toHaveBeenCalledWith(1);
    });

    it('retorna resultado fallido con 200 cuando el reintento no tiene éxito', async () => {
      mockFacturasService.reintentarTicketPendiente.mockResolvedValue({
        id: 2,
        exito: false,
        error: 'Cloudinary sigue sin responder',
      });

      const res = await request(app.getHttpServer())
        .post('/api/tickets/pendientes/2/reintentar')
        .set(authHeader())
        .expect(200);

      expect(res.body.exito).toBe(false);
    });

    it('retorna 404 cuando el ticket pendiente no existe', async () => {
      mockFacturasService.reintentarTicketPendiente.mockRejectedValue(
        new NotFoundException('Ticket pendiente #999 no encontrado'),
      );

      await request(app.getHttpServer())
        .post('/api/tickets/pendientes/999/reintentar')
        .set(authHeader())
        .expect(404);
    });

    it('retorna 400 cuando el ticket ya fue completado', async () => {
      mockFacturasService.reintentarTicketPendiente.mockRejectedValue(
        new BadRequestException('El ticket ya fue procesado correctamente'),
      );

      await request(app.getHttpServer())
        .post('/api/tickets/pendientes/1/reintentar')
        .set(authHeader())
        .expect(400);
    });

    it('retorna 400 cuando el id no es un número', async () => {
      await request(app.getHttpServer())
        .post('/api/tickets/pendientes/abc/reintentar')
        .set(authHeader())
        .expect(400);
    });

    it('retorna 401 sin x-api-key', () => {
      return request(app.getHttpServer())
        .post('/api/tickets/pendientes/1/reintentar')
        .expect(401);
    });
  });

  // ── GET /api/tickets/:cedula/cupones ──────────────────────────────────────

  describe('GET /api/tickets/:cedula/cupones', () => {
    const mockCupones = {
      cedula: '12345678',
      nombre: 'Juan Perez',
      campanhas: [
        {
          eventoId: 1,
          nombre: 'Campaña Test',
          cuponesAcumulados: 25,
          facturas: [
            {
              id: 1,
              numeroTicket: 'TKT-001',
              sku: '1kg',
              cantidad: 2,
              cuponesGenerados: 10,
              fotoUrl: 'https://res.cloudinary.com/demo/sample.jpg',
              fechaCarga: new Date().toISOString(),
            },
          ],
        },
      ],
    };

    it('retorna la jerarquía usuario → campañas → facturas', async () => {
      mockFacturasService.getCuponesByCedula.mockResolvedValue(mockCupones);

      const res = await request(app.getHttpServer())
        .get('/api/tickets/12345678/cupones')
        .set(authHeader())
        .expect(200);

      expect(res.body.cedula).toBe('12345678');
      expect(res.body.campanhas).toHaveLength(1);
      expect(res.body.campanhas[0].cuponesAcumulados).toBe(25);
      expect(res.body.campanhas[0].facturas).toHaveLength(1);
    });

    it('retorna 404 cuando la cédula no existe', async () => {
      mockFacturasService.getCuponesByCedula.mockRejectedValue(
        new NotFoundException('Usuario no encontrado'),
      );

      await request(app.getHttpServer())
        .get('/api/tickets/99999999/cupones')
        .set(authHeader())
        .expect(404);
    });
  });

  // ── GET /api/tickets/:cedula/evento/:eventoId ─────────────────────────────

  describe('GET /api/tickets/:cedula/evento/:eventoId', () => {
    it('retorna cupones acumulados y facturas del participante en la campaña', async () => {
      mockFacturasService.getCuponesByCedulaEvento.mockResolvedValue({
        cedula: '12345678',
        evento_id: 1,
        cupones_acumulados: 25,
        total_facturas: 2,
        facturas: [],
      });

      const res = await request(app.getHttpServer())
        .get('/api/tickets/12345678/evento/1')
        .set(authHeader())
        .expect(200);

      expect(res.body.cedula).toBe('12345678');
      expect(res.body.cupones_acumulados).toBe(25);
    });

    it('retorna 404 cuando la cédula no existe', async () => {
      mockFacturasService.getCuponesByCedulaEvento.mockRejectedValue(
        new NotFoundException('Usuario no encontrado'),
      );

      await request(app.getHttpServer())
        .get('/api/tickets/99999999/evento/1')
        .set(authHeader())
        .expect(404);
    });
  });

  // ── GET /api/tickets/id/:id ───────────────────────────────────────────────

  describe('GET /api/tickets/id/:id', () => {
    it('retorna el ticket por id', async () => {
      const factura = { id: 1, numero_factura: 'TKT-001', sku: '1kg' };
      mockFacturasService.getFacturaById.mockResolvedValue(factura);

      const res = await request(app.getHttpServer())
        .get('/api/tickets/id/1')
        .set(authHeader())
        .expect(200);

      expect(res.body.id).toBe(1);
    });

    it('retorna 404 cuando el ticket no existe', async () => {
      mockFacturasService.getFacturaById.mockRejectedValue(
        new NotFoundException('Factura no encontrada'),
      );

      await request(app.getHttpServer())
        .get('/api/tickets/id/999')
        .set(authHeader())
        .expect(404);
    });

    it('retorna 400 cuando el id no es un número', async () => {
      await request(app.getHttpServer())
        .get('/api/tickets/id/abc')
        .set(authHeader())
        .expect(400);
    });
  });
});
