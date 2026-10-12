import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module.js';
import { ThingspeakModule } from './thingspeak/thingspeak.module.js';
import { DevicesModule } from './devices/devices.module.js';
import { AlertsModule } from './alerts/alerts.module.js';
import { ReadingsModule } from './readings/readings.module.js';
import { UsuariosModule } from './usuarios/usuarios.module.js';
import { AuthModule } from './auth/auth.module.js';
import { MercadoModule } from './mercado/mercado.module.js';
import { CulturasModule } from './culturas/culturas.module.js';
import { LotesModule } from './lotes/lotes.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { LogisticaModule } from './logistica/logistica.module.js';

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
    UsuariosModule,
    AuthModule,
    MercadoModule,
    CulturasModule,
    LotesModule,
    DashboardModule,
    LogisticaModule,
  ],
})
export class AppModule {}
