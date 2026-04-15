import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as crypto from 'crypto';
import { FacturaEntity } from './entities/factura.entity';
import { TicketPendienteEntity, DatosFormulario, EtapaError, MAX_INTENTOS } from './entities/ticket-pendiente.entity';
import { ParticipacionEventoEntity } from '../participaciones/entities/participacion-evento.entity';
import { ParticipantesService } from '../participantes/participantes.service';
import { EventosService } from '../eventos/eventos.service';
import { CloudinaryService } from '../../services/cloudinary.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { RegistrarParticipacionDto, ProductoFacturaDto } from '../../common/dtos/registrar-participacion.dto';
import { FiltrarTicketsDto } from '../../common/dtos/filtrar-tickets.dto';
import { FiltrarPendientesDto } from '../../common/dtos/filtrar-pendientes.dto';
import { CondicionCupon } from '../eventos/entities/evento.entity';
import { SKU_CUPONES } from '../../common/constants/sku.constants';
import { ParticipanteEntity } from '../participantes/entities/participante.entity';
import { IEvento } from '../../common/interfaces/evento.interface';
import {
  IRegistroParticipacionResponse,
  ProductoRegistrado,
  CuponesResponse,
  CuponesUsuarioPaginados,
  CampanhaResumen,
  FacturaCupon,
  IFactura,
  TicketResumen,
  TicketsPaginados,
  ITicketPendiente,
  PendientesPaginados,
  ResultadoReintento,
  ResultadoLoteReintento,
} from '../../common/interfaces/factura.interface';
import { PaginationDto } from '../../common/dtos/pagination.dto';
import { securityConfig } from '../../config/security.config';
import { testingConfig } from '../../config/testing.config';
import { ERROR_CODES } from '../../common/constants/error.constants';
import { AppException } from '../../common/exceptions/app.exception';

// Estado intermedio que comparten registrarParticipacion y reintentarTicketPendiente
interface ContextoRegistro {
  evento: IEvento;
  participante: ParticipanteEntity;
  esNuevo: boolean;
  participacion: ParticipacionEventoEntity;
}

@Injectable()
export class FacturasService {
  private readonly logger = new Logger(FacturasService.name);

