import { OcrData } from '../../modules/facturas/entities/factura.entity';

export interface IFactura {
  id: number;
  usuario_id: number;
  evento_id: number;
  participacion_id: number;
  numero_factura: string;
  sku: string;
  cantidad: number;
  cupones_generados: number;
  foto_url: string;
  ocr_data: OcrData | null;
  activo: boolean;
  fecha_carga: Date;
}

export interface CargarFacturaResponse {
  success: boolean;
  cedula: string;
  evento_id: number;
  cupones_generados: number;
  cupones_totales: number;
  foto_url: string;
  numero_factura: string;
}

export interface CuponesResponse {
  cedula: string;
  evento_id: number;
  cupones_acumulados: number;
  total_facturas: number;
  facturas: IFactura[];
}
