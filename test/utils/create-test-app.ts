import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';

/**
 * Crea una NestJS app de prueba con los providers/controllers pasados.
 * No requiere DB ni Cloudinary reales.
 */
export async function createTestApp(
  moduleMetadata: Parameters<typeof Test.createTestingModule>[0],
): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule(
    moduleMetadata,
  ).compile();

  const app = moduleFixture.createNestApplication();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.init();
  return app;
}

export const TEST_API_KEY = 'e2e-test-api-key';

export function authHeader(): { Authorization: string } {
  return { Authorization: `Bearer ${TEST_API_KEY}` };
}
