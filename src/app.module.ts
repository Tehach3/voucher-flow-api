import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { getDatabaseConfig } from './config/database.config';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { FacturasModule } from './modules/facturas/facturas.module';
import { ImagenesModule } from './modules/imagenes/imagenes.module';
import { EventosModule } from './modules/eventos/eventos.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => getDatabaseConfig(),
    }),
    UsuariosModule,
    EventosModule,
    FacturasModule,
    ImagenesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
