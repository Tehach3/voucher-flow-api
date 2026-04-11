import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { databaseConfig } from './config/database.config';
import { UsuariosModule } from './modules/usuarios/usuarios.module';
import { FacturasModule } from './modules/facturas/facturas.module';
import { ImagenesModule } from './modules/imagenes/imagenes.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      useFactory: () => databaseConfig,
    }),
    UsuariosModule,
    FacturasModule,
    ImagenesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
