import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
  HttpException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { FacturasService } from './facturas.service';
import { FacturaEntity } from './entities/factura.entity';
import { TicketPendienteEntity } from './entities/ticket-pendiente.entity';
import { ParticipacionEventoEntity } from '../participaciones/entities/participacion-evento.entity';
import { ParticipantesService } from '../participantes/participantes.service';
import { EventosService } from '../eventos/eventos.service';
import { CloudinaryService } from '../../services/cloudinary.service';
import { ParticipanteEntity } from '../participantes/entities/participante.entity';
import { EventoEntity } from '../eventos/entities/evento.entity';
import { RegistrarParticipacionDto } from '../../common/dtos/registrar-participacion.dto';
import { FiltrarPendientesDto } from '../../common/dtos/filtrar-pendientes.dto';
import { PaginationDto } from '../../common/dtos/pagination.dto';
import { AuditoriaService } from '../auditoria/auditoria.service';

// ── Fixtures ────────────────────────────────────────────────────────────────

const mockParticipanteFixture = (): ParticipanteEntity =>
  ({
    id: 1,
    cedula: '12345678',
    nombre: 'Juan Perez',
    celular: null,
    ciudad: 'Caracas',
    email: null,
    activo: true,
    fechaRegistro: new Date(),
    fechaActualizacion: new Date(),
    participaciones: [],
  }) as unknown as ParticipanteEntity;

const makeEvento = (overrides: Partial<EventoEntity> = {}): EventoEntity => {
  const now = new Date();
  return {
    id: 1,
    nombre: 'Campaña Test',
    descripcion: null,
    estado: 'abierto',
    activo: true,
    fechaInicio: new Date(now.getTime() - 86400_000),
    fechaCierre: new Date(now.getTime() + 86400_000),
    requireValidacionCupones: true,
    cuponesMinimos: 1,
    tieneCondicionesMultiples: false,
    condicionesCupones: [{ sku: '1kg', cuponesPorUnidad: 5 }],
    premios: null,
    imagenUrl: null,
    fechaRegistro: now,
    fechaActualizacion: now,
    participaciones: [],
    ...overrides,
  } as EventoEntity;
};

const mockParticipacion = (extra: Partial<ParticipacionEventoEntity> = {}): ParticipacionEventoEntity =>
  ({
    id: 10,
    participanteId: 1,
    eventoId: 1,
    cuponesAcumulados: 0,
    activo: true,
    fechaRegistro: new Date(),
    fechaActualizacion: new Date(),
    ...extra,
  }) as unknown as ParticipacionEventoEntity;

const mockFactura = (extra: Partial<FacturaEntity> = {}): FacturaEntity =>
  ({
    id: 1,
    participante_id: 1,
    evento_id: 1,
    participacion_id: 10,
    numero_factura: 'TKT-001',
    sku: '1kg',
    cantidad: 2,
    cupones_generados: 10,
    foto_url: 'https://res.cloudinary.com/demo/sample.jpg',
    ocr_data: null,
    activo: true,
    fecha_carga: new Date(),
    ...extra,
  }) as FacturaEntity;

const mockPendiente = (extra: Partial<TicketPendienteEntity> = {}): TicketPendienteEntity =>
  ({
    id: 1,
    datosFormulario: {
      cedula: '12345678',
      nombre: 'Juan Perez',
      eventoId: 1,
      numeroTicket: 'TKT-001',
      productos: [{ sku: '1kg', cantidad: 2 }],
    },
    fotoUrl: null,
    fotoBufferB64: Buffer.from('fake-image').toString('base64'),
    fotoMimetype: 'image/jpeg',
    estado: 'pendiente',
    etapaError: 'upload_imagen',
    mensajeError: 'Cloudinary timeout',
    intentos: 0,
    fechaRegistro: new Date(),
    fechaUltimoIntento: null,
    ...extra,
  }) as TicketPendienteEntity;

