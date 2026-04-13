import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ERROR_CODES } from '../constants/error.constants';
import { APP_MESSAGES } from '../constants/messages.constants';

/**
 * Filtro global de excepciones.
 *
 * Garantiza que todas las respuestas de error tengan la misma forma:
 * {
 *   "statusCode": <HTTP status>,
 *   "codigo":     <código de error, p.ej. "FAC_001">,
 *   "sistema":    <mensaje técnico en inglés para logs/debugging>,
 *   "mensaje":    <mensaje localizado en español para el usuario>,
 *   "path":       <ruta del request>,
 *   "timestamp":  <ISO 8601>,
 *   // campos extra opcionales según el error (errores[], pendienteId, retryAfter, etc.)
 * }
 *
 * - AppException → se pasa directamente (ya trae codigo/sistema/mensaje).
 * - ValidationPipe (400 con array) → se mapea automáticamente a VAL_001.
 * - Cualquier otro HttpException sin estructura → se normaliza con código SRV_001.
 * - Errores no controlados → 500 con SRV_001.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let body: Record<string, unknown>;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>;

        if (resp['codigo'] && resp['sistema'] && resp['mensaje']) {
          // AppException: estructura completa — pasar directamente
          const { statusCode: _s, ...rest } = resp;
          body = rest;
        } else {
          const rawMessage = resp['message'] ?? resp['mensaje'] ?? exception.message;

          if (Array.isArray(rawMessage)) {
            // ValidationPipe lanza { message: string[], statusCode: 400 }
            const msgs = APP_MESSAGES[ERROR_CODES.VALIDATION_ERROR];
            body = {
              codigo: ERROR_CODES.VALIDATION_ERROR,
              sistema: msgs.sistema,
              mensaje: msgs.mensaje,
              errores: rawMessage,
            };
          } else {
            // HttpException genérico sin código AppException
            const msg = String(rawMessage);
            body = {
              codigo: String(resp['code'] ?? resp['codigo'] ?? ERROR_CODES.INTERNAL_ERROR),
              sistema: msg,
              mensaje: msg,
            };
          }
        }
      } else {
        body = {
          codigo: ERROR_CODES.INTERNAL_ERROR,
          sistema: exception.message,
          mensaje: exception.message,
        };
      }
    } else {
      // Error no controlado (no es HttpException)
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      const msgs = APP_MESSAGES[ERROR_CODES.INTERNAL_ERROR];
      body = {
        codigo: ERROR_CODES.INTERNAL_ERROR,
        sistema: msgs.sistema,
        mensaje: msgs.mensaje,
      };
      this.logger.error(
        `[HTTP_EXCEPTION_FILTER] Error no controlado`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const errorBody: Record<string, unknown> = {
      statusCode: status,
      ...body,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    if (status >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} → ${status} [${errorBody['codigo']}]`,
        JSON.stringify(errorBody),
      );
    } else if (status >= 400) {
      this.logger.warn(
        `[${request.method}] ${request.url} → ${status} [${errorBody['codigo']}]`,
      );
    }

    response.status(status).json(errorBody);
  }
}
