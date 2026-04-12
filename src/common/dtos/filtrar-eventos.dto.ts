import { IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export const ESTADOS_EVENTO_PUBLICO = ['no_iniciado', 'vigente', 'vencido', 'cerrado'] as const;
export type EstadoEventoPublico = (typeof ESTADOS_EVENTO_PUBLICO)[number];

export class FiltrarEventosDto {
  @ApiPropertyOptional({
    enum: ESTADOS_EVENTO_PUBLICO,
    example: 'vigente',
    description:
      'Filtrar por estado calculado del evento. ' +
      'Sin filtro retorna solo los eventos vigentes (activos y dentro del rango de fechas).',
  })
  @IsOptional()
  @IsEnum(ESTADOS_EVENTO_PUBLICO, { message: `estado debe ser uno de: ${ESTADOS_EVENTO_PUBLICO.join(', ')}` })
  estado?: EstadoEventoPublico;
}
