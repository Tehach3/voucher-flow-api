import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { ActualizarUsuarioDto } from '../../common/dtos/actualizar-usuario.dto';
import { PaginationDto } from '../../common/dtos/pagination.dto';
import { ApiKeyGuard } from '../../common/guards/api-key.guard';

@Controller('api/usuarios')
@UseGuards(ApiKeyGuard)
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  async findAll(@Query() pagination: PaginationDto) {
    return await this.usuariosService.findAll(pagination);
  }

  @Get(':cedula')
  async findByCedula(@Param('cedula') cedula: string) {
    return await this.usuariosService.findByCedula(cedula);
  }

  @Patch(':cedula')
  async updateUsuario(
    @Param('cedula') cedula: string,
    @Body() dto: ActualizarUsuarioDto,
  ) {
    return await this.usuariosService.updateUsuario(cedula, dto);
  }
}
