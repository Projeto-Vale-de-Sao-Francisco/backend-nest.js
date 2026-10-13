import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AlertasModule } from './alertas/alertas.js';
import { AppController } from './app.controller.js';
import { AuthModule } from './auth/auth.module.js';
import { AcessoModule } from './common/acesso.service.js';
import { CulturasModule } from './culturas/culturas.js';
import { DashboardModule } from './dashboard/dashboard.js';
import { DispositivosModule } from './dispositivos/dispositivos.js';
import { EmpresasModule } from './empresas/empresas.js';
import { LogisticaModule } from './logistica/logistica.js';
import { MedicoesModule } from './medicoes/medicoes.js';
import { MercadoModule } from './mercado/mercado.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { PropriedadesModule } from './propriedades/propriedades.module.js';
import { SensoresModule } from './sensores/sensores.js';
import { TalhoesModule } from './talhoes/talhoes.js';
import { ThingspeakModule } from './thingspeak/thingspeak.module.js';
import { UsuariosModule } from './usuarios/usuarios.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AcessoModule,
    AuthModule,
    UsuariosModule,
    EmpresasModule,
    PropriedadesModule,
    CulturasModule,
    TalhoesModule,
    DispositivosModule,
    SensoresModule,
    MedicoesModule,
    AlertasModule,
    MercadoModule,
    LogisticaModule,
    DashboardModule,
    ThingspeakModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
