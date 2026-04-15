import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ParticipacionEventoEntity } from '../participaciones/entities/participacion-evento.entity';
import { FacturaEntity } from '../facturas/entities/factura.entity';
import { TicketPendienteEntity } from '../facturas/entities/ticket-pendiente.entity';
import { EventoEntity } from '../eventos/entities/evento.entity';
import { ParticipanteEntity } from '../participantes/entities/participante.entity';
import { EventosService } from '../eventos/eventos.service';
import { PaginationDto } from '../../common/dtos/pagination.dto';
import { FiltrarReporteDetalladoDto } from '../../common/dtos/filtrar-reporte-detallado.dto';

// ── Interfaces de respuesta ──────────────────────────────────────────────────

export interface SkuParticipante {
  sku: string;
  vecesRegistrado: number;
  totalUnidades: number;
}

export interface FacturaParticipante {
  numeroTicket: string;
  fotoUrl: string;
  skus: SkuParticipante[];
}

export interface ParticipanteReporte {
  nombre: string;
  ciudad: string | null;
  cuponesAcumulados: number;
  totalFacturas: number;
  facturas: FacturaParticipante[];
  fechaRegistro: Date;
  fechaActualizacion: Date;
}

export interface ParticipantesReportePaginado {
  eventoId: number;
  eventoNombre: string;
  data: ParticipanteReporte[];
  total: number;
  page: number;
  limit: number;
}

export interface ResumenEvento {
  eventoId: number;
  eventoNombre: string;
  fechaInicio: Date;
  fechaCierre: Date;
  estado: string;
  totalParticipantes: number;
  totalFacturas: number;
  totalCuponesGenerados: number;
  ticketsPendientes: number;
  ticketsFallidosPermanentes: number;
}

export interface ProductoTicketDetalle {
  sku: string;
  cantidad: number;
  cuponesBase: number;
  cuponesGenerados: number;
}

export interface TicketDetalle {
  numeroTicket: string;
  local: string;
  ciudad: string | null;
  nombreParticipante: string;
  fotoUrl: string;
  fechaCarga: Date;
  multiplicadorAplicado: boolean;
  coeficienteAplicado: number | null;
  productos: ProductoTicketDetalle[];
  bonus: number | null;
  totalCuponesEstaFactura: number;
}

export interface ReporteDetalladoResponse {
  eventoId: number;
  eventoNombre: string;
  fechaInicio: Date;
  fechaCierre: Date;
  estado: string;
  resumen: {
    totalParticipantes: number;
    totalFacturas: number;
    totalCuponesGenerados: number;
    ticketsPendientes: number;
    ticketsFallidosPermanentes: number;
  };
  tickets: TicketDetalle[];
  total: number;
  page: number;
  limit: number;
}

// ── Servicio ──────────────────────────────────────────────────────────────────

@Injectable()
export class ReportesService {
  constructor(
    @InjectRepository(ParticipacionEventoEntity)
    private readonly participacionesRepository: Repository<ParticipacionEventoEntity>,
    @InjectRepository(FacturaEntity)
    private readonly facturasRepository: Repository<FacturaEntity>,
    @InjectRepository(TicketPendienteEntity)
    private readonly pendientesRepository: Repository<TicketPendienteEntity>,
    @InjectRepository(EventoEntity)
    private readonly eventosRepository: Repository<EventoEntity>,
    @InjectRepository(ParticipanteEntity)
    private readonly participantesRepository: Repository<ParticipanteEntity>,
    private readonly eventosService: EventosService,
  ) {}

  // ── Participantes por evento ──────────────────────────────────────────────

