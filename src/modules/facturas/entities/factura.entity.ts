import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ParticipanteEntity } from '../../participantes/entities/participante.entity';
import { EventoEntity } from '../../eventos/entities/evento.entity';
import { ParticipacionEventoEntity } from '../../participaciones/entities/participacion-evento.entity';

export interface OcrData {
  numeroTicket: string | null;
  fecha: string | null;
  monto: string | null;
  confidence: number;
  rawText?: string;
}

@Entity('tickets')
@Index(['eventoId', 'participanteId', 'numeroTicket', 'sku'], { unique: true })
export class FacturaEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'participante_id', type: 'integer' })
  participanteId: number;

  @Column({ name: 'evento_id', type: 'integer' })
  eventoId: number;

  @Column({ name: 'participacion_id', type: 'integer' })
  participacionId: number;

  @ManyToOne(() => ParticipanteEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'participante_id' })
  participante: ParticipanteEntity;

  @ManyToOne(() => EventoEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'evento_id' })
  evento: EventoEntity;

  @ManyToOne(() => ParticipacionEventoEntity, (p) => p.facturas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'participacion_id' })
  participacion: ParticipacionEventoEntity;

  @Column({ name: 'numero_ticket', type: 'varchar', length: 50 })
  numeroTicket: string;

  @Column({ type: 'varchar', length: 255 })
  local: string;

  @Column({ type: 'boolean', default: false })
  multiplicador: boolean;

  @Column({ name: 'coeficiente_multiplicador', type: 'integer', nullable: true })
  coeficienteMultiplicador: number | null;

  @Column({ type: 'varchar', length: 10 })
  sku: string;

  @Column({ type: 'integer' })
  cantidad: number;

  @Column({ name: 'cupones_base', type: 'integer' })
  cuponesBase: number;

  @Column({ name: 'cupones_generados', type: 'integer' })
  cuponesGenerados: number;

  @Column({ name: 'foto_url', type: 'varchar', length: 500 })
  fotoUrl: string;

  /** SHA-256 del contenido base64 de la imagen. Nullable: se llena solo cuando SECURITY_IMAGE_HASH_ENABLED=true */
  @Column({ name: 'foto_hash', type: 'varchar', length: 64, nullable: true })
  fotoHash: string | null;

  @Column({ name: 'ocr_data', type: 'jsonb', nullable: true })
  ocrData: OcrData | null;

  @CreateDateColumn({ name: 'fecha_carga', type: 'timestamptz' })
  fechaCarga: Date;

  @Column({ type: 'boolean', default: true })
  activo: boolean;
}
