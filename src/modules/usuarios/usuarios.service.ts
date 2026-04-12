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
  nombre?: string;
  celular?: string;
  ciudad?: string;
  email?: string;
}

export interface FindOrCreateResult {
  usuario: UsuarioEntity;
  esNuevo: boolean;
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

  async findOrCreate(params: FindOrCreateParams): Promise<FindOrCreateResult> {
    const { cedula, nombre, celular, ciudad, email } = params;

    const existing = await this.usuariosRepository.findOne({ where: { cedula } });

    if (existing) {
      this.logger.debug(`[USUARIOS] Usuario existente: ${cedula}`);
      return { usuario: existing, esNuevo: false };
    }

    const nuevo = this.usuariosRepository.create({
      cedula,
      nombre: nombre!,
      celular: celular ?? null,
      ciudad: ciudad ?? null,
      email: email ?? null,
    });

    const saved = await this.usuariosRepository.save(nuevo);
    this.logger.log(`[USUARIOS] Usuario creado: ${cedula}`);
    return { usuario: saved, esNuevo: true };
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
    if (dto.email !== undefined) usuario.email = dto.email;

    const updated = await this.usuariosRepository.save(usuario);
    this.logger.log(`[USUARIOS] Usuario actualizado: ${cedula}`);
    return this.toPublico(updated);
  }

  private toPublico(usuario: UsuarioEntity): IUsuarioPublico {
    return {
      cedula: usuario.cedula,
      nombre: usuario.nombre,
      celular: usuario.celular,
      ciudad: usuario.ciudad,
      email: usuario.email,
    };
  }
}
