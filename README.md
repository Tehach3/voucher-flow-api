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
│   ├── constants/             # SKU_CUPONES: mapeo SKU → cupones/unidad
│   ├── dtos/                  # DTOs con validación class-validator
│   ├── interfaces/            # Interfaces TypeScript
│   ├── guards/
│   │   ├── api-key.guard.ts   # Valida x-api-key en todos los endpoints
│   │   └── hmac.guard.ts      # Valida firma HMAC (cuando SECURITY_HMAC_ENABLED=true)
│   ├── filters/               # HttpExceptionFilter — shape de errores uniforme
│   ├── interceptors/          # LoggingInterceptor, ResponseInterceptor
│   └── utils/
│       └── crypto.utils.ts    # AES-256-GCM + encryptionTransformer para TypeORM
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

## Límites importantes

| Recurso | Límite |
|---------|--------|
| Tamaño máximo del body | 10 MB |
| Imagen base64 recomendada | hasta 5 MB (~6.8 MB en base64) |
| Rate limit (configurable) | 100 req / 60 s por IP |
| Cédula | máximo 10 caracteres |
| Número de ticket | máximo 50 caracteres |
