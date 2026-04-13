import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { AuditoriaEntity } from './entities/auditoria.entity';
import { securityConfig } from '../../config/security.config';

export interface RegistrarAuditoriaParams {
  eventoTipo: string;
  entidad: string;
  entidadId?: number | null;
  ipAddress?: string | null;
  datosNuevos?: Record<string, unknown> | null;
}

@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger(AuditoriaService.name);

  constructor(
    @InjectRepository(AuditoriaEntity)
    private readonly auditoriaRepository: Repository<AuditoriaEntity>,
  ) {}

  /**
   * Registra un evento de auditoría.
   * Si SECURITY_AUDIT_ENABLED !== 'true', retorna sin hacer nada.
   * Los errores internos se logean pero nunca interrumpen el flujo principal.
   */
  async registrar(params: RegistrarAuditoriaParams): Promise<void> {
    if (!securityConfig.audit.enabled) return;

    try {
      const registro = this.auditoriaRepository.create({
        eventoTipo: params.eventoTipo,
        entidad:    params.entidad,
        entidadId:  params.entidadId  ?? null,
        usuarioId:  null,
        ipAddress:  params.ipAddress  ?? null,
        datosNuevos: params.datosNuevos ?? null,
        datosAnteriores: null,
      });
      await this.auditoriaRepository.save(registro);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`[AUDITORIA] Error al registrar evento: ${msg}`);
    }
  }

  /** SHA-256 de la cédula — nunca almacenamos la cédula en texto plano en auditoría */
  static hashCedula(cedula: string): string {
    return crypto.createHash('sha256').update(cedula).digest('hex');
  }
}