  constructor(
    @InjectRepository(FacturaEntity)
    private readonly facturasRepository: Repository<FacturaEntity>,
    @InjectRepository(TicketPendienteEntity)
    private readonly pendientesRepository: Repository<TicketPendienteEntity>,
    @InjectRepository(ParticipacionEventoEntity)
    private readonly participacionesRepository: Repository<ParticipacionEventoEntity>,
    private readonly dataSource: DataSource,
    private readonly participantesService: ParticipantesService,
    private readonly eventosService: EventosService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  // ── Registro principal ────────────────────────────────────────────────────

  async registrarParticipacion(
    dto: RegistrarParticipacionDto,
    ipAddress?: string,
  ): Promise<IRegistroParticipacionResponse> {
    const { cedula, eventoId, fotoBase64 } = dto;
    this.logger.log(`[TICKETS] Inicio registro — evento: ${eventoId}`);

    // Fase 0 (opcional): verificar unicidad de imagen antes de cualquier otra validación
    const fotoHash = this.calcularHashImagen(fotoBase64);
    if (fotoHash) {
      const duplicada = await this.facturasRepository.findOne({
        where: { eventoId, fotoHash },
      });
      if (duplicada) {
        await this.auditoriaService.registrar({
          eventoTipo: 'IMAGEN_DUPLICADA',
          entidad:    'tickets',
          entidadId:  duplicada.id,
          ipAddress,
          datosNuevos: { cedulaHash: AuditoriaService.hashCedula(cedula), eventoId },
        });
        throw AppException.conflict(ERROR_CODES.IMAGE_DUPLICATE);
      }
    }

    // Fases 1-6: validaciones de negocio (fallan con 4xx, nunca guardan pendiente)
    const contexto = await this.validarYPreparar(dto);
    this.logger.log(`[TICKETS] Validaciones OK — subiendo imagen`);

    // Fase 7: subir imagen a Cloudinary
    const fotoMimetype = this.extraerMimetype(fotoBase64);
    let fotoUrl: string;
    try {
      const { url } = await this.cloudinaryService.uploadBase64(fotoBase64, eventoId, dto.numeroTicket);
      fotoUrl = url;
    } catch (uploadError) {
      const mensaje = uploadError instanceof Error ? uploadError.message : String(uploadError);
      this.logger.error(`[TICKETS] Fallo upload — evento: ${eventoId}: ${mensaje}`);

      const pendiente = await this.guardarPendiente(dto, 'upload_imagen', mensaje, {
        fotoBase64,
        fotoMimetype,
      });
      await this.auditoriaService.registrar({
        eventoTipo: 'TICKET_FALLIDO',
        entidad:    'tickets_pendientes',
        entidadId:  pendiente.id,
        ipAddress,
        datosNuevos: { cedulaHash: AuditoriaService.hashCedula(cedula), eventoId, etapa: 'upload_imagen', error: mensaje },
      });
      throw AppException.serviceUnavailable(ERROR_CODES.UPLOAD_FALLIDO, {
        pendienteId: pendiente.id,
      });
    }

    // Fase 8: persistir en DB
    try {
      const resultado = await this.ejecutarTransaccionDB(contexto, dto, fotoUrl, fotoHash);
      await this.auditoriaService.registrar({
        eventoTipo: 'TICKET_REGISTRADO',
        entidad:    'tickets',
        ipAddress,
        datosNuevos: {
          cedulaHash: AuditoriaService.hashCedula(cedula),
          eventoId,
          numeroTicket: dto.numeroTicket,
          local: dto.local,
          cuponesGenerados: resultado.cuponesGenerados,
        },
      });
      return resultado;
    } catch (dbError) {
      const mensaje = dbError instanceof Error ? dbError.message : String(dbError);
      this.logger.error(`[TICKETS] Fallo DB — evento: ${eventoId}: ${mensaje}`);

      const pendiente = await this.guardarPendiente(dto, 'escritura_db', mensaje, { fotoUrl });
      await this.auditoriaService.registrar({
        eventoTipo: 'TICKET_FALLIDO',
        entidad:    'tickets_pendientes',
        entidadId:  pendiente.id,
        ipAddress,
        datosNuevos: { cedulaHash: AuditoriaService.hashCedula(cedula), eventoId, etapa: 'escritura_db', error: mensaje },
      });
      throw AppException.serviceUnavailable(ERROR_CODES.PERSISTENCIA_FALLIDA, {
        pendienteId: pendiente.id,
      });
    }
  }

  // ── Reintentos ────────────────────────────────────────────────────────────

  async reintentarTicketPendiente(pendienteId: number): Promise<ResultadoReintento> {
    const pendiente = await this.pendientesRepository.findOne({ where: { id: pendienteId } });

    if (!pendiente) {
      throw AppException.notFound(ERROR_CODES.PENDING_NOT_FOUND, { pendienteId });
    }

    if (pendiente.estado === 'completado') {
      throw AppException.badRequest(ERROR_CODES.PENDING_ALREADY_PROCESSED, { pendienteId });
    }

    if (pendiente.estado === 'procesando') {
      throw AppException.badRequest(ERROR_CODES.PENDING_PROCESSING, { pendienteId });
    }

    const resultado = await this.procesarReintento(pendiente);

    if (!resultado.exitoso) {
      const httpStatus =
        resultado.etapaFallo === 'validacion' || resultado.etapaFallo === 'imagen_no_disponible'
          ? HttpStatus.UNPROCESSABLE_ENTITY
          : HttpStatus.SERVICE_UNAVAILABLE;

      throw new HttpException(
        {
          codigo: resultado.codigoError ?? (httpStatus === HttpStatus.UNPROCESSABLE_ENTITY ? ERROR_CODES.VALIDATION_ERROR : ERROR_CODES.PERSISTENCIA_FALLIDA),
          sistema: resultado.error ?? resultado.mensaje,
          mensaje: resultado.mensaje,
          etapaFallo: resultado.etapaFallo,
          pendienteId: resultado.pendienteId,
        },
        httpStatus,
      );
    }

    return resultado;
  }

  async reintentarTodosPendientes(): Promise<ResultadoLoteReintento> {
    const pendientes = await this.pendientesRepository.find({
      where: { estado: 'pendiente' },
      order: { fechaRegistro: 'ASC' },
    });

    this.logger.log(`[PENDIENTES] Iniciando reintento masivo — ${pendientes.length} tickets`);

    const resultados: ResultadoReintento[] = [];
    let exitosos = 0;
    let fallidos = 0;

    for (const pendiente of pendientes) {
      try {
        const resultado = await this.procesarReintento(pendiente);
        resultados.push(resultado);
        if (resultado.exitoso) exitosos++;
        else fallidos++;
      } catch (error) {
        const mensaje = error instanceof Error ? error.message : String(error);
        resultados.push({ pendienteId: pendiente.id, exitoso: false, mensaje, error: mensaje });
        fallidos++;
      }
    }

    this.logger.log(
      `[PENDIENTES] Reintento masivo completado — exitosos: ${exitosos}, fallidos: ${fallidos}`,
    );

    return {
      procesados: pendientes.length,
      exitosos,
      fallidos,
      resultados,
    };
  }

  async getPendientes(filtros: FiltrarPendientesDto): Promise<PendientesPaginados> {
    const { estado, cedula, eventoId, page = 1, limit = 20 } = filtros;

    const qb = this.pendientesRepository
      .createQueryBuilder('p')
      .orderBy('p.fechaRegistro', 'DESC');

    if (estado) {
      qb.andWhere('p.estado = :estado', { estado });
    }

    if (cedula) {
      qb.andWhere("p.datos_formulario->>'cedula' = :cedula", { cedula });
    }

    if (eventoId) {
      qb.andWhere("(p.datos_formulario->>'eventoId')::int = :eventoId", { eventoId });
    }

    const total = await qb.getCount();
    const registros = await qb.skip((page - 1) * limit).take(limit).getMany();

    const data: ITicketPendiente[] = registros.map((p) => ({
      id: p.id,
      cedula: p.datosFormulario.cedula,
      eventoId: p.datosFormulario.eventoId,
      numeroTicket: p.datosFormulario.numeroTicket,
      estado: p.estado,
      etapaError: p.etapaError,
      mensajeError: p.mensajeError,
      intentos: p.intentos,
      tieneImagen: !!p.fotoBufferB64 || !!p.fotoUrl,
      fechaRegistro: p.fechaRegistro,
      fechaUltimoIntento: p.fechaUltimoIntento,
    }));

    return { data, total, page, limit };
  }

  // ── Consultas ─────────────────────────────────────────────────────────────

  async getCuponesByCedula(cedula: string, paginacion: PaginationDto): Promise<CuponesUsuarioPaginados> {
    const participante = await this.participantesService.findByCedula(cedula);

    const page = paginacion.page ?? 1;
    const limit = paginacion.limit ?? 20;

    const [participaciones, total] = await this.participacionesRepository.findAndCount({
      where: { participanteId: participante.id, activo: true },
      relations: ['evento', 'facturas'],
      order: { fechaRegistro: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const campanhas: CampanhaResumen[] = participaciones.map((p) => ({
      eventoId: p.eventoId,
      nombre: p.evento?.nombre ?? `Campaña ${p.eventoId}`,
      cuponesAcumulados: p.cuponesAcumulados,
      facturas: (p.facturas ?? [])
        .sort((a, b) => b.fechaCarga.getTime() - a.fechaCarga.getTime())
        .map((f): FacturaCupon => ({
          id: f.id,
          numeroTicket: f.numeroTicket,
          local: f.local,
          multiplicador: f.multiplicador,
          coeficienteMultiplicador: f.coeficienteMultiplicador,
          sku: f.sku,
          cantidad: f.cantidad,
          cuponesBase: f.cuponesBase,
          cuponesGenerados: f.cuponesGenerados,
          bonus: f.bonus ?? null,
          fotoUrl: f.fotoUrl,
          fechaCarga: f.fechaCarga,
        })),
    }));

    return { campanhas, total, page, limit };
  }

  async getCuponesByCedulaEvento(cedula: string, evento_id: number, paginacion: PaginationDto): Promise<CuponesResponse> {
    const participante = await this.participantesService.findByCedula(cedula);

    const participacion = await this.participacionesRepository.findOne({
      where: { participanteId: participante.id, eventoId: evento_id },
    });

    const page = paginacion.page ?? 1;
    const limit = paginacion.limit ?? 20;

    if (!participacion) {
      return { eventoId: evento_id, cuponesAcumulados: 0, totalFacturas: 0, facturas: [], page, limit };
    }

    const [facturas, totalFacturas] = await this.facturasRepository.findAndCount({
      where: { participacionId: participacion.id },
      order: { fechaCarga: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      eventoId: evento_id,
      cuponesAcumulados: participacion.cuponesAcumulados,
      totalFacturas,
      facturas: facturas as IFactura[],
      page,
      limit,
    };
  }

  async findAllTickets(filtros: FiltrarTicketsDto): Promise<TicketsPaginados> {
    const { numeroTicket, ciudad, fechaDesde, fechaHasta, page = 1, limit = 20 } = filtros;

    const qb = this.facturasRepository
      .createQueryBuilder('f')
      .innerJoin('f.participante', 'u')
      .innerJoin('f.evento', 'e')
      .select([
        'f.id                      AS id',
        'u.ciudad                  AS ciudad',
        'e.id                      AS "eventoId"',
        'e.nombre                  AS "eventoNombre"',
        'f.numero_ticket           AS "numeroTicket"',
        'f.local                   AS local',
        'f.multiplicador           AS multiplicador',
        'f.coeficiente_multiplicador AS "coeficienteMultiplicador"',
        'f.sku                     AS sku',
        'f.cantidad                AS cantidad',
        'f.cupones_base            AS "cuponesBase"',
        'f.cupones_generados       AS "cuponesGenerados"',
        'f.bonus                   AS bonus',
        'f.foto_url                AS "fotoUrl"',
        'f.fecha_carga             AS "fechaCarga"',
      ])
      .orderBy('f.fecha_carga', 'DESC');

    if (numeroTicket) qb.andWhere('LOWER(f.numero_ticket) LIKE LOWER(:numeroTicket)', { numeroTicket: `%${numeroTicket}%` });
    if (ciudad) qb.andWhere('LOWER(u.ciudad) LIKE LOWER(:ciudad)', { ciudad: `%${ciudad}%` });
    if (fechaDesde) qb.andWhere('f.fecha_carga >= :fechaDesde', { fechaDesde });
    if (fechaHasta) qb.andWhere('f.fecha_carga <= :fechaHasta', { fechaHasta: `${fechaHasta}T23:59:59.999Z` });

    const total = await qb.getCount();
    const raw = await qb.offset((page - 1) * limit).limit(limit).getRawMany();

    const data: TicketResumen[] = raw.map((r) => ({
      id: r.id,
      ciudad: r.ciudad ?? null,
      eventoId: r.eventoId,
      eventoNombre: r.eventoNombre,
      numeroTicket: r.numeroTicket,
      local: r.local,
      multiplicador: r.multiplicador,
      coeficienteMultiplicador: r.coeficienteMultiplicador ? Number(r.coeficienteMultiplicador) : null,
      sku: r.sku,
      cantidad: Number(r.cantidad),
      cuponesBase: Number(r.cuponesBase),
      cuponesGenerados: Number(r.cuponesGenerados),
      bonus: r.bonus !== null && r.bonus !== undefined ? Number(r.bonus) : null,
      fotoUrl: r.fotoUrl,
      fechaCarga: r.fechaCarga,
    }));

    return { data, total, page, limit };
  }

  // ── Privados ──────────────────────────────────────────────────────────────

  /**
   * Pasos 1-6: validaciones de negocio que no dependen de Cloudinary.
   * Lanza 4xx si algo es inválido. No guarda pendiente.
   */
  private async validarYPreparar(dto: DatosFormulario): Promise<ContextoRegistro> {
    const { cedula, nombre, celular, ciudad, email, eventoId, numeroTicket, productos } = dto;

    const eventoEntity = await this.eventosService.findById(eventoId);

    if (!eventoEntity.activo) {
      throw AppException.badRequest(ERROR_CODES.EVENTO_INACTIVE, { eventoId });
    }

    const estadoEvento = this.eventosService.calcularEstado(eventoEntity as any);

    if (estadoEvento === 'cerrado') {
      throw AppException.badRequest(ERROR_CODES.EVENTO_CLOSED, { eventoId });
    }

    if (estadoEvento === 'no_iniciado') {
      throw AppException.badRequest(ERROR_CODES.EVENTO_NOT_STARTED, {
        eventoId,
        inicio: eventoEntity.fechaInicio.toISOString(),
      });
    }

    if (estadoEvento === 'vencido') {
      throw AppException.badRequest(ERROR_CODES.EVENTO_EXPIRED, {
        eventoId,
        cierre: eventoEntity.fechaCierre.toISOString(),
      });
    }

    const evento = eventoEntity;
    const condiciones = (evento as any).condicionesCupones as CondicionCupon[] | null;

    if (condiciones && condiciones.length > 0) {
      const skusValidos = condiciones.map((c) => c.sku);
      const skusInvalidos = productos.map((p) => p.sku).filter((sku) => !skusValidos.includes(sku));

      if (skusInvalidos.length > 0) {
        throw AppException.badRequest(ERROR_CODES.INVALID_SKU, {
          skusInvalidos,
          skusValidos,
        });
      }
    }

    // Verificar que el número de ticket no haya sido usado ya en esta campaña
    const ticketEnCampaña = await this.facturasRepository.findOne({
      where: { eventoId, numeroTicket },
    });

    if (ticketEnCampaña) {
      throw AppException.conflict(ERROR_CODES.FACTURA_ALREADY_EXISTS);
    }

    const { participante, esNuevo } = await this.participantesService.findOrCreate({
      cedula, nombre, celular, ciudad, email,
    });

    if (esNuevo && !nombre) {
      throw AppException.badRequest(ERROR_CODES.NOMBRE_REQUIRED);
    }

    await this.dataSource.query('SELECT crear_participacion_evento($1, $2)', [participante.id, eventoId]);

    const participacion = await this.participacionesRepository.findOne({
      where: { participanteId: participante.id, eventoId },
    });

    if (!participacion) {
      throw AppException.badRequest(ERROR_CODES.PARTICIPACION_FAILED, { eventoId });
    }

    return { evento, participante, esNuevo, participacion };
  }

  /**
   * Fase 8: ejecuta la transacción de DB y construye la respuesta final.
   * Lanza error de DB si algo falla — el caller decide si guarda pendiente.
   */
  private async ejecutarTransaccionDB(
    contexto: ContextoRegistro,
    dto: DatosFormulario,
    fotoUrl: string,
    fotoHash: string | null = null,
  ): Promise<IRegistroParticipacionResponse> {
    if (testingConfig.forceDbWriteError) {
      this.logger.warn('[TICKETS] FORCE_DB_WRITE_ERROR activo — simulando fallo de escritura en DB');
      throw new Error('[TEST] Forced DB write failure (FORCE_DB_WRITE_ERROR=true)');
    }

    const { evento, participante, esNuevo, participacion } = contexto;
    const { cedula, eventoId, numeroTicket, local, multiplicador, coeficienteMultiplicador, productos } = dto;
    const bonus = (dto as any).bonus as number | null ?? null;
    const condiciones = (evento as any).condicionesCupones as CondicionCupon[] | null;
    const coeficiente = multiplicador ? (coeficienteMultiplicador ?? 1) : 1;

    const productosRegistrados: ProductoRegistrado[] = [];
    let totalCuponesGenerados = 0;

    await this.dataSource.transaction(async (manager) => {
      for (let i = 0; i < productos.length; i++) {
        const producto = productos[i];
        const cuponesBase = this.calcularCupones(condiciones, producto);
        const cuponesGenerados = this.aplicarMultiplicador(cuponesBase, multiplicador, coeficienteMultiplicador);

        const factura = manager.create(FacturaEntity, {
          participanteId: participante.id,
          eventoId,
          participacionId: participacion.id,
          numeroTicket,
          local,
          multiplicador,
          coeficienteMultiplicador: multiplicador ? coeficienteMultiplicador : null,
          sku: producto.sku,
          cantidad: producto.cantidad,
          cuponesBase,
          cuponesGenerados,
          // Bonus se almacena solo en la primera fila del registro; el resto queda null
          bonus: i === 0 && bonus ? bonus : null,
          fotoUrl,
          fotoHash,
          ocrData: null,
        });

        await manager.save(FacturaEntity, factura);

        productosRegistrados.push({
          sku: producto.sku,
          cantidad: producto.cantidad,
          cuponesBase,
          coeficienteAplicado: coeficiente,
          cuponesGenerados,
        });
        totalCuponesGenerados += cuponesGenerados;
      }

      // Aplicar bonus: incrementar cupones_acumulados directamente en participacion_evento
      if (bonus && bonus > 0) {
        await manager.query(
          'UPDATE participaciones_evento SET cupones_acumulados = cupones_acumulados + $1 WHERE id = $2',
          [bonus, participacion.id],
        );
      }
    });

    const participacionActualizada = await this.participacionesRepository.findOne({
      where: { id: participacion.id },
    });

    const cuponesAcumulados = participacionActualizada?.cuponesAcumulados ?? totalCuponesGenerados;

    this.logger.log(
      `[TICKETS] Completado — cédula: ${cedula}, local: "${local}", ` +
      `multiplicador: ${multiplicador}${multiplicador ? ` x${coeficiente}` : ''}, ` +
      `+${totalCuponesGenerados} cupones${bonus ? ` +${bonus} bonus` : ''} (total campaña: ${cuponesAcumulados})`,
    );

    return {
      mensaje: esNuevo
        ? 'Participante registrado y cupones asignados correctamente'
        : 'Cupones agregados al participante existente',
      esUsuarioNuevo: esNuevo,
      eventoId,
      numeroTicket,
      local,
      multiplicadorAplicado: multiplicador,
      coeficienteAplicado: coeficiente,
      fotoUrl,
      productos: productosRegistrados,
      cuponesGenerados: totalCuponesGenerados,
      bonus,
      cuponesAcumulados,
    };
  }

  /**
   * Ejecuta un reintento: re-valida las reglas, sube imagen si es necesario,
   * guarda en DB y actualiza el estado del pendiente.
   */
  private async procesarReintento(pendiente: TicketPendienteEntity): Promise<ResultadoReintento> {
    pendiente.estado = 'procesando';
    pendiente.intentos += 1;
    pendiente.fechaUltimoIntento = new Date();
    await this.pendientesRepository.save(pendiente);

    const dto = pendiente.datosFormulario;
    this.logger.log(
      `[PENDIENTES] Reintentando id=${pendiente.id} — cédula: ${dto.cedula}, intento ${pendiente.intentos}`,
    );

    type FaseReintento = 'validacion' | 'imagen_no_disponible' | 'upload_storage' | 'escritura_db';
    let faseActual: FaseReintento = 'validacion';

    try {
      const contexto = await this.validarYPreparar(dto);

      faseActual = 'upload_storage';
      let fotoUrl = pendiente.fotoUrl;

      if (!fotoUrl) {
        if (!pendiente.fotoBufferB64) {
          faseActual = 'imagen_no_disponible';
          throw AppException.badRequest(ERROR_CODES.IMAGE_MISSING);
        }

        const dataUri = pendiente.fotoMimetype
          ? `data:${pendiente.fotoMimetype};base64,${pendiente.fotoBufferB64}`
          : pendiente.fotoBufferB64;

        const { url } = await this.cloudinaryService.uploadBase64(dataUri, dto.eventoId, dto.numeroTicket);
        fotoUrl = url;

        pendiente.fotoUrl = fotoUrl;
        pendiente.fotoBufferB64 = null;
        pendiente.etapaError = 'escritura_db';
        await this.pendientesRepository.save(pendiente);
      }

      faseActual = 'escritura_db';
      const registro = await this.ejecutarTransaccionDB(contexto, dto, fotoUrl);

      pendiente.estado = 'completado';
      pendiente.mensajeError = null;
      await this.pendientesRepository.save(pendiente);

      return {
        pendienteId: pendiente.id,
        exitoso: true,
        mensaje: 'Reintento exitoso. Ticket registrado correctamente.',
        registro,
      };
    } catch (error) {
      let mensajeError: string;
      let codigoError: string | undefined;

      if (error instanceof HttpException) {
        const resp = error.getResponse() as Record<string, unknown>;
        codigoError = resp.codigo as string | undefined;
        mensajeError = (resp.mensaje as string) ?? (resp.sistema as string) ?? error.message;
      } else {
        mensajeError = error instanceof Error ? error.message : String(error);
      }

      const nuevoEstado = pendiente.intentos >= MAX_INTENTOS ? 'fallido_permanente' : 'pendiente';

      pendiente.estado = nuevoEstado;
      pendiente.mensajeError = mensajeError;
      await this.pendientesRepository.save(pendiente);

      this.logger.warn(
        `[PENDIENTES] Fallo reintento id=${pendiente.id} etapa="${faseActual}" intento ${pendiente.intentos}/${MAX_INTENTOS}: ${mensajeError}`,
      );

      return {
        pendienteId: pendiente.id,
        exitoso: false,
        etapaFallo: faseActual,
        codigoError,
        mensaje: nuevoEstado === 'fallido_permanente'
          ? `Máximo de intentos alcanzado (${MAX_INTENTOS}). Requiere intervención manual.`
          : `Reintento fallido en etapa "${faseActual}". ${mensajeError}`,
        error: mensajeError,
      };
    }
  }

  private async guardarPendiente(
    dto: DatosFormulario,
    etapaError: EtapaError,
    mensajeError: string,
    imagen: { fotoBase64?: string; fotoMimetype?: string; fotoUrl?: string } = {},
  ): Promise<TicketPendienteEntity> {
    const base64Puro = imagen.fotoBase64
      ? imagen.fotoBase64.replace(/^data:[^,]+,/, '')
      : null;

    try {
      const pendiente = this.pendientesRepository.create({
        datosFormulario: {
          cedula: dto.cedula,
          nombre: dto.nombre,
          celular: dto.celular,
          ciudad: dto.ciudad,
          email: dto.email,
          eventoId: dto.eventoId,
          numeroTicket: dto.numeroTicket,
          local: dto.local,
          multiplicador: dto.multiplicador,
          coeficienteMultiplicador: dto.coeficienteMultiplicador,
          productos: dto.productos,
          bonus: (dto as any).bonus ?? null,
        },
        fotoUrl: imagen.fotoUrl ?? null,
        fotoBufferB64: base64Puro,
        fotoMimetype: imagen.fotoMimetype ?? null,
        etapaError,
        mensajeError,
        estado: 'pendiente',
        intentos: 0,
      });

      const saved = await this.pendientesRepository.save(pendiente);
      this.logger.log(
        `[PENDIENTES] Guardado pendiente id=${saved.id} — cédula: ${dto.cedula}, etapa: ${etapaError}`,
      );
      return saved;
    } catch (saveError) {
      const msg = saveError instanceof Error ? saveError.message : String(saveError);
      this.logger.error(`[PENDIENTES] Error crítico al guardar pendiente: ${msg}`);
      throw saveError;
    }
  }

  private calcularCupones(
    condicionesCupones: CondicionCupon[] | null,
    producto: { sku: string; cantidad: number },
  ): number {
    if (!condicionesCupones || condicionesCupones.length === 0) {
      const cuponesPorUnidad = SKU_CUPONES[producto.sku] ?? 0;
      return cuponesPorUnidad * producto.cantidad;
    }

    const condicion = condicionesCupones.find((c) => c.sku === producto.sku);
    if (!condicion) return 0;

    return condicion.cuponesPorUnidad * producto.cantidad;
  }

  private aplicarMultiplicador(cuponesBase: number, multiplicador: boolean, coeficiente?: number): number {
    if (multiplicador && coeficiente && coeficiente >= 2) {
      return cuponesBase * coeficiente;
    }
    return cuponesBase;
  }

  /** Extrae el tipo MIME del prefijo de un Data URI (data:image/jpeg;base64,...) */
  private extraerMimetype(dataUri: string): string {
    const match = dataUri.match(/^data:(image\/[a-z]+);base64,/);
    return match ? match[1] : 'image/jpeg';
  }

  /**
   * Calcula SHA-256 del contenido base64 de la imagen (sin el prefijo data:...).
   * Retorna null si SECURITY_IMAGE_HASH_ENABLED !== 'true'.
   */
  private calcularHashImagen(fotoBase64: string): string | null {
    if (!securityConfig.imageHash.enabled) return null;
    const data = fotoBase64.replace(/^data:[^,]+,/, '');
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}
