import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppValidationPipe } from './common/pipes/validation.pipe';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

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
    .addTag('usuarios', 'Gestión de participantes')
    .addTag('tickets', 'Registro de tickets/vouchers y consulta de cupones')
    .addTag('imagenes', 'Upload de imágenes')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = parseInt(process.env.PORT ?? '3000', 10);
  await app.listen(port);
  logger.log(`Application running on http://localhost:${port}`);
  logger.log(`Swagger docs:    http://localhost:${port}/api/docs`);
  logger.log(`Health check:    http://localhost:${port}/api/health`);
  logger.log(`Prefix:          /api`);
  logger.log(`Environment:     ${process.env.NODE_ENV ?? 'development'}`);
}

bootstrap();
