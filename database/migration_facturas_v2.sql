-- ============================================================================
-- MIGRACIÓN: facturas v2
-- Cambio: índice único de (evento_id, usuario_id, numero_factura)
--         → (evento_id, usuario_id, numero_factura, sku)
-- Razón: un mismo número de factura puede tener múltiples productos (SKUs distintos)
-- Base de datos: voucher-flow-db (Neon)
-- ============================================================================

BEGIN;

-- 1. Eliminar constraint único anterior
ALTER TABLE facturas
  DROP CONSTRAINT IF EXISTS facturas_evento_id_usuario_id_numero_factura_key;

-- 2. Eliminar índice anterior si existe con otro nombre
DROP INDEX IF EXISTS idx_facturas_unique_evento_usuario_factura;

-- 3. Crear nuevo índice único incluyendo sku
ALTER TABLE facturas
  ADD CONSTRAINT facturas_evento_usuario_factura_sku_key
  UNIQUE (evento_id, usuario_id, numero_factura, sku);

COMMIT;

-- VERIFICACIÓN
-- SELECT constraint_name, constraint_type
-- FROM information_schema.table_constraints
-- WHERE table_name = 'facturas';
