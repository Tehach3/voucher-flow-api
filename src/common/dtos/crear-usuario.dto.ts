import { IsString, IsOptional, Matches, Length } from 'class-validator';
import { REGEX } from '../constants/regex.constants';

export class CrearUsuarioDto {
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
}
