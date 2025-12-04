import 'reflect-metadata';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './shared/filters/http-exception.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.use(helmet());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors: ValidationError[]) => {
        const fieldErrors = errors.reduce<Record<string, string>>((acc, err) => {
          const constraints = err.constraints ? Object.values(err.constraints) : [];
          if (constraints.length > 0) {
            acc[err.property] = constraints[0];
          }
          return acc;
        }, {});
        return new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          fieldErrors,
        });
      },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableCors({
    origin: process.env.CORS_ALLOWED_ORIGINS
      ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
      : true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
}

bootstrap();
