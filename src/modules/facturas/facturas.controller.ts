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
  Ip,
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
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { FacturasService } from './facturas.service';
import { RegistrarParticipacionDto } from '../../common/dtos/registrar-participacion.dto';
import { FiltrarPendientesDto } from '../../common/dtos/filtrar-pendientes.dto';
import { ConsultarCuponesDto } from '../../common/dtos/consultar-cupones.dto';
import { EventoIdQueryDto } from '../../common/dtos/evento-id-query.dto';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';
import { HmacGuard } from '../../common/guards/hmac.guard';

@ApiTags('tickets')
@ApiSecurity('x-api-key')
@ApiUnauthorizedResponse({ description: 'API Key inválida o ausente' })
@Controller('tickets')
@UseGuards(ApiKeyGuard)
export class FacturasController {
  constructor(private readonly facturasService: FacturasService) {}

  // ── Registro ──────────────────────────────────────────────────────────────

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(HmacGuard)
  @ApiOperation({
    summary: 'Registrar participación en una campaña (flujo principal)',
    description:
      '**Endpoint central del sistema.** Ejecuta en una sola llamada todo el flujo de inscripción:\n\n' +
      '1. Valida el DTO y las reglas de negocio (evento vigente, fechas, SKUs permitidos por la campaña).\n' +
      '2. Busca al participante por cédula o lo crea si es la primera vez (`esUsuarioNuevo: true`).\n' +
      '3. Crea o recupera la participación del participante en el evento.\n' +
      '4. Verifica que el `numeroTicket` no esté duplicado en la campaña.\n' +
      '5. Sube la imagen a Cloudinary (si `fotoBase64` se envía como Data URI) o usa la URL ya subida.\n' +
      '6. Guarda la factura en DB y acumula los cupones vía trigger de base de datos.\n\n' +
      '**Multiplicador de cupones:** si `multiplicador: true` y `coeficienteMultiplicador >= 2`, ' +
      'los cupones de cada producto se multiplican por ese coeficiente.\n\n' +
      '**Bonus:** campo opcional para sumar cupones adicionales al total del ticket ' +
      '(ej. cupones de bienvenida o promociones especiales).\n\n' +
      '**Tolerancia a fallos:** si Cloudinary o la escritura en DB fallan, los datos se guardan en ' +
      '`tickets_pendientes` y se retorna `503` con el `pendienteId`. ' +
      'El ticket puede reprocesarse con `POST /api/tickets/pendientes/:id/reintentar`.\n\n' +
      '**Autenticación adicional:** además del `x-api-key`, este endpoint valida la firma HMAC del body ' +
      '(`x-hmac-signature`) para prevenir manipulación de datos en tránsito.',
  })
  @ApiBody({
    description:
      'Todos los datos del participante, ticket e imagen en una sola request JSON. ' +
      'La imagen debe enviarse como Data URI base64, generado en el frontend con FileReader.readAsDataURL(file).',
    schema: {
      type: 'object',
      required: ['cedula', 'nombre', 'celular', 'ciudad', 'eventoId', 'numeroTicket', 'local', 'fotoBase64', 'productos'],
      properties: {
        cedula:       { type: 'string', example: '5782341' },
        nombre:       { type: 'string', example: 'Carencio Mantecado' },
        celular:      { type: 'string', example: '0971234567' },
        ciudad:       { type: 'string', example: 'Asuncion' },
        email:        { type: 'string', example: 'juan@email.com', description: 'Opcional' },
        eventoId:     { type: 'integer', example: 1 },
        numeroTicket: {
          type: 'string',
          example: '001-2023-019000001',
          description: 'Grupos de mínimo 3 dígitos separados por guión',
        },
        local:        { type: 'string', example: 'Super 6 La Negrita' },
        multiplicador: { type: 'boolean', example: false, description: 'true si el local aplica multiplicador de cupones' },
        coeficienteMultiplicador: {
          type: 'integer',
          example: 2,
          description: 'Solo aplica cuando multiplicador=true. Mínimo 2.',
        },
        fotoBase64: {
          type: 'string',
          example: 'data:image/jpg;base64,/9j/4AAQSkZJRgABAQAA...',
          description: 'Data URI completo. Formato: data:image/(jpeg|jpg|png);base64,<datos>. Máx 5 MB.',
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
          example: [
            { sku: '1kg',  cantidad: 2  },
            { sku: '5kg',  cantidad: 1  },
            { sku: '500g', cantidad: 20 },
          ],
        },
        bonus: {
          type: 'integer',
          example: 5,
          nullable: true,
          description: 'Cupones adicionales sumados al total generado por productos. Mínimo 0. Omitir si no aplica.',
          minimum: 0,
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
        eventoId: 1,
        numeroTicket: '001-2023-019000001',
        local: 'Super 6 La Negrita',
        multiplicadorAplicado: false,
        coeficienteAplicado: 1,
        fotoUrl: 'https://res.cloudinary.com/demo/image/upload/v1/tickets/foto.jpg',
        productos: [
          { sku: '1kg',  cantidad: 2,  cuponesBase: 10, coeficienteAplicado: 1, cuponesGenerados: 10 },
          { sku: '5kg',  cantidad: 1,  cuponesBase: 15, coeficienteAplicado: 1, cuponesGenerados: 15 },
          { sku: '500g', cantidad: 20, cuponesBase: 40, coeficienteAplicado: 1, cuponesGenerados: 40 },
        ],
        cuponesGenerados: 65,
        bonus: 5,
        cuponesEsteRegistro: 70,
        cuponesAcumulados: 70,
      },
    },
  })
  @ApiConflictResponse({ description: 'Ticket duplicado para este participante en la campaña' })
  @ApiBadRequestResponse({ description: 'Datos inválidos, campaña no activa o SKU no válido para la campaña' })
  async registrarParticipacion(@Body() dto: RegistrarParticipacionDto, @Ip() ip: string) {
    return await this.facturasService.registrarParticipacion(dto, ip);
  }

  // ── Pendientes ────────────────────────────────────────────────────────────

  @Get('pendientes')
  @ApiOperation({
    summary: 'Listar tickets pendientes de reintento por evento',
    description:
      'Retorna los tickets que fallaron durante el registro (fallo de Cloudinary o de escritura en DB) ' +
      'y quedaron en la tabla `tickets_pendientes` con estado `pendiente`.\n\n' +
      '**Cuándo usarlo:** para monitorear cuántos tickets están en cola de reintento ' +
      'antes de llamar a los endpoints de reintento masivo o individual.\n\n' +
      '**`eventoId` es obligatorio** — los pendientes siempre se gestionan campaña a campaña. ' +
      'Filtro opcional: `cedula` para ver los pendientes de un participante específico.',
  })
  @ApiQuery({ name: 'eventoId', required: true,  type: Number, example: 1,         description: 'ID del evento (obligatorio)' })
  @ApiQuery({ name: 'cedula',   required: false, type: String, example: '5782341', description: 'Filtrar pendientes de un participante específico' })
  @ApiQuery({ name: 'page',     required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit',    required: false, type: Number, example: 20 })
  @ApiOkResponse({ description: 'Listado paginado de tickets pendientes del evento' })
  @ApiBadRequestResponse({ description: 'eventoId es requerido' })
  async getPendientes(@Query() filtros: FiltrarPendientesDto) {
    return await this.facturasService.getPendientes(filtros);
  }

  @Post('pendientes/reintentar-todos')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reprocesar en lote todos los pendientes de un evento',
    description:
      'Ejecuta el reintento de forma automática sobre **todos** los tickets en estado `pendiente` ' +
      'del evento indicado. Para cada ticket:\n\n' +
      '1. Re-valida las reglas de negocio (el evento sigue vigente, no hay duplicado, etc.).\n' +
      '2. Sube la imagen a Cloudinary si el original falló en ese paso (el base64 está guardado).\n' +
      '3. Persiste la factura en DB y acumula los cupones.\n\n' +
      'Retorna un resumen con totales y el resultado individual de cada ticket ' +
      '(`exitoso`, `fallido`, motivo del fallo).\n\n' +
      '**Usa `POST /api/tickets/pendientes/:id/reintentar`** si solo necesitas reprocesar un ticket específico.\n\n' +
      '**`eventoId` es obligatorio** — evita procesar accidentalmente pendientes de otra campaña.',
  })
  @ApiQuery({ name: 'eventoId', required: true, type: Number, example: 1, description: 'ID del evento (obligatorio)' })
  @ApiOkResponse({ description: 'Resumen del lote: procesados, exitosos, fallidos y detalle por ticket' })
  @ApiBadRequestResponse({ description: 'eventoId es requerido' })
  async reintentarTodosPendientes(@Query() query: EventoIdQueryDto) {
    return await this.facturasService.reintentarTodosPendientes(query.eventoId);
  }

  @Post('pendientes/:id/reintentar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reprocesar un ticket pendiente específico',
    description:
      'Ejecuta el reintento para un único ticket pendiente identificado por su **ID de ticket pendiente** (`:id`). ' +
      'El `:id` en la URL es el identificador del registro en `tickets_pendientes`, ' +
      'obtenido del campo `pendienteId` en la respuesta `503` original o en `GET /api/tickets/pendientes`.\n\n' +
      'Sigue la misma lógica que el reintento masivo pero de forma individual:\n\n' +
      '1. Re-valida las reglas de negocio contra el estado actual de la campaña.\n' +
      '2. Sube la imagen si el fallo original fue en Cloudinary (el base64 está guardado en el registro).\n' +
      '3. Persiste la factura y acumula los cupones.\n\n' +
      '**Protecciones:**\n' +
      '- Si el ticket ya está en estado `completado` o `procesando` retorna `400`.\n' +
      '- Después de 5 intentos fallidos el estado cambia a `fallido_permanente` y deja de intentarse.',
  })
  @ApiParam({ name: 'id', type: Number, example: 4, description: 'ID del ticket pendiente — campo `pendienteId` de la respuesta 503 original o de GET /api/tickets/pendientes' })
  @ApiOkResponse({ description: 'Resultado del reintento' })
  @ApiNotFoundResponse({ description: 'Ticket pendiente no encontrado' })
  @ApiBadRequestResponse({ description: 'El ticket ya fue procesado o está siendo procesado actualmente' })
  async reintentarTicketPendiente(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return await this.facturasService.reintentarTicketPendiente(id);
  }

