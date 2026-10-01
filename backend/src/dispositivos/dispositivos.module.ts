import { Module } from '@nestjs/common';
import { DispositivosService } from './dispositivos.service.js';
import { DispositivosController } from './dispositivos.controller.js';

@Module({
  controllers: [DispositivosController],
  providers: [DispositivosService],
  exports: [DispositivosService],
})
export class DispositivosModule {}

