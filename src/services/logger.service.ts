import { Injectable, Logger, LogLevel } from '@nestjs/common';

@Injectable()
export class LoggerService {
  private readonly logger: Logger;

  constructor(context = 'App') {
    this.logger = new Logger(context);
  }

  static forContext(context: string): LoggerService {
    return new LoggerService(context);
  }

  log(message: string, ...optionalParams: unknown[]): void {
    this.logger.log(message, ...optionalParams);
  }

  debug(message: string, ...optionalParams: unknown[]): void {
    this.logger.debug(message, ...optionalParams);
  }

  warn(message: string, ...optionalParams: unknown[]): void {
    this.logger.warn(message, ...optionalParams);
  }

  error(message: string, trace?: string, ...optionalParams: unknown[]): void {
    this.logger.error(message, trace, ...optionalParams);
  }

  verbose(message: string, ...optionalParams: unknown[]): void {
    this.logger.verbose(message, ...optionalParams);
  }

  setLogLevels(levels: LogLevel[]): void {
    this.logger.localInstance?.setLogLevels?.(levels);
  }
}