  async getParticipantesPorEvento(
    eventoId: number,
    paginacion: PaginationDto,
  ): Promise<ParticipantesReportePaginado> {
    const evento = await this.eventosRepository.findOne({ where: { id: eventoId } });
    if (!evento) throw new NotFoundException(`Evento ${eventoId} no encontrado`);

    const page  = paginacion.page  ?? 1;
    const limit = paginacion.limit ?? 20;

    const qb = this.participacionesRepository
      .createQueryBuilder('pe')
      .innerJoin('pe.participante', 'u')
      .select([
        'pe.id                   AS id',
        'pe.participante_id      AS "participanteId"',
        'u.ciudad                AS ciudad',
        'pe.cupones_acumulados   AS "cuponesAcumulados"',
        'pe.fecha_registro       AS "fechaRegistro"',
        'pe.fecha_actualizacion  AS "fechaActualizacion"',
      ])
      .addSelect(
        (sub) =>
          sub
            .select('COUNT(f.id)', 'cnt')
            .from(FacturaEntity, 'f')
            .where('f.participacion_id = pe.id'),
        'totalFacturas',
      )
      .where('pe.evento_id = :eventoId', { eventoId })
      .orderBy('pe.cupones_acumulados', 'DESC');

    const [participaciones, total] = await Promise.all([
      qb.offset((page - 1) * limit).limit(limit).getRawMany(),
      this.participacionesRepository.count({ where: { eventoId } }),
    ]);

    // Cargar entidades de participante para obtener el nombre descifrado (encryptionTransformer)
    const participanteIds: number[] = participaciones.map((r) => Number(r.participanteId));
    const participanteEntities =
      participanteIds.length > 0
        ? await this.participantesRepository.findByIds(participanteIds)
        : [];
    const nombreMap = new Map<number, string>(
      participanteEntities.map((p) => [p.id, p.nombre]),
    );

    // Enriquecer cada participante con el detalle de sus facturas
    const participacionIds: number[] = participaciones.map((r) => Number(r.id));

    const facturasRaw =
      participacionIds.length > 0
        ? await this.facturasRepository
            .createQueryBuilder('f')
            .select([
              'f.participacion_id  AS "participacionId"',
              'f.numero_ticket     AS "numeroTicket"',
              'f.foto_url          AS "fotoUrl"',
              'f.sku               AS sku',
              'f.cantidad          AS cantidad',
            ])
            .where('f.participacion_id IN (:...ids)', { ids: participacionIds })
            .getRawMany()
        : [];

    // Agrupar facturas: participacionId → numeroTicket → skus
    const facturasMap = new Map<
      number,
      Map<string, { numeroTicket: string; fotoUrl: string; skus: Map<string, { vecesRegistrado: number; totalUnidades: number }> }>
    >();

    for (const f of facturasRaw) {
      const pid = Number(f.participacionId);
      if (!facturasMap.has(pid)) facturasMap.set(pid, new Map());
      const ticketMap = facturasMap.get(pid)!;

      if (!ticketMap.has(f.numeroTicket)) {
        ticketMap.set(f.numeroTicket, { numeroTicket: f.numeroTicket, fotoUrl: f.fotoUrl, skus: new Map() });
      }
      const ticket = ticketMap.get(f.numeroTicket)!;

      const skuKey = f.sku as string;
      if (!ticket.skus.has(skuKey)) {
        ticket.skus.set(skuKey, { vecesRegistrado: 0, totalUnidades: 0 });
      }
      const skuData = ticket.skus.get(skuKey)!;
      skuData.vecesRegistrado += 1;
      skuData.totalUnidades   += Number(f.cantidad);
    }

    const data: ParticipanteReporte[] = participaciones.map((r) => {
      const pid      = Number(r.id);
      const ticketMap = facturasMap.get(pid) ?? new Map();

      const facturas: FacturaParticipante[] = Array.from(ticketMap.values()).map((t) => ({
        numeroTicket: t.numeroTicket,
        fotoUrl:      t.fotoUrl,
        skus: Array.from(t.skus.entries()).map(([sku, d]) => ({
          sku,
          vecesRegistrado: d.vecesRegistrado,
          totalUnidades:   d.totalUnidades,
        })),
      }));

      return {
        nombre:             nombreMap.get(Number(r.participanteId)) ?? '',
        ciudad:             r.ciudad ?? null,
        cuponesAcumulados:  Number(r.cuponesAcumulados),
        totalFacturas:      Number(r.totalFacturas ?? 0),
        facturas,
        fechaRegistro:      r.fechaRegistro,
        fechaActualizacion: r.fechaActualizacion,
      };
    });

    return { eventoId, eventoNombre: evento.nombre, data, total, page, limit };
  }

  // ── Resumen del evento ────────────────────────────────────────────────────

