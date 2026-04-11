import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';

interface RateLimitStore {
  count: number;
  resetAt: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);
  private readonly store = new Map<string, RateLimitStore>();
  private readonly windowMs: number;
  private readonly max: number;

  constructor() {
    this.windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS ?? '60000', 10);
    this.max = parseInt(process.env.RATE_LIMIT_MAX ?? '100', 10);
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const key = request.ip ?? 'unknown';
    const now = Date.now();

    const entry = this.store.get(key);

    if (!entry || now > entry.resetAt) {
      this.store.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    entry.count += 1;

    if (entry.count > this.max) {
      this.logger.warn(`[RATE_LIMIT] Límite excedido para IP: ${key}`);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Demasiadas solicitudes. Intente más tarde.',
          retryAfter: Math.ceil((entry.resetAt - now) / 1000),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return true;
  }
}
