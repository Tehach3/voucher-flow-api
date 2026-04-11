import { IsString, IsOptional, IsEmail, Matches, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { REGEX } from '../constants/regex.constants';

export class CrearUsuarioDto {
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
}
