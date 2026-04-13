import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorResponse {
  statusCode: number;
  codigo?: string;
  message?: string | string[];
  path: string;
  timestamp: string;
  [key: string]: unknown;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let extraFields: Record<string, unknown> = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>;
        // Normaliza: acepta tanto 'message' (inglés) como 'mensaje' (español)
        const rawMessage = resp['message'] ?? resp['mensaje'] ?? exception.message;
        // Normaliza: acepta tanto 'code' como 'codigo'
        const rawCode = resp['codigo'] ?? resp['code'];
        // Copia todos los campos extra (pendienteId, etc.) excluyendo statusCode
        const { statusCode: _s, message: _m, mensaje: _mj, code: _c, codigo: _co, ...rest } = resp;
        extraFields = {
          message: rawMessage as string | string[],
          ...(rawCode ? { codigo: rawCode } : {}),
          ...rest,
        };
      } else {
        extraFields = { message: exception.message };
      }
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      extraFields = { message: 'Error interno del servidor' };
      this.logger.error(
        `[HTTP_EXCEPTION_FILTER] Error no controlado`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const errorBody: ErrorResponse = {
      statusCode: status,
      ...extraFields,
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    if (status >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} → ${status}`,
        JSON.stringify(errorBody),
      );
    } else if (status >= 400) {
      this.logger.warn(
        `[${request.method}] ${request.url} → ${status}: ${JSON.stringify(errorBody.message)}`,
      );
    }

    response.status(status).json(errorBody);
  }
}
