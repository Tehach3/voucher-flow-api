import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';

/** Estado interno almacenado en DB. Solo el cierre manual cambia este campo. */
export type EstadoEventoInterno = 'abierto' | 'cerrado';

/** Estado calculado dinámicamente según fechas + estado interno, expuesto en la API */
export type EstadoEvento = 'no_iniciado' | 'vigente' | 'vencido' | 'cerrado';

export interface CondicionCupon {
  sku: string;
  cuponesPorUnidad: number;
}

export interface Premio {
  descripcion: string;
  orden: number;
}

@Entity('eventos')
export class EventoEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  nombre: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string | null;

  /** Valor en DB: 'abierto' (por defecto) o 'cerrado' (cierre manual) */
  @Column({ name: 'estado', type: 'varchar', length: 20, default: 'abierto' })
  estadoInterno: EstadoEventoInterno;

  @Column({ name: 'fecha_inicio', type: 'timestamptz' })
  fechaInicio: Date;

  @Column({ name: 'fecha_vencimiento', type: 'timestamptz' })
  fechaCierre: Date;

  @Column({ name: 'require_validacion_cupones', type: 'boolean', default: true })
  requireValidacionCupones: boolean;

  @Column({ name: 'cupones_minimos', type: 'integer' })
  cuponesMinimos: number;

  @Column({ name: 'tiene_condiciones_multiples', type: 'boolean', default: false })
  tieneCondicionesMultiples: boolean;

  @Column({ name: 'condiciones_cupones', type: 'jsonb', nullable: true })
  condicionesCupones: CondicionCupon[] | null;

  @Column({ type: 'jsonb', nullable: true })
  premios: Premio[] | null;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'fecha_registro', type: 'timestamptz' })
  fechaRegistro: Date;

  @Column({ name: 'fecha_actualizacion', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  fechaActualizacion: Date;

  @Column({ name: 'imagen_url', type: 'varchar', length: 500, nullable: true })
  imagenUrl: string | null;

  @OneToMany('ParticipacionEventoEntity', 'evento')
  participaciones: import('../../participaciones/entities/participacion-evento.entity').ParticipacionEventoEntity[];
}
