import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiSecurity,
  ApiOperation,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ReportesService } from './reportes.service';
import { PaginationDto } from '../../common/dtos/pagination.dto';
import { FiltrarReporteDetalladoDto } from '../../common/dtos/filtrar-reporte-detallado.dto';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';

@ApiTags('reportes')
@ApiSecurity('x-api-key')
@ApiUnauthorizedResponse({ description: 'API Key inválida o ausente' })
@Controller('reportes')
@UseGuards(ApiKeyGuard)
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  // ── Resumen ───────────────────────────────────────────────────────────────

  @Get('eventos/:eventoId/resumen')
  @ApiOperation({
    summary: 'Resumen estadístico de un evento',
    description:
      'Retorna las métricas consolidadas de la campaña en un solo objeto. Incluye:\n\n' +
      '- Datos del evento (nombre, fechas, estado calculado)\n' +
      '- `totalParticipantes` — personas únicas inscritas en la campaña\n' +
      '- `totalFacturas` — tickets de compra registrados exitosamente\n' +
      '- `totalCuponesGenerados` — suma de todos los cupones acumulados\n' +
      '- `ticketsPendientes` — registros que fallaron y esperan reintento\n' +
      '- `ticketsFallidosPermanentes` — registros que superaron los 5 reintentos\n\n' +
      '**Uso típico:** dashboard principal del backoffice para monitorear el estado de la campaña en tiempo real.',
  })
  @ApiParam({ name: 'eventoId', type: Number, example: 1 })
  @ApiOkResponse({
    description: 'Resumen estadístico del evento',
    schema: {
      example: {
        eventoId: 1,
        eventoNombre: 'Molinos (test) Mundial 2026',
        fechaInicio: '2026-04-01T00:00:00.000Z',
        fechaCierre: '2026-06-01T23:59:59.000Z',
        estado: 'vigente',
        totalParticipantes: 12,
        totalFacturas: 35,
        totalCuponesGenerados: 1820,
        ticketsPendientes: 2,
        ticketsFallidosPermanentes: 0,
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Evento no encontrado' })
  async getResumenEvento(@Param('eventoId', ParseIntPipe) eventoId: number) {
    return await this.reportesService.getResumenEvento(eventoId);
  }

  // ── Detallado ─────────────────────────────────────────────────────────────

  @Get('eventos/:eventoId/detalle')
  @ApiOperation({
    summary: 'Reporte detallado de facturas de un evento',
    description:
      'Combina el resumen estadístico con el listado paginado de tickets registrados en la campaña. ' +
      'Cada entrada del listado representa **un ticket único** con sus N productos agrupados internamente. ' +
      'Pensado para exportación y análisis en el backoffice.\n\n' +
      '**Cada ticket incluye:** ciudad, local, nombre del participante, URL de imagen, fecha de carga, ' +
      'si se aplicó multiplicador, lista de productos (`[{sku, cantidad, cuponesBase, cuponesGenerados}]`), ' +
      'bonus y el total de cupones de ese ticket ya sumados.\n\n' +
      '**Filtros disponibles:**\n' +
      '- `fechaDesde` / `fechaHasta` — rango de fechas de carga\n' +
      '- `ciudad` — búsqueda parcial por ciudad\n' +
      '- `local` — búsqueda parcial por nombre del local\n\n' +
      '**Ordenamiento:** por `local`, `ciudad`, `cuponesGenerados` o `fechaCarga` en dirección `ASC`/`DESC`.\n\n' +
      '`total` indica cuántos tickets únicos hay en total (no filas en DB), usado para paginar.',
  })
  @ApiParam({ name: 'eventoId', type: Number, example: 1 })
  @ApiQuery({ name: 'fechaDesde',  required: false, type: String,  example: '2026-04-01' })
  @ApiQuery({ name: 'fechaHasta',  required: false, type: String,  example: '2026-06-01' })
  @ApiQuery({ name: 'ciudad',      required: false, type: String,  example: 'Asuncion' })
  @ApiQuery({ name: 'local',       required: false, type: String,  example: 'Super 6' })
  @ApiQuery({ name: 'ordenarPor',  required: false, enum: ['local', 'ciudad', 'cuponesGenerados', 'fechaCarga'], example: 'ciudad' })
  @ApiQuery({ name: 'orden',       required: false, enum: ['ASC', 'DESC'], example: 'ASC' })
  @ApiQuery({ name: 'page',        required: false, type: Number,  example: 1 })
  @ApiQuery({ name: 'limit',       required: false, type: Number,  example: 20 })
  @ApiOkResponse({
    description: 'Reporte detallado con resumen del evento y listado paginado de tickets agrupados por número de ticket',
    schema: {
      example: {
        eventoId: 1,
        eventoNombre: 'Molinos (test) Mundial 2026',
        fechaInicio: '2026-04-01T00:00:00.000Z',
        fechaCierre: '2026-06-01T23:59:59.000Z',
        estado: 'vigente',
        resumen: {
          totalParticipantes: 12,
          totalFacturas: 35,
          totalCuponesGenerados: 1820,
          ticketsPendientes: 2,
          ticketsFallidosPermanentes: 0,
        },
        tickets: [
          {
            numeroTicket: '001-2023-019000001',
            local: 'Super 6 La Negrita',
            ciudad: 'Asuncion',
            nombreParticipante: 'Carencio Mantecado',
            fotoUrl: 'https://res.cloudinary.com/demo/image/upload/v1/tickets/foto.jpg',
            fechaCarga: '2026-04-15T10:00:00.000Z',
            multiplicadorAplicado: false,
            coeficienteAplicado: null,
            productos: [
              { sku: '1kg',  cantidad: 2,  cuponesBase: 10, cuponesGenerados: 10 },
              { sku: '5kg',  cantidad: 1,  cuponesBase: 15, cuponesGenerados: 15 },
              { sku: '500g', cantidad: 20, cuponesBase: 40, cuponesGenerados: 40 },
            ],
            bonus: 5,
            totalCuponesEstaFactura: 70,
          },
        ],
        total: 35,
        page: 1,
        limit: 20,
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Evento no encontrado' })
  async getReporteDetallado(
    @Param('eventoId', ParseIntPipe) eventoId: number,
    @Query() filtros: FiltrarReporteDetalladoDto,
  ) {
    return await this.reportesService.getReporteDetallado(eventoId, filtros);
  }

  // ── Participantes (uso interno) ───────────────────────────────────────────

  @Get('eventos/:eventoId/participantes')
  @ApiOperation({
    summary: 'Listar participantes de un evento con sus cupones acumulados',
    description:
      'Retorna la lista paginada de participantes inscritos en la campaña, ' +
      'ordenados por `cuponesAcumulados` de mayor a menor. Útil para:\n\n' +
      '- Ver quiénes llevan más cupones (posibles ganadores del sorteo)\n' +
      '- Auditar la distribución geográfica de participantes por `ciudad`\n' +
      '- Conocer `totalFacturas` por participante para detectar actividad inusual\n\n' +
      '**Política de privacidad:** solo expone `ciudad` (dato no sensible). ' +
      'No incluye nombre, cédula, celular ni email. ' +
      'Para ver el detalle de cupones de un participante específico, ' +
      'usa `GET /api/tickets/:cedula/cupones`.',
  })
  @ApiParam({ name: 'eventoId', type: Number, example: 1 })
  @ApiQuery({ name: 'page',  required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiOkResponse({
    description: 'Lista paginada de participantes con cupones y detalle de facturas del evento',
    schema: {
      example: {
        eventoId: 1,
        eventoNombre: 'Molinos (test) Mundial 2026',
        data: [
          {
            nombre: 'Carencio Mantecado',
            ciudad: 'Asuncion',
            cuponesAcumulados: 70,
            totalFacturas: 1,
            facturas: [
              {
                numeroTicket: '001-2023-019000001',
                fotoUrl: 'https://res.cloudinary.com/demo/image/upload/v1/tickets/foto.jpg',
                skus: [
                  { sku: '1kg',  vecesRegistrado: 1, totalUnidades: 2  },
                  { sku: '5kg',  vecesRegistrado: 1, totalUnidades: 1  },
                  { sku: '500g', vecesRegistrado: 1, totalUnidades: 20 },
                ],
              },
            ],
            fechaRegistro: '2026-04-15T09:00:00.000Z',
            fechaActualizacion: '2026-04-15T10:00:00.000Z',
          },
        ],
        total: 12,
        page: 1,
        limit: 20,
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Evento no encontrado' })
  async getParticipantesPorEvento(
    @Param('eventoId', ParseIntPipe) eventoId: number,
    @Query() paginacion: PaginationDto,
  ) {
    return await this.reportesService.getParticipantesPorEvento(eventoId, paginacion);
  }
}
