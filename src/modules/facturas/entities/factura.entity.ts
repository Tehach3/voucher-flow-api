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

export interface OcrData {
  numero_factura: string | null;
  fecha: string | null;
  monto: string | null;
  confidence: number;
  raw_text?: string;
}

@Entity('facturas')
@Index(['usuario_id', 'numero_factura'], { unique: true })
export class FacturaEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  usuario_id: number;

  @ManyToOne(() => UsuarioEntity, (usuario) => usuario.facturas, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'usuario_id' })
  usuario: UsuarioEntity;

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
}
