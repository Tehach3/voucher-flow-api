import { Module } from '@nestjs/common';
import { CloudinaryService } from './cloudinary.service';
import { LoggerService } from './logger.service';

/**
 * Módulo compartido que exporta servicios de infraestructura.
 * Importar en los módulos de negocio que necesiten CloudinaryService o LoggerService.
 */
@Module({
  providers: [CloudinaryService, LoggerService],
  exports: [CloudinaryService, LoggerService],
})
export class ServicesModule {}
