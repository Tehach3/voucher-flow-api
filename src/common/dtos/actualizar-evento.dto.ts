import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsArray,
  IsDateString,
  IsUrl,
  Length,
  Min,
  ArrayNotEmpty,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CondicionCuponDto, PremioDto } from './crear-evento.dto';

export class ActualizarEventoDto {
  @ApiPropertyOptional({ example: 'Sorteo Verano 2026 — Edición Especial' })
  @IsOptional()
  @IsString()
  @Length(2, 255)
  nombre?: string;

  @ApiPropertyOptional({ example: 'Nueva descripción del evento' })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiPropertyOptional({ example: '2027-01-31T23:59:59Z', description: 'Fecha de cierre del evento' })
  @IsOptional()
  @IsDateString()
  fechaCierre?: string;

  @ApiPropertyOptional({ example: '2026-06-01T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @ApiPropertyOptional({ example: 5, description: 'Cupones mínimos requeridos para participar' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cuponesMinimos?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  tieneCondicionesMultiples?: boolean;

  @ApiPropertyOptional({ type: [CondicionCuponDto] })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CondicionCuponDto)
  condicionesCupones?: CondicionCuponDto[];

  @ApiPropertyOptional({ type: [PremioDto] })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => PremioDto)
  premios?: PremioDto[];

  @ApiPropertyOptional({ example: 'https://example.com/nuevo-banner.jpg' })
  @IsOptional()
  @IsUrl({}, { message: 'imagenUrl debe ser una URL válida' })
  imagenUrl?: string;
}
