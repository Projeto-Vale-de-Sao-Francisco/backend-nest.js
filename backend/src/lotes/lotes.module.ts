import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { LotesController } from './lotes.controller.js';
import { LotesService } from './lotes.service.js';

@Module({
  imports: [AuthModule],
  controllers: [LotesController],
  providers: [LotesService],
})
export class LotesModule {}
