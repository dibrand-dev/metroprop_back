import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { setupSwagger } from './common/swagger.setup';

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

  // Swagger / OpenAPI — Partner API playground
  setupSwagger(app);

  await app.listen(port, () => {
    console.log(`🚀 Application is running on: http://localhost:${port}`);
    console.log(`📖 Partner API Swagger: http://localhost:${port}/api/partner/docs`);
    console.log(`📚 Developer Docs: http://localhost:${port}/developers`);
  });
}

bootstrap();
