import { IsOptional, IsString, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from './pagination.dto';

export class FiltrarTicketsDto extends PaginationDto {
  @ApiPropertyOptional({ example: 'TKT-2024-001', description: 'Filtrar por número de factura/ticket' })
  @IsOptional()
  @IsString()
  numeroTicket?: string;

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
