import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1700000000000 implements MigrationInterface {
  name = 'InitialSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {

    // ── Extensiones ──────────────────────────────────────────────────────────
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // ── eventos ──────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS eventos (
        id                          SERIAL        PRIMARY KEY,
        nombre                      VARCHAR(255)  NOT NULL,
        descripcion                 TEXT,
        estado                      VARCHAR(20)   NOT NULL  DEFAULT 'abierto',
        fecha_inicio                TIMESTAMPTZ   NOT NULL,
        fecha_vencimiento           TIMESTAMPTZ   NOT NULL,
        require_validacion_cupones  BOOLEAN       NOT NULL  DEFAULT TRUE,
        cupones_minimos             INTEGER       NOT NULL  DEFAULT 1,
        tiene_condiciones_multiples BOOLEAN       NOT NULL  DEFAULT FALSE,
        condiciones_cupones         JSONB,
        premios                     JSONB,
        activo                      BOOLEAN       NOT NULL  DEFAULT TRUE,
        fecha_registro              TIMESTAMPTZ   NOT NULL  DEFAULT NOW(),
        fecha_actualizacion         TIMESTAMPTZ   NOT NULL  DEFAULT NOW(),
        imagen_url                  VARCHAR(500)
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_eventos_activo            ON eventos (activo)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_eventos_fecha_inicio      ON eventos (fecha_inicio DESC)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_eventos_fecha_vencimiento ON eventos (fecha_vencimiento DESC)`);

    // ── participantes ────────────────────────────────────────────────────────
    // nombre/celular/email son TEXT para alojar el valor cifrado AES-256-GCM en base64
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS participantes (
        id                  SERIAL       PRIMARY KEY,
        cedula              VARCHAR(10)  NOT NULL  UNIQUE,
        nombre              TEXT         NOT NULL,
        celular             TEXT,
        ciudad              VARCHAR(100),
        email               TEXT,
        activo              BOOLEAN      NOT NULL  DEFAULT TRUE,
        fecha_registro      TIMESTAMPTZ  NOT NULL  DEFAULT NOW(),
        fecha_actualizacion TIMESTAMPTZ  NOT NULL  DEFAULT NOW()
      )
    `);

    // ── participaciones_evento ───────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS participaciones_evento (
        id                  SERIAL       PRIMARY KEY,
        participante_id     INTEGER      NOT NULL  REFERENCES participantes (id) ON DELETE CASCADE,
        evento_id           INTEGER      NOT NULL  REFERENCES eventos       (id) ON DELETE CASCADE,
        cupones_acumulados  INTEGER      NOT NULL  DEFAULT 0,
        activo              BOOLEAN      NOT NULL  DEFAULT TRUE,
        fecha_registro      TIMESTAMPTZ  NOT NULL  DEFAULT NOW(),
        fecha_actualizacion TIMESTAMPTZ  NOT NULL  DEFAULT NOW(),
        CONSTRAINT uq_participaciones_participante_evento UNIQUE (participante_id, evento_id)
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_participaciones_evento_id ON participaciones_evento (evento_id)`);

    // ── tickets ──────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tickets (
        id                        SERIAL       PRIMARY KEY,
        participante_id           INTEGER      NOT NULL  REFERENCES participantes         (id) ON DELETE CASCADE,
        evento_id                 INTEGER      NOT NULL  REFERENCES eventos               (id) ON DELETE CASCADE,
        participacion_id          INTEGER      NOT NULL  REFERENCES participaciones_evento (id) ON DELETE CASCADE,
        numero_ticket             VARCHAR(50)  NOT NULL,
        local                     VARCHAR(255) NOT NULL,
        multiplicador             BOOLEAN      NOT NULL  DEFAULT FALSE,
        coeficiente_multiplicador INTEGER,
        sku                       VARCHAR(10)  NOT NULL,
        cantidad                  INTEGER      NOT NULL,
        cupones_base              INTEGER      NOT NULL,
        cupones_generados         INTEGER      NOT NULL,
        bonus                     INTEGER,
        foto_url                  VARCHAR(500),
        foto_estado               VARCHAR(20)  NOT NULL  DEFAULT 'completada',
        foto_hash                 VARCHAR(64),
        ocr_data                  JSONB,
        fecha_carga               TIMESTAMPTZ  NOT NULL  DEFAULT NOW(),
        activo                    BOOLEAN      NOT NULL  DEFAULT TRUE,
        CONSTRAINT uq_tickets_evento_participante_numero_sku
          UNIQUE (evento_id, participante_id, numero_ticket, sku)
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tickets_participante_id      ON tickets (participante_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tickets_participacion_id     ON tickets (participacion_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tickets_participante_evento  ON tickets (participante_id, evento_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tickets_fecha_carga          ON tickets (fecha_carga DESC)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tickets_evento_activo_fecha  ON tickets (evento_id, activo, fecha_carga DESC)`);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_tickets_foto_estado_procesando
        ON tickets (participante_id, evento_id, numero_ticket)
        WHERE foto_estado = 'procesando'
    `);

    // ── tickets_pendientes ───────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tickets_pendientes (
        id                   SERIAL       PRIMARY KEY,
        datos_formulario     JSONB        NOT NULL,
        foto_url             VARCHAR(500),
        foto_buffer_b64      TEXT,
        foto_mimetype        VARCHAR(50),
        estado               VARCHAR(20)  NOT NULL  DEFAULT 'pendiente',
        etapa_error          VARCHAR(20)  NOT NULL,
        mensaje_error        TEXT,
        intentos             INTEGER      NOT NULL  DEFAULT 0,
        fecha_registro       TIMESTAMPTZ  NOT NULL  DEFAULT NOW(),
        fecha_ultimo_intento TIMESTAMPTZ
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tickets_pendientes_estado_fecha   ON tickets_pendientes (estado, fecha_registro)`);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_tickets_pendientes_estado_pendiente
        ON tickets_pendientes (fecha_registro)
        WHERE estado = 'pendiente'
    `);

    // ── auditoria ────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS auditoria (
        id               SERIAL       PRIMARY KEY,
        evento_tipo      VARCHAR(50)  NOT NULL,
        entidad          VARCHAR(50)  NOT NULL,
        entidad_id       INTEGER,
        usuario_id       INTEGER,
        ip_address       VARCHAR(45),
        datos_anteriores JSONB,
        datos_nuevos     JSONB,
        fecha_evento     TIMESTAMPTZ  NOT NULL  DEFAULT NOW()
      )
    `);

    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_auditoria_evento_tipo  ON auditoria (evento_tipo)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_auditoria_entidad      ON auditoria (entidad, entidad_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_auditoria_fecha_evento ON auditoria (fecha_evento DESC)`);

    // ── Función: actualizar fecha_actualizacion ───────────────────────────────
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION actualizar_fecha_actualizacion()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.fecha_actualizacion = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    await queryRunner.query(`
      CREATE OR REPLACE TRIGGER trigger_eventos_fecha_actualizacion
        BEFORE UPDATE ON eventos
        FOR EACH ROW EXECUTE FUNCTION actualizar_fecha_actualizacion()
    `);
    await queryRunner.query(`
      CREATE OR REPLACE TRIGGER trigger_participantes_fecha_actualizacion
        BEFORE UPDATE ON participantes
        FOR EACH ROW EXECUTE FUNCTION actualizar_fecha_actualizacion()
    `);
    await queryRunner.query(`
      CREATE OR REPLACE TRIGGER trigger_participaciones_fecha_actualizacion
        BEFORE UPDATE ON participaciones_evento
        FOR EACH ROW EXECUTE FUNCTION actualizar_fecha_actualizacion()
    `);

    // ── Función: acumular cupones al insertar ticket ─────────────────────────
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION actualizar_cupones_participacion()
      RETURNS TRIGGER AS $$
      BEGIN
        UPDATE participaciones_evento
           SET cupones_acumulados = cupones_acumulados + NEW.cupones_generados
         WHERE id = NEW.participacion_id;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    await queryRunner.query(`
      CREATE OR REPLACE TRIGGER trigger_tickets_actualizar_cupones
        AFTER INSERT ON tickets
        FOR EACH ROW EXECUTE FUNCTION actualizar_cupones_participacion()
    `);

    // ── Función: crear participación si no existe ────────────────────────────
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION crear_participacion_evento(
        p_participante_id INTEGER,
        p_evento_id       INTEGER
      )
      RETURNS VOID AS $$
      BEGIN
        INSERT INTO participaciones_evento (participante_id, evento_id)
        VALUES (p_participante_id, p_evento_id)
        ON CONFLICT (participante_id, evento_id) DO NOTHING;
      END;
      $$ LANGUAGE plpgsql
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP FUNCTION  IF EXISTS crear_participacion_evento(INTEGER, INTEGER)`);
    await queryRunner.query(`DROP TRIGGER   IF EXISTS trigger_tickets_actualizar_cupones         ON tickets`);
    await queryRunner.query(`DROP FUNCTION  IF EXISTS actualizar_cupones_participacion()`);
    await queryRunner.query(`DROP TRIGGER   IF EXISTS trigger_participaciones_fecha_actualizacion ON participaciones_evento`);
    await queryRunner.query(`DROP TRIGGER   IF EXISTS trigger_participantes_fecha_actualizacion   ON participantes`);
    await queryRunner.query(`DROP TRIGGER   IF EXISTS trigger_eventos_fecha_actualizacion         ON eventos`);
    await queryRunner.query(`DROP FUNCTION  IF EXISTS actualizar_fecha_actualizacion()`);
    await queryRunner.query(`DROP TABLE IF EXISTS auditoria             CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS tickets_pendientes    CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS tickets               CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS participaciones_evento CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS participantes         CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS eventos               CASCADE`);
  }
}
