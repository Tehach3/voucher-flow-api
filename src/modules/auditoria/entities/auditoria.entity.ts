import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('auditoria')
export class AuditoriaEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 50 })
  evento_tipo: string;

  @Column({ type: 'varchar', length: 50 })
  entidad: string;

  @Column({ type: 'integer', nullable: true })
  entidad_id: number | null;

  @Column({ type: 'integer', nullable: true })
  usuario_id: number | null;

  @Column({ type: 'varchar', length: 45, nullable: true })
  ip_address: string | null;

  @Column({ type: 'jsonb', nullable: true })
  datos_anteriores: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  datos_nuevos: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  fecha_evento: Date;
}