  async getResumenEvento(eventoId: number): Promise<ResumenEvento> {
    const evento = await this.eventosRepository.findOne({ where: { id: eventoId } });
    if (!evento) throw new NotFoundException(`Evento ${eventoId} no encontrado`);

    const estado = this.eventosService.calcularEstado(evento as any);

    const [totalParticipantes, cuponesRaw, pendientesRaw, fallidosRaw] = await Promise.all([
      this.participacionesRepository.count({ where: { eventoId } }),

      this.facturasRepository
        .createQueryBuilder('f')
        .select([
          'COUNT(f.id) AS "totalFacturas"',
          'COALESCE(SUM(f.cupones_generados), 0) AS "totalCupones"',
        ])
        .where('f.evento_id = :eventoId', { eventoId })
        .getRawOne(),

      this.pendientesRepository
        .createQueryBuilder('p')
        .where("(p.datos_formulario->>'eventoId')::int = :eventoId", { eventoId })
        .andWhere("p.estado = 'pendiente'")
        .getCount(),

      this.pendientesRepository
        .createQueryBuilder('p')
        .where("(p.datos_formulario->>'eventoId')::int = :eventoId", { eventoId })
        .andWhere("p.estado = 'fallido_permanente'")
        .getCount(),
    ]);

    return {
      eventoId,
      eventoNombre:               evento.nombre,
      fechaInicio:                evento.fechaInicio,
      fechaCierre:                evento.fechaCierre,
      estado,
      totalParticipantes,
      totalFacturas:              Number(cuponesRaw?.totalFacturas ?? 0),
      totalCuponesGenerados:      Number(cuponesRaw?.totalCupones  ?? 0),
      ticketsPendientes:          pendientesRaw,
      ticketsFallidosPermanentes: fallidosRaw,
    };
  }

  // ── Reporte detallado ─────────────────────────────────────────────────────