  // ── Consultas ─────────────────────────────────────────────────────────────

  @Get(':cedula/cupones')
  @ApiOperation({
    summary: 'Consultar cupones acumulados de un participante en una campaña',
    description:
      'Retorna el total de cupones acumulados por el participante en la campaña indicada, ' +
      'junto con el historial paginado de sus tickets registrados y cuántos cupones generó cada uno.\n\n' +
      '**Caso de uso principal:** pantalla de "mis cupones" en el frontend, donde el participante ' +
      'ingresa su cédula para ver cuántos cupones lleva en la campaña activa.\n\n' +
      '**`eventoId` es obligatorio** — los cupones siempre son por campaña, no globales.\n\n' +
      '**Privacidad:** no expone nombre, cédula ni ningún dato PII del participante. ' +
      'Solo retorna datos operativos (cupones, tickets, locales, imágenes).\n\n' +
      'Usa `page`/`limit` para paginar el listado de facturas cuando el participante tiene muchos registros.',
  })
  @ApiParam({ name: 'cedula', type: String, example: '434549', description: 'Cédula del participante' })
  @ApiQuery({ name: 'eventoId', required: true,  type: Number, example: 1,  description: 'ID de la campaña (obligatorio)' })
  @ApiQuery({ name: 'page',     required: false, type: Number, example: 1  })
  @ApiQuery({ name: 'limit',    required: false, type: Number, example: 2  })
  @ApiOkResponse({
    description: 'Cupones acumulados y facturas del participante en la campaña (paginado por factura)',
    schema: {
      example: {
        eventoId: 1,
        cuponesAcumulados: 70,
        totalFacturas: 1,
        facturas: [
          {
            id: 1,
            numeroTicket: '001-2023-019000001',
            local: 'Super 6 La Negrita',
            multiplicador: false,
            coeficienteMultiplicador: null,
            sku: '1kg',
            cantidad: 2,
            cuponesBase: 10,
            cuponesGenerados: 10,
            bonus: 5,
            totalCuponesEstaFactura: 70,
            fotoUrl: 'https://res.cloudinary.com/demo/image/upload/v1/tickets/foto.jpg',
            fechaCarga: '2026-04-15T10:00:00.000Z',
          },
        ],
        page: 1,
        limit: 2,
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Participante no encontrado' })
  @ApiBadRequestResponse({ description: 'eventoId es requerido y debe ser un entero positivo' })
  async getCuponesByCedula(
    @Param('cedula') cedula: string,
    @Query() query: ConsultarCuponesDto,
  ) {
    return await this.facturasService.getCuponesByCedulaEvento(cedula, query.eventoId, query);
  }

}
