import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('api/health')
  @ApiOperation({ summary: 'Estado del servicio' })
  @ApiOkResponse({ description: 'Servicio operativo', schema: { example: { status: 'ok', timestamp: '2026-01-01T00:00:00.000Z', version: '1.0' } } })
  health(): { status: string; timestamp: string; version: string } {
    return this.appService.getHealth();
  }
}
