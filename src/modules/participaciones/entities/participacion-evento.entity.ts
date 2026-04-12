import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { ParticipanteEntity } from '../../participantes/entities/participante.entity';
import { EventoEntity } from '../../eventos/entities/evento.entity';

@Entity('participaciones_evento')
@Index(['participanteId', 'eventoId'], { unique: true })
export class ParticipacionEventoEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'participante_id', type: 'integer' })
  participanteId: number;

  @Column({ name: 'evento_id', type: 'integer' })
  eventoId: number;

  @ManyToOne(() => ParticipanteEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'participante_id' })
  participante: ParticipanteEntity;

  @ManyToOne(() => EventoEntity, (evento) => evento.participaciones, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'evento_id' })
  evento: EventoEntity;

  @Column({ name: 'cupones_acumulados', type: 'integer', default: 0 })
  cuponesAcumulados: number;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'fecha_registro', type: 'timestamptz' })
  fechaRegistro: Date;

  @Column({ name: 'fecha_actualizacion', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  fechaActualizacion: Date;

  @OneToMany('FacturaEntity', 'participacion')
  facturas: import('../../facturas/entities/factura.entity').FacturaEntity[];
}
