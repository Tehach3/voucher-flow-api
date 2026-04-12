import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParticipanteEntity } from './entities/participante.entity';
import { ParticipantesService } from './participantes.service';
import { ParticipantesController } from './participantes.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ParticipanteEntity])],
  controllers: [ParticipantesController],
  providers: [ParticipantesService],
  exports: [ParticipantesService],
})
export class ParticipantesModule {}
