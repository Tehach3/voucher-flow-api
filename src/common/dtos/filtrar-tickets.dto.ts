import { IsOptional, IsString, IsDateString, Matches } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from './pagination.dto';
import { REGEX } from '../constants/regex.constants';

export class FiltrarTicketsDto extends PaginationDto {
  @ApiPropertyOptional({ example: '12345678', description: 'Filtrar por cédula del participante' })
  @IsOptional()
  @IsString()
  @Matches(REGEX.CEDULA, { message: 'cedula debe tener entre 6 y 10 dígitos numéricos' })
  cedula?: string;

  @ApiPropertyOptional({ example: 'Caracas', description: 'Filtrar por ciudad del participante' })
  @IsOptional()
  @IsString()
  ciudad?: string;

  @ApiPropertyOptional({ example: '2024-01-01', description: 'Fecha de inicio del rango (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  fechaDesde?: string;

  @ApiPropertyOptional({ example: '2024-12-31', description: 'Fecha de fin del rango (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  fechaHasta?: string;
}
