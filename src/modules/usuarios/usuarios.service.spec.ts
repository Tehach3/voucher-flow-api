import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { UsuarioEntity } from './entities/usuario.entity';

const mockUsuario = (): UsuarioEntity =>
  ({
    id: 1,
    cedula: '12345678',
    nombre: 'Juan Perez',
    celular: '04141234567',
    ciudad: 'Caracas',
    email: null,
    activo: true,
    fecha_registro: new Date(),
    fecha_actualizacion: new Date(),
    participaciones: [],
  }) as UsuarioEntity;

const mockRepository = () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  findAndCount: jest.fn(),
});

describe('UsuariosService', () => {
  let service: UsuariosService;
  let repo: ReturnType<typeof mockRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsuariosService,
        {
          provide: getRepositoryToken(UsuarioEntity),
          useFactory: mockRepository,
        },
      ],
    }).compile();

    service = module.get<UsuariosService>(UsuariosService);
    repo = module.get(getRepositoryToken(UsuarioEntity));
  });

  describe('findOrCreate', () => {
    it('returns existing user without creating a new one', async () => {
      const existing = mockUsuario();
      repo.findOne.mockResolvedValue(existing);

      const result = await service.findOrCreate({
        cedula: '12345678',
        nombre: 'Juan Perez',
      });

      expect(result).toBe(existing);
      expect(repo.create).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('creates and returns new user when not found', async () => {
      const nuevo = mockUsuario();
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue(nuevo);
      repo.save.mockResolvedValue(nuevo);

      const result = await service.findOrCreate({
        cedula: '12345678',
        nombre: 'Juan Perez',
        celular: '04141234567',
        ciudad: 'Caracas',
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          cedula: '12345678',
          nombre: 'Juan Perez',
        }),
      );
      expect(repo.save).toHaveBeenCalledWith(nuevo);
      expect(result).toBe(nuevo);
    });
  });

  describe('findByCedula', () => {
    it('returns usuario when found', async () => {
      const usuario = mockUsuario();
      repo.findOne.mockResolvedValue(usuario);

      const result = await service.findByCedula('12345678');

      expect(result).toBe(usuario);
    });

    it('throws NotFoundException when cedula does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findByCedula('99999999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateUsuario', () => {
    it('updates only the provided fields', async () => {
      const usuario = mockUsuario();
      repo.findOne.mockResolvedValue(usuario);
      repo.save.mockResolvedValue({ ...usuario, nombre: 'Nuevo Nombre' });

      const result = await service.updateUsuario('12345678', {
        nombre: 'Nuevo Nombre',
      });

      expect(repo.save).toHaveBeenCalled();
      expect(result.nombre).toBe('Nuevo Nombre');
    });

    it('throws NotFoundException when cedula does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.updateUsuario('99999999', { nombre: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('returns paginated results with correct shape', async () => {
      const usuarios = [mockUsuario()];
      repo.findAndCount.mockResolvedValue([usuarios, 1]);

      const result = await service.findAll({ page: 1, limit: 20, offset: 0 });

      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).not.toHaveProperty('id');
      expect(result.data[0]).toHaveProperty('cedula');
      expect(result.data[0]).toHaveProperty('email');
    });
  });
});
