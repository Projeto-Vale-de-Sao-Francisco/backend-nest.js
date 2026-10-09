import { Module } from '@nestjs/common';
import { ReadingsController } from './readings.controller.js';
import { ReadingsService } from './readings.service.js';
import { AlertsModule } from '../alerts/alerts.module.js';

@Module({
  imports: [AlertsModule],
  controllers: [ReadingsController],
  providers: [ReadingsService],
  exports: [ReadingsService],
})
export class ReadingsModule {}
