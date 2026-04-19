#!/usr/bin/env bash
# =============================================================================
#  voucher-flow-api — Test de estrés
#  Uso: bash stress-test/run-stress-test.sh
#
#  Parámetros: stress-test/.env.test  (copia stress-test/.env.test.example)
# =============================================================================
set -euo pipefail

# ════════════════════════════════════════════════════════════════════════════
#  CONFIGURACIÓN — leída desde stress-test/.env.test
# ════════════════════════════════════════════════════════════════════════════

# Resolver la ruta del directorio del script para que funcione desde cualquier CWD
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env.test"

if [[ ! -f "$ENV_FILE" ]]; then
  echo -e "\033[0;31m  ✖  No se encontró $ENV_FILE\033[0m"
  echo -e "     Crea el archivo copiando la plantilla:"
  echo -e "       cp stress-test/.env.test.example stress-test/.env.test"
  echo -e "     y rellena los valores reales."
  exit 1
fi

# Cargar variables (ignorar líneas vacías y comentarios)
set -o allexport
# shellcheck disable=SC1090
source <(grep -v '^\s*#' "$ENV_FILE" | grep -v '^\s*$')
set +o allexport

# Valores por defecto si no están en el .env.test
BASE_URL="${BASE_URL:-https://tu-app.railway.app}"
API_KEY="${API_KEY:-tu_api_key_aqui}"
EVENTO_ID="${EVENTO_ID:-1}"
HMAC_SECRET="${HMAC_SECRET:-}"
MODO="${MODO:-completo}"

# ════════════════════════════════════════════════════════════════════════════

# ── Colores ──────────────────────────────────────────────────────────────────
RED=$'\033[0;31m';  GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'
CYAN=$'\033[0;36m'; BOLD=$'\033[1m';     RESET=$'\033[0m'

ok()   { echo -e "${GREEN}  ✔  ${RESET}$*"; }
warn() { echo -e "${YELLOW}  ⚠  ${RESET}$*"; }
err()  { echo -e "${RED}  ✖  ${RESET}$*"; }
info() { echo -e "${CYAN}  ▸  ${RESET}$*"; }
hdr()  { echo -e "\n${BOLD}${CYAN}══ $* ══${RESET}"; }

# ── Banner ────────────────────────────────────────────────────────────────────
clear
echo -e "${BOLD}"
echo "  ╔══════════════════════════════════════════════════╗"
echo "  ║        voucher-flow-api — Test de Estrés         ║"
echo "  ╚══════════════════════════════════════════════════╝"
echo -e "${RESET}"

# ── Validar config mínima ────────────────────────────────────────────────────
hdr "Validando configuración"

if [[ "$BASE_URL" == "https://tu-app.railway.app" ]]; then
  err "Configura BASE_URL en stress-test/.env.test antes de continuar."
  exit 1
fi
if [[ "$API_KEY" == "tu_api_key_aqui" ]]; then
  err "Configura API_KEY en stress-test/.env.test antes de continuar."
  exit 1
fi

ok "BASE_URL  = $BASE_URL"
ok "EVENTO_ID = $EVENTO_ID"
ok "MODO      = $MODO"
[[ -n "$HMAC_SECRET" ]] && ok "HMAC      = configurado" || warn "HMAC      = desactivado (SECURITY_HMAC_ENABLED=false)"

# ── Checklist de env vars en el servidor ─────────────────────────────────────
hdr "Checklist env vars del servidor (requieren restart si las cambias)"

echo ""
echo -e "  ${BOLD}Variables que deben estar configuradas en el hosting:${RESET}"
echo ""
printf "  %-40s %s\n" "DATABASE_URL=<postgres-url>"       "← requerida"
printf "  %-40s %s\n" "API_KEY=$API_KEY"                   "← debe coincidir"
printf "  %-40s %s\n" "ENCRYPTION_KEY=<min 32 chars>"      "← requerida"
printf "  %-40s %s\n" "CLOUDINARY_MOCK=true"               "${YELLOW}← recomendado para el test (sin subir imágenes reales)${RESET}"
printf "  %-40s %s\n" "CLOUDINARY_OCR_ENABLED=false"       "← evita latencia extra"
printf "  %-40s %s\n" "SECURITY_HMAC_ENABLED=false"        "← o configura HMAC_SECRET arriba"
echo ""
printf "  %-40s %s\n" "RATE_LIMIT_MAX=50000"               "${RED}← CRÍTICO: sube este valor o el test fallará por rate limit${RESET}"
printf "  %-40s %s\n" "RATE_LIMIT_WINDOW_MS=60000"         "← ventana de 60 s"
echo ""

