import { ValidationPipe as NestValidationPipe } from '@nestjs/common';

/**
 * Configuración estándar del ValidationPipe para toda la aplicación.
 * Se registra globalmente en main.ts.
 */
export const AppValidationPipe = new NestValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: {
    enableImplicitConversion: true,
  },
});
