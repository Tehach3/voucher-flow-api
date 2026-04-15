import { IsOptional, IsString, IsDateString, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationDto } from './pagination.dto';

export type OrdenarReportePor = 'local' | 'ciudad' | 'cuponesGenerados' | 'fechaCarga';
export type OrdenDir = 'ASC' | 'DESC';

export class FiltrarReporteDetalladoDto extends PaginationDto {
  @ApiPropertyOptional({ example: '2025-01-01', description: 'Fecha desde (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  fechaDesde?: string;

  @ApiPropertyOptional({ example: '2025-12-31', description: 'Fecha hasta (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  fechaHasta?: string;

  @ApiPropertyOptional({ example: 'Caracas', description: 'Filtrar por ciudad (búsqueda parcial)' })
  @IsOptional()
  @IsString()
  ciudad?: string;

  @ApiPropertyOptional({ example: 'Super 6', description: 'Filtrar por local (búsqueda parcial)' })
  @IsOptional()
  @IsString()
  local?: string;

  @ApiPropertyOptional({
    enum: ['local', 'ciudad', 'cuponesGenerados', 'fechaCarga'],
    default: 'ciudad',
    description:
      'Campo por el que ordenar. ' +
      '"local" ordena por ciudad → local. ' +
      '"ciudad" ordena por ciudad → local. ' +
      '"cuponesGenerados" ordena por total de cupones de la factura. ' +
      '"fechaCarga" ordena por fecha de registro.',
  })
  @IsOptional()
  @IsIn(['local', 'ciudad', 'cuponesGenerados', 'fechaCarga'])
  ordenarPor?: OrdenarReportePor;

  @ApiPropertyOptional({ enum: ['ASC', 'DESC'], default: 'ASC', description: 'Dirección del ordenamiento' })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  orden?: OrdenDir;
}
