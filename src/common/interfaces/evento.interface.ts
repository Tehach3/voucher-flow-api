import { EstadoEvento } from '../../modules/eventos/entities/evento.entity';

export interface IEvento {
  id: number;
  nombre: string;
  descripcion: string | null;
  estado: EstadoEvento;
  fecha_inicio: Date;
  fecha_vencimiento: Date;
  fecha_cierre: Date | null;
  require_validacion_cupones: boolean;
  cupones_minimos: number | null;
  skus_validos: string[];
  activo: boolean;
  imagen_url: string | null;
  premio_descripcion: string | null;
  fecha_registro: Date;
  fecha_actualizacion: Date;
}

export interface IEventoPublico {
  id: number;
  nombre: string;
  descripcion: string | null;
  estado: EstadoEvento;
  fecha_inicio: Date;
  fecha_vencimiento: Date;
  skus_validos: string[];
  imagen_url: string | null;
  premio_descripcion: string | null;
}

export interface EventosPaginados {
  data: IEventoPublico[];
  total: number;
  page: number;
  limit: number;
}
