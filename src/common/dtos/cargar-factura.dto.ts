import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  Matches,
  Length,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SKU_VALUES } from '../constants/sku.constants';
import { REGEX } from '../constants/regex.constants';

export class CargarFacturaDto {
  @IsString()
  @Matches(REGEX.CEDULA, { message: 'cedula debe tener exactamente 8 dígitos numéricos' })
  cedula: string;

  @IsString()
  @Length(2, 255)
  nombre: string;

  @IsOptional()
  @IsString()
  @Matches(REGEX.CELULAR, { message: 'celular debe ser un número de teléfono válido' })
  celular?: string;

  @IsOptional()
  @IsString()
  @Length(2, 100)
  ciudad?: string;

  @IsString()
  @Matches(REGEX.NUMERO_FACTURA, { message: 'numero_factura contiene caracteres no permitidos' })
  numero_factura: string;

  @IsEnum(SKU_VALUES, {
    message: `sku debe ser uno de: ${SKU_VALUES.join(', ')}`,
  })
  sku: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(1000)
  cantidad: number;
}
