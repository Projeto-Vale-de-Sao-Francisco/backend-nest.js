import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';
import { ThingspeakModule } from './thingspeak/thingspeak.module.js';
import { DispositivosModule } from './dispositivos/dispositivos.module.js';
import { SensoresModule } from './sensores/sensores.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    ThingspeakModule,
    DispositivosModule,
    SensoresModule,
  ],
})
export class AppModule {}