import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class EventoIdQueryDto {
  @ApiProperty({
    example: 1,
    description: 'ID del evento (obligatorio)',
  })
  @Type(() => Number)
  @IsInt({ message: 'eventoId debe ser un número entero' })
  @Min(1, { message: 'eventoId debe ser mayor a 0' })
  eventoId: number;
}
