import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';

@Entity('usuarios')
@Index(['cedula'], { unique: true })
export class UsuarioEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 8 })
  cedula: string;

  @Column({ type: 'varchar', length: 255 })
  nombre: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  celular: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  ciudad: string | null;

  @Column({ type: 'integer', default: 0 })
  cupones_acumulados: number;

  @CreateDateColumn({ type: 'timestamptz' })
  fecha_registro: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  fecha_actualizacion: Date;

  // Relación definida después de crear FacturaEntity
  @OneToMany('FacturaEntity', 'usuario')
  facturas: import('../../../modules/facturas/entities/factura.entity').FacturaEntity[];
}
