export interface IUsuario {
  id: number;
  cedula: string;
  nombre: string;
  celular: string | null;
  ciudad: string | null;
  cupones_acumulados: number;
  fecha_registro: Date;
  fecha_actualizacion: Date;
}

export interface IUsuarioPublico {
  cedula: string;
  nombre: string;
  celular: string | null;
  ciudad: string | null;
  cupones_acumulados: number;
}
