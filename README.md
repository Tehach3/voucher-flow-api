# Voucher Flow API

Backend REST API para plataforma de sorteos promocionales.

## Stack

- **Runtime**: Node.js 18 LTS
- **Framework**: NestJS 10
- **Database**: PostgreSQL (Neon) via TypeORM
- **Storage / OCR**: Cloudinary
- **Language**: TypeScript 5 (strict mode)

## Setup

```bash
cp .env.example .env
# Editar .env con las credenciales

npm install
npm run start:dev
```

Health check: `GET http://localhost:3000/api/health`

## Comandos

```bash
npm run start:dev       # Desarrollo con hot-reload
npm run build           # Compilar TypeScript
npm run start:prod      # Producción (requiere build previo)
npm run test            # Jest unit tests
npm run test:watch      # Jest en modo watch
npm run test:cov        # Coverage report
npm run test:e2e        # Tests end-to-end
npm run lint            # ESLint
npm run format          # Prettier
```

## Migraciones

```bash
npm run typeorm migration:generate -- -d src/database/database.config.ts -n NombreMigracion
npm run typeorm migration:run -- -d src/database/database.config.ts
npm run typeorm migration:revert -- -d src/database/database.config.ts
```

## Autenticación

Todos los endpoints (excepto `/api/health`) requieren:

```
Authorization: Bearer <API_KEY>
```

## Variables de Entorno

Ver `.env.example` para la lista completa de variables requeridas.
