import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { OcrData } from '../modules/facturas/entities/factura.entity';
import { cloudinaryConfig } from '../config/cloudinary.config';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private readonly isConfigured: boolean;

  constructor() {
    this.isConfigured = cloudinaryConfig.isConfigured();

    if (this.isConfigured) {
      cloudinary.config({
        cloud_name: cloudinaryConfig.cloudName,
        api_key: cloudinaryConfig.apiKey,
        api_secret: cloudinaryConfig.apiSecret,
      });
      this.logger.log('[CLOUDINARY] Servicio inicializado con credenciales reales');
    } else {
      this.logger.warn(
        '[CLOUDINARY] Credenciales no configuradas — modo stub activo',
      );
    }
  }

  async upload(
    file: Express.Multer.File,
    cedula: string,
  ): Promise<{ url: string; publicId: string }> {
    if (!this.isConfigured) {
      return this.stubUpload(file, cedula);
    }

    try {
      const b64 = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

      const result = await cloudinary.uploader.upload(b64, {
        folder: `sorteos/facturas/${cedula}`,
        resource_type: 'image',
        ocr: 'adv_ocr',
      });

      this.logger.log(
        `[CLOUDINARY] Upload exitoso para cédula ${cedula}: ${result.public_id}`,
      );

      return { url: result.secure_url, publicId: result.public_id };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`[CLOUDINARY] Error en upload: ${message}`);
      throw new BadRequestException('Error al procesar la imagen');
    }
  }

  async getOcrData(publicId: string): Promise<OcrData | null> {
    if (!this.isConfigured) {
      this.logger.debug('[CLOUDINARY] Stub: getOcrData retorna null');
      return null;
    }

    try {
      const resource = await cloudinary.api.resource(publicId, {
        pages: true,
        exif: false,
      });

      const ocrRaw = resource?.info?.ocr?.adv_ocr;
      if (!ocrRaw) {
        this.logger.warn(`[CLOUDINARY] OCR no disponible para: ${publicId}`);
        return null;
      }

      const fullText: string = ocrRaw.data?.[0]?.fullTextAnnotation?.text ?? '';

      return {
        numero_factura: null,
        fecha: null,
        monto: null,
        confidence: ocrRaw.data?.[0]?.fullTextAnnotation?.pages?.[0]?.confidence ?? 0,
        raw_text: fullText,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`[CLOUDINARY] No se pudo obtener OCR: ${message}`);
      return null;
    }
  }

  private stubUpload(
    file: Express.Multer.File,
    cedula: string,
  ): { url: string; publicId: string } {
    const timestamp = Date.now();
    const ext = file.mimetype.split('/')[1] ?? 'jpg';
    const publicId = `sorteos/facturas/${cedula}/stub_${timestamp}`;
    const url = `http://localhost:3000/stub-uploads/${cedula}/${timestamp}.${ext}`;

    this.logger.debug(
      `[CLOUDINARY] Stub upload para cédula ${cedula} — tamaño: ${file.size} bytes`,
    );

    return { url, publicId };
  }
}
