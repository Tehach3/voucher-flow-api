import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddFotoEstadoToTickets1711200000000 implements MigrationInterface {
  name = 'AddFotoEstadoToTickets1711200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tickets
        ADD COLUMN IF NOT EXISTS foto_estado VARCHAR(20) NOT NULL DEFAULT 'completada'
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_tickets_foto_estado_procesando
        ON tickets (participante_id, evento_id, numero_ticket)
        WHERE foto_estado = 'procesando'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_tickets_foto_estado_procesando`);
    await queryRunner.query(`ALTER TABLE tickets DROP COLUMN IF EXISTS foto_estado`);
  }
}