read -r -p "  ¿Ya ajustaste esas variables en el servidor? [s/N] " confirm
if [[ ! "$confirm" =~ ^[sS]$ ]]; then
  warn "Ajusta las variables en el hosting, haz restart y vuelve a correr el script."
  exit 0
fi

# ── Verificar conectividad al servidor ───────────────────────────────────────
hdr "Verificando conectividad"

info "GET $BASE_URL/api/health ..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  --max-time 10 \
  -H "x-api-key: $API_KEY" \
  "$BASE_URL/api/health" || echo "000")

if [[ "$HTTP_STATUS" == "200" ]]; then
  ok "Servidor responde correctamente (HTTP 200)"
elif [[ "$HTTP_STATUS" == "000" ]]; then
  err "No se pudo conectar a $BASE_URL — verifica la URL y que el servidor esté corriendo."
  exit 1
else
  warn "El servidor respondió HTTP $HTTP_STATUS — puede que el health check requiera api-key o que la URL sea incorrecta."
  read -r -p "  ¿Continuar de todos modos? [s/N] " fwd
  [[ ! "$fwd" =~ ^[sS]$ ]] && exit 0
fi

# ── Verificar o instalar k6 ───────────────────────────────────────────────────
hdr "Verificando k6"

if command -v k6 &>/dev/null; then
  K6_VER=$(k6 version 2>&1 | head -1)
  ok "k6 encontrado: $K6_VER"
else
  warn "k6 no está instalado."
  read -r -p "  ¿Instalar k6 ahora? (requiere sudo en Linux) [s/N] " install_k6
  if [[ ! "$install_k6" =~ ^[sS]$ ]]; then
    err "k6 es requerido. Instálalo desde https://k6.io/docs/get-started/installation/"
    exit 1
  fi

  info "Instalando k6..."
  if [[ "$(uname)" == "Darwin" ]]; then
    brew install k6
  elif grep -qi microsoft /proc/version 2>/dev/null || [[ "$(uname -r)" == *microsoft* ]] || [[ -f /etc/debian_version ]]; then
    # WSL / Debian / Ubuntu — repositorio oficial dl.k6.io
    sudo gpg -k
    sudo gpg --no-default-keyring \
      --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
      --keyserver hkp://keyserver.ubuntu.com:80 \
      --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
    echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
      | sudo tee /etc/apt/sources.list.d/k6.list
    sudo apt-get update && sudo apt-get install -y k6
  elif [[ -f /etc/redhat-release ]]; then
    sudo dnf install https://dl.k6.io/rpm/repo.rpm -y
    sudo dnf install k6 -y
  else
    err "No se pudo detectar el gestor de paquetes. Instala k6 manualmente: https://k6.io/docs/get-started/installation/"
    exit 1
  fi
  ok "k6 instalado: $(k6 version 2>&1 | head -1)"
fi

# ── Parámetros según modo ─────────────────────────────────────────────────────
hdr "Configurando escenario: $MODO"

if [[ "$MODO" == "rapido" ]]; then
  MAX_VUS=50
  RAMP_DURATION="20s"
  SUSTAINED_DURATION="1m"
  COOLDOWN_DURATION="10s"
  QUERY_VUS=10
  QUERY_START="30s"
  QUERY_DURATION="1m20s"
  info "Modo rápido: ~1.000 requests, 50 VUs, ~2 min"
else
  MAX_VUS=200
  RAMP_DURATION="90s"
  SUSTAINED_DURATION="3m"
  COOLDOWN_DURATION="60s"
  QUERY_VUS=30
  QUERY_START="1m"
  QUERY_DURATION="5m30s"
  info "Modo completo: ~10.000 requests, 200 VUs, ~6 min"
