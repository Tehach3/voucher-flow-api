import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { EventoEntity } from './entities/evento.entity';
import { CrearEventoDto } from '../../common/dtos/crear-evento.dto';
import { ActualizarEventoDto } from '../../common/dtos/actualizar-evento.dto';
import { FiltrarEventosDto } from '../../common/dtos/filtrar-eventos.dto';
import { PaginationDto } from '../../common/dtos/pagination.dto';
import {
  IEvento,
  IEventoCreado,
  IEventoPublico,
  EventosPaginados,
  DisponibilidadEvento,
} from '../../common/interfaces/evento.interface';

@Injectable()
export class EventosService {
  private readonly logger = new Logger(EventosService.name);

  constructor(
    @InjectRepository(EventoEntity)
    private readonly eventosRepository: Repository<EventoEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(pagination: PaginationDto): Promise<EventosPaginados> {
    const [data, total] = await this.eventosRepository.findAndCount({
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

  async findAbiertos(filtros: FiltrarEventosDto): Promise<IEventoPublico[]> {
    const where: Record<string, unknown> = { activo: true };

    if (filtros.estado) {
      where.estado = filtros.estado;
    } else {
      where.estado = 'abierto';
    }

    const eventos = await this.eventosRepository.find({
      where,
      order: { fechaCierre: 'ASC' },
    });

    return eventos.map(this.toPublico);
  }

  async findById(id: number): Promise<IEvento> {
    const evento = await this.eventosRepository.findOne({ where: { id } });

    if (!evento) {
      throw new NotFoundException(`Evento con id ${id} no encontrado`);
    }

    return evento;
  }

  async create(dto: CrearEventoDto): Promise<IEventoCreado> {
    const tieneCondiciones = dto.tieneCondicionesMultiples ?? false;

    this.validarCondicionesCupones(tieneCondiciones, dto.condicionesCupones);

    const evento = this.eventosRepository.create({
      nombre: dto.nombre,
      descripcion: dto.descripcion ?? null,
      fechaInicio: new Date(dto.fechaInicio),
      fechaCierre: new Date(dto.fechaCierre),
      requireValidacionCupones: true,
      cuponesMinimos: dto.cuponesMinimos,
      tieneCondicionesMultiples: tieneCondiciones,
      condicionesCupones: dto.condicionesCupones ?? null,
      premios: dto.premios ?? null,
      imagenUrl: dto.imagenUrl ?? null,
    });

    const saved = await this.eventosRepository.save(evento);
    this.logger.log(
      `[EVENTOS] Evento creado: id=${saved.id} nombre="${saved.nombre}" condicionesMultiples=${tieneCondiciones}`,
    );

    return {
      mensaje: 'Evento registrado correctamente',
      nombre: saved.nombre,
      fechaInicio: saved.fechaInicio,
      fechaCierre: saved.fechaCierre,
      imagenUrl: saved.imagenUrl,
      fechaRegistro: saved.fechaRegistro,
    };
  }

  async update(id: number, dto: ActualizarEventoDto): Promise<IEvento> {
    const evento = await this.eventosRepository.findOne({ where: { id } });

    if (!evento) {
      throw new NotFoundException(`Evento con id ${id} no encontrado`);
    }

    if (evento.estado !== 'abierto' && evento.estado !== 'pausado') {
      throw new BadRequestException(
        `No se puede modificar un evento en estado "${evento.estado}"`,
      );
    }

    const tieneCondiciones =
      dto.tieneCondicionesMultiples ?? evento.tieneCondicionesMultiples;

    if (dto.condicionesCupones !== undefined) {
      this.validarCondicionesCupones(tieneCondiciones, dto.condicionesCupones);
    }

    if (dto.nombre !== undefined) evento.nombre = dto.nombre;
    if (dto.descripcion !== undefined) evento.descripcion = dto.descripcion;
    if (dto.fechaCierre !== undefined) evento.fechaCierre = new Date(dto.fechaCierre);
    if (dto.fechaInicio !== undefined) evento.fechaInicio = new Date(dto.fechaInicio);
    if (dto.cuponesMinimos !== undefined) evento.cuponesMinimos = dto.cuponesMinimos;
    if (dto.tieneCondicionesMultiples !== undefined) evento.tieneCondicionesMultiples = dto.tieneCondicionesMultiples;
    if (dto.condicionesCupones !== undefined) evento.condicionesCupones = dto.condicionesCupones;
    if (dto.premios !== undefined) evento.premios = dto.premios;
    if (dto.imagenUrl !== undefined) evento.imagenUrl = dto.imagenUrl;

    const updated = await this.eventosRepository.save(evento);
    this.logger.log(`[EVENTOS] Evento actualizado: id=${id}`);
    return updated;
  }

  async cerrar(id: number): Promise<IEvento> {
    const evento = await this.eventosRepository.findOne({ where: { id } });

    if (!evento) {
      throw new NotFoundException(`Evento con id ${id} no encontrado`);
    }

    if (evento.estado === 'finalizado') {
      throw new BadRequestException(`El evento ${id} ya está finalizado`);
    }

    await this.dataSource.query('SELECT cerrar_evento($1)', [id]);

    const cerrado = await this.eventosRepository.findOne({ where: { id } });
    this.logger.log(`[EVENTOS] Evento cerrado: id=${id}`);
    return cerrado!;
  }

  private calcularDisponibilidad(evento: EventoEntity): DisponibilidadEvento {
    const now = new Date();
    if (now < evento.fechaInicio) return 'noIniciado';
    if (now > evento.fechaCierre) return 'vencido';
    return 'disponible';
  }

  private validarCondicionesCupones(
    tieneCondicionesMultiples: boolean,
    condicionesCupones: Array<{ sku: string; cuponesPorUnidad: number }> | undefined,
  ): void {
    if (tieneCondicionesMultiples) {
      if (!condicionesCupones || condicionesCupones.length < 2) {
        throw new BadRequestException(
          'condicionesCupones debe tener al menos 2 elementos cuando tieneCondicionesMultiples=true',
        );
      }
    } else {
      if (condicionesCupones && condicionesCupones.length > 1) {
        throw new BadRequestException(
          'condicionesCupones debe tener exactamente 1 elemento cuando tieneCondicionesMultiples=false',
        );
      }
    }
  }

  private toPublico = (evento: EventoEntity): IEventoPublico => {
    return {
      id: evento.id,
      nombre: evento.nombre,
      descripcion: evento.descripcion,
      estado: evento.estado,
      disponibilidad: this.calcularDisponibilidad(evento),
      fechaInicio: evento.fechaInicio,
      fechaCierre: evento.fechaCierre,
      cuponesMinimos: evento.cuponesMinimos,
      tieneCondicionesMultiples: evento.tieneCondicionesMultiples,
      condicionesCupones: evento.condicionesCupones,
      premios: evento.premios,
      imagenUrl: evento.imagenUrl,
    };
  };
}
