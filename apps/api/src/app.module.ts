import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
  providers: [PrismaService],
  exports: [PrismaService],
})
export class AppModule {}
