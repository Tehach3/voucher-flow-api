import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { FacturasService } from './facturas.service';
import { FacturaEntity } from './entities/factura.entity';
import { UsuariosService } from '../usuarios/usuarios.service';
import { CloudinaryService } from '../../services/cloudinary.service';
import { CargarFacturaDto } from '../../common/dtos/cargar-factura.dto';
import { UsuarioEntity } from '../usuarios/entities/usuario.entity';

const mockUsuario = (): UsuarioEntity =>
  ({
    id: 1,
    cedula: '12345678',
    nombre: 'Juan Perez',
    celular: null,
    ciudad: null,
    cupones_acumulados: 10,
    fecha_registro: new Date(),
    fecha_actualizacion: new Date(),
    facturas: [],
  }) as UsuarioEntity;

const mockFactura = (): FacturaEntity =>
  ({
    id: 1,
    usuario_id: 1,
    numero_factura: 'FAC-001',
    sku: '1kg',
    cantidad: 2,
    cupones_generados: 10,
    foto_url: 'http://stub/foto.jpg',
    ocr_data: null,
    fecha_carga: new Date(),
  }) as FacturaEntity;

const mockFile = (): Express.Multer.File =>
  ({
    fieldname: 'foto',
    originalname: 'factura.jpg',
    mimetype: 'image/jpeg',
    size: 1024,
    buffer: Buffer.from('fake'),
  }) as Express.Multer.File;

const mockFacturasRepository = () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  find: jest.fn(),
});

const mockUsuariosService = () => ({
  findOrCreate: jest.fn(),
  findByCedula: jest.fn(),
  incrementarCupones: jest.fn(),
});

const mockCloudinaryService = () => ({
  upload: jest.fn(),
  getOcrData: jest.fn(),
});

describe('FacturasService', () => {
  let service: FacturasService;
  let facturasRepo: ReturnType<typeof mockFacturasRepository>;
  let usuariosService: ReturnType<typeof mockUsuariosService>;
  let cloudinaryService: ReturnType<typeof mockCloudinaryService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FacturasService,
        {
          provide: getRepositoryToken(FacturaEntity),
          useFactory: mockFacturasRepository,
        },
        { provide: UsuariosService, useFactory: mockUsuariosService },
        { provide: CloudinaryService, useFactory: mockCloudinaryService },
      ],
    }).compile();

    service = module.get<FacturasService>(FacturasService);
    facturasRepo = module.get(getRepositoryToken(FacturaEntity));
    usuariosService = module.get(UsuariosService);
    cloudinaryService = module.get(CloudinaryService);
  });

  describe('cargarFactura', () => {
    const dto: CargarFacturaDto = {
      cedula: '12345678',
      nombre: 'Juan Perez',
      numero_factura: 'FAC-001',
      sku: '1kg',
      cantidad: 2,
    };

    beforeEach(() => {
      usuariosService.findOrCreate.mockResolvedValue(mockUsuario());
      facturasRepo.findOne.mockResolvedValue(null);
      cloudinaryService.upload.mockResolvedValue({
        url: 'http://stub/foto.jpg',
        publicId: 'stub/id',
      });
      cloudinaryService.getOcrData.mockResolvedValue(null);
      facturasRepo.create.mockReturnValue(mockFactura());
      facturasRepo.save.mockResolvedValue(mockFactura());
      usuariosService.incrementarCupones.mockResolvedValue(undefined);
    });

    it('calcula cupones correctamente para sku 1kg', async () => {
      const result = await service.cargarFactura(dto, mockFile());

      // 1kg = 5 cupones/unidad, cantidad 2 → 10 cupones
      expect(result.cupones_generados).toBe(10);
    });

    it.each([
      ['250g', 1, 2],
      ['500g', 1, 3],
      ['1kg', 1, 5],
      ['5kg', 1, 15],
      ['1kg', 3, 15],
    ])('sku %s × cantidad %i = %i cupones', async (sku, cantidad, expected) => {
      const result = await service.cargarFactura(
        { ...dto, sku, cantidad },
        mockFile(),
      );
      expect(result.cupones_generados).toBe(expected);
    });

    it('retorna la estructura de respuesta correcta', async () => {
      const result = await service.cargarFactura(dto, mockFile());

      expect(result).toMatchObject({
        success: true,
        cedula: '12345678',
        numero_factura: 'FAC-001',
        foto_url: 'http://stub/foto.jpg',
      });
      expect(typeof result.cupones_generados).toBe('number');
      expect(typeof result.cupones_totales).toBe('number');
    });

    it('lanza ConflictException cuando la factura ya existe para esa cédula', async () => {
      facturasRepo.findOne.mockResolvedValue(mockFactura());

      await expect(service.cargarFactura(dto, mockFile())).rejects.toThrow(
        ConflictException,
      );
      expect(cloudinaryService.upload).not.toHaveBeenCalled();
    });

    it('llama a incrementarCupones con los cupones calculados', async () => {
      await service.cargarFactura(dto, mockFile());

      expect(usuariosService.incrementarCupones).toHaveBeenCalledWith(
        mockUsuario().id,
        10,
      );
    });
  });

  describe('getCuponesByCedula', () => {
    it('retorna cupones acumulados y lista de facturas', async () => {
      usuariosService.findByCedula.mockResolvedValue(mockUsuario());
      facturasRepo.find.mockResolvedValue([mockFactura(), mockFactura()]);

      const result = await service.getCuponesByCedula('12345678');

      expect(result.cedula).toBe('12345678');
      expect(result.cupones_acumulados).toBe(10);
      expect(result.total_facturas).toBe(2);
      expect(result.facturas).toHaveLength(2);
    });
  });

  describe('getFacturaById', () => {
    it('lanza NotFoundException cuando la factura no existe', async () => {
      facturasRepo.findOne.mockResolvedValue(null);

      await expect(service.getFacturaById(999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('retorna la factura cuando existe', async () => {
      const factura = mockFactura();
      facturasRepo.findOne.mockResolvedValue(factura);

      const result = await service.getFacturaById(1);
      expect(result).toBe(factura);
    });
  });
});
