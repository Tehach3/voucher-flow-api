-- =============================================================================
--  voucher-flow-api — Limpieza de datos generados por pruebas de estrés
--
--  Las cédulas de prueba van de 1000000 a 1000499 (500 participantes sintéticos
--  definidos en el script k6). Son inconfundibles con cédulas reales.
--
--  Ejecutar en el SQL Editor de Neon o con psql.
--  Si querés ver qué se va a borrar antes de confirmar, ejecuta primero el
--  bloque "DRY RUN" y luego el bloque "BORRADO REAL".
-- =============================================================================

-- ── DRY RUN — ejecutar primero para confirmar los conteos ────────────────────

SELECT 'participantes_test'      AS tabla, COUNT(*) AS filas FROM participantes
  WHERE cedula BETWEEN '1000000' AND '1000499'
UNION ALL
SELECT 'participaciones_evento'  AS tabla, COUNT(*) AS filas FROM participaciones_evento
  WHERE participante_id IN (SELECT id FROM participantes WHERE cedula BETWEEN '1000000' AND '1000499')
UNION ALL
SELECT 'tickets'                 AS tabla, COUNT(*) AS filas FROM tickets
  WHERE participante_id IN (SELECT id FROM participantes WHERE cedula BETWEEN '1000000' AND '1000499')
UNION ALL
SELECT 'tickets_pendientes'      AS tabla, COUNT(*) AS filas FROM tickets_pendientes
  WHERE datos_formulario->>'cedula' BETWEEN '1000000' AND '1000499'
UNION ALL
SELECT 'auditoria'               AS tabla, COUNT(*) AS filas FROM auditoria
  WHERE entidad = 'participantes'
    AND entidad_id IN (SELECT id FROM participantes WHERE cedula BETWEEN '1000000' AND '1000499');

-- ── BORRADO REAL — ejecutar solo si los conteos son los esperados ─────────────

BEGIN;

-- 1. tickets_pendientes — no tiene FK, hay que borrar primero
DELETE FROM tickets_pendientes
  WHERE datos_formulario->>'cedula' BETWEEN '1000000' AND '1000499';

-- 2. auditoria — referencias sueltas sin FK
DELETE FROM auditoria
  WHERE entidad = 'participantes'
    AND entidad_id IN (SELECT id FROM participantes WHERE cedula BETWEEN '1000000' AND '1000499');

-- 3. participantes — CASCADE borra tickets + participaciones_evento automáticamente
DELETE FROM participantes
  WHERE cedula BETWEEN '1000000' AND '1000499';

-- Verificar que quedó limpio
SELECT 'participantes_restantes' AS check, COUNT(*) AS filas FROM participantes
  WHERE cedula BETWEEN '1000000' AND '1000499'
UNION ALL
SELECT 'tickets_restantes',      COUNT(*) FROM tickets
  WHERE participante_id IN (SELECT id FROM participantes WHERE cedula BETWEEN '1000000' AND '1000499')
UNION ALL
SELECT 'pendientes_restantes',   COUNT(*) FROM tickets_pendientes
  WHERE datos_formulario->>'cedula' BETWEEN '1000000' AND '1000499';

COMMIT;
