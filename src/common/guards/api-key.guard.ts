import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { ERROR_CODES } from '../constants/error.constants';
import { AppException } from '../exceptions/app.exception';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKeyHeader = request.headers['x-api-key'];

    if (!apiKeyHeader) {
      throw AppException.unauthorized(ERROR_CODES.MISSING_API_KEY);
    }

    const token = Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader;
    const apiKey = process.env.API_KEY;

    if (!apiKey || token !== apiKey) {
      this.logger.warn(`[API_KEY_GUARD] Token inválido desde IP: ${request.ip}`);
      throw AppException.unauthorized(ERROR_CODES.INVALID_API_KEY);
    }

    return true;
  }
}
