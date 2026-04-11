import { EstadoEvento, CondicionCupon, Premio } from '../../modules/eventos/entities/evento.entity';

export interface IEvento {
  id: number;
  nombre: string;
  descripcion: string | null;
  estado: EstadoEvento;
  fechaInicio: Date;
  fechaVencimiento: Date;
  fechaCierre: Date | null;
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
  fechaInicio: Date;
  fechaVencimiento: Date;
  cuponesMinimos: number;
  tieneCondicionesMultiples: boolean;
  condicionesCupones: CondicionCupon[] | null;
  premios: Premio[] | null;
  imagenUrl: string | null;
}

export interface EventosPaginados {
  data: IEventoPublico[];
  total: number;
  page: number;
  limit: number;
}
