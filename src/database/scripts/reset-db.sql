-- ================================================================
-- reset-db.sql
-- Limpia toda la base de datos y reinicia los seriales.
-- Usar SOLO en entornos de desarrollo/pruebas.
-- ================================================================

BEGIN;

-- Deshabilitar triggers durante la limpieza para evitar errores
-- por FK o triggers de acumulación de cupones
SET session_replication_role = 'replica';

-- ── Vaciar tablas en orden (hijas primero) ────────────────────────
TRUNCATE TABLE auditoria             RESTART IDENTITY CASCADE;
TRUNCATE TABLE tickets_pendientes    RESTART IDENTITY CASCADE;
TRUNCATE TABLE tickets               RESTART IDENTITY CASCADE;
TRUNCATE TABLE participaciones_evento RESTART IDENTITY CASCADE;
TRUNCATE TABLE participantes         RESTART IDENTITY CASCADE;
TRUNCATE TABLE eventos               RESTART IDENTITY CASCADE;

-- Rehabilitar triggers
SET session_replication_role = 'DEFAULT';

-- ── Reiniciar seriales explícitamente (por si RESTART IDENTITY no alcanza) ──
ALTER SEQUENCE auditoria_id_seq              RESTART WITH 1;
ALTER SEQUENCE tickets_pendientes_id_seq     RESTART WITH 1;
ALTER SEQUENCE tickets_id_seq                RESTART WITH 1;
ALTER SEQUENCE participaciones_evento_id_seq RESTART WITH 1;
ALTER SEQUENCE participantes_id_seq          RESTART WITH 1;
ALTER SEQUENCE eventos_id_seq                RESTART WITH 1;

COMMIT;

-- Verificación: muestra el conteo de cada tabla
SELECT 'auditoria'              AS tabla, COUNT(*) AS filas FROM auditoria
UNION ALL
SELECT 'tickets_pendientes',              COUNT(*) FROM tickets_pendientes
UNION ALL
SELECT 'tickets',                         COUNT(*) FROM tickets
UNION ALL
SELECT 'participaciones_evento',          COUNT(*) FROM participaciones_evento
UNION ALL
SELECT 'participantes',                   COUNT(*) FROM participantes
UNION ALL
SELECT 'eventos',                         COUNT(*) FROM eventos
ORDER BY tabla;
