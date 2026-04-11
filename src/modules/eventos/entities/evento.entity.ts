import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';

export type EstadoEvento = 'abierto' | 'cerrado' | 'pausado' | 'finalizado';

@Entity('eventos')
export class EventoEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 255 })
  nombre: string;

  @Column({ type: 'text', nullable: true })
  descripcion: string | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'abierto',
  })
  estado: EstadoEvento;

  @Column({ type: 'timestamptz' })
  fecha_inicio: Date;

  @Column({ type: 'timestamptz' })
  fecha_vencimiento: Date;

  @Column({ type: 'timestamptz', nullable: true })
  fecha_cierre: Date | null;

  @Column({ type: 'boolean', default: false })
  require_validacion_cupones: boolean;

  @Column({ type: 'integer', nullable: true })
  cupones_minimos: number | null;

  @Column({ type: 'varchar', array: true, default: "ARRAY['250g','500g','1kg','5kg']" })
  skus_validos: string[];

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  fecha_registro: Date;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  fecha_actualizacion: Date;

  @Column({ type: 'varchar', length: 500, nullable: true })
  imagen_url: string | null;

  @Column({ type: 'text', nullable: true })
  premio_descripcion: string | null;

  @OneToMany('ParticipacionEventoEntity', 'evento')
  participaciones: import('../../participaciones/entities/participacion-evento.entity').ParticipacionEventoEntity[];
}
