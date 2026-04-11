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
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { UsuariosService } from './usuarios.service';
import { ActualizarUsuarioDto } from '../../common/dtos/actualizar-usuario.dto';
import { PaginationDto } from '../../common/dtos/pagination.dto';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';

@ApiTags('usuarios')
@ApiBearerAuth('api-key')
@ApiUnauthorizedResponse({ description: 'API Key inválida o ausente' })
@Controller('api/usuarios')
@UseGuards(ApiKeyGuard)
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  @ApiOperation({ summary: 'Listar participantes (paginado)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiOkResponse({ description: 'Lista paginada de participantes' })
  async findAll(@Query() pagination: PaginationDto) {
    return await this.usuariosService.findAll(pagination);
  }

  @Get(':cedula')
  @ApiOperation({ summary: 'Obtener participante por cédula' })
  @ApiParam({ name: 'cedula', type: String, example: '12345678' })
  @ApiOkResponse({ description: 'Datos del participante' })
  @ApiNotFoundResponse({ description: 'Participante no encontrado' })
  async findByCedula(@Param('cedula') cedula: string) {
    return await this.usuariosService.findByCedula(cedula);
  }

  @Patch(':cedula')
  @ApiOperation({ summary: 'Actualizar datos del participante' })
  @ApiParam({ name: 'cedula', type: String, example: '12345678' })
  @ApiOkResponse({ description: 'Participante actualizado' })
  @ApiNotFoundResponse({ description: 'Participante no encontrado' })
  @ApiBadRequestResponse({ description: 'Datos inválidos' })
  async updateUsuario(
    @Param('cedula') cedula: string,
    @Body() dto: ActualizarUsuarioDto,
  ) {
    return await this.usuariosService.updateUsuario(cedula, dto);
  }
}
