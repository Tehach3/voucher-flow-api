import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FacturaEntity } from './entities/factura.entity';
import { FacturasService } from './facturas.service';
import { FacturasController } from './facturas.controller';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { ServicesModule } from '../../services/services.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([FacturaEntity]),
    UsuariosModule,
    ServicesModule,
  ],
  controllers: [FacturasController],
  providers: [FacturasService],
  exports: [FacturasService],
})
export class FacturasModule {}
