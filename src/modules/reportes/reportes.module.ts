import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParticipacionEventoEntity } from '../participaciones/entities/participacion-evento.entity';
import { FacturaEntity } from '../facturas/entities/factura.entity';
import { TicketPendienteEntity } from '../facturas/entities/ticket-pendiente.entity';
import { EventoEntity } from '../eventos/entities/evento.entity';
import { ParticipanteEntity } from '../participantes/entities/participante.entity';
import { EventosModule } from '../eventos/eventos.module';
import { ReportesService } from './reportes.service';
import { ReportesController } from './reportes.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ParticipacionEventoEntity,
      FacturaEntity,
      TicketPendienteEntity,
      EventoEntity,
      ParticipanteEntity,
    ]),
    EventosModule,
  ],
  controllers: [ReportesController],
  providers: [ReportesService],
})
export class ReportesModule {}
