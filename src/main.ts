import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { PartnersModule } from './modules/partners/partners.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // CORS Configuration
  const port = configService.get<number>('PORT', 3000);
  // The server's own origin is always allowed (covers Swagger UI at same host:port)
  const serverOrigin = `http://localhost:${port}`;
  const rawOrigins = process.env.CORS_ORIGIN || serverOrigin;
  const allowedOrigins = [
    ...new Set([serverOrigin, ...rawOrigins.split(',').map((o) => o.trim())]),
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, server-to-server)
      if (!origin) return callback(null, true);
      // Allow same-origin Swagger requests and any explicitly configured origin
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`🚫 CORS: Blocked request from origin: ${origin}`);
        callback(new Error(`CORS: Origin ${origin} not allowed`), false);
      }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With', 
      'Content-Type', 
      'Accept',
      'Authorization',
      'Cache-Control',
      'X-Api-Key',
      'X-Api-Secret'
    ],
    exposedHeaders: ['X-Total-Count'],
    credentials: true,
    maxAge: 86400, // 24 hours
  });

  // Swagger / OpenAPI setup for Partner API playground
  const swaggerConfig = new DocumentBuilder()
    .setTitle('MetroProp Partner API')
    .setDescription(
      'API para integración de CRMs y partners externos. ' +
      'Permite crear organizaciones, gestionar propiedades, imágenes y adjuntos.',
    )
    .setVersion('1.0')
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-api-key',
        in: 'header',
        description: 'API Key del partner',
      },
      'x-api-key',
    )
    .addApiKey(
      {
        type: 'apiKey',
        name: 'x-api-secret',
        in: 'header',
        description: 'API Secret del partner',
      },
      'x-api-secret',
    )
    .addTag('Organizations', 'Crear organizaciones con sucursal y usuario administrador')
    .addTag('Properties', 'CRUD de propiedades inmobiliarias')
    .addTag('Images', 'Gestión de imágenes de propiedades')
    .addTag('Attached', 'Gestión de archivos adjuntos de propiedades')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig, {
    include: [PartnersModule],
  });
  SwaggerModule.setup('api/partner/docs', app, document);

  await app.listen(port, () => {
    console.log(`🚀 Application is running on: http://localhost:${port}`);
    console.log(`📖 Partner API Swagger: http://localhost:${port}/api/partner/docs`);
    console.log(`📚 Developer Docs: http://localhost:${port}/developers`);
  });
}

bootstrap();
