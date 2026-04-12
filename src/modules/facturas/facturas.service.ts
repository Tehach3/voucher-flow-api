import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { FacturaEntity } from './entities/factura.entity';
import { TicketPendienteEntity, DatosFormulario, EtapaError, MAX_INTENTOS } from './entities/ticket-pendiente.entity';
import { ParticipacionEventoEntity } from '../participaciones/entities/participacion-evento.entity';
import { UsuariosService } from '../usuarios/usuarios.service';
import { EventosService } from '../eventos/eventos.service';
import { CloudinaryService } from '../../services/cloudinary.service';
import { RegistrarParticipacionDto, ProductoFacturaDto } from '../../common/dtos/registrar-participacion.dto';
import { FiltrarTicketsDto } from '../../common/dtos/filtrar-tickets.dto';
import { FiltrarPendientesDto } from '../../common/dtos/filtrar-pendientes.dto';
import { CondicionCupon } from '../eventos/entities/evento.entity';
import { SKU_CUPONES } from '../../common/constants/sku.constants';
import { UsuarioEntity } from '../usuarios/entities/usuario.entity';
import { IEvento } from '../../common/interfaces/evento.interface';
import {
  IRegistroParticipacionResponse,
  ProductoRegistrado,
  CuponesResponse,
  CuponesUsuarioResponse,
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

// Estado intermedio que comparten registrarParticipacion y reintentarTicketPendiente
interface ContextoRegistro {
  evento: IEvento;
  usuario: UsuarioEntity;
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
    private readonly usuariosService: UsuariosService,
    private readonly eventosService: EventosService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  // ── Registro principal ────────────────────────────────────────────────────

  async registrarParticipacion(
    dto: RegistrarParticipacionDto,
  ): Promise<IRegistroParticipacionResponse> {
    const { cedula, eventoId, fotoBase64 } = dto;
    this.logger.log(`[TICKETS] Inicio registro — cédula: ${cedula}, evento: ${eventoId}`);

    // Fases 1-6: validaciones de negocio (fallan con 4xx, nunca guardan pendiente)
    const contexto = await this.validarYPreparar(dto);
    this.logger.log(`[TICKETS] Validaciones OK — subiendo imagen para cédula: ${cedula}`);

    // Fase 7: subir imagen a Cloudinary
    const fotoMimetype = this.extraerMimetype(fotoBase64);
    let fotoUrl: string;
    try {
      const { url } = await this.cloudinaryService.uploadBase64(fotoBase64, cedula);
      fotoUrl = url;
    } catch (uploadError) {
      const mensaje = uploadError instanceof Error ? uploadError.message : String(uploadError);
      this.logger.error(`[TICKETS] Fallo upload para cédula ${cedula}: ${mensaje}`);

      const pendiente = await this.guardarPendiente(dto, 'upload_imagen', mensaje, {
        fotoBase64,
        fotoMimetype,
      });
      throw new HttpException(
        {
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          codigo: 'UPLOAD_FALLIDO',
          mensaje: 'Error al procesar la imagen. Sus datos fueron guardados para reintento.',
          pendienteId: pendiente.id,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    // Fase 8: persistir en DB
    try {
      return await this.ejecutarTransaccionDB(contexto, dto, fotoUrl);
    } catch (dbError) {
      const mensaje = dbError instanceof Error ? dbError.message : String(dbError);
      this.logger.error(`[TICKETS] Fallo DB para cédula ${cedula}: ${mensaje}`);

      const pendiente = await this.guardarPendiente(dto, 'escritura_db', mensaje, { fotoUrl });
      throw new HttpException(
        {
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          codigo: 'PERSISTENCIA_FALLIDA',
          mensaje: 'Imagen subida correctamente. Error al guardar los datos. Guardados para reintento.',
          pendienteId: pendiente.id,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  // ── Reintentos ────────────────────────────────────────────────────────────

  async reintentarTicketPendiente(pendienteId: number): Promise<ResultadoReintento> {
    const pendiente = await this.pendientesRepository.findOne({ where: { id: pendienteId } });

    if (!pendiente) {
      throw new NotFoundException(`Ticket pendiente con id ${pendienteId} no encontrado`);
    }

    if (pendiente.estado === 'completado') {
      throw new BadRequestException('Este ticket pendiente ya fue procesado exitosamente');
    }

    if (pendiente.estado === 'procesando') {
      throw new BadRequestException('Este ticket pendiente ya está siendo procesado');
    }

    return this.procesarReintento(pendiente);
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
      .orderBy('p.fecha_registro', 'DESC');

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

  async getCuponesByCedula(cedula: string): Promise<CuponesUsuarioResponse> {
    const usuario = await this.usuariosService.findByCedula(cedula);

    const participaciones = await this.participacionesRepository.find({
      where: { usuario_id: usuario.id, activo: true },
      relations: ['evento', 'facturas'],
      order: { fecha_registro: 'DESC' },
    });

    const campanhas: CampanhaResumen[] = participaciones.map((p) => ({
      eventoId: p.evento_id,
      nombre: p.evento?.nombre ?? `Campaña ${p.evento_id}`,
      cuponesAcumulados: p.cupones_acumulados,
      facturas: (p.facturas ?? [])
        .sort((a, b) => b.fecha_carga.getTime() - a.fecha_carga.getTime())
        .map((f): FacturaCupon => ({
          id: f.id,
          numeroTicket: f.numero_factura,
          local: f.local,
          multiplicador: f.multiplicador,
          coeficienteMultiplicador: f.coeficienteMultiplicador,
          sku: f.sku,
          cantidad: f.cantidad,
          cuponesBase: f.cupones_base,
          cuponesGenerados: f.cupones_generados,
          fotoUrl: f.foto_url,
          fechaCarga: f.fecha_carga,
        })),
    }));

    return { cedula: usuario.cedula, nombre: usuario.nombre, campanhas };
  }

  async getCuponesByCedulaEvento(cedula: string, evento_id: number): Promise<CuponesResponse> {
    const usuario = await this.usuariosService.findByCedula(cedula);

    const participacion = await this.participacionesRepository.findOne({
      where: { usuario_id: usuario.id, evento_id },
    });

    if (!participacion) {
      return { cedula, evento_id, cupones_acumulados: 0, total_facturas: 0, facturas: [] };
    }

    const facturas = await this.facturasRepository.find({
      where: { participacion_id: participacion.id },
      order: { fecha_carga: 'DESC' },
    });

    return {
      cedula,
      evento_id,
      cupones_acumulados: participacion.cupones_acumulados,
      total_facturas: facturas.length,
      facturas: facturas as IFactura[],
    };
  }

  async getFacturaById(id: number): Promise<IFactura> {
    const factura = await this.facturasRepository.findOne({
      where: { id },
      relations: ['usuario'],
    });

    if (!factura) {
      throw new NotFoundException(`Factura con id ${id} no encontrada`);
    }

    return factura as IFactura;
  }

  async findAllTickets(filtros: FiltrarTicketsDto): Promise<TicketsPaginados> {
    const { cedula, ciudad, fechaDesde, fechaHasta, page = 1, limit = 20 } = filtros;

    const qb = this.facturasRepository
      .createQueryBuilder('f')
      .innerJoin('f.usuario', 'u')
      .innerJoin('f.evento', 'e')
      .select([
        'f.id                      AS id',
        'u.cedula                  AS cedula',
        'u.nombre                  AS nombre',
        'u.ciudad                  AS ciudad',
        'e.id                      AS "eventoId"',
        'e.nombre                  AS "eventoNombre"',
        'f.numero_factura          AS "numeroTicket"',
        'f.local                   AS local',
        'f.multiplicador           AS multiplicador',
        'f.coeficiente_multiplicador AS "coeficienteMultiplicador"',
        'f.sku                     AS sku',
        'f.cantidad                AS cantidad',
        'f.cupones_base            AS "cuponesBase"',
        'f.cupones_generados       AS "cuponesGenerados"',
        'f.foto_url                AS "fotoUrl"',
        'f.fecha_carga             AS "fechaCarga"',
      ])
      .orderBy('f.fecha_carga', 'DESC');

    if (cedula) qb.andWhere('u.cedula = :cedula', { cedula });
    if (ciudad) qb.andWhere('LOWER(u.ciudad) LIKE LOWER(:ciudad)', { ciudad: `%${ciudad}%` });
    if (fechaDesde) qb.andWhere('f.fecha_carga >= :fechaDesde', { fechaDesde });
    if (fechaHasta) qb.andWhere('f.fecha_carga <= :fechaHasta', { fechaHasta: `${fechaHasta}T23:59:59.999Z` });

    const total = await qb.getCount();
    const raw = await qb.offset((page - 1) * limit).limit(limit).getRawMany();

    const data: TicketResumen[] = raw.map((r) => ({
      id: r.id,
      cedula: r.cedula,
      nombre: r.nombre,
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
      throw new BadRequestException(`La campaña ${eventoId} no está activa`);
    }

    const estadoEvento = this.eventosService.calcularEstado(eventoEntity as any);

    if (estadoEvento === 'cerrado') {
      throw new BadRequestException(`La campaña ${eventoId} está cerrada`);
    }

    if (estadoEvento === 'no_iniciado') {
      throw new BadRequestException(
        `La campaña aún no ha iniciado. Inicio: ${eventoEntity.fechaInicio.toISOString()}`,
      );
    }

    if (estadoEvento === 'vencido') {
      throw new BadRequestException(
        `La campaña ha finalizado. Cierre: ${eventoEntity.fechaCierre.toISOString()}`,
      );
    }

    const evento = eventoEntity;

    const condiciones = (evento as any).condicionesCupones as CondicionCupon[] | null;

    if (condiciones && condiciones.length > 0) {
      const skusValidos = condiciones.map((c) => c.sku);
      const skusInvalidos = productos.map((p) => p.sku).filter((sku) => !skusValidos.includes(sku));

      if (skusInvalidos.length > 0) {
        throw new BadRequestException(
          `SKUs no válidos para esta campaña: ${skusInvalidos.join(', ')}. Válidos: ${skusValidos.join(', ')}`,
        );
      }
    }

    const { usuario, esNuevo } = await this.usuariosService.findOrCreate({
      cedula, nombre, celular, ciudad, email,
    });

    if (esNuevo && !nombre) {
      throw new BadRequestException('nombre es requerido para registrar un nuevo participante');
    }

    await this.dataSource.query('SELECT crear_participacion_evento($1, $2)', [usuario.id, eventoId]);

    const participacion = await this.participacionesRepository.findOne({
      where: { usuario_id: usuario.id, evento_id: eventoId },
    });

    if (!participacion) {
      throw new BadRequestException('No se pudo registrar la participación en la campaña');
    }

    for (const producto of productos) {
      const existente = await this.facturasRepository.findOne({
        where: {
          evento_id: eventoId,
          usuario_id: usuario.id,
          numero_factura: numeroTicket,
          sku: producto.sku,
        },
      });

      if (existente) {
        throw new ConflictException(
          `El producto ${producto.sku} del ticket ${numeroTicket} ya fue registrado para esta cédula en esta campaña`,
        );
      }
    }

    return { evento, usuario, esNuevo, participacion };
  }

  /**
   * Fase 8: ejecuta la transacción de DB y construye la respuesta final.
   * Lanza error de DB si algo falla — el caller decide si guarda pendiente.
   */
  private async ejecutarTransaccionDB(
    contexto: ContextoRegistro,
    dto: DatosFormulario,
    fotoUrl: string,
  ): Promise<IRegistroParticipacionResponse> {
    const { evento, usuario, esNuevo, participacion } = contexto;
    const { cedula, eventoId, numeroTicket, local, multiplicador, coeficienteMultiplicador, productos } = dto;
    const condiciones = (evento as any).condicionesCupones as CondicionCupon[] | null;
    const coeficiente = multiplicador ? (coeficienteMultiplicador ?? 1) : 1;

    const productosRegistrados: ProductoRegistrado[] = [];
    let totalCuponesGenerados = 0;

    await this.dataSource.transaction(async (manager) => {
      for (const producto of productos) {
        const cuponesBase = this.calcularCupones(condiciones, producto);
        const cuponesGenerados = this.aplicarMultiplicador(cuponesBase, multiplicador, coeficienteMultiplicador);

        const factura = manager.create(FacturaEntity, {
          usuario_id: usuario.id,
          evento_id: eventoId,
          participacion_id: participacion.id,
          numero_factura: numeroTicket,
          local,
          multiplicador,
          coeficienteMultiplicador: multiplicador ? coeficienteMultiplicador : null,
          sku: producto.sku,
          cantidad: producto.cantidad,
          cupones_base: cuponesBase,
          cupones_generados: cuponesGenerados,
          foto_url: fotoUrl,
          ocr_data: null,
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
    });

    const participacionActualizada = await this.participacionesRepository.findOne({
      where: { id: participacion.id },
    });

    const cuponesAcumulados = participacionActualizada?.cupones_acumulados ?? totalCuponesGenerados;

    this.logger.log(
      `[TICKETS] Completado — cédula: ${cedula}, local: "${local}", ` +
      `multiplicador: ${multiplicador}${multiplicador ? ` x${coeficiente}` : ''}, ` +
      `+${totalCuponesGenerados} cupones (total campaña: ${cuponesAcumulados})`,
    );

    return {
      mensaje: esNuevo
        ? 'Participante registrado y cupones asignados correctamente'
        : 'Cupones agregados al participante existente',
      esUsuarioNuevo: esNuevo,
      cedula,
      nombre: usuario.nombre,
      eventoId,
      numeroTicket,
      local,
      multiplicadorAplicado: multiplicador,
      coeficienteAplicado: coeficiente,
      fotoUrl,
      productos: productosRegistrados,
      cuponesGenerados: totalCuponesGenerados,
      cuponesAcumulados,
    };
  }

  /**
   * Ejecuta un reintento: re-valida las reglas, sube imagen si es necesario,
   * guarda en DB y actualiza el estado del pendiente.
   */
  private async procesarReintento(pendiente: TicketPendienteEntity): Promise<ResultadoReintento> {
    // Marcar como procesando para evitar reintento simultáneo
    pendiente.estado = 'procesando';
    pendiente.intentos += 1;
    pendiente.fechaUltimoIntento = new Date();
    await this.pendientesRepository.save(pendiente);

    const dto = pendiente.datosFormulario;
    this.logger.log(
      `[PENDIENTES] Reintentando id=${pendiente.id} — cédula: ${dto.cedula}, intento ${pendiente.intentos}`,
    );

    try {
      // Re-validar reglas de negocio (puede haber cambiado el estado del evento, etc.)
      const contexto = await this.validarYPreparar(dto);

      // Determinar URL de la foto para el reintento
      let fotoUrl = pendiente.fotoUrl;

      if (!fotoUrl) {
        // La imagen nunca llegó a Cloudinary — reintentar upload con el base64 guardado
        if (!pendiente.fotoBufferB64) {
          throw new Error('No hay imagen disponible para el reintento (ni URL ni base64)');
        }

        const dataUri = pendiente.fotoMimetype
          ? `data:${pendiente.fotoMimetype};base64,${pendiente.fotoBufferB64}`
          : pendiente.fotoBufferB64;

        const { url } = await this.cloudinaryService.uploadBase64(dataUri, dto.cedula);
        fotoUrl = url;

        // Actualizar pendiente: ya tenemos URL, limpiar el buffer
        pendiente.fotoUrl = fotoUrl;
        pendiente.fotoBufferB64 = null;
        pendiente.etapaError = 'escritura_db';
        await this.pendientesRepository.save(pendiente);
      }

      // Intentar persistir en DB
      const registro = await this.ejecutarTransaccionDB(contexto, dto, fotoUrl);

      // Éxito: marcar como completado
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
      const mensajeError = error instanceof Error ? error.message : String(error);

      // Determinar nuevo estado según cantidad de intentos
      const nuevoEstado = pendiente.intentos >= MAX_INTENTOS ? 'fallido_permanente' : 'pendiente';

      pendiente.estado = nuevoEstado;
      pendiente.mensajeError = mensajeError;
      await this.pendientesRepository.save(pendiente);

      this.logger.warn(
        `[PENDIENTES] Fallo reintento id=${pendiente.id} (intento ${pendiente.intentos}/${MAX_INTENTOS}): ${mensajeError}`,
      );

      return {
        pendienteId: pendiente.id,
        exitoso: false,
        mensaje: nuevoEstado === 'fallido_permanente'
          ? `Máximo de intentos alcanzado (${MAX_INTENTOS}). Requiere intervención manual.`
          : `Reintento fallido. Se volverá a intentar. Error: ${mensajeError}`,
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
    // El base64 completo puede tener el prefijo data:... o solo los datos crudos.
    // Guardamos solo los datos crudos en foto_buffer_b64 para ahorrar espacio.
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
      // Si ni siquiera podemos guardar el pendiente, solo logueamos
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
}
