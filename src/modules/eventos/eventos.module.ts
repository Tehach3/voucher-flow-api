import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventoEntity } from './entities/evento.entity';
import { EventosService } from './eventos.service';
import { EventosController } from './eventos.controller';

@Module({
  imports: [TypeOrmModule.forFeature([EventoEntity])],
  controllers: [EventosController],
  providers: [EventosService],
  exports: [EventosService],
})
export class EventosModule {}