const mockFoto = (): Express.Multer.File =>
  ({
    fieldname: 'foto',
    originalname: 'ticket.jpg',
    mimetype: 'image/jpeg',
    size: 1024,
    buffer: Buffer.from('fake-image'),
  }) as Express.Multer.File;

// ── Mock factories ───────────────────────────────────────────────────────────

const makeQb = () => {
  const qb: Record<string, jest.Mock> = {};
  ['innerJoin', 'select', 'orderBy', 'andWhere', 'offset', 'limit', 'skip', 'take'].forEach(
    (m) => { qb[m] = jest.fn().mockReturnValue(qb); },
  );
  qb.getCount = jest.fn().mockResolvedValue(0);
  qb.getRawMany = jest.fn().mockResolvedValue([]);
  qb.getMany = jest.fn().mockResolvedValue([]);
  return qb;
};

const mockFacturasRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  findAndCount: jest.fn().mockResolvedValue([[], 0]),
  createQueryBuilder: jest.fn().mockReturnValue(makeQb()),
});

const mockPendientesRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue(makeQb()),
});

const mockParticipacionesRepo = () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  findAndCount: jest.fn().mockResolvedValue([[], 0]),
});

const mockDataSource = () => ({
  query: jest.fn(),
  transaction: jest.fn().mockImplementation(async (cb: (m: unknown) => Promise<void>) => {
    const manager = {
      create: jest.fn().mockReturnValue(mockFactura()),
      save: jest.fn().mockResolvedValue(mockFactura()),
    };
    return cb(manager);
  }),
});

const mockParticipantesService = () => ({
  findOrCreate: jest.fn(),
  findByCedula: jest.fn(),
});

const mockEventosService = () => ({
  findById: jest.fn(),
  calcularEstado: jest.fn().mockReturnValue('vigente'),
});

const mockCloudinaryService = () => ({
  uploadBase64: jest.fn().mockResolvedValue({
    url: 'https://res.cloudinary.com/demo/sample.jpg',
    publicId: 'stub/id',
  }),
});

const mockAuditoriaService = () => ({
  registrar: jest.fn().mockResolvedValue(undefined),
});

// ── Suite ────────────────────────────────────────────────────────────────────

