import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { encryptionTransformer } from '../../../common/utils/crypto.utils';

@Entity('participantes')
@Index(['cedula'], { unique: true })
export class ParticipanteEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 10 })
  cedula: string;

  @Column({ type: 'text', transformer: encryptionTransformer })
  nombre: string;

  @Column({ type: 'text', nullable: true, transformer: encryptionTransformer })
  celular: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  ciudad: string | null;

  @Column({ type: 'text', nullable: true, transformer: encryptionTransformer })
  email: string | null;

  @Column({ type: 'boolean', default: true })
  activo: boolean;

  @CreateDateColumn({ name: 'fecha_registro', type: 'timestamptz' })
  fechaRegistro: Date;

  @Column({ name: 'fecha_actualizacion', type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  fechaActualizacion: Date;

  @OneToMany('ParticipacionEventoEntity', 'participante')
  participaciones: import('../../participaciones/entities/participacion-evento.entity').ParticipacionEventoEntity[];
}
