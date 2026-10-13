import { Module } from '@nestjs/common';
import { MedicoesModule } from '../medicoes/medicoes.js';
import { ThingspeakController } from './thingspeak.controller.js';
import { ThingspeakService } from './thingspeak.service.js';

@Module({
  imports: [MedicoesModule],
  providers: [ThingspeakService],
  controllers: [ThingspeakController],
})
export class ThingspeakModule {}
