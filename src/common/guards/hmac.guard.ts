import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { Request } from 'express';
import { securityConfig } from '../../config/security.config';
import { ERROR_CODES } from '../constants/error.constants';
import { AppException } from '../exceptions/app.exception';

/**
 * Guard HMAC — verifica que cada request esté firmado por la app cliente.
 *
 * El cliente debe enviar:
 *   X-Timestamp:  Unix timestamp en segundos (ej. "1713000000")
 *   X-Signature:  HMAC-SHA256( rawBody + X-Timestamp, APP_HMAC_SECRET ) en hex
 *
 * Si SECURITY_HMAC_ENABLED !== 'true', el guard se desactiva completamente.
 * Requiere que main.ts capture el raw body antes del JSON parser (ver rawBody en Request).
 */
@Injectable()
export class HmacGuard implements CanActivate {
  private readonly logger = new Logger(HmacGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const { hmac } = securityConfig;
    if (!hmac.enabled) return true;

    const req = context.switchToHttp().getRequest<Request & { rawBody?: string }>();
    const signature = req.headers['x-signature'] as string | undefined;
    const timestamp  = req.headers['x-timestamp']  as string | undefined;

    if (!signature || !timestamp) {
      throw AppException.unauthorized(ERROR_CODES.HMAC_MISSING);
    }

    const ts  = parseInt(timestamp, 10);
    const now = Math.floor(Date.now() / 1000);

    if (isNaN(ts) || Math.abs(now - ts) > hmac.windowSecs) {
      throw AppException.unauthorized(ERROR_CODES.HMAC_EXPIRED, {
        windowSecs: hmac.windowSecs,
      });
    }

    if (!hmac.secret) {
      this.logger.error('[HMAC] APP_HMAC_SECRET no está configurado');
      throw AppException.unauthorized(ERROR_CODES.HMAC_CONFIG);
    }

    const rawBody  = req.rawBody ?? '';
    const expected = crypto
      .createHmac('sha256', hmac.secret)
      .update(`${rawBody}${timestamp}`)
      .digest('hex');

    // timingSafeEqual previene ataques de timing
    let isValid: boolean;
    try {
      isValid = crypto.timingSafeEqual(
        Buffer.from(signature.padEnd(expected.length, ' ')),
        Buffer.from(expected),
      );
    } catch {
      isValid = false;
    }

    if (!isValid) {
      this.logger.warn(`[HMAC] Firma inválida — IP: ${req.ip}`);
      throw AppException.unauthorized(ERROR_CODES.HMAC_INVALID);
    }

    return true;
  }
}
