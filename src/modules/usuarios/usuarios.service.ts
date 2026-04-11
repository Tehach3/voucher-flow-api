import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsuarioEntity } from './entities/usuario.entity';
import { ActualizarUsuarioDto } from '../../common/dtos/actualizar-usuario.dto';
import { PaginationDto } from '../../common/dtos/pagination.dto';
import { IUsuario, IUsuarioPublico } from '../../common/interfaces/usuario.interface';

export interface FindOrCreateParams {
  cedula: string;
  nombre: string;
  celular?: string;
  ciudad?: string;
}

export interface UsuariosPaginados {
  data: IUsuarioPublico[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class UsuariosService {
  private readonly logger = new Logger(UsuariosService.name);

  constructor(
    @InjectRepository(UsuarioEntity)
    private readonly usuariosRepository: Repository<UsuarioEntity>,
  ) {}

  async findOrCreate(params: FindOrCreateParams): Promise<UsuarioEntity> {
    const { cedula, nombre, celular, ciudad } = params;

    const existing = await this.usuariosRepository.findOne({
      where: { cedula },
    });

    if (existing) {
      this.logger.debug(`[USUARIOS] Usuario existente: ${cedula}`);
      return existing;
    }

    const nuevo = this.usuariosRepository.create({
      cedula,
      nombre,
      celular: celular ?? null,
      ciudad: ciudad ?? null,
      cupones_acumulados: 0,
    });

    const saved = await this.usuariosRepository.save(nuevo);
    this.logger.log(`[USUARIOS] Usuario creado: ${cedula}`);
    return saved;
  }

  async findByCedula(cedula: string): Promise<IUsuario> {
    const usuario = await this.usuariosRepository.findOne({
      where: { cedula },
    });

    if (!usuario) {
      throw new NotFoundException(`Usuario con cédula ${cedula} no encontrado`);
    }

    return usuario;
  }

  async findAll(pagination: PaginationDto): Promise<UsuariosPaginados> {
    const [data, total] = await this.usuariosRepository.findAndCount({
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

  async updateUsuario(
    cedula: string,
    dto: ActualizarUsuarioDto,
  ): Promise<IUsuarioPublico> {
    const usuario = await this.usuariosRepository.findOne({ where: { cedula } });

    if (!usuario) {
      throw new NotFoundException(`Usuario con cédula ${cedula} no encontrado`);
    }

    if (dto.nombre !== undefined) usuario.nombre = dto.nombre;
    if (dto.celular !== undefined) usuario.celular = dto.celular;
    if (dto.ciudad !== undefined) usuario.ciudad = dto.ciudad;

    const updated = await this.usuariosRepository.save(usuario);
    this.logger.log(`[USUARIOS] Usuario actualizado: ${cedula}`);
    return this.toPublico(updated);
  }

  async incrementarCupones(usuarioId: number, cupones: number): Promise<void> {
    await this.usuariosRepository.increment(
      { id: usuarioId },
      'cupones_acumulados',
      cupones,
    );
    this.logger.debug(
      `[USUARIOS] Cupones incrementados: usuario_id=${usuarioId} +${cupones}`,
    );
  }

  private toPublico(usuario: UsuarioEntity): IUsuarioPublico {
    return {
      cedula: usuario.cedula,
      nombre: usuario.nombre,
      celular: usuario.celular,
      ciudad: usuario.ciudad,
      cupones_acumulados: usuario.cupones_acumulados,
    };
  }
}
