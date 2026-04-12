import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiSecurity,
  ApiOperation,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { FacturasService } from './facturas.service';
import { RegistrarParticipacionDto } from '../../common/dtos/registrar-participacion.dto';
import { FiltrarTicketsDto } from '../../common/dtos/filtrar-tickets.dto';
import { FiltrarPendientesDto } from '../../common/dtos/filtrar-pendientes.dto';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';

@ApiTags('tickets')
@ApiSecurity('x-api-key')
@ApiUnauthorizedResponse({ description: 'API Key inválida o ausente' })
@Controller('tickets')
@UseGuards(ApiKeyGuard)
export class FacturasController {
  constructor(private readonly facturasService: FacturasService) {}

  // ── Listado general ───────────────────────────────────────────────────────

  @Get()
  @ApiOperation({
    summary: 'Listar todos los tickets registrados',
    description:
      'Retorna un listado paginado de todos los tickets con los datos del participante, ' +
      'la campaña y los cupones generados. Filtros opcionales: cédula, ciudad, rango de fechas.',
  })
  @ApiOkResponse({ description: 'Listado paginado de tickets' })
  async findAllTickets(@Query() filtros: FiltrarTicketsDto) {
    return await this.facturasService.findAllTickets(filtros);
  }

  // ── Registro ──────────────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar participación en una campaña',
    description:
      'Recibe en JSON los datos del participante, el ticket, los productos y la URL de la imagen del comprobante. ' +
      'La imagen debe subirse previamente a `POST /api/imagenes/upload` para obtener la URL. ' +
      'Primero valida todas las reglas de negocio. Si la escritura en DB falla, ' +
      'guarda los datos en la tabla de pendientes y retorna 503 con el `pendienteId`.',
  })
  @ApiBody({
    description:
      'Todos los datos del participante, ticket e imagen en una sola request JSON. ' +
      'La imagen debe enviarse como Data URI base64, generado en el frontend con FileReader.readAsDataURL(file).',
    schema: {
      type: 'object',
      required: ['cedula', 'eventoId', 'numeroTicket', 'fotoBase64', 'productos'],
      properties: {
        cedula:       { type: 'string', example: '12345678' },
        nombre:       { type: 'string', example: 'Juan Pérez', description: 'Requerido solo en el primer registro' },
        celular:      { type: 'string', example: '04141234567' },
        ciudad:       { type: 'string', example: 'Caracas' },
        email:        { type: 'string', example: 'juan@email.com' },
        eventoId:     { type: 'integer', example: 1 },
        numeroTicket: { type: 'string', example: 'TKT-2024-001' },
        local:        { type: 'string', example: 'Super 6 La Negrita', description: 'Nombre del local o establecimiento' },
        multiplicador: { type: 'boolean', example: false, description: 'true si el local tiene multiplicador de cupones' },
        coeficienteMultiplicador: {
          type: 'integer',
          example: 2,
          description: 'Requerido cuando multiplicador=true. Mínimo 2. Los cupones se multiplican por este valor (x2, x3, x4...).',
        },
        fotoBase64: {
          type: 'string',
          example: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAA...',
          description: 'Data URI de la imagen. Formato: data:image/(jpeg|jpg|png);base64,<datos>. Máx 5 MB.',
        },
        productos: {
          type: 'array',
          items: {
            type: 'object',
            required: ['sku', 'cantidad'],
            properties: {
              sku:      { type: 'string', enum: ['250g', '500g', '1kg', '5kg'], example: '1kg' },
              cantidad: { type: 'integer', minimum: 1, maximum: 1000, example: 2 },
            },
          },
          example: [{ sku: '1kg', cantidad: 2 }, { sku: '5kg', cantidad: 1 }],
        },
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Participación registrada y cupones asignados',
    schema: {
      example: {
        mensaje: 'Participante registrado y cupones asignados correctamente',
        esUsuarioNuevo: true,
        cedula: '12345678',
        nombre: 'Juan Pérez',
        eventoId: 1,
        numeroTicket: 'TKT-2024-001',
        local: 'Super 6 La Negrita',
        multiplicadorAplicado: true,
        coeficienteAplicado: 2,
        fotoUrl: 'https://res.cloudinary.com/demo/image/upload/v1/tickets/foto.jpg',
        productos: [
          { sku: '1kg', cantidad: 2, cuponesBase: 10, coeficienteAplicado: 2, cuponesGenerados: 20 },
          { sku: '5kg', cantidad: 1, cuponesBase: 15, coeficienteAplicado: 2, cuponesGenerados: 30 },
        ],
        cuponesGenerados: 50,
        cuponesAcumulados: 50,
      },
    },
  })
  @ApiConflictResponse({ description: 'Ticket duplicado para este participante en la campaña' })
  @ApiBadRequestResponse({ description: 'Datos inválidos, campaña no activa o SKU no válido para la campaña' })
  async registrarParticipacion(@Body() dto: RegistrarParticipacionDto) {
    return await this.facturasService.registrarParticipacion(dto);
  }

  // ── Pendientes ────────────────────────────────────────────────────────────

  @Get('pendientes')
  @ApiOperation({
    summary: 'Listar tickets pendientes de reintento',
    description:
      'Retorna todos los tickets que fallaron (upload o escritura DB) y fueron guardados para reintento. ' +
      'Filtros opcionales: estado, cédula, eventoId.',
  })
  @ApiOkResponse({ description: 'Listado paginado de tickets pendientes' })
  async getPendientes(@Query() filtros: FiltrarPendientesDto) {
    return await this.facturasService.getPendientes(filtros);
  }

  @Post('pendientes/reintentar-todos')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reintentar automáticamente todos los tickets pendientes',
    description:
      'Procesa en lote todos los tickets en estado "pendiente". ' +
      'Para cada uno: re-valida las reglas de negocio, sube la imagen si aplica, y persiste en DB. ' +
      'Retorna un resumen con el resultado de cada reintento.',
  })
  @ApiOkResponse({ description: 'Resumen del lote: procesados, exitosos, fallidos y detalle por ticket' })
  async reintentarTodosPendientes() {
    return await this.facturasService.reintentarTodosPendientes();
  }

  @Post('pendientes/:id/reintentar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reintentar manualmente un ticket pendiente específico',
    description:
      'Re-valida las reglas de negocio, sube la imagen si aplica, y persiste en DB. ' +
      'Si el ticket ya está "completado" o "procesando" retorna 400. ' +
      'Después de 5 intentos fallidos el estado pasa a "fallido_permanente".',
  })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiOkResponse({ description: 'Resultado del reintento' })
  @ApiNotFoundResponse({ description: 'Ticket pendiente no encontrado' })
  @ApiBadRequestResponse({ description: 'El ticket ya fue procesado o está siendo procesado' })
  async reintentarTicketPendiente(@Param('id', ParseIntPipe) id: number) {
    return await this.facturasService.reintentarTicketPendiente(id);
  }

  // ── Consultas ─────────────────────────────────────────────────────────────

  @Get(':cedula/cupones')
  @ApiOperation({
    summary: 'Consultar cupones de un participante',
    description: 'Retorna todas las campañas en las que participó el usuario, con sus facturas y los cupones que generó cada una.',
  })
  @ApiParam({ name: 'cedula', type: String, example: '12345678' })
  @ApiOkResponse({ description: 'Campañas, facturas y cupones del participante' })
  @ApiNotFoundResponse({ description: 'Participante no encontrado' })
  async getCuponesByCedula(@Param('cedula') cedula: string) {
    return await this.facturasService.getCuponesByCedula(cedula);
  }

  @Get(':cedula/evento/:eventoId')
  @ApiOperation({ summary: 'Consultar cupones de un participante en una campaña' })
  @ApiParam({ name: 'cedula', type: String, example: '12345678' })
  @ApiParam({ name: 'eventoId', type: Number, example: 1 })
  @ApiOkResponse({ description: 'Cupones acumulados y facturas del participante en la campaña' })
  @ApiNotFoundResponse({ description: 'Participante no encontrado' })
  async getCupones(
    @Param('cedula') cedula: string,
    @Param('eventoId', ParseIntPipe) eventoId: number,
  ) {
    return await this.facturasService.getCuponesByCedulaEvento(cedula, eventoId);
  }

  @Get('id/:id')
  @ApiOperation({ summary: 'Obtener factura por ID' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiOkResponse({ description: 'Datos de la factura' })
  @ApiNotFoundResponse({ description: 'Factura no encontrada' })
  async getFacturaById(@Param('id', ParseIntPipe) id: number) {
    return await this.facturasService.getFacturaById(id);
  }
}
