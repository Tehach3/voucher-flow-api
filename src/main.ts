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
    .setDescription('API para la plataforma de sorteos y cupones promocionales')
    .setVersion('1.0')
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'x-api-key' },
      'x-api-key',
    )
    .addTag('health', 'Estado del servicio')
    .addTag('eventos', 'Gestión de eventos/sorteos')
    .addTag('participantes', 'Gestión de participantes')
    .addTag('tickets', 'Registro de tickets/vouchers y consulta de cupones')
    .addTag('imagenes', 'Upload de imágenes')
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
