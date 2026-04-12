import { IsOptional, IsString, IsIn, Matches, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from './pagination.dto';
import { REGEX } from '../constants/regex.constants';
import { EstadoPendiente } from '../../modules/facturas/entities/ticket-pendiente.entity';

const ESTADOS: EstadoPendiente[] = ['pendiente', 'procesando', 'completado', 'fallido_permanente'];

export class FiltrarPendientesDto extends PaginationDto {
  @ApiPropertyOptional({
    enum: ESTADOS,
    example: 'pendiente',
    description: 'Filtrar por estado del ticket pendiente',
  })
  @IsOptional()
  @IsIn(ESTADOS)
  estado?: EstadoPendiente;

  @ApiPropertyOptional({ example: '12345678' })
  @IsOptional()
  @IsString()
  @Matches(REGEX.CEDULA, { message: 'cedula debe tener entre 6 y 10 dígitos numéricos' })
  cedula?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  eventoId?: number;
}
