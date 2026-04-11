import { Injectable, Logger } from '@nestjs/common';
import { ImagenesCloudinaryService } from './imagenes.cloudinary.service';
import { OcrData } from '../facturas/entities/factura.entity';

export interface SubirImagenResult {
  url: string;
  publicId: string;
  ocrData: OcrData | null;
  cedula: string;
  timestamp: string;
}

@Injectable()
export class ImagenesService {
  private readonly logger = new Logger(ImagenesService.name);

  constructor(
    private readonly imagenesCloudinaryService: ImagenesCloudinaryService,
  ) {}

  async subirImagen(
    file: Express.Multer.File,
    cedula: string,
  ): Promise<SubirImagenResult> {
    this.logger.log(`[IMAGENES] Iniciando subida para cédula: ${cedula}`);

    const { url, publicId, ocrData } =
      await this.imagenesCloudinaryService.uploadFacturaImagen(file, cedula);

    this.logger.log(
      `[IMAGENES] Imagen subida exitosamente para cédula: ${cedula}`,
    );

    return {
      url,
      publicId,
      ocrData,
      cedula,
      timestamp: new Date().toISOString(),
    };
  }
}
