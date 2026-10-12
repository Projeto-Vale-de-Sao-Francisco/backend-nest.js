import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { DashboardService } from './dashboard.service.js';
import {
  DashboardFiltrosDto,
  HistoricoFiltrosDto,
} from './dto/dashboard-filtros.dto.js';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get('resumo')
  resumo(@Query() dto: DashboardFiltrosDto) {
    return this.dashboard.resumo(dto);
  }

  @Get('historico')
  historico(@Query() dto: HistoricoFiltrosDto) {
    return this.dashboard.historico(dto);
  }
}
