import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiSecurity,
  ApiOperation,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ParticipantesService } from './participantes.service';
import { ActualizarParticipanteDto } from '../../common/dtos/actualizar-participante.dto';
import { PaginationDto } from '../../common/dtos/pagination.dto';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';

@ApiTags('participantes')
@ApiSecurity('x-api-key')
@ApiUnauthorizedResponse({ description: 'API Key inválida o ausente' })
@Controller('participantes')
@UseGuards(ApiKeyGuard)
export class ParticipantesController {
  constructor(private readonly participantesService: ParticipantesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar participantes (paginado)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiOkResponse({ description: 'Lista paginada de participantes' })
  async findAll(@Query() pagination: PaginationDto) {
    return await this.participantesService.findAll(pagination);
  }

  @Get(':cedula')
  @ApiOperation({ summary: 'Obtener participante por cédula' })
  @ApiParam({ name: 'cedula', type: String, example: '12345678' })
  @ApiOkResponse({ description: 'Datos del participante' })
  @ApiNotFoundResponse({ description: 'Participante no encontrado' })
  async findByCedula(@Param('cedula') cedula: string) {
    return await this.participantesService.findByCedula(cedula);
  }

  @Patch(':cedula')
  @ApiOperation({ summary: 'Actualizar datos del participante' })
  @ApiParam({ name: 'cedula', type: String, example: '12345678' })
  @ApiOkResponse({ description: 'Participante actualizado' })
  @ApiNotFoundResponse({ description: 'Participante no encontrado' })
  @ApiBadRequestResponse({ description: 'Datos inválidos' })
  async updateParticipante(
    @Param('cedula') cedula: string,
    @Body() dto: ActualizarParticipanteDto,
  ) {
    return await this.participantesService.updateParticipante(cedula, dto);
  }
}
