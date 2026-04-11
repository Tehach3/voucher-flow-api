import { IsString, IsOptional, IsEmail, Matches, Length } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { REGEX } from '../constants/regex.constants';

export class ActualizarUsuarioDto {
  @ApiPropertyOptional({ example: 'Juan Perez' })
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
}
