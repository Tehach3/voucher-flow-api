import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  @ApiOperation({
    summary: 'Verificar estado del servicio',
    description:
      'Endpoint público (sin autenticación) utilizado para health checks de infraestructura ' +
      '(Railway, Docker, load balancers). Retorna `status: "ok"` cuando el proceso está levantado. ' +
      'No verifica conectividad con la base de datos ni con Cloudinary.',
  })
  @ApiOkResponse({ description: 'Servicio operativo', schema: { example: { status: 'ok', timestamp: '2026-01-01T00:00:00.000Z', version: '1.0' } } })
  health(): { status: string; timestamp: string; version: string } {
    return this.appService.getHealth();
  }
}
