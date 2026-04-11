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
import { UsuarioEntity } from '../../usuarios/entities/usuario.entity';
import { EventoEntity } from '../../eventos/entities/evento.entity';

@Entity('participaciones_evento')
@Index(['usuario_id', 'evento_id'], { unique: true })
export class ParticipacionEventoEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'integer' })
  usuario_id: number;

  @Column({ type: 'integer' })
  evento_id: number;

  @ManyToOne(() => UsuarioEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario: UsuarioEntity;

  @ManyToOne(() => EventoEntity, (evento) => evento.participaciones, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'evento_id' })
  evento: EventoEntity;

  @Column({ type: 'integer', default: 0 })
  cupones_acumulados: number;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  fecha_registro: Date;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  fecha_actualizacion: Date;

  @OneToMany('FacturaEntity', 'participacion')
  facturas: import('../../facturas/entities/factura.entity').FacturaEntity[];
}
