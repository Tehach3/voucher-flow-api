import { EstadoEvento, CondicionCupon, Premio } from '../../modules/eventos/entities/evento.entity';

export type DisponibilidadEvento = 'disponible' | 'noIniciado' | 'vencido';

export interface IEvento {
  id: number;
  nombre: string;
  descripcion: string | null;
  estado: EstadoEvento;
  fechaInicio: Date;
  fechaCierre: Date;
  requireValidacionCupones: boolean;
  cuponesMinimos: number;
  tieneCondicionesMultiples: boolean;
  condicionesCupones: CondicionCupon[] | null;
  premios: Premio[] | null;
  activo: boolean;
  imagenUrl: string | null;
  fechaRegistro: Date;
  fechaActualizacion: Date;
}

export interface IEventoPublico {
  id: number;
  nombre: string;
  descripcion: string | null;
  estado: EstadoEvento;
  disponibilidad: DisponibilidadEvento;
  fechaInicio: Date;
  fechaCierre: Date;
  cuponesMinimos: number;
  tieneCondicionesMultiples: boolean;
  condicionesCupones: CondicionCupon[] | null;
  premios: Premio[] | null;
  imagenUrl: string | null;
}

export interface IEventoCreado {
  mensaje: string;
  nombre: string;
  fechaInicio: Date;
  fechaCierre: Date;
  imagenUrl: string | null;
  fechaRegistro: Date;
}

export interface EventosPaginados {
  data: IEventoPublico[];
  total: number;
  page: number;
  limit: number;
}
