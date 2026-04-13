import { Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { OcrData } from '../modules/facturas/entities/factura.entity';
import { cloudinaryConfig } from '../config/cloudinary.config';
import { testingConfig } from '../config/testing.config';
import { ERROR_CODES } from '../common/constants/error.constants';
import { AppException } from '../common/exceptions/app.exception';

@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private readonly isConfigured: boolean;

  private readonly isMock: boolean;

  constructor() {
    this.isMock = cloudinaryConfig.isMockMode();
    this.isConfigured = !this.isMock && cloudinaryConfig.isConfigured();

    if (this.isMock) {
      this.logger.warn('[CLOUDINARY] CLOUDINARY_MOCK=true — modo mock activo, todos los uploads devuelven respuesta simulada');
    } else if (this.isConfigured) {
      cloudinary.config({
        cloud_name: cloudinaryConfig.cloudName,
        api_key: cloudinaryConfig.apiKey,
        api_secret: cloudinaryConfig.apiSecret,
      });
      this.logger.log('[CLOUDINARY] Servicio inicializado con credenciales reales');
    } else {
      this.logger.warn('[CLOUDINARY] Credenciales no configuradas — modo stub activo');
    }
  }

  async upload(
    file: Express.Multer.File,
    cedula: string,
  ): Promise<{ url: string; publicId: string }> {
    const dataUri = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    return this.uploadDataUri(dataUri, cedula);
  }

  /**
   * Sube una imagen en formato Data URI base64 (data:image/jpeg;base64,...).
   * Usado por POST /api/tickets. La imagen se almacena en:
   *   sorteos/evento-{eventoId}/{numeroTicket}
   * Esto permite localizar cualquier comprobante directamente en Cloudinary
   * buscando por número de ticket dentro de la carpeta de la campaña.
   */
  async uploadBase64(
    dataUri: string,
    eventoId: number,
    numeroTicket: string,
  ): Promise<{ url: string; publicId: string }> {
    return this.uploadDataUri(dataUri, eventoId, numeroTicket);
  }

  private async uploadDataUri(
    dataUri: string,
    eventoIdOrCedula: number | string,
    numeroTicket?: string,
  ): Promise<{ url: string; publicId: string }> {
    if (testingConfig.forceCloudinaryError) {
      this.logger.warn('[CLOUDINARY] FORCE_CLOUDINARY_ERROR activo — simulando fallo de upload');
      throw new Error('[TEST] Forced Cloudinary upload failure (FORCE_CLOUDINARY_ERROR=true)');
    }

    if (this.isMock || !this.isConfigured) {
      return this.stubUploadDataUri(dataUri, eventoIdOrCedula, numeroTicket);
    }

    // Sanitizar el número de ticket para usarlo como public_id en Cloudinary
    const safeTicket = numeroTicket
      ? String(numeroTicket).replace(/[^a-zA-Z0-9\-_]/g, '_')
      : undefined;

    const folder = safeTicket
      ? `sorteos/evento-${eventoIdOrCedula}`
      : `sorteos/participantes/${eventoIdOrCedula}`;

    const uploadOptions: Record<string, unknown> = {
      folder,
      resource_type: 'image',
      ocr: 'adv_ocr',
    };

    if (safeTicket) {
      // public_id fijo: sorteos/evento-1/FAC-2026-00123
      // Permite recuperar la imagen directamente por número de ticket
      uploadOptions.public_id = safeTicket;
      uploadOptions.overwrite = false;
    }

    try {
      const result = await cloudinary.uploader.upload(dataUri, uploadOptions);

      this.logger.log(
        `[CLOUDINARY] Upload exitoso: ${result.public_id}`,
      );

      return { url: result.secure_url, publicId: result.public_id };
    } catch (error) {
      const message = this.extractErrorMessage(error);
      this.logger.error(`[CLOUDINARY] Error en upload: ${message}`);
      throw AppException.badRequest(ERROR_CODES.UPLOAD_FAILED, { detalle: message });
    }
  }

  async getOcrData(publicId: string): Promise<OcrData | null> {
    if (this.isMock || !this.isConfigured) {
      this.logger.debug('[CLOUDINARY] Stub/Mock: getOcrData retorna null');
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
        numeroTicket: null,
        fecha: null,
        monto: null,
        confidence: ocrRaw.data?.[0]?.fullTextAnnotation?.pages?.[0]?.confidence ?? 0,
        rawText: fullText,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`[CLOUDINARY] No se pudo obtener OCR: ${message}`);
      return null;
    }
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'object' && error !== null) {
      const e = error as Record<string, unknown>;
      // Cloudinary SDK errors have shape: { error: { message: string }, http_code: number }
      if (typeof e['error'] === 'object' && e['error'] !== null) {
        const inner = e['error'] as Record<string, unknown>;
        if (typeof inner['message'] === 'string') return `HTTP ${e['http_code'] ?? ''}: ${inner['message']}`;
      }
      if (typeof e['message'] === 'string') return e['message'];
      return JSON.stringify(error);
    }
    return String(error);
  }

  private stubUploadDataUri(
    dataUri: string,
    eventoIdOrCedula: number | string,
    numeroTicket?: string,
  ): { url: string; publicId: string } {
    const timestamp = Date.now();
    const mimeMatch = dataUri.match(/^data:image\/([a-z]+);base64,/);
    const ext = mimeMatch ? mimeMatch[1] : 'jpg';
    const safeTicket = numeroTicket
      ? String(numeroTicket).replace(/[^a-zA-Z0-9\-_]/g, '_')
      : `stub_${timestamp}`;

    const publicId = `sorteos/evento-${eventoIdOrCedula}/${safeTicket}`;
    const url = `http://localhost:3000/stub-uploads/evento-${eventoIdOrCedula}/${safeTicket}.${ext}`;
    const approxKb = Math.round((dataUri.length * 3) / 4 / 1024);

    this.logger.debug(
      `[CLOUDINARY] Stub upload — evento: ${eventoIdOrCedula}, ticket: ${numeroTicket} — tamaño aprox: ${approxKb} KB`,
    );

    return { url, publicId };
  }
}
