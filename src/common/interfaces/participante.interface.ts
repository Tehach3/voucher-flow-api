export interface IParticipante {
  id: number;
  cedula: string;
  nombre: string;
  celular: string | null;
  ciudad: string | null;
  email: string | null;
  activo: boolean;
  fechaRegistro: Date;
  fechaActualizacion: Date;
}

export interface IParticipantePublico {
  ciudad: string | null;
}
