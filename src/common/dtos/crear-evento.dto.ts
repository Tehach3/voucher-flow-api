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
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SKU_VALUES } from '../constants/sku.constants';

export class CondicionCuponDto {
  @ApiProperty({ enum: SKU_VALUES, example: '5kg' })
  @IsEnum(SKU_VALUES, { message: `sku debe ser uno de: ${SKU_VALUES.join(', ')}` })
  sku: string;

  @ApiProperty({ example: 15, description: 'Cupones generados por unidad de este SKU' })
  @IsInt()
  @Min(1)
  cuponesPorUnidad: number;
}

export class PremioDto {
  @ApiProperty({ example: 'Viaje a Cancún para 2 personas' })
  @IsString()
  @Length(2, 500)
  descripcion: string;

  @ApiProperty({ example: 1, description: 'Orden de importancia (1 = primer premio)' })
  @IsInt()
  @Min(1)
  orden: number;
}

export class CrearEventoDto {
  @ApiProperty({ example: 'Sorteo Verano 2026' })
  @IsString()
  @Length(2, 255)
  nombre: string;

  @ApiProperty({ example: '2026-12-31T23:59:59Z', description: 'Fecha de cierre del evento' })
  @IsDateString()
  fechaCierre: string;

  @ApiProperty({ example: '2026-06-01T00:00:00Z', description: 'Fecha de inicio del evento' })
  @IsDateString()
  fechaInicio: string;

  @ApiProperty({ example: 1, description: 'Cupones mínimos requeridos para participar (mínimo 1)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cuponesMinimos: number;

  @ApiPropertyOptional({ example: 'Participa comprando productos y acumula cupones' })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiPropertyOptional({
    example: true,
    description:
      'true = el evento tiene múltiples condiciones de cupones (por SKU). ' +
      'false = genera siempre bajo una única condición. ' +
      'Cuando es false, condicionesCupones debe tener exactamente 1 elemento.',
  })
  @IsOptional()
  @IsBoolean()
  tieneCondicionesMultiples?: boolean;

  @ApiPropertyOptional({
    type: [CondicionCuponDto],
    description:
      'Condiciones de cupones por SKU. ' +
      'Si tieneCondicionesMultiples=true puede tener múltiples entradas. ' +
      'Si tieneCondicionesMultiples=false debe tener exactamente 1.',
    example: [
      { sku: '250g', cuponesPorUnidad: 2 },
      { sku: '500g', cuponesPorUnidad: 3 },
      { sku: '1kg', cuponesPorUnidad: 5 },
      { sku: '5kg', cuponesPorUnidad: 15 },
    ],
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CondicionCuponDto)
  condicionesCupones?: CondicionCuponDto[];

  @ApiPropertyOptional({
    type: [PremioDto],
    description: 'Lista de premios. Permite múltiples premios para campañas con más de uno.',
    example: [
      { descripcion: 'Viaje a Cancún para 2 personas', orden: 1 },
      { descripcion: 'TV 55 pulgadas', orden: 2 },
    ],
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => PremioDto)
  premios?: PremioDto[];

  @ApiPropertyOptional({ example: 'https://example.com/banner.jpg' })
  @IsOptional()
  @IsUrl({}, { message: 'imagenUrl debe ser una URL válida' })
  imagenUrl?: string;
}
