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
  @IsInt({ message: 'cantidad debe ser un número entero' })
  @Min(1, { message: 'cantidad debe ser al menos 1' })
  @Max(1000, { message: 'cantidad no puede superar 1000' })
  cantidad: number;
}

export class RegistrarParticipacionDto {
  // ── Datos del participante ──────────────────────────────────────────────────

  @ApiProperty({ example: '12345678', description: 'Cédula de identidad (6 a 10 dígitos numéricos)' })
  @IsNotEmpty({ message: 'La cédula es obligatoria' })
  @IsString()
  @Matches(REGEX.CEDULA, { message: 'La cédula debe tener entre 6 y 10 dígitos numéricos' })
  cedula: string;

  @ApiProperty({
    example: 'Juan Pérez',
    description: 'Nombre completo del participante',
  })
  @IsNotEmpty({ message: 'El nombre del participante es obligatorio' })
  @IsString({ message: 'El nombre debe ser texto' })
  @Length(2, 255, { message: 'El nombre debe tener entre 2 y 255 caracteres' })
  nombre: string;

  @ApiProperty({ example: '04141234567', description: 'Número de teléfono celular del participante' })
  @IsNotEmpty({ message: 'El número de celular es obligatorio' })
  @IsString()
  @Matches(REGEX.CELULAR, { message: 'El celular debe ser un número de teléfono válido (7 a 15 dígitos, puede incluir +)' })
  celular: string;

  @ApiProperty({ example: 'Caracas', description: 'Ciudad de residencia del participante' })
  @IsNotEmpty({ message: 'La ciudad es obligatoria' })
  @IsString({ message: 'La ciudad debe ser texto' })
  @Length(2, 100, { message: 'La ciudad debe tener entre 2 y 100 caracteres' })
  ciudad: string;

  @ApiPropertyOptional({ example: 'juan@email.com', description: 'Correo electrónico (opcional)' })
  @IsOptional()
  @IsEmail({}, { message: 'El email debe ser una dirección de correo válida' })
  email?: string;

  // ── Datos de la factura ─────────────────────────────────────────────────────

  @ApiProperty({ example: 1, description: 'ID del evento activo al que se inscribe el participante' })
  @IsNotEmpty({ message: 'El ID del evento es obligatorio' })
  @Type(() => Number)
  @IsInt({ message: 'El ID del evento debe ser un número entero' })
  @Min(1, { message: 'El ID del evento debe ser mayor a 0' })
  eventoId: number;

  @ApiProperty({
    example: '001-002-003',
    description:
      'Número del ticket, factura o comprobante. ' +
      'Debe estar formado por grupos de mínimo 3 dígitos separados por guión. ' +
      'Ejemplos válidos: 001-002-003, 1234-5678, 00100-00200-00300.',
  })
  @IsNotEmpty({ message: 'El número de ticket es obligatorio' })
  @IsString()
  @Matches(REGEX.NUMERO_FACTURA, {
    message:
      'El número de ticket debe tener grupos de mínimo 3 dígitos separados por guión (ej. 001-002-003)',
  })
  numeroTicket: string;

  @ApiProperty({
    example: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAA...',
    description:
      'Imagen del comprobante en formato base64 con prefijo de tipo MIME. ' +
      'Formato requerido: data:image/jpeg;base64,<datos> — se obtiene con FileReader.readAsDataURL() en el frontend. ' +
      'Tipos permitidos: image/jpeg, image/jpg, image/png. Tamaño máximo recomendado: 5 MB (≈ 6.8 MB en base64).',
  })
  @IsNotEmpty({ message: 'La imagen del comprobante es obligatoria' })
  @IsString()
  @Matches(
    /^data:image\/(jpeg|jpg|png);base64,[A-Za-z0-9+/]+=*$/,
    {
      message:
        'La imagen debe ser un Data URI válido. Formato: data:image/(jpeg|jpg|png);base64,<datos>. ' +
        'Generarlo con FileReader.readAsDataURL() en el frontend.',
    },
  )
  fotoBase64: string;

  // ── Local / establecimiento ────────────────────────────────────────────────

  @ApiProperty({
    example: 'Super 6 La Negrita',
    description: 'Nombre del local o establecimiento donde se realizó la compra',
  })
  @IsNotEmpty({ message: 'El nombre del local es obligatorio' })
  @IsString({ message: 'El local debe ser texto' })
  @Length(2, 255, { message: 'El local debe tener entre 2 y 255 caracteres' })
  local: string;

  @ApiProperty({
    example: false,
    description: 'Indica si el local cuenta con multiplicador de cupones',
  })
  @IsBoolean({ message: 'multiplicador debe ser true o false' })
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
  @IsNotEmpty({ message: 'coeficienteMultiplicador es requerido cuando multiplicador es true' })
  coeficienteMultiplicador?: number;

  // ── Productos ───────────────────────────────────────────────────────────────

  @ApiProperty({
    type: [ProductoFacturaDto],
    description: 'Lista de productos comprados. Debe incluir al menos un producto.',
    example: [{ sku: '1kg', cantidad: 2 }, { sku: '5kg', cantidad: 1 }],
  })
  @IsNotEmpty({ message: 'La lista de productos es obligatoria' })
  @IsArray({ message: 'productos debe ser un arreglo' })
  @ArrayNotEmpty({ message: 'Debe incluir al menos un producto en la lista' })
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
