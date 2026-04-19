import {
  Injectable,
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
  ISkusEvento,
  EventosPaginados,
} from '../../common/interfaces/evento.interface';
import { EstadoEvento } from './entities/evento.entity';
import { ERROR_CODES } from '../../common/constants/error.constants';
import { AppException } from '../../common/exceptions/app.exception';

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

  async findAbiertos(filtros: FiltrarEventosDto): Promise<EventosPaginados> {
    const eventos = await this.eventosRepository.find({
      where: { activo: true },
      order: { fechaCierre: 'ASC' },
    });

    const estadoFiltro = filtros.estado ?? 'vigente';
    const page = filtros.page ?? 1;
    const limit = filtros.limit ?? 20;

    const filtrados = eventos
      .map(this.toPublico)
      .filter((e) => e.estado === estadoFiltro);

    const total = filtrados.length;
    const data = filtrados.slice((page - 1) * limit, page * limit);

    return { data, total, page, limit };
  }

  async findSkusEvento(id: number): Promise<ISkusEvento> {
    const evento = await this.eventosRepository.findOne({ where: { id } });

    if (!evento) {
      throw AppException.notFound(ERROR_CODES.EVENTO_NOT_FOUND, { id });
    }

    const skus = (evento.condicionesCupones ?? []).map(({ sku, cuponesPorUnidad }) => ({
      sku,
      cuponesPorUnidad,
    }));

    return {
      eventoId: evento.id,
      nombre: evento.nombre,
      estado: this.calcularEstado(evento),
      tieneCondicionesMultiples: evento.tieneCondicionesMultiples,
      skus,
    };
  }

  async findById(id: number): Promise<IEvento> {
    const evento = await this.eventosRepository.findOne({ where: { id } });

    if (!evento) {
      throw AppException.notFound(ERROR_CODES.EVENTO_NOT_FOUND, { id });
    }

    return evento;
  }

  async create(dto: CrearEventoDto): Promise<IEventoCreado> {
    const tieneCondiciones = dto.tieneCondicionesMultiples ?? false;

    this.validarCondicionesCupones(tieneCondiciones, dto.condicionesCupones);
    this.validarFechasCreacion(dto.fechaInicio, dto.fechaCierre);

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

  async update(id: number, dto: ActualizarEventoDto): Promise<IEventoPublico> {
    const evento = await this.eventosRepository.findOne({ where: { id } });

    if (!evento) {
      throw AppException.notFound(ERROR_CODES.EVENTO_NOT_FOUND, { id });
    }

    if (evento.estadoInterno === 'cerrado') {
      throw AppException.badRequest(ERROR_CODES.EVENTO_UPDATE_CLOSED, { id });
    }

    const tieneCondiciones =
      dto.tieneCondicionesMultiples ?? evento.tieneCondicionesMultiples;

    if (dto.condicionesCupones !== undefined) {
      this.validarCondicionesCupones(tieneCondiciones, dto.condicionesCupones);
    }

    const nuevaFechaInicio = dto.fechaInicio ? new Date(dto.fechaInicio) : evento.fechaInicio;
    const nuevaFechaCierre = dto.fechaCierre ? new Date(dto.fechaCierre) : evento.fechaCierre;

    if (dto.fechaInicio !== undefined || dto.fechaCierre !== undefined) {
      this.validarFechasActualizacion(nuevaFechaInicio, nuevaFechaCierre);
    }

    if (dto.nombre !== undefined) evento.nombre = dto.nombre;
    if (dto.descripcion !== undefined) evento.descripcion = dto.descripcion;
    if (dto.fechaCierre !== undefined) evento.fechaCierre = nuevaFechaCierre;
    if (dto.fechaInicio !== undefined) evento.fechaInicio = nuevaFechaInicio;
    if (dto.cuponesMinimos !== undefined) evento.cuponesMinimos = dto.cuponesMinimos;
    if (dto.tieneCondicionesMultiples !== undefined) evento.tieneCondicionesMultiples = dto.tieneCondicionesMultiples;
    if (dto.condicionesCupones !== undefined) evento.condicionesCupones = dto.condicionesCupones;
    if (dto.premios !== undefined) evento.premios = dto.premios;
    if (dto.imagenUrl !== undefined) evento.imagenUrl = dto.imagenUrl;

    const updated = await this.eventosRepository.save(evento);
    this.logger.log(`[EVENTOS] Evento actualizado: id=${id}`);
    return this.toPublico(updated);
  }

  async cerrar(id: number): Promise<IEventoPublico> {
    const evento = await this.eventosRepository.findOne({ where: { id } });

    if (!evento) {
      throw AppException.notFound(ERROR_CODES.EVENTO_NOT_FOUND, { id });
    }

    if (evento.estadoInterno === 'cerrado') {
      throw AppException.badRequest(ERROR_CODES.EVENTO_ALREADY_CLOSED, { id });
    }

    await this.dataSource.query('SELECT cerrar_evento($1)', [id]);

    const cerrado = await this.eventosRepository.findOne({ where: { id } });
    this.logger.log(`[EVENTOS] Evento cerrado: id=${id}`);
    return this.toPublico(cerrado!);
  }

  // ── Privados ──────────────────────────────────────────────────────────────

  calcularEstado(evento: EventoEntity): EstadoEvento {
    if (evento.estadoInterno === 'cerrado') return 'cerrado';
    const now = new Date();
    if (now < evento.fechaInicio) return 'no_iniciado';
    if (now > evento.fechaCierre) return 'vencido';
    return 'vigente';
  }

  private validarFechasCreacion(fechaInicioStr: string, fechaCierreStr: string): void {
    const now = new Date();
    const fechaInicio = new Date(fechaInicioStr);
    const fechaCierre = new Date(fechaCierreStr);

    if (fechaCierre <= now) {
      throw AppException.badRequest(ERROR_CODES.EVENTO_INVALID_DATE, {
        detalle: 'fechaCierre debe ser una fecha futura',
      });
    }

    if (fechaInicio >= fechaCierre) {
      throw AppException.badRequest(ERROR_CODES.EVENTO_INVALID_DATE, {
        detalle: 'fechaInicio debe ser anterior a fechaCierre',
      });
    }
  }

  private validarFechasActualizacion(fechaInicio: Date, fechaCierre: Date): void {
    const now = new Date();

    if (fechaCierre <= now) {
      throw AppException.badRequest(ERROR_CODES.EVENTO_INVALID_DATE, {
        detalle: 'fechaCierre debe ser una fecha futura',
      });
    }

    if (fechaInicio >= fechaCierre) {
      throw AppException.badRequest(ERROR_CODES.EVENTO_INVALID_DATE, {
        detalle: 'fechaInicio debe ser anterior a fechaCierre',
      });
    }
  }

  private validarCondicionesCupones(
    tieneCondicionesMultiples: boolean,
    condicionesCupones: Array<{ sku: string; cuponesPorUnidad: number }> | undefined,
  ): void {
    if (tieneCondicionesMultiples) {
      if (!condicionesCupones || condicionesCupones.length < 2) {
        throw AppException.badRequest(ERROR_CODES.EVENTO_INVALID_CONDITIONS, {
          detalle: 'condicionesCupones debe tener al menos 2 elementos cuando tieneCondicionesMultiples=true',
        });
      }
    } else {
      if (condicionesCupones && condicionesCupones.length > 1) {
        throw AppException.badRequest(ERROR_CODES.EVENTO_INVALID_CONDITIONS, {
          detalle: 'condicionesCupones debe tener exactamente 1 elemento cuando tieneCondicionesMultiples=false',
        });
      }
    }
  }

  private toPublico = (evento: EventoEntity): IEventoPublico => {
    return {
      id: evento.id,
      nombre: evento.nombre,
      descripcion: evento.descripcion,
      estado: this.calcularEstado(evento),
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
