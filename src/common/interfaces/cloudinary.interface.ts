import { OcrData } from '../../modules/facturas/entities/factura.entity';

export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  resource_type: string;
  format: string;
  bytes: number;
}

export interface ICloudinaryService {
  upload(file: Express.Multer.File, cedula: string): Promise<string>;
  getOcrData(publicId: string): Promise<OcrData | null>;
}