  async getReporteDetallado(
    eventoId: number,
    filtros: FiltrarReporteDetalladoDto,
  ): Promise<ReporteDetalladoResponse> {
    const evento = await this.eventosRepository.findOne({ where: { id: eventoId } });
    if (!evento) throw new NotFoundException(`Evento ${eventoId} no encontrado`);

    const estado = this.eventosService.calcularEstado(evento as any);

    const {
      fechaDesde,
      fechaHasta,
      ciudad,
      local,
      ordenarPor,
      orden = 'ASC',
      page  = 1,
      limit = 20,
    } = filtros;

    // Helper para aplicar los filtros comunes en cualquier QB
    const applyFilters = (qb: ReturnType<typeof this.facturasRepository.createQueryBuilder>) => {
      if (fechaDesde) qb.andWhere('f.fechaCarga >= :fechaDesde', { fechaDesde });
      if (fechaHasta) qb.andWhere('f.fechaCarga <= :fechaHasta', { fechaHasta: `${fechaHasta}T23:59:59.999Z` });
      if (ciudad)     qb.andWhere('LOWER(u.ciudad) LIKE LOWER(:ciudad)', { ciudad: `%${ciudad}%` });
      if (local)      qb.andWhere('LOWER(f.local) LIKE LOWER(:local)',   { local:  `%${local}%`  });
    };

    // ── Paso 1: contar tickets únicos ─────────────────────────────────────
    const countQb = this.facturasRepository
      .createQueryBuilder('f')
      .innerJoin('f.participante', 'u')
      .select('COUNT(DISTINCT f.numero_ticket)', 'total')
      .where('f.eventoId = :eventoId', { eventoId });
    applyFilters(countQb);
    const countResult = await countQb.getRawOne<{ total: string }>();
    const total = Number(countResult?.total ?? 0);

    // ── Paso 2: página de tickets agrupados (raw, sin decifrar nombre) ────
    const ticketsQb = this.facturasRepository
      .createQueryBuilder('f')
      .innerJoin('f.participante', 'u')
      .select([
        'f.numero_ticket                AS "numeroTicket"',
        'f.local                        AS local',
        'f.foto_url                     AS "fotoUrl"',
        'f.multiplicador                AS multiplicador',
        'f.coeficiente_multiplicador    AS "coeficienteMultiplicador"',
        'u.ciudad                       AS ciudad',
        'MIN(f.fecha_carga)             AS "fechaCarga"',
        'SUM(f.cupones_generados)       AS "totalCupones"',
      ])
      .where('f.eventoId = :eventoId', { eventoId })
      .groupBy('f.numero_ticket, f.local, f.foto_url, f.multiplicador, f.coeficiente_multiplicador, u.ciudad');
    applyFilters(ticketsQb);

    switch (ordenarPor) {
      case 'ciudad':
        ticketsQb.orderBy('u.ciudad', orden).addOrderBy('MIN(f.fecha_carga)', 'DESC');
        break;
      case 'local':
        ticketsQb.orderBy('f.local', orden).addOrderBy('MIN(f.fecha_carga)', 'DESC');
        break;
      case 'cuponesGenerados':
        ticketsQb.orderBy('SUM(f.cupones_generados)', orden);
        break;
      case 'fechaCarga':
        ticketsQb.orderBy('MIN(f.fecha_carga)', orden);
        break;
      default:
        ticketsQb
          .orderBy('u.ciudad', 'ASC')
          .addOrderBy('f.local', 'ASC')
          .addOrderBy('MIN(f.fecha_carga)', 'DESC');
    }

    const ticketPage = await ticketsQb
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany<{
        numeroTicket: string;
        local: string;
        fotoUrl: string;
        multiplicador: boolean;
        coeficienteMultiplicador: string | null;
        ciudad: string | null;
        fechaCarga: Date;
      }>();

    // ── Paso 3: cargar filas completas con entidad (activa el transformer de nombre cifrado)
    const ticketNumbers = ticketPage.map((t) => t.numeroTicket);
    const facturas =
      ticketNumbers.length > 0
        ? await this.facturasRepository
            .createQueryBuilder('f')
            .innerJoinAndSelect('f.participante', 'u')
            .where('f.eventoId = :eventoId', { eventoId })
            .andWhere('f.numero_ticket IN (:...nums)', { nums: ticketNumbers })
            .getMany()
        : [];

    // ── Paso 4: agrupar por numero_ticket preservando el orden de la página ─
    const ticketMap = new Map<string, TicketDetalle>();

    for (const tk of ticketPage) {
      ticketMap.set(tk.numeroTicket, {
        numeroTicket:        tk.numeroTicket,
        local:               tk.local,
        ciudad:              tk.ciudad ?? null,
        nombreParticipante:  '',   // se completa en el loop siguiente
        fotoUrl:             tk.fotoUrl,
        fechaCarga:          tk.fechaCarga,
        multiplicadorAplicado:  tk.multiplicador,
        coeficienteAplicado: tk.coeficienteMultiplicador ? Number(tk.coeficienteMultiplicador) : null,
        productos:           [],
        bonus:               null,
        totalCuponesEstaFactura: 0,
      });
    }

    for (const f of facturas) {
      const ticket = ticketMap.get(f.numeroTicket);
      if (!ticket) continue;

      // El transformer de TypeORM descifra `nombre` al cargar la entidad
      if (!ticket.nombreParticipante) {
        ticket.nombreParticipante = f.participante.nombre;
      }

      ticket.productos.push({
        sku:             f.sku,
        cantidad:        f.cantidad,
        cuponesBase:     f.cuponesBase,
        cuponesGenerados: f.cuponesGenerados,
      });

      ticket.totalCuponesEstaFactura += f.cuponesGenerados;

      // bonus solo está en la primera fila del registro
      if (f.bonus !== null) ticket.bonus = f.bonus;
    }

    // Sumar bonus al total de cada ticket
    for (const ticket of ticketMap.values()) {
      ticket.totalCuponesEstaFactura += ticket.bonus ?? 0;
    }

    // ── Resumen paralelo ──────────────────────────────────────────────────
    const [totalParticipantes, cuponesRaw, pendientesRaw, fallidosRaw] = await Promise.all([
      this.participacionesRepository.count({ where: { eventoId } }),

      this.facturasRepository
        .createQueryBuilder('f')
        .select([
          'COUNT(f.id) AS "totalFacturas"',
          'COALESCE(SUM(f.cupones_generados), 0) AS "totalCupones"',
        ])
        .where('f.evento_id = :eventoId', { eventoId })
        .getRawOne(),

      this.pendientesRepository
        .createQueryBuilder('p')
        .where("(p.datos_formulario->>'eventoId')::int = :eventoId", { eventoId })
        .andWhere("p.estado = 'pendiente'")
        .getCount(),

      this.pendientesRepository
        .createQueryBuilder('p')
        .where("(p.datos_formulario->>'eventoId')::int = :eventoId", { eventoId })
        .andWhere("p.estado = 'fallido_permanente'")
        .getCount(),
    ]);

    return {
      eventoId,
      eventoNombre: evento.nombre,
      fechaInicio:  evento.fechaInicio,
      fechaCierre:  evento.fechaCierre,
      estado,
      resumen: {
        totalParticipantes,
        totalFacturas:              Number(cuponesRaw?.totalFacturas ?? 0),
        totalCuponesGenerados:      Number(cuponesRaw?.totalCupones  ?? 0),
        ticketsPendientes:          pendientesRaw,
        ticketsFallidosPermanentes: fallidosRaw,
      },
      tickets: Array.from(ticketMap.values()),
      total,
      page,
      limit,
    };
  }
}