fi

# ── Escribir script k6 en archivo temporal ───────────────────────────────────
K6_TMPFILE=$(mktemp /tmp/voucher-stress-XXXXX.js)
trap 'rm -f "$K6_TMPFILE"' EXIT

cat > "$K6_TMPFILE" <<'EOFK6'
import http   from 'k6/http';
import crypto from 'k6/crypto';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ── Métricas ──────────────────────────────────────────────────────────────────
const ticketsOk    = new Counter('tickets_registrados');
const ticketsErr   = new Counter('tickets_fallidos');
const consultasErr = new Counter('consultas_fallidas');
const tasaRegistro = new Rate('tasa_exito_registro');
const tasaConsulta = new Rate('tasa_exito_consulta');
const durRegMs     = new Trend('duracion_registro_ms', true);
const durConMs     = new Trend('duracion_consulta_ms', true);

// ── Config (inyectada por el shell) ───────────────────────────────────────────
const BASE_URL    = __ENV.BASE_URL;
const API_KEY     = __ENV.API_KEY;
const EVENTO_ID   = parseInt(__ENV.EVENTO_ID, 10);
const HMAC_SECRET = __ENV.HMAC_SECRET || '';
const MAX_VUS     = parseInt(__ENV.MAX_VUS, 10);
const RAMP_DUR    = __ENV.RAMP_DURATION;
const SUS_DUR     = __ENV.SUSTAINED_DURATION;
const COOL_DUR    = __ENV.COOLDOWN_DURATION;
const Q_VUS       = parseInt(__ENV.QUERY_VUS, 10);
const Q_START     = __ENV.QUERY_START;
const Q_DUR       = __ENV.QUERY_DURATION;

// Prefijo único por ejecución para evitar colisiones de numeroTicket entre runs.
// k6 resetea __ITER a 0 en cada ejecución; sin este prefijo todos los tickets
// colisionarían con datos de runs anteriores y solo se obtendrían 409.
const RUN_ID = String(Date.now()).slice(-7);

// ── Imagen mínima 1×1 px JPEG ─────────────────────────────────────────────────
const FOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgH'
  + 'BwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/'
  + 'wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAA'
  + 'AAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8A'
  + 'JQAB/9k=';

// ── Datos sintéticos ──────────────────────────────────────────────────────────
const CEDULAS  = Array.from({ length: 500 }, (_, i) => String(1000000 + i));
const CIUDADES = ['Asuncion', 'Ciudad del Este', 'Encarnacion', 'Luque', 'San Lorenzo'];
const LOCALES  = ['Super 6 La Negrita', 'Mercado Central', 'Disco', 'Stock', 'BigValue',
                  'La Anonima', 'Shopping del Sol', 'Superseis', 'Punto Fijo', 'Tu Tienda'];
const SKUS     = ['250g', '500g', '1kg', '5kg'];
const NOMBRES  = ['Carlos Garcia', 'Maria Lopez', 'Juan Martinez', 'Ana Perez',
                  'Pedro Rodriguez', 'Sofia Sanchez', 'Luis Gomez', 'Laura Diaz'];

// ── Escenarios ────────────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    registro_tickets: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: RAMP_DUR,  target: MAX_VUS },
        { duration: SUS_DUR,   target: MAX_VUS },
        { duration: COOL_DUR,  target: 5       },
      ],
      env: { ESCENARIO: 'registro' },
      gracefulRampDown: '10s',
    },
    consulta_cupones: {
      executor:  'constant-vus',
      vus:       Q_VUS,
      duration:  Q_DUR,
      startTime: Q_START,
      env: { ESCENARIO: 'consulta' },
    },
  },
  thresholds: {
    'http_req_duration{escenario:registro}': ['p(95)<3000', 'p(99)<5000'],
    'http_req_duration{escenario:consulta}': ['p(95)<1500', 'p(99)<3000'],
    tasa_exito_registro: ['rate>0.95'],
    tasa_exito_consulta: ['rate>0.98'],
    http_req_failed:     ['rate<0.05'],
  },
};

