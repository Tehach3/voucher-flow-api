import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { UsuarioEntity } from '../../usuarios/entities/usuario.entity';
import { EventoEntity } from '../../eventos/entities/evento.entity';
import { ParticipacionEventoEntity } from '../../participaciones/entities/participacion-evento.entity';

export interface OcrData {
  numero_factura: string | null;
  fecha: string | null;
  monto: string | null;
  confidence: number;
  raw_text?: string;
}

@Entity('facturas')
@Index(['evento_id', 'usuario_id', 'numero_factura'], { unique: true })
export class FacturaEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  usuario_id: number;

  @Column({ type: 'integer' })
  evento_id: number;

  @Column({ type: 'integer' })
  participacion_id: number;

  @ManyToOne(() => UsuarioEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: UsuarioEntity;

  @ManyToOne(() => EventoEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'evento_id' })
  evento: EventoEntity;

  @ManyToOne(() => ParticipacionEventoEntity, (p) => p.facturas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'participacion_id' })
  participacion: ParticipacionEventoEntity;

  @Column({ type: 'varchar', length: 50 })
  numero_factura: string;

  @Column({ type: 'varchar', length: 10 })
  sku: string;

  @Column({ type: 'integer' })
  cantidad: number;

  @Column({ type: 'integer' })
  cupones_generados: number;

  @Column({ type: 'varchar', length: 500 })
  foto_url: string;

  @Column({ type: 'jsonb', nullable: true })
  ocr_data: OcrData | null;

  @CreateDateColumn({ type: 'timestamptz' })
  fecha_carga: Date;

  @Column({ type: 'boolean', default: true })
  activo: boolean;
}
