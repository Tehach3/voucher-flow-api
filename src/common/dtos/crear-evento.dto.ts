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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SKU_VALUES } from '../constants/sku.constants';

export class CrearEventoDto {
  @ApiProperty({ example: 'Sorteo Verano 2026' })
  @IsString()
  @Length(2, 255)
  nombre: string;

  @ApiPropertyOptional({ example: 'Participa comprando productos y acumula cupones' })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiProperty({ example: '2026-12-31T23:59:59Z', description: 'Fecha límite para participar' })
  @IsDateString()
  fecha_vencimiento: string;

  @ApiPropertyOptional({ example: '2026-06-01T00:00:00Z', description: 'Fecha de inicio (por defecto ahora)' })
  @IsOptional()
  @IsDateString()
  fecha_inicio?: string;

  @ApiPropertyOptional({ example: false, description: 'Si true, exige cupones mínimos para validar participación' })
  @IsOptional()
  @IsBoolean()
  require_validacion_cupones?: boolean;

  @ApiPropertyOptional({ example: 10, description: 'Cupones mínimos requeridos (si require_validacion_cupones=true)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cupones_minimos?: number;

  @ApiPropertyOptional({ enum: SKU_VALUES, isArray: true, example: ['1kg', '5kg'], description: 'SKUs aceptados en este evento' })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(SKU_VALUES, { each: true, message: `Cada SKU debe ser uno de: ${SKU_VALUES.join(', ')}` })
  skus_validos?: string[];

  @ApiPropertyOptional({ example: 'https://example.com/banner.jpg' })
  @IsOptional()
  @IsUrl({}, { message: 'imagen_url debe ser una URL válida' })
  imagen_url?: string;

  @ApiPropertyOptional({ example: 'Premio: Viaje a Cancún para 2 personas' })
  @IsOptional()
  @IsString()
  premio_descripcion?: string;
}
