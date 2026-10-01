import { Module } from '@nestjs/common';
import { SensoresService } from './sensores.service.js';
import { SensoresController } from './sensores.controller.js';

@Module({
  controllers: [SensoresController],
  providers: [SensoresService],
  exports: [SensoresService],
})
export class SensoresModule {}

