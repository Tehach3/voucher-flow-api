import { IsOptional, IsString, IsInt, Min, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from './pagination.dto';
import { REGEX } from '../constants/regex.constants';

export class FiltrarPendientesDto extends PaginationDto {
  @ApiProperty({
    example: 1,
    description: 'ID del evento (obligatorio). Solo se retornan tickets en estado pendiente.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  eventoId: number;

  @ApiPropertyOptional({ example: '12345678', description: 'Filtrar por cédula del participante' })
  @IsOptional()
  @IsString()
  @Matches(REGEX.CEDULA, { message: 'cedula debe tener entre 6 y 10 dígitos numéricos' })
  cedula?: string;
}
