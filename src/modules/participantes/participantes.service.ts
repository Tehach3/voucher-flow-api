import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ParticipanteEntity } from './entities/participante.entity';
import { ActualizarParticipanteDto } from '../../common/dtos/actualizar-participante.dto';
import { PaginationDto } from '../../common/dtos/pagination.dto';
import { IParticipante, IParticipantePublico } from '../../common/interfaces/participante.interface';

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

export interface ParticipantesPaginados {
  data: IParticipantePublico[];
  total: number;
  page: number;
  limit: number;
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
    const participante = await this.participantesRepository.findOne({
      where: { cedula },
    });

    if (!participante) {
      throw new NotFoundException(`Participante con cédula ${cedula} no encontrado`);
    }

    return participante;
  }

  async findAll(pagination: PaginationDto): Promise<ParticipantesPaginados> {
    const [data, total] = await this.participantesRepository.findAndCount({
      order: { fechaRegistro: 'DESC' },
      skip: pagination.offset,
      take: pagination.limit,
    });

    return {
      data: data.map(this.toPublico),
      total,
      page: pagination.page ?? 1,
      limit: pagination.limit ?? 20,
    };
  }

  async updateParticipante(
    cedula: string,
    dto: ActualizarParticipanteDto,
  ): Promise<IParticipantePublico> {
    const participante = await this.participantesRepository.findOne({ where: { cedula } });

    if (!participante) {
      throw new NotFoundException(`Participante con cédula ${cedula} no encontrado`);
    }

    if (dto.nombre !== undefined) participante.nombre = dto.nombre;
    if (dto.celular !== undefined) participante.celular = dto.celular;
    if (dto.ciudad !== undefined) participante.ciudad = dto.ciudad;
    if (dto.email !== undefined) participante.email = dto.email;

    const updated = await this.participantesRepository.save(participante);
    this.logger.log(`[PARTICIPANTES] Participante actualizado: ${cedula}`);
    return this.toPublico(updated);
  }

  private toPublico(participante: ParticipanteEntity): IParticipantePublico {
    return {
      cedula: participante.cedula,
      nombre: participante.nombre,
      celular: participante.celular,
      ciudad: participante.ciudad,
      email: participante.email,
    };
  }
}
