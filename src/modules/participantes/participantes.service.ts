import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ParticipanteEntity } from './entities/participante.entity';
import { IParticipante } from '../../common/interfaces/participante.interface';
import { ERROR_CODES } from '../../common/constants/error.constants';
import { AppException } from '../../common/exceptions/app.exception';

export interface FindOrCreateParams {
  cedula: string;
  nombre?: string;
  celular?: string;
  ciudad?: string;
  email?: string;
}

export interface FindOrCreateResult {
  participante: ParticipanteEntity;
  esNuevo: boolean;
}

@Injectable()
export class ParticipantesService {
  private readonly logger = new Logger(ParticipantesService.name);

  constructor(
    @InjectRepository(ParticipanteEntity)
    private readonly participantesRepository: Repository<ParticipanteEntity>,
  ) {}

  async findOrCreate(params: FindOrCreateParams): Promise<FindOrCreateResult> {
    const { cedula, nombre, celular, ciudad, email } = params;

    const existing = await this.participantesRepository.findOne({ where: { cedula } });

    if (existing) {
      this.logger.debug(`[PARTICIPANTES] Participante existente: ${cedula}`);
      return { participante: existing, esNuevo: false };
    }

    const nuevo = this.participantesRepository.create({
      cedula,
      nombre: nombre!,
      celular: celular ?? null,
      ciudad: ciudad ?? null,
      email: email ?? null,
    });

    const saved = await this.participantesRepository.save(nuevo);
    this.logger.log(`[PARTICIPANTES] Participante creado: ${cedula}`);
    return { participante: saved, esNuevo: true };
  }

  async findByCedula(cedula: string): Promise<IParticipante> {
    const participante = await this.participantesRepository.findOne({ where: { cedula } });

    if (!participante) {
      throw AppException.notFound(ERROR_CODES.USUARIO_NOT_FOUND);
    }

    return participante;
  }
}
