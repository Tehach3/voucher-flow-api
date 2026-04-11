-- ============================================================================
-- MIGRACIÓN: eventos v2
-- Cambios: condiciones de cupones, premios múltiples, eliminar skus_validos
-- Base de datos: voucher-flow-db (Neon)
-- Aplicar en: https://console.neon.tech → SQL Editor
-- ============================================================================

BEGIN;

-- 1. Agregar tiene_condiciones_multiples
ALTER TABLE eventos
  ADD COLUMN IF NOT EXISTS tiene_condiciones_multiples BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Agregar condiciones_cupones
--    JSONB: [{sku, cuponesPorUnidad}]
--    - 1 elemento  → tieneCondicionesMultiples = false (única condición)
--    - 2+ elementos → tieneCondicionesMultiples = true  (múltiples condiciones por SKU)
ALTER TABLE eventos
  ADD COLUMN IF NOT EXISTS condiciones_cupones JSONB;

-- 3. Agregar premios — reemplaza premio_descripcion
--    JSONB: [{descripcion, orden}]
ALTER TABLE eventos
  ADD COLUMN IF NOT EXISTS premios JSONB;

-- 4. Migrar dato existente: premio_descripcion → premios JSONB
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'eventos' AND column_name = 'premio_descripcion'
  ) THEN
    UPDATE eventos
    SET premios = jsonb_build_array(
      jsonb_build_object('descripcion', premio_descripcion, 'orden', 1)
    )
    WHERE premio_descripcion IS NOT NULL AND premios IS NULL;
  END IF;
END $$;

-- 5. Eliminar premio_descripcion (dato migrado a premios)
ALTER TABLE eventos
  DROP COLUMN IF EXISTS premio_descripcion;

-- 6. Eliminar skus_validos
--    Los SKUs válidos se derivan de condiciones_cupones.sku, no se almacenan por separado
ALTER TABLE eventos
  DROP COLUMN IF EXISTS skus_validos;

-- 7. cupones_minimos: rellenar NULLs y aplicar NOT NULL
UPDATE eventos SET cupones_minimos = 1 WHERE cupones_minimos IS NULL;

ALTER TABLE eventos
  ALTER COLUMN cupones_minimos SET NOT NULL,
  ALTER COLUMN cupones_minimos SET DEFAULT 1;

-- 8. require_validacion_cupones siempre TRUE
UPDATE eventos SET require_validacion_cupones = TRUE WHERE require_validacion_cupones = FALSE;

ALTER TABLE eventos
  ALTER COLUMN require_validacion_cupones SET DEFAULT TRUE;

-- 9. Comentarios
COMMENT ON COLUMN eventos.tiene_condiciones_multiples IS
  'true = múltiples condiciones por SKU (condicionesCupones con 2+ elementos). false = única condición (condicionesCupones con 0 o 1 elemento, genera siempre bajo la misma regla).';

COMMENT ON COLUMN eventos.condiciones_cupones IS
  'Array JSONB de condiciones: [{sku, cuponesPorUnidad}]. Ej: [{"sku":"5kg","cuponesPorUnidad":15}]. Los SKUs del evento se derivan de este campo.';

COMMENT ON COLUMN eventos.premios IS
  'Array JSONB de premios: [{descripcion, orden}]. Permite múltiples premios por campaña.';

COMMENT ON COLUMN eventos.cupones_minimos IS
  'Mínimo de cupones requeridos para participar (obligatorio, mínimo 1).';

-- 10. Actualizar vista vista_eventos_activos
CREATE OR REPLACE VIEW vista_eventos_activos AS
SELECT id, nombre, descripcion, estado, fecha_inicio, fecha_vencimiento,
       cupones_minimos, tiene_condiciones_multiples, condiciones_cupones,
       premios, fecha_registro
FROM eventos
WHERE activo = TRUE AND estado IN ('abierto', 'pausado')
ORDER BY fecha_vencimiento ASC;

COMMIT;

-- ============================================================================
-- VERIFICACIÓN (ejecutar por separado)
-- ============================================================================
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'eventos'
-- ORDER BY ordinal_position;
