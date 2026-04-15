import { OcrData } from '../../modules/facturas/entities/factura.entity';

export interface IFactura {
  id: number;
  participanteId: number;
  eventoId: number;
  participacionId: number;
  numeroTicket: string;
  local: string;
  multiplicador: boolean;
  coeficienteMultiplicador: number | null;
  sku: string;
  cantidad: number;
  cuponesBase: number;
  cuponesGenerados: number;
  bonus: number | null;
  fotoUrl: string;
  ocrData: OcrData | null;
  activo: boolean;
  fechaCarga: Date;
}

export interface ProductoRegistrado {
  sku: string;
  cantidad: number;
  cuponesBase: number;
  coeficienteAplicado: number;
  cuponesGenerados: number;
}

export interface IRegistroParticipacionResponse {
  mensaje: string;
  esUsuarioNuevo: boolean;
  eventoId: number;
  numeroTicket: string;
  local: string;
  multiplicadorAplicado: boolean;
  coeficienteAplicado: number;
  fotoUrl: string;
  productos: ProductoRegistrado[];
  cuponesGenerados: number;
  bonus: number | null;
  cuponesEsteRegistro: number;
  cuponesAcumulados: number;
}

export interface FacturaCupon {
  id: number;
  numeroTicket: string;
  local: string;
  multiplicador: boolean;
  coeficienteMultiplicador: number | null;
  sku: string;
  cantidad: number;
  cuponesBase: number;
  cuponesGenerados: number;
  bonus: number | null;
  totalCuponesEstaFactura: number;
  fotoUrl: string;
  fechaCarga: Date;
}

export interface CampanhaResumen {
  eventoId: number;
  nombre: string;
  cuponesAcumulados: number;
  facturas: FacturaCupon[];
}

export interface CuponesUsuarioPaginados {
  campanhas: CampanhaResumen[];
  total: number;
  page: number;
  limit: number;
}

export interface CuponesResponse {
  eventoId: number;
  cuponesAcumulados: number;
  totalFacturas: number;
  facturas: FacturaCupon[];
  page: number;
  limit: number;
}

export interface ITicketPendiente {
  id: number;
  cedula: string;
  eventoId: number;
  numeroTicket: string;
  estado: string;
  etapaError: string;
  mensajeError: string | null;
  intentos: number;
  tieneImagen: boolean;
  fechaRegistro: Date;
  fechaUltimoIntento: Date | null;
}

export interface PendientesPaginados {
  data: ITicketPendiente[];
  total: number;
  page: number;
  limit: number;
}

export interface ResultadoReintento {
  pendienteId: number;
  exitoso: boolean;
  mensaje: string;
  etapaFallo?: 'validacion' | 'imagen_no_disponible' | 'upload_storage' | 'escritura_db';
  codigoError?: string;
  registro?: IRegistroParticipacionResponse;
  error?: string;
}

export interface ResultadoLoteReintento {
  procesados: number;
  exitosos: number;
  fallidos: number;
  resultados: ResultadoReintento[];
}

