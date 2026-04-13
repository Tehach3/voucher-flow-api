import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { ERROR_CODES } from '../constants/error.constants';
import { AppException } from '../exceptions/app.exception';

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
      throw AppException.tooManyRequests(ERROR_CODES.RATE_LIMIT_EXCEEDED, {
        retryAfter: Math.ceil((entry.resetAt - now) / 1000),
      });
    }

    return true;
  }
}
