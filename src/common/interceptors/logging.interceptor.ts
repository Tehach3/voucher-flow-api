import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { Request } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url } = request;
    const startTime = Date.now();

    this.logger.log(`[${method}] ${url} — iniciado`);

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        this.logger.log(`[${method}] ${url} — completado en ${duration}ms`);
      }),
      catchError((error: Error) => {
        const duration = Date.now() - startTime;
        this.logger.error(
          `[${method}] ${url} — error en ${duration}ms: ${error.message}`,
        );
        return throwError(() => error);
      }),
    );
  }
}
