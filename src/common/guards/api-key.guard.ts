import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { ERROR_CODES } from '../constants/error.constants';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKeyHeader = request.headers['x-api-key'];

    if (!apiKeyHeader) {
      throw new UnauthorizedException({
        code: ERROR_CODES.MISSING_AUTH_HEADER,
        message: 'Header x-api-key requerido',
      });
    }

    const token = Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader;
    const apiKey = process.env.API_KEY;

    if (!apiKey || token !== apiKey) {
      this.logger.warn(
        `[API_KEY_GUARD] Token inválido desde IP: ${request.ip}`,
      );
      throw new UnauthorizedException({
        code: ERROR_CODES.INVALID_API_KEY,
        message: 'API Key inválida',
      });
    }

    return true;
  }
}
