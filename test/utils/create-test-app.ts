import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppValidationPipe } from '../../src/common/pipes/validation.pipe';
import { HttpExceptionFilter } from '../../src/common/filters/http-exception.filter';

/**
 * Crea una NestJS app de prueba con los providers/controllers pasados.
 * Aplica el mismo pipe de validación, filtro de excepciones y prefijo global
 * que usa la app de producción. No requiere DB ni Cloudinary reales.
 */
export async function createTestApp(
  moduleMetadata: Parameters<typeof Test.createTestingModule>[0],
): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule(
    moduleMetadata,
  ).compile();

  const app = moduleFixture.createNestApplication();

  app.setGlobalPrefix('api');
  app.useGlobalPipes(AppValidationPipe);
  app.useGlobalFilters(new HttpExceptionFilter());

  await app.init();
  return app;
}

export const TEST_API_KEY = 'e2e-test-api-key';

/** Header x-api-key para autenticar requests de prueba */
export function authHeader(): { 'x-api-key': string } {
  return { 'x-api-key': TEST_API_KEY };
}
