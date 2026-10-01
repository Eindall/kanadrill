import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import morgan from 'morgan';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Derrière nginx puis le reverse proxy du VPS : on fait confiance à X-Forwarded-* (IP réelle, https).
  app.set('trust proxy', 1);
  app.use(helmet());
  // Journal des requêtes : coloré en dev, format Apache standard en production (logs de conteneur).
  app.use(morgan(process.env['NODE_ENV'] === 'production' ? 'combined' : 'dev'));
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();

  const port = process.env['PORT'] || 3000;
  await app.listen(port);
  Logger.log(`API démarrée sur http://localhost:${port}/api`);
}

bootstrap();
