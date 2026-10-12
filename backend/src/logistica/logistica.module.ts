import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { LogisticaController } from './logistica.controller.js';
import { LogisticaService } from './logistica.service.js';

@Module({
  imports: [AuthModule],
  controllers: [LogisticaController],
  providers: [LogisticaService],
})
export class LogisticaModule {}
