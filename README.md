# Voucher Flow API

Backend REST API para plataforma de sorteos promocionales. Permite gestionar eventos/campañas, registrar participantes mediante tickets con imágenes, calcular cupones y consultarlos.

## Stack

| Capa | Tecnología |
|------|-----------|
| Runtime | Node.js 20 LTS |
| Framework | NestJS 10 |
| Lenguaje | TypeScript 5 (strict mode) |
| Base de datos | PostgreSQL (Neon) vía TypeORM |
| Almacenamiento / OCR | Cloudinary |
| Autenticación | API Key (header `x-api-key`) |

---

## Requisitos previos

- Node.js 20 LTS o superior
- npm 9 o superior
- Una base de datos PostgreSQL accesible (se recomienda [Neon](https://neon.tech))
- Cuenta en [Cloudinary](https://cloudinary.com) (opcional — hay modo stub sin credenciales)

---

## Instalación paso a paso

### 1. Clonar el repositorio

```bash
git clone <url-del-repositorio>
cd voucher-flow-api
```

### 2. Instalar dependencias

```bash
npm install
```

### 3. Configurar variables de entorno

```bash
cp .env.example .env
```

Editar `.env` con los valores reales (ver [referencia completa de variables](#variables-de-entorno--referencia-completa)):

```env
PORT=3000
NODE_ENV=development
API_KEY=mi_clave_secreta_aqui
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
DATABASE_SSL=true
ENCRYPTION_KEY=una_cadena_aleatoria_de_al_menos_32_caracteres
```

> **Sin Cloudinary:** si las variables `CLOUDINARY_*` están vacías, el servicio funciona en modo stub — las imágenes no se suben pero el flujo opera con normalidad. Útil para desarrollo local.

### 4. Inicializar la base de datos

La primera vez hay que ejecutar las migraciones de TypeORM para crear todas las tablas, índices, funciones y triggers:

```bash
# Requiere DATABASE_URL configurado en .env
npm run typeorm migration:run -- -d src/database/database.config.ts
```

> Si preferís ejecutar el SQL directamente en Neon / pgAdmin, el contenido de la migración se encuentra en `src/database/migrations/1711000000000-Initial.ts`.

### 5. Levantar en desarrollo

```bash
npm run start:dev
```

La API queda disponible en `http://localhost:3000`.

Verificar que esté corriendo:

```bash
curl http://localhost:3000/api/health
# { "status": "ok", ... }
```

Documentación interactiva (Swagger): `http://localhost:3000/api/docs`

---

## Comandos disponibles

```bash
npm run start:dev       # Desarrollo con hot-reload
npm run build           # Compilar TypeScript → dist/
npm run start:prod      # Producción (requiere build previo)
npm run lint            # ESLint con auto-fix
npm run format          # Prettier

# Tests
npm run test            # Unit tests
npm run test:watch      # Unit tests en modo watch
npm run test:cov        # Coverage (objetivo: 80%+)
npm run test:e2e        # Tests end-to-end

# Migraciones (requiere DATABASE_URL configurado)
npm run typeorm migration:generate -- -d src/database/database.config.ts -n NombreMigracion
npm run typeorm migration:run      -- -d src/database/database.config.ts
npm run typeorm migration:revert   -- -d src/database/database.config.ts
```

---

## Autenticación

Todos los endpoints — excepto `GET /api/health` — requieren el header:

```
x-api-key: <valor de API_KEY en .env>
```

Ejemplo:

```bash
curl -H "x-api-key: mi_clave_secreta" http://localhost:3000/api/eventos
```

---

## Variables de entorno — referencia completa

### Aplicación

| Variable | Requerida | Default | Descripción |
|----------|-----------|---------|-------------|
| `PORT` | No | `3000` | Puerto HTTP |
| `NODE_ENV` | No | `development` | `development` o `production` |
| `CORS_ORIGIN` | No | `*` | Origen permitido para CORS |

### Seguridad

| Variable | Requerida | Default | Descripción |
|----------|-----------|---------|-------------|
| `API_KEY` | Sí | — | Clave de autenticación para todos los endpoints |
| `ENCRYPTION_KEY` | Sí | — | Clave AES-256-GCM para cifrar PII (mínimo 32 caracteres) |

### Base de datos

| Variable | Requerida | Default | Descripción |
|----------|-----------|---------|-------------|
| `DATABASE_URL` | Sí | — | Cadena de conexión PostgreSQL completa |
| `DATABASE_SSL` | No | `false` | `true` para conexiones SSL (Neon requiere `true`) |

### Cloudinary

| Variable | Requerida | Default | Descripción |
|----------|-----------|---------|-------------|
| `CLOUDINARY_CLOUD_NAME` | No | — | Cloud name — si está vacío activa el modo stub |
| `CLOUDINARY_API_KEY` | No | — | API key de Cloudinary |
| `CLOUDINARY_API_SECRET` | No | — | API secret de Cloudinary |

### Features de seguridad (opcionales)

| Variable | Default | Descripción |
|----------|---------|-------------|
| `SECURITY_HMAC_ENABLED` | `false` | Activa la verificación de firma HMAC en `POST /api/tickets` |
| `APP_HMAC_SECRET` | — | Secreto compartido para el cálculo de la firma HMAC |
| `SECURITY_HMAC_WINDOW_SECS` | `300` | Ventana de tiempo aceptada para el timestamp HMAC (segundos) |
| `SECURITY_AUDIT_ENABLED` | `false` | Activa el registro de eventos en la tabla `auditoria` |
| `SECURITY_IMAGE_HASH_ENABLED` | `false` | Activa el hash SHA-256 de imágenes para detectar comprobantes reutilizados |

### Rate limiting

| Variable | Default | Descripción |
|----------|---------|-------------|
| `RATE_LIMIT_WINDOW_MS` | `60000` | Ventana de rate limiting en ms |
| `RATE_LIMIT_MAX` | `100` | Peticiones máximas por ventana por IP |

### Variables de testing (solo `NODE_ENV=development`)

> Completamente ignoradas en `NODE_ENV=production`. No hay riesgo de activarlas accidentalmente en producción.

| Variable | Default | Descripción |
|----------|---------|-------------|
| `FORCE_CLOUDINARY_ERROR` | `false` | Fuerza que el upload a Cloudinary siempre falle → genera pendiente con `etapaError='upload_imagen'` y responde `503 FAC_007` |
| `FORCE_DB_WRITE_ERROR` | `false` | Fuerza que la escritura en BD falle después del upload → genera pendiente con `etapaError='escritura_db'` y responde `503 FAC_008` |

Ver [Guía de testing de pendientes](docs/flujo-funcional.md#11-testing-de-tickets-pendientes-con-flags-de-entorno) para el flujo completo con ejemplos.

---

## Cifrado de datos personales (PII)

Las columnas `nombre`, `celular` y `email` de la tabla `participantes` se almacenan cifradas con **AES-256-GCM** para proteger los datos personales de los participantes.

- El cifrado es transparente: TypeORM cifra al escribir y descifra al leer automáticamente vía `encryptionTransformer`
- Cada valor cifrado incluye: `IV (12 bytes) | AuthTag (16 bytes) | ciphertext`, codificado en base64
- La clave se configura en `ENCRYPTION_KEY` — debe tener al menos 32 caracteres y nunca debe rotarse sin migrar los datos existentes
- `cedula` y `ciudad` **no** se cifran: `cedula` es la clave de búsqueda, `ciudad` no es PII sensible

> **Política de respuestas:** ningún endpoint expone `cedula`, `nombre`, `celular` ni `email`. Solo se devuelven datos operativos (cupones, IDs, URLs).

---

## Features de seguridad

### Hash de imagen (`SECURITY_IMAGE_HASH_ENABLED`)

Cuando está activo, cada imagen recibida genera un hash SHA-256 que se almacena en `tickets.foto_hash`. Antes de procesar cualquier ticket, el sistema verifica que ese hash no exista en la misma campaña — **sin importar el participante ni el número de ticket**. Esto impide reutilizar la misma foto de comprobante para generar cupones múltiples veces.

El hash se calcula sobre el contenido base64 de la imagen (sin el prefijo `data:...`), antes del upload a Cloudinary.

### Firma HMAC (`SECURITY_HMAC_ENABLED`)

Cuando está activo, el cliente debe incluir en cada `POST /api/tickets`:

```
X-Timestamp: <unix timestamp en segundos>
X-Signature: <HMAC-SHA256(rawBody + timestamp, APP_HMAC_SECRET)>
```

Requests con timestamp fuera de la ventana `SECURITY_HMAC_WINDOW_SECS` son rechazados con `401`.

### Auditoría (`SECURITY_AUDIT_ENABLED`)

Registra en la tabla `auditoria` los eventos relevantes del flujo de tickets: `TICKET_REGISTRADO`, `TICKET_FALLIDO`, `IMAGEN_DUPLICADA`. Las cédulas se almacenan como hash SHA-256 — nunca en texto plano.

---

## Estructura del proyecto

```
src/
├── main.ts                    # Bootstrap: tamaño de body, CORS, Swagger, middlewares
├── app.module.ts              # Módulo raíz
├── config/                    # Configuración desde process.env (getters lazy)
│   ├── app.config.ts
│   ├── database.config.ts
│   ├── cloudinary.config.ts
│   └── security.config.ts     # API key, rate limit, HMAC, auditoría, image hash
├── common/
│   ├── constants/
│   │   ├── error.constants.ts     # Códigos de error (AUTH_001, FAC_001, etc.)
│   │   ├── messages.constants.ts  # Catálogo sistema+mensaje por código — editable
│   │   ├── regex.constants.ts
│   │   └── sku.constants.ts       # Mapeo SKU → cupones/unidad
│   ├── exceptions/
│   │   └── app.exception.ts       # AppException — clase base con factories por tipo HTTP
│   ├── dtos/                      # DTOs con validación class-validator
│   ├── interfaces/                # Interfaces TypeScript
│   ├── guards/
│   │   ├── api-key.guard.ts       # Valida x-api-key en todos los endpoints
│   │   └── hmac.guard.ts          # Valida firma HMAC (cuando SECURITY_HMAC_ENABLED=true)
│   ├── filters/
│   │   └── http-exception.filter.ts  # Normaliza todos los errores al shape estándar
│   ├── interceptors/              # LoggingInterceptor, ResponseInterceptor
│   └── utils/
│       └── crypto.utils.ts        # AES-256-GCM + encryptionTransformer para TypeORM
├── database/
│   ├── migrations/            # Migraciones TypeORM
│   └── scripts/
│       └── reset-db.sql       # Limpia toda la BD y reinicia seriales (solo desarrollo)
└── modules/
    ├── eventos/               # Gestión de campañas/sorteos
    ├── participantes/         # CRUD de participantes
    ├── facturas/              # Registro de tickets, cálculo de cupones, reintentos
    ├── participaciones/       # Relación participante ↔ evento
    ├── imagenes/              # Upload de imágenes a Cloudinary
    └── auditoria/             # Registro de eventos de seguridad
```

---

## Scripts de base de datos

### Reset completo (solo desarrollo/pruebas)

Limpia todas las tablas y reinicia los seriales para dejar la BD como nueva:

```bash
psql "postgresql://user:password@host/dbname?sslmode=require" \
  -f src/database/scripts/reset-db.sql
```

> **¡Atención!** Este script borra todos los datos. Usarlo únicamente en entornos de desarrollo.

---

## Documentación funcional

Ver [`docs/flujo-funcional.md`](docs/flujo-funcional.md) para la guía completa de uso con ejemplos de cada endpoint.

---

## Manejo de errores — Referencia para integradores

### Formato estándar de respuesta de error

Todos los errores siguen exactamente la misma estructura:

```json
{
  "statusCode": 409,
  "codigo": "FAC_001",
  "sistema": "Invoice number already registered for this campaign",
  "mensaje": "El número de factura ingresado ya generó cupones en esta campaña",
  "path": "/api/tickets",
  "timestamp": "2026-04-13T12:00:00.000Z"
}
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `statusCode` | `number` | HTTP status code estándar |
| `codigo` | `string` | Código de error único — úsalo para manejar casos específicos en el cliente |
| `sistema` | `string` | Mensaje técnico en inglés (útil para logs y soporte) |
| `mensaje` | `string` | Mensaje localizado en español listo para mostrar al usuario |
| `path` | `string` | URL del endpoint que generó el error |
| `timestamp` | `string` | Fecha y hora ISO 8601 del error |

Algunos errores incluyen campos adicionales:

```json
// Errores de validación → campo errores[]
{
  "statusCode": 400,
  "codigo": "VAL_001",
  "errores": ["cedula must match /^\\d{6,10}$/", "nombre should not be empty"]
}

// SKU inválido → detalle de qué SKUs fallan
{
  "statusCode": 400,
  "codigo": "FAC_003",
  "skusInvalidos": ["2kg"],
  "skusValidos": ["250g", "500g", "1kg", "5kg"]
}

// Fallo 503 con ticket guardado para reintento
{
  "statusCode": 503,
  "codigo": "FAC_007",
  "pendienteId": 42
}

// Evento no iniciado o vencido → fechas de referencia
{
  "statusCode": 400,
  "codigo": "EVT_004",
  "inicio": "2026-05-01T00:00:00.000Z"
}

// Rate limiting → segundos hasta que se pueda reintentar
{
  "statusCode": 429,
  "codigo": "RATE_001",
  "retryAfter": 47
}
```

---

### Códigos de error

#### Autenticación

| Código | HTTP | Cuándo ocurre |
|--------|------|---------------|
| `AUTH_001` | 401 | Falta el header `x-api-key` |
| `AUTH_003` | 401 | El valor de `x-api-key` no es válido |
| `AUTH_004` | 401 | Faltan `X-Signature` o `X-Timestamp` (cuando HMAC está habilitado) |
| `AUTH_005` | 401 | El timestamp HMAC está fuera de la ventana permitida |
| `AUTH_006` | 401 | La firma HMAC no coincide |

#### Campañas / Eventos

| Código | HTTP | Cuándo ocurre |
|--------|------|---------------|
| `EVT_001` | 404 | El `eventoId` no existe |
| `EVT_002` | 400 | La campaña no está activa (`activo = false`) |
| `EVT_003` | 400 | La campaña fue cerrada manualmente |
| `EVT_004` | 400 | La campaña aún no inició (`fechaInicio` en el futuro) — incluye campo `inicio` |
| `EVT_005` | 400 | La campaña ya venció (`fechaCierre` en el pasado) — incluye campo `cierre` |
| `EVT_008` | 400 | Fechas inválidas al crear/actualizar un evento — incluye campo `detalle` |
| `EVT_009` | 400 | Configuración de condiciones de cupones inconsistente |

#### Tickets / Facturas

| Código | HTTP | Cuándo ocurre |
|--------|------|---------------|
| `FAC_001` | 409 | El `numeroTicket` ya fue registrado en esta campaña (por cualquier usuario) |
| `FAC_002` | 404 | El ID de factura no existe |
| `FAC_003` | 400 | Uno o más SKUs no son válidos para esta campaña — incluye `skusInvalidos` y `skusValidos` |
| `FAC_004` | 404 | El ID de ticket pendiente no existe |
| `FAC_005` | 400 | El ticket pendiente ya fue procesado exitosamente |
| `FAC_006` | 400 | El ticket pendiente está siendo procesado en este momento |
| `FAC_007` | 503 | Falló la subida a Cloudinary — ticket guardado para reintento — incluye `pendienteId` |
| `FAC_008` | 503 | Falló la escritura en DB tras subir la imagen — ticket guardado para reintento — incluye `pendienteId` |

#### Imágenes

| Código | HTTP | Cuándo ocurre |
|--------|------|---------------|
| `IMG_001` | 400 | Tipo de archivo no permitido — incluye `tipoRecibido` |
| `IMG_002` | 400 | La imagen supera 5 MB — incluye `tamanoRecibidoKb` y `limiteKb` |
| `IMG_003` | 400 | Error en el SDK de Cloudinary — incluye `detalle` con el mensaje del SDK |
| `IMG_004` | 409 | La misma imagen ya fue usada en esta campaña (hash SHA-256 duplicado) |
| `IMG_005` | 503 | No hay imagen disponible para el reintento |

#### Participantes

| Código | HTTP | Cuándo ocurre |
|--------|------|---------------|
| `USR_001` | 404 | No existe un participante con esa cédula |
| `USR_003` | 400 | El campo `nombre` es obligatorio para un nuevo participante |
| `USR_004` | 400 | No se pudo registrar la participación en la campaña |

#### Validación y Rate Limiting

| Código | HTTP | Cuándo ocurre |
|--------|------|---------------|
| `VAL_001` | 400 | El body no cumple las reglas del DTO — incluye `errores[]` con detalle por campo |
| `RATE_001` | 429 | Demasiadas solicitudes desde la misma IP — incluye `retryAfter` en segundos |

#### Servidor

| Código | HTTP | Cuándo ocurre |
|--------|------|---------------|
| `SRV_001` | 500 | Error interno inesperado |
| `SRV_002` | 500 | Variable de entorno requerida no configurada en el servidor |

---

### Flujo recomendado para el cliente ante un 503

Cuando recibes `FAC_007` o `FAC_008`, el ticket **sí quedó guardado** con `pendienteId`. El backend lo reintentará automáticamente. Si necesitás forzar el reintento manualmente:

```
POST /api/tickets/pendientes/{pendienteId}/reintentar
```

---

## Límites importantes

| Recurso | Límite |
|---------|--------|
| Tamaño máximo del body | 10 MB |
| Imagen base64 recomendada | hasta 5 MB (~6.8 MB en base64) |
| Rate limit (configurable) | 100 req / 60 s por IP |
| Cédula | máximo 10 caracteres |
| Número de ticket | máximo 50 caracteres |