describe('FacturasService', () => {
  let service: FacturasService;
  let facturasRepo: ReturnType<typeof mockFacturasRepo>;
  let pendientesRepo: ReturnType<typeof mockPendientesRepo>;
  let participacionesRepo: ReturnType<typeof mockParticipacionesRepo>;
  let dataSource: ReturnType<typeof mockDataSource>;
  let participantesService: ReturnType<typeof mockParticipantesService>;
  let eventosService: ReturnType<typeof mockEventosService>;
  let cloudinaryService: ReturnType<typeof mockCloudinaryService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FacturasService,
        { provide: getRepositoryToken(FacturaEntity), useFactory: mockFacturasRepo },
        { provide: getRepositoryToken(TicketPendienteEntity), useFactory: mockPendientesRepo },
        { provide: getRepositoryToken(ParticipacionEventoEntity), useFactory: mockParticipacionesRepo },
        { provide: DataSource, useFactory: mockDataSource },
        { provide: ParticipantesService, useFactory: mockParticipantesService },
        { provide: EventosService, useFactory: mockEventosService },
        { provide: CloudinaryService, useFactory: mockCloudinaryService },
        { provide: AuditoriaService, useFactory: mockAuditoriaService },
      ],
    }).compile();

    service = module.get(FacturasService);
    facturasRepo = module.get(getRepositoryToken(FacturaEntity));
    pendientesRepo = module.get(getRepositoryToken(TicketPendienteEntity));
    participacionesRepo = module.get(getRepositoryToken(ParticipacionEventoEntity));
    dataSource = module.get(DataSource);
    participantesService = module.get(ParticipantesService);
    eventosService = module.get(EventosService);
    cloudinaryService = module.get(CloudinaryService);
  });

  // ── registrarParticipacion — happy paths ──────────────────────────────────

  describe('registrarParticipacion — happy paths', () => {
    const baseDto = {
      cedula: '12345678',
      nombre: 'Juan Perez',
      eventoId: 1,
      numeroTicket: 'TKT-001',
      local: 'Super Test',
      multiplicador: false,
      fotoBase64: 'data:image/jpeg;base64,/9j/stub',
      productos: [{ sku: '1kg', cantidad: 2 }],
    } as unknown as RegistrarParticipacionDto;

    const setupHappyPath = (esNuevo = false) => {
      eventosService.findById.mockResolvedValue(makeEvento());
      participantesService.findOrCreate.mockResolvedValue({ participante: mockParticipanteFixture(), esNuevo });
      dataSource.query.mockResolvedValue(undefined);
      participacionesRepo.findOne
        .mockResolvedValueOnce(mockParticipacion())
        .mockResolvedValueOnce(mockParticipacion({ cuponesAcumulados: 10 }));
      facturasRepo.findOne.mockResolvedValue(null);
    };

    it('registra correctamente y retorna cupones calculados', async () => {
      setupHappyPath(false);
      const result = await service.registrarParticipacion(baseDto, '127.0.0.1');
      expect(result.cuponesGenerados).toBe(10);
      expect(result.esUsuarioNuevo).toBe(false);
    });

    it('retorna esUsuarioNuevo=true para participante nuevo', async () => {
      setupHappyPath(true);
      const result = await service.registrarParticipacion(baseDto, '127.0.0.1');
      expect(result.esUsuarioNuevo).toBe(true);
    });

    it('usa la URL retornada por Cloudinary en la respuesta', async () => {
      setupHappyPath(false);
      cloudinaryService.uploadBase64.mockResolvedValue({
        url: 'https://res.cloudinary.com/demo/real/v123.jpg',
        publicId: 'x',
      });
      const result = await service.registrarParticipacion(baseDto, '127.0.0.1');
      expect(result.fotoUrl).toBe('https://res.cloudinary.com/demo/real/v123.jpg');
    });

    it('registra múltiples productos y suma cupones correctamente', async () => {
      const evento = makeEvento({
        tieneCondicionesMultiples: true,
        condicionesCupones: [
          { sku: '1kg', cuponesPorUnidad: 5 },
          { sku: '5kg', cuponesPorUnidad: 15 },
        ],
      });
      eventosService.findById.mockResolvedValue(evento);
      participantesService.findOrCreate.mockResolvedValue({ participante: mockParticipanteFixture(), esNuevo: false });
      dataSource.query.mockResolvedValue(undefined);
      participacionesRepo.findOne
        .mockResolvedValueOnce(mockParticipacion())
        .mockResolvedValueOnce(mockParticipacion({ cuponesAcumulados: 20 }));
      facturasRepo.findOne.mockResolvedValue(null);

      // 1kg × 1 = 5 cupones, 5kg × 1 = 15 cupones → total 20
      const dto = { ...baseDto, productos: [{ sku: '1kg', cantidad: 1 }, { sku: '5kg', cantidad: 1 }] };
      const result = await service.registrarParticipacion(dto, '127.0.0.1');

      expect(result.cuponesGenerados).toBe(20);
      expect(result.productos).toHaveLength(2);
    });

    it('usa SKU_CUPONES × cantidad cuando el evento no tiene condicionesCupones', async () => {
      // Evento sin condiciones específicas → fallback a tabla global
      // SKU_CUPONES: 5kg → 15 cupones/unidad
      const evento = makeEvento({ condicionesCupones: null });
      eventosService.findById.mockResolvedValue(evento);
      participantesService.findOrCreate.mockResolvedValue({ participante: mockParticipanteFixture(), esNuevo: false });
      dataSource.query.mockResolvedValue(undefined);
      participacionesRepo.findOne
        .mockResolvedValueOnce(mockParticipacion())
        .mockResolvedValueOnce(mockParticipacion({ cuponesAcumulados: 45 }));
      facturasRepo.findOne.mockResolvedValue(null);

      // 5kg × 3 unidades = 15 × 3 = 45 cupones
      const dto = { ...baseDto, productos: [{ sku: '5kg', cantidad: 3 }] };
      const result = await service.registrarParticipacion(dto, '127.0.0.1');

      expect(result.cuponesGenerados).toBe(45);
      expect(result.productos[0]).toMatchObject({ sku: '5kg', cantidad: 3, cuponesGenerados: 45 });
    });

    it('suma correctamente múltiples líneas de producto sin condicionesCupones', async () => {
      // 5kg × 2 = 30, 1kg × 1 = 5 → total 35
      const evento = makeEvento({ condicionesCupones: null });
      eventosService.findById.mockResolvedValue(evento);
      participantesService.findOrCreate.mockResolvedValue({ participante: mockParticipanteFixture(), esNuevo: false });
      dataSource.query.mockResolvedValue(undefined);
      participacionesRepo.findOne
        .mockResolvedValueOnce(mockParticipacion())
        .mockResolvedValueOnce(mockParticipacion({ cuponesAcumulados: 35 }));
      facturasRepo.findOne.mockResolvedValue(null);

      const dto = {
        ...baseDto,
        productos: [{ sku: '5kg', cantidad: 2 }, { sku: '1kg', cantidad: 1 }],
      };
      const result = await service.registrarParticipacion(dto, '127.0.0.1');

      expect(result.cuponesGenerados).toBe(35); // 15×2 + 5×1
      expect(result.productos).toHaveLength(2);
    });
  });

  // ── registrarParticipacion — validaciones 4xx (sin guardar pendiente) ──────

  describe('registrarParticipacion — validaciones de negocio', () => {
    const baseDto = {
      cedula: '12345678',
      nombre: 'Juan Perez',
      eventoId: 1,
      numeroTicket: 'TKT-001',
      local: 'Super Test',
      multiplicador: false,
      fotoBase64: 'data:image/jpeg;base64,/9j/stub',
      productos: [{ sku: '1kg', cantidad: 2 }],
    } as unknown as RegistrarParticipacionDto;

    it('lanza 400 cuando el evento no está activo, sin tocar Cloudinary', async () => {
      eventosService.findById.mockResolvedValue(makeEvento({ activo: false }));
      await expect(service.registrarParticipacion(baseDto, '127.0.0.1')).rejects.toThrow(HttpException);
      expect(cloudinaryService.uploadBase64).not.toHaveBeenCalled();
      expect(pendientesRepo.save).not.toHaveBeenCalled();
    });

    it('lanza 400 cuando el evento no está en estado abierto, sin tocar Cloudinary', async () => {
      eventosService.findById.mockResolvedValue(makeEvento({ estadoInterno: 'cerrado' }));
      eventosService.calcularEstado.mockReturnValue('cerrado');
      await expect(service.registrarParticipacion(baseDto, '127.0.0.1')).rejects.toThrow(HttpException);
      expect(cloudinaryService.uploadBase64).not.toHaveBeenCalled();
    });

    it('lanza 400 cuando la campaña aún no ha iniciado, sin tocar Cloudinary', async () => {
      eventosService.findById.mockResolvedValue(makeEvento());
      eventosService.calcularEstado.mockReturnValue('no_iniciado');
      await expect(service.registrarParticipacion(baseDto, '127.0.0.1')).rejects.toThrow(HttpException);
      expect(cloudinaryService.uploadBase64).not.toHaveBeenCalled();
    });

    it('lanza 400 cuando la campaña ya finalizó, sin tocar Cloudinary', async () => {
      eventosService.findById.mockResolvedValue(makeEvento());
      eventosService.calcularEstado.mockReturnValue('vencido');
      await expect(service.registrarParticipacion(baseDto, '127.0.0.1')).rejects.toThrow(HttpException);
      expect(cloudinaryService.uploadBase64).not.toHaveBeenCalled();
    });

    it('lanza 400 cuando el SKU no es válido para la campaña, sin tocar Cloudinary', async () => {
      eventosService.findById.mockResolvedValue(
        makeEvento({ condicionesCupones: [{ sku: '5kg', cuponesPorUnidad: 15 }] }),
      );
      participantesService.findOrCreate.mockResolvedValue({ participante: mockParticipanteFixture(), esNuevo: false });
      await expect(
        service.registrarParticipacion({ ...baseDto, productos: [{ sku: '1kg', cantidad: 1 }] }, '127.0.0.1'),
      ).rejects.toThrow(HttpException);
      expect(cloudinaryService.uploadBase64).not.toHaveBeenCalled();
    });

    it('lanza 400 cuando es usuario nuevo y falta el nombre, sin tocar Cloudinary', async () => {
      eventosService.findById.mockResolvedValue(makeEvento());
      participantesService.findOrCreate.mockResolvedValue({ participante: mockParticipanteFixture(), esNuevo: true });
      await expect(
        service.registrarParticipacion({ ...baseDto, nombre: undefined as unknown as string }, '127.0.0.1'),
      ).rejects.toThrow(HttpException);
      expect(cloudinaryService.uploadBase64).not.toHaveBeenCalled();
    });

    it('lanza 409 cuando ticket duplicado, sin tocar Cloudinary', async () => {
      eventosService.findById.mockResolvedValue(makeEvento());
      participantesService.findOrCreate.mockResolvedValue({ participante: mockParticipanteFixture(), esNuevo: false });
      dataSource.query.mockResolvedValue(undefined);
      participacionesRepo.findOne.mockResolvedValue(mockParticipacion());
      facturasRepo.findOne.mockResolvedValue(mockFactura());

      await expect(service.registrarParticipacion(baseDto, '127.0.0.1')).rejects.toThrow(HttpException);
      expect(cloudinaryService.uploadBase64).not.toHaveBeenCalled();
    });
  });

  // ── registrarParticipacion — fallback a pendientes ────────────────────────

  describe('registrarParticipacion — fallback a pendientes', () => {
    const baseDto = {
      cedula: '12345678',
      nombre: 'Juan Perez',
      eventoId: 1,
      numeroTicket: 'TKT-001',
      local: 'Super Test',
      multiplicador: false,
      fotoBase64: 'data:image/jpeg;base64,/9j/stub',
      productos: [{ sku: '1kg', cantidad: 2 }],
    } as unknown as RegistrarParticipacionDto;

    const setupValidations = () => {
      eventosService.findById.mockResolvedValue(makeEvento());
      participantesService.findOrCreate.mockResolvedValue({ participante: mockParticipanteFixture(), esNuevo: false });
      dataSource.query.mockResolvedValue(undefined);
      participacionesRepo.findOne
        .mockResolvedValueOnce(mockParticipacion())
        .mockResolvedValueOnce(mockParticipacion({ cuponesAcumulados: 10 }));
      facturasRepo.findOne.mockResolvedValue(null);
    };

    it('guarda pendiente con buffer y lanza 503 cuando Cloudinary falla', async () => {
      setupValidations();
      cloudinaryService.uploadBase64.mockRejectedValue(new Error('Cloudinary timeout'));
      pendientesRepo.create.mockReturnValue(mockPendiente());
      pendientesRepo.save.mockResolvedValue(mockPendiente({ id: 42 }));

      const error = await service.registrarParticipacion(baseDto, '127.0.0.1').catch((e) => e);

      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(503);
      expect(error.getResponse()).toMatchObject({
        codigo: 'FAC_007',
        pendienteId: 42,
      });
      expect(pendientesRepo.save).toHaveBeenCalledTimes(1);
      // Verifica que se guarda el buffer (no null)
      expect(pendientesRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          etapaError: 'upload_imagen',
          fotoUrl: null,
          fotoBufferB64: expect.any(String),
        }),
      );
    });

    it('guarda pendiente con fotoUrl y lanza 503 cuando la DB falla después del upload', async () => {
      setupValidations();
      cloudinaryService.uploadBase64.mockResolvedValue({ url: 'https://cdn.example.com/img.jpg', publicId: 'x' });
      dataSource.transaction.mockRejectedValue(new Error('DB connection lost'));
      pendientesRepo.create.mockReturnValue(mockPendiente());
      pendientesRepo.save.mockResolvedValue(mockPendiente({ id: 99 }));

      const error = await service.registrarParticipacion(baseDto, '127.0.0.1').catch((e) => e);

      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(503);
      expect(error.getResponse()).toMatchObject({
        codigo: 'FAC_008',
        pendienteId: 99,
      });
      // Verifica que se guarda la URL (no el buffer)
      expect(pendientesRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          etapaError: 'escritura_db',
          fotoUrl: 'https://cdn.example.com/img.jpg',
          fotoBufferB64: null,
        }),
      );
    });
  });

  // ── reintentarTicketPendiente ──────────────────────────────────────────────

  describe('reintentarTicketPendiente', () => {
    const setupReintento = (pendienteOverrides: Partial<TicketPendienteEntity> = {}) => {
      const pendiente = mockPendiente(pendienteOverrides);
      pendientesRepo.findOne.mockResolvedValue(pendiente);
      pendientesRepo.save.mockResolvedValue(pendiente);
      eventosService.findById.mockResolvedValue(makeEvento());
      participantesService.findOrCreate.mockResolvedValue({ participante: mockParticipanteFixture(), esNuevo: false });
      dataSource.query.mockResolvedValue(undefined);
      participacionesRepo.findOne
        .mockResolvedValueOnce(mockParticipacion())
        .mockResolvedValueOnce(mockParticipacion({ cuponesAcumulados: 10 }));
      facturasRepo.findOne.mockResolvedValue(null);
      return pendiente;
    };

    it('reintenta correctamente cuando hay buffer y upload falla la primera vez', async () => {
      setupReintento({ etapaError: 'upload_imagen', fotoUrl: null });

      const result = await service.reintentarTicketPendiente(1);

      expect(result.exitoso).toBe(true);
      expect(cloudinaryService.uploadBase64).toHaveBeenCalledTimes(1);
      expect(result.registro).toBeDefined();
    });

    it('reintenta correctamente cuando hay URL (saltando el upload)', async () => {
      setupReintento({
        etapaError: 'escritura_db',
        fotoUrl: 'https://cdn.example.com/img.jpg',
        fotoBufferB64: null,
      });

      const result = await service.reintentarTicketPendiente(1);

      expect(result.exitoso).toBe(true);
      expect(cloudinaryService.uploadBase64).not.toHaveBeenCalled();
    });

    it('lanza NotFoundException cuando el pendiente no existe', async () => {
      pendientesRepo.findOne.mockResolvedValue(null);
      await expect(service.reintentarTicketPendiente(999)).rejects.toThrow(HttpException);
    });

    it('lanza BadRequestException cuando el ticket ya está completado', async () => {
      pendientesRepo.findOne.mockResolvedValue(mockPendiente({ estado: 'completado' }));
      await expect(service.reintentarTicketPendiente(1)).rejects.toThrow(HttpException);
    });

    it('lanza BadRequestException cuando el ticket está procesando', async () => {
      pendientesRepo.findOne.mockResolvedValue(mockPendiente({ estado: 'procesando' }));
      await expect(service.reintentarTicketPendiente(1)).rejects.toThrow(HttpException);
    });

    it('marca como fallido_permanente al superar MAX_INTENTOS y lanza 503', async () => {
      setupReintento({ intentos: 4 }); // 4 → 5 con el increment
      cloudinaryService.uploadBase64.mockRejectedValue(new Error('Cloudinary down'));

      const error = await service.reintentarTicketPendiente(1).catch((e) => e);

      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(503);
      // El último save debe marcar como fallido_permanente
      const lastSaveCall = pendientesRepo.save.mock.calls[pendientesRepo.save.mock.calls.length - 1][0];
      expect(lastSaveCall.estado).toBe('fallido_permanente');
    });

    it('mantiene estado pendiente cuando falla con intentos < MAX_INTENTOS y lanza 503', async () => {
      setupReintento({ intentos: 1 });
      cloudinaryService.uploadBase64.mockRejectedValue(new Error('Temporary error'));

      const error = await service.reintentarTicketPendiente(1).catch((e) => e);

      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(503);
      const lastSaveCall = pendientesRepo.save.mock.calls[pendientesRepo.save.mock.calls.length - 1][0];
      expect(lastSaveCall.estado).toBe('pendiente');
    });

    it('limpia el buffer y guarda la URL después del upload exitoso (previene re-upload en fallo DB)', async () => {
      setupReintento({ etapaError: 'upload_imagen', fotoUrl: null });

      // Forzar que el upload funcione pero DB falle
      cloudinaryService.uploadBase64.mockResolvedValue({ url: 'https://cdn.example.com/new.jpg', publicId: 'x' });
      dataSource.transaction.mockRejectedValueOnce(new Error('DB error'));

      // El método lanza al fallar — capturamos el error y verificamos los side-effects
      await service.reintentarTicketPendiente(1).catch(() => undefined);

      // Verifica que se guardó la URL en el pendiente (con buffer limpiado) antes de intentar la DB
      const savesConUrl = pendientesRepo.save.mock.calls.filter(
        (call) => call[0].fotoUrl === 'https://cdn.example.com/new.jpg',
      );
      expect(savesConUrl.length).toBeGreaterThan(0);
    });
  });

  // ── reintentarTodosPendientes ──────────────────────────────────────────────

  describe('reintentarTodosPendientes', () => {
    it('retorna resumen correcto para lote mixto de éxitos y fallos', async () => {
      const p1 = mockPendiente({ id: 1, fotoUrl: 'https://cdn.example.com/1.jpg', etapaError: 'escritura_db', fotoBufferB64: null });
      const p2 = mockPendiente({ id: 2 });
      pendientesRepo.find.mockResolvedValue([p1, p2]);
      pendientesRepo.save.mockResolvedValue({});

      // p1: exitoso (tiene URL, DB funciona)
      // p2: falla (Cloudinary down)
      eventosService.findById.mockResolvedValue(makeEvento());
      participantesService.findOrCreate.mockResolvedValue({ participante: mockParticipanteFixture(), esNuevo: false });
      dataSource.query.mockResolvedValue(undefined);
      participacionesRepo.findOne.mockResolvedValue(mockParticipacion());
      facturasRepo.findOne.mockResolvedValue(null);

      cloudinaryService.uploadBase64
        .mockResolvedValueOnce({ url: 'https://cdn.example.com/1.jpg', publicId: 'x' }) // p1 no llama upload
        .mockRejectedValueOnce(new Error('Cloudinary down')); // p2 falla

      const result = await service.reintentarTodosPendientes(1);

      expect(result.procesados).toBe(2);
      expect(result.resultados).toHaveLength(2);
    });

    it('retorna procesados=0 cuando no hay pendientes', async () => {
      pendientesRepo.find.mockResolvedValue([]);

      const result = await service.reintentarTodosPendientes(1);

      expect(result.procesados).toBe(0);
      expect(result.exitosos).toBe(0);
      expect(result.fallidos).toBe(0);
    });
  });

  // ── getPendientes ─────────────────────────────────────────────────────────

  describe('getPendientes', () => {
    it('retorna listado paginado con forma correcta', async () => {
      const qb = makeQb();
      pendientesRepo.createQueryBuilder.mockReturnValue(qb);
      qb.getCount.mockResolvedValue(1);
      qb.getMany.mockResolvedValue([mockPendiente()]);

      const result = await service.getPendientes({ page: 1, limit: 20 } as FiltrarPendientesDto);

      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: 1,
        cedula: '12345678',
        eventoId: 1,
        estado: 'pendiente',
        tieneImagen: true,
      });
    });

    it('aplica filtro por estado', async () => {
      const qb = makeQb();
      pendientesRepo.createQueryBuilder.mockReturnValue(qb);
      qb.getCount.mockResolvedValue(0);
      qb.getMany.mockResolvedValue([]);

      await service.getPendientes({ estado: 'fallido_permanente', page: 1, limit: 20 } as unknown as FiltrarPendientesDto);

      expect(qb.andWhere).toHaveBeenCalledWith('p.estado = :estado', { estado: 'fallido_permanente' });
    });

    it('aplica filtro por cedula usando JSONB', async () => {
      const qb = makeQb();
      pendientesRepo.createQueryBuilder.mockReturnValue(qb);
      qb.getCount.mockResolvedValue(0);
      qb.getMany.mockResolvedValue([]);

      await service.getPendientes({ cedula: '12345678', page: 1, limit: 20 } as FiltrarPendientesDto);

      expect(qb.andWhere).toHaveBeenCalledWith(
        "p.datos_formulario->>'cedula' = :cedula",
        { cedula: '12345678' },
      );
    });
  });

  // ── getCuponesByCedula ────────────────────────────────────────────────────

  describe('getCuponesByCedula', () => {
    const paginacion = { page: 1, limit: 20 } as PaginationDto;

    it('retorna la jerarquía usuario → campañas → facturas', async () => {
      participantesService.findByCedula.mockResolvedValue(mockParticipanteFixture());
      participacionesRepo.findAndCount.mockResolvedValue([
        [
          {
            ...mockParticipacion({ cuponesAcumulados: 15 }),
            evento: { id: 1, nombre: 'Campaña Test' },
            facturas: [mockFactura()],
          },
        ],
        1,
      ]);

      const result = await service.getCuponesByCedula('12345678', paginacion);

      expect(result.campanhas).toHaveLength(1);
      expect(result.campanhas[0].cuponesAcumulados).toBe(15);
      expect(result.total).toBe(1);
    });

    it('propaga NotFoundException cuando la cédula no existe', async () => {
      participantesService.findByCedula.mockRejectedValue(new NotFoundException());
      await expect(service.getCuponesByCedula('000000', paginacion)).rejects.toThrow(HttpException);
    });
  });

  // ── getCuponesByCedulaEvento ──────────────────────────────────────────────

  describe('getCuponesByCedulaEvento', () => {
    const paginacion = { page: 1, limit: 20 } as PaginationDto;

    it('retorna datos cuando existe participación', async () => {
      participantesService.findByCedula.mockResolvedValue(mockParticipanteFixture());
      participacionesRepo.findOne.mockResolvedValue(mockParticipacion({ cuponesAcumulados: 10 }));
      facturasRepo.findAndCount.mockResolvedValue([[mockFactura(), mockFactura()], 2]);

      const result = await service.getCuponesByCedulaEvento('12345678', 1, paginacion);

      expect(result.cuponesAcumulados).toBe(10);
      expect(result.totalFacturas).toBe(2);
    });

    it('retorna estado vacío cuando no hay participación', async () => {
      participantesService.findByCedula.mockResolvedValue(mockParticipanteFixture());
      participacionesRepo.findOne.mockResolvedValue(null);

      const result = await service.getCuponesByCedulaEvento('12345678', 99, paginacion);

      expect(result.cuponesAcumulados).toBe(0);
      expect(result.totalFacturas).toBe(0);
    });
  });

});
