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
    const authHeader = request.headers['authorization'];

    if (!authHeader) {
      throw new UnauthorizedException({
        code: ERROR_CODES.MISSING_AUTH_HEADER,
        message: 'Authorization header requerido',
      });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      throw new UnauthorizedException({
        code: ERROR_CODES.INVALID_AUTH_FORMAT,
        message: 'Formato inválido. Use: Authorization: Bearer <token>',
      });
    }

    const token = parts[1];
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
