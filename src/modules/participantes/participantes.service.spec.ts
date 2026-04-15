import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ParticipantesService } from './participantes.service';
import { ParticipanteEntity } from './entities/participante.entity';

const mockParticipante = (): ParticipanteEntity =>
  ({
    id: 1,
    cedula: '12345678',
    nombre: 'Juan Perez',
    celular: '04141234567',
    ciudad: 'Caracas',
    email: null,
    activo: true,
    fechaRegistro: new Date(),
    fechaActualizacion: new Date(),
    participaciones: [],
  }) as unknown as ParticipanteEntity;

const mockRepository = () => ({
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

describe('ParticipantesService', () => {
  let service: ParticipantesService;
  let repo: ReturnType<typeof mockRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParticipantesService,
        {
          provide: getRepositoryToken(ParticipanteEntity),
          useFactory: mockRepository,
        },
      ],
    }).compile();

    service = module.get<ParticipantesService>(ParticipantesService);
    repo = module.get(getRepositoryToken(ParticipanteEntity));
  });

  // ── findOrCreate ─────────────────────────────────────────────────────────

  describe('findOrCreate', () => {
    it('retorna el participante existente con esNuevo=false sin crear uno nuevo', async () => {
      const existing = mockParticipante();
      repo.findOne.mockResolvedValue(existing);

      const result = await service.findOrCreate({ cedula: '12345678', nombre: 'Juan Perez' });

      expect(result.participante).toBe(existing);
      expect(result.esNuevo).toBe(false);
      expect(repo.create).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('crea y retorna un nuevo participante con esNuevo=true cuando no existe', async () => {
      const nuevo = mockParticipante();
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
      expect(result.participante).toBe(nuevo);
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ cedula: '12345678', nombre: 'Juan Perez' }),
      );
      expect(repo.save).toHaveBeenCalledWith(nuevo);
    });

    it('acepta cédula de 6 dígitos (borde inferior del rango válido)', async () => {
      const participante = { ...mockParticipante(), cedula: '123456' } as ParticipanteEntity;
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue(participante);
      repo.save.mockResolvedValue(participante);

      const result = await service.findOrCreate({ cedula: '123456', nombre: 'Maria Lopez' });

      expect(result.participante.cedula).toBe('123456');
    });

    it('acepta cédula de 10 dígitos (borde superior del rango válido)', async () => {
      const participante = { ...mockParticipante(), cedula: '1234567890' } as ParticipanteEntity;
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue(participante);
      repo.save.mockResolvedValue(participante);

      const result = await service.findOrCreate({ cedula: '1234567890', nombre: 'Carlos Gomez' });

      expect(result.participante.cedula).toBe('1234567890');
    });

    it('persiste null para campos opcionales no provistos', async () => {
      const participante = { ...mockParticipante(), celular: null, ciudad: null, email: null } as ParticipanteEntity;
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue(participante);
      repo.save.mockResolvedValue(participante);

      await service.findOrCreate({ cedula: '12345678', nombre: 'Juan Perez' });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ celular: null, ciudad: null, email: null }),
      );
    });
  });

  // ── findByCedula ─────────────────────────────────────────────────────────

  describe('findByCedula', () => {
    it('retorna el participante cuando existe', async () => {
      const participante = mockParticipante();
      repo.findOne.mockResolvedValue(participante);

      const result = await service.findByCedula('12345678');

      expect(result).toBe(participante);
    });

    it('lanza NotFoundException cuando la cédula no existe', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findByCedula('99999999')).rejects.toThrow(NotFoundException);
    });
  });
});
