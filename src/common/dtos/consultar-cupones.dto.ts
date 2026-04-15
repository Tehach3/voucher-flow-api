import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { PaginationDto } from './pagination.dto';

export class ConsultarCuponesDto extends PaginationDto {
  @ApiProperty({
    example: 1,
    description: 'ID de la campaña/evento a consultar (obligatorio)',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  eventoId: number;
}
