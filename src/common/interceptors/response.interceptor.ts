import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  NotFoundException,
} from '@nestjs/common';
import { Observable, throwError, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      switchMap((data) => {
        if (this.isEmpty(data)) {
          return throwError(() => new NotFoundException('Recurso no encontrado'));
        }

        return of({
          success: true,
          data,
          timestamp: new Date().toISOString(),
        });
      }),
    );
  }

  private isEmpty(data: unknown): boolean {
    if (data === null || data === undefined) return true;

    if (Array.isArray(data)) return data.length === 0;

    // Respuesta paginada: { data: [], total: 0, ... }
    if (
      typeof data === 'object' &&
      'data' in data &&
      Array.isArray((data as Record<string, unknown>)['data'])
    ) {
      return ((data as Record<string, unknown>)['data'] as unknown[]).length === 0;
    }

    return false;
  }
}
