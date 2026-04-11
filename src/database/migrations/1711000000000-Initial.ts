import { MigrationInterface, QueryRunner } from 'typeorm';

export class Initial1711000000000 implements MigrationInterface {
  name = 'Initial1711000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Tabla usuarios
    await queryRunner.query(`
      CREATE TABLE "usuarios" (
        "id"                  SERIAL        NOT NULL,
        "cedula"              VARCHAR(8)    NOT NULL,
        "nombre"              VARCHAR(255)  NOT NULL,
        "celular"             VARCHAR(20),
        "ciudad"              VARCHAR(100),
        "cupones_acumulados"  INTEGER       NOT NULL DEFAULT 0,
        "fecha_registro"      TIMESTAMPTZ   NOT NULL DEFAULT now(),
        "fecha_actualizacion" TIMESTAMPTZ   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_usuarios" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_usuarios_cedula" ON "usuarios" ("cedula")
    `);

    // Tabla facturas
    await queryRunner.query(`
      CREATE TABLE "facturas" (
        "id"               SERIAL        NOT NULL,
        "usuario_id"       INTEGER       NOT NULL,
        "numero_factura"   VARCHAR(50)   NOT NULL,
        "sku"              VARCHAR(10)   NOT NULL,
        "cantidad"         INTEGER       NOT NULL,
        "cupones_generados" INTEGER      NOT NULL,
        "foto_url"         VARCHAR(500)  NOT NULL,
        "ocr_data"         JSONB,
        "fecha_carga"      TIMESTAMPTZ   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_facturas" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UQ_facturas_usuario_numero"
        ON "facturas" ("usuario_id", "numero_factura")
    `);

    await queryRunner.query(`
      ALTER TABLE "facturas"
        ADD CONSTRAINT "FK_facturas_usuario"
        FOREIGN KEY ("usuario_id")
        REFERENCES "usuarios" ("id")
        ON DELETE RESTRICT
    `);

    // Índice de búsqueda por usuario
    await queryRunner.query(`
      CREATE INDEX "IDX_facturas_usuario_id" ON "facturas" ("usuario_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "facturas" DROP CONSTRAINT "FK_facturas_usuario"`);
    await queryRunner.query(`DROP INDEX "IDX_facturas_usuario_id"`);
    await queryRunner.query(`DROP INDEX "UQ_facturas_usuario_numero"`);
    await queryRunner.query(`DROP TABLE "facturas"`);
    await queryRunner.query(`DROP INDEX "UQ_usuarios_cedula"`);
    await queryRunner.query(`DROP TABLE "usuarios"`);
  }
}