// ── Entrypoint ────────────────────────────────────────────────────────────────
export default function () {
  __ENV.ESCENARIO === 'registro' ? doRegistro() : doConsulta();
}

// ── Registro de ticket ────────────────────────────────────────────────────────
function doRegistro() {
  // Distribución Pareto: 20% cédulas concentran 80% del tráfico
  const cedula = Math.random() < 0.2
    ? CEDULAS[Math.floor(Math.random() * 100)]
    : CEDULAS[Math.floor(Math.random() * 500)];

  const ticket  = `${RUN_ID}-${String(__VU).padStart(3,'0')}-${String(__ITER).padStart(5,'0')}`;
  const nProd   = Math.floor(Math.random() * 3) + 1;
  const prods   = Array.from({ length: nProd }, () => ({
    sku:      SKUS[Math.floor(Math.random() * SKUS.length)],
    cantidad: Math.floor(Math.random() * 5) + 1,
  }));

  const body = JSON.stringify({
    cedula,
    nombre:       NOMBRES[Math.floor(Math.random() * NOMBRES.length)],
    celular:      `0971${String(Math.floor(Math.random() * 9_000_000) + 1_000_000)}`,
    ciudad:       CIUDADES[Math.floor(Math.random() * CIUDADES.length)],
    eventoId:     EVENTO_ID,
    numeroTicket: ticket,
    local:        LOCALES[Math.floor(Math.random() * LOCALES.length)],
    multiplicador: false,
    fotoBase64:   FOTO,
    productos:    prods,
  });

  const t0  = Date.now();
  const res = http.post(`${BASE_URL}/api/tickets`, body, {
    headers: buildHeaders(body),
    tags:    { escenario: 'registro' },
    timeout: '12s',
  });
  durRegMs.add(Date.now() - t0);

  const ok = res.status === 201;
  tasaRegistro.add(ok);
  ok ? ticketsOk.add(1) : ticketsErr.add(1);

  check(res, {
    '[registro] HTTP 201':             (r) => r.status === 201,
    '[registro] body tiene cupones':   (r) => { try { return JSON.parse(r.body).cuponesAcumulados !== undefined; } catch { return false; } },
    '[registro] responde < 3s':        (r) => r.timings.duration < 3000,
  });

  if (!ok && res.status !== 409 && __ITER % 200 === 0) {
    console.error(`[REG] VU=${__VU} iter=${__ITER} → HTTP ${res.status} | ${res.body.substring(0, 200)}`);
  }

  sleep(0.2 + Math.random() * 0.8);
}

// ── Consulta de cupones ───────────────────────────────────────────────────────
function doConsulta() {
  const cedula = CEDULAS[Math.floor(Math.random() * 100)];
  const page   = Math.floor(Math.random() * 5) + 1;

  const t0  = Date.now();
  const res = http.get(
    `${BASE_URL}/api/tickets/${cedula}/cupones?eventoId=${EVENTO_ID}&limit=10&page=${page}`,
    { headers: { 'x-api-key': API_KEY }, tags: { escenario: 'consulta' }, timeout: '8s' },
  );
  durConMs.add(Date.now() - t0);

  const ok = res.status === 200 || res.status === 404;
  tasaConsulta.add(ok);
  if (!ok) consultasErr.add(1);

  check(res, {
    '[consulta] HTTP 200/404':      (r) => r.status === 200 || r.status === 404,
    '[consulta] JSON válido':       (r) => { try { JSON.parse(r.body); return true; } catch { return false; } },
    '[consulta] responde < 1.5s':   (r) => r.timings.duration < 1500,
  });

  sleep(0.5 + Math.random() * 1.5);
}

// ── Firmar request con HMAC-SHA256 si corresponde ────────────────────────────
function buildHeaders(rawBody) {
  const h = { 'Content-Type': 'application/json', 'x-api-key': API_KEY };
  if (HMAC_SECRET) {
    const ts  = String(Math.floor(Date.now() / 1000));
    h['x-timestamp'] = ts;
    h['x-signature'] = crypto.hmac('sha256', HMAC_SECRET, rawBody + ts, 'hex');
  }
  return h;
}
EOFK6

