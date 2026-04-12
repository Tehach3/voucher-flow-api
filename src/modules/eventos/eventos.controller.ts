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
  @ApiOperation({ summary: 'Listar todos los eventos (paginado)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiOkResponse({ description: 'Lista paginada de eventos' })
  findAll(@Query() pagination: PaginationDto) {
    return this.eventosService.findAll(pagination);
  }

  @Get('disponibles')
  @ApiOperation({
    summary: 'Listar eventos por estado',
    description:
      'Retorna eventos activos con el estado calculado dinámicamente en base a las fechas y al cierre manual. ' +
      'Estados posibles: ' +
      '`vigente` (dentro del rango de fechas, acepta tickets), ' +
      '`no_iniciado` (fechaInicio aún no ha llegado), ' +
      '`vencido` (fechaCierre ya pasó), ' +
      '`cerrado` (cerrado manualmente). ' +
      'Sin filtro de estado retorna únicamente los eventos `vigente`.',
  })
  @ApiQuery({ name: 'estado', required: false, enum: ['vigente', 'no_iniciado', 'vencido', 'cerrado'] })
  @ApiOkResponse({ description: 'Lista de eventos filtrada por estado calculado' })
  findDisponibles(@Query() filtros: FiltrarEventosDto) {
    return this.eventosService.findAbiertos(filtros);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener evento por ID' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiOkResponse({ description: 'Datos del evento' })
  @ApiNotFoundResponse({ description: 'Evento no encontrado' })
  findById(@Param('id', ParseIntPipe) id: number) {
    return this.eventosService.findById(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear nuevo evento' })
  @ApiCreatedResponse({ description: 'Evento creado exitosamente' })
  @ApiBadRequestResponse({ description: 'Datos inválidos' })
  create(@Body() dto: CrearEventoDto) {
    return this.eventosService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar evento (reemplaza campos enviados)' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiOkResponse({ description: 'Evento actualizado' })
  @ApiNotFoundResponse({ description: 'Evento no encontrado' })
  @ApiBadRequestResponse({ description: 'Datos inválidos o estado no editable' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarEventoDto,
  ) {
    return this.eventosService.update(id, dto);
  }

  @Patch(':id/cerrar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cerrar un evento' })
  @ApiParam({ name: 'id', type: Number, example: 1 })
  @ApiOkResponse({ description: 'Evento cerrado' })
  @ApiNotFoundResponse({ description: 'Evento no encontrado' })
  @ApiBadRequestResponse({ description: 'El evento ya está finalizado' })
  cerrar(@Param('id', ParseIntPipe) id: number) {
    return this.eventosService.cerrar(id);
  }
}
