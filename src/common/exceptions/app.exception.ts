import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode, ERROR_CODES } from '../constants/error.constants';
import { APP_MESSAGES } from '../constants/messages.constants';

/**
 * Excepción estándar de la aplicación.
 *
 * Siempre produce un cuerpo con:
 *   - `codigo`  — código de error (e.g. "FAC_001") para que el cliente pueda ramificar lógica
 *   - `sistema` — mensaje técnico en inglés, visible en logs y herramientas de monitoreo
 *   - `mensaje` — mensaje localizado en español para mostrar al usuario final
 *
 * El HttpExceptionFilter serializa este cuerpo automáticamente en cada respuesta de error.
 *
 * Uso:
 *   throw AppException.badRequest(ERROR_CODES.INVALID_SKU, { skusInvalidos: ['xxx'] });
 *   throw AppException.notFound(ERROR_CODES.FACTURA_NOT_FOUND);
 *   throw AppException.serviceUnavailable(ERROR_CODES.UPLOAD_FALLIDO, { pendienteId: 5 });
 */
export class AppException extends HttpException {
  constructor(
    codigo: ErrorCode,
    httpStatus: HttpStatus,
    extra?: Record<string, unknown>,
  ) {
    const msgs = APP_MESSAGES[codigo] ?? APP_MESSAGES[ERROR_CODES.INTERNAL_ERROR];
    super(
      { codigo, sistema: msgs.sistema, mensaje: msgs.mensaje, ...extra },
      httpStatus,
    );
  }

  static badRequest(codigo: ErrorCode, extra?: Record<string, unknown>): AppException {
    return new AppException(codigo, HttpStatus.BAD_REQUEST, extra);
  }

  static notFound(codigo: ErrorCode, extra?: Record<string, unknown>): AppException {
    return new AppException(codigo, HttpStatus.NOT_FOUND, extra);
  }

  static conflict(codigo: ErrorCode, extra?: Record<string, unknown>): AppException {
    return new AppException(codigo, HttpStatus.CONFLICT, extra);
  }

  static unauthorized(codigo: ErrorCode, extra?: Record<string, unknown>): AppException {
    return new AppException(codigo, HttpStatus.UNAUTHORIZED, extra);
  }

  static serviceUnavailable(codigo: ErrorCode, extra?: Record<string, unknown>): AppException {
    return new AppException(codigo, HttpStatus.SERVICE_UNAVAILABLE, extra);
  }

  static tooManyRequests(codigo: ErrorCode, extra?: Record<string, unknown>): AppException {
    return new AppException(codigo, HttpStatus.TOO_MANY_REQUESTS, extra);
  }
}
