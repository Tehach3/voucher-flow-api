import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBonusToTickets1711100000000 implements MigrationInterface {
  name = 'AddBonusToTickets1711100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE tickets
      ADD COLUMN IF NOT EXISTS bonus INTEGER NULL
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN tickets.bonus IS
        'Cupones bonus adicionales para esta participación. Solo se almacena en la primera fila por registro; el resto es NULL.'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE tickets DROP COLUMN IF EXISTS bonus`);
  }
}
