import { Module } from '@nestjs/common';
import { ImagenesService } from './imagenes.service';
import { ImagenesController } from './imagenes.controller';
import { ImagenesCloudinaryService } from './imagenes.cloudinary.service';
import { ServicesModule } from '../../services/services.module';

@Module({
  imports: [ServicesModule],
  controllers: [ImagenesController],
  providers: [ImagenesService, ImagenesCloudinaryService],
})
export class ImagenesModule {}
