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

Editar `.env` con los valores reales:

```env
# Puerto donde corre la API (default 3000)
PORT=3000
NODE_ENV=development
CORS_ORIGIN=*

# Clave para autenticar todas las peticiones (elige una cadena segura)
API_KEY=mi_clave_secreta_aqui

# Cadena de conexión a PostgreSQL / Neon
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
DATABASE_SSL=true

# Cloudinary — dejar en blanco para usar el modo stub (devuelve URL simulada)
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Rate limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100
```

> **Sin Cloudinary:** si las variables `CLOUDINARY_*` están vacías, el servicio funciona en modo stub. Las imágenes no se suben a ningún lado pero el resto del flujo opera con normalidad. Útil para desarrollo.

### 4. Inicializar la base de datos

Ejecutar el script SQL completo en tu base de datos PostgreSQL. Este script crea todas las tablas, índices, funciones y triggers necesarios:

```bash
# Usando psql (ajustar la cadena de conexión)
psql "postgresql://user:password@host/dbname?sslmode=require" -f init.sql
```

O pegar el contenido de `init.sql` directamente en la consola SQL de Neon / pgAdmin.

> El script es idempotente (`CREATE TABLE IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`) — se puede ejecutar varias veces sin error.

### 5. Levantar en desarrollo

```bash
npm run start:dev
```

La API queda disponible en `http://localhost:3000`.

Verificar que esté corriendo:

```bash
curl http://localhost:3000/api/health
# Respuesta esperada: { "status": "ok", ... }
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

Ejemplo con curl:

```bash
curl -H "x-api-key: mi_clave_secreta_aqui" http://localhost:3000/api/eventos
```

---

## Variables de entorno — referencia completa

| Variable | Requerida | Descripción |
|----------|-----------|-------------|
| `PORT` | No (default `3000`) | Puerto HTTP |
| `NODE_ENV` | No | `development` o `production` |
| `CORS_ORIGIN` | No (default `*`) | Origen permitido para CORS |
| `API_KEY` | Sí | Clave de autenticación de todos los endpoints |
| `DATABASE_URL` | Sí | Cadena de conexión PostgreSQL completa |
| `DATABASE_SSL` | No (default `false`) | `true` para conexiones SSL (Neon requiere `true`) |
| `CLOUDINARY_CLOUD_NAME` | No | Cloud name de Cloudinary |
| `CLOUDINARY_API_KEY` | No | API key de Cloudinary |
| `CLOUDINARY_API_SECRET` | No | API secret de Cloudinary |
| `RATE_LIMIT_WINDOW_MS` | No (default `60000`) | Ventana de rate limiting en ms |
| `RATE_LIMIT_MAX` | No (default `100`) | Peticiones máximas por ventana |

---

## Estructura del proyecto

```
src/
├── main.ts                    # Bootstrap: tamaño de body, Swagger, guards globales
├── app.module.ts              # Módulo raíz
├── config/                    # Configuración desde process.env
├── common/
│   ├── constants/             # Mapeo SKU → cupones
│   ├── dtos/                  # DTOs con validación (class-validator)
│   ├── interfaces/            # Interfaces TypeScript
│   ├── guards/                # ApiKeyGuard
│   ├── filters/               # HttpExceptionFilter (shape de errores uniforme)
│   └── interceptors/          # LoggingInterceptor, ResponseInterceptor
├── database/
│   └── migrations/            # Migraciones TypeORM
└── modules/
    ├── eventos/               # Gestión de campañas/sorteos
    ├── participantes/         # CRUD de participantes
    ├── facturas/              # Registro de tickets y cálculo de cupones
    └── imagenes/              # Upload de imágenes a Cloudinary
```

---

## Documentación funcional

Ver la carpeta [`docs/`](docs/) para guías de uso por flujo:

- [`docs/flujo-funcional.md`](docs/flujo-funcional.md) — Guía completa: crear evento, registrar ticket, consultar cupones

---

## Límites importantes

| Recurso | Límite |
|---------|--------|
| Tamaño máximo del body | 10 MB |
| Imagen base64 recomendada | hasta 5 MB (~6.8 MB en base64) |
| Rate limit (configurable) | 100 req / 60 s por IP |
