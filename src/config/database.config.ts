import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export function getDatabaseConfig(): TypeOrmModuleOptions {
  const url = process.env.DATABASE_URL;

  // Pool configurable desde env para poder ajustar sin redesplegar el código.
  // Neon free tier admite ~107 conexiones totales; Railway free comparte CPU,
  // por lo que 20 conexiones max es un balance seguro entre concurrencia y límite.
  const poolMax     = parseInt(process.env.DATABASE_POOL_MAX     ?? '20', 10);
  const poolMin     = parseInt(process.env.DATABASE_POOL_MIN     ?? '2',  10);
  const poolIdle    = parseInt(process.env.DATABASE_POOL_IDLE_MS ?? '10000', 10);
  const poolTimeout = parseInt(process.env.DATABASE_POOL_TIMEOUT_MS ?? '3000', 10);

  const poolExtra = {
    max: poolMax,
    min: poolMin,
    idleTimeoutMillis: poolIdle,
    connectionTimeoutMillis: poolTimeout,
  };

  if (url) {
    return {
      type: 'postgres',
      url,
      entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
      synchronize: false,
      // Ejecuta migraciones pendientes automáticamente al arrancar la app.
      // TypeORM usa un lock interno — es seguro con múltiples réplicas.
      migrationsRun: true,
      logging: ['error', 'schema', 'migration', 'warn'],
      ssl: { rejectUnauthorized: false },
      retryAttempts: 3,
      retryDelay: 2000,
      extra: poolExtra,
    };
  }

  return {
    type: 'postgres',
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    username: process.env.DATABASE_USER ?? 'postgres',
    password: process.env.DATABASE_PASSWORD ?? 'postgres',
    database: process.env.DATABASE_NAME ?? 'voucher_flow',
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
    synchronize: false,
    migrationsRun: true,
    logging: ['error', 'schema', 'migration', 'warn'],
    ssl:
      process.env.DATABASE_SSL === 'true'
        ? { rejectUnauthorized: false }
        : false,
    retryAttempts: 3,
    retryDelay: 2000,
    extra: poolExtra,
  };
}

// Para uso directo en migraciones CLI (donde dotenv no está cargado por NestJS)
// Requiere DATABASE_URL o variables individuales ya en el entorno
export const databaseConfig = getDatabaseConfig;
