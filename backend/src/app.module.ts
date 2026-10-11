import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';
import { ThingspeakModule } from './thingspeak/thingspeak.module.js';
import { DevicesModule } from './devices/devices.module.js';
import { AlertsModule } from './alerts/alerts.module.js';
import { ReadingsModule } from './readings/readings.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    ThingspeakModule,
    DevicesModule,
    AlertsModule,
    ReadingsModule,
  ],
})
export class AppModule {}
