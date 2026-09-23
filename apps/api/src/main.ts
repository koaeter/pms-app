import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const corsOrigins = (process.env.PMS_CORS_ORIGIN ?? 'http://localhost:3000').split(',').map((origin) => origin.trim()).filter(Boolean);
  app.enableCors({ origin: corsOrigins.length === 1 ? corsOrigins[0] : corsOrigins });
  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
