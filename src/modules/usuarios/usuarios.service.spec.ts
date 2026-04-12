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

  // ── findOrCreate ─────────────────────────────────────────────────────────

  describe('findOrCreate', () => {
    it('retorna el usuario existente con esNuevo=false sin crear uno nuevo', async () => {
      const existing = mockUsuario();
      repo.findOne.mockResolvedValue(existing);

      const result = await service.findOrCreate({ cedula: '12345678', nombre: 'Juan Perez' });

      expect(result.usuario).toBe(existing);
      expect(result.esNuevo).toBe(false);
      expect(repo.create).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('crea y retorna un nuevo usuario con esNuevo=true cuando no existe', async () => {
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

      expect(result.esNuevo).toBe(true);
      expect(result.usuario).toBe(nuevo);
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ cedula: '12345678', nombre: 'Juan Perez' }),
      );
      expect(repo.save).toHaveBeenCalledWith(nuevo);
    });

    it('acepta cédula de 6 dígitos (borde inferior del rango válido)', async () => {
      const usuario = { ...mockUsuario(), cedula: '123456' } as UsuarioEntity;
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue(usuario);
      repo.save.mockResolvedValue(usuario);

      const result = await service.findOrCreate({ cedula: '123456', nombre: 'Maria Lopez' });

      expect(result.usuario.cedula).toBe('123456');
    });

    it('acepta cédula de 10 dígitos (borde superior del rango válido)', async () => {
      const usuario = { ...mockUsuario(), cedula: '1234567890' } as UsuarioEntity;
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue(usuario);
      repo.save.mockResolvedValue(usuario);

      const result = await service.findOrCreate({ cedula: '1234567890', nombre: 'Carlos Gomez' });

      expect(result.usuario.cedula).toBe('1234567890');
    });

    it('persiste null para campos opcionales no provistos', async () => {
      const usuario = { ...mockUsuario(), celular: null, ciudad: null, email: null } as UsuarioEntity;
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue(usuario);
      repo.save.mockResolvedValue(usuario);

      await service.findOrCreate({ cedula: '12345678', nombre: 'Juan Perez' });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ celular: null, ciudad: null, email: null }),
      );
    });
  });

  // ── findByCedula ─────────────────────────────────────────────────────────

  describe('findByCedula', () => {
    it('retorna el usuario cuando existe', async () => {
      const usuario = mockUsuario();
      repo.findOne.mockResolvedValue(usuario);

      const result = await service.findByCedula('12345678');

      expect(result).toBe(usuario);
    });

    it('lanza NotFoundException cuando la cédula no existe', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findByCedula('99999999')).rejects.toThrow(NotFoundException);
    });
  });

  // ── updateUsuario ─────────────────────────────────────────────────────────

  describe('updateUsuario', () => {
    it('actualiza solo los campos provistos', async () => {
      const usuario = mockUsuario();
      repo.findOne.mockResolvedValue(usuario);
      repo.save.mockResolvedValue({ ...usuario, nombre: 'Nuevo Nombre' });

      const result = await service.updateUsuario('12345678', { nombre: 'Nuevo Nombre' });

      expect(repo.save).toHaveBeenCalled();
      expect(result.nombre).toBe('Nuevo Nombre');
    });

    it('no modifica campos no incluidos en el DTO', async () => {
      const usuario = mockUsuario();
      repo.findOne.mockResolvedValue(usuario);
      repo.save.mockImplementation((u: UsuarioEntity) => Promise.resolve(u));

      await service.updateUsuario('12345678', { nombre: 'Otro Nombre' });

      const saved: UsuarioEntity = repo.save.mock.calls[0][0];
      expect(saved.celular).toBe('04141234567'); // sin cambios
    });

    it('lanza NotFoundException cuando la cédula no existe', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(
        service.updateUsuario('99999999', { nombre: 'Test' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    it('retorna resultados paginados con la forma correcta', async () => {
      const usuarios = [mockUsuario()];
      repo.findAndCount.mockResolvedValue([usuarios, 1]);

      const result = await service.findAll({ page: 1, limit: 20, offset: 0 });

      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.data).toHaveLength(1);
    });

    it('no expone el campo id en la respuesta pública', async () => {
      repo.findAndCount.mockResolvedValue([[mockUsuario()], 1]);

      const result = await service.findAll({ page: 1, limit: 20, offset: 0 });

      expect(result.data[0]).not.toHaveProperty('id');
      expect(result.data[0]).toHaveProperty('cedula');
    });

    it('retorna data vacía y total 0 cuando no hay usuarios', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll({ page: 1, limit: 20, offset: 0 });

      expect(result.total).toBe(0);
      expect(result.data).toHaveLength(0);
    });
  });
});
