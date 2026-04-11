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
import { PaginationDto } from '../../common/dtos/pagination.dto';
import { IEvento, IEventoPublico, EventosPaginados } from '../../common/interfaces/evento.interface';

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
      order: { fecha_registro: 'DESC' },
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

  async findAbiertos(): Promise<IEventoPublico[]> {
    const eventos = await this.eventosRepository.find({
      where: { estado: 'abierto', activo: true },
      order: { fecha_vencimiento: 'ASC' },
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

  async create(dto: CrearEventoDto): Promise<IEvento> {
    const evento = this.eventosRepository.create({
      nombre: dto.nombre,
      descripcion: dto.descripcion ?? null,
      fecha_inicio: dto.fecha_inicio ? new Date(dto.fecha_inicio) : new Date(),
      fecha_vencimiento: new Date(dto.fecha_vencimiento),
      require_validacion_cupones: dto.require_validacion_cupones ?? false,
      cupones_minimos: dto.cupones_minimos ?? null,
      skus_validos: dto.skus_validos ?? ['250g', '500g', '1kg', '5kg'],
      imagen_url: dto.imagen_url ?? null,
      premio_descripcion: dto.premio_descripcion ?? null,
    });

    const saved = await this.eventosRepository.save(evento);
    this.logger.log(`[EVENTOS] Evento creado: id=${saved.id} nombre="${saved.nombre}"`);
    return saved;
  }

  async update(id: number, dto: ActualizarEventoDto): Promise<IEvento> {
    const evento = await this.eventosRepository.findOne({ where: { id } });

    if (!evento) {
      throw new NotFoundException(`Evento con id ${id} no encontrado`);
    }

    if (evento.estado !== 'abierto' && evento.estado !== 'pausado') {
      throw new BadRequestException(`No se puede modificar un evento en estado "${evento.estado}"`);
    }

    if (dto.nombre !== undefined) evento.nombre = dto.nombre;
    if (dto.descripcion !== undefined) evento.descripcion = dto.descripcion;
    if (dto.fecha_vencimiento !== undefined) evento.fecha_vencimiento = new Date(dto.fecha_vencimiento);
    if (dto.fecha_inicio !== undefined) evento.fecha_inicio = new Date(dto.fecha_inicio);
    if (dto.require_validacion_cupones !== undefined) evento.require_validacion_cupones = dto.require_validacion_cupones;
    if (dto.cupones_minimos !== undefined) evento.cupones_minimos = dto.cupones_minimos;
    if (dto.skus_validos !== undefined) evento.skus_validos = dto.skus_validos;
    if (dto.imagen_url !== undefined) evento.imagen_url = dto.imagen_url;
    if (dto.premio_descripcion !== undefined) evento.premio_descripcion = dto.premio_descripcion;

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

  private toPublico(evento: EventoEntity): IEventoPublico {
    return {
      id: evento.id,
      nombre: evento.nombre,
      descripcion: evento.descripcion,
      estado: evento.estado,
      fecha_inicio: evento.fecha_inicio,
      fecha_vencimiento: evento.fecha_vencimiento,
      skus_validos: evento.skus_validos,
      imagen_url: evento.imagen_url,
      premio_descripcion: evento.premio_descripcion,
    };
  }
}
