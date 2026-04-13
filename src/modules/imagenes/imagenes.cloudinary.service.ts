import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { CloudinaryService } from '../../services/cloudinary.service';
import { OcrData } from '../facturas/entities/factura.entity';
import { ERROR_CODES } from '../../common/constants/error.constants';
import { AppException } from '../../common/exceptions/app.exception';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

@Injectable()
export class ImagenesCloudinaryService {
  private readonly logger = new Logger(ImagenesCloudinaryService.name);

  constructor(private readonly cloudinaryService: CloudinaryService) {}

  async uploadFacturaImagen(
    file: Express.Multer.File,
    cedula: string,
  ): Promise<{ url: string; publicId: string; ocrData: OcrData | null }> {
    this.validateFile(file);

    this.logger.log(
      `[IMAGENES_CLOUDINARY] Subiendo imagen para cédula: ${cedula} (${file.size} bytes)`,
    );

    const { url, publicId } = await this.cloudinaryService.upload(file, cedula);
    const ocrData = await this.cloudinaryService.getOcrData(publicId);

    return { url, publicId, ocrData };
  }

  private validateFile(file: Express.Multer.File): void {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw AppException.badRequest(ERROR_CODES.INVALID_FILE_TYPE, {
        tipoRecibido: file.mimetype,
      });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw AppException.badRequest(ERROR_CODES.FILE_TOO_LARGE, {
        tamanoRecibidoKb: Math.round(file.size / 1024),
        limiteKb: 5120,
      });
    }
  }
}
