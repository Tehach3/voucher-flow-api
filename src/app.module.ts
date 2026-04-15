import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { getDatabaseConfig } from './config/database.config';
import { ParticipantesModule } from './modules/participantes/participantes.module';
import { FacturasModule } from './modules/facturas/facturas.module';
import { EventosModule } from './modules/eventos/eventos.module';
import { AuditoriaModule } from './modules/auditoria/auditoria.module';
import { ReportesModule } from './modules/reportes/reportes.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => getDatabaseConfig(),
    }),
    ParticipantesModule,
    EventosModule,
    FacturasModule,
    AuditoriaModule,
    ReportesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
