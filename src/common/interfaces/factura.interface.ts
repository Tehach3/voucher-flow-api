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
  cedula: string;
  nombre: string;
  eventoId: number;
  numeroTicket: string;
  local: string;
  multiplicadorAplicado: boolean;
  coeficienteAplicado: number;
  fotoUrl: string;
  productos: ProductoRegistrado[];
  cuponesGenerados: number;
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
  fotoUrl: string;
  fechaCarga: Date;
}

export interface CampanhaResumen {
  eventoId: number;
  nombre: string;
  cuponesAcumulados: number;
  facturas: FacturaCupon[];
}

export interface CuponesUsuarioResponse {
  cedula: string;
  nombre: string;
  campanhas: CampanhaResumen[];
}

export interface CuponesResponse {
  cedula: string;
  eventoId: number;
  cuponesAcumulados: number;
  totalFacturas: number;
  facturas: IFactura[];
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
  registro?: IRegistroParticipacionResponse;
  error?: string;
}

export interface ResultadoLoteReintento {
  procesados: number;
  exitosos: number;
  fallidos: number;
  resultados: ResultadoReintento[];
}

export interface TicketResumen {
  id: number;
  cedula: string;
  nombre: string;
  ciudad: string | null;
  eventoId: number;
  eventoNombre: string;
  numeroTicket: string;
  local: string;
  multiplicador: boolean;
  coeficienteMultiplicador: number | null;
  sku: string;
  cantidad: number;
  cuponesBase: number;
  cuponesGenerados: number;
  fotoUrl: string;
  fechaCarga: Date;
}

export interface TicketsPaginados {
  data: TicketResumen[];
  total: number;
  page: number;
  limit: number;
}
