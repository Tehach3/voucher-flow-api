/**
 * Test de estrés — voucher-flow-api
 *
 * Herramienta: k6 (https://k6.io/docs/get-started/installation/)
 *
 * Escenarios:
 *   1. registro_tickets  — pico de ~10.000 POSTs a /api/tickets
 *   2. consulta_cupones  — 30 VUs consultando GET /:cedula/cupones de forma concurrente
 *
 * Variables de entorno requeridas al invocar k6:
 *   BASE_URL     URL base de la API           (default: http://localhost:3000)
 *   API_KEY      Valor del header x-api-key   (default: test-api-key)
 *   EVENTO_ID    ID de un evento activo        (default: 1)
 *   HMAC_SECRET  APP_HMAC_SECRET del .env      (default: vacío = HMAC desactivado)
 *
 * IMPORTANTE — rate limiting:
 *   El guard RateLimitGuard aplica 100 req/min por IP de forma predeterminada.
 *   Antes de correr el test, ajusta en .env:
 *     RATE_LIMIT_MAX=50000
 *     RATE_LIMIT_WINDOW_MS=60000
 *   o levanta el servidor con NODE_ENV=stress para desactivar el guard temporalmente.
 *
 * Ejecución:
 *   k6 run stress-test/k6-stress-test.js \
 *     -e BASE_URL=http://localhost:3000 \
 *     -e API_KEY=tu_api_key \
 *     -e EVENTO_ID=1 \
 *     -e HMAC_SECRET=tu_hmac_secret
 *
 * Para ver resumen en JSON:
 *   k6 run ... --out json=stress-test/resultado.json
 */

import http    from 'k6/http';
import crypto  from 'k6/crypto';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

// ── Métricas personalizadas ───────────────────────────────────────────────────

const ticketsRegistrados = new Counter('tickets_registrados');
const ticketsFallidos    = new Counter('tickets_fallidos');
const consultasFallidas  = new Counter('consultas_fallidas');
const tasaExitoRegistro  = new Rate('tasa_exito_registro');
const tasaExitoConsulta  = new Rate('tasa_exito_consulta');
const duracionRegistro   = new Trend('duracion_registro_ms',  true);
const duracionConsulta   = new Trend('duracion_consulta_ms',  true);

// ── Configuración ─────────────────────────────────────────────────────────────

const BASE_URL    = __ENV.BASE_URL    || 'http://localhost:3000';
const API_KEY     = __ENV.API_KEY     || 'test-api-key';
const EVENTO_ID   = parseInt(__ENV.EVENTO_ID || '1', 10);
const HMAC_SECRET = __ENV.HMAC_SECRET || '';

// ── Imagen mínima válida 1×1 px JPEG (base64) ────────────────────────────────
// Generada con: convert -size 1x1 xc:white jpeg:- | base64
const FOTO_BASE64 =
  'data:image/jpeg;base64,' +
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
  'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIy' +
  'MjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEB' +
  'AxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAA' +
  'AAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/ACWAA' +
  'f/Z';

// ── Datos de prueba ───────────────────────────────────────────────────────────

// 500 cédulas → combinado con ~200 VUs y varias iteraciones acumula múltiples
// tickets por participante. Las primeras 100 (~20%) concentrarán más registros
// y son las que se consultan en el escenario de consulta.
const CEDULAS = Array.from({ length: 500 }, (_, i) =>
  String(1000000 + i),
);

const CIUDADES = ['Asuncion', 'Ciudad del Este', 'Encarnacion', 'Luque', 'San Lorenzo'];
const LOCALES  = [
  'Super 6 La Negrita', 'Mercado Central', 'Disco', 'Stock', 'BigValue',
  'La Anonima', 'Shopping del Sol', 'Superseis', 'Punto Fijo', 'Tu Tienda',
];
const SKUS     = ['250g', '500g', '1kg', '5kg'];
const NOMBRES  = [
  'Carlos Garcia', 'Maria Lopez', 'Juan Martinez', 'Ana Perez',
  'Pedro Rodriguez', 'Sofia Sanchez', 'Luis Gomez', 'Laura Diaz',
  'Miguel Fernandez', 'Elena Torres',
];

// ── Escenarios ────────────────────────────────────────────────────────────────

export const options = {
  scenarios: {
    /**
     * Escenario 1: pico de registro de tickets.
     * Con 200 VUs sostenidos durante 3 min a ~0.7 req/s por VU se alcanzan
     * ≈ 25.200 iteraciones totales, garantizando los 10.000 registros objetivo
     * con margen para errores y conflictos de ticket duplicado.
     */
    registro_tickets: {
      executor:  'ramping-vus',
      startVUs:  0,
      stages: [
        { duration: '30s', target: 50  },  // calentamiento
        { duration: '90s', target: 200 },  // rampa hasta pico
        { duration: '3m',  target: 200 },  // carga sostenida (núcleo del test)
        { duration: '60s', target: 20  },  // enfriamiento
      ],
      env: { ESCENARIO: 'registro' },
      gracefulRampDown: '10s',
    },

    /**
     * Escenario 2: consultas concurrentes de participantes con varios tickets.
     * Arranca 30 s después del calentamiento para que ya haya datos en BD.
     */
    consulta_cupones: {
      executor:  'constant-vus',
      vus:       30,
      duration:  '5m30s',
      startTime: '1m',        // espera a que haya tickets registrados
      env: { ESCENARIO: 'consulta' },
    },
  },

  // ── Umbrales de aceptación (SLA) ────────────────────────────────────────────
  thresholds: {
    // Registro: p95 < 3 s, p99 < 5 s
    'http_req_duration{escenario:registro}': ['p(95)<3000', 'p(99)<5000'],
    // Consulta:  p95 < 1.5 s, p99 < 3 s
    'http_req_duration{escenario:consulta}': ['p(95)<1500', 'p(99)<3000'],
    // Tasa de éxito global
    tasa_exito_registro: ['rate>0.95'],
    tasa_exito_consulta: ['rate>0.98'],
    http_req_failed:     ['rate<0.05'],
  },
};

