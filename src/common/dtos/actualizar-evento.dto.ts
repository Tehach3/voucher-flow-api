import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsArray,
  IsEnum,
  IsDateString,
  IsUrl,
  Length,
  Min,
  ArrayNotEmpty,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SKU_VALUES } from '../constants/sku.constants';

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

  @ApiPropertyOptional({ example: '2027-01-31T23:59:59Z' })
  @IsOptional()
  @IsDateString()
  fecha_vencimiento?: string;

  @ApiPropertyOptional({ example: '2026-06-01T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  fecha_inicio?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  require_validacion_cupones?: boolean;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cupones_minimos?: number;

  @ApiPropertyOptional({ enum: SKU_VALUES, isArray: true, example: ['250g', '500g', '1kg', '5kg'] })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(SKU_VALUES, { each: true, message: `Cada SKU debe ser uno de: ${SKU_VALUES.join(', ')}` })
  skus_validos?: string[];

  @ApiPropertyOptional({ example: 'https://example.com/nuevo-banner.jpg' })
  @IsOptional()
  @IsUrl({}, { message: 'imagen_url debe ser una URL válida' })
  imagen_url?: string;

  @ApiPropertyOptional({ example: 'Premio actualizado: Auto 0km' })
  @IsOptional()
  @IsString()
  premio_descripcion?: string;
}
