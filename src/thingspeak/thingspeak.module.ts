import { Module } from '@nestjs/common';
import { ThingspeakService } from './thingspeak.service.js';
import { ThingspeakController } from './thingspeak.controller.js';

@Module({
  providers: [ThingspeakService],
  controllers: [ThingspeakController]
})
export class ThingspeakModule {}
