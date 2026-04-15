import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
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
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiParam,
  ApiQuery,
  ApiBody,
} from '@nestjs/swagger';
import { EventosService } from './eventos.service';
import { CrearEventoDto } from '../../common/dtos/crear-evento.dto';
import { ActualizarEventoDto } from '../../common/dtos/actualizar-evento.dto';
import { FiltrarEventosDto } from '../../common/dtos/filtrar-eventos.dto';
import { PaginationDto } from '../../common/dtos/pagination.dto';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';

@ApiTags('eventos')
@ApiSecurity('x-api-key')
@ApiUnauthorizedResponse({ description: 'API Key inválida o ausente' })
@Controller('eventos')
@UseGuards(ApiKeyGuard)
export class EventosController {
  constructor(private readonly eventosService: EventosService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar todos los eventos (paginado)',
    description:
      'Retorna el catálogo completo de eventos sin filtrar por estado. Útil para el backoffice ' +
      'cuando se necesita ver todos los eventos independientemente de si están vigentes, vencidos o cerrados. ' +
      'Para el frontend de participantes usa `GET /api/eventos/disponibles` que filtra por estado.',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiOkResponse({ description: 'Lista paginada de eventos' })
  findAll(@Query() pagination: PaginationDto) {
    return this.eventosService.findAll(pagination);
  }

  @Get('disponibles')
  @ApiOperation({
    summary: 'Listar eventos filtrados por estado calculado',
    description:
      'Retorna eventos cuyo estado se calcula dinámicamente comparando las fechas actuales con `fechaInicio` ' +
      'y `fechaCierre`, y considerando si fue cerrado manualmente.\n\n' +
      '**Estados posibles:**\n' +
      '- `vigente` — dentro del rango de fechas y no cerrado; **acepta registro de tickets**\n' +
      '- `no_iniciado` — `fechaInicio` aún no ha llegado\n' +
      '- `vencido` — `fechaCierre` ya pasó\n' +
      '- `cerrado` — cerrado manualmente con `PATCH /api/eventos/:id/cerrar`\n\n' +
      'Sin filtro de `estado`, retorna **únicamente los eventos `vigente`**. ' +
      'Este es el endpoint que debe usar el frontend para saber a qué campañas puede inscribirse un participante.',
  })
  @ApiQuery({ name: 'estado', required: false, enum: ['vigente', 'no_iniciado', 'vencido', 'cerrado'] })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiOkResponse({ description: 'Lista paginada de eventos filtrada por estado calculado' })
  findDisponibles(@Query() filtros: FiltrarEventosDto) {
    return this.eventosService.findAbiertos(filtros);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener evento por ID',
    description:
      'Retorna el detalle completo de un evento: fechas, estado calculado, SKUs válidos con sus cupones ' +
      'por unidad (`condicionesCupones`), premios y configuración del multiplicador. ' +
      'Útil para que el frontend construya el formulario de registro con los SKUs y reglas correctas ' +
      'de la campaña antes de llamar a `POST /api/tickets`.',
  })
  @ApiParam({ name: 'id', type: Number, example: 3 })
  @ApiOkResponse({
    description: 'Datos completos del evento incluyendo condiciones de cupones y premios',
    schema: {
      example: {
        id: 3,
        nombre: 'Molinos (test) Mundial 2026',
        descripcion: 'Participa comprando productos y acumula cupones',
        fechaInicio: '2026-04-01T00:00:00.000Z',
        fechaCierre: '2026-06-01T23:59:59.000Z',
        estado: 'vigente',
        activo: true,
        cuponesMinimos: 1,
        tieneCondicionesMultiples: true,
        condicionesCupones: [
          { sku: '250g', cuponesPorUnidad: 1 },
          { sku: '500g', cuponesPorUnidad: 2 },
          { sku: '1kg',  cuponesPorUnidad: 5 },
          { sku: '5kg',  cuponesPorUnidad: 15 },
        ],
        premios: [
          { descripcion: 'Viaje al Mundial',       orden: 1 },
          { descripcion: 'TV 55 pulgadas',         orden: 2 },
          { descripcion: 'Cupones de descuento',   orden: 3 },
        ],
        imagenUrl: 'https://example.com/banner.jpg',
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Evento no encontrado' })
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.eventosService.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Crear nuevo evento (campaña)',
    description:
      'Crea una campaña promocional con su configuración completa. Los campos clave son:\n\n' +
      '- `condicionesCupones` — lista de SKUs válidos y cuántos cupones genera cada unidad. ' +
      'Es la fuente única de verdad para los SKUs que acepta la campaña.\n' +
      '- `tieneCondicionesMultiples` — `false` si todos los productos usan una sola regla; ' +
      '`true` si hay reglas distintas por SKU.\n' +
      '- `premios` — lista de premios de la campaña (descripción y orden).\n' +
      '- `fechaInicio` / `fechaCierre` — delimitan el período en que se aceptan tickets.\n\n' +
      'Una vez creado, el evento empieza en estado `no_iniciado` hasta que llegue `fechaInicio`.',
  })
  @ApiBody({
    schema: {
      example: {
        nombre: 'Molinos (test) Mundial 2026',
        fechaInicio: '2026-04-01T00:00:00Z',
        fechaCierre: '2026-06-01T23:59:59Z',
        cuponesMinimos: 1,
        descripcion: 'Participa comprando productos y acumula cupones',
        tieneCondicionesMultiples: true,
        condicionesCupones: [
          { sku: '250g', cuponesPorUnidad: 1 },
          { sku: '500g', cuponesPorUnidad: 2 },
          { sku: '1kg',  cuponesPorUnidad: 5 },
          { sku: '5kg',  cuponesPorUnidad: 15 },
        ],
        premios: [
          { descripcion: 'Viaje al Mundial',     orden: 1 },
          { descripcion: 'TV 55 pulgadas',       orden: 2 },
          { descripcion: 'Cupones de descuento', orden: 3 },
        ],
        imagenUrl: 'https://example.com/banner.jpg',
      },
    },
  })
  @ApiCreatedResponse({
    description: 'Evento creado exitosamente con su ID asignado',
    schema: {
      example: {
        id: 3,
        nombre: 'Molinos (test) Mundial 2026',
        descripcion: 'Participa comprando productos y acumula cupones',
        fechaInicio: '2026-04-01T00:00:00.000Z',
        fechaCierre: '2026-06-01T23:59:59.000Z',
        estado: 'no_iniciado',
        activo: true,
        cuponesMinimos: 1,
        tieneCondicionesMultiples: true,
        condicionesCupones: [
          { sku: '250g', cuponesPorUnidad: 1 },
          { sku: '500g', cuponesPorUnidad: 2 },
          { sku: '1kg',  cuponesPorUnidad: 5 },
          { sku: '5kg',  cuponesPorUnidad: 15 },
        ],
        premios: [
          { descripcion: 'Viaje al Mundial',     orden: 1 },
          { descripcion: 'TV 55 pulgadas',       orden: 2 },
          { descripcion: 'Cupones de descuento', orden: 3 },
        ],
        imagenUrl: 'https://example.com/banner.jpg',
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Datos inválidos: fechas incorrectas, SKUs duplicados o campos requeridos faltantes' })
  create(@Body() dto: CrearEventoDto) {
    return this.eventosService.create(dto);
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Actualizar configuración de un evento',
    description:
      'Permite modificar los campos de un evento existente: fechas, premios, condiciones de cupones, etc. ' +
      'Solo se pueden editar eventos que **no estén cerrados**. ' +
      'Los campos no enviados en el body conservan su valor actual. ' +
      '**Precaución:** modificar `condicionesCupones` en un evento con tickets ya registrados ' +
      'puede generar inconsistencias en los cupones históricos.',
  })
  @ApiParam({ name: 'id', type: Number, example: 3 })
  @ApiBody({
    schema: {
      example: {
        nombre: 'Sorteo Mundial 2026',
        fechaInicio: '2026-06-01T00:00:00Z',
        fechaCierre: '2026-12-31T23:59:59Z',
        cuponesMinimos: 1,
        descripcion: 'Participa comprando productos y acumula cupones',
        tieneCondicionesMultiples: true,
        condicionesCupones: [
          { sku: '250g', cuponesPorUnidad: 1 },
          { sku: '500g', cuponesPorUnidad: 2 },
          { sku: '1kg',  cuponesPorUnidad: 5 },
          { sku: '5kg',  cuponesPorUnidad: 15 },
        ],
        premios: [
          { descripcion: 'Viaje al Mundial',     orden: 1 },
          { descripcion: 'TV 55 pulgadas',       orden: 2 },
          { descripcion: 'Cupones de descuento', orden: 3 },
        ],
        imagenUrl: 'https://example.com/banner.jpg',
      },
    },
  })
  @ApiOkResponse({
    description: 'Evento actualizado con los nuevos valores',
    schema: {
      example: {
        id: 3,
        nombre: 'Sorteo Mundial 2026',
        descripcion: 'Participa comprando productos y acumula cupones',
        fechaInicio: '2026-06-01T00:00:00.000Z',
        fechaCierre: '2026-12-31T23:59:59.000Z',
        estado: 'no_iniciado',
        activo: true,
        cuponesMinimos: 1,
        tieneCondicionesMultiples: true,
        condicionesCupones: [
          { sku: '250g', cuponesPorUnidad: 1 },
          { sku: '500g', cuponesPorUnidad: 2 },
          { sku: '1kg',  cuponesPorUnidad: 5 },
          { sku: '5kg',  cuponesPorUnidad: 15 },
        ],
        premios: [
          { descripcion: 'Viaje al Mundial',     orden: 1 },
          { descripcion: 'TV 55 pulgadas',       orden: 2 },
          { descripcion: 'Cupones de descuento', orden: 3 },
        ],
        imagenUrl: 'https://example.com/banner.jpg',
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Evento no encontrado' })
  @ApiBadRequestResponse({ description: 'Datos inválidos o el evento está en estado no editable' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarEventoDto,
  ) {
    return this.eventosService.update(id, dto);
  }

  @Patch(':id/cerrar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cerrar un evento manualmente',
    description:
      'Marca el evento como `cerrado` de forma inmediata, independientemente de la `fechaCierre`. ' +
      'A partir de ese momento, `POST /api/tickets` rechazará cualquier nuevo registro con 400. ' +
      'Esta acción **no es reversible** desde la API — se usa para finalizar anticipadamente una campaña ' +
      'o para bloquear nuevos registros mientras se procesan los pendientes.',
  })
  @ApiParam({ name: 'id', type: Number, example: 3 })
  @ApiOkResponse({
    description: 'Evento cerrado correctamente; ya no acepta nuevos tickets',
    schema: { example: { id: 3, nombre: 'Molinos (test) Mundial 2026', estado: 'cerrado', activo: false } },
  })
  @ApiNotFoundResponse({ description: 'Evento no encontrado' })
  @ApiBadRequestResponse({ description: 'El evento ya estaba cerrado o vencido' })
  cerrar(@Param('id', ParseIntPipe) id: number) {
    return this.eventosService.cerrar(id);
  }
}