# ── Resultado previo ──────────────────────────────────────────────────────────
RESULT_FILE="stress-test/resultado-$(date +%Y%m%d-%H%M%S).json"

hdr "Iniciando test de estrés"
echo ""
info "Resultados JSON → $RESULT_FILE"
info "Presiona Ctrl+C para abortar"
echo ""
sleep 2

# ── Ejecutar k6 ──────────────────────────────────────────────────────────────
set +e
k6 run "$K6_TMPFILE" \
  --out "json=$RESULT_FILE" \
  -e BASE_URL="$BASE_URL" \
  -e API_KEY="$API_KEY" \
  -e EVENTO_ID="$EVENTO_ID" \
  -e HMAC_SECRET="$HMAC_SECRET" \
  -e MAX_VUS="$MAX_VUS" \
  -e RAMP_DURATION="$RAMP_DURATION" \
  -e SUSTAINED_DURATION="$SUSTAINED_DURATION" \
  -e COOLDOWN_DURATION="$COOLDOWN_DURATION" \
  -e QUERY_VUS="$QUERY_VUS" \
  -e QUERY_START="$QUERY_START" \
  -e QUERY_DURATION="$QUERY_DURATION"

K6_EXIT=$?
set -e

# ── Resumen post-test ─────────────────────────────────────────────────────────
hdr "Resumen del test"

if [[ ! -f "$RESULT_FILE" ]]; then
  warn "No se encontró el archivo de resultados: $RESULT_FILE"
elif ! command -v jq &>/dev/null; then
  warn "Instala jq para ver el resumen detallado: sudo apt install jq"
  info "Resultado crudo en: $RESULT_FILE"
