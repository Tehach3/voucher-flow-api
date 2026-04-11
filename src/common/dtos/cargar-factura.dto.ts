import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsEmail,
  Matches,
  Length,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SKU_VALUES } from '../constants/sku.constants';
import { REGEX } from '../constants/regex.constants';

export class CargarFacturaDto {
  @ApiProperty({ example: '12345678', description: 'Cédula de identidad (8 dígitos)' })
  @IsString()
  @Matches(REGEX.CEDULA, { message: 'cedula debe tener exactamente 8 dígitos numéricos' })
  cedula: string;

  @ApiProperty({ example: 'Juan Perez' })
  @IsString()
  @Length(2, 255)
  nombre: string;

  @ApiPropertyOptional({ example: '04141234567' })
  @IsOptional()
  @IsString()
  @Matches(REGEX.CELULAR, { message: 'celular debe ser un número de teléfono válido' })
  celular?: string;

  @ApiPropertyOptional({ example: 'Caracas' })
  @IsOptional()
  @IsString()
  @Length(2, 100)
  ciudad?: string;

  @ApiPropertyOptional({ example: 'juan@email.com' })
  @IsOptional()
  @IsEmail({}, { message: 'email debe ser una dirección válida' })
  email?: string;

  @ApiProperty({ example: 1, description: 'ID del evento al que pertenece la factura' })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  evento_id: number;

  @ApiProperty({ example: 'FAC-2024-001' })
  @IsString()
  @Matches(REGEX.NUMERO_FACTURA, { message: 'numero_factura contiene caracteres no permitidos' })
  numero_factura: string;

  @ApiProperty({ enum: SKU_VALUES, example: '1kg', description: 'SKU del producto' })
  @IsEnum(SKU_VALUES, {
    message: `sku debe ser uno de: ${SKU_VALUES.join(', ')}`,
  })
  sku: string;

  @ApiProperty({ example: 2, minimum: 1, maximum: 1000 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(1000)
  cantidad: number;
}
