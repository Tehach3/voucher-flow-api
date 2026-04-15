import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import * as express from 'express';
import { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { AppValidationPipe } from './common/pipes/validation.pipe';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

// Tamaño máximo permitido para el body (imágenes base64 de hasta ~7 MB)
const MAX_BODY_SIZE = '10mb';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');

  // Deshabilitar body parser interno para configurar límite manualmente
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  // Body parsers con límite ampliado para soportar imágenes en base64.
  // La opción `verify` captura el raw body antes del parseo — requerido por HmacGuard.
  app.use(
    express.json({
      limit: MAX_BODY_SIZE,
      verify: (req: any, _res, buf) => {
        req.rawBody = buf.toString('utf8');
      },
    }),
  );
  app.use(express.urlencoded({ limit: MAX_BODY_SIZE, extended: true }));

  // Security headers (exclude swagger paths from CSP restrictions)
  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );

  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Prefijo global
  app.setGlobalPrefix('api');

  // Global pipes, filters e interceptors
  app.useGlobalPipes(AppValidationPipe);
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Voucher Flow API')
    .setDescription(
      '## Plataforma de sorteos y cupones promocionales\n\n' +
      'Esta API gestiona el ciclo completo de una campaña promocional: desde la creación del evento ' +
      'hasta el registro de tickets de compra y la acumulación de cupones por participante.\n\n' +
      '### Flujo principal\n' +
      '1. **Crear un evento** (`POST /api/eventos`) — define la campaña, fechas, SKUs válidos y reglas de cupones.\n' +
      '2. **Registrar participación** (`POST /api/tickets`) — incluye la imagen como Data URI base64 en el mismo JSON. ' +
      'Valida el ticket, crea al participante si es nuevo, ' +
      'calcula y acumula los cupones en la campaña.\n' +
      '3. **Consultar cupones** (`GET /api/tickets/:cedula/cupones`) — permite al participante ver su historial.\n' +
      '4. **Reportes** (`GET /api/reportes/eventos/:id/...`) — estadísticas y detalle de facturas para el backoffice.\n\n' +
      '### Autenticación\n' +
      'Todos los endpoints (excepto `GET /api/health`) requieren el header `x-api-key: <API_KEY>`.\n\n' +
      '### Manejo de fallos\n' +
      'Si Cloudinary o la base de datos fallan al registrar un ticket, los datos quedan en `tickets_pendientes`. ' +
      'Usa los endpoints de reintento para reprocesarlos sin pérdida de información.',
    )
    .setVersion('1.0')
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'x-api-key' },
      'x-api-key',
    )
    .addTag('health',    'Verificación de que el servicio está operativo')
    .addTag('eventos',   'Ciclo de vida de campañas: crear, editar, consultar y cerrar eventos')
    .addTag('tickets',   'Registro de tickets de compra, acumulación de cupones y consulta del historial por participante')
    .addTag('reportes',  'Estadísticas y reporte detallado de facturas por evento (uso backoffice)')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  // Manejo de errores Express antes de que lleguen al pipeline de NestJS
  // (body demasiado grande ocurre en la capa de middleware, no en los filtros de NestJS)
  app.use(
    (
      err: { type?: string; status?: number; message?: string },
      req: Request,
      res: Response,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      _next: NextFunction,
    ) => {
      if (err.type === 'entity.too.large') {
        res.status(413).json({
          statusCode: 413,
          codigo: 'IMG_002',
          sistema: 'Request body exceeds the allowed limit',
          mensaje: `El cuerpo de la solicitud supera el límite permitido de ${MAX_BODY_SIZE}. Las imágenes en base64 no deben superar los 7 MB.`,
          path: req.url,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      res.status(err.status ?? 500).json({
        statusCode: err.status ?? 500,
        codigo: 'SRV_001',
        sistema: err.message ?? 'Internal server error',
        mensaje: 'Error interno del servidor',
        path: req.url,
        timestamp: new Date().toISOString(),
      });
    },
  );

  // Graceful shutdown — NestJS cierra conexiones limpias al recibir SIGTERM/SIGINT
  app.enableShutdownHooks();

  // Escuchar en 0.0.0.0 para ser accesible fuera del container (Railway, Docker)
  const port = parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port, '0.0.0.0');
  logger.log(`Application running on http://0.0.0.0:${port}`);
  logger.log(`Swagger docs:    http://localhost:${port}/api/docs`);
  logger.log(`Health check:    http://localhost:${port}/api/health`);
  logger.log(`Prefix:          /api`);
  logger.log(`Environment:     ${process.env.NODE_ENV ?? 'development'}`);
}

bootstrap();
