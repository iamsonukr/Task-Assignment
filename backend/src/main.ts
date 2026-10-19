import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  for (const k of ['MONGODB_URI', 'JWT_SECRET'])
    if (!process.env[k]) throw new Error(`Missing required env var ${k}`);
  if ((process.env.JWT_SECRET as string).length < 16) throw new Error('JWT_SECRET must be at least 16 characters');

  // Imported after env validation because modules read process.env at decoration time.
  const { AppModule } = await import('./app.module');
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.set('trust proxy', 1); // behind Render/Railway/Vercel proxies: correct client IPs for rate limiting
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: (process.env.FRONTEND_ORIGINS ?? 'http://localhost:3000').split(',').map((s) => s.trim()),
    credentials: true,
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.listen(process.env.PORT ?? 4000, '0.0.0.0');
}
bootstrap();
