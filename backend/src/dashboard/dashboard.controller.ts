import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.service.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
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
  resumo(
    @Query() dto: DashboardFiltrosDto,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.dashboard.resumo(dto, usuario);
  }

  @Get('historico')
  historico(
    @Query() dto: HistoricoFiltrosDto,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.dashboard.historico(dto, usuario);
  }
}
