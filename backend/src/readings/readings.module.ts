import { Module } from '@nestjs/common';
import { ReadingsController } from './readings.controller.js';
import { ReadingsService } from './readings.service.js';
import { AlertsModule } from '../alerts/alerts.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ApiKeyGuard } from './guards/api-key.guard.js';

@Module({
  imports: [AlertsModule, AuthModule],
  controllers: [ReadingsController],
  providers: [ReadingsService, ApiKeyGuard],
  exports: [ReadingsService],
})
export class ReadingsModule {}