else

  # ── Función: percentiles desde una métrica del JSON de k6 ──────────────────
  # Devuelve: "avg p50 p95 p99 max" en ms (enteros), separados por espacio.
  # Usa sort -n antes de awk para evitar asort() y el operador ternario.
  percentiles() {
    local metric=$1 tag_key=${2:-} tag_val=${3:-}
    local filter
    if [[ -n "$tag_key" ]]; then
      filter="select(.type==\"Point\" and .metric==\"${metric}\" and .data.tags.${tag_key}==\"${tag_val}\") | .data.value"
    else
      filter="select(.type==\"Point\" and .metric==\"${metric}\") | .data.value"
    fi
    jq -r "$filter" "$RESULT_FILE" 2>/dev/null \
    | awk 'BEGIN{n=0} $1+0>0{vals[n++]=$1+0} END{
        if(n==0){print "0 0 0 0 0";exit}
        sum=0; for(i=0;i<n;i++) sum+=vals[i]
        avg=int(sum/n)
        # sort simple (burbuja; n suele ser <50k — suficiente para shell)
        for(i=0;i<n-1;i++) for(j=i+1;j<n;j++) if(vals[i]>vals[j]){t=vals[i];vals[i]=vals[j];vals[j]=t}
        p50=int(n*0.50); if(p50>=n)p50=n-1
        p95=int(n*0.95); if(p95>=n)p95=n-1
        p99=int(n*0.99); if(p99>=n)p99=n-1
        printf "%d %d %d %d %d\n", avg, vals[p50], vals[p95], vals[p99], vals[n-1]
      }'
  }

  # ── Función: contar requests HTTP por escenario y status ───────────────────
  count_by_status() {
    local escenario=$1
    jq -r --arg esc "$escenario" \
      'select(.type=="Point" and .metric=="http_reqs" and .data.tags.escenario==$esc) | .data.tags.status' \
      "$RESULT_FILE" 2>/dev/null | sort | uniq -c | sort -rn
  }

  # ── Recopilar métricas ─────────────────────────────────────────────────────
  read -r REG_AVG REG_P50 REG_P95 REG_P99 REG_MAX <<< "$(percentiles "http_req_duration" "escenario" "registro")"
  read -r CON_AVG CON_P50 CON_P95 CON_P99 CON_MAX <<< "$(percentiles "http_req_duration" "escenario" "consulta")"

  REG_OK=$(jq -r 'select(.type=="Point" and .metric=="http_reqs" and .data.tags.escenario=="registro" and .data.tags.status=="201") | 1' "$RESULT_FILE" 2>/dev/null | wc -l | tr -d ' ')
  REG_TOTAL=$(jq -r 'select(.type=="Point" and .metric=="http_reqs" and .data.tags.escenario=="registro") | 1' "$RESULT_FILE" 2>/dev/null | wc -l | tr -d ' ')

  CON_OK=$(jq -r 'select(.type=="Point" and .metric=="http_reqs" and .data.tags.escenario=="consulta" and (.data.tags.status=="200" or .data.tags.status=="404")) | 1' "$RESULT_FILE" 2>/dev/null | wc -l | tr -d ' ')
  CON_TOTAL=$(jq -r 'select(.type=="Point" and .metric=="http_reqs" and .data.tags.escenario=="consulta") | 1' "$RESULT_FILE" 2>/dev/null | wc -l | tr -d ' ')

  REG_FAIL=$(( REG_TOTAL - REG_OK ))
  CON_FAIL=$(( CON_TOTAL - CON_OK ))

  REG_PCT_OK=0;  [[ $REG_TOTAL -gt 0 ]] && REG_PCT_OK=$(awk "BEGIN{printf \"%.1f\", $REG_OK/$REG_TOTAL*100}")
  REG_PCT_FAIL=0; [[ $REG_TOTAL -gt 0 ]] && REG_PCT_FAIL=$(awk "BEGIN{printf \"%.1f\", $REG_FAIL/$REG_TOTAL*100}")
  CON_PCT_OK=0;  [[ $CON_TOTAL -gt 0 ]] && CON_PCT_OK=$(awk "BEGIN{printf \"%.1f\", $CON_OK/$CON_TOTAL*100}")
  CON_PCT_FAIL=0; [[ $CON_TOTAL -gt 0 ]] && CON_PCT_FAIL=$(awk "BEGIN{printf \"%.1f\", $CON_FAIL/$CON_TOTAL*100}")

  # ── Errores de registro agrupados por código HTTP ─────────────────────────
  REG_ERRORS=$(count_by_status "registro" | grep -v "^ *[0-9]* 201$" | head -5)

  # ── Imprimir reporte ───────────────────────────────────────────────────────
  echo ""
  echo -e "  ${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo -e "  ${BOLD}  CONFIGURACIÓN DEL TEST${RESET}"
  echo -e "  ${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo ""
  printf "  %-28s %s\n"  "Servidor:"   "$BASE_URL"
  printf "  %-28s %s\n"  "Evento ID:"  "$EVENTO_ID"
  printf "  %-28s %s\n"  "Modo:"       "$MODO"
  printf "  %-28s %s\n"  "VUs máx:"    "$MAX_VUS"
  if [[ -n "$HMAC_SECRET" ]]; then
    printf "  %-28s ${GREEN}%s${RESET}\n" "HMAC:" "activado"
  else
    printf "  %-28s ${YELLOW}%s${RESET}\n" "HMAC:" "desactivado"
  fi
  printf "  %-28s %s\n"  "Resultados:" "$RESULT_FILE"

  echo ""
  echo -e "  ${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo -e "  ${BOLD}  REGISTRO DE TICKETS${RESET}"
  echo -e "  ${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo ""
  printf "  %-28s %s\n"  "Total requests:"       "$REG_TOTAL"
  printf "  %-28s ${GREEN}%s${RESET}\n" "  ✔ Exitosos (HTTP 201):" "$REG_OK  ($REG_PCT_OK%)"
  if [[ $REG_FAIL -gt 0 ]]; then
    printf "  %-28s ${RED}%s${RESET}\n" "  ✖ Fallidos:"            "$REG_FAIL  ($REG_PCT_FAIL%)"
    echo ""
    echo -e "  ${YELLOW}  Errores por código HTTP:${RESET}"
    while IFS= read -r line; do
      count=$(echo "$line" | awk '{print $1}')
      code=$(echo "$line" | awk '{print $2}')
      reason=""
      case "$code" in
        503) reason="Error interno del servidor (BD/Cloudinary)";;
        409) reason="Ticket duplicado (colisión de numeroTicket)";;
        400) reason="Request inválido (validación DTO)";;
        401) reason="API key incorrecta o faltante";;
        429) reason="Rate limit alcanzado";;
        404) reason="Evento no encontrado o inactivo";;
        000) reason="Timeout / sin respuesta";;
        *)   reason="HTTP $code";;
      esac
      printf "      ${RED}HTTP %-5s${RESET}  %s req  — %s\n" "$code" "$count" "$reason"
    done <<< "$REG_ERRORS"
  else
    printf "  %-28s ${GREEN}%s${RESET}\n" "  ✖ Fallidos:" "0  (0%)"
  fi
  echo ""
  echo -e "  ${BOLD}  Latencia de registro:${RESET}"
  printf "  %-28s %s ms\n" "  avg:"  "$REG_AVG"
  printf "  %-28s %s ms\n" "  p50:"  "$REG_P50"
  if [[ $REG_P95 -gt 3000 ]]; then
    printf "  %-28s ${RED}%s ms  ✖ SLA: <3000${RESET}\n" "  p95:"  "$REG_P95"
  else
    printf "  %-28s ${GREEN}%s ms  ✔ SLA: <3000${RESET}\n" "  p95:"  "$REG_P95"
  fi
  if [[ $REG_P99 -gt 5000 ]]; then
    printf "  %-28s ${RED}%s ms  ✖ SLA: <5000${RESET}\n" "  p99:"  "$REG_P99"
  else
    printf "  %-28s ${GREEN}%s ms  ✔ SLA: <5000${RESET}\n" "  p99:"  "$REG_P99"
  fi
  printf "  %-28s %s ms\n" "  máx:"  "$REG_MAX"

  echo ""
  echo -e "  ${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo -e "  ${BOLD}  CONSULTA DE CUPONES${RESET}"
  echo -e "  ${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo ""
  printf "  %-28s %s\n"  "Total requests:"         "$CON_TOTAL"
  printf "  %-28s ${GREEN}%s${RESET}\n" "  ✔ Exitosos (200/404):" "$CON_OK  ($CON_PCT_OK%)"
  if [[ $CON_FAIL -gt 0 ]]; then
    printf "  %-28s ${RED}%s${RESET}\n" "  ✖ Fallidos:"           "$CON_FAIL  ($CON_PCT_FAIL%)"
  else
    printf "  %-28s ${GREEN}%s${RESET}\n" "  ✖ Fallidos:" "0  (0%)"
  fi
  echo ""
  echo -e "  ${BOLD}  Latencia de consulta:${RESET}"
  printf "  %-28s %s ms\n" "  avg:"  "$CON_AVG"
  printf "  %-28s %s ms\n" "  p50:"  "$CON_P50"
  if [[ $CON_P95 -gt 1500 ]]; then
    printf "  %-28s ${RED}%s ms  ✖ SLA: <1500${RESET}\n" "  p95:"  "$CON_P95"
  else
    printf "  %-28s ${GREEN}%s ms  ✔ SLA: <1500${RESET}\n" "  p95:"  "$CON_P95"
  fi
  if [[ $CON_P99 -gt 3000 ]]; then
    printf "  %-28s ${RED}%s ms  ✖ SLA: <3000${RESET}\n" "  p99:"  "$CON_P99"
  else
    printf "  %-28s ${GREEN}%s ms  ✔ SLA: <3000${RESET}\n" "  p99:"  "$CON_P99"
  fi
  printf "  %-28s %s ms\n" "  máx:"  "$CON_MAX"

  # ── Veredicto final ────────────────────────────────────────────────────────
  echo ""
  echo -e "  ${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo -e "  ${BOLD}  EFICIENCIA DEL BACKEND${RESET}"
  echo -e "  ${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo ""

  # Calcular porcentaje global de éxito combinando ambos escenarios
  TOTAL_ALL=$(( REG_TOTAL + CON_TOTAL ))
  OK_ALL=$(( REG_OK + CON_OK ))
  PCT_ALL=0; [[ $TOTAL_ALL -gt 0 ]] && PCT_ALL=$(awk "BEGIN{printf \"%.1f\", $OK_ALL/$TOTAL_ALL*100}")

  printf "  %-28s %s%%\n" "Tasa de éxito global:" "$PCT_ALL"
  echo ""

  # Diagnóstico por escenario
  if [[ $REG_FAIL -gt 0 ]]; then
    # Detectar el error dominante en registro
    DOMINANT=$(count_by_status "registro" | grep -v "^ *[0-9]* 201$" | head -1)
    DOM_CODE=$(echo "$DOMINANT" | awk '{print $2}')
    case "$DOM_CODE" in
      503) echo -e "  ${RED}▸ Registro:${RESET} El backend recibe más carga de la que puede procesar."
           echo    "    Causa probable: saturación del pool de conexiones DB o Cloudinary."
           echo    "    Acción: aumentar DATABASE_POOL_SIZE, habilitar CLOUDINARY_MOCK=true para tests,"
           echo    "            o escalar horizontalmente (más instancias).";;
      429) echo -e "  ${RED}▸ Registro:${RESET} Rate limiting activo."
           echo    "    Acción: subir RATE_LIMIT_MAX en el servidor antes del test.";;
      409) echo -e "  ${YELLOW}▸ Registro:${RESET} Colisiones de numeroTicket (409)."
           echo    "    Normal en pruebas de estrés; no indica fallo del backend.";;
      *)   echo -e "  ${RED}▸ Registro:${RESET} Error dominante HTTP $DOM_CODE — revisa los logs del servidor.";;
    esac
    echo ""
  fi

  # Veredicto de latencia registro
  if [[ $REG_P95 -gt 5000 ]]; then
    echo -e "  ${RED}▸ Latencia registro crítica (p95=${REG_P95}ms):${RESET} el servidor está muy saturado."
    echo    "    Considera: más RAM/CPU, réplica de lectura DB, o instancias adicionales."
  elif [[ $REG_P95 -gt 3000 ]]; then
    echo -e "  ${YELLOW}▸ Latencia registro elevada (p95=${REG_P95}ms):${RESET} supera el SLA de 3 s."
    echo    "    Considera: ajustar el pool de DB o aumentar recursos del hosting."
  else
    echo -e "  ${GREEN}▸ Latencia registro OK (p95=${REG_P95}ms):${RESET} dentro del SLA."
  fi

  # Veredicto de latencia consulta
  if [[ $CON_P95 -gt 3000 ]]; then
    echo -e "  ${RED}▸ Latencia consulta crítica (p95=${CON_P95}ms):${RESET} posible falta de índice o réplica."
  elif [[ $CON_P95 -gt 1500 ]]; then
    echo -e "  ${YELLOW}▸ Latencia consulta elevada (p95=${CON_P95}ms):${RESET} supera el SLA de 1.5 s."
    echo    "    Considera: índice en (cedula, evento_id) o réplica de lectura."
  else
    echo -e "  ${GREEN}▸ Latencia consulta OK (p95=${CON_P95}ms):${RESET} dentro del SLA."
  fi

  echo ""
  info "Resultado completo en: $RESULT_FILE"
fi

echo ""
if [[ $K6_EXIT -eq 0 ]]; then
  ok "${BOLD}Test PASÓ — todos los umbrales de SLA cumplidos${RESET}"
else
  err "${BOLD}Test FALLÓ — uno o más umbrales de SLA no se cumplieron${RESET}"
fi

# ── Limpieza de datos de prueba ───────────────────────────────────────────────
echo ""
hdr "Limpieza de datos de prueba"
echo ""
info "Los participantes sintéticos (cédulas 1000000–1000499) y sus tickets"
info "pueden eliminarse para dejar la BD como si las pruebas no hubieran existido."
echo ""
read -r -p "  ¿Limpiar ahora los datos generados por el test? [s/N] " do_cleanup
if [[ "$do_cleanup" =~ ^[sS]$ ]]; then
  bash "$SCRIPT_DIR/cleanup-stress-data.sh" --force
else
  warn "Datos de prueba conservados."
  info "Para limpiar después: bash stress-test/cleanup-stress-data.sh"
fi
echo ""