// ── Función raíz ──────────────────────────────────────────────────────────────

export default function () {
  if (__ENV.ESCENARIO === 'registro') {
    escenarioRegistro();
  } else {
    escenarioConsulta();
  }
}

// ── Escenario 1: registro de tickets ─────────────────────────────────────────

function escenarioRegistro() {
  // Distribuir cédulas: ~20% de las cédulas reciben ~80% del tráfico (Pareto)
  const useHeavyUser = Math.random() < 0.2;
  const cedulaIdx    = useHeavyUser
    ? Math.floor(Math.random() * 100)          // primeras 100 cédulas
    : Math.floor(Math.random() * 500);         // cualquiera del pool

  const cedula       = CEDULAS[cedulaIdx];
  const numeroTicket = `${String(__VU).padStart(4, '0')}-${String(__ITER).padStart(6, '0')}`;

  const cantidadProductos = Math.floor(Math.random() * 3) + 1;
  const productos = Array.from({ length: cantidadProductos }, () => ({
    sku:      SKUS[Math.floor(Math.random() * SKUS.length)],
    cantidad: Math.floor(Math.random() * 5) + 1,
  }));

  const payload = JSON.stringify({
    cedula,
    nombre:    NOMBRES[Math.floor(Math.random() * NOMBRES.length)],
    celular:   `0971${String(Math.floor(Math.random() * 9_000_000) + 1_000_000)}`,
    ciudad:    CIUDADES[Math.floor(Math.random() * CIUDADES.length)],
    eventoId:  EVENTO_ID,
    numeroTicket,
    local:     LOCALES[Math.floor(Math.random() * LOCALES.length)],
    multiplicador: false,
    fotoBase64: FOTO_BASE64,
    productos,
  });

  const headers = buildHeaders(payload);
  const inicio  = Date.now();

  const res = http.post(`${BASE_URL}/api/tickets`, payload, {
    headers,
    tags:    { escenario: 'registro' },
    timeout: '12s',
  });

  const elapsed = Date.now() - inicio;
  duracionRegistro.add(elapsed);

  // 201 = registrado, 409 = ticket duplicado (aceptable en el test por colisión de ID)
  const exito = res.status === 201;
  const aceptable = exito || res.status === 409;

  const checkOk = check(res, {
    'registro 201': (r) => r.status === 201,
    'body tiene cuponesAcumulados': (r) => {
      try {
        return JSON.parse(r.body).cuponesAcumulados !== undefined;
      } catch {
        return false;
      }
    },
  });

  tasaExitoRegistro.add(exito);

  if (exito) {
    ticketsRegistrados.add(1);
  } else if (!aceptable) {
    ticketsFallidos.add(1);
    if (__ITER % 200 === 0) {
      console.error(
        `[Registro] VU=${__VU} ITER=${__ITER} ` +
        `status=${res.status} dur=${elapsed}ms ` +
        `body=${res.body.substring(0, 300)}`,
      );
    }
  }

  // Pausa realista entre envíos (simula tiempo del usuario completando el form)
  sleep(0.2 + Math.random() * 0.8);
}

// ── Escenario 2: consulta de cupones ─────────────────────────────────────────

function escenarioConsulta() {
  // Concentrar consultas en las cédulas con más registros (primeras 100)
  const cedula = CEDULAS[Math.floor(Math.random() * 100)];
  const page   = Math.floor(Math.random() * 3) + 1;

  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
  };

  const inicio = Date.now();

  const res = http.get(
    `${BASE_URL}/api/tickets/${cedula}/cupones?eventoId=${EVENTO_ID}&limit=10&page=${page}`,
    {
      headers,
      tags:    { escenario: 'consulta' },
      timeout: '8s',
    },
  );

  const elapsed = Date.now() - inicio;
  duracionConsulta.add(elapsed);

  // 200 = tiene registros, 404 = participante sin registros aún (ambos son OK)
  const exito = res.status === 200 || res.status === 404;

  const checkOk = check(res, {
    'consulta 200 o 404':          (r) => r.status === 200 || r.status === 404,
    'responde en menos de 1500 ms': (r) => r.timings.duration < 1500,
    'body es JSON válido': (r) => {
      try { JSON.parse(r.body); return true; } catch { return false; }
    },
  });

  tasaExitoConsulta.add(exito);

  if (!exito) {
    consultasFallidas.add(1);
    if (__ITER % 50 === 0) {
      console.error(
        `[Consulta] VU=${__VU} cedula=${cedula} ` +
        `status=${res.status} dur=${elapsed}ms`,
      );
    }
  }

  sleep(0.5 + Math.random() * 1.5);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Construye los headers de la request.
 * Si HMAC_SECRET está configurado, firma el body con HMAC-SHA256
 * tal como espera HmacGuard (rawBody + timestamp).
 */
function buildHeaders(rawBody) {
  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
  };

  if (HMAC_SECRET) {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = crypto.hmac('sha256', HMAC_SECRET, rawBody + timestamp, 'hex');
    headers['x-timestamp'] = timestamp;
    headers['x-signature'] = signature;
  }

  return headers;
}
