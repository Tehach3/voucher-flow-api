-- ============================================================================
-- MIGRACIÓN: eventos v3
-- Cambio: eliminar columna fecha_cierre nullable (cierre manual)
-- La fecha de vencimiento (fecha_vencimiento) ya representa el cierre del evento.
-- Base de datos: voucher-flow-db (Neon)
-- Aplicar en: https://console.neon.tech → SQL Editor
-- PREREQUISITO: haber aplicado migration_eventos_v2.sql
-- ============================================================================

BEGIN;

ALTER TABLE eventos
  DROP COLUMN IF EXISTS fecha_cierre;

COMMIT;

-- VERIFICACIÓN
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'eventos' ORDER BY ordinal_position;
