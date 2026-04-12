import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/** Datos del formulario tal como los envió el cliente (sin la imagen — se almacena en foto_buffer_b64 o foto_url) */
export interface DatosFormulario {
  cedula: string;
  nombre?: string;
  celular?: string;
  ciudad?: string;
  email?: string;
  eventoId: number;
  numeroTicket: string;
  local: string;
  multiplicador: boolean;
  coeficienteMultiplicador?: number;
  productos: Array<{ sku: string; cantidad: number }>;
}

export type EtapaError = 'upload_imagen' | 'escritura_db';
export type EstadoPendiente = 'pendiente' | 'procesando' | 'completado' | 'fallido_permanente';

export const MAX_INTENTOS = 5;

@Entity('tickets_pendientes')
@Index(['estado', 'fechaRegistro'])
export class TicketPendienteEntity {
  @PrimaryGeneratedColumn()
  id: number;

  /** Datos del formulario originales, para reconstruir el request en el reintento */
  @Column({ name: 'datos_formulario', type: 'jsonb' })
  datosFormulario: DatosFormulario;

  /**
   * URL de Cloudinary — presente cuando la imagen YA fue subida pero
   * la transacción de DB falló. Permite reintentar sin re-subir la imagen.
   */
  @Column({ name: 'foto_url', type: 'varchar', length: 500, nullable: true })
  fotoUrl: string | null;

  /**
   * Imagen en base64 — presente cuando Cloudinary falló.
   * Se usa para reintentar el upload. Se limpia una vez el upload sea exitoso.
   */
  @Column({ name: 'foto_buffer_b64', type: 'text', nullable: true })
  fotoBufferB64: string | null;

  @Column({ name: 'foto_mimetype', type: 'varchar', length: 50, nullable: true })
  fotoMimetype: string | null;

  @Column({
    name: 'estado',
    type: 'varchar',
    length: 20,
    default: 'pendiente',
  })
  estado: EstadoPendiente;

  /** Etapa donde ocurrió el fallo para guiar la estrategia de reintento */
  @Column({ name: 'etapa_error', type: 'varchar', length: 20 })
  etapaError: EtapaError;

  @Column({ name: 'mensaje_error', type: 'text', nullable: true })
  mensajeError: string | null;

  @Column({ name: 'intentos', type: 'integer', default: 0 })
  intentos: number;

  @CreateDateColumn({ name: 'fecha_registro', type: 'timestamptz' })
  fechaRegistro: Date;

  @Column({ name: 'fecha_ultimo_intento', type: 'timestamptz', nullable: true })
  fechaUltimoIntento: Date | null;
}
