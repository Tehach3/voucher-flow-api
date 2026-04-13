import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export function getDatabaseConfig(): TypeOrmModuleOptions {
  const url = process.env.DATABASE_URL;

  if (url) {
    return {
      type: 'postgres',
      url,
      entities: [__dirname + '/../**/*.entity{.ts,.js}'],
      migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
      synchronize: false,
      logging: ['error', 'schema', 'migration', 'warn'],
      ssl: { rejectUnauthorized: false },
      retryAttempts: 3,
      retryDelay: 2000,
      extra: {
        max: 10,
        min: 2,
        connectionTimeoutMillis: 5000,
      },
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
    logging: ['error', 'schema', 'migration', 'warn'],
    ssl:
      process.env.DATABASE_SSL === 'true'
        ? { rejectUnauthorized: false }
        : false,
    retryAttempts: 3,
    retryDelay: 2000,
    extra: {
      max: 10,
      min: 2,
      connectionTimeoutMillis: 5000,
    },
  };
}

// Para uso directo en migraciones CLI (donde dotenv no está cargado por NestJS)
// Requiere DATABASE_URL o variables individuales ya en el entorno
export const databaseConfig = getDatabaseConfig;
