import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AlertsModule } from '../alerts/alerts.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { ThingspeakService } from './thingspeak.service.js';
import { ThingspeakController } from './thingspeak.controller.js';

@Module({
  imports: [AuthModule, AlertsModule, AuditModule],
  providers: [ThingspeakService],
  controllers: [ThingspeakController],
})
export class ThingspeakModule {}
