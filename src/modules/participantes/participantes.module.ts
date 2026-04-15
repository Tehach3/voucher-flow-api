import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParticipanteEntity } from './entities/participante.entity';
import { ParticipantesService } from './participantes.service';

@Module({
  imports: [TypeOrmModule.forFeature([ParticipanteEntity])],
  providers: [ParticipantesService],
  exports: [ParticipantesService],
})
export class ParticipantesModule {}
