import { IsOptional, IsEnum } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const ESTADOS_EVENTO = ['abierto', 'cerrado', 'pausado', 'finalizado'] as const;

export class FiltrarEventosDto {
  @ApiPropertyOptional({
    enum: ESTADOS_EVENTO,
    example: 'abierto',
    description: 'Filtrar por estado del evento. Sin filtro retorna todos los eventos activos.',
  })
  @IsOptional()
  @IsEnum(ESTADOS_EVENTO, { message: `estado debe ser uno de: ${ESTADOS_EVENTO.join(', ')}` })
  estado?: (typeof ESTADOS_EVENTO)[number];
}
