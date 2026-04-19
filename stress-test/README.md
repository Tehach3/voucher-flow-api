# Test de Estrés — voucher-flow-api

Herramienta de carga basada en [k6](https://k6.io) para verificar si el servidor soporta el pico de tráfico esperado (~10.000 registros de tickets concurrentes) más consultas simultáneas de cupones.

---

## Archivos

```
stress-test/
├── run-stress-test.sh     ← script principal (esto es lo que ejecutas)
├── k6-stress-test.js      ← script k6 standalone (uso avanzado)
└── resultado-*.json       ← resultados generados tras cada corrida
```

---

## Requisitos previos

| Herramienta | Para qué |
|---|---|
| `bash` | correr el script principal |
| `curl` | verificar conectividad antes del test |
| `k6` | motor de carga — el script lo instala automáticamente si no está |
| `jq` *(opcional)* | mostrar el resumen de métricas al final |

Instalar `jq` si no lo tienes:
```bash
sudo apt install jq        # Ubuntu / WSL
brew install jq            # macOS
```

---

## Configuración rápida

Abre `run-stress-test.sh` y edita las primeras líneas:

```bash
BASE_URL="https://tu-app.railway.app"   # URL del servidor a probar (sin / al final)
API_KEY="tu_api_key_aqui"               # Valor del header x-api-key
EVENTO_ID=1                             # ID de un evento activo en la BD
HMAC_SECRET=""                          # Dejar vacío si SECURITY_HMAC_ENABLED=false
MODO="completo"                         # "rapido" o "completo" (ver tabla abajo)
```

| Modo | VUs | Duración aprox. | Requests estimados |
|---|---|---|---|
| `rapido` | 50 | ~2 min | ~1.000 |
| `completo` | 200 | ~6 min | ~10.000–25.000 |

> Usa `rapido` primero para verificar que todo conecta antes de lanzar la carga completa.

---

## Variables de entorno en el servidor

Antes de correr el test, asegúrate de que el servidor tenga estas variables configuradas y haya sido reiniciado:

```env
# Requeridas siempre
DATABASE_URL=<postgres-connection-string>
API_KEY=<mismo valor que pusiste en el script>
ENCRYPTION_KEY=<mínimo 32 caracteres>

# Crítico para el test — sin esto falla en el request 101
RATE_LIMIT_MAX=50000
RATE_LIMIT_WINDOW_MS=60000

# Recomendado para no gastar créditos de Cloudinary durante el test
CLOUDINARY_MOCK=true
CLOUDINARY_OCR_ENABLED=false

# Según tu configuración
SECURITY_HMAC_ENABLED=false   # o configura HMAC_SECRET en el script
```

> El script muestra este checklist y pide confirmación antes de continuar.

---

## Ejecución

```bash
bash stress-test/run-stress-test.sh
```

El script ejecuta los pasos en este orden:

1. **Valida** que hayas cambiado los valores de config por defecto
2. **Muestra el checklist** de variables del servidor y espera confirmación
3. **Verifica conectividad** con `GET /api/health`
4. **Instala k6** automáticamente si no está presente (detecta WSL, Debian, macOS)
5. **Corre el test** con dos escenarios en paralelo
6. **Muestra el resumen** con métricas clave y guías de qué escalar

---

## Escenarios del test

### Escenario 1 — Registro de tickets (`POST /api/tickets`)

Simula el pico de carga principal: usuarios enviando tickets con imagen (base64) simultáneamente.

- **Distribución de participantes:** 20% de las cédulas reciben el 80% del tráfico (distribución Pareto), lo que fuerza a que esos participantes acumulen múltiples registros — el caso que más presión genera en DB.
- **Datos sintéticos:** 500 cédulas únicas, nombres, ciudades y locales aleatorios, imagen mínima 1×1 px JPEG válida.
- **Ticket duplicado (HTTP 409):** se considera aceptable durante el test; no cuenta como falla.

### Escenario 2 — Consulta de cupones (`GET /api/tickets/:cedula/cupones`)

Simula la pantalla "mis cupones" consultada en paralelo con los registros.

- Arranca 1 minuto después del inicio para que ya haya datos en BD.
- Consulta las 100 cédulas con más registros (las que acumularon más tickets en el escenario 1).
- Pagina los resultados aleatoriamente para presionar el query con `LIMIT/OFFSET`.

---

## Umbrales de SLA

El test falla (`exit 1`) si alguno de estos límites no se cumple:

| Métrica | Umbral |
|---|---|
| Registro `p95` | < 3.000 ms |
| Registro `p99` | < 5.000 ms |
| Consulta `p95` | < 1.500 ms |
| Consulta `p99` | < 3.000 ms |
| Tasa de éxito registro | > 95% |
| Tasa de éxito consulta | > 98% |
| Errores HTTP globales | < 5% |

---

## Interpretar los resultados

Al finalizar el test verás un resumen como este (requiere `jq`):

```
══ Resumen del test ══

  Métrica                              Valor
  ─────────────────────────────────────────────────────
  Registro p50/avg:                    420 ms
  Registro p95:                        1850 ms
  Registro p99:                        3100 ms
  Registro máximo:                     7200 ms
  ─────────────────────────────────────────────────────
  Consulta avg:                        180 ms
  Consulta p95:                        620 ms
  Consulta p99:                        980 ms
  Consulta máximo:                     2100 ms
```

### Qué solicitar al hosting según los resultados

| Síntoma | Causa probable | Qué pedir |
|---|---|---|
| p95 registro > 3 s | CPU o RAM insuficiente en la app | Subir plan o añadir instancias |
| p95 consulta > 1 s | Query lento o DB saturada | Réplica de lectura o índice adicional |
| Errores HTTP > 5% | Pool de conexiones DB agotado | Aumentar `DB_POOL_SIZE` o plan de BD |
| Timeouts frecuentes (HTTP 503/504) | Servidor no escala a la concurrencia | Escala horizontal (más réplicas) |
| Rate limit (HTTP 429) | `RATE_LIMIT_MAX` muy bajo | Subir el valor en `.env` del servidor |

El archivo `stress-test/resultado-YYYYMMDD-HHMMSS.json` contiene todas las métricas punto a punto. Puedes adjuntarlo al ticket de soporte del hosting para respaldar el pedido de más recursos.

---

## Uso avanzado — k6 directo

Si ya tienes k6 instalado y quieres correr el script standalone con parámetros propios:

```bash
k6 run stress-test/k6-stress-test.js \
  -e BASE_URL=https://tu-app.railway.app \
  -e API_KEY=tu_api_key \
  -e EVENTO_ID=1 \
  -e HMAC_SECRET=tu_hmac_secret \
  --out json=stress-test/resultado.json
```

Para guardar un HTML interactivo con gráficas (requiere `k6-reporter`):

```bash
k6 run stress-test/k6-stress-test.js \
  --out json=stress-test/resultado.json \
  && npx k6-html-reporter --source stress-test/resultado.json \
                           --output stress-test/reporte.html
```
