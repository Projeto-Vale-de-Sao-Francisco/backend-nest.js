import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CulturasController } from './culturas.controller.js';
import { CulturasService } from './culturas.service.js';

@Module({
  imports: [AuthModule],
  controllers: [CulturasController],
  providers: [CulturasService],
})
export class CulturasModule {}
