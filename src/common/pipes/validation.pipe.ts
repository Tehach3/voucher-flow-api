import { ValidationPipe as NestValidationPipe, BadRequestException } from '@nestjs/common';
import { ValidationError } from 'class-validator';

interface ErrorCampo {
  campo: string;
  mensaje: string;
}

function aplanarErrores(errors: ValidationError[], prefijo = ''): ErrorCampo[] {
  const resultado: ErrorCampo[] = [];

  for (const error of errors) {
    const campo = prefijo ? `${prefijo}.${error.property}` : error.property;

    if (error.constraints) {
      // Tomar el primer mensaje de constraints (el más relevante)
      resultado.push({ campo, mensaje: Object.values(error.constraints)[0] });
    }

    if (error.children?.length) {
      resultado.push(...aplanarErrores(error.children, campo));
    }
  }

  return resultado;
}

/**
 * Configuración estándar del ValidationPipe para toda la aplicación.
 * Se registra globalmente en main.ts.
 *
 * El exceptionFactory produce errores estructurados { campo, mensaje }
 * para que el frontend pueda mapear cada error al campo específico del formulario.
 */
export const AppValidationPipe = new NestValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: {
    enableImplicitConversion: true,
  },
  exceptionFactory: (errors: ValidationError[]) =>
    new BadRequestException(aplanarErrores(errors)),
});
