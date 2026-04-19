#!/usr/bin/env bash
# =============================================================================
#  voucher-flow-api — Limpieza de datos de pruebas de estrés
#
#  Elimina todos los participantes sintéticos (cédulas 1000000–1000499) y en
#  cascada sus tickets, participaciones y pendientes. La BD queda como si las
#  pruebas nunca hubieran existido.
#
#  Uso:
#    bash stress-test/cleanup-stress-data.sh            # interactivo
#    bash stress-test/cleanup-stress-data.sh --dry-run  # solo muestra conteos
#    bash stress-test/cleanup-stress-data.sh --force    # sin confirmación
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env.test"

# ── Colores ────────────────────────────────────────────────────────��──────────
RED=$'\033[0;31m';  GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'
CYAN=$'\033[0;36m'; BOLD=$'\033[1m';     RESET=$'\033[0m'

ok()   { echo -e "${GREEN}  ✔  ${RESET}$*"; }
warn() { echo -e "${YELLOW}  ⚠  ${RESET}$*"; }
err()  { echo -e "${RED}  ✖  ${RESET}$*"; }
info() { echo -e "${CYAN}  ▸  ${RESET}$*"; }
hdr()  { echo -e "\n${BOLD}${CYAN}══ $* ══${RESET}"; }

DRY_RUN=false
FORCE=false
for arg in "$@"; do
  [[ "$arg" == "--dry-run" ]] && DRY_RUN=true
  [[ "$arg" == "--force"   ]] && FORCE=true
done

# ── Banner ───────────────────────────────────────────────────────────────────��
echo -e "${BOLD}"
echo "  ╔══════════════════════════════════════════════════╗"
echo "  ║     voucher-flow-api — Limpieza post-test        ║"
echo "  ╚══════════════════════════════════════════════════╝"
echo -e "${RESET}"

# ── Leer DATABASE_URL ─────────────────────────────────────────────────────────
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  DB_URL=$(grep -v '^\s*#' "$ENV_FILE" | grep 'DATABASE_URL' | cut -d'=' -f2- | tr -d '"' | tr -d "'")
fi

# Si no estaba en .env.test, intentar con el .env principal del proyecto
if [[ -z "${DB_URL:-}" ]]; then
  ROOT_ENV="$SCRIPT_DIR/../.env"
  if [[ -f "$ROOT_ENV" ]]; then
    DB_URL=$(grep -v '^\s*#' "$ROOT_ENV" | grep 'DATABASE_URL' | cut -d'=' -f2- | tr -d '"' | tr -d "'")
  fi
fi

if [[ -z "${DB_URL:-}" ]]; then
  err "No se encontró DATABASE_URL."
  echo "   Agrega DATABASE_URL al archivo stress-test/.env.test o al .env del proyecto."
  exit 1
fi

# Enmascarar credenciales para mostrar en pantalla
DB_DISPLAY=$(echo "$DB_URL" | sed 's|://[^@]*@|://***:***@|')
ok "Conectando a: $DB_DISPLAY"

# ── Verificar psql ────────────────────────────────────────────────────────────
if ! command -v psql &>/dev/null; then
  err "psql no está instalado."
  echo "   Ubuntu/WSL:  sudo apt-get install -y postgresql-client"
  echo "   macOS:       brew install libpq && brew link libpq --force"
  echo ""
  warn "Alternativa: ejecuta stress-test/cleanup-stress-data.sql directamente en el SQL Editor de Neon."
  exit 1
fi

# ── DRY RUN: mostrar conteos ──────────────────────────────────────────────────
hdr "Datos de prueba en la BD"

DRY_SQL="
SELECT
  'participantes'       AS tabla,
  COUNT(*)              AS filas
FROM participantes
  WHERE cedula BETWEEN '1000000' AND '1000499'
UNION ALL
SELECT 'participaciones_evento', COUNT(*) FROM participaciones_evento
  WHERE participante_id IN (SELECT id FROM participantes WHERE cedula BETWEEN '1000000' AND '1000499')
UNION ALL
SELECT 'tickets', COUNT(*) FROM tickets
  WHERE participante_id IN (SELECT id FROM participantes WHERE cedula BETWEEN '1000000' AND '1000499')
UNION ALL
SELECT 'tickets_pendientes', COUNT(*) FROM tickets_pendientes
  WHERE datos_formulario->>'cedula' BETWEEN '1000000' AND '1000499'
UNION ALL
SELECT 'auditoria', COUNT(*) FROM auditoria
  WHERE entidad = 'participantes'
    AND entidad_id IN (SELECT id FROM participantes WHERE cedula BETWEEN '1000000' AND '1000499');
"

echo ""
COUNTS=$(psql "$DB_URL" -t -A -F'|' -c "$DRY_SQL" 2>&1) || {
  err "No se pudo conectar a la BD: $COUNTS"
  exit 1
}

TOTAL=0
while IFS='|' read -r tabla filas; do
  [[ -z "$tabla" ]] && continue
  printf "  %-30s %s filas\n" "$tabla" "$filas"
  TOTAL=$(( TOTAL + filas ))
done <<< "$COUNTS"

echo ""

if [[ $TOTAL -eq 0 ]]; then
  ok "La BD ya está limpia — no hay datos de prueba que eliminar."
  exit 0
fi

if $DRY_RUN; then
  warn "Modo dry-run — no se borró nada. Ejecuta sin --dry-run para limpiar."
  exit 0
fi

# ── Confirmación ──────────────────────────────────────────────────────────────
if ! $FORCE; then
  echo -e "  ${RED}${BOLD}Se van a eliminar $TOTAL filas de la BD.${RESET}"
  echo -e "  ${YELLOW}Esta operación no se puede deshacer.${RESET}"
  echo ""
  read -r -p "  ¿Confirmar limpieza? [s/N] " confirm
  if [[ ! "$confirm" =~ ^[sS]$ ]]; then
    warn "Operación cancelada."
    exit 0
  fi
fi

# ── Borrado ───────────────────────────────────────────────────────────────────
hdr "Ejecutando limpieza"

CLEANUP_SQL="
BEGIN;

DELETE FROM tickets_pendientes
  WHERE datos_formulario->>'cedula' BETWEEN '1000000' AND '1000499';

DELETE FROM auditoria
  WHERE entidad = 'participantes'
    AND entidad_id IN (
      SELECT id FROM participantes WHERE cedula BETWEEN '1000000' AND '1000499'
    );

DELETE FROM participantes
  WHERE cedula BETWEEN '1000000' AND '1000499';

COMMIT;
"

psql "$DB_URL" -c "$CLEANUP_SQL" > /dev/null 2>&1 && ok "Borrado ejecutado." || {
  err "El borrado falló. Revisa los permisos o ejecuta cleanup-stress-data.sql manualmente en Neon."
  exit 1
}

# ── Verificación post-borrado ─────────────────────────────────────────────────
REMAINING=$(psql "$DB_URL" -t -A -c \
  "SELECT COUNT(*) FROM participantes WHERE cedula BETWEEN '1000000' AND '1000499'" 2>/dev/null || echo "?")

if [[ "$REMAINING" == "0" ]]; then
  ok "Verificado — la BD quedó limpia."
else
  warn "Quedaron $REMAINING participantes de prueba. Verifica manualmente."
fi

echo ""
ok "${BOLD}Limpieza completada. La BD está como si las pruebas nunca hubieran existido.${RESET}"
echo ""
