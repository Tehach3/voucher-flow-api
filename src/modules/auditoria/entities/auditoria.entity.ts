import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('auditoria')
export class AuditoriaEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'evento_tipo', type: 'varchar', length: 50 })
  eventoTipo: string;

  @Column({ type: 'varchar', length: 50 })
  entidad: string;

  @Column({ name: 'entidad_id', type: 'integer', nullable: true })
  entidadId: number | null;

  @Column({ name: 'usuario_id', type: 'integer', nullable: true })
  usuarioId: number | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress: string | null;

  @Column({ name: 'datos_anteriores', type: 'jsonb', nullable: true })
  datosAnteriores: Record<string, unknown> | null;

  @Column({ name: 'datos_nuevos', type: 'jsonb', nullable: true })
  datosNuevos: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'fecha_evento', type: 'timestamptz' })
  fechaEvento: Date;
}
