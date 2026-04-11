import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';

export type EstadoEvento = 'abierto' | 'cerrado' | 'pausado' | 'finalizado';

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

  @Column({ type: 'varchar', length: 20, default: 'abierto' })
  estado: EstadoEvento;

  @Column({ name: 'fecha_inicio', type: 'timestamptz' })
  fechaInicio: Date;

  @Column({ name: 'fecha_vencimiento', type: 'timestamptz' })
  fechaVencimiento: Date;

  @Column({ name: 'fecha_cierre', type: 'timestamptz', nullable: true })
  fechaCierre: Date | null;

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
