import {
  IsString,
  IsOptional,
  IsEmail,
  IsInt,
  IsBoolean,
  IsArray,
  IsEnum,
  IsNotEmpty,
  Matches,
  Length,
  Min,
  Max,
  ArrayNotEmpty,
  ValidateNested,
  ValidateIf,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { REGEX } from '../constants/regex.constants';
import { SKU_VALUES } from '../constants/sku.constants';

export class ProductoFacturaDto {
  @ApiProperty({ enum: SKU_VALUES, example: '5kg' })
  @IsEnum(SKU_VALUES, { message: `sku debe ser uno de: ${SKU_VALUES.join(', ')}` })
  sku: string;

  @ApiProperty({ example: 2, minimum: 1, maximum: 1000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  cantidad: number;
}

export class RegistrarParticipacionDto {
  // ── Datos del participante ──────────────────────────────────────────────────

  @ApiProperty({ example: '12345678', description: 'Cédula de identidad (8 dígitos)' })
  @IsString()
  @Matches(REGEX.CEDULA, { message: 'cedula debe tener entre 6 y 10 dígitos numéricos' })
  cedula: string;

  @ApiPropertyOptional({
    example: 'Juan Pérez',
    description: 'Requerido solo si es la primera vez que participa con esta cédula',
  })
  @IsOptional()
  @IsString()
  @Length(2, 255)
  nombre?: string;

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

  // ── Datos de la factura ─────────────────────────────────────────────────────

  @ApiProperty({ example: 1, description: 'ID del evento activo' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  eventoId: number;

  @ApiProperty({ example: 'TKT-2024-001', description: 'Número del ticket, factura o comprobante' })
  @IsString()
  @Matches(REGEX.NUMERO_FACTURA, { message: 'numeroTicket contiene caracteres no permitidos' })
  numeroTicket: string;

  @ApiProperty({
    example: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAA...',
    description:
      'Imagen del comprobante en formato base64 con prefijo de tipo MIME. ' +
      'Formato: data:image/jpeg;base64,<datos> — se obtiene con FileReader.readAsDataURL() en el frontend. ' +
      'Tipos permitidos: image/jpeg, image/jpg, image/png. Tamaño máximo recomendado: 5 MB (≈ 6.8 MB en base64).',
  })
  @IsString()
  @IsNotEmpty({ message: 'fotoBase64 es requerido' })
  @Matches(
    /^data:image\/(jpeg|jpg|png);base64,[A-Za-z0-9+/]+=*$/,
    { message: 'fotoBase64 debe ser un Data URI válido: data:image/(jpeg|jpg|png);base64,<datos>' },
  )
  fotoBase64: string;

  // ── Local / establecimiento ────────────────────────────────────────────────

  @ApiProperty({
    example: 'Super 6 La Negrita',
    description: 'Nombre del local o establecimiento donde se realizó la compra',
  })
  @IsString()
  @Length(2, 255)
  local: string;

  @ApiProperty({
    example: false,
    description: 'Indica si el local cuenta con multiplicador de cupones',
  })
  @IsBoolean()
  multiplicador: boolean;

  @ApiPropertyOptional({
    example: 2,
    description:
      'Coeficiente del multiplicador (2 = x2, 3 = x3, etc.). ' +
      'Requerido cuando multiplicador=true. Si se envía un valor <= 0 se normaliza a 1 (sin efecto multiplicador).',
    minimum: 1,
  })
  @ValidateIf((o) => o.multiplicador === true)
  @Transform(({ value }) => {
    if (value === undefined || value === null) return value;
    const n = Number(value);
    return n <= 0 ? 1 : n;
  })
  @IsInt({ message: 'coeficienteMultiplicador debe ser un número entero' })
  @Min(1, { message: 'coeficienteMultiplicador debe ser al menos 1' })
  @IsNotEmpty({ message: 'coeficienteMultiplicador es requerido cuando multiplicador=true' })
  coeficienteMultiplicador?: number;

  // ── Productos ───────────────────────────────────────────────────────────────

  @ApiProperty({
    type: [ProductoFacturaDto],
    description: 'Lista de productos comprados',
    example: [{ sku: '1kg', cantidad: 2 }, { sku: '5kg', cantidad: 1 }],
  })
  @IsArray()
  @ArrayNotEmpty({ message: 'productos no puede estar vacío' })
  @ValidateNested({ each: true })
  @Type(() => ProductoFacturaDto)
  productos: ProductoFacturaDto[];

  // ── Bonus ───────────────────────────────────────────────────────────────────

  @ApiPropertyOptional({
    example: 5,
    description:
      'Cupones adicionales que se suman al total generado por los productos. ' +
      'Ejemplo: si los productos generan 10 cupones y bonus=2, el total es 12.',
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'bonus debe ser un número entero' })
  @Min(0, { message: 'bonus debe ser igual o mayor a 0' })
  bonus?: number | null;
}
